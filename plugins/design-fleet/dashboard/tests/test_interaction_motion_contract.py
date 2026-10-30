from __future__ import annotations

import unittest
from pathlib import Path


DASHBOARD_ROOT = Path(__file__).resolve().parents[1]
APP_SOURCE = (DASHBOARD_ROOT / "src" / "App.tsx").read_text(encoding="utf-8")
STYLE_SOURCE = (DASHBOARD_ROOT / "src" / "styles.ts").read_text(encoding="utf-8")


class InteractionMotionContractTests(unittest.TestCase):
    def test_overview_refresh_crossfades_the_subtitle_without_an_extra_row(self) -> None:
        self.assertIn('dashboard && loading && view !== "overview"', APP_SOURCE)
        heading = APP_SOURCE.split(
            '<header className="page-heading overview-heading">', 1
        )[1].split("</header>", 1)[0]
        self.assertIn('className="overview-subtitle"', heading)
        self.assertIn('role="status" aria-live="polite" aria-atomic="true"', heading)
        self.assertIn('className="overview-subtitle-description"', heading)
        self.assertIn('aria-hidden={loading}', heading)
        self.assertIn('className="overview-subtitle-loading"', heading)
        self.assertIn('aria-hidden={!loading}', heading)
        self.assertIn("Updating the last {days}", heading)
        self.assertIn("Health, activity, delivery", heading)
        self.assertIn(".overview-subtitle {\n  display: grid;", STYLE_SOURCE)
        self.assertIn("grid-area: 1 / 1;", STYLE_SOURCE)
        self.assertIn(
            "transition: opacity var(--cp-motion-medium) var(--cp-motion-ease);",
            STYLE_SOURCE,
        )
        self.assertIn('.overview-subtitle > span[aria-hidden="true"]', STYLE_SOURCE)

    def test_range_refreshes_immediately_and_uses_saved_polling_interval(self) -> None:
        polling = APP_SOURCE.split(
            "const refreshVisibleDashboard = () => {", 1
        )[1].split("}, [", 1)[0]
        self.assertIn("void refreshTelemetry(true);", polling)
        self.assertIn(
            "window.setInterval(refreshVisibleDashboard, refreshInterval)", polling
        )
        self.assertLess(
            polling.index("void refreshTelemetry(true);"),
            polling.index("window.setInterval"),
        )
        self.assertIn("useState(loadRefreshInterval)", APP_SOURCE)
        self.assertIn(
            "window.localStorage.setItem(refreshIntervalStorageKey, String(refreshInterval));",
            APP_SOURCE,
        )
        self.assertIn('ariaLabel="Auto-refresh interval"', APP_SOURCE)
        self.assertIn("Auto-refreshing every {refreshInterval / 1000} seconds", APP_SOURCE)
        self.assertNotIn('aria-label="Refresh dashboard"', APP_SOURCE)
        self.assertIn("Try again", APP_SOURCE)

    def test_refresh_interval_validates_saved_values_and_cleans_up_requests(self) -> None:
        self.assertIn("const refreshIntervals = [5_000, 10_000, 30_000, 60_000]", APP_SOURCE)
        loader = APP_SOURCE.split("function loadRefreshInterval(): number {", 1)[1].split(
            "\n}", 1
        )[0]
        self.assertIn("if (stored === null) return 5_000", loader)
        self.assertIn("refreshIntervals.find((value) => String(value) === stored)", loader)
        self.assertIn("console.warn", loader)
        polling = APP_SOURCE.split("const refreshVisibleDashboard = () => {", 1)[1].split(
            "}, [", 1
        )[0]
        self.assertIn("window.clearInterval(timer)", polling)
        self.assertIn('document.removeEventListener("visibilitychange"', polling)
        self.assertIn("telemetryRequest.current += 1", polling)
        self.assertIn("telemetryAbortRef.current?.abort()", polling)
        self.assertIn('section === "general"', APP_SOURCE)
        self.assertIn('ariaDescribedBy="auto-refresh-description"', APP_SOURCE)

    def test_searchable_dropdown_uses_fluent_combobox_semantics(self) -> None:
        searchable_select = APP_SOURCE.split(
            "function SearchableSelect", 1
        )[1].split("function FleetPicker", 1)[0]
        self.assertIn("function SearchableSelect", APP_SOURCE)
        self.assertIn("useComboboxFilter", APP_SOURCE)
        self.assertIn("<Combobox", APP_SOURCE)
        self.assertIn("<Option", APP_SOURCE)
        self.assertIn("inlinePopup", APP_SOURCE)
        self.assertIn("clearable", searchable_select)
        self.assertIn("clearValue", searchable_select)
        self.assertIn("clearIcon=", searchable_select)
        self.assertIn('"aria-label": `Clear ${ariaLabel}`', searchable_select)
        self.assertIn('role: "button"', searchable_select)
        self.assertIn("tabIndex: 0", searchable_select)
        self.assertIn('event.key !== "Enter"', searchable_select)
        self.assertIn('event.key !== " "', searchable_select)
        self.assertIn("const inputRef = useRef<HTMLInputElement>(null)", searchable_select)
        self.assertIn("inputRef.current?.focus()", searchable_select)
        self.assertIn("ref={inputRef}", searchable_select)
        self.assertIn("onValueChange(clearValue)", searchable_select)
        self.assertIn(
            "if (data.optionValue === undefined) return;",
            searchable_select,
        )
        self.assertIn('noOptionsMessage: "No matching options"', APP_SOURCE)
        self.assertNotIn("setOpen(true)", searchable_select)
        self.assertNotIn("open={", searchable_select)
        self.assertNotIn("<Select", APP_SOURCE)
        self.assertNotIn("<option", APP_SOURCE)
        self.assertNotIn('<label className="range-picker">', APP_SOURCE)
        self.assertIn('<div className="range-picker">', APP_SOURCE)
        combobox_input = STYLE_SOURCE.split(
            ".searchable-select .fui-Combobox__input {", 1
        )[1].split("}", 1)[0]
        self.assertIn("height: auto;", combobox_input)
        self.assertIn("min-height: 0;", combobox_input)
        self.assertIn("padding-block: 0;", combobox_input)

    def test_combobox_fields_do_not_use_native_label_wrappers(self) -> None:
        for label in (
            "Provider",
            "Project",
            "Agent",
            "Model for this run",
            "Start from",
            "Range",
        ):
            self.assertNotIn(
                f"<label>\n                {label}\n                <SearchableSelect",
                APP_SOURCE,
            )
        self.assertIn('className="control-field"', APP_SOURCE)

    def test_clearable_dropdowns_reset_to_each_field_default(self) -> None:
        for clear_value in (
            'clearValue=""',
            'clearValue="all"',
            'clearValue="fleet"',
            "clearValue={role.model}",
        ):
            self.assertIn(clear_value, APP_SOURCE)
        self.assertGreaterEqual(APP_SOURCE.count("clearable"), 10)
        handoff_select = APP_SOURCE.split(
            'ariaLabel={`Hand off ${task.title} to another agent`}', 1
        )[1].split("/>", 1)[0]
        self.assertIn("clearable={false}", handoff_select)
        fleet_picker = APP_SOURCE.split("function FleetPicker", 1)[1].split(
            "const stationSortOptions", 1
        )[0]
        self.assertNotIn("clearable", fleet_picker)

    def test_telemetry_range_is_not_searchable_and_persists_selection(self) -> None:
        range_select = APP_SOURCE.split(
            '<div className="range-picker">', 1
        )[1].split("</div>", 1)[0]
        self.assertIn("<Dropdown", range_select)
        self.assertIn('aria-label="Telemetry range"', range_select)
        self.assertIn("selectedOptions={[String(days)]}", range_select)
        self.assertIn("onOptionSelect=", range_select)
        self.assertIn("<Option", range_select)
        self.assertNotIn("SearchableSelect", range_select)
        self.assertNotIn("Search ranges", range_select)
        self.assertIn("clearable={false}", range_select)
        self.assertNotIn("clearValue=", range_select)
        range_styles = STYLE_SOURCE.split(
            ".range-picker .range-select {", 1
        )[1].split("}", 1)[0]
        self.assertIn("padding-inline-end: 0;", range_styles)
        self.assertIn("useState(loadTelemetryRange)", APP_SOURCE)
        self.assertIn(
            "window.localStorage.setItem(telemetryRangeStorageKey, String(days));",
            APP_SOURCE,
        )
        loader = APP_SOURCE.split("function loadTelemetryRange(): number {", 1)[1].split(
            "\n}", 1
        )[0]
        self.assertIn("window.localStorage.getItem(telemetryRangeStorageKey)", loader)
        self.assertIn("ranges.find((option) => String(option.value) === stored)", loader)
        self.assertIn("if (stored === null) return 7;", loader)
        self.assertIn("if (range) return range.value;", loader)
        self.assertIn("console.warn", loader)

    def test_compact_combobox_and_icon_controls_share_32px_slots(self) -> None:
        self.assertIn(
            ':has(.fui-Combobox__clearIcon[aria-hidden="false"])',
            STYLE_SOURCE,
        )
        icon_slots = STYLE_SOURCE.split(
            ':has(.fui-Combobox__clearIcon[aria-hidden="false"])', 1
        )[1].split("}", 1)[0]
        self.assertIn("width: 32px;", icon_slots)
        self.assertIn("height: auto;", icon_slots)
        self.assertIn("align-self: stretch;", icon_slots)
        self.assertIn("place-items: center;", icon_slots)
        self.assertIn(
            ".searchable-select .fui-Combobox__expandIcon svg,",
            STYLE_SOURCE,
        )
        self.assertIn("width: 16px;", STYLE_SOURCE)
        self.assertIn(
            '.fui-Combobox__clearIcon[aria-hidden="false"]:focus-visible {',
            STYLE_SOURCE,
        )
        combobox_input = STYLE_SOURCE.split(
            ".searchable-select .fui-Combobox__input {", 1
        )[1].split("}", 1)[0]
        self.assertIn("height: auto;", combobox_input)
        self.assertIn("min-height: 0;", combobox_input)
        self.assertIn("padding-block: 0;", combobox_input)
        hidden_expand = STYLE_SOURCE.split(
            '.fui-Combobox__clearIcon[aria-hidden="false"]\n'
            ") .fui-Combobox__expandIcon {",
            1,
        )[1].split("}", 1)[0]
        self.assertIn("display: none;", hidden_expand)
        self.assertIn("width: 0;", hidden_expand)
        self.assertIn("height: 0;", hidden_expand)
        sort_button = STYLE_SOURCE.split(".station-sort-direction {", 1)[1].split(
            "}", 1
        )[0]
        reset_button = STYLE_SOURCE.split(".station-filter-reset {", 1)[1].split(
            "}", 1
        )[0]
        for rule in (sort_button, reset_button):
            self.assertIn("height: 32px;", rule)
            self.assertIn("min-height: 32px;", rule)

    def test_macro_surfaces_share_motion_and_respect_reduced_motion(self) -> None:
        for selector in (
            ".app-shell {",
            ".fui-MenuPopover {",
            ".fui-DialogSurface {",
            ".searchable-select-listbox.fui-Listbox {",
            ".mobile-navigation-open .sidebar {",
        ):
            self.assertIn(selector, STYLE_SOURCE)
        self.assertNotIn("animation: tooltip-enter", STYLE_SOURCE)
        self.assertIn("@media (prefers-reduced-motion: reduce)", STYLE_SOURCE)
        self.assertIn("transition-duration: 0.01ms !important;", STYLE_SOURCE)
        self.assertIn("animation-duration: 0.01ms !important;", STYLE_SOURCE)

    def test_dropdown_animation_preserves_fluent_positioning_transform(self) -> None:
        keyframes = STYLE_SOURCE.split("@keyframes dropdown-enter {", 1)[1].split(
            "@keyframes dialog-enter {", 1
        )[0]
        self.assertIn("opacity: 0;", keyframes)
        self.assertNotIn("transform:", keyframes)
        self.assertNotIn("translate:", keyframes)
        self.assertNotIn("scale:", keyframes)

    def test_desktop_sidebar_uses_fluent_regular_and_filled_hover_icons(self) -> None:
        self.assertIn("PanelLeft24Regular", APP_SOURCE)
        self.assertIn("PanelLeft24Filled", APP_SOURCE)
        self.assertIn("sidebar-toggle-regular", APP_SOURCE)
        self.assertIn("sidebar-toggle-filled", APP_SOURCE)
        self.assertIn(".desktop-collapse-button:hover .sidebar-toggle-filled", STYLE_SOURCE)

    def test_sidebar_resize_has_one_paint_path(self) -> None:
        collapse_button = APP_SOURCE.split(
            'className="collapse-button desktop-collapse-button"', 1
        )[1].split('className="collapse-button mobile-menu-button"', 1)[0]
        self.assertIn("setSidebarCollapsed", collapse_button)
        self.assertNotIn("runUiTransition", collapse_button)
        self.assertNotIn("view-transition-name: dashboard-sidebar", STYLE_SOURCE)
        self.assertIn(
            "transition: grid-template-columns var(--cp-motion-medium)",
            STYLE_SOURCE,
        )

    def test_collapsed_sidebar_starts_with_the_expand_control(self) -> None:
        self.assertIn(
            ".sidebar-collapsed .sidebar-brand .brand-mark {\n  display: none;",
            STYLE_SOURCE,
        )
        self.assertIn(
            ".sidebar-collapsed .desktop-collapse-button {\n  margin-inline: auto;",
            STYLE_SOURCE,
        )

    def test_fleet_selector_lives_in_the_navigation(self) -> None:
        fleet_section = APP_SOURCE.split(
            '<section className="fleet-nav-section" aria-label="Fleet">', 1
        )[1].split('<nav aria-label="Dashboard views">', 1)[0]
        self.assertIn('<p className="nav-label">Fleet</p>', fleet_section)
        self.assertIn("fleet-selector", fleet_section)
        self.assertIn("<FleetPicker", fleet_section)
        self.assertNotIn("<PeopleTeam24Regular", fleet_section)
        heading = APP_SOURCE.split('<header className="page-heading overview-heading">', 1)[1].split(
            "</header>", 1
        )[0]
        self.assertNotIn("activeFleet", heading)
        self.assertNotIn("dashboard-name-area", STYLE_SOURCE)

    def test_overview_actions_share_the_heading_instead_of_a_separate_toolbar(self) -> None:
        heading = APP_SOURCE.split('<header className="page-heading overview-heading">', 1)[1].split(
            "</header>", 1
        )[0]
        self.assertIn("All fleet activity", heading)
        self.assertIn("Run agent", heading)
        self.assertIn('aria-label="Telemetry range"', heading)
        self.assertIn("ref={commandButtonRef}", heading)
        self.assertIn("!canLaunchAgents", heading)
        self.assertIn("setDays(Number(data.optionValue))", heading)
        self.assertNotIn('<header className="topbar">', APP_SOURCE)


if __name__ == "__main__":
    unittest.main()
