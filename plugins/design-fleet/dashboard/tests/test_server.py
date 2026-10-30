from __future__ import annotations

import gzip
import json
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from subprocess import CompletedProcess
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import server
from fleet_registry import FleetRegistry


class FakeCollector:
    def __init__(self, provider_id: str = "design-fleet") -> None:
        self.provider_id = provider_id

    def collect(self, days: int, project: str, fleet_id: str | None = None):
        return {
            "generatedAt": "2026-08-28T15:00:00.000Z",
            "rangeDays": days,
            "selectedProject": project,
            "collectorProvider": self.provider_id,
            "collectorFleet": fleet_id,
            "summary": {},
            "projects": [],
            "stations": [],
            "models": [],
            "processes": [],
            "smokeTest": None,
            "activity": [],
            "handoffs": [],
            "sources": {
                "sessionStore": True,
                "eventLogs": True,
                "githubCli": False,
            },
        }


def write_provider(
    root: Path,
    provider_id: str,
    display_name: str,
    *,
    capabilities: dict[str, bool] | None = None,
) -> None:
    (root / "agents").mkdir(parents=True)
    (root / "crews").mkdir()
    (root / "bin").mkdir()
    (root / "crews" / "roles.json").write_text(
        json.dumps(
            {
                "version": 1,
                "stations": [
                    {
                        "id": "maker",
                        "display": "Maker",
                        "title": "Makes things",
                        "model": "gpt-5.6-sol",
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    (root / "agents" / "Maker.agent.md").write_text(
        "---\nname: Maker\n---\n",
        encoding="utf-8",
    )
    (root / "bin" / "fleet.py").write_text("# provider entrypoint\n", encoding="utf-8")
    (root / "fleet.manifest.json").write_text(
        json.dumps(
            {
                "schemaVersion": 1,
                "id": provider_id,
                "displayName": display_name,
                "agentNamespace": provider_id,
                "agentsDirectory": "agents",
                "stationManifest": "crews/roles.json",
                "crewsDirectory": "crews",
                "entrypoint": "bin/fleet.py",
                "capabilities": capabilities
                or {
                    "telemetry": True,
                    "commandLaunch": True,
                    "smokeSuite": True,
                    "crewManagement": True,
                    "modelOverrides": True,
                },
            }
        ),
        encoding="utf-8",
    )


class DashboardServerTests(unittest.TestCase):
    def setUp(self) -> None:
        server.AUTH_JOBS.clear()
        server.COMMAND_JOBS.clear()
        server.SMOKE_SUITE_JOBS.clear()
        self.temporary = tempfile.TemporaryDirectory()
        self.temp_root = Path(self.temporary.name)
        self.copilot_home = self.temp_root / ".copilot"
        self.installed = self.copilot_home / "installed-plugins"
        self.research_root = self.installed / "example" / "research-fleet"
        self.limited_root = self.installed / "example" / "limited-fleet"
        write_provider(self.research_root, "research-fleet", "Research Fleet")
        write_provider(
            self.limited_root,
            "limited-fleet",
            "Limited Fleet",
            capabilities={
                "telemetry": True,
                "commandLaunch": False,
                "smokeSuite": False,
                "crewManagement": False,
                "modelOverrides": False,
            },
        )
        self.registry = FleetRegistry(
            server.PLUGIN_ROOT,
            self.copilot_home,
            plugin_search_roots=[self.installed],
        )
        self.copilot_home_patch = patch.object(
            server, "COPILOT_HOME", self.copilot_home
        )
        self.command_log_patch = patch.object(
            server,
            "COMMAND_LOG",
            self.copilot_home / "design-fleet" / "dashboard-commands.jsonl",
        )
        self.copilot_home_patch.start()
        self.command_log_patch.start()
        (self.copilot_home / "config.json").write_text(
            json.dumps({
                "lastLoggedInUser": {"host": "github.com", "login": "owner"},
                "loggedInUsers": [{"host": "github.com", "login": "owner"}],
                "installedPlugins": [
                    {"name": name, "enabled": True}
                    for name in ("design-fleet", "research-fleet", "limited-fleet")
                ],
            }),
            encoding="utf-8",
        )
        self.active_account_patch = patch.object(
            server, "active_github_account", return_value="github.com/owner"
        )
        self.active_account_mock = self.active_account_patch.start()
        self.previous_registry = server._REGISTRY
        server._REGISTRY = self.registry
        handler = type(
            "TestDashboardHandler",
            (server.DashboardHandler,),
            {
                "registry": self.registry,
                "collectors": {
                    server.PLUGIN_ROOT.resolve(): FakeCollector("design-fleet"),
                    self.research_root.resolve(): FakeCollector("research-fleet"),
                    self.limited_root.resolve(): FakeCollector("limited-fleet"),
                },
            },
        )
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        server._REGISTRY = self.previous_registry
        self.command_log_patch.stop()
        self.active_account_patch.stop()
        self.copilot_home_patch.stop()
        self.temporary.cleanup()

    def request(
        self,
        path: str,
        include_header: bool = True,
        headers: dict[str, str] | None = None,
    ):
        request_headers = (
            {
                "X-Design-Fleet-Dashboard": "1",
                "X-Design-Fleet-Account": "github.com/owner",
            } if include_header else {}
        )
        request_headers.update(headers or {})
        return urlopen(
            Request(f"{self.base}{path}", headers=request_headers),
            timeout=5,
        )

    def post(
        self, path: str, payload: dict, include_header: bool = True,
        account: str = "github.com/owner",
    ):
        headers = {"Content-Type": "application/json"}
        if include_header:
            headers["X-Design-Fleet-Dashboard"] = "1"
            headers["X-Design-Fleet-Account"] = account
        return urlopen(
            Request(
                f"{self.base}{path}",
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST",
            ),
            timeout=5,
        )

    def test_api_requires_dashboard_header(self) -> None:
        with self.assertRaises(HTTPError) as error:
            self.request("/api/health", include_header=False)
        self.assertEqual(error.exception.code, 403)

    def test_other_active_account_has_no_fleets_or_local_content(self) -> None:
        self.active_account_mock.return_value = "github.com/personal"
        headers = {"X-Design-Fleet-Account": "github.com/personal"}
        with self.request("/api/fleets", headers=headers) as response:
            snapshot = json.load(response)
        self.assertEqual(snapshot["fleets"], [])
        self.assertEqual(snapshot["providers"], [])
        self.assertEqual(snapshot["providerErrors"], [])
        self.assertIsNone(snapshot["defaultFleetId"])
        for path in (
            "/api/dashboard?fleet=design-fleet-default",
            "/api/crews?fleet=design-fleet-default",
            "/api/commands/job?id=old&fleet=design-fleet-default",
            "/api/smoke-suite/current?fleet=design-fleet-default",
            "/api/smoke-suite/job?id=old&fleet=design-fleet-default",
        ):
            with self.subTest(path=path), self.assertRaises(HTTPError) as error:
                self.request(path, headers=headers)
            self.assertEqual(error.exception.code, 403)

    def test_stale_account_requests_and_writes_are_rejected(self) -> None:
        self.active_account_mock.return_value = "github.com/personal"
        with self.assertRaises(HTTPError) as error:
            self.request("/api/dashboard?fleet=design-fleet-default")
        self.assertEqual(error.exception.code, 409)
        for path in (
            "/api/fleets", "/api/fleets/rename", "/api/fleets/delete",
            "/api/crews", "/api/commands", "/api/smoke-suite",
        ):
            with self.subTest(path=path), self.assertRaises(HTTPError) as error:
                self.post(path, {"fleetId": "design-fleet-default"})
            self.assertEqual(error.exception.code, 409)
            with self.subTest(path=path), self.assertRaises(HTTPError) as forbidden:
                self.post(
                    path, {"fleetId": "design-fleet-default"},
                    account="github.com/personal",
                )
            self.assertEqual(forbidden.exception.code, 403)

    def test_account_switch_waits_for_running_dashboard_jobs(self) -> None:
        server.COMMAND_JOBS["work"] = {"status": "running"}
        with self.assertRaises(HTTPError) as error:
            self.post("/api/auth/switch", {"hostname": "github.com", "login": "personal"})
        self.assertEqual(error.exception.code, 409)

    def test_signed_out_account_cannot_read_local_data(self) -> None:
        self.active_account_mock.return_value = None
        with self.assertRaises(HTTPError) as error:
            self.request("/api/fleets")
        self.assertEqual(error.exception.code, 401)

    def test_disabled_provider_is_hidden_and_direct_access_is_denied(self) -> None:
        config_path = self.copilot_home / "config.json"
        config = json.loads(config_path.read_text(encoding="utf-8"))
        config["installedPlugins"][0]["enabled"] = False
        config_path.write_text(json.dumps(config), encoding="utf-8")
        with self.request("/api/fleets") as response:
            snapshot = json.load(response)
        self.assertNotIn("design-fleet", {item["id"] for item in snapshot["providers"]})
        with self.assertRaises(HTTPError) as error:
            self.request("/api/dashboard?fleet=design-fleet-default")
        self.assertEqual(error.exception.code, 403)

    def test_dashboard_source_check_does_not_call_auth_status(self) -> None:
        with (
            patch.object(server.shutil, "which", return_value="/usr/bin/gh"),
            patch.object(
                server,
                "gh_auth_status",
                side_effect=AssertionError("dashboard poll must not query GitHub auth"),
            ),
        ):
            with self.request("/api/dashboard?days=7&project=all") as response:
                payload = json.load(response)
        self.assertEqual(response.status, 200)
        self.assertTrue(payload["sources"]["githubCli"])

    def test_fleets_endpoint_returns_providers_instances_and_default(self) -> None:
        with self.request("/api/fleets") as response:
            payload = json.load(response)

        self.assertEqual(payload["defaultFleetId"], "design-fleet-default")
        self.assertEqual(
            {provider["id"] for provider in payload["providers"]},
            {"design-fleet", "research-fleet", "limited-fleet"},
        )
        self.assertEqual(
            {fleet["id"] for fleet in payload["fleets"]},
            {
                "design-fleet-default",
                "research-fleet-default",
                "limited-fleet-default",
            },
        )

    def test_dashboard_uses_selected_fleet_and_default_fallback(self) -> None:
        with self.request(
            "/api/dashboard?days=7&project=all&fleet=research-fleet-default"
        ) as response:
            selected = json.load(response)
        with self.request("/api/dashboard?days=7&project=all") as response:
            fallback = json.load(response)

        self.assertEqual(selected["collectorProvider"], "research-fleet")
        self.assertEqual(selected["collectorFleet"], "research-fleet-default")
        self.assertEqual(selected["fleetId"], "research-fleet-default")
        self.assertEqual(fallback["collectorProvider"], "design-fleet")
        self.assertEqual(fallback["fleetId"], "design-fleet-default")

    def test_create_fleet_validates_provider_and_rejects_duplicates(self) -> None:
        with self.post(
            "/api/fleets",
            {"name": "Research studio", "providerId": "research-fleet"},
        ) as response:
            created = json.load(response)

        self.assertEqual(response.status, 201)
        self.assertEqual(created["id"], "research-fleet-research-studio")
        with self.assertRaises(HTTPError) as duplicate:
            self.post(
                "/api/fleets",
                {"name": "Research studio", "providerId": "research-fleet"},
            )
        self.assertEqual(duplicate.exception.code, 400)
        with self.assertRaises(HTTPError) as unavailable:
            self.post(
                "/api/fleets",
                {"name": "Unknown", "providerId": "missing-provider"},
            )
        self.assertEqual(unavailable.exception.code, 400)

    def test_rename_and_delete_fleet_endpoints(self) -> None:
        with self.post(
            "/api/fleets",
            {"name": "Research studio", "providerId": "research-fleet"},
        ) as response:
            created = json.load(response)
        with self.post(
            "/api/fleets/rename",
            {"id": created["id"], "name": "Research lab"},
        ) as response:
            renamed = json.load(response)
        self.assertEqual(renamed["name"], "Research lab")

        with self.post("/api/fleets/delete", {"id": created["id"]}) as response:
            snapshot = json.load(response)
        self.assertNotIn(
            created["id"],
            {fleet["id"] for fleet in snapshot["fleets"]},
        )

        with self.assertRaises(HTTPError) as protected:
            self.post(
                "/api/fleets/delete",
                {"id": "design-fleet-default"},
            )
        self.assertEqual(protected.exception.code, 400)

    def test_capabilities_are_enforced_for_commands_smoke_and_crews(self) -> None:
        base = {
            "fleetId": "limited-fleet-default",
            "project": "mbugua-j/design-fleet",
            "confirmed": True,
        }
        with self.assertRaises(HTTPError) as command:
            self.post(
                "/api/commands",
                {
                    **base,
                    "station": "maker",
                    "model": "gpt-5.6-sol",
                    "prompt": "Do the work",
                    "maxCredits": 30,
                },
            )
        self.assertEqual(command.exception.code, 400)
        with self.assertRaises(HTTPError) as smoke:
            self.post("/api/smoke-suite", base)
        self.assertEqual(smoke.exception.code, 400)
        with self.assertRaises(HTTPError) as crew:
            self.post("/api/crews", {**base, "name": "limited"})
        self.assertEqual(crew.exception.code, 400)

    def test_job_lookup_is_isolated_by_fleet(self) -> None:
        server.COMMAND_JOBS["research-job"] = {
            "id": "research-job",
            "fleetId": "research-fleet-default",
            "status": "completed",
        }

        with self.request(
            "/api/commands/job?id=research-job&fleet=research-fleet-default"
        ) as response:
            payload = json.load(response)
        self.assertEqual(payload["id"], "research-job")
        with self.assertRaises(HTTPError) as wrong_fleet:
            self.request(
                "/api/commands/job?id=research-job&fleet=design-fleet-default"
            )
        self.assertEqual(wrong_fleet.exception.code, 404)

    def test_auth_status_includes_active_profile_name(self) -> None:
        status = CompletedProcess(
            args=[],
            returncode=0,
            stdout=json.dumps(
                {
                    "hosts": {
                        "github.com": [
                            {
                                "active": True,
                                "host": "github.com",
                                "login": "octocat",
                                "state": "success",
                                "scopes": "repo",
                            }
                        ]
                    }
                }
            ),
            stderr="",
        )
        profile = CompletedProcess(
            args=[],
            returncode=0,
            stdout=json.dumps(
                {
                    "name": "The Octocat",
                    "avatar_url": "https://avatars.githubusercontent.com/u/1",
                }
            ),
            stderr="",
        )
        with (
            patch.object(server.shutil, "which", return_value="/usr/bin/gh"),
            patch.object(
                server.subprocess,
                "run",
                side_effect=[status, profile],
            ),
        ):
            result = server.gh_auth_status()

        self.assertEqual(result["accounts"][0]["name"], "The Octocat")
        self.assertEqual(
            result["accounts"][0]["avatarUrl"],
            "https://avatars.githubusercontent.com/u/1",
        )

    def test_dashboard_rejects_invalid_project(self) -> None:
        with self.assertRaises(HTTPError) as error:
            self.request("/api/dashboard?days=7&project=not-a-repository")
        self.assertEqual(error.exception.code, 400)

    def test_hashed_static_assets_are_compressed_and_cached(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            dist = server.Path(directory)
            assets = dist / "assets"
            assets.mkdir()
            source = b"const dashboard = true;\n" * 200
            (assets / "index-abc123.js").write_bytes(source)
            with patch.object(server, "DIST_ROOT", dist):
                with self.request(
                    "/assets/index-abc123.js",
                    headers={"Accept-Encoding": "gzip"},
                ) as response:
                    body = response.read()

        self.assertEqual(response.headers["Content-Encoding"], "gzip")
        self.assertEqual(response.headers["Vary"], "Accept-Encoding")
        self.assertEqual(
            response.headers["Cache-Control"],
            "public, max-age=31536000, immutable",
        )
        self.assertEqual(gzip.decompress(body), source)

    def test_html_is_revalidated_instead_of_stored_immutably(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            dist = server.Path(directory)
            (dist / "index.html").write_text("<main>Dashboard</main>", encoding="utf-8")
            with patch.object(server, "DIST_ROOT", dist):
                with self.request("/") as response:
                    response.read()

        self.assertEqual(response.headers["Cache-Control"], "no-cache")

    def test_auth_logout_runs_specific_account_command(self) -> None:
        completed = CompletedProcess(
            args=[],
            returncode=0,
            stdout="",
            stderr="",
        )
        expected = {
            "available": True,
            "accounts": [],
            "error": None,
        }
        with (
            patch.object(server.shutil, "which", return_value="/usr/bin/gh"),
            patch.object(server.subprocess, "run", return_value=completed) as run,
            patch.object(server, "gh_auth_status", return_value=expected),
        ):
            result = server.logout_account("github.com", "octocat")

        self.assertEqual(result, expected)
        run.assert_called_once_with(
            [
                "/usr/bin/gh",
                "auth",
                "logout",
                "--hostname",
                "github.com",
                "--user",
                "octocat",
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )

    def test_auth_logout_route_rejects_invalid_account(self) -> None:
        with self.assertRaises(HTTPError) as error:
            self.post(
                "/api/auth/logout",
                {"hostname": "github.com", "login": "../octocat"},
            )
        self.assertEqual(error.exception.code, 400)

    def test_auth_login_streams_device_instructions(self) -> None:
        observed_messages = []

        class ImmediateThread:
            def __init__(self, target, daemon):
                self.target = target

            def start(self):
                self.target()

            def join(self, timeout=None):
                return None

        class FakeProcess:
            returncode = 0
            stdout = iter(
                [
                    "First copy your one-time code: ABCD-EFGH\n",
                    "Open this URL to continue: https://github.com/login/device\n",
                ]
            )

            def wait(self, timeout):
                job = next(iter(server.AUTH_JOBS.values()))
                observed_messages.append(job["message"])
                return self.returncode

        with (
            patch.object(server.shutil, "which", return_value="/usr/bin/gh"),
            patch.object(server.subprocess, "Popen", return_value=FakeProcess()) as popen,
            patch.object(server.threading, "Thread", ImmediateThread),
        ):
            job = server.start_auth_job("github.com")

        command = popen.call_args.args[0]
        self.assertEqual(job["status"], "completed")
        self.assertIn("ABCD-EFGH", observed_messages[0])
        self.assertIn("https://github.com/login/device", observed_messages[0])
        self.assertIn("--clipboard", command)
        self.assertEqual(popen.call_args.kwargs["stderr"], server.subprocess.STDOUT)

    def test_auth_login_reuses_running_job_for_hostname(self) -> None:
        existing = {
            "id": "existing",
            "status": "running",
            "hostname": "github.com",
            "message": "First copy your one-time code: ABCD-EFGH",
        }
        server.AUTH_JOBS["existing"] = existing

        with patch.object(
            server.subprocess,
            "Popen",
            side_effect=AssertionError("must not start a duplicate login"),
        ):
            result = server.start_auth_job("github.com")

        self.assertIs(result, existing)

    def test_auth_login_timeout_does_not_leave_running_job(self) -> None:
        class ImmediateThread:
            def __init__(self, target, daemon):
                self.target = target

            def start(self):
                self.target()

            def join(self, timeout=None):
                return None

        class UnreapableProcess:
            returncode = None
            stdout = iter(())

            def wait(self, timeout):
                raise server.subprocess.TimeoutExpired("gh", timeout)

            def terminate(self):
                return None

            def kill(self):
                return None

        with (
            patch.object(server.shutil, "which", return_value="/usr/bin/gh"),
            patch.object(
                server.subprocess,
                "Popen",
                return_value=UnreapableProcess(),
            ),
            patch.object(server.threading, "Thread", ImmediateThread),
        ):
            job = server.start_auth_job("github.com")

        self.assertEqual(job["status"], "failed")
        self.assertEqual(job["message"], "GitHub authentication timed out.")

    def test_agent_command_requires_explicit_confirmation(self) -> None:
        with self.assertRaisesRegex(
            ValueError,
            "Confirm the command permission",
        ):
            server.start_command_job(
                {
                    "project": "mbugua-j/design-fleet",
                    "station": "shipwright",
                    "model": "gpt-5.6-sol",
                    "prompt": "Do the work",
                    "maxCredits": 5,
                    "confirmed": False,
                }
            )

    def test_agent_command_uses_selected_agent_model_and_credit_limit(self) -> None:
        class ImmediateThread:
            def __init__(self, target, daemon):
                self.target = target

            def start(self):
                self.target()

        completed = CompletedProcess(
            args=[],
            returncode=0,
            stdout="Command complete",
            stderr="",
        )
        with tempfile.TemporaryDirectory() as directory:
            command_log = server.Path(directory) / "commands.jsonl"
            with (
                patch.object(server, "COMMAND_LOG", command_log),
                patch.object(server, "project_directory", return_value=server.PLUGIN_ROOT),
                patch.object(server.shutil, "which", return_value="/usr/bin/copilot"),
                patch.object(server.threading, "Thread", ImmediateThread),
                patch.object(server.subprocess, "run", return_value=completed) as run,
            ):
                job = server.start_command_job(
                    {
                        "project": "mbugua-j/design-fleet",
                        "station": "shipwright",
                        "model": "claude-sonnet-5",
                        "prompt": "Implement the dashboard card",
                        "maxCredits": 30,
                        "confirmed": True,
                        "taskId": "existing-task-id",
                    }
                )
            command_events = command_log.read_text(encoding="utf-8")

        command = run.call_args.args[0]
        self.assertEqual(job["status"], "completed")
        self.assertIn("design-fleet:Shipwright", command)
        self.assertIn("claude-sonnet-5", command)
        self.assertIn("30.0", command)
        self.assertIn("--allow-all-tools", command)
        self.assertNotIn("--allow-all-paths", command)
        self.assertIn("--session-id", command)
        self.assertIn("--sync-session=off", command)
        self.assertNotIn("--no-remote", command)
        self.assertNotIn("--no-remote-export", command)
        self.assertNotIn("Implement the dashboard card", command_events)
        self.assertIn('"taskId": "existing-task-id"', command_events)
        self.assertIn('"kind": "command"', command_events)

    def test_smoke_command_disables_tools_without_auto_approval(self) -> None:
        class ImmediateThread:
            def __init__(self, target, daemon):
                self.target = target

            def start(self):
                self.target()

        completed = CompletedProcess(
            args=[], returncode=0, stdout="SMOKE_OK", stderr="",
        )
        with (
            patch.object(server, "project_directory", return_value=self.temp_root),
            patch.object(server.shutil, "which", return_value="/usr/bin/copilot"),
            patch.object(server.threading, "Thread", ImmediateThread),
            patch.object(server.subprocess, "run", return_value=completed) as run,
        ):
            job = server.start_command_job(
                {
                    "project": "mbugua-j/design-fleet",
                    "station": "shipwright",
                    "prompt": "Reply with SMOKE_OK without using tools.",
                    "maxCredits": 30,
                    "confirmed": True,
                    "kind": "smoke",
                }
            )

        command = run.call_args.args[0]
        self.assertEqual(job["status"], "completed")
        self.assertIn("--available-tools=", command)
        self.assertIn("--disable-builtin-mcps", command)
        self.assertIn("--sync-session=off", command)
        self.assertNotIn("--no-remote", command)
        self.assertNotIn("--no-remote-export", command)
        self.assertNotIn("--allow-all-tools", command)
        self.assertNotIn("--allow-all-paths", command)

    def test_agent_command_uses_selected_provider_root_and_namespace(self) -> None:
        class ImmediateThread:
            def __init__(self, target, daemon):
                self.target = target

            def start(self):
                self.target()

        completed = CompletedProcess(
            args=[],
            returncode=0,
            stdout="Command complete",
            stderr="",
        )
        with (
            patch.object(
                server,
                "project_directory",
                return_value=self.temp_root,
            ),
            patch.object(server.shutil, "which", return_value="/usr/bin/copilot"),
            patch.object(server.threading, "Thread", ImmediateThread),
            patch.object(server.subprocess, "run", return_value=completed) as run,
        ):
            job = server.start_command_job(
                {
                    "fleetId": "research-fleet-default",
                    "project": "mbugua-j/design-fleet",
                    "station": "maker",
                    "model": "gpt-5.6-sol",
                    "prompt": "Do the work",
                    "maxCredits": 30,
                    "confirmed": True,
                },
                self.registry,
            )

        command = run.call_args.args[0]
        self.assertEqual(job["fleetId"], "research-fleet-default")
        self.assertIn("research-fleet:Maker", command)
        self.assertEqual(
            command[command.index("--plugin-dir") + 1],
            str(self.research_root.resolve()),
        )

    def test_crew_save_uses_selected_provider_entrypoint(self) -> None:
        completed = CompletedProcess(
            args=[],
            returncode=0,
            stdout="Saved crew",
            stderr="",
        )
        with patch.object(
            server.subprocess,
            "run",
            return_value=completed,
        ) as run:
            result = server.save_crew(
                {
                    "fleetId": "research-fleet-default",
                    "name": "researchers",
                    "label": "Researchers",
                    "names": {"maker": "ResearchMaker"},
                    "models": {"maker": "gpt-5.6-sol"},
                    "install": False,
                },
                self.registry,
            )

        command = run.call_args.args[0]
        self.assertEqual(result["message"], "Saved crew 'Researchers'.")
        self.assertEqual(
            Path(command[1]),
            (self.research_root / "bin" / "fleet.py").resolve(),
        )

    def test_smoke_suite_runs_each_configured_model_once(self) -> None:
        class ImmediateThread:
            def __init__(self, target, daemon):
                self.target = target

            def start(self):
                self.target()

        roles = {
            "stations": [
                {
                    "id": "shipwright",
                    "display": "Shipwright",
                    "model": "gpt-5.6-sol",
                },
                {
                    "id": "draftsman",
                    "display": "Draftsman",
                    "model": "gpt-5.6-sol",
                },
                {
                    "id": "surveyor",
                    "display": "Surveyor",
                    "model": "claude-sonnet-5",
                },
            ]
        }
        observed = []

        def complete_command(payload, registry=None):
            observed.append(payload)
            job_id = f"command-{len(observed)}"
            job = {
                "id": job_id,
                "fleetId": payload["fleetId"],
                "providerId": "design-fleet",
                "status": "completed",
                "station": payload["station"],
                "agent": payload["station"],
                "project": payload["project"],
                "model": payload["model"],
                "maxCredits": payload["maxCredits"],
                "taskId": None,
                "kind": payload["kind"],
                "message": "Agent command completed.",
                "output": "SMOKE_OK",
            }
            with server.COMMAND_LOCK:
                server.COMMAND_JOBS[job_id] = job
            return job

        with (
            patch.object(server, "load_roles", return_value=roles),
            patch.object(
                server,
                "project_directory",
                return_value=server.PLUGIN_ROOT,
            ),
            patch.object(server.shutil, "which", return_value="/usr/bin/copilot"),
            patch.object(server, "start_command_job", side_effect=complete_command),
            patch.object(server.threading, "Thread", ImmediateThread),
        ):
            job = server.start_smoke_suite(
                {
                    "project": "mbugua-j/design-fleet",
                    "confirmed": True,
                }
            )

        self.assertEqual(job["status"], "completed")
        self.assertEqual(job["total"], 2)
        self.assertEqual(job["completed"], 2)
        self.assertEqual(
            [payload["model"] for payload in observed],
            ["gpt-5.6-sol", "claude-sonnet-5"],
        )
        self.assertTrue(all(payload["kind"] == "smoke" for payload in observed))

    def test_agent_command_rejects_cli_credit_values_below_thirty(self) -> None:
        with self.assertRaisesRegex(
            ValueError,
            "between 30 and 1,000",
        ):
            server.start_command_job(
                {
                    "project": "mbugua-j/design-fleet",
                    "station": "shipwright",
                    "model": "gpt-5.6-sol",
                    "prompt": "Implement the dashboard card",
                    "maxCredits": 29.9,
                    "confirmed": True,
                }
            )

    def test_agent_command_rejects_invalid_board_task_id(self) -> None:
        with self.assertRaisesRegex(ValueError, "valid board task"):
            server.start_command_job(
                {
                    "project": "mbugua-j/design-fleet",
                    "station": "shipwright",
                    "model": "gpt-5.6-sol",
                    "prompt": "Continue the task",
                    "maxCredits": 30,
                    "confirmed": True,
                    "taskId": "../another-session",
                }
            )


if __name__ == "__main__":
    unittest.main()
