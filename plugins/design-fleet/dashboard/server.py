#!/usr/bin/env python3
"""Serve the local design-fleet dashboard and its read-only telemetry API."""

from __future__ import annotations

import argparse
import gzip
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from account_scope import AccountScope, account_key, empty_fleets, scoped_fleets
from fleet_registry import FleetProvider, FleetRegistry, ResolvedFleet
from telemetry import (
    TelemetryCollector,
    configured_repository,
    load_roles,
    read_json,
    read_rows,
)


DASHBOARD_ROOT = Path(__file__).resolve().parent
PLUGIN_ROOT = DASHBOARD_ROOT.parent
DIST_ROOT = DASHBOARD_ROOT / "dist"
COPILOT_HOME = Path(os.environ.get("COPILOT_HOME", Path.home() / ".copilot"))
COMMAND_LOG = COPILOT_HOME / "design-fleet" / "dashboard-commands.jsonl"
SAFE_HOST = re.compile(r"^[A-Za-z0-9.-]+$")
SAFE_REPOSITORY = re.compile(r"^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$")
SAFE_CREW = re.compile(r"^[a-z][a-z0-9-]{0,63}$")
SAFE_AGENT_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
SAFE_TASK_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
AUTH_JOBS: dict[str, dict[str, str]] = {}
AUTH_LOCK = threading.Lock()
COMMAND_JOBS: dict[str, dict[str, Any]] = {}
COMMAND_LOCK = threading.Lock()
COMMAND_LOG_LOCK = threading.Lock()
SMOKE_SUITE_JOBS: dict[str, dict[str, Any]] = {}
SMOKE_SUITE_LOCK = threading.Lock()
COLLECTORS: dict[Path, TelemetryCollector] = {}
_REGISTRY: FleetRegistry | None = None
ACCOUNT_LOCK = threading.RLock()


def active_github_account() -> str | None:
    process = subprocess.run(
        ["gh", "auth", "status", "--json", "hosts"],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    payload = json.loads(process.stdout)
    if not isinstance(payload, dict) or not isinstance(payload.get("hosts"), dict):
        raise ValueError("GitHub CLI returned invalid account status")
    identities = {
        account_key({**entry, "host": host})
        for host, entries in payload.get("hosts", {}).items()
        for entry in (entries if isinstance(entries, list) else [])
        if isinstance(entry, dict)
        and entry.get("active") and entry.get("state") == "success"
    }
    identities.discard(None)
    return next(iter(identities)) if len(identities) == 1 else None


def get_registry() -> FleetRegistry:
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = FleetRegistry(PLUGIN_ROOT, COPILOT_HOME)
    return _REGISTRY


def resolve_fleet(
    fleet_id: str | None,
    registry: FleetRegistry | None = None,
) -> ResolvedFleet:
    return (registry or get_registry()).resolve_fleet(fleet_id)


def provider_roles(provider: FleetProvider) -> dict[str, Any]:
    return load_roles(
        provider.root,
        station_manifest=provider.station_manifest,
        agents_directory=provider.agents_directory,
    )


def provider_user_crews(provider: FleetProvider) -> Path:
    return COPILOT_HOME / provider.id / "crews"


def json_bytes(payload: Any) -> bytes:
    return json.dumps(payload, ensure_ascii=True, separators=(",", ":")).encode("utf-8")


def append_command_event(payload: dict[str, Any]) -> None:
    COMMAND_LOG.parent.mkdir(parents=True, exist_ok=True)
    with COMMAND_LOG_LOCK:
        with COMMAND_LOG.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=True) + "\n")


def gh_auth_status() -> dict[str, Any]:
    if shutil.which("gh") is None:
        return {
            "available": False,
            "accounts": [],
            "error": "GitHub CLI is not installed",
        }
    try:
        process = subprocess.run(
            ["gh", "auth", "status", "--json", "hosts"],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return {"available": False, "accounts": [], "error": str(error)}

    raw = process.stdout.strip() or process.stderr.strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {
            "available": True,
            "accounts": [],
            "error": raw or "GitHub CLI returned no authentication status",
        }

    accounts = []
    hosts = parsed.get("hosts", {})
    if isinstance(hosts, dict):
        for hostname, entries in hosts.items():
            if not isinstance(entries, list):
                continue
            for entry in entries:
                if not isinstance(entry, dict):
                    continue
                active = bool(entry.get("active"))
                avatar_url = None
                display_name = None
                if active and entry.get("state") == "success":
                    try:
                        profile = subprocess.run(
                            ["gh", "api", "--hostname", hostname, "user"],
                            capture_output=True,
                            text=True,
                            timeout=20,
                            check=False,
                        )
                        if profile.returncode == 0:
                            profile_data = json.loads(profile.stdout)
                            if isinstance(profile_data, dict):
                                candidate = profile_data.get("avatar_url")
                                if isinstance(candidate, str) and candidate.startswith("https://"):
                                    avatar_url = candidate
                                candidate_name = profile_data.get("name")
                                if (
                                    isinstance(candidate_name, str)
                                    and candidate_name.strip()
                                ):
                                    display_name = candidate_name.strip()[:200]
                    except (OSError, subprocess.TimeoutExpired, json.JSONDecodeError):
                        avatar_url = None
                accounts.append(
                    {
                        "host": entry.get("host") or hostname,
                        "login": entry.get("login") or "",
                        "active": active,
                        "state": entry.get("state") or "unknown",
                        "scopes": entry.get("scopes") or "",
                        "name": display_name,
                        "avatarUrl": avatar_url,
                    }
                )
    return {"available": True, "accounts": accounts, "error": None}


def start_auth_job(hostname: str) -> dict[str, str]:
    with AUTH_LOCK:
        running_job = next(
            (
                job
                for job in AUTH_JOBS.values()
                if job["status"] == "running" and job.get("hostname") == hostname
            ),
            None,
        )
        if running_job is not None:
            return running_job
        completed = [
            existing_id
            for existing_id, job in AUTH_JOBS.items()
            if job["status"] != "running"
        ]
        for existing_id in completed[:-20]:
            AUTH_JOBS.pop(existing_id, None)
        if len(AUTH_JOBS) >= 32:
            raise RuntimeError(
                "Too many authentication attempts are still active; wait for one to finish"
            )
        job_id = str(uuid.uuid4())
        AUTH_JOBS[job_id] = {
            "id": job_id,
            "status": "running",
            "hostname": hostname,
            "message": f"Starting GitHub authentication for {hostname}...",
        }

    def run() -> None:
        output_lines: list[str] = []
        try:
            gh = shutil.which("gh")
            if gh is None:
                raise OSError("GitHub CLI is not installed")
            process = subprocess.Popen(
                [
                    gh,
                    "auth",
                    "login",
                    "--hostname",
                    hostname,
                    "--web",
                    "--clipboard",
                    "--git-protocol",
                    "https",
                    "--skip-ssh-key",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
            )
            if process.stdout is None:
                raise OSError("GitHub CLI did not provide authentication output")

            def read_output() -> None:
                for raw_line in process.stdout:
                    line = re.sub(r"\x1b\[[0-9;]*m", "", raw_line).strip()
                    if not line:
                        continue
                    output_lines.append(line)
                    message = "\n".join(output_lines[-8:])[-1_200:]
                    with AUTH_LOCK:
                        job = AUTH_JOBS.get(job_id)
                        if job is not None and job["status"] == "running":
                            job["message"] = message

            reader = threading.Thread(target=read_output, daemon=True)
            reader.start()
            timed_out = False
            try:
                returncode = process.wait(timeout=600)
            except subprocess.TimeoutExpired:
                timed_out = True
                process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    try:
                        process.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        pass
                returncode = (
                    process.returncode
                    if process.returncode is not None
                    else -1
                )
            reader.join(timeout=2)

            status = "completed" if returncode == 0 else "failed"
            output = "\n".join(output_lines[-8:])[-1_200:]
            message = (
                "GitHub authentication completed."
                if returncode == 0
                else (
                    "GitHub authentication timed out."
                    if timed_out
                    else output or "GitHub authentication failed."
                )
            )
        except OSError as error:
            status = "failed"
            message = str(error)
        with AUTH_LOCK:
            AUTH_JOBS[job_id].update(status=status, message=message)

    threading.Thread(target=run, daemon=True).start()
    return AUTH_JOBS[job_id]


def logout_account(hostname: str, login: str) -> dict[str, Any]:
    gh = shutil.which("gh")
    if gh is None:
        raise RuntimeError("GitHub CLI is not installed")
    try:
        process = subprocess.run(
            [
                gh,
                "auth",
                "logout",
                "--hostname",
                hostname,
                "--user",
                login,
            ],
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise RuntimeError(str(error)) from error
    if process.returncode != 0:
        raise ValueError(
            (process.stderr or process.stdout).strip()
            or "GitHub CLI could not sign out this account"
        )
    return gh_auth_status()


def project_directory(repository: str) -> Path | None:
    rows = read_rows(
        COPILOT_HOME / "session-store.db",
        """
        SELECT cwd, repository
        FROM sessions
        WHERE cwd IS NOT NULL AND cwd != ''
        ORDER BY updated_at DESC
        LIMIT 200
        """,
    )
    for row in rows:
        candidate = Path(str(row["cwd"])).expanduser().resolve()
        if (
            candidate.is_dir()
            and configured_repository(
                str(candidate),
                str(row.get("repository") or ""),
            ) == repository
        ):
            return candidate
    return None


def start_command_job(
    payload: dict[str, Any],
    registry: FleetRegistry | None = None,
) -> dict[str, Any]:
    fleet = resolve_fleet(str(payload.get("fleetId") or "") or None, registry)
    provider = fleet.provider
    if not provider.capabilities.command_launch:
        raise ValueError(
            f"{provider.display_name} does not support launching agents from the dashboard"
        )
    if payload.get("confirmed") is not True:
        raise ValueError("Confirm the command permission before running an agent")
    prompt = str(payload.get("prompt") or "").strip()
    if not prompt or len(prompt) > 8_000:
        raise ValueError("Prompt is required and must be 8,000 characters or fewer")
    repository = str(payload.get("project") or "")
    if not SAFE_REPOSITORY.fullmatch(repository):
        raise ValueError("Select a valid project")
    task_id = str(payload.get("taskId") or "").strip()
    if task_id and not SAFE_TASK_ID.fullmatch(task_id):
        raise ValueError("Select a valid board task")
    kind = str(payload.get("kind") or "command")
    if kind not in {"command", "smoke"}:
        raise ValueError("Select a valid command type")
    station_id = str(payload.get("station") or "")
    roles = provider_roles(provider)
    station = next(
        (role for role in roles["stations"] if role["id"] == station_id),
        None,
    )
    if station is None:
        raise ValueError("Select a valid fleet agent")
    model = str(payload.get("model") or station["model"])
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,79}", model):
        raise ValueError("Select a valid model")
    try:
        max_credits = float(payload.get("maxCredits", 30))
    except (TypeError, ValueError) as error:
        raise ValueError("AI credit limit must be a number") from error
    if not 30 <= max_credits <= 1_000:
        raise ValueError("AI credit limit must be between 30 and 1,000")
    directory = project_directory(repository)
    if directory is None:
        raise ValueError("No local checkout was found for the selected project")
    copilot = shutil.which("copilot")
    if copilot is None:
        raise ValueError("GitHub Copilot CLI is not installed")

    job_id = str(uuid.uuid4())
    with COMMAND_LOCK:
        finished = [
            existing_id
            for existing_id, job in COMMAND_JOBS.items()
            if job["status"] != "running"
        ]
        for existing_id in finished[:-30]:
            COMMAND_JOBS.pop(existing_id, None)
        running = sum(
            job["status"] == "running" and job["fleetId"] == fleet.id
            for job in COMMAND_JOBS.values()
        )
        if running >= 4:
            raise RuntimeError("Four agent commands are already running for this fleet")
        COMMAND_JOBS[job_id] = {
            "id": job_id,
            "fleetId": fleet.id,
            "providerId": provider.id,
            "status": "running",
            "station": station_id,
            "agent": station["display"],
            "project": repository,
            "model": model,
            "maxCredits": max_credits,
            "taskId": task_id or None,
            "kind": kind,
            "message": "Agent command started.",
            "output": "",
        }
    started_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    append_command_event(
        {
            "version": 1,
            "jobId": job_id,
            "fleetId": fleet.id,
            "providerId": provider.id,
            "station": station_id,
            "agent": station["display"],
            "project": repository,
            "model": model,
            "maxCredits": max_credits,
            "taskId": task_id or None,
            "kind": kind,
            "status": "running",
            "startedAt": started_at,
            "updatedAt": started_at,
        }
    )

    command = [
        copilot,
        "-p",
        prompt,
        "--agent",
        f"{provider.agent_namespace}:{station['display']}",
        "--model",
        model,
        "--session-id",
        job_id,
        "--name",
        (
            f"Fleet {station['display']} smoke test"
            if kind == "smoke"
            else f"Fleet {station['display']} command"
        ),
        "-C",
        str(directory),
        "--plugin-dir",
        str(provider.root),
        *(
            ["--available-tools=", "--disable-builtin-mcps"]
            if kind == "smoke"
            else ["--allow-all-tools"]
        ),
        "--max-ai-credits",
        str(max_credits),
        "--no-ask-user",
        "--sync-session=off",
        "--silent",
    ]

    def run() -> None:
        try:
            process = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=1_800,
                check=False,
            )
            output = (process.stdout or process.stderr).strip()
            output = re.sub(r"\x1b\[[0-9;]*m", "", output)[-8_000:]
            status = "completed" if process.returncode == 0 else "failed"
            if process.returncode == 0:
                message = "Agent command completed."
            else:
                message = next(
                    (
                        line.strip()
                        for line in reversed(output.splitlines())
                        if line.strip()
                    ),
                    f"Agent command exited with status {process.returncode}.",
                )[:600]
        except subprocess.TimeoutExpired:
            status = "failed"
            message = "Agent command exceeded the 30-minute timeout."
            output = ""
        except OSError as error:
            status = "failed"
            message = str(error)
            output = ""
        with COMMAND_LOCK:
            COMMAND_JOBS[job_id].update(
                {
                    "status": status,
                    "message": message,
                    "output": output,
                }
            )
        completed_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        append_command_event(
            {
                "version": 1,
                "jobId": job_id,
                "fleetId": fleet.id,
                "providerId": provider.id,
                "station": station_id,
                "agent": station["display"],
                "project": repository,
                "model": model,
                "maxCredits": max_credits,
                "taskId": task_id or None,
                "kind": kind,
                "status": status,
                "completedAt": completed_at,
                "updatedAt": completed_at,
            }
        )

    threading.Thread(target=run, daemon=True).start()
    return COMMAND_JOBS[job_id]


def start_smoke_suite(
    payload: dict[str, Any],
    registry: FleetRegistry | None = None,
) -> dict[str, Any]:
    fleet = resolve_fleet(str(payload.get("fleetId") or "") or None, registry)
    provider = fleet.provider
    if not provider.capabilities.smoke_suite:
        raise ValueError(
            f"{provider.display_name} does not support model smoke suites"
        )
    if not provider.capabilities.command_launch:
        raise ValueError(
            f"{provider.display_name} cannot run smoke suites because command launching is disabled"
        )
    if payload.get("confirmed") is not True:
        raise ValueError("Confirm the smoke-suite permission before running")
    repository = str(payload.get("project") or "")
    if not SAFE_REPOSITORY.fullmatch(repository):
        raise ValueError("Select a valid project")
    if project_directory(repository) is None:
        raise ValueError("No local checkout was found for the selected project")
    if shutil.which("copilot") is None:
        raise ValueError("GitHub Copilot CLI is not installed")

    roles = provider_roles(provider)
    seen_models: set[str] = set()
    targets = []
    for station in roles["stations"]:
        model = str(station["model"])
        if model in seen_models:
            continue
        seen_models.add(model)
        targets.append(
            {
                "station": station["id"],
                "agent": station["display"],
                "model": model,
                "status": "pending",
                "message": "Waiting",
                "commandJobId": None,
            }
        )
    if not targets:
        raise ValueError("No configured fleet models were found")

    suite_id = str(uuid.uuid4())
    with SMOKE_SUITE_LOCK:
        if any(
            job["status"] == "running" and job["fleetId"] == fleet.id
            for job in SMOKE_SUITE_JOBS.values()
        ):
            raise RuntimeError("A model smoke suite is already running for this fleet")
        finished = [
            existing_id
            for existing_id, job in SMOKE_SUITE_JOBS.items()
            if job["status"] != "running"
        ]
        for existing_id in finished[:-10]:
            SMOKE_SUITE_JOBS.pop(existing_id, None)
        SMOKE_SUITE_JOBS[suite_id] = {
            "id": suite_id,
            "fleetId": fleet.id,
            "providerId": provider.id,
            "status": "running",
            "project": repository,
            "total": len(targets),
            "completed": 0,
            "failed": 0,
            "maxCreditsPerModel": 30,
            "message": "Model smoke suite started.",
            "targets": targets,
        }

    def run() -> None:
        for index, target in enumerate(targets):
            with SMOKE_SUITE_LOCK:
                suite_target = SMOKE_SUITE_JOBS[suite_id]["targets"][index]
                suite_target["status"] = "running"
                suite_target["message"] = "Running smoke test"
            try:
                command_job = start_command_job(
                    {
                        "fleetId": fleet.id,
                        "project": repository,
                        "station": target["station"],
                        "model": target["model"],
                        "prompt": (
                            "Smoke test only. Do not inspect files, call tools, "
                            "or modify anything. Reply with exactly: SMOKE_OK "
                            f"{target['model']}."
                        ),
                        "maxCredits": 30,
                        "confirmed": True,
                        "kind": "smoke",
                    },
                    registry,
                )
                command_job_id = str(command_job["id"])
                with SMOKE_SUITE_LOCK:
                    SMOKE_SUITE_JOBS[suite_id]["targets"][index][
                        "commandJobId"
                    ] = command_job_id
                while True:
                    with COMMAND_LOCK:
                        current = COMMAND_JOBS.get(command_job_id)
                        current_status = (
                            str(current["status"]) if current else "failed"
                        )
                        current_message = (
                            str(current["message"])
                            if current
                            else "Smoke-test command disappeared."
                        )
                    if current_status != "running":
                        break
                    time.sleep(0.5)
            except (ValueError, RuntimeError) as error:
                current_status = "failed"
                current_message = str(error)

            with SMOKE_SUITE_LOCK:
                suite = SMOKE_SUITE_JOBS[suite_id]
                suite_target = suite["targets"][index]
                suite_target["status"] = current_status
                suite_target["message"] = current_message
                if current_status == "completed":
                    suite["completed"] += 1
                else:
                    suite["failed"] += 1
                finished_count = suite["completed"] + suite["failed"]
                suite["message"] = (
                    f"Tested {finished_count} of {suite['total']} configured models."
                )

        with SMOKE_SUITE_LOCK:
            suite = SMOKE_SUITE_JOBS[suite_id]
            suite["status"] = "failed" if suite["failed"] else "completed"
            suite["message"] = (
                f"Smoke suite finished with {suite['failed']} failures."
                if suite["failed"]
                else "All configured model smoke tests completed."
            )

    threading.Thread(target=run, daemon=True).start()
    with SMOKE_SUITE_LOCK:
        return json.loads(json.dumps(SMOKE_SUITE_JOBS[suite_id]))


def current_smoke_suite(fleet_id: str) -> dict[str, Any] | None:
    with SMOKE_SUITE_LOCK:
        fleet_jobs = [
            job for job in SMOKE_SUITE_JOBS.values() if job["fleetId"] == fleet_id
        ]
        if not fleet_jobs:
            return None
        running = [
            job for job in fleet_jobs if job["status"] == "running"
        ]
        job = running[-1] if running else fleet_jobs[-1]
        return json.loads(json.dumps(job))


def list_crews(
    fleet_id: str | None = None,
    registry: FleetRegistry | None = None,
) -> dict[str, Any]:
    fleet = resolve_fleet(fleet_id, registry)
    provider = fleet.provider
    roles = provider_roles(provider)
    available_models = {
        station["model"] for station in roles["stations"]
    }
    available_models.update(
        str(row["model"])
        for row in read_rows(
            COPILOT_HOME / "session-store.db",
            """
            SELECT DISTINCT model
            FROM assistant_usage_events
            WHERE model IS NOT NULL AND model != ''
            ORDER BY model
            """,
        )
    )
    paths: list[tuple[Path, bool]] = [
        (path, False)
        for path in sorted(provider.crews_directory.glob("*.json"))
        if path.resolve() != provider.station_manifest
    ]
    user_crews = provider_user_crews(provider)
    if user_crews.is_dir():
        paths.extend((path, True) for path in sorted(user_crews.glob("*.json")))

    crews = []
    seen = set()
    for path, yours in reversed(paths):
        crew = read_json(path)
        if not crew or not isinstance(crew.get("names"), dict):
            continue
        name = str(crew.get("name") or path.stem)
        if name in seen:
            continue
        seen.add(name)
        crews.append(
            {
                "name": name,
                "label": str(crew.get("label") or name),
                "yours": yours,
                "names": crew["names"],
                "models": crew.get("models", {}),
            }
        )
    crews.sort(key=lambda crew: (not crew["yours"], crew["label"].lower()))
    return {
        "roles": [
            {
                "id": station["id"],
                "display": station["display"],
                "model": station["model"],
                "title": station["title"],
            }
            for station in roles["stations"]
        ],
        "crews": crews,
        "availableModels": sorted(available_models),
    }


def save_crew(
    payload: dict[str, Any],
    registry: FleetRegistry | None = None,
) -> dict[str, str]:
    fleet = resolve_fleet(str(payload.get("fleetId") or "") or None, registry)
    provider = fleet.provider
    if not provider.capabilities.crew_management:
        raise ValueError(
            f"{provider.display_name} does not support crew management"
        )
    if provider.entrypoint is None:
        raise ValueError(f"{provider.display_name} has no crew-management entrypoint")
    roles = provider_roles(provider)
    role_ids = [station["id"] for station in roles["stations"]]
    role_models = {station["id"]: station["model"] for station in roles["stations"]}
    name = str(payload.get("name") or "")
    label = str(payload.get("label") or "").strip()
    names = payload.get("names")
    models = payload.get("models", {})
    install = bool(payload.get("install"))

    if not SAFE_CREW.fullmatch(name):
        raise ValueError("Crew id must use lowercase letters, digits, and hyphens")
    if not label or len(label) > 80:
        raise ValueError("Crew label is required and must be 80 characters or fewer")
    if not isinstance(names, dict) or set(names) != set(role_ids):
        raise ValueError("Every station must have exactly one name")
    if not isinstance(models, dict) or set(models) - set(role_ids):
        raise ValueError("Model overrides must name existing stations")
    for station_id, display in names.items():
        if not isinstance(display, str) or not SAFE_AGENT_NAME.fullmatch(display):
            raise ValueError(
                f"Invalid name for {station_id}; use letters, digits, dots, hyphens, or underscores"
            )
    for station_id, model in models.items():
        if (
            not isinstance(model, str)
            or not model
            or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,79}", model)
        ):
            raise ValueError(f"Invalid model id for {station_id}")
    if (
        not provider.capabilities.model_overrides
        and any(model != role_models[station_id] for station_id, model in models.items())
    ):
        raise ValueError(
            f"{provider.display_name} does not support station model overrides"
        )
    model_overrides = {
        station_id: model
        for station_id, model in models.items()
        if model != role_models[station_id]
    }

    command = [
        sys.executable,
        str(provider.entrypoint),
        "new-crew",
        "--name",
        name,
        "--label",
        label,
        "--force",
    ]
    for station_id in role_ids:
        command.extend(["--set", f"{station_id}={names[station_id]}"])
    for station_id, model in model_overrides.items():
        command.extend(["--model", f"{station_id}={model}"])
    created = subprocess.run(
        command,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    if created.returncode != 0:
        raise ValueError((created.stderr or created.stdout).strip())

    output = created.stdout.strip()
    if install:
        applied = subprocess.run(
            [
                sys.executable,
                str(provider.entrypoint),
                "apply",
                "--crew",
                name,
                "--scope",
                "user",
            ],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
        output = f"{output}\n\n{(applied.stdout or applied.stderr).strip()}".strip()
        if applied.returncode != 0:
            raise ValueError(output)

    return {
        "message": (
            f"Saved and installed crew '{label}'."
            if install
            else f"Saved crew '{label}'."
        ),
        "output": output,
    }


class DashboardHandler(BaseHTTPRequestHandler):
    registry: FleetRegistry | None = None
    collectors: dict[Path, TelemetryCollector] = COLLECTORS

    def authorize_account(
        self, path: str, fleet_id: str | None = None, provider_id: str | None = None,
    ) -> bool:
        if path == "/api/health" or path.startswith("/api/auth/"):
            return True
        try:
            identity = active_github_account()
            if not identity:
                self.send_error_json(
                    "A single active signed-in GitHub account is required",
                    HTTPStatus.UNAUTHORIZED,
                )
                return False
            if self.headers.get("X-Design-Fleet-Account") != identity:
                self.send_error_json(
                    "The active GitHub account changed. Reload account context.",
                    HTTPStatus.CONFLICT,
                )
                return False
            try:
                installed = AccountScope(COPILOT_HOME).installed_providers(identity)
            except (OSError, ValueError) as error:
                self.log_message("Account profile unavailable: %s", error)
                self.send_error_json(
                    "Unable to verify ownership of this Copilot profile.",
                    HTTPStatus.SERVICE_UNAVAILABLE,
                )
                return False
            self.account_installations = installed
            if path == "/api/fleets" and self.command == "GET":
                snapshot = (
                    scoped_fleets(self.fleet_registry().snapshot(), installed)
                    if installed else empty_fleets()
                )
                self.send_json(snapshot)
                return False
            if not installed:
                self.send_error_json(
                    "No fleet is installed for the active account in this profile",
                    HTTPStatus.FORBIDDEN,
                )
                return False
            if provider_id and provider_id not in self.fleet_registry().providers:
                raise ValueError("Select an available fleet provider")
            selected_provider = provider_id or resolve_fleet(
                fleet_id, self.fleet_registry()
            ).provider.id
            if selected_provider not in installed:
                self.send_error_json(
                    "This fleet is not installed for the active account",
                    HTTPStatus.FORBIDDEN,
                )
                return False
        except ValueError as error:
            self.send_error_json(str(error), HTTPStatus.BAD_REQUEST)
            return False
        except (OSError, subprocess.TimeoutExpired) as error:
            self.send_error_json(str(error), HTTPStatus.SERVICE_UNAVAILABLE)
            return False
        return True

    def fleet_registry(self) -> FleetRegistry:
        return self.registry or get_registry()

    def collector_for(self, provider: FleetProvider) -> TelemetryCollector:
        root = provider.root.resolve()
        collector = self.collectors.get(root)
        if collector is None:
            collector = TelemetryCollector(
                provider.root,
                COPILOT_HOME,
                provider_id=provider.id,
                agent_namespace=provider.agent_namespace,
                station_manifest=provider.station_manifest,
                agents_directory=provider.agents_directory,
                crews_directory=provider.crews_directory,
            )
            self.collectors[root] = collector
        return collector

    def log_message(self, format: str, *args: Any) -> None:
        sys.stdout.write(f"[dashboard] {format % args}\n")

    def send_json(self, payload: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, message: str, status: HTTPStatus) -> None:
        self.send_json({"error": message}, status)

    def require_dashboard_header(self) -> bool:
        if self.headers.get("X-Design-Fleet-Dashboard") != "1":
            self.send_error_json("Dashboard request header required", HTTPStatus.FORBIDDEN)
            return False
        return True

    def read_payload(self) -> dict[str, Any] | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error_json("Invalid content length", HTTPStatus.BAD_REQUEST)
            return None
        if length <= 0 or length > 100_000:
            self.send_error_json("Invalid request body", HTTPStatus.BAD_REQUEST)
            return None
        try:
            payload = json.loads(self.rfile.read(length))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_error_json("Request body must be valid JSON", HTTPStatus.BAD_REQUEST)
            return None
        if not isinstance(payload, dict):
            self.send_error_json("Request body must be an object", HTTPStatus.BAD_REQUEST)
            return None
        return payload

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            if not self.require_dashboard_header():
                return
            query = parse_qs(parsed.query)
            with ACCOUNT_LOCK:
                if self.authorize_account(parsed.path, query.get("fleet", [""])[0] or None):
                    self.handle_api_get(parsed.path, query)
            return
        self.serve_static(parsed.path)

    def do_HEAD(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/api/"):
            self.send_response(HTTPStatus.METHOD_NOT_ALLOWED)
            self.send_header("Allow", "GET, POST")
            self.end_headers()
            return
        self.serve_static(parsed.path, head_only=True)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            self.send_error_json("Not found", HTTPStatus.NOT_FOUND)
            return
        if not self.require_dashboard_header():
            return
        payload = self.read_payload()
        if payload is None:
            return
        with ACCOUNT_LOCK:
            fleet_id = payload.get("fleetId")
            if parsed.path in {"/api/fleets/rename", "/api/fleets/delete"}:
                fleet_id = payload.get("id")
            if self.authorize_account(
                parsed.path,
                str(fleet_id) if fleet_id else None,
                str(payload.get("providerId") or "") or None,
            ):
                self.handle_api_post(parsed.path, payload)

    def handle_api_get(self, path: str, query: dict[str, list[str]]) -> None:
        if path == "/api/health":
            self.send_json({"status": "ok"})
            return
        if path == "/api/fleets":
            self.send_json(scoped_fleets(
                self.fleet_registry().snapshot(), self.account_installations,
            ))
            return
        if path == "/api/dashboard":
            try:
                days = int(query.get("days", ["7"])[0])
            except ValueError:
                self.send_error_json("days must be a number", HTTPStatus.BAD_REQUEST)
                return
            project = query.get("project", ["all"])[0]
            fleet_id = query.get("fleet", [""])[0] or None
            if project != "all" and not SAFE_REPOSITORY.fullmatch(project):
                self.send_error_json("Invalid project", HTTPStatus.BAD_REQUEST)
                return
            try:
                fleet = resolve_fleet(fleet_id, self.fleet_registry())
                if not fleet.provider.capabilities.telemetry:
                    raise ValueError(
                        f"{fleet.provider.display_name} does not support dashboard telemetry"
                    )
                result = self.collector_for(fleet.provider).collect(
                    days=days,
                    project=project,
                    fleet_id=fleet.id,
                )
                result["fleetId"] = fleet.id
                result["providerId"] = fleet.provider.id
                result["sources"]["githubCli"] = shutil.which("gh") is not None
                self.send_json(result)
            except ValueError as error:
                self.send_error_json(str(error), HTTPStatus.BAD_REQUEST)
            except RuntimeError as error:
                self.send_error_json(str(error), HTTPStatus.INTERNAL_SERVER_ERROR)
            return
        if path == "/api/auth/status":
            self.send_json(gh_auth_status())
            return
        if path == "/api/auth/job":
            job_id = query.get("id", [""])[0]
            with AUTH_LOCK:
                job = AUTH_JOBS.get(job_id)
            if not job:
                self.send_error_json("Authentication job not found", HTTPStatus.NOT_FOUND)
                return
            self.send_json(job)
            return
        if path == "/api/crews":
            try:
                fleet_id = query.get("fleet", [""])[0] or None
                self.send_json(list_crews(fleet_id, self.fleet_registry()))
            except ValueError as error:
                self.send_error_json(str(error), HTTPStatus.BAD_REQUEST)
            return
        if path == "/api/commands/job":
            job_id = query.get("id", [""])[0]
            try:
                fleet = resolve_fleet(
                    query.get("fleet", [""])[0] or None,
                    self.fleet_registry(),
                )
            except ValueError as error:
                self.send_error_json(str(error), HTTPStatus.BAD_REQUEST)
                return
            with COMMAND_LOCK:
                job = COMMAND_JOBS.get(job_id)
            if not job or job["fleetId"] != fleet.id:
                self.send_error_json("Command job not found", HTTPStatus.NOT_FOUND)
                return
            self.send_json(job)
            return
        if path == "/api/smoke-suite/current":
            try:
                fleet = resolve_fleet(
                    query.get("fleet", [""])[0] or None,
                    self.fleet_registry(),
                )
            except ValueError as error:
                self.send_error_json(str(error), HTTPStatus.BAD_REQUEST)
                return
            self.send_json({"job": current_smoke_suite(fleet.id)})
            return
        if path == "/api/smoke-suite/job":
            job_id = query.get("id", [""])[0]
            try:
                fleet = resolve_fleet(
                    query.get("fleet", [""])[0] or None,
                    self.fleet_registry(),
                )
            except ValueError as error:
                self.send_error_json(str(error), HTTPStatus.BAD_REQUEST)
                return
            with SMOKE_SUITE_LOCK:
                job = SMOKE_SUITE_JOBS.get(job_id)
                snapshot = (
                    json.loads(json.dumps(job))
                    if job and job["fleetId"] == fleet.id
                    else None
                )
            if not snapshot:
                self.send_error_json("Smoke suite not found", HTTPStatus.NOT_FOUND)
                return
            self.send_json(snapshot)
            return
        self.send_error_json("Not found", HTTPStatus.NOT_FOUND)

    def handle_api_post(self, path: str, payload: dict[str, Any]) -> None:
        if path in {"/api/auth/switch", "/api/auth/logout"}:
            with COMMAND_LOCK, SMOKE_SUITE_LOCK:
                running = any(
                    job.get("status") == "running"
                    for job in [*COMMAND_JOBS.values(), *SMOKE_SUITE_JOBS.values()]
                )
            if running:
                self.send_error_json(
                    "Wait for dashboard-launched jobs to finish before changing accounts.",
                    HTTPStatus.CONFLICT,
                )
                return
        if path == "/api/fleets":
            try:
                fleet = self.fleet_registry().create_fleet(
                    name=str(payload.get("name") or ""),
                    provider_id=str(payload.get("providerId") or ""),
                    fleet_id=(
                        str(payload["id"])
                        if payload.get("id") is not None
                        else None
                    ),
                )
            except (ValueError, OSError) as error:
                self.send_error_json(str(error), HTTPStatus.BAD_REQUEST)
                return
            self.send_json(fleet, HTTPStatus.CREATED)
            return
        if path == "/api/fleets/rename":
            try:
                fleet = self.fleet_registry().rename_fleet(
                    fleet_id=str(payload.get("id") or ""),
                    name=str(payload.get("name") or ""),
                )
            except (ValueError, OSError) as error:
                self.send_error_json(str(error), HTTPStatus.BAD_REQUEST)
                return
            self.send_json(fleet)
            return
        if path == "/api/fleets/delete":
            try:
                self.fleet_registry().delete_fleet(
                    fleet_id=str(payload.get("id") or ""),
                )
            except (ValueError, OSError) as error:
                self.send_error_json(str(error), HTTPStatus.BAD_REQUEST)
                return
            self.send_json(scoped_fleets(
                self.fleet_registry().snapshot(), self.account_installations,
            ))
            return
        if path == "/api/auth/login":
            hostname = str(payload.get("hostname") or "github.com").strip().lower()
            if not SAFE_HOST.fullmatch(hostname) or ".." in hostname:
                self.send_error_json("Invalid GitHub hostname", HTTPStatus.BAD_REQUEST)
                return
            try:
                job = start_auth_job(hostname)
            except RuntimeError as error:
                self.send_error_json(str(error), HTTPStatus.TOO_MANY_REQUESTS)
                return
            self.send_json(job, HTTPStatus.ACCEPTED)
            return
        if path == "/api/auth/switch":
            hostname = str(payload.get("hostname") or "").strip().lower()
            login = str(payload.get("login") or "").strip()
            if (
                not SAFE_HOST.fullmatch(hostname)
                or not SAFE_AGENT_NAME.fullmatch(login)
                or ".." in hostname
            ):
                self.send_error_json("Invalid account", HTTPStatus.BAD_REQUEST)
                return
            try:
                process = subprocess.run(
                    [
                        "gh",
                        "auth",
                        "switch",
                        "--hostname",
                        hostname,
                        "--user",
                        login,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=30,
                    check=False,
                )
            except (OSError, subprocess.TimeoutExpired) as error:
                self.send_error_json(str(error), HTTPStatus.INTERNAL_SERVER_ERROR)
                return
            if process.returncode != 0:
                self.send_error_json(
                    (process.stderr or process.stdout).strip(),
                    HTTPStatus.BAD_REQUEST,
                )
                return
            self.send_json(gh_auth_status())
            return
        if path == "/api/auth/logout":
            hostname = str(payload.get("hostname") or "").strip().lower()
            login = str(payload.get("login") or "").strip()
            if (
                not SAFE_HOST.fullmatch(hostname)
                or not SAFE_AGENT_NAME.fullmatch(login)
                or ".." in hostname
            ):
                self.send_error_json("Invalid account", HTTPStatus.BAD_REQUEST)
                return
            try:
                self.send_json(logout_account(hostname, login))
            except ValueError as error:
                self.send_error_json(str(error), HTTPStatus.BAD_REQUEST)
            except RuntimeError as error:
                self.send_error_json(
                    str(error),
                    HTTPStatus.INTERNAL_SERVER_ERROR,
                )
            return
        if path == "/api/crews":
            try:
                self.send_json(save_crew(payload, self.fleet_registry()))
            except (ValueError, OSError, subprocess.TimeoutExpired) as error:
                self.send_error_json(str(error), HTTPStatus.BAD_REQUEST)
            return
        if path == "/api/commands":
            try:
                job = start_command_job(payload, self.fleet_registry())
            except ValueError as error:
                self.send_error_json(str(error), HTTPStatus.BAD_REQUEST)
                return
            except RuntimeError as error:
                self.send_error_json(str(error), HTTPStatus.TOO_MANY_REQUESTS)
                return
            self.send_json(job, HTTPStatus.ACCEPTED)
            return
        if path == "/api/smoke-suite":
            try:
                job = start_smoke_suite(payload, self.fleet_registry())
            except ValueError as error:
                self.send_error_json(str(error), HTTPStatus.BAD_REQUEST)
                return
            except RuntimeError as error:
                self.send_error_json(str(error), HTTPStatus.TOO_MANY_REQUESTS)
                return
            self.send_json(job, HTTPStatus.ACCEPTED)
            return
        self.send_error_json("Not found", HTTPStatus.NOT_FOUND)

    def serve_static(self, request_path: str, head_only: bool = False) -> None:
        if not DIST_ROOT.is_dir():
            self.send_error_json(
                "Dashboard is not built. Run pnpm build in plugins/design-fleet/dashboard.",
                HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return
        relative = unquote(request_path).lstrip("/") or "index.html"
        candidate = (DIST_ROOT / relative).resolve()
        root = DIST_ROOT.resolve()
        if candidate != root and root not in candidate.parents:
            self.send_error_json("Forbidden", HTTPStatus.FORBIDDEN)
            return
        if not candidate.is_file():
            candidate = DIST_ROOT / "index.html"
        try:
            body = candidate.read_bytes()
        except OSError:
            self.send_error_json("Not found", HTTPStatus.NOT_FOUND)
            return
        content_type = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".ico": "image/x-icon",
            ".json": "application/json; charset=utf-8",
        }.get(candidate.suffix, "application/octet-stream")
        relative_candidate = candidate.relative_to(root)
        cache_control = (
            "public, max-age=31536000, immutable"
            if relative_candidate.parts[0] == "assets"
            else "no-cache"
        )
        accepts_gzip = "gzip" in self.headers.get("Accept-Encoding", "").lower()
        compressible = candidate.suffix in {".html", ".js", ".css", ".svg", ".json"}
        compressed = accepts_gzip and compressible and len(body) >= 1_024
        response_body = gzip.compress(body, compresslevel=5, mtime=0) if compressed else body
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(response_body)))
        self.send_header("Cache-Control", cache_control)
        if compressed:
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: https:; font-src 'self'; frame-ancestors 'none'")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()
        if not head_only:
            self.wfile.write(response_body)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8100)
    parser.add_argument("--no-open", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    registry = FleetRegistry(PLUGIN_ROOT, COPILOT_HOME)
    default_fleet = registry.resolve_fleet()
    collector = TelemetryCollector(
        default_fleet.provider.root,
        COPILOT_HOME,
        provider_id=default_fleet.provider.id,
        agent_namespace=default_fleet.provider.agent_namespace,
        station_manifest=default_fleet.provider.station_manifest,
        agents_directory=default_fleet.provider.agents_directory,
        crews_directory=default_fleet.provider.crews_directory,
    )
    if args.self_test:
        payload = collector.collect(days=7, fleet_id=default_fleet.id)
        print(
            json.dumps(
                {
                    "stations": len(payload["stations"]),
                    "projects": len(payload["projects"]),
                    "runs": payload["summary"]["totalRuns"],
                    "sources": payload["sources"],
                },
                indent=2,
            )
        )
        return
    if not 1024 <= args.port <= 65535:
        sys.exit("error: port must be between 1024 and 65535")
    if not DIST_ROOT.is_dir():
        sys.exit(
            f"error: dashboard build missing at {DIST_ROOT}\n"
            f"       Run: npm --prefix {DASHBOARD_ROOT} run build"
        )

    DashboardHandler.registry = registry
    DashboardHandler.collectors = {default_fleet.provider.root: collector}
    server = ThreadingHTTPServer(("127.0.0.1", args.port), DashboardHandler)
    url = f"http://127.0.0.1:{args.port}"
    print(f"Design Fleet Dashboard listening on {url}")
    print("Press Ctrl+C to stop.")
    if not args.no_open:
        threading.Timer(0.4, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping dashboard.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
