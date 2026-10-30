export type PipelineLayoutMode = "wide" | "compact";

export type PipelineNodeId =
  | "designr"
  | "engraver"
  | "design-review"
  | "shipwright"
  | "surveyor"
  | "lookout"
  | "herald"
  | "pull-request"
  | "watchkeeper"
  | "buildr"
  | "preview";

export type PipelinePoint = {
  x: number;
  y: number;
};

export type PipelineSize = {
  width: number;
  height: number;
};

export type PipelinePositionMap = Record<PipelineNodeId, PipelinePoint>;

export type PipelineLayoutConfig = {
  width: number;
  height: number;
  nodeWidth: number;
  nodeHeight: number;
  positions: PipelinePositionMap;
};

export type PipelinePortSide = "left" | "right" | "top" | "bottom";

export const PIPELINE_GRID_SIZE = 40;
export const PIPELINE_KEYBOARD_STEP = 8;
export const PIPELINE_KEYBOARD_LARGE_STEP = PIPELINE_GRID_SIZE;
export const PIPELINE_ZOOM_DEFAULT = 1;
export const PIPELINE_ZOOM_MIN = 0.75;
export const PIPELINE_ZOOM_MAX = 1.25;
export const PIPELINE_ZOOM_STEP = 0.1;

export const PIPELINE_NODE_IDS: readonly PipelineNodeId[] = [
  "designr",
  "engraver",
  "design-review",
  "shipwright",
  "surveyor",
  "lookout",
  "herald",
  "pull-request",
  "watchkeeper",
  "buildr",
  "preview",
];

export const PIPELINE_LAYOUTS: Record<PipelineLayoutMode, PipelineLayoutConfig> = {
  wide: {
    width: 1216,
    height: 510,
    nodeWidth: 152,
    nodeHeight: 96,
    positions: {
      designr: { x: 0, y: 188 },
      engraver: { x: 177, y: 58 },
      "design-review": { x: 177, y: 188 },
      shipwright: { x: 354, y: 188 },
      surveyor: { x: 531, y: 188 },
      lookout: { x: 708, y: 188 },
      herald: { x: 885, y: 188 },
      "pull-request": { x: 1062, y: 188 },
      watchkeeper: { x: 708, y: 326 },
      buildr: { x: 885, y: 326 },
      preview: { x: 1062, y: 326 },
    },
  },
  compact: {
    width: 1000,
    height: 540,
    nodeWidth: 220,
    nodeHeight: 96,
    positions: {
      designr: { x: 10, y: 135 },
      engraver: { x: 255, y: 20 },
      "design-review": { x: 255, y: 135 },
      shipwright: { x: 500, y: 135 },
      surveyor: { x: 745, y: 135 },
      lookout: { x: 745, y: 260 },
      herald: { x: 500, y: 260 },
      "pull-request": { x: 255, y: 260 },
      watchkeeper: { x: 10, y: 395 },
      buildr: { x: 500, y: 395 },
      preview: { x: 745, y: 395 },
    },
  },
};

export function clonePipelinePositions(
  positions: PipelinePositionMap,
): PipelinePositionMap {
  return Object.fromEntries(
    PIPELINE_NODE_IDS.map((nodeId) => [nodeId, { ...positions[nodeId] }]),
  ) as PipelinePositionMap;
}

export function clampPipelinePosition(
  position: PipelinePoint,
  layout: PipelineLayoutConfig,
  zoom = PIPELINE_ZOOM_DEFAULT,
): PipelinePoint {
  const scale = clampPipelineZoom(zoom);
  const minX =
    scale > PIPELINE_ZOOM_DEFAULT
      ? layout.width / 2 - layout.width / (2 * scale)
      : 0;
  const minY =
    scale > PIPELINE_ZOOM_DEFAULT
      ? layout.height / 2 - layout.height / (2 * scale)
      : 0;
  const maxX =
    scale > PIPELINE_ZOOM_DEFAULT
      ? layout.width / 2 + layout.width / (2 * scale) - layout.nodeWidth
      : layout.width - layout.nodeWidth;
  const maxY =
    scale > PIPELINE_ZOOM_DEFAULT
      ? layout.height / 2 + layout.height / (2 * scale) - layout.nodeHeight
      : layout.height - layout.nodeHeight;
  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY),
  };
}

export function movePipelinePositionByKey(
  position: PipelinePoint,
  key: string,
  shiftKey: boolean,
  layout: PipelineLayoutConfig,
  zoom = PIPELINE_ZOOM_DEFAULT,
): PipelinePoint {
  const step = shiftKey
    ? PIPELINE_KEYBOARD_LARGE_STEP
    : PIPELINE_KEYBOARD_STEP;
  const offset =
    key === "ArrowLeft"
      ? { x: -step, y: 0 }
      : key === "ArrowRight"
        ? { x: step, y: 0 }
        : key === "ArrowUp"
          ? { x: 0, y: -step }
          : key === "ArrowDown"
            ? { x: 0, y: step }
            : null;
  if (!offset) return position;
  const next = clampPipelinePosition(
    { x: position.x + offset.x, y: position.y + offset.y },
    layout,
    zoom,
  );
  return next.x === position.x && next.y === position.y ? position : next;
}

export function clampPipelineZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return PIPELINE_ZOOM_DEFAULT;
  return Math.round(
    Math.min(Math.max(zoom, PIPELINE_ZOOM_MIN), PIPELINE_ZOOM_MAX) * 1000,
  ) / 1000;
}

export function parsePipelineZoom(raw: string | null): number {
  if (!raw) return PIPELINE_ZOOM_DEFAULT;
  const parsed = Number(raw);
  return Number.isFinite(parsed)
    ? clampPipelineZoom(parsed)
    : PIPELINE_ZOOM_DEFAULT;
}

export function serializePipelineZoom(zoom: number): string {
  return String(clampPipelineZoom(zoom));
}

export function screenDeltaToPipelineWorld(
  delta: PipelinePoint,
  zoom: number,
  viewport: PipelineSize,
  world: PipelineSize,
): PipelinePoint {
  if (!viewport.width || !viewport.height) return { x: 0, y: 0 };
  const scale = clampPipelineZoom(zoom);
  return {
    x: (delta.x * world.width) / (viewport.width * scale),
    y: (delta.y * world.height) / (viewport.height * scale),
  };
}

export function calculatePipelineFitZoom(
  viewport: PipelineSize,
  positions: PipelinePositionMap,
  layout: PipelineLayoutConfig,
): number {
  if (!viewport.width || !viewport.height) return PIPELINE_ZOOM_DEFAULT;
  const left = Math.min(...PIPELINE_NODE_IDS.map((nodeId) => positions[nodeId].x));
  const top = Math.min(...PIPELINE_NODE_IDS.map((nodeId) => positions[nodeId].y));
  const right =
    Math.max(...PIPELINE_NODE_IDS.map((nodeId) => positions[nodeId].x)) +
    layout.nodeWidth;
  const bottom =
    Math.max(...PIPELINE_NODE_IDS.map((nodeId) => positions[nodeId].y)) +
    layout.nodeHeight;
  const projected = {
    left: (left / layout.width) * viewport.width,
    right: (right / layout.width) * viewport.width,
    top: (top / layout.height) * viewport.height,
    bottom: (bottom / layout.height) * viewport.height,
  };
  const padding = PIPELINE_KEYBOARD_STEP * 2;
  const horizontalCenter = viewport.width / 2;
  const verticalCenter = viewport.height / 2;
  const limits = [PIPELINE_ZOOM_MAX];
  if (projected.left < horizontalCenter) {
    limits.push(
      (horizontalCenter - padding) /
        (horizontalCenter - projected.left),
    );
  }
  if (projected.right > horizontalCenter) {
    limits.push(
      (viewport.width - padding - horizontalCenter) /
        (projected.right - horizontalCenter),
    );
  }
  if (projected.top < verticalCenter) {
    limits.push(
      (verticalCenter - padding) / (verticalCenter - projected.top),
    );
  }
  if (projected.bottom > verticalCenter) {
    limits.push(
      (viewport.height - padding - verticalCenter) /
        (projected.bottom - verticalCenter),
    );
  }
  return clampPipelineZoom(Math.min(...limits));
}

export function parsePipelinePositions(
  raw: string | null,
  layout: PipelineLayoutConfig,
): PipelinePositionMap {
  const positions = clonePipelinePositions(layout.positions);
  if (!raw) return positions;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (error instanceof SyntaxError) return positions;
    throw error;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return positions;
  }

  const values = parsed as Record<string, unknown>;
  for (const nodeId of PIPELINE_NODE_IDS) {
    const candidate = values[nodeId];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      continue;
    }
    const point = candidate as Record<string, unknown>;
    if (typeof point.x !== "number" || typeof point.y !== "number") continue;
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    positions[nodeId] = clampPipelinePosition(
      { x: point.x, y: point.y },
      layout,
    );
  }
  return positions;
}

export function serializePipelinePositions(
  positions: PipelinePositionMap,
): string {
  return JSON.stringify(
    Object.fromEntries(
      PIPELINE_NODE_IDS.map((nodeId) => [nodeId, positions[nodeId]]),
    ),
  );
}

function formatCoordinate(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function sideVector(side: PipelinePortSide): PipelinePoint {
  if (side === "left") return { x: -1, y: 0 };
  if (side === "right") return { x: 1, y: 0 };
  if (side === "top") return { x: 0, y: -1 };
  return { x: 0, y: 1 };
}

function pointText(point: PipelinePoint): string {
  return `${formatCoordinate(point.x)} ${formatCoordinate(point.y)}`;
}

export function buildPipelinePath(options: {
  source: PipelinePoint;
  target: PipelinePoint;
  sourceSide: PipelinePortSide;
  targetSide: PipelinePortSide;
}): string {
  const { source, target } = options;
  const sourceVector = sideVector(options.sourceSide);
  const targetVector = sideVector(options.targetSide);
  const horizontalGap = Math.abs(target.x - source.x);
  const verticalGap = Math.abs(target.y - source.y);
  const sourceRun = sourceVector.x ? horizontalGap : verticalGap;
  const targetRun = targetVector.x ? horizontalGap : verticalGap;
  const distance = Math.min(
    PIPELINE_GRID_SIZE * 3,
    Math.max(PIPELINE_KEYBOARD_STEP, Math.min(sourceRun, targetRun) / 2),
  );
  const sourceControl = {
    x: source.x + sourceVector.x * distance,
    y: source.y + sourceVector.y * distance,
  };
  const targetControl = {
    x: target.x + targetVector.x * distance,
    y: target.y + targetVector.y * distance,
  };
  return [
    `M${pointText(source)}`,
    `C${pointText(sourceControl)}`,
    pointText(targetControl),
    pointText(target),
  ].join(" ");
}
