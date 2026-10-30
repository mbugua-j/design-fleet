from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

from telemetry import (
    TelemetryCollector,
    load_roles,
    pr_repository_from_command,
    read_workspace,
)


ROLES = {
    "stations": [
        {
            "id": "herald",
            "display": "Herald",
            "title": "Delivery station",
            "purpose": "Files pull requests.",
            "model": "gpt-5.6-terra",
            "family": "OpenAI",
            "group": "ship",
        },
        {
            "id": "lookout",
            "display": "Lookout",
            "title": "Verification station",
            "purpose": "Checks the browser.",
            "model": "mai-code-1.1-flash",
            "family": "Microsoft",
            "group": "ship",
        },
    ],
    "groups": {"ship": "Ship"},
}


def write_event(path: Path, event: dict) -> None:
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event) + "\n")


class TelemetryCollectorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.plugin = self.root / "plugin"
        self.home = self.root / "home"
        (self.plugin / "crews").mkdir(parents=True)
        (self.plugin / "crews" / "roles.json").write_text(
            json.dumps(ROLES),
            encoding="utf-8",
        )
        (self.home / "session-state" / "session-1").mkdir(parents=True)
        self.events = self.home / "session-state" / "session-1" / "events.jsonl"
        self._create_session_store()

    def tearDown(self) -> None:
        self.temp.cleanup()

    def _create_session_store(self) -> None:
        connection = sqlite3.connect(self.home / "session-store.db")
        connection.executescript(
            """
            CREATE TABLE sessions (
                id TEXT PRIMARY KEY,
                cwd TEXT,
                repository TEXT,
                branch TEXT,
                summary TEXT,
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE assistant_usage_events (
                id INTEGER PRIMARY KEY,
                session_id TEXT,
                agent_id TEXT,
                model TEXT,
                input_tokens INTEGER,
                output_tokens INTEGER,
                cache_read_tokens INTEGER,
                cache_write_tokens INTEGER,
                total_nano_aiu INTEGER,
                duration_ms INTEGER,
                time_to_first_token_ms INTEGER,
                output_ttft_ms REAL,
                finish_reason TEXT,
                created_at TEXT
            );
            """
        )
        connection.execute(
            "INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                "session-1",
                str(self.root / "repo"),
                "mbugua-j/design-fleet",
                "main",
                "Smoke test",
                "2026-08-28T09:00:00.000Z",
                "2026-08-28T09:10:00.000Z",
            ),
        )
        connection.execute(
            """
            INSERT INTO assistant_usage_events (
                session_id, agent_id, model, input_tokens, output_tokens,
                cache_read_tokens, cache_write_tokens, total_nano_aiu,
                duration_ms, time_to_first_token_ms, output_ttft_ms,
                finish_reason, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "session-1",
                "agent-herald",
                "gpt-5.6-terra",
                100,
                20,
                0,
                0,
                2_000_000_000,
                1800,
                400,
                350,
                "stop",
                "2026-08-28T09:05:00.000Z",
            ),
        )
        connection.commit()
        connection.close()

    def test_load_roles_reads_agent_reasoning_effort(self) -> None:
        agents = self.plugin / "agents"
        agents.mkdir()
        (agents / "Herald.agent.md").write_text(
            "---\nname: Herald\nreasoningEffort: high\n---\n",
            encoding="utf-8",
        )

        roles = load_roles(self.plugin)
        herald = next(
            station for station in roles["stations"] if station["id"] == "herald"
        )
        lookout = next(
            station for station in roles["stations"] if station["id"] == "lookout"
        )
        self.assertEqual(herald["reasoningEffort"], "high")
        self.assertIsNone(lookout["reasoningEffort"])

    def test_maps_smoke_run_usage_and_herald_pr(self) -> None:
        write_event(
            self.events,
            {
                "type": "tool.execution_start",
                "timestamp": "2026-08-28T09:01:00.000Z",
                "data": {
                    "toolCallId": "task-1",
                    "toolName": "task",
                    "arguments": {
                        "agent_type": "design-fleet:Herald",
                        "name": "smoke-herald",
                        "description": "Smoke test Herald routing",
                        "mode": "background",
                        "model": "gpt-5.6-terra",
                    },
                },
            },
        )
        write_event(
            self.events,
            {
                "type": "tool.execution_complete",
                "timestamp": "2026-08-28T09:01:01.000Z",
                "data": {
                    "toolCallId": "task-1",
                    "success": True,
                    "result": {
                        "content": (
                            "Agent started in background with "
                            "agent_id: agent-herald"
                        )
                    },
                    "toolTelemetry": {
                        "restrictedProperties": {"agent_id": "agent-herald"}
                    },
                },
            },
        )
        write_event(
            self.events,
            {
                "type": "tool.execution_start",
                "agentId": "agent-herald",
                "timestamp": "2026-08-28T09:04:00.000Z",
                "data": {
                    "toolCallId": "pr-1",
                    "toolName": "bash",
                    "arguments": {
                        "command": (
                            "gh pr create --repo mbugua-j/design-fleet "
                            "--title dashboard"
                        )
                    },
                },
            },
        )
        write_event(
            self.events,
            {
                "type": "tool.execution_complete",
                "agentId": "agent-herald",
                "timestamp": "2026-08-28T09:04:02.000Z",
                "data": {
                    "toolCallId": "pr-1",
                    "success": True,
                    "result": {
                        "content": "https://github.com/mbugua-j/design-fleet/pull/42"
                    },
                },
            },
        )
        write_event(
            self.events,
            {
                "type": "subagent.completed",
                "agentId": "agent-herald",
                "timestamp": "2026-08-28T09:06:00.000Z",
                "data": {},
            },
        )

        collector = TelemetryCollector(
            self.plugin,
            self.home,
            now=datetime(2026, 8, 28, 10, tzinfo=timezone.utc),
        )
        payload = collector.collect(days=1)

        herald = next(item for item in payload["stations"] if item["id"] == "herald")
        self.assertEqual(herald["status"], "healthy")
        self.assertEqual(herald["calls"], 1)
        self.assertEqual(payload["summary"]["heraldPrs"], 1)
        self.assertEqual(payload["summary"]["activeSessions"], 0)
        self.assertEqual(payload["smokeTest"]["passed"], 1)
        self.assertEqual(
            payload["activity"][0]["prUrl"],
            "https://github.com/mbugua-j/design-fleet/pull/42",
        )
        project = payload["projects"][0]
        self.assertEqual(project["calls"], 1)
        self.assertEqual(project["aiu"], 2.0)
        model = next(
            item for item in payload["models"] if item["model"] == "gpt-5.6-terra"
        )
        self.assertEqual(model["calls"], 1)
        self.assertEqual(model["aiu"], 2.0)

    def test_summary_counts_live_sessions_even_without_attributed_processes(self) -> None:
        collector = TelemetryCollector(
            self.plugin,
            self.home,
            now=datetime(2026, 8, 28, 10, tzinfo=timezone.utc),
        )
        with patch.object(
            collector,
            "_live_sessions",
            return_value=[
                {
                    "id": "live-session",
                    "cwd": str(self.root / "repo"),
                    "repository": "mbugua-j/design-fleet",
                    "branch": "demo-user/local-all",
                    "summary": "Live top-level session",
                    "created_at": "2026-08-28T09:00:00.000Z",
                    "updated_at": "2026-08-28T09:30:00.000Z",
                    "isRunning": True,
                }
            ],
        ):
            payload = collector.collect(days=1)

        self.assertEqual(payload["summary"]["activeSessions"], 1)
        self.assertEqual(payload["summary"]["activeProcesses"], 0)

    def test_portal_smoke_usage_refreshes_model_health(self) -> None:
        job_id = "portal-smoke-lookout"
        connection = sqlite3.connect(self.home / "session-store.db")
        connection.execute(
            "INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                job_id,
                str(self.root / "repo"),
                "mbugua-j/design-fleet",
                "main",
                "Fleet Lookout smoke test",
                "2026-08-28T09:30:00.000Z",
                "2026-08-28T09:32:00.000Z",
            ),
        )
        connection.execute(
            """
            INSERT INTO assistant_usage_events (
                session_id, agent_id, model, input_tokens, output_tokens,
                cache_read_tokens, cache_write_tokens, total_nano_aiu,
                duration_ms, time_to_first_token_ms, output_ttft_ms,
                finish_reason, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                job_id,
                None,
                "mai-code-1.1-flash",
                100,
                5,
                0,
                0,
                250_000_000,
                900,
                180,
                160,
                "stop",
                "2026-08-28T09:31:00.000Z",
            ),
        )
        connection.commit()
        connection.close()

        command_log = (
            self.home / "design-fleet" / "dashboard-commands.jsonl"
        )
        command_log.parent.mkdir(parents=True)
        write_event(
            command_log,
            {
                "jobId": job_id,
                "station": "lookout",
                "agent": "Lookout",
                "project": "mbugua-j/design-fleet",
                "model": "mai-code-1.1-flash",
                "kind": "smoke",
                "status": "running",
                "startedAt": "2026-08-28T09:30:00.000Z",
                "updatedAt": "2026-08-28T09:30:00.000Z",
            },
        )
        write_event(
            command_log,
            {
                "jobId": job_id,
                "station": "lookout",
                "agent": "Lookout",
                "project": "mbugua-j/design-fleet",
                "model": "mai-code-1.1-flash",
                "kind": "smoke",
                "status": "completed",
                "completedAt": "2026-08-28T09:32:00.000Z",
                "updatedAt": "2026-08-28T09:32:00.000Z",
            },
        )

        collector = TelemetryCollector(
            self.plugin,
            self.home,
            now=datetime(2026, 8, 29, 9, 31, 30, tzinfo=timezone.utc),
        )
        payload = collector.collect(days=1, project="mbugua-j/design-fleet")

        model = next(
            item
            for item in payload["models"]
            if item["model"] == "mai-code-1.1-flash"
        )
        self.assertEqual(model["status"], "healthy")
        self.assertEqual(
            model["statusReason"],
            "The latest smoke test completed successfully. No action is required.",
        )
        self.assertEqual(model["lastCall"], "2026-08-28T09:31:00.000Z")
        self.assertEqual(model["calls"], 1)
        self.assertEqual(payload["smokeTest"]["passed"], 1)

    def test_marks_background_run_stalled_without_completion(self) -> None:
        write_event(
            self.events,
            {
                "type": "tool.execution_start",
                "timestamp": "2026-08-28T09:01:00.000Z",
                "data": {
                    "toolCallId": "task-2",
                    "toolName": "task",
                    "arguments": {
                        "agent_type": "design-fleet:Lookout",
                        "name": "browser-check",
                        "description": "Check the preview",
                        "mode": "background",
                        "model": "mai-code-1.1-flash",
                    },
                },
            },
        )
        write_event(
            self.events,
            {
                "type": "tool.execution_complete",
                "timestamp": "2026-08-28T09:01:01.000Z",
                "data": {
                    "toolCallId": "task-2",
                    "success": True,
                    "result": {
                        "content": (
                            "Agent started in background with "
                            "agent_id: agent-lookout"
                        )
                    },
                    "toolTelemetry": {
                        "restrictedProperties": {"agent_id": "agent-lookout"}
                    },
                },
            },
        )

        collector = TelemetryCollector(
            self.plugin,
            self.home,
            now=datetime(2026, 8, 28, 10, tzinfo=timezone.utc),
        )
        payload = collector.collect(days=1)

        self.assertEqual(payload["processes"][0]["status"], "stalled")

    def test_live_workspace_session_marks_upstream_project_active(self) -> None:
        repo = self.root / "product-demo"
        (repo / ".copilot").mkdir(parents=True)
        (repo / ".copilot" / "design-fleet.json").write_text(
            json.dumps(
                {
                    "project": {
                        "repo": "demo-user/product-demo",
                        "upstream": "example/product-demo",
                    }
                }
            ),
            encoding="utf-8",
        )
        live_dir = self.home / "session-state" / "live-session"
        live_dir.mkdir(parents=True)
        (live_dir / "workspace.yaml").write_text(
            "\n".join(
                [
                    "id: live-session",
                    f"cwd: {repo}",
                    f"git_root: {repo}",
                    "repository: demo-user/product-demo",
                    "branch: demo-user/local-all",
                    "name: Active work session",
                    "created_at: 2026-08-28T09:30:00.000Z",
                ]
            ),
            encoding="utf-8",
        )
        (live_dir / "inuse.12345.lock").touch()

        collector = TelemetryCollector(
            self.plugin,
            self.home,
            now=datetime(2026, 8, 28, 10, tzinfo=timezone.utc),
        )
        with patch(
            "telemetry.live_process_commands",
            return_value={12345: "copilot --session-id live-session"},
        ):
            payload = collector.collect(days=1)

        project = next(
            item
            for item in payload["projects"]
            if item["repository"] == "example/product-demo"
        )
        self.assertEqual(project["activeSessions"], 1)
        self.assertEqual(project["activeBranches"], ["demo-user/local-all"])
        self.assertEqual(project["lastActivity"], "2026-08-28T10:00:00.000Z")

    def test_live_session_lookup_skips_inactive_workspace_directories(self) -> None:
        live_dir = self.home / "session-state" / "live-session"
        live_dir.mkdir(parents=True)
        (live_dir / "workspace.yaml").write_text(
            "\n".join(
                [
                    "id: live-session",
                    f"cwd: {self.root}",
                    "repository: mbugua-j/design-fleet",
                    "branch: demo-user/dashboard",
                ]
            ),
            encoding="utf-8",
        )
        (live_dir / "inuse.12345.lock").touch()
        for index in range(20):
            inactive_dir = self.home / "session-state" / f"inactive-{index}"
            inactive_dir.mkdir()
            (inactive_dir / "workspace.yaml").write_text(
                f"id: inactive-{index}",
                encoding="utf-8",
            )

        collector = TelemetryCollector(
            self.plugin,
            self.home,
            now=datetime(2026, 8, 28, 10, tzinfo=timezone.utc),
        )
        with (
            patch(
                "telemetry.live_process_commands",
                return_value={12345: "copilot --session-id live-session"},
            ),
            patch("telemetry.read_workspace", wraps=read_workspace) as read,
        ):
            sessions = collector._live_sessions(
                datetime(2026, 8, 28, 10, tzinfo=timezone.utc)
            )

        self.assertEqual([session["id"] for session in sessions], ["live-session"])
        read.assert_called_once_with(live_dir / "workspace.yaml")

    def test_production_collector_refreshes_now_for_each_collection(self) -> None:
        write_event(
            self.events,
            {
                "type": "tool.execution_start",
                "timestamp": "2026-08-28T09:01:00.000Z",
                "data": {
                    "toolCallId": "task-advancing-clock",
                    "toolName": "task",
                    "arguments": {
                        "agent_type": "design-fleet:Herald",
                        "name": "advancing-clock",
                        "description": "Exercise per-collection time",
                        "mode": "background",
                        "model": "gpt-5.6-terra",
                    },
                },
            },
        )
        write_event(
            self.events,
            {
                "type": "tool.execution_complete",
                "timestamp": "2026-08-28T09:01:01.000Z",
                "data": {
                    "toolCallId": "task-advancing-clock",
                    "success": True,
                    "result": {
                        "content": (
                            "Agent started in background with "
                            "agent_id: agent-herald"
                        )
                    },
                    "toolTelemetry": {
                        "restrictedProperties": {"agent_id": "agent-herald"}
                    },
                },
            },
        )
        first_now = datetime(2026, 8, 28, 10, tzinfo=timezone.utc)
        second_now = datetime(2026, 8, 30, 10, tzinfo=timezone.utc)
        third_now = datetime(2026, 9, 5, 10, tzinfo=timezone.utc)

        with patch(
            "telemetry.utc_now",
            side_effect=[first_now, second_now, third_now],
        ) as now:
            collector = TelemetryCollector(self.plugin, self.home)
            first = collector.collect(days=90)
            second = collector.collect(days=90)
            third = collector.collect(days=90)

        first_model = next(
            item for item in first["models"] if item["model"] == "gpt-5.6-terra"
        )
        second_model = next(
            item for item in second["models"] if item["model"] == "gpt-5.6-terra"
        )
        third_model = next(
            item for item in third["models"] if item["model"] == "gpt-5.6-terra"
        )
        self.assertEqual(now.call_count, 3)
        self.assertEqual(first["generatedAt"], "2026-08-28T10:00:00.000Z")
        self.assertEqual(second["generatedAt"], "2026-08-30T10:00:00.000Z")
        self.assertEqual(third["generatedAt"], "2026-09-05T10:00:00.000Z")
        self.assertEqual(first["activity"][0]["status"], "stalled")
        self.assertEqual(second["activity"][0]["status"], "unknown")
        self.assertEqual(first_model["status"], "healthy")
        self.assertEqual(second_model["status"], "stale")
        self.assertEqual(third_model["status"], "untested")

    def test_pr_repository_supports_all_gh_repo_flag_forms(self) -> None:
        self.assertEqual(
            pr_repository_from_command(
                "gh pr create --repo owner/repo --title dashboard",
                "fallback/repo",
            ),
            "owner/repo",
        )
        self.assertEqual(
            pr_repository_from_command(
                "gh pr create --repo=owner/repo --title dashboard",
                "fallback/repo",
            ),
            "owner/repo",
        )
        self.assertEqual(
            pr_repository_from_command(
                "gh pr create -R github.com/owner/repo --title dashboard",
                "fallback/repo",
            ),
            "owner/repo",
        )
        self.assertEqual(
            pr_repository_from_command(
                "gh pr create -R=owner/repo --title dashboard",
                "fallback/repo",
            ),
            "owner/repo",
        )

    def test_incremental_event_cache_reads_appended_completion(self) -> None:
        write_event(
            self.events,
            {
                "type": "tool.execution_start",
                "timestamp": "2026-08-28T09:01:00.000Z",
                "data": {
                    "toolCallId": "task-cache",
                    "toolName": "task",
                    "arguments": {
                        "agent_type": "design-fleet:Herald",
                        "name": "cached-run",
                        "description": "Exercise incremental event reads",
                        "mode": "background",
                        "model": "gpt-5.6-terra",
                    },
                },
            },
        )
        write_event(
            self.events,
            {
                "type": "tool.execution_complete",
                "timestamp": "2026-08-28T09:01:01.000Z",
                "data": {
                    "toolCallId": "task-cache",
                    "success": True,
                    "result": {
                        "content": (
                            "Agent started in background with "
                            "agent_id: agent-herald"
                        )
                    },
                    "toolTelemetry": {
                        "restrictedProperties": {"agent_id": "agent-herald"}
                    },
                },
            },
        )
        collector = TelemetryCollector(
            self.plugin,
            self.home,
            now=datetime(2026, 8, 28, 10, tzinfo=timezone.utc),
        )
        first = collector.collect(days=1)
        self.assertEqual(first["activity"][0]["status"], "stalled")

        write_event(
            self.events,
            {
                "type": "subagent.completed",
                "agentId": "agent-herald",
                "timestamp": "2026-08-28T10:01:00.000Z",
                "data": {},
            },
        )
        second = collector.collect(days=1)
        self.assertEqual(second["activity"][0]["status"], "completed")

    def test_sync_run_is_live_before_task_tool_returns(self) -> None:
        write_event(
            self.events,
            {
                "type": "tool.execution_start",
                "timestamp": "2026-08-28T09:01:00.000Z",
                "data": {
                    "toolCallId": "task-sync",
                    "toolName": "task",
                    "arguments": {
                        "agent_type": "design-fleet:Lookout",
                        "name": "live-lookout",
                        "description": "Verify a preview",
                        "mode": "sync",
                        "model": "mai-code-1.1-flash",
                    },
                },
            },
        )
        write_event(
            self.events,
            {
                "type": "assistant.message",
                "agentId": "agent-lookout",
                "timestamp": "2026-08-28T09:02:00.000Z",
                "data": {
                    "parentToolCallId": "task-sync",
                    "content": "Checking the rendered dashboard.",
                },
            },
        )

        collector = TelemetryCollector(
            self.plugin,
            self.home,
            now=datetime(2026, 8, 28, 9, 3, tzinfo=timezone.utc),
        )
        payload = collector.collect(days=1)

        self.assertEqual(payload["processes"][0]["station"], "lookout")
        self.assertEqual(payload["processes"][0]["status"], "running")
        self.assertEqual(payload["processes"][0]["title"], "live-lookout")

    def test_handoff_uses_latest_station_and_preserves_history(self) -> None:
        events = [
            {
                "type": "tool.execution_start",
                "timestamp": "2026-08-28T09:01:00.000Z",
                "data": {
                    "toolCallId": "task-herald",
                    "toolName": "task",
                    "arguments": {
                        "agent_type": "design-fleet:Herald",
                        "name": "prepare-delivery",
                        "description": "Prepare the delivery",
                        "mode": "sync",
                        "model": "gpt-5.6-terra",
                    },
                },
            },
            {
                "type": "assistant.message",
                "agentId": "agent-herald",
                "timestamp": "2026-08-28T09:02:00.000Z",
                "data": {
                    "parentToolCallId": "task-herald",
                    "content": "Preparing delivery.",
                },
            },
            {
                "type": "tool.execution_start",
                "timestamp": "2026-08-28T09:03:00.000Z",
                "data": {
                    "toolCallId": "task-lookout",
                    "toolName": "task",
                    "arguments": {
                        "agent_type": "design-fleet:Lookout",
                        "name": "verify-browser",
                        "description": "Verify the browser",
                        "mode": "sync",
                        "model": "mai-code-1.1-flash",
                    },
                },
            },
            {
                "type": "assistant.message",
                "agentId": "agent-lookout",
                "timestamp": "2026-08-28T09:04:00.000Z",
                "data": {
                    "parentToolCallId": "task-lookout",
                    "content": "Checking the browser.",
                },
            },
        ]
        for event in events:
            write_event(self.events, event)

        collector = TelemetryCollector(
            self.plugin,
            self.home,
            now=datetime(2026, 8, 28, 9, 5, tzinfo=timezone.utc),
        )
        payload = collector.collect(days=1)
        task = payload["handoffs"][0]

        self.assertEqual(task["currentStation"], "lookout")
        self.assertEqual(
            [step["station"] for step in task["history"]],
            ["herald", "lookout"],
        )

    def test_handoff_excludes_orphaned_unknown_project(self) -> None:
        orphan_dir = self.home / "session-state" / "orphan-session"
        orphan_dir.mkdir(parents=True)
        write_event(
            orphan_dir / "events.jsonl",
            {
                "type": "tool.execution_start",
                "timestamp": "2026-08-28T09:01:00.000Z",
                "data": {
                    "toolCallId": "task-orphan",
                    "toolName": "task",
                    "arguments": {
                        "agent_type": "design-fleet:Lookout",
                        "name": "Orphaned task",
                        "description": "No repository is attached",
                        "mode": "sync",
                        "model": "mai-code-1.1-flash",
                    },
                },
            },
        )
        connection = sqlite3.connect(self.home / "session-store.db")
        connection.execute(
            "INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                "orphan-session",
                str(self.root / "missing"),
                None,
                "",
                "Orphaned task",
                "2026-08-28T09:00:00.000Z",
                "2026-08-28T09:02:00.000Z",
            ),
        )
        connection.commit()
        connection.close()

        collector = TelemetryCollector(
            self.plugin,
            self.home,
            now=datetime(2026, 8, 28, 9, 3, tzinfo=timezone.utc),
        )
        payload = collector.collect(days=1)

        self.assertFalse(
            any(task["id"] == "orphan-session" for task in payload["handoffs"])
        )

    def test_portal_command_enters_live_process_and_handoff_views(self) -> None:
        command_log = self.home / "design-fleet" / "dashboard-commands.jsonl"
        command_log.parent.mkdir(parents=True)
        command_log.write_text(
            json.dumps(
                {
                    "version": 1,
                    "jobId": "portal-job",
                    "station": "lookout",
                    "agent": "Lookout",
                    "project": "mbugua-j/design-fleet",
                    "model": "mai-code-1.1-flash",
                    "maxCredits": 5,
                    "status": "running",
                    "startedAt": "2026-08-28T09:58:00.000Z",
                    "updatedAt": "2026-08-28T09:59:00.000Z",
                }
            )
            + "\n",
            encoding="utf-8",
        )
        collector = TelemetryCollector(
            self.plugin,
            self.home,
            now=datetime(2026, 8, 28, 10, tzinfo=timezone.utc),
        )
        payload = collector.collect(days=1)

        portal_process = next(
            process
            for process in payload["processes"]
            if process["id"] == "portal:portal-job"
        )
        self.assertEqual(portal_process["station"], "lookout")
        portal_handoff = next(
            task for task in payload["handoffs"] if task["id"] == "portal-job"
        )
        self.assertEqual(portal_handoff["currentStation"], "lookout")

    def test_portal_handoff_stays_attached_to_existing_task(self) -> None:
        write_event(
            self.events,
            {
                "type": "tool.execution_start",
                "timestamp": "2026-08-28T09:55:00.000Z",
                "data": {
                    "toolCallId": "task-herald",
                    "toolName": "task",
                    "arguments": {
                        "agent_type": "design-fleet:Herald",
                        "name": "prepare-delivery",
                        "description": "Prepare the delivery",
                        "mode": "sync",
                        "model": "gpt-5.6-terra",
                    },
                },
            },
        )
        command_log = self.home / "design-fleet" / "dashboard-commands.jsonl"
        command_log.parent.mkdir(parents=True)
        command_log.write_text(
            json.dumps(
                {
                    "version": 1,
                    "jobId": "portal-handoff",
                    "taskId": "session-1",
                    "station": "lookout",
                    "agent": "Lookout",
                    "project": "mbugua-j/design-fleet",
                    "model": "mai-code-1.1-flash",
                    "maxCredits": 30,
                    "status": "running",
                    "startedAt": "2026-08-28T09:58:00.000Z",
                    "updatedAt": "2026-08-28T09:59:00.000Z",
                }
            )
            + "\n",
            encoding="utf-8",
        )
        collector = TelemetryCollector(
            self.plugin,
            self.home,
            now=datetime(2026, 8, 28, 10, tzinfo=timezone.utc),
        )
        payload = collector.collect(days=1)

        task = next(
            item for item in payload["handoffs"] if item["id"] == "session-1"
        )
        self.assertEqual(task["currentStation"], "lookout")
        self.assertEqual(
            [step["station"] for step in task["history"]],
            ["herald", "lookout"],
        )

    def test_followup_turn_reactivates_completed_agent(self) -> None:
        dispatch_events = [
            {
                "type": "tool.execution_start",
                "timestamp": "2026-08-29T02:00:00.000Z",
                "data": {
                    "toolCallId": "task-followup",
                    "toolName": "task",
                    "arguments": {
                        "agent_type": "design-fleet:Lookout",
                        "name": "followup-lookout",
                        "description": "Review the dashboard",
                        "mode": "background",
                        "model": "mai-code-1.1-flash",
                    },
                },
            },
            {
                "type": "tool.execution_complete",
                "timestamp": "2026-08-29T02:00:01.000Z",
                "data": {
                    "toolCallId": "task-followup",
                    "success": True,
                    "result": {
                        "content": (
                            "Agent started in background with "
                            "agent_id: agent-lookout"
                        )
                    },
                    "toolTelemetry": {
                        "restrictedProperties": {"agent_id": "agent-lookout"}
                    },
                },
            },
            {
                "type": "subagent.completed",
                "agentId": "agent-lookout",
                "timestamp": "2026-08-29T02:05:00.000Z",
                "data": {},
            },
        ]
        for event in dispatch_events:
            write_event(self.events, event)

        followup_dir = self.home / "session-state" / "session-2"
        followup_dir.mkdir(parents=True)
        write_event(
            followup_dir / "events.jsonl",
            {
                "type": "assistant.turn_start",
                "agentId": "agent-lookout",
                "timestamp": "2026-08-29T02:10:00.000Z",
                "data": {"turnId": "2"},
            },
        )
        connection = sqlite3.connect(self.home / "session-store.db")
        connection.execute(
            "INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                "session-2",
                str(self.root / "repo"),
                "mbugua-j/design-fleet",
                "main",
                "Follow-up session",
                "2026-08-29T02:09:00.000Z",
                "2026-08-29T02:11:00.000Z",
            ),
        )
        connection.commit()
        connection.close()

        collector = TelemetryCollector(
            self.plugin,
            self.home,
            now=datetime(2026, 8, 29, 2, 11, tzinfo=timezone.utc),
        )
        payload = collector.collect(days=1)

        process = next(
            item for item in payload["processes"]
            if item["title"] == "followup-lookout"
        )
        self.assertEqual(process["status"], "running")
        self.assertIsNone(process["completedAt"])


if __name__ == "__main__":
    unittest.main()
