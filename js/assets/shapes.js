export const SHAPES = ['rect', 'triangle', 'octagon', 'circle'];

// Footprint in metres, centred on the asset origin: { ellipse: [rx, ry] } or { poly: [[x, y], ...] }.
export function outline(shape, [w, h]) {
  const hw = w / 2, hh = h / 2;
  if (Array.isArray(shape)) return { poly: shape };
  if (shape === 'circle') return { ellipse: [hw, hh] };
  if (shape === 'triangle') return { poly: [[-hw, hh], [hw, hh], [-hw, -hh]] };
  if (shape === 'octagon') {
    const c = Math.min(w, h) * 0.2929;
    return { poly: [[-hw + c, -hh], [hw - c, -hh], [hw, -hh + c], [hw, hh - c], [hw - c, hh], [-hw + c, hh], [-hw, hh - c], [-hw, -hh + c]] };
  }
  return { poly: [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]] };
}

export function tracePath(ctx, o, scale = 1, ox = 0, oy = 0) {
  if (o.ellipse) {
    const [rx, ry] = o.ellipse;
    ctx.moveTo(ox + rx * scale, oy);
    ctx.ellipse(ox, oy, rx * scale, ry * scale, 0, 0, Math.PI * 2);
    return;
  }
  o.poly.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, ox + x * scale, oy + y * scale));
  ctx.closePath();
}

export function containsLocal(o, x, y) {
  if (o.ellipse) {
    const [rx, ry] = o.ellipse;
    return (x / rx) ** 2 + (y / ry) ** 2 <= 1;
  }
  let inside = false;
  const p = o.poly;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const round = n => Math.round(n * 1000) / 1000;

// Snap point sets offered in the editor.
export function snapSets(o) {
  if (o.ellipse) {
    const [rx, ry] = o.ellipse;
    return { centre: [[0, 0]], cardinals: [[0, -ry], [rx, 0], [0, ry], [-rx, 0]] };
  }
  const p = o.poly;
  const n = p.length;
  const cx = p.reduce((s, q) => s + q[0], 0) / n, cy = p.reduce((s, q) => s + q[1], 0) / n;
  return {
    corners: p.map(([x, y]) => [round(x), round(y)]),
    edges: p.map(([x, y], i) => [round((x + p[(i + 1) % n][0]) / 2), round((y + p[(i + 1) % n][1]) / 2)]),
    centre: [[round(cx), round(cy)]],
  };
}

export function defaultSnaps(o) {
  const s = snapSets(o);
  return o.ellipse ? s.centre : [...s.corners, ...s.edges];
}
