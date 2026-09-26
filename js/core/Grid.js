import { load, save } from './storage.js';
import { wrapDeg } from './geometry.js';

const DEFAULTS = {
  visible: true,
  color: '#4ee3ec',
  minorWidth: 1,
  majorWidth: 2,
  majorEvery: 5,
  abovePieces: true,
};
const MIN_SPACING_PX = 7;

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// 1 m grid drawn in screen space, so it stays screen-aligned whatever the view rotation.
// `offset` (metres, view space) shifts it to line up with the pieces.
export class Grid {
  constructor(bus) {
    this.bus = bus;
    this.settings = { ...DEFAULTS, ...load('gridSettings', {}) };
    this.offset = { x: 0, y: 0 };
  }

  set(key, value) {
    this.settings[key] = value;
    save('gridSettings', this.settings);
    this.bus.emit('grid:changed');
    this.bus.emit('render');
  }

  // Draws at any zoom: when 1 m lines get too dense, each coarser level is `majorEvery` times the last.
  draw(ctx, vp) {
    const s = this.settings;
    if (!s.visible) return;
    const n = Math.max(2, s.majorEvery);
    let minor = 1;
    while (minor * vp.zoom < MIN_SPACING_PX) minor *= n;
    const major = minor * n;
    this._lines(ctx, vp, minor, n, s.minorWidth, hexToRgba(s.color, 0.35));
    this._lines(ctx, vp, major, 0, s.majorWidth, hexToRgba(s.color, 0.85));
  }

  _lines(ctx, vp, step, skipEvery, width, style) {
    ctx.beginPath();
    for (const [axis, pan, size, off] of [['x', vp.panX, vp.width, this.offset.x], ['y', vp.panY, vp.height, this.offset.y]]) {
      const k0 = Math.ceil((-pan / vp.zoom - off) / step);
      const k1 = Math.floor(((size - pan) / vp.zoom - off) / step);
      for (let k = k0; k <= k1; k++) {
        if (skipEvery && ((k % skipEvery) + skipEvery) % skipEvery === 0) continue;
        const p = pan + (off + k * step) * vp.zoom;
        if (axis === 'x') { ctx.moveTo(p, 0); ctx.lineTo(p, vp.height); }
        else { ctx.moveTo(0, p); ctx.lineTo(vp.width, p); }
      }
    }
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  // Grid point (metres, view space) nearest to a world point, returned in world space.
  snap(vp, x, y) {
    const v = vp.worldToView(x, y);
    const gx = this.offset.x + Math.round(v.x - this.offset.x);
    const gy = this.offset.y + Math.round(v.y - this.offset.y);
    return vp.viewToWorld(gx, gy);
  }

  // Shift the grid so it lines up with the edges of pieces that are square to the screen.
  // Uses the circular mean of edge positions mod 1 m, per axis.
  alignTo(items, library, vp) {
    const acc = { x: [0, 0], y: [0, 0] };
    for (const it of items) {
      const a = library.get(it.asset);
      if (!a) continue;
      const turn = wrapDeg(it.rot + vp.rotation) / 90;
      if (Math.abs(turn - Math.round(turn)) > 0.01) continue;
      const [w, h] = Math.round(turn) % 2 ? [a.size[1], a.size[0]] : a.size;
      const v = vp.worldToView(it.x, it.y);
      for (const [axis, len, pos] of [['x', w, v.x - w / 2], ['y', h, v.y - h / 2]]) {
        if (Math.abs(len - Math.round(len)) > 0.02 || len < 0.5) continue;
        const ang = 2 * Math.PI * (pos - Math.floor(pos));
        acc[axis][0] += Math.cos(ang);
        acc[axis][1] += Math.sin(ang);
      }
    }
    let changed = false;
    for (const axis of ['x', 'y']) {
      const [c, s] = acc[axis];
      if (Math.hypot(c, s) < 1e-6) continue;
      const frac = Math.atan2(s, c) / (2 * Math.PI);
      this.offset[axis] = ((frac % 1) + 1) % 1;
      changed = true;
    }
    if (changed) this.bus.emit('render');
    return changed;
  }
}
