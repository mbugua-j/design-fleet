import { createFluentTheme } from "./fluentTheme";

export type PaletteId = "fluent";
export type ResolvedMode = "light" | "dark";
export const defaultPalette: PaletteId = "fluent";

export function isPaletteId(value: unknown): value is PaletteId {
  return value === defaultPalette;
}

export function fluentVariables(mode: ResolvedMode): Record<string, string> {
  const theme = createFluentTheme(mode);
  return {
    "--cp-font-family": theme.fontFamilyBase,
    "--cp-bg": theme.colorNeutralBackground2,
    "--cp-bg-elevated": theme.colorNeutralBackground3,
    "--cp-surface": theme.colorNeutralBackground1,
    "--cp-surface-soft": theme.colorNeutralBackground2,
    "--cp-surface-hover": theme.colorNeutralBackground1Hover,
    "--cp-surface-pressed": theme.colorNeutralBackground1Pressed,
    "--cp-surface-selected": theme.colorNeutralBackground1Selected,
    "--cp-surface-selected-hover": theme.colorNeutralBackground1Hover,
    "--cp-surface-selected-pressed": theme.colorNeutralBackground1Pressed,
    "--cp-border": theme.colorNeutralStroke1,
    "--cp-border-strong": theme.colorNeutralStrokeAccessible,
    "--cp-text": theme.colorNeutralForeground1,
    "--cp-text-muted": theme.colorNeutralForeground2,
    "--cp-text-soft": theme.colorNeutralForeground3,
    "--cp-accent": theme.colorBrandBackground,
    "--cp-accent-hover": theme.colorBrandBackgroundHover,
    "--cp-accent-pressed": theme.colorBrandBackgroundPressed,
    "--cp-accent-soft": theme.colorBrandBackground2,
    "--cp-accent-soft-hover": theme.colorBrandBackground2Hover,
    "--cp-accent-soft-pressed": theme.colorBrandBackground2Pressed,
    "--cp-accent-fg": theme.colorNeutralForegroundOnBrand,
    "--cp-disabled-bg": theme.colorNeutralBackgroundDisabled,
    "--cp-disabled-fg": theme.colorNeutralForegroundDisabled,
    "--cp-success": theme.colorStatusSuccessForeground1,
    "--cp-danger": theme.colorStatusDangerForeground1,
    "--cp-warning": theme.colorStatusWarningForeground1,
    "--cp-link": theme.colorBrandForegroundLink,
    "--cp-shadow": theme.shadow16,
    "--cp-overlay": theme.colorBackgroundOverlay,
    "--cp-panel": theme.colorNeutralBackground1,
    "--cp-panel-strong": theme.colorNeutralBackground1,
    "--cp-sheen": theme.colorSubtleBackground,
    "--cp-highlight": theme.colorBrandBackground2,
    "--cp-card-shadow": theme.shadow4,
  };
}

export function applyPalette(_paletteId: PaletteId, mode: ResolvedMode) {
  for (const [property, value] of Object.entries(fluentVariables(mode))) {
    document.documentElement.style.setProperty(property, value);
  }
  document.documentElement.dataset.palette = defaultPalette;
}
