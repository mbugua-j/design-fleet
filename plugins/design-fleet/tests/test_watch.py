import copy
import importlib.util
import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


HELPER = Path(__file__).resolve().parents[1] / "bin" / "watch.py"
T0 = "2026-09-05T10:00:00Z"
T1 = "2026-09-05T11:00:00Z"
T2 = "2026-09-05T12:00:00Z"


def comment(number=1, updated=T0, body="Please fix this"):
    return {
        "id": number, "createdAt": T0, "updatedAt": updated,
        "body": body, "author": "reviewer",
    }


def snapshot(comments=(), observed=T0, conflict=False):
    return {
        "version": 1, "repo": "acme/console", "scope": [12],
        "discoveryComplete": True, "observedAt": observed,
        "pullRequests": [{
            "number": 12,
            "metadata": {
                "headSha": "a" * 40, "mergeable": "CONFLICTING" if conflict else "MERGEABLE",
                "mergeStateStatus": "DIRTY" if conflict else "CLEAN",
                "author": "contributor", "sourceRepo": "acme/console",
                "sourceBranch": "fix/example", "baseBranch": "main",
            },
            "comments": {
                kind: {"complete": True, "items": list(comments) if kind == "issue" else []}
                for kind in ("issue", "review", "inline")
            },
        }],
    }


class WatchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not HELPER.exists():
            raise AssertionError("Watchkeeper needs an implemented watch.py state helper")
        spec = importlib.util.spec_from_file_location("fleet_watch", HELPER)
        cls.watch = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.watch)

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name) / "state.json"

    def baseline(self, data=None):
        return self.watch.baseline(self.state, data or snapshot())

    def plan(self, data):
        return self.watch.plan(self.state, data)

    def commit(self, data, plan=None, ids=None):
        plan = plan or self.plan(data)
        ids = ids if ids is not None else [event["id"] for event in plan["events"]]
        receipts = [
            {"eventId": event_id, "disposition": "routed", "reference": "handoff:123"}
            for event_id in ids
        ]
        return self.watch.commit(self.state, data, plan, receipts)

    def stored(self):
        return json.loads(self.state.read_text())

    def test_missing_state_requires_explicit_baseline(self):
        with self.assertRaisesRegex(self.watch.WatchError, "baseline"):
            self.plan(snapshot())
        self.assertFalse(self.state.exists())

    def test_empty_open_scope_does_not_resurrect_or_prune_stored_prs(self):
        self.baseline(snapshot([comment()], conflict=True))
        history = copy.deepcopy(self.stored()["prs"])
        data = snapshot(observed=T1)
        data["scope"] = []
        data["pullRequests"] = []
        plan = self.plan(data)
        self.assertTrue(plan["coverage"]["complete"])
        self.assertEqual([], plan["events"])
        self.commit(data, plan, [])
        self.assertEqual(history, self.stored()["prs"])

    def test_baseline_is_explicit_complete_and_never_overwrites(self):
        data = snapshot([comment()], conflict=True)
        result = self.baseline(data)
        self.assertEqual(1, result["baselinedComments"])
        self.assertEqual([], self.plan(data)["events"])
        before = self.state.read_bytes()
        with self.assertRaisesRegex(self.watch.WatchError, "exists"):
            self.baseline(data)
        self.assertEqual(before, self.state.read_bytes())

    def test_new_edited_and_endpoint_colliding_ids(self):
        self.baseline(snapshot([comment()]))
        data = snapshot([comment(updated=T1), comment(2)], T1)
        for kind in ("review", "inline"):
            data["pullRequests"][0]["comments"][kind]["items"] = [comment()]
        plan = self.plan(data)
        self.assertEqual(
            {"issue:1", "issue:2", "review:1", "inline:1"},
            {event["key"] for event in plan["events"]},
        )
        self.assertEqual(
            "edited", next(event["change"] for event in plan["events"] if event["key"] == "issue:1")
        )
        self.commit(data, plan)
        self.assertEqual([], self.plan(data)["events"])

    def test_body_fingerprint_catches_edit_without_timestamp_change(self):
        self.baseline(snapshot([comment()]))
        data = snapshot([comment(body="Changed review body")], T1)
        events = self.plan(data)["events"]
        self.assertEqual(1, len(events), "a changed body must emit an event even without a newer timestamp")
        self.assertEqual("edited", events[0]["change"])

    def test_repeated_review_body_edit_has_a_distinct_receipt_identity(self):
        self.baseline(snapshot([comment()]))
        changed = snapshot([comment(body="Edited then restored")], T1)
        events = self.plan(changed)["events"]
        self.assertEqual(1, len(events), "the first body edit must be detected")
        first = events[0]["id"]
        self.commit(changed)
        self.commit(snapshot([comment()], T2))
        changed["observedAt"] = T2
        self.assertNotEqual(first, self.plan(changed)["events"][0]["id"])

    def test_acknowledges_only_read_routed_items_and_replays_after_failure(self):
        self.baseline()
        data = snapshot([comment(), comment(2)], T1)
        plan = self.plan(data)
        before = self.state.read_bytes()
        self.assertEqual(plan, self.plan(data))
        self.assertEqual(before, self.state.read_bytes())
        self.commit(data, plan, [plan["events"][0]["id"]])
        pending = self.plan(data)["events"]
        self.assertEqual([plan["events"][1]], pending)
        self.assertNotIn("body", json.dumps(self.stored()))
        self.assertEqual("handoff:123", self.stored()["prs"]["12"]["comments"]["issue:1"]["receipt"]["reference"])

    def test_duplicate_items_deduplicate_but_contradictory_duplicates_fail(self):
        self.baseline()
        data = snapshot([comment(), comment()], T1)
        self.assertEqual(1, len(self.plan(data)["events"]))
        data["pullRequests"][0]["comments"]["issue"]["items"][1]["body"] = "different"
        with self.assertRaisesRegex(self.watch.WatchError, "duplicate"):
            self.plan(data)

    def test_duplicate_sweep_is_a_byte_preserving_no_op(self):
        data = snapshot([comment()])
        self.baseline(data)
        before = self.state.read_bytes()
        result = self.commit(data)
        self.assertEqual(1, result["revision"])
        self.assertEqual(before, self.state.read_bytes())

    def test_comment_ids_are_scoped_per_pr_and_repository_case_is_normalized(self):
        self.baseline()
        data = snapshot([comment()], T1)
        data["repo"] = "ACME/Console"
        data["scope"].append(13)
        other = copy.deepcopy(data["pullRequests"][0])
        other["number"] = 13
        data["pullRequests"].append(other)
        plan = self.plan(data)
        self.assertEqual(2, len({event["id"] for event in plan["events"]}))
        self.commit(data, plan, [plan["events"][0]["id"]])
        self.assertEqual([13], [event["pr"] for event in self.plan(data)["events"]])

    def test_partial_sweep_never_claims_coverage_or_advances_unseen_items(self):
        self.baseline(snapshot([comment()]))
        data = snapshot([comment(2)], T1)
        data["scope"] = [12, 13]
        data["discoveryComplete"] = False
        data["pullRequests"][0]["comments"]["inline"]["complete"] = False
        plan = self.plan(data)
        self.assertFalse(plan["coverage"]["complete"])
        self.assertEqual(0, plan["coverage"]["completePRs"])
        self.assertEqual([13], plan["coverage"]["missingPRs"])
        self.commit(data, plan)
        self.assertIn("issue:1", self.stored()["prs"]["12"]["comments"])
        later = copy.deepcopy(data)
        later["observedAt"] = T2
        later["pullRequests"][0]["comments"]["inline"] = {"complete": True, "items": [comment(3)]}
        self.assertEqual("inline:3", self.plan(later)["events"][0]["key"])

    def test_partial_baseline_and_unknown_metadata_are_rejected(self):
        data = snapshot()
        data["pullRequests"][0]["comments"]["review"]["complete"] = False
        with self.assertRaisesRegex(self.watch.WatchError, "complete"):
            self.baseline(data)
        data = snapshot()
        data["pullRequests"][0]["metadata"]["headSha"] = None
        with self.assertRaisesRegex(self.watch.WatchError, "complete"):
            self.baseline(data)
        self.assertFalse(self.state.exists())

    def test_unknown_is_not_clean_and_does_not_erase_known_conflict(self):
        self.baseline(snapshot(conflict=True))
        data = snapshot(observed=T1)
        data["pullRequests"][0]["metadata"]["mergeable"] = None
        plan = self.plan(data)
        self.assertFalse(plan["coverage"]["complete"])
        self.assertEqual([12], plan["coverage"]["unknownMetadataPRs"])
        self.commit(data, plan)
        self.assertEqual([], self.plan(snapshot(observed=T2, conflict=True))["events"])

    def test_conflict_transitions_new_head_and_ack_timing(self):
        self.baseline()
        data = snapshot(observed=T1, conflict=True)
        plan = self.plan(data)
        self.assertEqual("conflict", plan["events"][0]["kind"])
        self.commit(data, plan, [])
        self.assertEqual(plan["events"], self.plan(data)["events"])
        self.commit(data)
        self.assertEqual([], self.plan(data)["events"])
        data["observedAt"] = T2
        data["pullRequests"][0]["metadata"]["headSha"] = "b" * 40
        self.assertEqual(1, len(self.plan(data)["events"]))
        self.commit(data)
        clean = snapshot(observed=T2)
        self.commit(clean)
        self.assertEqual(1, len(self.plan(data)["events"]))

    def test_repeated_conflict_has_a_distinct_receipt_identity(self):
        self.baseline()
        data = snapshot(observed=T1, conflict=True)
        first = self.plan(data)["events"][0]["id"]
        self.commit(data)
        self.commit(snapshot(observed=T2))
        data["observedAt"] = T2
        self.assertNotEqual(first, self.plan(data)["events"][0]["id"])

    def test_missing_ownership_and_contradictory_mergeability_stay_unknown(self):
        self.baseline()
        for field, value in (("sourceRepo", None), ("author", None), ("mergeStateStatus", "DIRTY")):
            data = snapshot(observed=T1)
            data["pullRequests"][0]["metadata"][field] = value
            plan = self.plan(data)
            self.assertFalse(plan["coverage"]["complete"])
            self.assertEqual([], plan["events"])

    def test_exact_repo_and_pr_scope(self):
        self.baseline()
        data = snapshot(observed=T1)
        data["repo"] = "other/console"
        with self.assertRaisesRegex(self.watch.WatchError, "repo"):
            self.plan(data)
        data = snapshot(observed=T1)
        data["scope"] = [13]
        with self.assertRaisesRegex(self.watch.WatchError, "scope"):
            self.plan(data)
        empty = snapshot(observed=T1)
        empty["scope"] = []
        empty["pullRequests"] = []
        self.commit(empty)
        self.assertIn("12", self.stored()["prs"])

    def test_old_snapshot_and_older_comment_cannot_roll_back_state(self):
        self.baseline(snapshot([comment(updated=T1)], T1))
        with self.assertRaisesRegex(self.watch.WatchError, "older"):
            self.plan(snapshot(observed=T0))
        with self.assertRaisesRegex(self.watch.WatchError, "older"):
            self.plan(snapshot([comment()], T2))

    def test_stale_plan_and_tampered_plan_cannot_commit(self):
        self.baseline()
        data = snapshot([comment()], T1)
        first = self.plan(data)
        self.commit(data, first)
        before = self.state.read_bytes()
        with self.assertRaisesRegex(self.watch.WatchError, "stale|match"):
            self.commit(data, first)
        current = self.plan(data)
        current["coverage"]["complete"] = False
        with self.assertRaisesRegex(self.watch.WatchError, "stale|match"):
            self.commit(data, current)
        self.assertEqual(before, self.state.read_bytes())

    def test_invalid_receipts_do_not_advance(self):
        self.baseline()
        data = snapshot([comment()], T1)
        plan = self.plan(data)
        for receipts in (
            [{"eventId": "unknown", "disposition": "routed", "reference": "handoff"}],
            [{"eventId": plan["events"][0]["id"], "disposition": "routed", "reference": ""}],
            [{"eventId": plan["events"][0]["id"], "disposition": "posted", "reference": "url"}],
            [{"eventId": plan["events"][0]["id"], "disposition": [], "reference": "url"}],
        ):
            before = self.state.read_bytes()
            with self.assertRaises(self.watch.WatchError):
                self.watch.commit(self.state, data, plan, receipts)
            self.assertEqual(before, self.state.read_bytes())

    def test_corrupt_unreadable_and_legacy_state_are_not_missing(self):
        for raw, message in (
            ("{bad", "JSON"),
            ('{"version":1,"repos":{}}', "legacy|unsupported"),
            ('{"seen":{}}', "legacy|unsupported"),
            ('{"version":2}', "state"),
            ('{"version":2,"version":2}', "duplicate"),
        ):
            self.state.write_text(raw)
            with self.assertRaisesRegex(self.watch.WatchError, message):
                self.plan(snapshot())
            self.assertEqual(raw, self.state.read_text())
        self.state.unlink()
        self.state.mkdir()
        with self.assertRaisesRegex(self.watch.WatchError, "read"):
            self.plan(snapshot())

    def test_permission_failure_is_not_first_run(self):
        self.baseline()
        with patch.object(Path, "read_text", side_effect=PermissionError("denied")):
            with self.assertRaisesRegex(self.watch.WatchError, "read"):
                self.plan(snapshot())

    def test_lock_rejects_overlapping_writer_and_cleans_up(self):
        self.baseline()
        data = snapshot([comment()], T1)
        plan = self.plan(data)
        plan_path = self.state.parent / "plan.json"
        receipts_path = self.state.parent / "receipts.json"
        plan_path.write_text(json.dumps(plan))
        receipts_path.write_text(json.dumps([{
            "eventId": plan["events"][0]["id"], "disposition": "routed", "reference": "handoff:123",
        }]))
        before = self.state.read_bytes()
        with self.watch.locked(self.state):
            result = subprocess.run(
                [sys.executable, str(HELPER), "commit", "--state", str(self.state), "--snapshot", "-",
                 "--plan", str(plan_path), "--receipts", str(receipts_path)],
                input=json.dumps(data), text=True, capture_output=True,
            )
            self.assertNotEqual(0, result.returncode)
            self.assertIn("lock", result.stderr)
        self.assertEqual(before, self.state.read_bytes())
        self.assertEqual(plan, self.plan(data))
        self.commit(data, plan)

    def test_failed_atomic_replace_preserves_state_and_removes_temp_and_lock(self):
        self.baseline()
        before = self.state.read_bytes()
        data = snapshot([comment()], T1)
        with patch.object(self.watch.os, "replace", side_effect=OSError("disk failure")):
            with self.assertRaisesRegex(self.watch.WatchError, "disk failure"):
                self.commit(data)
        self.assertEqual(before, self.state.read_bytes())
        self.assertEqual(["state.json"], sorted(path.name for path in self.state.parent.iterdir()))
        self.commit(data)

    def test_state_symlink_is_rejected(self):
        target = self.state.parent / "original.json"
        target.write_text('{"seen":{}}')
        self.state.symlink_to(target)
        with self.assertRaisesRegex(self.watch.WatchError, "symlink"):
            self.baseline()
        self.assertEqual('{"seen":{}}', target.read_text())

    def test_malformed_nested_state_does_not_reset_history(self):
        self.baseline(snapshot([comment()]))
        data = self.stored()
        data["prs"]["12"]["comments"]["issue:1"]["fingerprint"] = "broken"
        self.state.write_text(json.dumps(data))
        before = self.state.read_bytes()
        with self.assertRaisesRegex(self.watch.WatchError, "fingerprint"):
            self.plan(snapshot())
        self.assertEqual(before, self.state.read_bytes())

    def test_documented_snapshot_uses_the_real_schema(self):
        document = (HELPER.parent.parent / "docs" / "watch-state.md").read_text()
        example = json.loads(re.search(r"```json\n(.*?)\n```", document, re.DOTALL).group(1))
        self.watch.validate_snapshot(example)
        result = self.baseline(example)
        self.assertEqual(1, result["baselinedComments"])

    def test_snapshot_validation(self):
        self.baseline()
        mutations = [
            lambda s: s.update(repo="../console"),
            lambda s: s.update(scope=[True]),
            lambda s: s.update(scope=[12, 12]),
            lambda s: s.update(discoveryComplete="true"),
            lambda s: s.update(observedAt="yesterday"),
            lambda s: s["pullRequests"][0]["metadata"].update(headSha="short"),
            lambda s: s["pullRequests"][0]["metadata"].update(mergeable="maybe"),
            lambda s: s["pullRequests"][0]["comments"]["issue"].update(complete=1),
            lambda s: s["pullRequests"][0]["comments"]["issue"].update(items=[comment(updated="2026-09-04T10:00:00Z")]),
            lambda s: s["pullRequests"][0]["comments"]["issue"].update(items=[comment(True)]),
            lambda s: s.update(typo=True),
        ]
        for mutate in mutations:
            data = snapshot(observed=T1)
            mutate(data)
            with self.subTest(data=data), self.assertRaises(self.watch.WatchError):
                self.plan(data)

    def test_cli_baseline_plan_commit_round_trip(self):
        source = self.state.parent / "snapshot.json"
        plan_path = self.state.parent / "plan.json"
        receipts_path = self.state.parent / "receipts.json"

        def run(command, *extra):
            return subprocess.run(
                [sys.executable, str(HELPER), command, "--state", str(self.state),
                 "--snapshot", str(source), *extra], capture_output=True, text=True,
            )

        source.write_text(json.dumps(snapshot()))
        self.assertEqual(0, run("baseline").returncode)
        source.write_text(json.dumps(snapshot([comment()], T1)))
        result = run("plan")
        self.assertEqual(0, result.returncode, result.stderr)
        plan_path.write_text(result.stdout)
        event_id = json.loads(result.stdout)["events"][0]["id"]
        receipts_path.write_text(json.dumps([{
            "eventId": event_id, "disposition": "drafted", "reference": "local report:1",
        }]))
        result = run("commit", "--plan", str(plan_path), "--receipts", str(receipts_path))
        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual([], json.loads(run("plan").stdout)["events"])


if __name__ == "__main__":
    unittest.main()
