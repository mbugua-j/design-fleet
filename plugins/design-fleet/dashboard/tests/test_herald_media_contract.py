from __future__ import annotations

import unittest
from pathlib import Path


PLUGIN_ROOT = Path(__file__).resolve().parents[2]
HERALD = (PLUGIN_ROOT / "agents" / "Herald.agent.md").read_text(encoding="utf-8")
HERALD_WORDS = " ".join(HERALD.split())


class HeraldMediaContractTests(unittest.TestCase):
    def test_before_after_media_is_bounded_accessible_and_tabular(self) -> None:
        self.assertIn("| Before | After |", HERALD_WORDS)
        self.assertIn("1024px", HERALD_WORDS)
        self.assertIn("intrinsic pixel height", HERALD_WORDS)
        self.assertIn("target pull request", HERALD_WORDS)
        self.assertIn("private fork", HERALD_WORDS)
        self.assertIn("actual image bytes", HERALD_WORDS)
        self.assertIn("Read the pull request body back", HERALD_WORDS)

    def test_media_preserves_current_evidence_and_permission_boundaries(self) -> None:
        for phrase in (
            "Lookout", "you do not have browser tools",
            "Task/project instructions may refine the presentation",
            "Do not crop away the changed behavior", "Preserve the originals",
            "target reviewer audience", "Never expose private media publicly",
            "Never merge a pull request",
        ):
            self.assertIn(phrase, HERALD_WORDS)


if __name__ == "__main__":
    unittest.main()
