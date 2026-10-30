"""Bind local dashboard data to one authenticated Copilot profile."""

from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any


IDENTITY = re.compile(r"^[a-z0-9.-]+/[a-z0-9_.-]+$")


def account_key(account: object) -> str | None:
    if not isinstance(account, dict):
        return None
    host = str(account.get("host") or "").lower()
    if host.startswith("https://"):
        host = host[8:].rstrip("/")
    login = str(account.get("login") or "").lower()
    key = f"{host}/{login}"
    return key if IDENTITY.fullmatch(key) else None


def profile_configuration(home: Path) -> dict[str, Any]:
    path = home / "config.json"
    if not path.is_file():
        return {}
    # Copilot's managed JSON file can start with whole-line comments.
    text = "\n".join(
        line for line in path.read_text(encoding="utf-8").splitlines()
        if not line.lstrip().startswith("//")
    )
    payload = json.loads(text)
    if not isinstance(payload, dict):
        raise ValueError("Copilot profile configuration must be an object")
    return payload


class AccountScope:
    def __init__(self, home: Path) -> None:
        self.home = home
        self.owner_path = home / "fleet-dashboard" / "account.json"

    def _write_owner(self, payload: dict[str, Any]) -> None:
        self.owner_path.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=self.owner_path.parent,
            prefix=".account-", suffix=".tmp", delete=False,
        ) as handle:
            temporary = Path(handle.name)
            try:
                json.dump(payload, handle)
                handle.write("\n")
                handle.flush()
                os.fsync(handle.fileno())
                os.replace(temporary, self.owner_path)
            finally:
                temporary.unlink(missing_ok=True)

    def installed_providers(self, identity: str) -> set[str]:
        config = profile_configuration(self.home)
        current = account_key(
            config.get("lastLoggedInUser") or config.get("last_logged_in_user")
        )
        users = config.get("loggedInUsers", config.get("logged_in_users", []))
        if not isinstance(users, list):
            raise ValueError("Copilot profile accounts must be an array")
        identities = {account_key(user) for user in users}
        owner = None
        if self.owner_path.exists():
            owner = json.loads(self.owner_path.read_text(encoding="utf-8"))
            if (
                not isinstance(owner, dict) or owner.get("schemaVersion") != 1
                or not isinstance(owner.get("account"), str)
                or not IDENTITY.fullmatch(owner["account"])
            ):
                raise ValueError("Invalid dashboard account ownership record")
            if owner.get("quarantined"):
                return set()
            if current and (current != owner["account"] or identities != {current}):
                self._write_owner({**owner, "quarantined": True})
                return set()
        # Shared histories do not contain reliable per-account attribution.
        # Never guess ownership from repository names or the active gh login.
        if not current or identities != {current}:
            return set()
        if owner is None:
            self._write_owner({"schemaVersion": 1, "account": current})
        if identity != current:
            return set()
        plugins = config.get("installedPlugins", config.get("installed_plugins", []))
        if not isinstance(plugins, list):
            raise ValueError("Copilot profile plugins must be an array")
        return {
            plugin["name"]
            for plugin in plugins
            if isinstance(plugin, dict)
            and isinstance(plugin.get("name"), str)
            and plugin.get("enabled") is True
        }


def empty_fleets() -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "defaultFleetId": None,
        "providers": [],
        "fleets": [],
        "providerErrors": [],
        "emptyReason": (
            "No fleet is installed for this active account in this Copilot profile. "
            "Use an account-specific Copilot profile with the fleet installed, "
            "or switch back to the account that owns this profile. "
            "Unattributed or shared account histories are not displayed."
        ),
    }


def scoped_fleets(snapshot: dict[str, Any], installed: set[str]) -> dict[str, Any]:
    fleets = [
        fleet for fleet in snapshot["fleets"] if fleet["providerId"] in installed
    ]
    if not fleets:
        return empty_fleets()
    available = {fleet["id"] for fleet in fleets if fleet["available"]}
    default = snapshot["defaultFleetId"]
    return {
        **snapshot,
        "fleets": fleets,
        "providers": [
            provider for provider in snapshot["providers"] if provider["id"] in installed
        ],
        "providerErrors": [],
        "defaultFleetId": default if default in available else min(available, default=None),
    }
