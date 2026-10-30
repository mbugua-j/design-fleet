from __future__ import annotations

import unittest
from pathlib import Path


DASHBOARD_ROOT = Path(__file__).resolve().parents[1]
STYLE_SOURCE = (DASHBOARD_ROOT / "src" / "styles.ts").read_text(encoding="utf-8")
APP_SOURCE = (DASHBOARD_ROOT / "src" / "App.tsx").read_text(encoding="utf-8")


class StationCardContractTests(unittest.TestCase):
    def test_station_stats_show_family_instead_of_success_without_footer(self) -> None:
        station_card = APP_SOURCE.split(
            "const StationCard = memo", 1
        )[1].split("const masonryRowHeight", 1)[0]
        stats = station_card.split(
            '<dl className="station-stats">', 1
        )[1].split("</dl>", 1)[0]
        self.assertIn("<dt>Model family</dt>", stats)
        self.assertIn("<dd>{station.family}</dd>", stats)
        self.assertEqual(station_card.count("{station.family}"), 1)
        self.assertNotIn("<dt>Success</dt>", station_card)
        self.assertNotIn("station.successRate", station_card)
        self.assertNotIn("station-card-footer", station_card)
        self.assertNotIn("Last run", station_card)
        self.assertNotIn("station.lastRun", station_card)

    def test_header_shows_readable_model_and_stats_show_plain_status(self) -> None:
        station_card = APP_SOURCE.split(
            "const StationCard = memo", 1
        )[1].split("const masonryRowHeight", 1)[0]
        header = station_card.split(
            '<header className="station-card-header">', 1
        )[1].split("</header>", 1)[0]
        self.assertNotIn("{station.title}", header)
        self.assertNotIn('aria-hidden="true"> · </span>', header)
        self.assertIn("modelDisplayNames.get(station.model) ?? station.model", header)
        self.assertIn("title={station.model}", header)
        self.assertNotIn("<StatusBadge", station_card)
        self.assertNotIn("<dt>Model</dt>", station_card)
        self.assertIn("<dt>Status</dt>", station_card)
        self.assertIn("{statusLabels[station.status]}", station_card)
        self.assertIn('className={`station-status-text status-${station.status}`}', station_card)

        header_styles = STYLE_SOURCE.split(".station-card-header {", 1)[1].split(
            "}", 1
        )[0]
        self.assertIn("display: grid;", header_styles)
        self.assertIn(
            "grid-template-columns: 38px minmax(0, 1fr) auto;",
            header_styles,
        )

        self.assertNotIn(".station-card-header .status-badge {", STYLE_SOURCE)
        self.assertIn(".station-status-text.status-healthy", STYLE_SOURCE)
        self.assertIn(".station-status-text.status-down", STYLE_SOURCE)
        self.assertIn(".station-status-text.status-warning", STYLE_SOURCE)

    def test_station_role_is_semibold_above_description(self) -> None:
        station_card = APP_SOURCE.split(
            "const StationCard = memo", 1
        )[1].split("const masonryRowHeight", 1)[0]
        purpose = station_card.split(
            '<p className="station-purpose">', 1
        )[1].split("</p>", 1)[0]
        self.assertIn('<strong className="station-role">{station.title}</strong>', purpose)
        self.assertLess(purpose.index("{station.title}"), purpose.index("{station.purpose}"))
        self.assertEqual(station_card.count("{station.title}"), 1)
        role_styles = STYLE_SOURCE.split(".station-role {", 1)[1].split("}", 1)[0]
        self.assertIn("display: block;", role_styles)
        self.assertIn("font-weight: 600;", role_styles)
        purpose_styles = STYLE_SOURCE.split(
            "}\n\n.station-purpose {", 1
        )[1].split("}", 1)[0]
        self.assertIn("font-weight: 300;", purpose_styles)

    def test_model_display_names_preserve_raw_identifiers_for_actions(self) -> None:
        for model_id, label in (
            ("gpt-6-astra", "GPT-6 Astra"),
            ("gpt-5.6-sol", "GPT Sol"),
            ("gpt-5.6-sol-fast", "GPT Sol Fast"),
            ("gpt-5.6-terra", "GPT Terra"),
            ("claude-opus-5", "Claude Opus 5"),
            ("claude-sonnet-5", "Claude Sonnet 5"),
            ("claude-haiku-4.5", "Claude Haiku 4.5"),
            ("grok-4.6", "Grok 4.6"),
            ("mai-code-1.1-flash", "MAI-Code 1.1 Flash"),
        ):
            self.assertIn(f'["{model_id}", "{label}"]', APP_SOURCE)
        self.assertIn("onCopyModel(station.model)", APP_SOURCE)

    def test_station_cards_reuse_model_health_actions(self) -> None:
        self.assertIn(
            "aria-label={`Actions for ${station.display}`}",
            APP_SOURCE,
        )
        self.assertIn("onSmokeTest={openStationSmokeTest}", APP_SOURCE)
        self.assertIn("onConfigureModel={openModelSettings}", APP_SOURCE)
        self.assertIn("onCopyModel={copyModelId}", APP_SOURCE)
        for label in (
            "Run smoke test",
            "Change model",
            "Copy model ID",
        ):
            self.assertIn(label, APP_SOURCE)

    def test_change_model_targets_selected_station_without_starting_smoke(self) -> None:
        self.assertIn("onClick={() => onConfigureModel(station)}", APP_SOURCE)
        self.assertIn("setFocusedStationId(station?.id || null)", APP_SOURCE)
        self.assertIn("focusedStationId={focusedStationId}", APP_SOURCE)
        self.assertIn('id={`station-model-${role.id}`}', APP_SOURCE)
        self.assertIn("field?.focus()", APP_SOURCE)
        self.assertIn("Smoke tests run only when you choose Run smoke test", APP_SOURCE)
        handler = APP_SOURCE.split("function openModelSettings(", 1)[1].split(
            "function copyModelId", 1
        )[0]
        self.assertNotIn("openStationSmokeTest(", handler)

    def test_model_settings_focus_respects_capabilities_and_save_refreshes_telemetry(self) -> None:
        panel = APP_SOURCE.split("function CrewSettingsPanel(", 1)[1].split(
            "export default function App()", 1
        )[0]
        self.assertIn('canOverrideModels ? "station-model" : "station-name"', panel)
        self.assertIn("window.cancelAnimationFrame(frame)", panel)
        self.assertIn("disabled={!canOverrideModels}", panel)
        self.assertIn('ariaDescribedBy="model-smoke-description"', panel)
        self.assertNotIn("startSmokeSuite(", panel)
        saved = APP_SOURCE.split("const handleCrewsSaved = useCallback(", 1)[1].split(
            "const switchFleet", 1
        )[0]
        self.assertIn("await refreshCrews()", saved)
        self.assertIn("await refreshTelemetry(true)", saved)
        self.assertIn("onCrewsSaved={handleCrewsSaved}", APP_SOURCE)

    def test_station_cards_show_reasoning_and_tooltip_dollar_equivalent(self) -> None:
        station_card = APP_SOURCE.split(
            "const StationCard = memo", 1
        )[1].split("const ProcessList", 1)[0]
        self.assertIn("<dt>Reasoning mode</dt>", station_card)
        self.assertIn("reasoningMode(station.reasoningEffort)", station_card)
        self.assertIn('return "Inherited";', APP_SOURCE)
        self.assertNotIn("<dt>Dollar equivalent</dt>", station_card)
        self.assertIn("station-credit-value", station_card)
        self.assertIn('className: "station-credit-tooltip"', station_card)
        self.assertIn(
            ".station-credit-tooltip {\n  visibility: visible !important;",
            STYLE_SOURCE,
        )
        self.assertIn("consumption equivalent. This is not an invoice.", station_card)
        self.assertIn("tabIndex={0}", station_card)

    def test_station_grid_uses_measured_masonry_without_column_reordering(self) -> None:
        self.assertIn("function StationMasonryItem", APP_SOURCE)
        self.assertIn("const StationMasonryGrid = memo", APP_SOURCE)
        self.assertIn("new ResizeObserver(measure)", APP_SOURCE)
        self.assertIn(
            'styles.getPropertyValue("--station-grid-columns")',
            APP_SOURCE,
        )
        self.assertIn("gridColumn: column", APP_SOURCE)
        self.assertIn("gridRowStart: rowStart", APP_SOURCE)
        self.assertIn("gridRowEnd: `span ${rowSpan}`", APP_SOURCE)
        self.assertIn("columnRows[columnIndex] += rowSpan", APP_SOURCE)
        self.assertIn(
            'styles.getPropertyValue("--station-grid-columns")',
            APP_SOURCE,
        )
        self.assertIn('className="station-grid station-grid-masonry"', APP_SOURCE)
        self.assertIn("smokeEnabled={smokeEnabled}", APP_SOURCE)
        self.assertIn(
            "crewConfigurationEnabled={crewConfigurationEnabled}",
            APP_SOURCE,
        )
        self.assertIn("modelOverridesEnabled={modelOverridesEnabled}", APP_SOURCE)
        self.assertIn(".station-grid-masonry {", STYLE_SOURCE)
        for count in ("5", "4", "3", "2", "1"):
            self.assertIn(f"--station-grid-columns: {count};", STYLE_SOURCE)
        self.assertIn("grid-auto-rows: 1px;", STYLE_SOURCE)
        for column_count in (5, 4, 3, 2, 1):
            self.assertIn(
                f"--station-grid-columns: {column_count};",
                STYLE_SOURCE,
            )
        self.assertIn("row-gap: 0;", STYLE_SOURCE)
        self.assertIn("padding-bottom: 12px;", STYLE_SOURCE)
        self.assertNotIn("column-count:", STYLE_SOURCE)

    def test_station_filters_animate_named_masonry_cards(self) -> None:
        self.assertIn("function runStationTransition", APP_SOURCE)
        self.assertIn(
            "viewTransitionName: `station-card-${id}`",
            APP_SOURCE,
        )
        self.assertGreaterEqual(APP_SOURCE.count("runStationTransition(() =>"), 6)
        self.assertIn(
            "html.station-transition-active .content-shell",
            STYLE_SOURCE,
        )
        self.assertIn(
            "html.station-transition-active::view-transition-group(*)",
            STYLE_SOURCE,
        )
        self.assertIn("@keyframes station-filter-enter", STYLE_SOURCE)
        self.assertIn("@keyframes station-filter-exit", STYLE_SOURCE)


if __name__ == "__main__":
    unittest.main()
