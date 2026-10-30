from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "src/App.tsx").read_text()
STYLES = (ROOT / "src/styles.ts").read_text()


class AuthLoadingTests(unittest.TestCase):
    def test_checking_uses_a_standard_decorative_spinner_and_one_text_status(self) -> None:
        gate = APP.split("function AuthenticationGate", 1)[1].split("function AccountDialog", 1)[0]
        self.assertIn('className="notice auth-check-status" role="status"', gate)
        self.assertIn('<Spinner size="small" aria-hidden="true" />', gate)
        self.assertIn("<span>Checking your GitHub sign-in...</span>", gate)
        self.assertNotIn("loading-logo.svg", gate)
        self.assertNotIn("auth-gate-brand", gate)
        self.assertNotIn("Fleet dashboard", gate)

    def test_reduced_motion_disables_repeating_indicator_animation(self) -> None:
        reduced = STYLES.split("@media (prefers-reduced-motion: reduce)", 1)[1]
        self.assertIn("animation-duration: 0.01ms !important;", reduced)
        self.assertIn("animation-iteration-count: 1 !important;", reduced)
