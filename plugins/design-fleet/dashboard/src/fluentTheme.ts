import { webDarkTheme, webLightTheme } from "@fluentui/react-components";

export function createFluentTheme(mode: "light" | "dark") {
  return mode === "dark" ? webDarkTheme : webLightTheme;
}
