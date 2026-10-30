import { FluentProvider } from "@fluentui/react-components";
import { useEffect, useLayoutEffect, useState } from "react";
import App from "./App";
import { createFluentTheme } from "./fluentTheme";
import { GlobalStyles } from "./styles";
import { applyPalette, defaultPalette, isPaletteId } from "./themePalettes";

export function Root() {
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(
    document.documentElement.dataset.theme === "dark" ? "dark" : "light",
  );
  const [palette, setPalette] = useState(
    isPaletteId(document.documentElement.dataset.palette)
      ? document.documentElement.dataset.palette
      : defaultPalette,
  );

  useLayoutEffect(() => {
    applyPalette(palette, resolvedMode);
  }, [palette, resolvedMode]);

  useEffect(() => {
    const onThemeChange = (event: Event) => {
      const detail = (
        event as CustomEvent<{ resolvedMode?: string; palette?: string }>
      ).detail;
      setResolvedMode(detail?.resolvedMode === "dark" ? "dark" : "light");
      if (isPaletteId(detail?.palette)) setPalette(detail.palette);
    };
    window.addEventListener("design-fleet:theme-change", onThemeChange);
    return () =>
      window.removeEventListener("design-fleet:theme-change", onThemeChange);
  }, []);

  return (
    <FluentProvider theme={createFluentTheme(resolvedMode)}>
      <GlobalStyles />
      <App />
    </FluentProvider>
  );
}
