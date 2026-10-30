from __future__ import annotations

import unittest
from pathlib import Path


DASHBOARD_ROOT = Path(__file__).resolve().parents[1]
THEME_SOURCE = (DASHBOARD_ROOT / "src" / "fluentTheme.ts").read_text(
    encoding="utf-8"
)
PALETTE_SOURCE = (DASHBOARD_ROOT / "src" / "themePalettes.ts").read_text(
    encoding="utf-8"
)
STYLE_SOURCE = (DASHBOARD_ROOT / "src" / "styles.ts").read_text(encoding="utf-8")
APP_SOURCE = (DASHBOARD_ROOT / "src" / "App.tsx").read_text(encoding="utf-8")
INDEX_SOURCE = (DASHBOARD_ROOT / "index.html").read_text(encoding="utf-8")


class ThemeContractTests(unittest.TestCase):
    def test_palette_application_derives_every_interactive_state(self) -> None:
        for variable in (
            "--cp-surface-hover",
            "--cp-surface-pressed",
            "--cp-surface-selected",
            "--cp-surface-selected-hover",
            "--cp-surface-selected-pressed",
            "--cp-accent-pressed",
            "--cp-accent-soft-hover",
            "--cp-accent-soft-pressed",
            "--cp-disabled-bg",
            "--cp-disabled-fg",
        ):
            self.assertIn(f'"{variable}"', PALETTE_SOURCE)

    def test_custom_primary_buttons_cover_all_pointer_states(self) -> None:
        self.assertIn("background: var(--cp-accent);", STYLE_SOURCE)
        self.assertIn(".primary-button:hover {", STYLE_SOURCE)
        self.assertIn("background: var(--cp-accent-hover);", STYLE_SOURCE)
        self.assertIn(".primary-button:active {", STYLE_SOURCE)
        self.assertIn("background: var(--cp-accent-pressed);", STYLE_SOURCE)
        self.assertIn(".primary-button.fui-Button:disabled {", STYLE_SOURCE)

    def test_default_form_controls_use_a_uniform_outline(self) -> None:
        self.assertIn(
            '.fui-Input:not(:has([aria-invalid="true"]))',
            STYLE_SOURCE,
        )
        self.assertIn(
            '.fui-Select__select:not([aria-invalid="true"])',
            STYLE_SOURCE,
        )
        self.assertIn(
            "border-color: var(--cp-input-border) !important;",
            STYLE_SOURCE,
        )
        self.assertIn(
            "--cp-input-border: color-mix(in srgb, var(--cp-border) 72%, var(--cp-surface));",
            STYLE_SOURCE,
        )

    def test_custom_controls_inherit_the_public_theme_typeface(self) -> None:
        self.assertIn("font-family: var(--cp-font-family);", STYLE_SOURCE)
        self.assertIn('"--cp-font-family": theme.fontFamilyBase', PALETTE_SOURCE)
        self.assertNotIn("fonts.googleapis.com", INDEX_SOURCE)
        self.assertNotIn('id="typeface-title"', APP_SOURCE)
        self.assertNotIn("TextFont24Regular", APP_SOURCE)


if __name__ == "__main__":
    unittest.main()
