from __future__ import annotations

import unittest
from pathlib import Path


DASHBOARD_ROOT = Path(__file__).resolve().parents[1]
APP_SOURCE = (DASHBOARD_ROOT / "src" / "App.tsx").read_text(encoding="utf-8")
STYLE_SOURCE = (DASHBOARD_ROOT / "src" / "styles.ts").read_text(encoding="utf-8")
VISIBILITY_SOURCE = (DASHBOARD_ROOT / "src" / "projectVisibility.ts").read_text(encoding="utf-8")


class ActivityClearContractTests(unittest.TestCase):
    def test_activity_clear_is_confirmed_and_scope_persistent(self) -> None:
        self.assertIn("clearedActivityStorageKey", APP_SOURCE)
        self.assertIn("loadClearedActivity", APP_SOURCE)
        self.assertIn("filterClearedActivity", APP_SOURCE)
        self.assertIn("Clear activity?", APP_SOURCE)
        self.assertIn("onClear(project);", APP_SOURCE)
        self.assertIn("JSON.stringify(clearedActivity)", APP_SOURCE)
        self.assertIn(
            "aria-label={`Clear completed activity for ${scopeLabel}`}",
            APP_SOURCE,
        )
        self.assertIn(
            "aria-label={`Confirm clearing ${clearableCount} completed activity ${",
            APP_SOURCE,
        )

    def test_clear_preserves_live_and_source_activity(self) -> None:
        self.assertIn('activity.status === "running"', VISIBILITY_SOURCE)
        self.assertIn('activity.status === "stalled"', VISIBILITY_SOURCE)
        self.assertIn("if (activityIsLive(item)) return true", APP_SOURCE)
        self.assertIn("Active runs remain visible.", APP_SOURCE)
        self.assertIn(
            "Copilot session, event, and usage\n                source records are not deleted.",
            APP_SOURCE,
        )
        self.assertIn(".activity-clear-dialog", STYLE_SOURCE)

    def test_activity_status_badges_are_text_only(self) -> None:
        self.assertIn("minimalStatusBadges", APP_SOURCE)
        self.assertIn("minimal={minimalStatusBadges}", APP_SOURCE)
        self.assertIn('appearance={minimal ? "ghost" : "outline"}', APP_SOURCE)
        self.assertIn("icon={minimal ? undefined : statusIcon(status)}", APP_SOURCE)
        self.assertIn('status === "running"', APP_SOURCE)
        self.assertIn('? "brand"', APP_SOURCE)
        self.assertIn(".status-badge-minimal {", STYLE_SOURCE)
        self.assertIn("border: 0;", STYLE_SOURCE)

    def test_project_visibility_applies_to_all_task_and_activity_lists(self) -> None:
        for collection in ("activity", "processes", "handoffs"):
            self.assertIn(
                f"filterProjectItems(dashboard?.{collection} || [], visibleProjects)",
                APP_SOURCE,
            )
        self.assertIn("processes={visibleProcesses}", APP_SOURCE)
        self.assertIn("tasks={visibleHandoffs}", APP_SOURCE)
        self.assertIn("activity={visibleActivity}", APP_SOURCE)

    def test_board_defaults_to_current_work_without_truncating_cards(self) -> None:
        self.assertIn("setShowTaskHistory] = useState(false)", APP_SOURCE)
        self.assertIn("showTaskHistory || activityIsLive(task)", APP_SOURCE)
        self.assertIn('label="Show task history"', APP_SOURCE)
        self.assertIn("task.history.map", APP_SOURCE)
        self.assertNotIn("task.history.slice", APP_SOURCE)
        self.assertIn("grid-auto-rows: max-content;", STYLE_SOURCE)
        self.assertIn("min-height: max-content;", STYLE_SOURCE)


if __name__ == "__main__":
    unittest.main()
