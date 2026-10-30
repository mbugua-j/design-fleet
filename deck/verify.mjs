import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";
import { connectorGeometry } from "./pipeline.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const html = await readFile(resolve(root, "index.html"), "utf8");
const css = await readFile(resolve(root, "deck.css"), "utf8");
const script = await readFile(resolve(root, "deck.js"), "utf8");
const pipelineCss = await readFile(resolve(root, "pipeline.css"), "utf8");
for (const source of [html, css, pipelineCss]) {
  for (const [, hex] of source.matchAll(/#([\da-f]{6})\b/gi)) {
    assert.equal(hex.slice(0, 2).toLowerCase(), hex.slice(2, 4).toLowerCase(), `Non-monochrome color: #${hex}`);
    assert.equal(hex.slice(2, 4).toLowerCase(), hex.slice(4, 6).toLowerCase(), `Non-monochrome color: #${hex}`);
  }
  for (const [, r, g, b] of source.matchAll(/rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/g)) {
    assert.ok(Number(r) === Number(g) && Number(g) === Number(b), `Non-monochrome RGB color: ${r}, ${g}, ${b}`);
  }
}
assert.ok(css.includes('img { filter: grayscale(1); }'), "Artwork must render in grayscale");
assert.match(css, /html, body \{[^}]*background: var\(--cp-bg\)/,
  "The page surrounding the slide must match the slide background");
assert.ok(css.includes('html[data-theme="dark"] .harbour { filter: grayscale(1) invert(1); }'),
  "Dark harbour labels need a dark paper background");
assert.ok(!css.includes("linear-gradient"), "Display titles must use solid monochrome ink");
const themeSource = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(themeSource, "Missing theme initialization");
for (const [search, systemDark, expected] of [
  ["?theme=light", true, "light"], ["?theme=dark", false, "dark"],
  ["?clawpilotTheme=light", true, "light"], ["?clawpilotTheme=dark", false, "dark"],
  ["?theme=light&clawpilotTheme=dark", true, "light"], ["?theme=invalid", false, "light"],
  ["", true, "dark"],
]) {
  let theme;
  runInNewContext(themeSource, {
    URLSearchParams,
    window: { location: { search }, matchMedia: () => ({ matches: systemDark }) },
    document: { documentElement: { setAttribute: (_, value) => { theme = value; } } },
  });
  assert.equal(theme, expected, `Unexpected theme for ${search || "system preference"}`);
}
const roles = JSON.parse(
  await readFile(resolve(root, "../plugins/design-fleet/crews/roles.json"), "utf8")
);
const references = [
  ...[...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1]),
  ...[...pipelineCss.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match => match[1]),
  "fonts/AstaSans-OFL.txt", "Fluent-icons-LICENSE.txt",
].map(reference => reference.split(/[?#]/, 1)[0])
  .filter((reference) => reference && !reference.startsWith("data:") && !/^https?:/.test(reference));

const invalidReference = references.find((reference) =>
  reference.startsWith("/") || reference.includes("..")
);
if (invalidReference) throw new Error(`Unsafe asset reference: ${invalidReference}`);

await Promise.all(references.map((reference) => access(resolve(root, reference))));

const slides = (html.match(/<section class="slide\b/g) || []).length;
if (slides !== 12) throw new Error(`Expected 12 slides, found ${slides}`);
if (/localhost|127\.0\.0\.1|\/Users\//.test(html)) {
  throw new Error("The deck contains a local-only reference");
}

const deckLabels = {
  designr: "DesignR",
  buildr: "BuildR",
  engraver: "engraver",
  lookout: "lookout",
  shipwright: "shipwright",
  surveyor: "surveyor",
  herald: "herald",
  "design-review": "design-review",
  watchkeeper: "watchkeeper",
};

const escapePattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const stations = new Map(roles.stations.map((station) => [station.id, station]));
const workflow = html.slice(html.indexOf('<section class="slide workflow-slide"'), html.indexOf('<!-- 05'));
assert.ok(!/<img\b|<iframe\b|<foreignObject\b|pipeline-demo/.test(workflow),
  "Pipeline must remain editable native elements, not a screenshot or embedded app");
const nodes = [...workflow.matchAll(/<article class="pipeline-node" data-node-id="([^"]+)" data-category="([^"]+)" style="--x:([\d.]+);--y:([\d.]+)">([\s\S]*?)<\/article>/g)];
const pipelineNodes = new Map(nodes.map(([, id, category, x, y, content]) => [id, { category, x: Number(x), y: Number(y), content }]));
assert.equal(nodes.length, 11, "Pipeline needs nine station cards and two outcomes");
assert.equal(pipelineNodes.size, nodes.length, "Duplicate Pipeline node");
const roster = [...html.matchAll(/<article data-station="([^"]+)">([\s\S]*?)<\/article>/g)];
if (roster.length !== roles.stations.length) throw new Error("The full roster must include every canonical station");
if (new Set(roster.map(([, id]) => id)).size !== roster.length) throw new Error("Duplicate roster station");
for (const [ , id, content] of roster) {
  const station = stations.get(id);
  if (!station) throw new Error(`Unknown roster station: ${id}`);
  for (const expected of [
    `<h2>${station.display}</h2>`, `<p>${station.title}</p>`,
    `<code>${station.model}</code>`,
    `${station.family} &middot; reasoning: ${station.reasoningEffort || "inherited"}`,
  ]) {
    if (!content.includes(expected)) throw new Error(`Stale roster content for ${id}: ${expected}`);
  }
  const agent = await readFile(resolve(root, `../plugins/design-fleet/agents/${station.display}.agent.md`), "utf8");
  if (!agent.includes(`\nmodel: ${station.model}\n`)) throw new Error(`Agent and roster disagree for ${id}`);
}
const visibleCopy = html.replace(/<[^>]*>/g, " ");
for (const stale of ["every open PR", "131 assets", "62.1", "Fifty-nine pull requests", "&middot; NEW", ":7979"]) {
  if (visibleCopy.includes(stale)) throw new Error(`Outdated claim in deck: ${stale}`);
}
for (const required of ["Sample data, not live performance", "dashboard-demo.png",
  "5, 10, 30 or 60-second", "prototype", "agreed PR set"]) {
  if (!html.includes(required)) throw new Error(`Missing current content: ${required}`);
}
if (!css.includes('.slide.is-active { transition: opacity .01s linear, visibility 0s; transform: none; }')) {
  throw new Error("Reduced motion must override the active slide transition too");
}
if (!script.includes("s.inert = i !== index") || !script.includes("e.target.closest('a, button')") ||
    !script.includes('input, select, textarea, [contenteditable]:not([contenteditable="false"])')) {
  throw new Error("Navigation must preserve inactive-slide and interactive-element boundaries");
}

let onKeydown;
const navigations = [];
const handlerSource = script.slice(
  script.indexOf("document.addEventListener('keydown'"),
  script.indexOf("stage.addEventListener('click'"),
);
runInNewContext(handlerSource, {
  document: { addEventListener: (_, handler) => { onKeydown = handler; } },
  show: (index) => navigations.push(index),
});
for (const key of ["r", "R"]) {
  for (const modifier of [null, "ctrlKey", "metaKey", "altKey"]) {
    let prevented = false;
    navigations.length = 0;
    onKeydown({
      key,
      target: { closest: () => null },
      ...(modifier ? { [modifier]: true } : {}),
      preventDefault: () => { prevented = true; },
    });
    if (modifier ? prevented || navigations.length : !prevented || navigations.length !== 1 || navigations[0] !== 0) {
      throw new Error(`Restart shortcut failed for ${modifier || "unmodified"} ${key}`);
    }
    for (const tag of ["a", "button", "input", "select", "textarea", "[contenteditable]"]) {
      let prevented = false;
      navigations.length = 0;
      onKeydown({
        key,
        target: { closest: (selector) => selector.split(", ").some((part) =>
          part === tag || (tag === "[contenteditable]" && part.startsWith(tag))) ? {} : null },
        preventDefault: () => { prevented = true; },
      });
      const shouldRestart = tag === "a" || tag === "button";
      assert.equal(prevented, shouldRestart, `Unexpected restart handling while focused on ${tag}`);
      assert.deepEqual(navigations, shouldRestart ? [0] : [], `Unexpected navigation while focused on ${tag}`);
    }
  }
}
if (!html.includes("R restart")) throw new Error("The restart shortcut must be visible in the deck hint");

for (const [id, label] of Object.entries(deckLabels)) {
  const station = stations.get(id);
  if (!station) throw new Error(`Deck station '${id}' is missing from roles.json`);

  const pair = new RegExp(
    `>${escapePattern(label)}</(?:b|text)><(?:i|text)[^>]*>${escapePattern(station.model)}(?:\\s*&middot;\\s*NEW)?</(?:i|text)>`,
    "gi"
  );
  const occurrences = html.match(pair)?.length ?? 0;
  if (occurrences !== 1) {
    throw new Error(
      `Expected '${label}' to show model '${station.model}' in the harbour; found ${occurrences} matching labels`
    );
  }
  const card = pipelineNodes.get(id);
  assert.ok(card?.content.includes(`<h3>${station.display}</h3>`), `Missing native Pipeline card for ${id}`);
  assert.ok(card.content.includes(`<code>${station.model}</code>`), `Stale native Pipeline model for ${id}`);
}
assert.equal((workflow.match(/class="pipeline-model"/g) || []).length, Object.keys(deckLabels).length);
for (const [id, name, detail] of [
  ["pull-request", "Pull request", "Upstream delivery"],
  ["preview", "Preview", "Combined pull requests"],
]) {
  const card = pipelineNodes.get(id);
  assert.equal(card?.category, "outcome");
  assert.ok(card.content.includes(`<h3>${name}</h3>`) && card.content.includes(detail));
}

const appSource = await readFile(resolve(root, "../plugins/design-fleet/dashboard/src/App.tsx"), "utf8");
const layoutSource = await readFile(resolve(root, "../plugins/design-fleet/dashboard/src/pipelineLayout.ts"), "utf8");
const wideSource = layoutSource.match(/wide: (\{[\s\S]*?)\n  compact:/);
assert.ok(wideSource, "Cannot find the app's wide Pipeline layout");
const wide = runInNewContext(`(${wideSource[1].replace(/,\s*$/, "")})`);
assert.deepEqual([...pipelineNodes.keys()].sort(), Object.keys(wide.positions).sort());
for (const [id, node] of pipelineNodes) {
  assert.equal(node.x, wide.positions[id].x, `Pipeline X position differs from app: ${id}`);
  assert.equal(node.y, wide.positions[id].y, `Pipeline Y position differs from app: ${id}`);
}
const edgeSource = appSource.match(/const pipelineConnectorDefinitions[^=]*= (\[[\s\S]*?\n\])/);
assert.ok(edgeSource, "Cannot find the app's connector definitions");
const appEdges = JSON.parse(JSON.stringify(runInNewContext(`(${edgeSource[1]})`)));
const edges = [...workflow.matchAll(/<path data-edge="([^"]+)" data-kind="([^"]+)" data-source="([^"]+)" data-target="([^"]+)"\/>/g)]
  .map(([, id, kind, source, target]) => ({ id, kind, source, target }));
assert.deepEqual(edges, appEdges.map(edge => ({
  id: edge.id, kind: edge.kind,
  source: `${edge.sourceNode}:${edge.sourcePort}`, target: `${edge.targetNode}:${edge.targetPort}`,
})), "Native Pipeline handoffs differ from the app");

const feedbackSource = appSource.match(/const pipelineFeedbackRoutes = (\[[\s\S]*?\n\])/);
assert.ok(feedbackSource, "Cannot find the app's canonical feedback routes");
const appFeedback = JSON.parse(JSON.stringify(runInNewContext(`(${feedbackSource[1]})`)));
const feedback = [...workflow.matchAll(/<article class="pipeline-feedback-route">([\s\S]*?)<\/article>/g)].map(([, content]) => ({
  source: content.match(/class="pipeline-feedback-source">([^<]+)</)?.[1],
  label: content.match(/<h4>([^<]+)</)?.[1],
  target: content.match(/class="pipeline-feedback-target">([^<]+)</)?.[1],
}));
assert.deepEqual(feedback, appFeedback, "Editable feedback routes differ from the app");

assert.equal(connectorGeometry({ x: 152, y: 236 }, { x: 177, y: 236 }, "right", "left").path,
  "M152 236 C164.5 236 164.5 236 177 236");
assert.equal(connectorGeometry({ x: 253, y: 154 }, { x: 253, y: 188 }, "bottom", "top").path,
  "M253 154 C253 171 253 171 253 188");
assert.throws(() => connectorGeometry({ x: NaN, y: 0 }, { x: 1, y: 1 }, "right", "left"), /Invalid Pipeline/);
assert.throws(() => connectorGeometry({ x: 0, y: 0 }, { x: 1, y: 1 }, "invalid", "left"), /Invalid Pipeline/);
const symbols = await readFile(resolve(root, "pipeline-icons.svg"), "utf8");
for (const [, id] of html.matchAll(/pipeline-icons\.svg#([^"]+)/g)) {
  assert.ok(symbols.includes(`<symbol id="${id}"`), `Missing Fluent icon: ${id}`);
}
assert.ok(symbols.includes('<symbol id="drag"'));
assert.ok(pipelineCss.includes('font-family: "Asta Sans"'));

console.log(
  `Verified ${slides} slides, ${references.length} asset references, ${roster.length} canonical defaults, ${pipelineNodes.size} native Pipeline cards, ${edges.length} handoffs and ${feedback.length} feedback routes.`
);
