import { rotate, wrapDeg } from '../core/geometry.js';
import { ROTATION_STEP } from '../core/Viewport.js';
import { positionItem } from './snapping.js';

const FILL_LIMIT = 2000;

// Axis-aligned extent of an outline rotated by `deg` (relative to its centre).
function rotatedBounds(o, deg) {
  if (o.ellipse) {
    const [rx, ry] = o.ellipse, t = deg * Math.PI / 180;
    const hx = Math.hypot(rx * Math.cos(t), ry * Math.sin(t)), hy = Math.hypot(rx * Math.sin(t), ry * Math.cos(t));
    return { minX: -hx, maxX: hx, minY: -hy, maxY: hy };
  }
  const pts = o.poly.map(([x, y]) => rotate(x, y, deg));
  return {
    minX: Math.min(...pts.map(p => p.x)), maxX: Math.max(...pts.map(p => p.x)),
    minY: Math.min(...pts.map(p => p.y)), maxY: Math.max(...pts.map(p => p.y)),
  };
}

export class PlaceTool {
  constructor(env) {
    this.env = env;
    this.asset = null;
    this.rot = 0; // world degrees
    this.snapIndex = 0;
    this.fillMode = false;
    this.ghost = null;
    this.cursor = 'crosshair';
    this._fill = null;
    this.hints = [
      ['Click', 'place'], ['R / Shift+R', 'rotate'], ['Q / E', 'snap point'], ['Ctrl', 'snap to pieces'],
      ['Alt', 'free'], ['F', 'fill area'], ['Shift+Middle', 'pick piece'], ['Esc', 'done'],
    ];
  }

  get viewRotation() {
    return wrapDeg(this.rot + this.env.viewport.rotation);
  }

  // Defaults to square-on to the screen (and so to the grid).
  setAsset(id, rot = -this.env.viewport.rotation) {
    this.asset = id;
    this.rot = wrapDeg(rot);
    this.snapIndex = 0;
    this.refresh();
  }

  activate() {
    this.refresh();
  }

  deactivate() {
    this.ghost = null;
    this._fill = null;
    this.fillMode = false;
  }

  cancel() {
    this._fill = null;
  }

  refresh() {
    const p = this.env.tools.pointer;
    this.ghost = p ? this._ghostAt(p) : null;
    this.env.bus.emit('place:changed');
    this.env.bus.emit('render');
  }

  rotateBy(steps) {
    this.rot = wrapDeg(this.rot + steps * ROTATION_STEP);
    this.refresh();
  }

  cycleSnap(dir) {
    const def = this.env.library.get(this.asset);
    if (!def) return;
    const n = this.env.library.snaps(def).length;
    this.snapIndex = (this.snapIndex + dir + n) % n;
    this.refresh();
  }

  toggleFill() {
    this.fillMode = !this.fillMode;
    this._fill = null;
    this.refresh();
  }

  _ghostAt(p) {
    if (!this.env.library.get(this.asset)) return null;
    const cursor = this.env.viewport.screenToWorld(p.x, p.y);
    const pos = positionItem(this.env, { asset: this.asset, rot: this.rot, snapIndex: this.snapIndex, cursor, mode: this.env.tools.effectiveSnap });
    return { asset: this.asset, rot: this.rot, x: pos.x, y: pos.y, mode: pos.mode, target: pos.target };
  }

  onPointerMove(p) {
    if (this._fill) this._fill.b = this.env.viewport.screenToWorld(p.x, p.y);
    this.ghost = this._ghostAt(p);
    this.env.bus.emit('render');
  }

  onPointerDown(p, e) {
    if (e.button !== 0 || !this.asset) return;
    if (this.fillMode) {
      const w = this.env.viewport.screenToWorld(p.x, p.y);
      this._fill = { a: w, b: w };
      return;
    }
    const g = this._ghostAt(p);
    if (!g) return;
    const { plan } = this.env;
    plan.checkpoint();
    plan.revealGroup(plan.activeGroup);
    plan.addItem(g.asset, g.x, g.y, g.rot);
    plan.changed();
  }

  onPointerUp() {
    if (!this._fill) return;
    this._doFill();
    this._fill = null;
    this.fillMode = false;
    this.refresh();
  }

  onPick(p) {
    const { viewport, plan, library, bus } = this.env;
    const w = viewport.screenToWorld(p.x, p.y);
    const hit = plan.hitTest(w.x, w.y, library);
    if (!hit) return;
    this.setAsset(hit.asset, hit.rot);
    bus.emit('asset:picked', hit.asset);
  }

  onKeyDown(e) {
    if (e.ctrlKey || e.metaKey) return false;
    if (e.code === 'KeyR') this.rotateBy(e.shiftKey ? -1 : 1);
    else if (e.code === 'KeyQ') this.cycleSnap(-1);
    else if (e.code === 'KeyE') this.cycleSnap(1);
    else if (e.code === 'KeyF') this.toggleFill();
    else if (e.code === 'Escape') {
      if (this.fillMode) this.toggleFill();
      else this.env.tools.activate('select');
    } else return false;
    return true;
  }

  _doFill() {
    const { viewport: vp, grid, library, plan } = this.env;
    const def = library.get(this.asset);
    const a = vp.worldToView(this._fill.a.x, this._fill.a.y), b = vp.worldToView(this._fill.b.x, this._fill.b.y);
    const snap = (v, axis) => grid.offset[axis] + Math.round(v - grid.offset[axis]);
    const lo = { x: snap(Math.min(a.x, b.x), 'x'), y: snap(Math.min(a.y, b.y), 'y') };
    const hi = { x: snap(Math.max(a.x, b.x), 'x'), y: snap(Math.max(a.y, b.y), 'y') };
    const bb = rotatedBounds(def.outline, this.viewRotation);
    const bw = bb.maxX - bb.minX, bh = bb.maxY - bb.minY;
    const spots = [];
    for (let y = lo.y; y + bh <= hi.y + 1e-6; y += bh) {
      for (let x = lo.x; x + bw <= hi.x + 1e-6 && spots.length < FILL_LIMIT; x += bw) {
        spots.push(vp.viewToWorld(x - bb.minX, y - bb.minY));
      }
    }
    if (!spots.length) return;
    plan.checkpoint();
    plan.revealGroup(plan.activeGroup);
    for (const s of spots) plan.addItem(this.asset, s.x, s.y, this.rot);
    plan.changed();
  }

  drawOverlay(ctx, vp) {
    const { library } = this.env;
    if (this._fill) {
      const { a, b } = this._fill;
      const va = vp.worldToView(a.x, a.y), vb = vp.worldToView(b.x, b.y);
      const s = vp.worldToScreen(a.x, a.y), t = vp.worldToScreen(b.x, b.y);
      ctx.save();
      ctx.strokeStyle = '#f0b64e';
      ctx.fillStyle = 'rgba(240, 182, 78, 0.12)';
      ctx.setLineDash([6, 4]);
      ctx.fillRect(Math.min(s.x, t.x), Math.min(s.y, t.y), Math.abs(t.x - s.x), Math.abs(t.y - s.y));
      ctx.strokeRect(Math.min(s.x, t.x), Math.min(s.y, t.y), Math.abs(t.x - s.x), Math.abs(t.y - s.y));
      ctx.fillStyle = '#f5e2b8';
      ctx.font = '500 11px ui-monospace, Menlo, monospace';
      ctx.fillText(`${Math.abs(vb.x - va.x).toFixed(1)} × ${Math.abs(vb.y - va.y).toFixed(1)} m`, Math.min(s.x, t.x), Math.min(s.y, t.y) - 6);
      ctx.restore();
      return;
    }
    const g = this.ghost;
    if (!g) return;
    ctx.save();
    vp.applyTo(ctx);
    library.drawItem(ctx, g, vp.zoom, 0.6);
    ctx.restore();

    const def = library.get(g.asset);
    const snaps = library.snaps(def);
    const [sx, sy] = snaps[this.snapIndex % snaps.length];
    const o = rotate(sx, sy, g.rot);
    const dot = vp.worldToScreen(g.x + o.x, g.y + o.y);
    ctx.save();
    ctx.fillStyle = g.mode === 'piece' ? '#f5d547' : '#ff6b6b';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = '500 11px ui-monospace, Menlo, monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    let label = `${this.viewRotation}°`;
    if (snaps.length > 1) label += ` · ${this.snapIndex % snaps.length + 1}/${snaps.length}`;
    if (this.fillMode) label += ' · fill';
    else if (g.mode !== 'grid') label += ` · ${g.mode}`;
    ctx.fillText(label, dot.x + 9, dot.y - 9);
    ctx.restore();
  }
}
