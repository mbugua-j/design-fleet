const SIDES = {
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
  top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 },
};
const PORT_SIDES = {
  input: 'left', output: 'right', top: 'top',
  'branch-output': 'bottom', 'monitoring-output': 'bottom', 'integration-output': 'bottom',
};

// Same routing geometry as the dashboard's buildPipelinePath, without its React runtime.
export function connectorGeometry(source, target, sourceSide, targetSide) {
  const a = SIDES[sourceSide], b = SIDES[targetSide];
  if (!a || !b || ![source.x, source.y, target.x, target.y].every(Number.isFinite)) {
    throw new Error('Invalid Pipeline connector coordinates or port side');
  }
  const dx = Math.abs(target.x - source.x), dy = Math.abs(target.y - source.y);
  const distance = Math.min(120, Math.max(8, Math.min(a.x ? dx : dy, b.x ? dx : dy) / 2));
  const c1 = { x: source.x + a.x * distance, y: source.y + a.y * distance };
  const c2 = { x: target.x + b.x * distance, y: target.y + b.y * distance };
  const point = ({ x, y }) => `${Number(x.toFixed(3))} ${Number(y.toFixed(3))}`;
  return {
    path: `M${point(source)} C${point(c1)} ${point(c2)} ${point(target)}`,
    midpoint: {
      x: (source.x + 3 * c1.x + 3 * c2.x + target.x) / 8,
      y: (source.y + 3 * c1.y + 3 * c2.y + target.y) / 8,
    },
  };
}

export function renderPipeline(canvas) {
  canvas.querySelector('.pipeline-connectors').setAttribute('viewBox', `0 0 ${canvas.clientWidth} ${canvas.clientHeight}`);
  const nodes = new Map([...canvas.querySelectorAll('[data-node-id]')].map(node => [node.dataset.nodeId, node]));
  const document = canvas.ownerDocument;
  function portFor(endpoint) {
    const [id, name] = endpoint.split(':');
    const node = nodes.get(id), side = PORT_SIDES[name];
    if (!node || !side) throw new Error(`Missing Pipeline node or unknown port: ${endpoint}`);
    let port = node.querySelector(`[data-port="${name}"]`);
    if (!port) {
      port = document.createElement('span');
      port.className = 'pipeline-port';
      port.dataset.port = name;
      port.dataset.side = side;
      port.setAttribute('aria-hidden', 'true');
      node.append(port);
    }
    return {
      x: node.offsetLeft + node.clientLeft + port.offsetLeft + port.offsetWidth / 2,
      y: node.offsetTop + node.clientTop + port.offsetTop + port.offsetHeight / 2,
      side,
    };
  }
  for (const [id, node] of nodes) {
    portFor(`${id}:input`);
    portFor(`${id}:output`);
    if (!node.querySelector('.pipeline-drag')) {
      const handle = document.createElement('span');
      handle.className = 'pipeline-drag';
      handle.setAttribute('aria-hidden', 'true');
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const use = document.createElementNS(icon.namespaceURI, 'use');
      use.setAttribute('href', 'pipeline-icons.svg#drag');
      icon.append(use);
      handle.append(icon);
      node.append(handle);
    }
  }
  for (const edge of canvas.querySelectorAll('[data-edge]')) {
    const source = portFor(edge.dataset.source), target = portFor(edge.dataset.target);
    const geometry = connectorGeometry(source, target, source.side, target.side);
    edge.setAttribute('d', geometry.path);
    const label = canvas.querySelector(`[data-edge-label="${edge.dataset.edge}"]`);
    if (label) {
      label.setAttribute('x', geometry.midpoint.x + Number(label.dataset.labelOffsetX || 0));
      label.setAttribute('y', geometry.midpoint.y + Number(label.dataset.labelOffsetY || 0));
    }
  }
}

if (typeof document !== 'undefined') {
  const canvas = document.querySelector('.pipeline-canvas');
  if (!canvas) throw new Error('The editable Pipeline canvas is missing');
  renderPipeline(canvas);
  let frame;
  const scheduleRender = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => renderPipeline(canvas));
  };
  // Source edits to positions, labels or endpoints reconnect the diagram automatically.
  new MutationObserver(scheduleRender).observe(canvas, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['style', 'data-source', 'data-target', 'data-node-id', 'data-label-offset-x', 'data-label-offset-y'],
  });
  const sizes = new ResizeObserver(scheduleRender);
  sizes.observe(canvas);
  canvas.querySelectorAll('[data-node-id]').forEach(node => sizes.observe(node));
}
