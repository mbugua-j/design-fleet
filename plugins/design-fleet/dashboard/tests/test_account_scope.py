from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from account_scope import AccountScope, account_key


class AccountScopeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.scope = AccountScope(self.home)
        self.config = {
            "lastLoggedInUser": {"host": "https://github.com", "login": "Work"},
            "loggedInUsers": [{"host": "https://github.com", "login": "Work"}],
            "installedPlugins": [
                {"name": "design-fleet", "enabled": True},
                {"name": "disabled-fleet", "enabled": False},
            ],
        }
        self.save()

    def save(self) -> None:
        (self.home / "config.json").write_text(
            "// Managed profile\n" + json.dumps(self.config), encoding="utf-8",
        )

    def test_only_the_profile_owner_receives_enabled_installations(self) -> None:
        self.assertEqual(
            self.scope.installed_providers("github.com/work"), {"design-fleet"}
        )
        self.assertEqual(self.scope.installed_providers("github.com/personal"), set())
        self.assertEqual(self.scope.installed_providers("ghe.example/work"), set())

    def test_first_visitor_does_not_claim_profile(self) -> None:
        self.assertEqual(self.scope.installed_providers("github.com/personal"), set())
        self.assertEqual(
            json.loads(self.scope.owner_path.read_text())["account"], "github.com/work"
        )

    def test_profile_switch_does_not_transfer_existing_history(self) -> None:
        self.scope.installed_providers("github.com/work")
        self.config["lastLoggedInUser"] = {"host": "github.com", "login": "personal"}
        self.config["loggedInUsers"] = [self.config["lastLoggedInUser"]]
        self.save()
        self.assertEqual(self.scope.installed_providers("github.com/personal"), set())
        self.config["lastLoggedInUser"] = {"host": "github.com", "login": "work"}
        self.config["loggedInUsers"] = [self.config["lastLoggedInUser"]]
        self.save()
        self.assertEqual(self.scope.installed_providers("github.com/work"), set())
        self.assertTrue(json.loads(self.scope.owner_path.read_text())["quarantined"])

    def test_unattributed_and_shared_profiles_fail_closed(self) -> None:
        self.config["loggedInUsers"].append({"host": "github.com", "login": "personal"})
        self.save()
        self.assertEqual(self.scope.installed_providers("github.com/work"), set())
        self.assertFalse(self.scope.owner_path.exists())
        (self.home / "config.json").unlink()
        self.assertEqual(self.scope.installed_providers("github.com/work"), set())

    def test_separate_profiles_can_have_separate_owners(self) -> None:
        self.scope.installed_providers("github.com/work")
        other = self.home / "personal"
        other.mkdir()
        self.config["lastLoggedInUser"] = {"host": "github.com", "login": "personal"}
        self.config["loggedInUsers"] = [self.config["lastLoggedInUser"]]
        (other / "config.json").write_text(json.dumps(self.config))
        self.assertEqual(
            AccountScope(other).installed_providers("github.com/personal"),
            {"design-fleet"},
        )
        self.assertEqual(AccountScope(other).installed_providers("github.com/work"), set())

    def test_malformed_configuration_is_not_silently_accepted(self) -> None:
        (self.home / "config.json").write_text("{invalid")
        with self.assertRaises(ValueError):
            self.scope.installed_providers("github.com/work")

    def test_identity_normalizes_host_and_login(self) -> None:
        self.assertEqual(
            account_key({"host": "https://GitHub.com/", "login": "Work"}),
            "github.com/work",
        )
        self.assertIsNone(account_key({"login": "work"}))
