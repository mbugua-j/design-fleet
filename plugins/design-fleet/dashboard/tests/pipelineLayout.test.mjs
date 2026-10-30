import assert from "node:assert/strict";
import test from "node:test";

import {
  PIPELINE_KEYBOARD_LARGE_STEP,
  PIPELINE_KEYBOARD_STEP,
  PIPELINE_LAYOUTS,
  PIPELINE_ZOOM_DEFAULT,
  PIPELINE_ZOOM_MAX,
  PIPELINE_ZOOM_MIN,
  buildPipelinePath,
  calculatePipelineFitZoom,
  clampPipelinePosition,
  clampPipelineZoom,
  movePipelinePositionByKey,
  parsePipelinePositions,
  parsePipelineZoom,
  screenDeltaToPipelineWorld,
  serializePipelinePositions,
  serializePipelineZoom,
} from "../src/pipelineLayout.ts";

function pathNumbers(path) {
  return [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) =>
    Number(match[0]),
  );
}

test("clampPipelinePosition keeps the full card inside each canvas", () => {
  assert.deepEqual(
    clampPipelinePosition({ x: -40, y: -12 }, PIPELINE_LAYOUTS.wide),
    { x: 0, y: 0 },
  );
  assert.deepEqual(
    clampPipelinePosition({ x: 2000, y: 900 }, PIPELINE_LAYOUTS.compact),
    {
      x: PIPELINE_LAYOUTS.compact.width - PIPELINE_LAYOUTS.compact.nodeWidth,
      y: PIPELINE_LAYOUTS.compact.height - PIPELINE_LAYOUTS.compact.nodeHeight,
    },
  );
});

test("movePipelinePositionByKey uses port and grid-sized keyboard steps", () => {
  const start = { x: 200, y: 200 };
  assert.deepEqual(
    movePipelinePositionByKey(start, "ArrowRight", false, PIPELINE_LAYOUTS.wide),
    { x: 200 + PIPELINE_KEYBOARD_STEP, y: 200 },
  );
  assert.deepEqual(
    movePipelinePositionByKey(start, "ArrowUp", true, PIPELINE_LAYOUTS.wide),
    { x: 200, y: 200 - PIPELINE_KEYBOARD_LARGE_STEP },
  );
  assert.deepEqual(
    movePipelinePositionByKey(start, "Enter", false, PIPELINE_LAYOUTS.wide),
    start,
  );
});

test("parsePipelinePositions restores valid values and clamps persisted bounds", () => {
  const restored = parsePipelinePositions(
    JSON.stringify({
      shipwright: { x: 420, y: 210 },
      preview: { x: 9000, y: 9000 },
      unknown: { x: 10, y: 10 },
    }),
    PIPELINE_LAYOUTS.wide,
  );

  assert.deepEqual(restored.shipwright, { x: 420, y: 210 });
  assert.deepEqual(restored.preview, {
    x: PIPELINE_LAYOUTS.wide.width - PIPELINE_LAYOUTS.wide.nodeWidth,
    y: PIPELINE_LAYOUTS.wide.height - PIPELINE_LAYOUTS.wide.nodeHeight,
  });
  assert.deepEqual(restored.designr, PIPELINE_LAYOUTS.wide.positions.designr);
  assert.deepEqual(
    parsePipelinePositions("not json", PIPELINE_LAYOUTS.wide),
    PIPELINE_LAYOUTS.wide.positions,
  );
});

test("serialized positions round-trip through validation", () => {
  const positions = parsePipelinePositions(null, PIPELINE_LAYOUTS.compact);
  positions.lookout = { x: 310, y: 280 };
  assert.deepEqual(
    parsePipelinePositions(
      serializePipelinePositions(positions),
      PIPELINE_LAYOUTS.compact,
    ),
    positions,
  );
});

test("smooth connector routes preserve live source and target endpoints", () => {
  const source = { x: 76, y: 284 };
  const target = { x: 226, y: 154 };

  const path = buildPipelinePath({
    source,
    target,
    sourceSide: "top",
    targetSide: "left",
  });
  const numbers = pathNumbers(path);
  assert.deepEqual(numbers.slice(0, 2), [source.x, source.y]);
  assert.deepEqual(numbers.slice(-2), [target.x, target.y]);
  assert.match(path, /^M.+C/);
  assert.doesNotMatch(path, /[HV]/);
});

test("short opposing ports do not create overshooting loops", () => {
  const path = buildPipelinePath({
    source: { x: 100, y: 100 },
    target: { x: 100, y: 120 },
    sourceSide: "bottom",
    targetSide: "top",
  });
  const numbers = pathNumbers(path);
  assert.deepEqual(numbers, [100, 100, 100, 110, 100, 110, 100, 120]);
});

test("zoom values clamp and persist within conservative canvas bounds", () => {
  assert.equal(clampPipelineZoom(0.2), PIPELINE_ZOOM_MIN);
  assert.equal(clampPipelineZoom(2), PIPELINE_ZOOM_MAX);
  assert.equal(parsePipelineZoom(null), PIPELINE_ZOOM_DEFAULT);
  assert.equal(parsePipelineZoom("not a number"), PIPELINE_ZOOM_DEFAULT);
  assert.equal(parsePipelineZoom("1.2"), 1.2);
  assert.equal(
    parsePipelineZoom(serializePipelineZoom(1.1)),
    1.1,
  );
});

test("screenDeltaToPipelineWorld compensates for layout scale and zoom", () => {
  const delta = screenDeltaToPipelineWorld(
    { x: 60, y: 24 },
    1.2,
    { width: 608, height: 510 },
    {
      width: PIPELINE_LAYOUTS.wide.width,
      height: PIPELINE_LAYOUTS.wide.height,
    },
  );
  assert.equal(delta.x, 100);
  assert.equal(delta.y, 20);
});

test("zoom-aware clamping keeps dragged cards inside the visible world", () => {
  const zoom = 1.25;
  const clamped = clampPipelinePosition(
    { x: -100, y: 900 },
    PIPELINE_LAYOUTS.wide,
    zoom,
  );
  assert.deepEqual(clamped, {
    x:
      PIPELINE_LAYOUTS.wide.width / 2 -
      PIPELINE_LAYOUTS.wide.width / (2 * zoom),
    y:
      PIPELINE_LAYOUTS.wide.height / 2 +
      PIPELINE_LAYOUTS.wide.height / (2 * zoom) -
      PIPELINE_LAYOUTS.wide.nodeHeight,
  });
});

test("fit zoom derives from the available working region and node bounds", () => {
  const small = calculatePipelineFitZoom(
    { width: 700, height: 420 },
    PIPELINE_LAYOUTS.wide.positions,
    PIPELINE_LAYOUTS.wide,
  );
  const large = calculatePipelineFitZoom(
    { width: 1200, height: 700 },
    PIPELINE_LAYOUTS.wide.positions,
    PIPELINE_LAYOUTS.wide,
  );
  assert.ok(small >= PIPELINE_ZOOM_MIN && small <= PIPELINE_ZOOM_MAX);
  assert.ok(large >= PIPELINE_ZOOM_MIN && large <= PIPELINE_ZOOM_MAX);
  assert.ok(small < large);
});
