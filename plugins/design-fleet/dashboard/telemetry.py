"""Read-only local telemetry collector for the design-fleet dashboard."""

from __future__ import annotations

import json
import os
import re
import shlex
import sqlite3
import subprocess
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


SMOKE_PATTERN = re.compile(r"\b(smoke|retest|probe)\b", re.IGNORECASE)
AGENT_ID_PATTERN = re.compile(
    r"agent_id:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})",
    re.IGNORECASE,
)
PR_URL_PATTERN = re.compile(
    r"https://github\.com/([^/\s]+)/([^/\s]+)/pull/(\d+)",
    re.IGNORECASE,
)
SAFE_REPOSITORY = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
SAFE_SESSION_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
REASONING_EFFORT_PATTERN = re.compile(
    r"^reasoningEffort:\s*['\"]?([A-Za-z]+)['\"]?\s*$",
    re.MULTILINE,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def iso_time(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def safe_average(values: list[float | int | None]) -> float | None:
    available = [float(value) for value in values if value is not None]
    if not available:
        return None
    return sum(available) / len(available)


def rounded(value: float | None, digits: int = 2) -> float | None:
    return None if value is None else round(value, digits)


def read_json(path: Path) -> dict[str, Any] | None:
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def read_workspace(path: Path) -> dict[str, str]:
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return {}

    workspace: dict[str, str] = {}
    for line in lines:
        if not line or line[0].isspace() or ":" not in line:
            continue
        key, raw_value = line.split(":", 1)
        value = raw_value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        workspace[key.strip()] = value
    return workspace


def live_process_commands() -> dict[int, str]:
    if os.name == "nt":
        command = [
            "powershell",
            "-NoProfile",
            "-Command",
            (
                "Get-CimInstance Win32_Process | ForEach-Object { "
                "'{0}`t{1}' -f $_.ProcessId, $_.CommandLine }"
            ),
        ]
    else:
        command = ["ps", "-axo", "pid=,command="]

    try:
        completed = subprocess.run(
            command,
            capture_output=True,
            check=False,
            text=True,
            timeout=2,
        )
    except (OSError, subprocess.TimeoutExpired):
        return {}
    if completed.returncode != 0:
        return {}

    processes: dict[int, str] = {}
    for line in completed.stdout.splitlines():
        fields = line.strip().split("\t", 1) if os.name == "nt" else line.strip().split(None, 1)
        if len(fields) != 2:
            continue
        try:
            pid = int(fields[0])
        except ValueError:
            continue
        processes[pid] = fields[1]
    return processes


def session_ids_from_command(command: str) -> list[str]:
    try:
        tokens = shlex.split(command)
    except ValueError:
        tokens = command.split()

    session_ids: list[str] = []
    for index, token in enumerate(tokens):
        candidate = ""
        if token == "--session-id" and index + 1 < len(tokens):
            candidate = tokens[index + 1]
        elif token.startswith("--session-id="):
            candidate = token.split("=", 1)[1]
        if (
            candidate
            and SAFE_SESSION_ID.fullmatch(candidate)
            and candidate not in session_ids
        ):
            session_ids.append(candidate)
    return session_ids


def configured_repository(cwd: str | None, fallback: str | None) -> str:
    config = (
        read_json(Path(cwd) / ".copilot" / "design-fleet.json")
        if cwd
        else None
    )
    project = config.get("project") if config else None
    if isinstance(project, dict):
        for key in ("upstream", "repo"):
            repository = project.get(key)
            if isinstance(repository, str) and SAFE_REPOSITORY.fullmatch(repository):
                return repository
    if fallback and SAFE_REPOSITORY.fullmatch(fallback):
        return fallback
    return "Unknown project"


def read_rows(path: Path, query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    if not path.is_file():
        return []
    try:
        connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        connection.row_factory = sqlite3.Row
        rows = [dict(row) for row in connection.execute(query, params)]
    except sqlite3.Error:
        return []
    finally:
        try:
            connection.close()
        except UnboundLocalError:
            pass
    return rows


def load_roles(
    plugin_root: Path,
    station_manifest: Path | None = None,
    agents_directory: Path | None = None,
) -> dict[str, Any]:
    roles = read_json(station_manifest or plugin_root / "crews" / "roles.json")
    if not roles or not isinstance(roles.get("stations"), list):
        raise RuntimeError("Unable to read the fleet provider station roster")
    agent_root = agents_directory or plugin_root / "agents"
    for station in roles["stations"]:
        display = station.get("display")
        effort = None
        if isinstance(display, str):
            try:
                source = (agent_root / f"{display}.agent.md").read_text(
                    encoding="utf-8"
                )
            except OSError:
                source = ""
            match = REASONING_EFFORT_PATTERN.search(source)
            if match:
                candidate = match.group(1).lower()
                if candidate in {"low", "medium", "high", "xhigh", "max"}:
                    effort = candidate
        station["reasoningEffort"] = effort
    return roles


def load_station_aliases(
    plugin_root: Path,
    copilot_home: Path,
    roles: dict[str, Any],
    crews_directory: Path | None = None,
    provider_id: str = "design-fleet",
) -> dict[str, str]:
    aliases: dict[str, str] = {}
    canonical_ids = {station["id"] for station in roles["stations"]}

    for station in roles["stations"]:
        aliases[station["id"].lower()] = station["id"]
        aliases[station["display"].lower()] = station["id"]

    crew_paths = list((crews_directory or plugin_root / "crews").glob("*.json"))
    user_crews = copilot_home / provider_id / "crews"
    if user_crews.is_dir():
        crew_paths.extend(user_crews.glob("*.json"))

    for path in crew_paths:
        if path.name == "roles.json":
            continue
        crew = read_json(path)
        if not crew or not isinstance(crew.get("names"), dict):
            continue
        for station_id, display in crew["names"].items():
            if station_id in canonical_ids and isinstance(display, str):
                aliases[display.lower()] = station_id

    return aliases


def station_from_agent(agent_type: str | None, aliases: dict[str, str]) -> str | None:
    if not agent_type:
        return None
    candidate = agent_type.split(":")[-1].strip().lower()
    return aliases.get(candidate)


def extract_agent_id(data: dict[str, Any]) -> str | None:
    telemetry = data.get("toolTelemetry")
    if isinstance(telemetry, dict):
        restricted = telemetry.get("restrictedProperties")
        if isinstance(restricted, dict) and isinstance(restricted.get("agent_id"), str):
            return restricted["agent_id"]

    result = data.get("result")
    if isinstance(result, dict):
        nested = result.get("toolTelemetry")
        if isinstance(nested, dict):
            restricted = nested.get("restrictedProperties")
            if isinstance(restricted, dict) and isinstance(restricted.get("agent_id"), str):
                return restricted["agent_id"]
        text = "\n".join(
            str(result.get(key, "")) for key in ("content", "detailedContent")
        )
        match = AGENT_ID_PATTERN.search(text)
        if match:
            return match.group(1)
    return None


def result_text(data: dict[str, Any]) -> str:
    result = data.get("result")
    if isinstance(result, dict):
        return str(result.get("content") or result.get("detailedContent") or "")
    return str(result or "")


def command_from_event(event: dict[str, Any]) -> str:
    data = event.get("data")
    if not isinstance(data, dict):
        return ""
    arguments = data.get("arguments")
    if not isinstance(arguments, dict):
        return ""
    return str(arguments.get("command") or arguments.get("cmd") or "")


def pr_repository_from_command(command: str, fallback: str) -> str:
    def normalize(value: str) -> str | None:
        parts = value.strip("/").split("/")
        if len(parts) == 3:
            parts = parts[-2:]
        if len(parts) != 2:
            return None
        repository = "/".join(parts)
        return repository if SAFE_REPOSITORY.fullmatch(repository) else None

    try:
        tokens = shlex.split(command)
    except ValueError:
        tokens = command.split()
    for index, token in enumerate(tokens):
        if token in {"--repo", "-R"} and index + 1 < len(tokens):
            repository = normalize(tokens[index + 1])
            if repository:
                return repository
        if token.startswith("--repo=") or token.startswith("-R="):
            repository = normalize(token.split("=", 1)[1])
            if repository:
                return repository
    return fallback


def event_content(event: dict[str, Any]) -> str:
    data = event.get("data")
    if not isinstance(data, dict):
        return ""
    return str(data.get("content") or data.get("message") or "")


def read_event_file(path: Path) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    try:
        with path.open(encoding="utf-8") as handle:
            for line in handle:
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if isinstance(event, dict):
                    events.append(event)
    except OSError:
        return []
    return events


def is_smoke_run(run: dict[str, Any]) -> bool:
    if run.get("kind") == "smoke":
        return True
    value = f"{run.get('name', '')} {run.get('description', '')}"
    return bool(SMOKE_PATTERN.search(value))


class TelemetryCollector:
    def __init__(
        self,
        plugin_root: Path,
        copilot_home: Path | None = None,
        now: datetime | None = None,
        *,
        provider_id: str = "design-fleet",
        agent_namespace: str = "design-fleet",
        station_manifest: Path | None = None,
        agents_directory: Path | None = None,
        crews_directory: Path | None = None,
    ) -> None:
        self.plugin_root = plugin_root
        self.copilot_home = copilot_home or Path.home() / ".copilot"
        self._now_override = now
        self.provider_id = provider_id
        self.agent_namespace = agent_namespace
        self.station_manifest = station_manifest
        self.agents_directory = agents_directory
        self.crews_directory = crews_directory
        self.session_store = self.copilot_home / "session-store.db"
        self.desktop_store = self.copilot_home / "data.db"
        self.session_state = self.copilot_home / "session-state"
        self._event_cache: dict[Path, dict[str, Any]] = {}

    def _live_sessions(self, now: datetime) -> list[dict[str, Any]]:
        if not self.session_state.is_dir():
            return []

        sessions = []
        process_commands = live_process_commands()
        seen_session_ids: set[str] = set()
        for pid, command in process_commands.items():
            for directory_name in session_ids_from_command(command):
                if directory_name in seen_session_ids:
                    continue
                directory = self.session_state / directory_name
                if not (directory / f"inuse.{pid}.lock").is_file():
                    continue

                workspace = read_workspace(directory / "workspace.yaml")
                session_id = workspace.get("id") or directory.name
                if session_id != directory_name and session_id not in command:
                    continue
                seen_session_ids.add(directory_name)
                cwd = workspace.get("cwd") or workspace.get("git_root") or ""
                sessions.append(
                    {
                        "id": session_id,
                        "cwd": cwd,
                        "repository": configured_repository(
                            cwd,
                            workspace.get("repository"),
                        ),
                        "branch": workspace.get("branch") or "",
                        "summary": workspace.get("name") or "Active Copilot session",
                        "created_at": workspace.get("created_at") or iso_time(now),
                        "updated_at": iso_time(now),
                        "isRunning": True,
                    }
                )
        return sessions

    def _events_for(self, path: Path) -> list[dict[str, Any]]:
        try:
            size = path.stat().st_size
        except OSError:
            return []
        cached = self._event_cache.get(path)
        if cached and cached["size"] == size:
            return cached["events"]
        append_only = bool(cached and cached["size"] < size)
        events = list(cached["events"]) if append_only else []
        start = cached["size"] if append_only else 0
        try:
            with path.open("rb") as handle:
                handle.seek(start)
                for raw_line in handle:
                    try:
                        event = json.loads(raw_line.decode("utf-8"))
                    except (UnicodeDecodeError, json.JSONDecodeError):
                        continue
                    if isinstance(event, dict):
                        events.append(event)
                consumed_size = handle.tell()
        except OSError:
            return events
        self._event_cache[path] = {"size": consumed_size, "events": events}
        return events

    def collect(
        self,
        days: int = 7,
        project: str = "all",
        fleet_id: str | None = None,
    ) -> dict[str, Any]:
        now = self._now_override or utc_now()
        days = max(1, min(days, 90))
        cutoff = now - timedelta(days=days)
        cutoff_text = iso_time(cutoff) or ""
        roles = load_roles(
            self.plugin_root,
            station_manifest=self.station_manifest,
            agents_directory=self.agents_directory,
        )
        aliases = load_station_aliases(
            self.plugin_root,
            self.copilot_home,
            roles,
            crews_directory=self.crews_directory,
            provider_id=self.provider_id,
        )

        sessions = read_rows(
            self.session_store,
            """
            SELECT id, cwd, repository, branch, summary, created_at, updated_at
            FROM sessions
            WHERE updated_at >= ?
            ORDER BY updated_at DESC
            """,
            (cutoff_text,),
        )
        sessions_by_id = {}
        for row in sessions:
            row["repository"] = configured_repository(
                str(row.get("cwd") or ""),
                str(row.get("repository") or ""),
            )
            row["isRunning"] = False
            sessions_by_id[str(row["id"])] = row
        for live_session in self._live_sessions(now):
            existing = sessions_by_id.get(str(live_session["id"]))
            if existing:
                existing.update(live_session)
            else:
                sessions.append(live_session)
                sessions_by_id[str(live_session["id"])] = live_session
        if project != "all":
            sessions = [row for row in sessions if row.get("repository") == project]
        sessions_by_id = {row["id"]: row for row in sessions}

        # Include the complete usage history for sessions that overlap the
        # selected range so boundary-crossing runs are not treated as zero-call.
        usage = read_rows(
            self.session_store,
            """
            SELECT session_id, agent_id, model, input_tokens, output_tokens,
                   cache_read_tokens, cache_write_tokens, total_nano_aiu,
                   duration_ms, time_to_first_token_ms, output_ttft_ms,
                   finish_reason, created_at
            FROM assistant_usage_events
            WHERE created_at >= ?
               OR session_id IN (
                   SELECT id
                   FROM sessions
                   WHERE updated_at >= ?
               )
            ORDER BY created_at
            """,
            (cutoff_text, cutoff_text),
        )
        usage = [
            row
            for row in usage
            if row.get("session_id") in sessions_by_id
        ]

        desktop_runs, desktop_session_agents = self._desktop_runs(
            cutoff_text,
            project,
            aliases,
            now,
        )
        runs, pr_attempts, event_logs_found = self._task_runs(
            sessions,
            aliases,
            desktop_session_agents,
            now,
        )
        runs.extend(desktop_runs)
        runs.extend(self._portal_command_runs(cutoff, project, fleet_id))

        usage_by_agent: dict[str, list[dict[str, Any]]] = defaultdict(list)
        usage_by_model: dict[str, list[dict[str, Any]]] = defaultdict(list)
        usage_by_session: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in usage:
            agent_id = row.get("agent_id")
            if agent_id:
                usage_by_agent[str(agent_id)].append(row)
            usage_by_model[str(row.get("model") or "unknown")].append(row)
            usage_by_session[str(row["session_id"])].append(row)

        runs_by_agent_id = {
            run["agentId"]: run for run in runs if run.get("agentId")
        }
        for agent_id, rows in usage_by_agent.items():
            run = runs_by_agent_id.get(agent_id)
            if not run:
                continue
            run["calls"] = len(rows)
            run["aiu"] = sum((row.get("total_nano_aiu") or 0) for row in rows) / 1_000_000_000
            run["averageTtftMs"] = safe_average(
                [
                    row.get("output_ttft_ms")
                    if row.get("output_ttft_ms") is not None
                    else row.get("time_to_first_token_ms")
                    for row in rows
                ]
            )
            run["model"] = str(rows[-1].get("model") or run.get("model") or "")

        for run in runs:
            if run.get("mode") != "portal":
                continue
            rows = usage_by_session.get(
                str(run.get("usageSessionId") or run["sessionId"]),
                [],
            )
            run["calls"] = len(rows)
            run["aiu"] = sum(
                (row.get("total_nano_aiu") or 0) for row in rows
            ) / 1_000_000_000
            run["averageTtftMs"] = safe_average(
                [
                    row.get("output_ttft_ms")
                    if row.get("output_ttft_ms") is not None
                    else row.get("time_to_first_token_ms")
                    for row in rows
                ]
            )
            if rows:
                run["model"] = str(rows[-1].get("model") or run.get("model") or "")

        self._attach_prs(runs_by_agent_id, pr_attempts)
        self._finalize_run_statuses(runs, now)

        selected_runs = [
            run for run in runs
            if project == "all" or run["project"] == project
        ]
        selected_prs = [
            attempt for attempt in pr_attempts
            if attempt.get("success")
            and (project == "all" or attempt["repository"] == project)
            and runs_by_agent_id.get(attempt.get("agentId"), {}).get("stationId") == "herald"
        ]

        stations = self._station_summaries(
            roles,
            selected_runs,
            usage_by_model,
        )
        models = self._model_summaries(
            roles,
            selected_runs,
            usage_by_model,
            now,
        )
        projects = self._project_summaries(
            sessions,
            runs,
            pr_attempts,
            runs_by_agent_id,
        )
        smoke = self._smoke_summary(selected_runs)
        processes = [
            self._public_run(run)
            for run in selected_runs
            if run["status"] in {"running", "stalled"}
        ]
        processes.sort(key=lambda run: run["lastActivity"], reverse=True)
        activity = [self._public_run(run) for run in selected_runs]
        activity.sort(key=lambda run: run["startedAt"], reverse=True)
        activity = activity[:60]
        handoffs = self._handoff_summaries(selected_runs, sessions_by_id)

        total_aiu = sum(run.get("aiu", 0.0) for run in selected_runs)
        summary = {
            "stationCount": len(stations),
            "healthyStations": sum(station["status"] == "healthy" for station in stations),
            "warningStations": sum(station["status"] in {"warning", "untested"} for station in stations),
            "downStations": sum(station["status"] == "down" for station in stations),
            "activeSessions": sum(
                project_summary["activeSessions"]
                for project_summary in projects
            ),
            "activeProcesses": len(processes),
            "heraldPrs": len(selected_prs),
            "totalRuns": len(selected_runs),
            "totalAiu": round(total_aiu, 3),
        }

        return {
            "generatedAt": iso_time(now),
            "rangeDays": days,
            "selectedProject": project,
            "summary": summary,
            "projects": projects,
            "stations": stations,
            "models": models,
            "processes": processes,
            "smokeTest": smoke,
            "activity": activity,
            "handoffs": handoffs,
            "sources": {
                "sessionStore": self.session_store.is_file(),
                "eventLogs": event_logs_found,
                "githubCli": False,
            },
        }

    def _desktop_runs(
        self,
        cutoff_text: str,
        project: str,
        aliases: dict[str, str],
        now: datetime,
    ) -> tuple[list[dict[str, Any]], dict[str, str]]:
        rows = read_rows(
            self.desktop_store,
            """
            SELECT s.id, s.title, s.agent, s.model, s.is_running,
                   s.created_at, s.updated_at,
                   p.github_owner, p.github_repo, p.name AS project_name,
                   p.main_repo_path, w.branch
            FROM sessions s
            LEFT JOIN workspaces w ON w.session_id = s.id
            LEFT JOIN projects p ON p.id = w.project_id
            WHERE s.agent IS NOT NULL AND s.updated_at >= ?
            ORDER BY s.updated_at DESC
            """,
            (cutoff_text,),
        )
        runs: list[dict[str, Any]] = []
        session_agents: dict[str, str] = {}
        for row in rows:
            station_id = station_from_agent(row.get("agent"), aliases)
            if not station_id:
                continue
            repository = (
                f"{row['github_owner']}/{row['github_repo']}"
                if row.get("github_owner") and row.get("github_repo")
                else row.get("project_name") or "Unknown project"
            )
            if project != "all" and repository != project:
                continue
            session_agents[row["id"]] = station_id
            updated = parse_time(row.get("updated_at")) or now
            running = bool(row.get("is_running"))
            runs.append(
                {
                    "id": f"desktop:{row['id']}",
                    "sessionId": row["id"],
                    "agentId": row["id"],
                    "stationId": station_id,
                    "agentType": row.get("agent"),
                    "name": row.get("title") or f"{station_id} session",
                    "description": "Desktop agent session",
                    "mode": "desktop",
                    "project": repository,
                    "branch": row.get("branch") or "",
                    "status": "running" if running else "completed",
                    "startedAt": parse_time(row.get("created_at")) or updated,
                    "completedAt": None if running else updated,
                    "lastActivity": updated,
                    "model": row.get("model"),
                    "calls": 0,
                    "aiu": 0.0,
                    "averageTtftMs": None,
                    "summary": "",
                    "prUrl": None,
                }
            )
        return runs, session_agents

    def _portal_command_runs(
        self,
        cutoff: datetime,
        project: str,
        fleet_id: str | None,
    ) -> list[dict[str, Any]]:
        path = self.copilot_home / "design-fleet" / "dashboard-commands.jsonl"
        latest: dict[str, dict[str, Any]] = {}
        started: dict[str, dict[str, Any]] = {}
        for event in read_event_file(path):
            job_id = event.get("jobId")
            if not isinstance(job_id, str):
                continue
            event_provider = event.get("providerId")
            if event_provider is not None and event_provider != self.provider_id:
                continue
            event_fleet = event.get("fleetId")
            if event_fleet is not None and event_fleet != fleet_id:
                continue
            if (
                event_fleet is None
                and fleet_id is not None
                and fleet_id != f"{self.provider_id}-default"
            ):
                continue
            if event.get("status") == "running":
                started[job_id] = event
            latest[job_id] = event

        runs = []
        for job_id, event in latest.items():
            first = started.get(job_id, event)
            started_at = parse_time(first.get("startedAt") or first.get("updatedAt"))
            updated_at = parse_time(event.get("updatedAt")) or started_at
            if not started_at or not updated_at or updated_at < cutoff:
                continue
            repository = str(event.get("project") or first.get("project") or "")
            if project != "all" and repository != project:
                continue
            status = str(event.get("status") or "unknown")
            task_id = str(event.get("taskId") or first.get("taskId") or job_id)
            kind = str(event.get("kind") or first.get("kind") or "command")
            agent = str(event.get("agent") or first.get("agent") or "agent")
            runs.append(
                {
                    "id": f"portal:{job_id}",
                    "sessionId": task_id,
                    "agentId": None,
                    "stationId": str(event.get("station") or first.get("station") or ""),
                    "agentType": f"{self.agent_namespace}:{agent}",
                    "name": (
                        f"Smoke test for {agent}"
                        if kind == "smoke"
                        else f"Portal command for {agent}"
                    ),
                    "description": (
                        "Dashboard model smoke test"
                        if kind == "smoke"
                        else "Command launched from the fleet dashboard"
                    ),
                    "kind": kind,
                    "mode": "portal",
                    "project": repository,
                    "branch": "",
                    "usageSessionId": job_id,
                    "status": status,
                    "startedAt": started_at,
                    "completedAt": parse_time(event.get("completedAt")),
                    "lastActivity": updated_at,
                    "model": event.get("model") or first.get("model"),
                    "calls": 0,
                    "aiu": 0.0,
                    "averageTtftMs": None,
                    "summary": "",
                    "prUrl": None,
                }
            )
        return runs

    def _task_runs(
        self,
        sessions: list[dict[str, Any]],
        aliases: dict[str, str],
        desktop_session_agents: dict[str, str],
        now: datetime,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], bool]:
        task_starts: dict[tuple[str, str], dict[str, Any]] = {}
        runs_by_agent: dict[str, dict[str, Any]] = {}
        agent_events: dict[str, list[dict[str, Any]]] = defaultdict(list)
        pr_attempts: list[dict[str, Any]] = []
        pr_by_tool: dict[tuple[str, str], dict[str, Any]] = {}
        found = False

        for session in sessions:
            path = self.session_state / session["id"] / "events.jsonl"
            if not path.is_file():
                continue
            found = True
            for event in self._events_for(path):
                event_type = str(event.get("type") or "")
                data = event.get("data")
                if not isinstance(data, dict):
                    data = {}
                timestamp = parse_time(event.get("timestamp")) or now
                tool_call_id = str(data.get("toolCallId") or "")
                agent_id = event.get("agentId")
                if isinstance(agent_id, str):
                    agent_events[agent_id].append(event)
                    parent_tool_call_id = data.get("parentToolCallId")
                    if isinstance(parent_tool_call_id, str):
                        parent_run = task_starts.get(
                            (session["id"], parent_tool_call_id)
                        )
                        if parent_run and not parent_run.get("agentId"):
                            parent_run["agentId"] = agent_id
                            runs_by_agent[agent_id] = parent_run

                if event_type == "tool.execution_start" and data.get("toolName") == "task":
                    arguments = data.get("arguments")
                    if not isinstance(arguments, dict):
                        continue
                    station_id = station_from_agent(arguments.get("agent_type"), aliases)
                    if not station_id:
                        continue
                    run = {
                        "id": f"{session['id']}:{tool_call_id}",
                        "sessionId": session["id"],
                        "agentId": None,
                        "stationId": station_id,
                        "agentType": arguments.get("agent_type"),
                        "name": arguments.get("name") or arguments.get("description") or station_id,
                        "description": arguments.get("description") or "",
                        "mode": arguments.get("mode") or "sync",
                        "project": session.get("repository") or "Unknown project",
                        "branch": session.get("branch") or "",
                        "status": "starting",
                        "startedAt": timestamp,
                        "completedAt": None,
                        "lastActivity": timestamp,
                        "model": arguments.get("model"),
                        "calls": 0,
                        "aiu": 0.0,
                        "averageTtftMs": None,
                        "summary": "",
                        "prUrl": None,
                    }
                    task_starts[(session["id"], tool_call_id)] = run
                    continue

                if event_type == "tool.execution_complete":
                    run = task_starts.get((session["id"], tool_call_id))
                    if run:
                        mapped_agent_id = extract_agent_id(data)
                        if mapped_agent_id:
                            run["agentId"] = mapped_agent_id
                            runs_by_agent[mapped_agent_id] = run
                        text = result_text(data)
                        run["summary"] = text[:500]
                        run["lastActivity"] = timestamp
                        if not data.get("success", True):
                            run["status"] = "failed"
                            run["completedAt"] = timestamp
                        elif run["mode"] == "background" and "started in background" in text.lower():
                            run["status"] = "running"
                        else:
                            run["status"] = "completed"
                            run["completedAt"] = timestamp

                    pr = pr_by_tool.get((session["id"], tool_call_id))
                    if pr:
                        pr["success"] = bool(data.get("success"))
                        text = result_text(data)
                        match = PR_URL_PATTERN.search(text)
                        if match:
                            pr["repository"] = f"{match.group(1)}/{match.group(2)}"
                            pr["number"] = int(match.group(3))
                            pr["url"] = match.group(0)
                        pr["completedAt"] = timestamp
                    continue

                if event_type == "tool.execution_start" and data.get("toolName") in {"bash", "shell"}:
                    command = command_from_event(event)
                    if not re.search(r"\bgh\s+pr\s+(create|new)\b", command):
                        continue
                    effective_agent_id = (
                        agent_id
                        if isinstance(agent_id, str)
                        else f"desktop:{session['id']}"
                        if session["id"] in desktop_session_agents
                        else None
                    )
                    if not effective_agent_id:
                        continue
                    attempt = {
                        "agentId": effective_agent_id,
                        "repository": pr_repository_from_command(
                            command,
                            session.get("repository") or "Unknown project",
                        ),
                        "startedAt": timestamp,
                        "completedAt": None,
                        "success": False,
                        "number": None,
                        "url": None,
                    }
                    pr_attempts.append(attempt)
                    pr_by_tool[(session["id"], tool_call_id)] = attempt

        for agent_id, events in agent_events.items():
            run = runs_by_agent.get(agent_id)
            if not run:
                continue
            ordered_events = sorted(
                events,
                key=lambda event: parse_time(event.get("timestamp"))
                or datetime.min.replace(tzinfo=timezone.utc),
            )
            for event in ordered_events:
                timestamp = parse_time(event.get("timestamp")) or now
                run["lastActivity"] = max(run["lastActivity"], timestamp)
                event_type = str(event.get("type") or "")
                content = event_content(event)
                if event_type == "assistant.turn_start":
                    if (
                        run["completedAt"] is None
                        or timestamp > run["completedAt"]
                    ):
                        run["status"] = "running"
                        run["completedAt"] = None
                elif event_type == "assistant.message" and content:
                    run["summary"] = content[:500]
                elif event_type == "subagent.completed":
                    run["status"] = "completed"
                    run["completedAt"] = timestamp
                elif event_type in {"subagent.failed", "subagent.cancelled"}:
                    run["status"] = "failed" if event_type.endswith("failed") else "cancelled"
                    run["completedAt"] = timestamp
                elif event_type == "system.notification":
                    lower = content.lower()
                    if "has finished processing" in lower or "has completed" in lower:
                        run["status"] = "completed"
                        run["completedAt"] = timestamp

        return list(task_starts.values()), pr_attempts, found

    def _attach_prs(
        self,
        runs_by_agent_id: dict[str, dict[str, Any]],
        attempts: list[dict[str, Any]],
    ) -> None:
        for attempt in attempts:
            run = runs_by_agent_id.get(attempt.get("agentId"))
            if run and attempt.get("success"):
                run["prUrl"] = attempt.get("url")

    def _finalize_run_statuses(
        self,
        runs: list[dict[str, Any]],
        now: datetime,
    ) -> None:
        for run in runs:
            if run["status"] not in {"starting", "running"}:
                continue
            age = now - run["lastActivity"]
            if age <= timedelta(minutes=10):
                run["status"] = "running"
            elif age <= timedelta(hours=2):
                run["status"] = "stalled"
            else:
                run["status"] = "unknown"

    def _station_summaries(
        self,
        roles: dict[str, Any],
        runs: list[dict[str, Any]],
        usage_by_model: dict[str, list[dict[str, Any]]],
    ) -> list[dict[str, Any]]:
        summaries = []
        for station in roles["stations"]:
            station_runs = [run for run in runs if run["stationId"] == station["id"]]
            station_runs.sort(key=lambda run: run["startedAt"], reverse=True)
            completed = [
                run for run in station_runs
                if run["status"] in {"completed", "failed", "cancelled"}
            ]
            successful = sum(run["status"] == "completed" for run in completed)
            smoke_runs = [run for run in station_runs if is_smoke_run(run)]
            last_run = station_runs[0] if station_runs else None
            last_smoke = smoke_runs[0] if smoke_runs else None

            if last_smoke:
                if last_smoke["status"] == "completed" and last_smoke["calls"] > 0:
                    status = "healthy"
                elif last_smoke["status"] in {"failed", "cancelled"} or (
                    last_smoke["status"] == "completed" and last_smoke["calls"] == 0
                ):
                    status = "down"
                else:
                    status = "warning"
            elif last_run:
                if last_run["status"] == "completed" and last_run["calls"] > 0:
                    status = "healthy"
                elif last_run["status"] in {"running", "stalled"}:
                    status = "warning"
                elif last_run["status"] == "failed":
                    status = "down"
                else:
                    status = "warning"
            else:
                status = "untested"

            summaries.append(
                {
                    "id": station["id"],
                    "display": station["display"],
                    "title": station["title"],
                    "purpose": station["purpose"],
                    "model": station["model"],
                    "reasoningEffort": station.get("reasoningEffort"),
                    "family": station["family"],
                    "group": station["group"],
                    "status": status,
                    "lastRun": iso_time(last_run["startedAt"]) if last_run else None,
                    "lastSmoke": iso_time(last_smoke["startedAt"]) if last_smoke else None,
                    "runs": len(station_runs),
                    "successRate": (
                        round(successful / len(completed) * 100, 1) if completed else None
                    ),
                    "calls": sum(run["calls"] for run in station_runs),
                    "aiu": round(sum(run["aiu"] for run in station_runs), 3),
                    "averageTtftMs": rounded(
                        safe_average([run["averageTtftMs"] for run in station_runs]),
                        0,
                    ),
                }
            )
        return summaries

    def _model_summaries(
        self,
        roles: dict[str, Any],
        runs: list[dict[str, Any]],
        usage_by_model: dict[str, list[dict[str, Any]]],
        now: datetime,
    ) -> list[dict[str, Any]]:
        station_models: dict[str, list[str]] = defaultdict(list)
        for station in roles["stations"]:
            station_models[station["model"]].append(station["display"])

        all_models = set(station_models) | set(usage_by_model)
        selected_agent_ids = {
            run["agentId"] for run in runs if run.get("agentId")
        }
        selected_portal_session_ids = {
            str(run["usageSessionId"])
            for run in runs
            if run.get("mode") == "portal" and run.get("usageSessionId")
        }
        summaries = []
        for model in all_models:
            rows = [
                row
                for row in usage_by_model.get(model, [])
                if row.get("agent_id") in selected_agent_ids
                or str(row.get("session_id") or "") in selected_portal_session_ids
            ]
            calls = len(rows)
            completed = sum(bool(row.get("finish_reason")) for row in rows)
            last_call = parse_time(rows[-1].get("created_at")) if rows else None
            model_smokes = [
                run for run in runs
                if is_smoke_run(run) and run.get("model") == model
            ]
            model_smokes.sort(key=lambda run: run["startedAt"], reverse=True)
            last_smoke = model_smokes[0] if model_smokes else None
            assigned_stations = station_models.get(model, [])

            if last_smoke and (
                last_smoke["status"] in {"failed", "cancelled"}
                or (last_smoke["status"] == "completed" and last_smoke["calls"] == 0)
            ):
                status = "down"
                status_reason = (
                    "The latest smoke test failed or completed without a model "
                    "call. Run the smoke suite again; if it still fails, change "
                    "the affected station models."
                )
            elif (
                last_smoke
                and last_smoke["status"] == "completed"
                and last_smoke["calls"] > 0
            ):
                status = "healthy"
                status_reason = (
                    "The latest smoke test completed successfully. No action "
                    "is required."
                )
            elif last_smoke and last_smoke["status"] == "running":
                status = "running"
                status_reason = (
                    "A smoke test is running in the background. The dashboard "
                    "will update this row when it completes."
                )
            elif last_smoke and last_smoke["status"] == "stalled":
                status = "stalled"
                status_reason = (
                    "The smoke test has not reported activity recently. Check "
                    "the active run before starting another suite."
                )
            elif not assigned_stations:
                status = "unassigned"
                status_reason = (
                    "This model appears in historical activity but is not "
                    "assigned to a current fleet station. No action is required."
                )
            elif last_call and now - last_call <= timedelta(days=1):
                if completed / calls >= 0.95:
                    status = "healthy"
                    status_reason = (
                        "Recent model calls completed successfully within the "
                        "last 24 hours. No action is required."
                    )
                else:
                    status = "warning"
                    status_reason = (
                        "Fewer than 95% of recent model calls completed. Run the "
                        "smoke suite to confirm availability."
                    )
            elif last_call and now - last_call <= timedelta(days=7):
                status = "stale"
                status_reason = (
                    "The latest successful model activity is more than 24 hours "
                    "old. Run the smoke suite when you need fresh confirmation."
                )
            else:
                status = "untested"
                status_reason = (
                    "No recent model call or smoke-test evidence was found. Run "
                    "the smoke suite before relying on this model."
                )

            summaries.append(
                {
                    "model": model,
                    "status": status,
                    "statusReason": status_reason,
                    "lastCall": iso_time(last_call),
                    "calls": calls,
                    "completionRate": round(completed / calls * 100, 1) if calls else None,
                    "averageTtftMs": rounded(
                        safe_average(
                            [
                                row.get("output_ttft_ms")
                                if row.get("output_ttft_ms") is not None
                                else row.get("time_to_first_token_ms")
                                for row in rows
                            ]
                        ),
                        0,
                    ),
                    "averageDurationMs": rounded(
                        safe_average([row.get("duration_ms") for row in rows]),
                        0,
                    ),
                    "aiu": round(
                        sum((row.get("total_nano_aiu") or 0) for row in rows)
                        / 1_000_000_000,
                        3,
                    ),
                    "stations": station_models.get(model, []),
                }
            )
        summaries.sort(
            key=lambda item: (
                {
                    "down": 0,
                    "warning": 1,
                    "stalled": 2,
                    "running": 3,
                    "stale": 4,
                    "healthy": 5,
                    "untested": 6,
                    "unassigned": 7,
                }.get(
                    item["status"],
                    8,
                ),
                item["model"],
            )
        )
        return summaries

    def _project_summaries(
        self,
        sessions: list[dict[str, Any]],
        runs: list[dict[str, Any]],
        pr_attempts: list[dict[str, Any]],
        runs_by_agent_id: dict[str, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        repositories = {
            row.get("repository") or "Unknown project" for row in sessions
        } | {run["project"] for run in runs}
        summaries = []
        for repository in repositories:
            if not SAFE_REPOSITORY.fullmatch(repository):
                continue
            project_runs = [run for run in runs if run["project"] == repository]
            project_sessions = [
                row for row in sessions
                if (row.get("repository") or "Unknown project") == repository
            ]
            active_session_ids = {
                str(row["id"])
                for row in project_sessions
                if row.get("isRunning")
            } | {
                str(run["sessionId"])
                for run in project_runs
                if run["status"] in {"running", "stalled"}
            }
            active_branches = sorted(
                {
                    str(row.get("branch") or "")
                    for row in project_sessions
                    if row.get("isRunning") and row.get("branch")
                }
                | {
                    str(run.get("branch") or "")
                    for run in project_runs
                    if run["status"] in {"running", "stalled"}
                    and run.get("branch")
                }
            )
            latest = max(
                [
                    *(run["lastActivity"] for run in project_runs),
                    *(
                        parse_time(row.get("updated_at")) or datetime.min.replace(tzinfo=timezone.utc)
                        for row in project_sessions
                    ),
                ],
                default=None,
            )
            configured = any(
                Path(str(row.get("cwd") or "")).joinpath(
                    ".copilot",
                    "design-fleet.json",
                ).is_file()
                for row in project_sessions
            )
            herald_prs = sum(
                attempt.get("success")
                and attempt["repository"] == repository
                and runs_by_agent_id.get(attempt.get("agentId"), {}).get("stationId") == "herald"
                for attempt in pr_attempts
            )
            summaries.append(
                {
                    "repository": repository,
                    "runs": len(project_runs),
                    "calls": sum(run["calls"] for run in project_runs),
                    "aiu": round(sum(run["aiu"] for run in project_runs), 3),
                    "heraldPrs": int(herald_prs),
                    "activeSessions": len(active_session_ids),
                    "activeBranches": active_branches,
                    "lastActivity": iso_time(latest),
                    "configured": configured,
                }
            )
        summaries.sort(
            key=lambda item: item["lastActivity"] or "",
            reverse=True,
        )
        return summaries

    def _smoke_summary(self, runs: list[dict[str, Any]]) -> dict[str, Any] | None:
        smoke_runs = [run for run in runs if is_smoke_run(run)]
        if not smoke_runs:
            return None
        by_session: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for run in smoke_runs:
            by_session[run["sessionId"]].append(run)
        latest_batch = max(
            by_session.values(),
            key=lambda batch: max(run["startedAt"] for run in batch),
        )
        latest_by_station: dict[str, dict[str, Any]] = {}
        for run in latest_batch:
            current = latest_by_station.get(run["stationId"])
            if current is None or run["startedAt"] > current["startedAt"]:
                latest_by_station[run["stationId"]] = run
        latest_batch = list(latest_by_station.values())
        latest_batch.sort(key=lambda run: run["startedAt"])
        passed = sum(
            run["status"] == "completed" and run["calls"] > 0
            for run in latest_batch
        )
        failed = sum(
            run["status"] in {"failed", "cancelled"}
            or (run["status"] == "completed" and run["calls"] == 0)
            for run in latest_batch
        )
        return {
            "startedAt": iso_time(min(run["startedAt"] for run in latest_batch)),
            "project": latest_batch[0]["project"],
            "total": len(latest_batch),
            "passed": passed,
            "failed": failed,
            "unknown": len(latest_batch) - passed - failed,
            "stations": [
                {
                    "station": run["stationId"],
                    "model": run.get("model"),
                    "status": (
                        "healthy"
                        if run["status"] == "completed" and run["calls"] > 0
                        else "down"
                        if run["status"] in {"failed", "cancelled"}
                        or (run["status"] == "completed" and run["calls"] == 0)
                        else "warning"
                    ),
                    "calls": run["calls"],
                }
                for run in latest_batch
            ],
        }

    @staticmethod
    def _public_run(run: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": run["id"],
            "station": run["stationId"],
            "title": str(run["name"]),
            "description": str(run["description"]),
            "project": run["project"],
            "status": run["status"],
            "startedAt": iso_time(run["startedAt"]),
            "completedAt": iso_time(run["completedAt"]),
            "lastActivity": iso_time(run["lastActivity"]),
            "model": run.get("model"),
            "calls": run["calls"],
            "aiu": round(run["aiu"], 3),
            "prUrl": run.get("prUrl"),
        }

    def _handoff_summaries(
        self,
        runs: list[dict[str, Any]],
        sessions_by_id: dict[str, dict[str, Any]],
    ) -> list[dict[str, Any]]:
        by_session: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for run in runs:
            if not is_smoke_run(run):
                by_session[run["sessionId"]].append(run)

        handoffs = []
        for session_id, session_runs in by_session.items():
            session_runs.sort(key=lambda run: run["startedAt"])
            latest = session_runs[-1]
            if not SAFE_REPOSITORY.fullmatch(str(latest.get("project") or "")):
                continue
            session = sessions_by_id.get(session_id, {})
            title = (
                str(session.get("summary") or "").strip()
                or str(latest.get("name") or "").strip()
                or "Untitled fleet task"
            )
            pr_url = next(
                (
                    run.get("prUrl")
                    for run in reversed(session_runs)
                    if run.get("prUrl")
                ),
                None,
            )
            handoffs.append(
                {
                    "id": session_id,
                    "title": title,
                    "project": latest["project"],
                    "currentStation": latest["stationId"],
                    "status": latest["status"],
                    "updatedAt": iso_time(
                        max(run["lastActivity"] for run in session_runs)
                    ),
                    "credits": round(
                        sum(run.get("aiu", 0.0) for run in session_runs),
                        3,
                    ),
                    "prUrl": pr_url,
                    "history": [
                        {
                            "station": run["stationId"],
                            "title": str(run.get("name") or run["stationId"]),
                            "status": run["status"],
                            "model": run.get("model"),
                            "startedAt": iso_time(run["startedAt"]),
                            "completedAt": iso_time(run["completedAt"]),
                        }
                        for run in session_runs
                    ],
                }
            )
        handoffs.sort(key=lambda item: item["updatedAt"] or "", reverse=True)
        return handoffs[:60]
