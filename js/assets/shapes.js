export function rect(w, h) {
  const hw = w / 2, hh = h / 2;
  return [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }];
}

export function triangle(w, h) {
  const hw = w / 2, hh = h / 2;
  return [{ x: -hw, y: hh }, { x: hw, y: hh }, { x: -hw, y: -hh }];
}

export function octagon(across) {
  const h = across / 2;
  const d = across * 0.2;
  return [
    { x: -h + d, y: -h }, { x: h - d, y: -h }, { x: h, y: -h + d }, { x: h, y: h - d },
    { x: h - d, y: h }, { x: -h + d, y: h }, { x: -h, y: h - d }, { x: -h, y: -h + d },
  ];
}

export function circle(r) {
  return { circle: true, r };
}

export function isCircle(shapeResult) {
  return !!(shapeResult && shapeResult.circle);
}

export function boundsOf(shapeResult) {
  if (isCircle(shapeResult)) {
    return { minX: -shapeResult.r, minY: -shapeResult.r, maxX: shapeResult.r, maxY: shapeResult.r };
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of shapeResult) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export function areaCentroid(verts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < verts.length; i++) {
    const p = verts[i], q = verts[(i + 1) % verts.length];
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-9) {
    // Degenerate polygon (zero area) — fall back to the vertex average.
    const n = verts.length || 1;
    const sx = verts.reduce((s, p) => s + p.x, 0);
    const sy = verts.reduce((s, p) => s + p.y, 0);
    return { x: sx / n, y: sy / n };
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function edgeMidpoints(verts) {
  return verts.map((p, i) => {
    const q = verts[(i + 1) % verts.length];
    return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  });
}

// Snap-point candidates derived purely from shape() output, per the design
// handoff: vertices, true edge midpoints, area centroid; circles get centre
// + four cardinal radius points instead of vertices.
export function snapCandidates(shapeResult) {
  if (isCircle(shapeResult)) {
    const r = shapeResult.r;
    return {
      vertices: [],
      edgeMids: [],
      centroid: { x: 0, y: 0 },
      cardinals: [{ x: 0, y: -r }, { x: r, y: 0 }, { x: 0, y: r }, { x: -r, y: 0 }],
    };
  }
  return {
    vertices: shapeResult,
    edgeMids: edgeMidpoints(shapeResult),
    centroid: areaCentroid(shapeResult),
    cardinals: [],
  };
}

// Shared shape() dispatcher: reads current dimensions from the variant's
// own meta entry, so an Attributes-tab dimension edit is reflected in the
// outline/hit-test immediately with no separate sync step. A hand-authored
// `customVerts` on the variant (metres, from the Source tab) always wins.
export function shapeFromVariant(meta, id) {
  const v = meta.variants.find(x => x.id === id);
  if (!v) return rect(1, 1);
  if (v.customVerts) return v.customVerts;
  if (v.shapeKind === 'circle') return circle(Math.max(v.widthM, v.heightM) / 2);
  if (v.shapeKind === 'octagon') return octagon(Math.max(v.widthM, v.heightM));
  if (v.shapeKind === 'triangle') return triangle(v.widthM, v.heightM);
  return rect(v.widthM, v.heightM);
}

export function pointInPolygon(x, y, verts) {
  let inside = false;
  for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
    const xi = verts[i].x, yi = verts[i].y;
    const xj = verts[j].x, yj = verts[j].y;
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
