from __future__ import annotations

import unittest
import re
from pathlib import Path


DASHBOARD_ROOT = Path(__file__).resolve().parents[1]
APP_SOURCE = (DASHBOARD_ROOT / "src" / "App.tsx").read_text(encoding="utf-8")
STYLE_SOURCE = (DASHBOARD_ROOT / "src" / "styles.ts").read_text(encoding="utf-8")


class ResponsiveShellContractTests(unittest.TestCase):
    def test_mobile_navigation_uses_an_accessible_hamburger_drawer(self) -> None:
        self.assertIn("Navigation24Regular", APP_SOURCE)
        self.assertIn('className="collapse-button mobile-menu-button"', APP_SOURCE)
        self.assertIn("aria-expanded={mobileNavigationOpen}", APP_SOURCE)
        self.assertIn('aria-controls="fleet-navigation-content"', APP_SOURCE)
        self.assertIn('className="mobile-navigation-backdrop"', APP_SOURCE)
        self.assertIn('event.key === "Escape"', APP_SOURCE)
        self.assertIn("inert={mobileNavigationOpen || undefined}", APP_SOURCE)
        self.assertIn(".mobile-navigation-open .sidebar {", STYLE_SOURCE)
        compact_styles = STYLE_SOURCE.split("@media (max-width: 1180px) {", 1)[1]
        self.assertIn(".desktop-collapse-button {\n    display: none;", compact_styles)
        self.assertIn(".mobile-menu-button {\n    display: grid;", compact_styles)

    def test_summary_metrics_are_compact_across_tablet_and_mobile(self) -> None:
        tablet_styles = STYLE_SOURCE.split("@media (max-width: 840px) {", 1)[1]
        self.assertIn(
            "grid-template-columns: repeat(3, minmax(0, 1fr));",
            tablet_styles,
        )
        mobile_styles = STYLE_SOURCE.split("@media (max-width: 600px) {", 1)[1]
        self.assertIn(
            "grid-template-columns: repeat(2, minmax(0, 1fr));",
            mobile_styles,
        )
        metrics = STYLE_SOURCE.split(".metrics-grid {", 1)[1].split("}", 1)[0]
        self.assertIn("gap: 1px;", metrics)
        self.assertIn("border-radius: 16px;", metrics)
        card = STYLE_SOURCE.split(".metrics-grid > .metric-card {", 1)[1].split("}", 1)[0]
        self.assertIn("border-radius: 0;", card)
        self.assertIn("box-shadow: none;", card)
        metric_component = APP_SOURCE.split("const MetricCard", 1)[1].split("const StationCard", 1)[0]
        self.assertNotIn("metric-icon", metric_component)
        self.assertIn("metric-info-button", metric_component)

    def test_mobile_settings_navigation_reflows_without_widening_the_panel(self) -> None:
        tablet_styles = STYLE_SOURCE.split("@media (max-width: 840px) {", 1)[1]
        self.assertIn(".settings-layout {", tablet_styles)
        layout = tablet_styles.split(".settings-layout {", 1)[1].split("}", 1)[0]
        navigation = tablet_styles.split(".settings-nav {", 1)[1].split("}", 1)[0]
        button = tablet_styles.split(".settings-nav-button {", 1)[1].split("}", 1)[0]
        self.assertIn("grid-template-columns: minmax(0, 1fr);", layout)
        self.assertIn("flex-wrap: wrap;", navigation)
        self.assertIn("flex: 1 1 140px;", button)
        self.assertIn("min-height: 44px;", button)

    def test_station_filters_keep_one_track_and_portal_their_menus(self) -> None:
        filter_blocks = re.findall(r"\.station-filter-bar\s*\{([^}]+)\}", STYLE_SOURCE)
        tracks = [block for block in filter_blocks if "grid-template-columns:" in block]
        self.assertEqual(len(tracks), 1, "Breakpoints must not wrap filters into extra grid rows")
        self.assertIn("overflow-x: auto;", tracks[0])
        self.assertIn("minmax(160px, 2fr)", tracks[0])
        for label in ("Filter by model family", "Filter by health", "Sort stations by"):
            control = APP_SOURCE.split(f'ariaLabel="{label}"', 1)[1].split("searchPlaceholder", 1)[0]
            self.assertIn("inlinePopup={false}", control)

    def test_summary_detail_text_is_anchored_to_the_card_bottom(self) -> None:
        copy = STYLE_SOURCE.split(".metric-copy {", 1)[1].split("}", 1)[0]
        detail = STYLE_SOURCE.split(".metric-detail-row {", 1)[1].split("}", 1)[0]
        self.assertIn("display: flex;", copy)
        self.assertIn("flex: 1;", copy)
        self.assertIn("flex-direction: column;", copy)
        self.assertIn("margin-top: auto;", detail)
        self.assertIn("align-items: flex-end;", detail)
        self.assertEqual(STYLE_SOURCE.count(".metric-detail-row {"), 1)

    def test_board_has_visible_and_keyboard_horizontal_navigation(self) -> None:
        self.assertIn('aria-label="Scroll Board left"', APP_SOURCE)
        self.assertIn('aria-label="Scroll Board right"', APP_SOURCE)
        self.assertIn('aria-controls="handoff-board"', APP_SOURCE)
        self.assertIn('event.target !== event.currentTarget', APP_SOURCE)
        self.assertIn('event.key === "ArrowLeft"', APP_SOURCE)
        self.assertIn('event.key === "Home" || event.key === "End"', APP_SOURCE)
        self.assertIn('board.addEventListener("scroll", updateScroll', APP_SOURCE)
        self.assertNotIn("scroll-snap-type: x proximity;", STYLE_SOURCE)

    def test_mobile_header_has_touch_safe_spacing(self) -> None:
        compact_styles = STYLE_SOURCE.split("@media (max-width: 1180px) {", 1)[1]
        self.assertIn("min-height: 64px;", compact_styles)
        self.assertIn("env(safe-area-inset-right)", compact_styles)
        self.assertIn("env(safe-area-inset-left)", compact_styles)
        self.assertIn("width: 40px;", compact_styles)
        self.assertIn("height: 40px;", compact_styles)
        self.assertIn("border: 0;", compact_styles)


if __name__ == "__main__":
    unittest.main()
