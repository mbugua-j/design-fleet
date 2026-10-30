import assert from "node:assert/strict";
import { test } from "node:test";

let moduleId = 0;
async function setup() {
  globalThis.window = new EventTarget();
  const api = await import(`../src/api.ts?test=${moduleId++}`);
  globalThis.fetch = async () => Response.json({
    available: true,
    accounts: [
      { host: "github.com", login: "Work", active: true, state: "success" },
      { host: "github.com", login: "personal", active: false, state: "success" },
    ],
    error: null,
  });
  await api.getAuthStatus();
  return api;
}

test("data requests and preferences use only the active identity", async () => {
  const api = await setup();
  globalThis.fetch = async (_, init) => {
    assert.equal(init.headers.get("X-Design-Fleet-Account"), "github.com/work");
    return Response.json({ fleets: [] });
  };
  assert.deepEqual(await api.getFleets(), { fleets: [] });
  assert.equal(api.accountStorageKey("fleet"), "fleet:github.com/work");
});

test("switching discards an old response even if fetch ignores abort", async () => {
  const api = await setup();
  let finish;
  globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
  const pending = api.getDashboard(7, "all", "work-fleet");
  api.clearAccountContext();
  finish(Response.json({ projects: ["private-work"] }));
  await assert.rejects(pending, { name: "AbortError" });
});

test("switching during JSON parsing also discards the previous account", async () => {
  const api = await setup();
  let parse;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: () => new Promise(resolve => { parse = resolve; }),
  });
  const pending = api.getFleets();
  await new Promise(resolve => setImmediate(resolve));
  api.clearAccountContext();
  parse({ fleets: ["private-work"] });
  await assert.rejects(pending, { name: "AbortError" });
});

test("external account changes invalidate the page and block further data requests", async () => {
  const api = await setup();
  let changes = 0;
  window.addEventListener("design-fleet-account-changed", () => { changes += 1; });
  globalThis.fetch = async () => Response.json({ error: "Account changed" }, { status: 409 });
  await assert.rejects(api.getFleets(), { name: "AbortError" });
  assert.equal(changes, 1);
  globalThis.fetch = () => assert.fail("Data must not load without account context");
  await assert.rejects(api.getFleets(), { name: "AbortError" });
});

test("inactive signed-in accounts do not supply request identity", async () => {
  const api = await setup();
  globalThis.fetch = async () => Response.json({
    accounts: [{ host: "github.com", login: "work", active: false, state: "success" }],
  });
  await api.getAuthStatus();
  globalThis.fetch = () => assert.fail("Inactive account must not issue data requests");
  await assert.rejects(api.getFleets(), { name: "AbortError" });
});
