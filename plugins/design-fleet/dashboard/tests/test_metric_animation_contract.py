from __future__ import annotations

import unittest
from pathlib import Path


DASHBOARD_ROOT = Path(__file__).resolve().parents[1]
APP_SOURCE = (DASHBOARD_ROOT / "src" / "App.tsx").read_text(encoding="utf-8")
STYLE_SOURCE = (DASHBOARD_ROOT / "src" / "styles.ts").read_text(encoding="utf-8")


class MetricAnimationContractTests(unittest.TestCase):
    def test_summary_metrics_count_once_with_staggered_delays(self) -> None:
        self.assertIn("function AnimatedMetricValue", APP_SOURCE)
        self.assertIn("formatMetricProgress", APP_SOURCE)
        self.assertIn("requestAnimationFrame(step)", APP_SOURCE)
        self.assertIn("animateSummaryMetrics", APP_SOURCE)
        self.assertIn("setAnimateSummaryMetrics(false)", APP_SOURCE)
        for delay in (0, 90, 180, 270, 360):
            self.assertIn(f"animationDelay={{{delay}}}", APP_SOURCE)

    def test_animation_preserves_accessible_final_values_and_reduced_motion(self) -> None:
        self.assertIn("aria-label={target}", APP_SOURCE)
        self.assertIn('ref={valueRef} aria-hidden="true"', APP_SOURCE)
        self.assertIn('prefers-reduced-motion: reduce', APP_SOURCE)
        self.assertIn("@keyframes metric-value-count-in", STYLE_SOURCE)
        self.assertIn("font-variant-numeric: tabular-nums;", STYLE_SOURCE)
        self.assertIn("overflow: visible;", STYLE_SOURCE)

    def test_last_smoke_metric_preserves_results_and_empty_state_without_icon_tiles(self) -> None:
        smoke = APP_SOURCE.split('label="Last smoke test"', 1)[1].split("/>", 1)[0]
        self.assertIn("dashboard.smokeTest.passed", smoke)
        self.assertIn("dashboard.smokeTest.total", smoke)
        self.assertIn('No test', smoke)
        self.assertIn("No smoke-test task found in this range", smoke)
        metric = APP_SOURCE.split("const MetricCard", 1)[1].split("const StationCard", 1)[0]
        self.assertNotIn('className="metric-icon"', metric)

    def test_active_sessions_metric_distinguishes_station_processes(self) -> None:
        self.assertIn('label="Active sessions"', APP_SOURCE)
        self.assertIn("dashboard?.summary.activeSessions", APP_SOURCE)
        self.assertIn("attributed fleet", APP_SOURCE)
        self.assertIn("activeBranchCount", APP_SOURCE)
        self.assertIn("Fleet processes in motion", APP_SOURCE)


if __name__ == "__main__":
    unittest.main()
