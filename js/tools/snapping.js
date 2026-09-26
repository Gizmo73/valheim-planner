import { rotate } from '../core/geometry.js';

export const SNAP_RADIUS_PX = 16;

// Snap points of visible items near a world point.
export function nearbySnapPoints({ plan, library }, at, radius, exclude = []) {
  const skip = new Set(exclude);
  const out = [];
  for (const it of plan.drawOrder()) {
    if (skip.has(it)) continue;
    const reach = (library.get(it.asset)?.radius || 0.5) + radius;
    if (Math.abs(it.x - at.x) > reach || Math.abs(it.y - at.y) > reach) continue;
    out.push(...library.worldSnaps(it));
  }
  return out;
}

/**
 * Centre for an item whose snap point `snapIndex` should follow `cursor` (world metres).
 * grid: that snap point lands on the nearest grid intersection.
 * piece: whichever of the item's snap points is closest to another piece's snap point joins it.
 * free: no snapping.
 */
export function positionItem(env, { asset, rot, snapIndex, cursor, mode, exclude }) {
  const { library, grid, viewport } = env;
  const def = library.get(asset);
  const snaps = def ? library.snaps(def) : [[0, 0]];
  const [sx, sy] = snaps[snapIndex % snaps.length];
  const off = rotate(sx, sy, rot);
  const free = { x: cursor.x - off.x, y: cursor.y - off.y, mode: 'free', target: null };

  if (mode === 'piece') {
    const radius = SNAP_RADIUS_PX / viewport.zoom;
    const targets = nearbySnapPoints(env, cursor, radius * 2, exclude);
    let best = null;
    for (const [px, py] of snaps) {
      const o = rotate(px, py, rot);
      const gx = free.x + o.x, gy = free.y + o.y;
      for (const t of targets) {
        const d = Math.hypot(t.x - gx, t.y - gy);
        if (d < radius && (!best || d < best.d)) best = { d, dx: t.x - gx, dy: t.y - gy, target: t };
      }
    }
    if (best) return { x: free.x + best.dx, y: free.y + best.dy, mode: 'piece', target: best.target };
  }
  if (mode === 'free') return free;
  const g = grid.snap(viewport, cursor.x, cursor.y);
  return { x: g.x - off.x, y: g.y - off.y, mode: 'grid', target: g };
}

// A single point snapped to piece snap points first, then grid intersections (used for alignment pins).
export function snapPoint(env, cursor, free) {
  if (free) return cursor;
  const radius = SNAP_RADIUS_PX / env.viewport.zoom;
  let best = null;
  for (const t of nearbySnapPoints(env, cursor, radius)) {
    const d = Math.hypot(t.x - cursor.x, t.y - cursor.y);
    if (d < radius && (!best || d < best.d)) best = { d, x: t.x, y: t.y };
  }
  if (best) return { x: best.x, y: best.y };
  const g = env.grid.snap(env.viewport, cursor.x, cursor.y);
  return Math.hypot(g.x - cursor.x, g.y - cursor.y) < radius ? g : cursor;
}
