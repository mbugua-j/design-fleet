import unittest
from pathlib import Path

from test_figma_authoring_guidance import load_fleet_module, squash


ROOT = Path(__file__).resolve().parents[1]


class EvidenceContractTests(unittest.TestCase):
    def agent(self, name):
        return squash((ROOT / "agents" / f"{name}.agent.md").read_text())

    def test_shipwright_distinguishes_gate_outcomes_and_disputes(self):
        text = self.agent("Shipwright")
        self.assertNotIn("A gate you skipped is a gate that failed", text)
        for phrase in ("merge-base SHA", "known-bad", "independent re-check", "not run", "blocked"):
            self.assertIn(phrase, text)

    def test_surveyor_preserves_read_only_sensitivity_and_classification(self):
        text = self.agent("Surveyor")
        for phrase in ("confirmed", "latent", "unverified", "merge-base SHA",
                       "Never mutate the reviewed source", "independent re-check"):
            self.assertIn(phrase, text)

    def test_lookout_measures_and_calibrates_without_new_permissions(self):
        text = self.agent("Lookout")
        self.assertIn("tools: ['read', 'search', 'playwright/*']", text)
        for phrase in ("numeric", "negative control", "themes", "e2e", "Shipwright"):
            self.assertIn(phrase, text)
        self.assertIn("not required for routine", text)

    def test_herald_public_evidence_and_boundaries(self):
        text = self.agent("Herald")
        for phrase in ("user impact", "Before | After", "1024", "reader-accessible",
                       "provenance", "not run", "Lookout"):
            self.assertIn(phrase, text)
        self.assertNotIn("Say which stations checked it", text)
        self.assertIn("Never mark a conversation resolved", text)

    def test_watchkeeper_uses_real_helper_not_watermark_example(self):
        text = self.agent("Watchkeeper")
        self.assertNotIn("lastCommentId", text)
        self.assertNotIn("missing or unreadable, treat every comment as new", text)
        for phrase in ("watch.py", "baseline", "plan", "commit", "receipts",
                       "docs/watch-state.md", "incomplete", "edited", "the plan contains no events"):
            self.assertIn(phrase, text)

    def test_generated_crew_keeps_evidence_and_watch_contracts(self):
        fleet = load_fleet_module()
        crew = fleet.load_crew("plain")
        for station, phrase in (
            ("shipwright", "independent re-check"),
            ("surveyor", "Never mutate the reviewed source"),
            ("lookout", "negative control"),
            ("herald", "Before | After"),
            ("watchkeeper", "docs/watch-state.md"),
        ):
            _, content = fleet.build_agent(station, crew["names"], crew["name"])
            self.assertIn(phrase, squash(content))

    def test_watchkeeper_scope_uses_open_discovery_without_rewriting_history(self):
        text = self.agent("Watchkeeper")
        for phrase in ("watch.scope", "authored-by-me", "all-open", "without an author filter",
                       "never scope", "Preserve stored history unchanged", "regenerate the plan",
                       "Before routing or reporting", "state re-read fails"):
            self.assertIn(phrase, text)
        self.assertNotIn("--author <contributor>", text)
        self.assertNotIn("retire any matching active baseline entries", text)

    def test_model_defaults_and_permissions_stay_canonical(self):
        fleet = load_fleet_module()
        for station in fleet.load_roles()["stations"]:
            text = (ROOT / "agents" / f"{station['display']}.agent.md").read_text()
            front, _ = fleet.split_front_matter(text)
            self.assertIn(f"model: {station['model']}", front)
        self.assertIn("Never resolve a merge conflict", self.agent("BuildR"))


if __name__ == "__main__":
    unittest.main()
