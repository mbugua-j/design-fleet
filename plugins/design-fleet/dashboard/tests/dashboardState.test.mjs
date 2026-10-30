import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { createFluentTheme } from "../src/fluentTheme.ts";
import { applyPalette, isPaletteId } from "../src/themePalettes.ts";

test("components and custom surfaces use the same public Fluent theme in both modes", () => {
  const previous = globalThis.document;
  const properties = new Map();
  globalThis.document = {
    documentElement: {
      style: { setProperty: (name, value) => properties.set(name, value) },
      dataset: {},
    },
  };
  try {
    for (const [mode, expected] of [["light", webLightTheme], ["dark", webDarkTheme]]) {
      assert.equal(createFluentTheme(mode), expected, "Do not override the shipped Fluent theme");
      applyPalette("fluent", mode);
      assert.equal(properties.get("--cp-surface"), expected.colorNeutralBackground1);
      assert.equal(properties.get("--cp-accent-hover"), expected.colorBrandBackgroundHover);
      assert.equal(properties.get("--cp-accent-pressed"), expected.colorBrandBackgroundPressed);
      assert.equal(properties.get("--cp-disabled-fg"), expected.colorNeutralForegroundDisabled);
      assert.equal(properties.get("--cp-font-family"), expected.fontFamilyBase);
      assert.equal(document.documentElement.dataset.palette, "fluent");
      assert.ok([...properties.values()].every(value => typeof value === "string" && value.length));
    }
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test("unsupported stored palettes fall back instead of restoring a removed catalog", () => {
  assert.equal(isPaletteId("fluent"), true);
  for (const value of [undefined, null, "forest", "github", "unknown"]) {
    assert.equal(isPaletteId(value), false);
  }
});

const source = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const refreshSource = source.slice(
  source.indexOf("const refreshTelemetry = useCallback("),
  source.indexOf("const handleCrewsSaved = useCallback("),
);

function refreshHarness(days, shared) {
  const state = shared || {
    telemetryRequest: { current: 0 },
    telemetryAbortRef: { current: null },
    requests: [],
    applied: null,
    loading: [],
    errors: [],
  };
  const context = {
    AbortController, DOMException, Error,
    activeFleetId: "demo", days, project: "all",
    telemetryRequest: state.telemetryRequest,
    telemetryAbortRef: state.telemetryAbortRef,
    fleetAbortRef: { current: null },
    dashboardReadyRef: { current: true },
    useCallback: (fn) => fn,
    getDashboard: (range, project, fleet, signal) => new Promise((resolve, reject) => {
      state.requests.push({ range, project, fleet, signal, resolve, reject });
    }),
    setLoading: (value) => state.loading.push(value),
    setError: (value) => state.errors.push(value),
    setDashboard: (update) => { state.applied = update(state.applied); },
    reconcileDashboard: (_, next) => next,
    runUiTransition: (update) => update(),
  };
  runInNewContext(`${refreshSource}\nglobalThis.refresh = refreshTelemetry;`, context);
  return { state, refresh: context.refresh };
}

test("poll ticks do not cancel a slow range refresh", async () => {
  const { state, refresh } = refreshHarness(90);
  const pending = refresh(true);
  assert.equal(state.loading[0], true);
  assert.equal(state.requests[0].range, 90);
  const polls = [refresh(), refresh()];
  assert.equal(state.requests.length, 1, "Polling must wait for the in-flight response");
  await Promise.all(polls);
  assert.equal(state.requests[0].signal.aborted, false);
  state.requests[0].resolve({ rangeDays: 90 });
  await pending;
  assert.equal(state.applied.rangeDays, 90);
  assert.equal(state.telemetryAbortRef.current, null);

  const next = refresh();
  assert.equal(state.requests.length, 2, "Polling must resume after completion");
  state.requests[1].resolve({ rangeDays: 90 });
  await next;
});

test("a new range starts immediately and supersedes only the old query", async () => {
  const first = refreshHarness(7);
  const oldRequest = first.refresh(true);
  const latest = refreshHarness(30, first.state);
  const newRequest = latest.refresh(true);
  assert.equal(first.state.requests.length, 2);
  assert.equal(first.state.requests[0].signal.aborted, true);
  assert.equal(first.state.requests[1].range, 30);
  const poll = latest.refresh();
  assert.equal(first.state.requests.length, 2);
  await poll;
  first.state.requests[1].resolve({ rangeDays: 30 });
  await newRequest;
  first.state.requests[0].resolve({ rangeDays: 7 });
  await oldRequest;
  assert.equal(first.state.applied.rangeDays, 30, "Late stale responses cannot overwrite the new range");
  assert.equal(first.state.loading.at(-1), false);
});

test("failed requests release polling and an explicit retry can proceed", async () => {
  const { state, refresh } = refreshHarness(7);
  const pending = refresh(true);
  state.requests[0].reject(new Error("Could not refresh"));
  await pending;
  assert.equal(state.errors.at(-1), "Could not refresh");
  assert.equal(state.telemetryAbortRef.current, null);
  const retry = refresh(true);
  assert.equal(state.requests.length, 2);
  state.requests[1].resolve({ rangeDays: 7 });
  await retry;
  assert.equal(state.errors.at(-1), null);
});

test("an aborted cleanup controller cannot block a fresh request", async () => {
  const { state, refresh } = refreshHarness(7);
  const old = refresh(true);
  state.telemetryRequest.current += 1;
  state.telemetryAbortRef.current.abort();
  const next = refresh();
  assert.equal(state.requests.length, 2);
  state.requests[0].resolve({ rangeDays: 1 });
  await old;
  assert.equal(state.applied, null);
  state.requests[1].resolve({ rangeDays: 7 });
  await next;
  assert.equal(state.applied.rangeDays, 7);
});

test("removed projects are excluded case-insensitively across task and activity data", async () => {
  const { filterVisibleProjects, filterProjectItems } = await import("../src/projectVisibility.ts");
  const projects = [{ repository: "example/current" }, { repository: "example/Removed" }];
  const visible = filterVisibleProjects(projects, ["EXAMPLE/removed"]);
  assert.deepEqual(visible, [projects[0]]);
  const records = [
    { id: "active", project: "example/current", status: "running" },
    { id: "history", project: "example/current", status: "completed" },
    { id: "removed-live", project: "example/Removed", status: "running" },
    { id: "removed-history", project: "example/removed", status: "completed" },
    { id: "orphan", project: "unknown", status: "running" },
  ];
  assert.deepEqual(filterProjectItems(records, visible).map(item => item.id), ["active", "history"]);
  assert.equal(records.length, 5, "Hiding does not delete source history");
  assert.equal(filterProjectItems(records, filterVisibleProjects(projects, [])).length, 4,
    "Restoring a project restores its history, but not orphan records");
});

test("only running and stalled records qualify as current Board work", async () => {
  const { activityIsLive } = await import("../src/projectVisibility.ts");
  for (const status of ["running", "stalled"]) assert.equal(activityIsLive({ status }), true);
  for (const status of ["completed", "failed", "cancelled", "unknown", "stale"]) {
    assert.equal(activityIsLive({ status }), false);
  }
});
