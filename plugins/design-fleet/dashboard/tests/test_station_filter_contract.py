from __future__ import annotations

import unittest
from pathlib import Path


DASHBOARD_ROOT = Path(__file__).resolve().parents[1]
APP_SOURCE = (DASHBOARD_ROOT / "src" / "App.tsx").read_text(encoding="utf-8")
STYLE_SOURCE = (DASHBOARD_ROOT / "src" / "styles.ts").read_text(encoding="utf-8")


class StationFilterContractTests(unittest.TestCase):
    def test_activity_filter_is_removed(self) -> None:
        self.assertNotIn("StationActivityFilter", APP_SOURCE)
        self.assertNotIn("stationActivity", APP_SOURCE)
        self.assertNotIn('aria-label="Filter by activity"', APP_SOURCE)
        self.assertNotIn('<option value="inactive">No runs</option>', APP_SOURCE)

    def test_remaining_filter_controls_are_compact_without_an_indicator_rule(self) -> None:
        self.assertIn(".station-filter-bar .fui-Input {", STYLE_SOURCE)
        self.assertIn(".station-filter-bar .fui-Combobox {", STYLE_SOURCE)
        self.assertIn("height: 32px;", STYLE_SOURCE)
        self.assertIn("border: 1px solid var(--cp-border);", STYLE_SOURCE)
        self.assertIn(".station-filter-bar .fui-Combobox::after {", STYLE_SOURCE)
        self.assertIn("display: none !important;", STYLE_SOURCE)
        sort_button = STYLE_SOURCE.split(".station-sort-direction {", 1)[1].split(
            "}", 1
        )[0]
        reset_button = STYLE_SOURCE.split(".station-filter-reset {", 1)[1].split(
            "}", 1
        )[0]
        for rule in (sort_button, reset_button):
            self.assertIn("height: 32px;", rule)
            self.assertIn("min-height: 32px;", rule)


if __name__ == "__main__":
    unittest.main()
