from pathlib import Path
import unittest


APP = (Path(__file__).resolve().parents[1] / "src" / "App.tsx").read_text()


class AccountFrontendContractTests(unittest.TestCase):
    def test_switch_clears_private_content_before_auth_command(self) -> None:
        activate = APP.split("async function activate(", 1)[1].split(
            "async function confirmLogout", 1
        )[0]
        self.assertLess(
            activate.index("onAccountChanging()"), activate.index("await switchAccount(")
        )
        self.assertIn("window.location.reload()", activate)
        reset = APP.split("const clearAccountView =", 1)[1].split(
            "const handleAuthChange =", 1
        )[0]
        for statement in (
            "clearAccountContext()", "telemetryAbortRef.current?.abort()",
            "fleetAbortRef.current?.abort()", "setDashboard(null)",
            "setFleetsData(null)", "setCrews(null)", "setSmokeSuiteJob(null)",
            "setCommandOpen(false)", 'setProject("all")', "setHiddenProjects([])",
        ):
            self.assertIn(statement, reset)

    def test_no_install_has_an_explicit_empty_state(self) -> None:
        self.assertIn("No fleet for this account", APP)
        self.assertIn("fleetsData && !fleetsData.fleets.length", APP)
        self.assertIn('onAccountChanging={clearAccountView}', APP)

    def test_private_preferences_are_account_scoped(self) -> None:
        for key in (
            "activeFleetStorageKey", "hiddenProjectsStorageKey", "clearedActivityStorageKey",
        ):
            self.assertIn(f"accountStorageKey({key})", APP)
        self.assertIn('window.addEventListener("design-fleet-account-changed"', APP)
