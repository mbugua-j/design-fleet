from __future__ import annotations

import unittest
from pathlib import Path


DASHBOARD_ROOT = Path(__file__).resolve().parents[1]
APP_SOURCE = (DASHBOARD_ROOT / "src" / "App.tsx").read_text(encoding="utf-8")
STYLE_SOURCE = (DASHBOARD_ROOT / "src" / "styles.ts").read_text(encoding="utf-8")


class PipelineContractTests(unittest.TestCase):
    def test_pipeline_uses_semantic_nodes_and_relationship_fallback(self) -> None:
        self.assertIn('className="pipeline-node-card', APP_SOURCE)
        self.assertIn("<article", APP_SOURCE)
        self.assertIn('aria-label="Pipeline relationships"', APP_SOURCE)
        self.assertNotIn('className="pipeline-status"', APP_SOURCE)
        self.assertIn('className="pipeline-outcome-caption"', APP_SOURCE)

        for relationship in (
            "DesignR hands work to Design-Review.",
            "DesignR optionally hands work to Engraver when an asset is required.",
            "Engraver hands the approved asset to Design-Review.",
            "Design-Review returns rejected design work to DesignR.",
            "Surveyor returns blocking findings to Shipwright.",
            "Lookout returns blocking findings to Shipwright.",
            "Pull request schedules Watchkeeper monitoring.",
            "Watchkeeper routes measurement questions to Surveyor.",
            "Watchkeeper routes code changes to Shipwright.",
            "BuildR returns combination breaks to Shipwright.",
        ):
            self.assertIn(relationship, APP_SOURCE)

    def test_pipeline_has_distinct_wide_compact_and_mobile_layouts(self) -> None:
        self.assertIn('className="pipeline-layout pipeline-layout-wide"', APP_SOURCE)
        self.assertIn(
            'className="pipeline-layout pipeline-layout-compact"', APP_SOURCE
        )
        self.assertIn('className="pipeline-mobile-workflow"', APP_SOURCE)
        self.assertIn('className="pipeline-mobile-operations"', APP_SOURCE)
        self.assertIn("Optional branch", APP_SOURCE)
        self.assertIn("Blocking finding", APP_SOURCE)
        self.assertIn(
            "@media (min-width: 841px) and (max-width: 1179px)",
            STYLE_SOURCE,
        )
        self.assertNotIn("@container pipeline (max-width: 1000px)", STYLE_SOURCE)
        self.assertIn("@media (max-width: 840px)", STYLE_SOURCE)
        self.assertIn("compactPipelineConnectorOverrides", APP_SOURCE)
        self.assertIn('"surveyor-lookout"', APP_SOURCE)
        self.assertIn('sourceSide: "left"', APP_SOURCE)
        self.assertIn('targetSide: "right"', APP_SOURCE)

    def test_canvas_uses_live_ports_and_accessible_drag_controls(self) -> None:
        self.assertIn("measurePipelineConnectors", APP_SOURCE)
        self.assertIn("buildPipelinePath", APP_SOURCE)
        self.assertIn('sourcePort: "top"', APP_SOURCE)
        self.assertIn('targetPort: "input"', APP_SOURCE)
        self.assertIn('data-connector-id={connector.id}', APP_SOURCE)
        self.assertIn("setPointerCapture", APP_SOURCE)
        self.assertIn('aria-label={`Move ${station?.display || stationId}`}', APP_SOURCE)
        self.assertIn('aria-label="Reset layout"', APP_SOURCE)
        self.assertIn('aria-live="polite"', APP_SOURCE)
        self.assertIn(".pipeline-connectors {\n  overflow: visible;", STYLE_SOURCE)
        self.assertNotIn('d="M76 188 C76 112 225 112 225 154"', APP_SOURCE)
        self.assertNotIn('d="M120 135 C120 92 325 92 325 116"', APP_SOURCE)

    def test_feedback_routes_replace_canvas_spanning_return_curves(self) -> None:
        self.assertIn("const pipelineFeedbackRoutes = [", APP_SOURCE)
        self.assertIn('className="pipeline-feedback-panel"', APP_SOURCE)
        self.assertIn("Exceptions are listed by destination", APP_SOURCE)
        self.assertNotIn('kind: "return"', APP_SOURCE)
        self.assertNotIn(".pipeline-return-paths", STYLE_SOURCE)
        self.assertNotIn("pipeline-return-arrow", APP_SOURCE)
        self.assertNotIn("left-gutter", APP_SOURCE)

    def test_pipeline_visuals_are_decorative_and_do_not_force_scrolling(self) -> None:
        self.assertIn(
            'className="pipeline-page-grid" aria-hidden="true"', APP_SOURCE
        )
        self.assertNotIn('className="pipeline-grid"', APP_SOURCE)
        self.assertIn(
            'className="pipeline-connectors" aria-hidden="true"', APP_SOURCE
        )

        pipeline_styles = STYLE_SOURCE.split(".pipeline-view", 1)[1].split(
            ".station-card", 1
        )[0]
        self.assertNotIn("gradient(", pipeline_styles)
        self.assertNotIn("overflow-x: auto", pipeline_styles)
        self.assertNotIn("overflow-x: clip", pipeline_styles)
        self.assertGreaterEqual(pipeline_styles.count("overflow: visible;"), 4)

    def test_light_theme_pipeline_uses_the_white_dashboard_surface(self) -> None:
        pipeline_styles = STYLE_SOURCE.split(".pipeline-view", 1)[1].split(
            ".station-card", 1
        )[0]
        self.assertIn("--pipeline-bg: var(--cp-surface);", pipeline_styles)
        self.assertIn("--pipeline-text: var(--cp-text);", pipeline_styles)
        self.assertIn("--pipeline-dot:", pipeline_styles)
        self.assertIn("--pipeline-card-border:", pipeline_styles)
        self.assertIn("--pipeline-card-shadow:", pipeline_styles)
        self.assertIn(
            'html[data-theme="dark"] .main-content-pipeline',
            pipeline_styles,
        )
        self.assertNotIn(
            "--pipeline-bg: color-mix(in srgb, var(--cp-text) 92%, var(--cp-bg));",
            pipeline_styles,
        )

    def test_pipeline_is_workflow_focused_without_health_presentation(self) -> None:
        self.assertIn("Canonical fleet workflow", APP_SOURCE)
        self.assertNotIn("Live station health", APP_SOURCE)
        self.assertNotIn("pipelineStatusLabels", APP_SOURCE)
        self.assertNotIn("pipelineStatusIcon", APP_SOURCE)
        self.assertNotIn('data-running={status === "running"', APP_SOURCE)
        self.assertNotIn(".pipeline-status", STYLE_SOURCE)
        self.assertNotIn(
            '.pipeline-node-card[data-running="true"]',
            STYLE_SOURCE,
        )

    def test_down_stations_tint_pipeline_cards_and_rails(self) -> None:
        self.assertIn("data-health={station?.status}", APP_SOURCE)
        down_styles = STYLE_SOURCE.split(
            '.pipeline-node-card[data-health="down"] {',
            1,
        )[1].split("}", 1)[0]
        self.assertIn("--pipeline-rail: var(--cp-danger);", down_styles)
        self.assertIn("var(--cp-danger) 7%", down_styles)

    def test_pipeline_canvas_covers_main_content_without_a_nested_surface(self) -> None:
        self.assertIn(
            'className={`main-content ${',
            APP_SOURCE,
        )
        self.assertIn(
            'view === "pipeline" ? "main-content-pipeline" : ""',
            APP_SOURCE,
        )
        self.assertIn('id="pipeline-page-grid-pattern"', APP_SOURCE)
        self.assertIn(".main-content-pipeline {", STYLE_SOURCE)
        self.assertIn("min-height: 100vh;", STYLE_SOURCE)
        self.assertIn("min-height: calc(100vh - 56px);", STYLE_SOURCE)
        self.assertIn(".pipeline-page-grid {", STYLE_SOURCE)

        pipeline_frame = STYLE_SOURCE.split(".pipeline-frame", 1)[1].split(
            "html[data-theme", 1
        )[0]
        self.assertIn("border: 0;", pipeline_frame)
        self.assertIn("background: transparent;", pipeline_frame)
        self.assertIn("box-shadow: none;", pipeline_frame)

    def test_handoff_board_fills_the_desktop_viewport(self) -> None:
        self.assertIn(
            'view === "handoffs" ? "main-content-handoffs" : ""',
            APP_SOURCE,
        )
        self.assertIn(".main-content-handoffs {", STYLE_SOURCE)
        self.assertIn("height: 100vh;", STYLE_SOURCE)
        self.assertIn("padding-bottom: 0;", STYLE_SOURCE)
        self.assertIn(".main-content-handoffs .handoff-board {", STYLE_SOURCE)
        self.assertIn(".main-content-handoffs .handoff-column-body {", STYLE_SOURCE)
        self.assertIn("overflow-y: auto;", STYLE_SOURCE)

    def test_handoff_board_forwards_horizontal_wheel_gestures(self) -> None:
        self.assertIn("const boardRef = useRef<HTMLDivElement>(null);", APP_SOURCE)
        self.assertIn('board.addEventListener("wheel", scrollHorizontally', APP_SOURCE)
        self.assertIn("{ passive: false }", APP_SOURCE)
        self.assertIn("board.scrollLeft +=", APP_SOURCE)
        self.assertIn("overscroll-behavior-y: contain;", STYLE_SOURCE)
        self.assertIn("overscroll-behavior-x: contain;", STYLE_SOURCE)

    def test_pipeline_zoom_controls_scale_only_the_topology_world(self) -> None:
        self.assertIn('className="pipeline-world"', APP_SOURCE)
        self.assertIn('aria-label="Zoom out"', APP_SOURCE)
        self.assertIn('aria-label="Zoom in"', APP_SOURCE)
        self.assertIn('aria-label="Fit to view"', APP_SOURCE)
        self.assertIn("pipeline-zoom-readout", APP_SOURCE)
        self.assertIn("pipelineZoomStorageKeys", APP_SOURCE)
        self.assertIn("calculatePipelineFitZoom", APP_SOURCE)
        self.assertIn("screenDeltaToPipelineWorld", APP_SOURCE)
        self.assertIn(".pipeline-zoom-controls", STYLE_SOURCE)
        self.assertIn(".pipeline-world {", STYLE_SOURCE)
        self.assertIn(
            "transition: transform 280ms cubic-bezier(0.34, 1.18, 0.64, 1);",
            STYLE_SOURCE,
        )
        self.assertIn("transition: none !important;", STYLE_SOURCE)

    def test_pipeline_category_rails_are_inset_pills_with_port_separation(self) -> None:
        pipeline_styles = STYLE_SOURCE.split(".pipeline-node-card", 1)[1].split(
            ".station-card", 1
        )[0]
        self.assertIn("--pipeline-rail-width: 4px;", pipeline_styles)
        self.assertIn("padding: 9px 9px 8px 24px;", pipeline_styles)
        self.assertIn("top: 8px;", pipeline_styles)
        self.assertIn("bottom: 8px;", pipeline_styles)
        self.assertIn("left: 7px;", pipeline_styles)
        self.assertIn("width: var(--pipeline-rail-width);", pipeline_styles)
        self.assertIn("border-radius: 999px;", pipeline_styles)
        self.assertIn("--pipeline-rail-width: 6px;", pipeline_styles)
        self.assertIn("box-shadow: 0 0 0 2px var(--pipeline-bg);", pipeline_styles)
        self.assertNotIn("top: -1px;", pipeline_styles)
        self.assertNotIn("left: -1px;", pipeline_styles)

    def test_static_mobile_workflow_hides_connector_ports(self) -> None:
        self.assertIn(
            ".pipeline-mobile-workflow .pipeline-port {\n  display: none;",
            STYLE_SOURCE,
        )

    def test_move_handles_focus_and_only_the_active_layout_is_interactive(self) -> None:
        start_drag = APP_SOURCE.split("function startPipelineDrag", 1)[1].split(
            "function movePipelineDrag",
            1,
        )[0]
        self.assertIn("event.currentTarget.focus({ preventScroll: true });", start_drag)
        self.assertNotIn("event.preventDefault();", start_drag)
        self.assertGreaterEqual(
            APP_SOURCE.count("mode === activeLayoutMode"),
            2,
        )


if __name__ == "__main__":
    unittest.main()
