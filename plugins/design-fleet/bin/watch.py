#!/usr/bin/env python3
"""Local, explicit snapshot -> plan -> acknowledged state; no network or scheduler.

See ../docs/watch-state.md for the input contract, collection and recovery workflow.
"""

from __future__ import annotations

import argparse
import copy
from contextlib import contextmanager
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile


KINDS = ("issue", "review", "inline")
MERGE_STATES = {"BEHIND", "BLOCKED", "CLEAN", "DIRTY", "DRAFT", "HAS_HOOKS", "UNKNOWN", "UNSTABLE"}
METADATA = {"headSha", "mergeable", "mergeStateStatus", "author", "sourceRepo", "sourceBranch", "baseBranch"}
REPO = re.compile(r"[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+")
SHA = re.compile(r"[0-9a-f]{40}")
DIGEST = re.compile(r"[0-9a-f]{64}")
COMMENT_KEY = re.compile(r"(issue|review|inline):[1-9][0-9]*")


class WatchError(ValueError):
    """An input, state or persistence failure; never a quiet successful sweep."""


def require(condition, message):
    if not condition:
        raise WatchError(message)


def fields(value, expected, label):
    require(isinstance(value, dict) and set(value) == set(expected),
            f"{label}: expected fields {', '.join(sorted(expected))}")


def positive(value):
    return type(value) is int and value > 0


def text(value):
    return isinstance(value, str) and bool(value.strip())


def repo_name(value):
    require(isinstance(value, str) and REPO.fullmatch(value) and value.split("/")[1] not in {".", ".."},
            "invalid repo; expected owner/repository")
    return value.lower()


def timestamp(value):
    require(isinstance(value, str) and re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", value),
            "timestamp must be UTC YYYY-MM-DDTHH:MM:SSZ")
    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")
    except ValueError as exc:
        raise WatchError(f"invalid timestamp: {value}") from exc


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()).hexdigest()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f"duplicate JSON key: {key}")
        result[key] = value
    return result


def decode(raw):
    try:
        return json.loads(raw, object_pairs_hook=unique_object)
    except (ValueError, RecursionError) as exc:
        raise WatchError(f"invalid JSON: {exc}") from exc


def read_json(path):
    try:
        return decode(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError) as exc:
        raise WatchError(f"cannot read {path}: {exc}") from exc


def metadata_status(value):
    fields(value, METADATA, "metadata")
    for key in METADATA:
        require(value[key] is None or text(value[key]), f"metadata.{key}: expected text or null")
    require(value["headSha"] is None or SHA.fullmatch(value["headSha"]), "metadata.headSha: expected full SHA")
    require(value["mergeable"] in {None, "MERGEABLE", "CONFLICTING", "UNKNOWN"}, "invalid mergeable")
    require(value["mergeStateStatus"] is None or value["mergeStateStatus"] in MERGE_STATES,
            "invalid mergeStateStatus")
    if value["sourceRepo"] is not None:
        repo_name(value["sourceRepo"])
    if any(value[key] is None for key in METADATA):
        return "unknown"
    mergeable, status = value["mergeable"], value["mergeStateStatus"]
    if mergeable == "UNKNOWN" or status == "UNKNOWN":
        return "unknown"
    if mergeable == "CONFLICTING" and status == "DIRTY":
        return "conflicting"
    if mergeable == "MERGEABLE" and status != "DIRTY":
        return "not-conflicting"
    return "unknown"


def validate_snapshot(data):
    fields(data, {"version", "repo", "scope", "discoveryComplete", "observedAt", "pullRequests"}, "snapshot")
    require(type(data["version"]) is int and data["version"] == 1, "unsupported snapshot version")
    repo_name(data["repo"])
    observed = timestamp(data["observedAt"])
    require(type(data["discoveryComplete"]) is bool, "discoveryComplete must be boolean")
    scope = data["scope"]
    require(isinstance(scope, list) and all(positive(n) for n in scope), "scope must be a list of positive PR numbers")
    require(len(scope) == len(set(scope)), "duplicate PR in scope")
    require(isinstance(data["pullRequests"], list), "pullRequests must be a list")
    numbers = set()
    for pr in data["pullRequests"]:
        fields(pr, {"number", "metadata", "comments"}, "pull request")
        number = pr["number"]
        require(positive(number) and number in scope, "pull request outside exact scope")
        require(number not in numbers, "duplicate pull request")
        numbers.add(number)
        metadata_status(pr["metadata"])
        fields(pr["comments"], KINDS, "comments")
        for kind, endpoint in pr["comments"].items():
            fields(endpoint, {"complete", "items"}, f"comments.{kind}")
            require(type(endpoint["complete"]) is bool, "endpoint complete must be boolean")
            require(isinstance(endpoint["items"], list), "endpoint items must be a list")
            seen = {}
            for item in endpoint["items"]:
                fields(item, {"id", "createdAt", "updatedAt", "body", "author"}, "comment")
                require(positive(item["id"]), "comment id must be a positive integer")
                require(isinstance(item["body"], str), "comment body must be text, including empty text")
                require(item["author"] is None or text(item["author"]), "comment author must be text or null")
                created, updated = timestamp(item["createdAt"]), timestamp(item["updatedAt"])
                require(created <= updated <= observed, "comment timestamps out of order or after observedAt")
                require(item["id"] not in seen or seen[item["id"]] == item, "contradictory duplicate comment")
                seen[item["id"]] = item


def validate_receipt(receipt, event_id=None):
    fields(receipt, {"eventId", "disposition", "reference"}, "receipt")
    require(isinstance(receipt["eventId"], str) and DIGEST.fullmatch(receipt["eventId"]), "invalid receipt eventId")
    require(event_id is None or receipt["eventId"] == event_id, "receipt eventId mismatch")
    require(isinstance(receipt["disposition"], str) and receipt["disposition"] in {"routed", "drafted", "noise"},
            "invalid receipt disposition")
    require(text(receipt["reference"]), "receipt reference must name a durable handoff or triage record")


def validate_state(state):
    require(isinstance(state, dict), "invalid state object")
    require(type(state.get("version")) is int and state.get("version") == 2,
            "legacy or unsupported state; preserve/export it unchanged, then explicitly baseline a NEW path; see docs/watch-state.md")
    fields(state, {"version", "repo", "revision", "observedAt", "prs"}, "state")
    repo_name(state["repo"])
    require(positive(state["revision"]), "invalid state revision")
    observed = timestamp(state["observedAt"])
    require(isinstance(state["prs"], dict), "state prs must be an object")
    for number, pr in state["prs"].items():
        require(isinstance(number, str) and re.fullmatch(r"[1-9][0-9]*", number), "invalid state PR number")
        fields(pr, {"comments", "knownMetadata"}, "state PR")
        require(isinstance(pr["comments"], dict), "state comments must be an object")
        for key, item in pr["comments"].items():
            require(isinstance(key, str) and COMMENT_KEY.fullmatch(key), "invalid state comment key")
            fields(item, {"createdAt", "updatedAt", "fingerprint", "receipt", "generation"}, "state comment")
            require(positive(item["generation"]), "invalid comment generation")
            require(timestamp(item["createdAt"]) <= timestamp(item["updatedAt"]) <= observed,
                    "state comment timestamps out of order")
            require(isinstance(item["fingerprint"], str) and DIGEST.fullmatch(item["fingerprint"]), "invalid fingerprint")
            if item["receipt"] is not None:
                validate_receipt(item["receipt"])
        if pr["knownMetadata"] is not None:
            fields(pr["knownMetadata"], {"value", "receipt", "generation"}, "knownMetadata")
            require(positive(pr["knownMetadata"]["generation"]), "invalid metadata generation")
            require(metadata_status(pr["knownMetadata"]["value"]) != "unknown", "state knownMetadata cannot be unknown")
            if pr["knownMetadata"]["receipt"] is not None:
                validate_receipt(pr["knownMetadata"]["receipt"])


def state_path(path):
    path = Path(path).absolute()
    require(not path.is_symlink(), f"refusing state symlink: {path}")
    return path.parent.resolve() / path.name


@contextmanager
def locked(path):
    """An exclusive cooperative local lock. Never automatically steal a stale lock."""
    path = state_path(path)
    lock = path.with_name(path.name + ".lock")
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError as exc:
        raise WatchError(f"watch lock exists: {lock}; another operation or interrupted writer needs attention") from exc
    except OSError as exc:
        raise WatchError(f"cannot create watch lock {lock}: {exc}") from exc
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump({"pid": os.getpid(), "state": str(path)}, stream)
            stream.flush()
            os.fsync(stream.fileno())
        yield path
    finally:
        lock.unlink()


def load_state(path):
    # Only FileNotFoundError is first run. Permissions, invalid JSON and directories are errors.
    try:
        path.stat()
    except FileNotFoundError as exc:
        raise WatchError(f"state missing: {path}; use explicit baseline with a complete snapshot") from exc
    except OSError as exc:
        raise WatchError(f"cannot read state {path}: {exc}") from exc
    state = read_json(path)
    validate_state(state)
    return state


def save_state(path, state):
    validate_state(state)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent,
                                         prefix=f".{path.name}.", delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(state, stream, indent=2, sort_keys=True)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        if os.name == "posix":
            fd = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)
    except OSError as exc:
        raise WatchError(f"cannot persist watch state {path}: {exc}; re-plan before retrying") from exc
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()


def comments(pr):
    for kind in KINDS:
        seen = set()
        for item in sorted(pr["comments"][kind]["items"], key=lambda item: item["id"]):
            if item["id"] not in seen:
                yield f"{kind}:{item['id']}", item
                seen.add(item["id"])


def stored_comment(item, receipt=None, generation=1):
    return {"createdAt": item["createdAt"], "updatedAt": item["updatedAt"],
            "fingerprint": digest(item), "receipt": receipt, "generation": generation}


def coverage(data):
    missing = sorted(set(data["scope"]) - {pr["number"] for pr in data["pullRequests"]})
    incomplete = {
        str(pr["number"]): [kind for kind in KINDS if not pr["comments"][kind]["complete"]]
        for pr in data["pullRequests"] if any(not pr["comments"][kind]["complete"] for kind in KINDS)
    }
    unknown = sorted(pr["number"] for pr in data["pullRequests"] if metadata_status(pr["metadata"]) == "unknown")
    return {
        "complete": data["discoveryComplete"] and not (missing or incomplete or unknown),
        "discoveryComplete": data["discoveryComplete"],
        "scopedPRs": len(data["scope"]),
        "completePRs": sum(str(pr["number"]) not in incomplete and pr["number"] not in unknown
                           for pr in data["pullRequests"]),
        "missingPRs": missing, "incompleteEndpoints": incomplete, "unknownMetadataPRs": unknown,
    }


def make_plan(state, data):
    validate_snapshot(data)
    require(repo_name(data["repo"]) == state["repo"], "snapshot repo does not match state repo")
    require(timestamp(data["observedAt"]) >= timestamp(state["observedAt"]), "snapshot is older than state; refetch")
    events = []
    for pr in sorted(data["pullRequests"], key=lambda pr: pr["number"]):
        previous = state["prs"].get(str(pr["number"]), {"comments": {}, "knownMetadata": None})
        for key, item in comments(pr):
            old = previous["comments"].get(key)
            if old:
                require(item["createdAt"] == old["createdAt"], "comment identity has inconsistent createdAt")
                require(timestamp(item["updatedAt"]) >= timestamp(old["updatedAt"]), "comment is older than state; refetch")
            if old is None or digest(item) != old["fingerprint"]:
                events.append({
                    "id": digest([state["repo"], pr["number"], key, item, old["generation"] if old else 0]),
                    "pr": pr["number"], "kind": "comment", "key": key,
                    "change": "new" if old is None else "edited", "comment": item,
                })
        current, old_metadata = pr["metadata"], previous["knownMetadata"]
        if metadata_status(current) == "conflicting" and (
            old_metadata is None
            or metadata_status(old_metadata["value"]) != "conflicting"
            or old_metadata["value"]["headSha"] != current["headSha"]
        ):
            events.append({
                "id": digest([state["repo"], pr["number"], "conflict", current,
                              old_metadata["generation"] if old_metadata else 0]),
                "pr": pr["number"], "kind": "conflict", "metadata": current,
            })
    return {
        "version": 1, "repo": state["repo"], "revision": state["revision"],
        "stateDigest": digest(state), "snapshotDigest": digest(data),
        "coverage": coverage(data), "events": events,
    }


def baseline(path, data):
    validate_snapshot(data)
    covered = coverage(data)
    require(covered["complete"], "baseline requires complete discovery, endpoints and known metadata")
    with locked(path) as path:
        require(not path.exists(), f"state already exists: {path}; baseline never overwrites")
        state = {"version": 2, "repo": repo_name(data["repo"]), "revision": 1,
                 "observedAt": data["observedAt"], "prs": {}}
        for pr in data["pullRequests"]:
            state["prs"][str(pr["number"])] = {
                "comments": {key: stored_comment(item) for key, item in comments(pr)},
                "knownMetadata": {"value": pr["metadata"], "receipt": None, "generation": 1},
            }
        save_state(path, state)
        return {
            "revision": 1, "coverage": covered,
            "baselinedComments": sum(len(pr["comments"]) for pr in state["prs"].values()),
            "baselinedConflicts": sorted(pr["number"] for pr in data["pullRequests"]
                                         if metadata_status(pr["metadata"]) == "conflicting"),
        }


def plan(path, data):
    with locked(path) as path:
        return make_plan(load_state(path), data)


def commit(path, data, expected_plan, receipts):
    with locked(path) as path:
        state = load_state(path)
        current_plan = make_plan(state, data)
        require(expected_plan == current_plan, "stale or mismatched plan; re-plan, reconcile receipts, then retry")
        require(isinstance(receipts, list), "receipts must be a list")
        events = {event["id"]: event for event in current_plan["events"]}
        acknowledged = {}
        for receipt in receipts:
            validate_receipt(receipt)
            event_id = receipt["eventId"]
            require(event_id in events and event_id not in acknowledged, "unknown or duplicate receipt eventId")
            acknowledged[event_id] = receipt
        next_state = copy.deepcopy(state)
        by_number = {pr["number"]: pr for pr in data["pullRequests"]}
        for pr in data["pullRequests"]:
            number = str(pr["number"])
            previous = next_state["prs"].setdefault(number, {"comments": {}, "knownMetadata": None})
            conflict_event = next((event for event in events.values()
                                   if event["pr"] == pr["number"] and event["kind"] == "conflict"), None)
            if metadata_status(pr["metadata"]) != "unknown" and (
                conflict_event is None or conflict_event["id"] in acknowledged
            ):
                receipt = acknowledged[conflict_event["id"]] if conflict_event else None
                if previous["knownMetadata"] is None or previous["knownMetadata"]["value"] != pr["metadata"]:
                    generation = previous["knownMetadata"]["generation"] + 1 if previous["knownMetadata"] else 1
                    previous["knownMetadata"] = {"value": pr["metadata"], "receipt": receipt, "generation": generation}
        for event_id, receipt in acknowledged.items():
            event = events[event_id]
            if event["kind"] == "comment":
                item = dict(comments(by_number[event["pr"]]))[event["key"]]
                stored = next_state["prs"][str(event["pr"])]["comments"]
                generation = stored[event["key"]]["generation"] + 1 if event["key"] in stored else 1
                stored[event["key"]] = stored_comment(item, receipt, generation)
        next_state["observedAt"] = data["observedAt"]
        if next_state != state:
            next_state["revision"] += 1
            save_state(path, next_state)
        return {
            "revision": next_state["revision"], "coverage": current_plan["coverage"],
            "acknowledged": sorted(acknowledged), "pending": sorted(set(events) - set(acknowledged)),
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("baseline", "plan", "commit"):
        sub = subparsers.add_parser(command)
        sub.add_argument("--state", required=True, type=Path, help="Explicit local path; no legacy/default discovery")
        sub.add_argument("--snapshot", required=True, help="Snapshot JSON file, or - for stdin")
        if command == "commit":
            sub.add_argument("--plan", required=True, type=Path)
            sub.add_argument("--receipts", required=True, type=Path)
    args = parser.parse_args()
    try:
        inputs = [Path(args.snapshot)] if args.snapshot != "-" else []
        if args.command == "commit":
            inputs += [args.plan, args.receipts]
        target = state_path(args.state)
        require(all(path.resolve() not in {target, target.with_name(target.name + ".lock")} for path in inputs),
                "input file cannot also be state or lock")
        data = decode(sys.stdin.read()) if args.snapshot == "-" else read_json(Path(args.snapshot))
        if args.command == "commit":
            result = commit(args.state, data, read_json(args.plan), read_json(args.receipts))
        else:
            result = {"baseline": baseline, "plan": plan}[args.command](args.state, data)
        print(json.dumps(result, indent=2, sort_keys=True))
    except (WatchError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
