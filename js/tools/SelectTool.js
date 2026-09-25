import { rotate, wrapDeg } from '../core/geometry.js';
import { ROTATION_STEP } from '../core/Viewport.js';
import { tracePath } from '../assets/shapes.js';
import { positionItem } from './snapping.js';

const DRAG_THRESHOLD_PX = 3;

export class SelectTool {
  constructor(env) {
    this.env = env;
    this.selection = [];
    this.snapIndex = 0;
    this.cursor = 'default';
    this._drag = null;
    this._box = null;
    this.hints = [
      ['Click', 'select'], ['Shift+Click', 'add'], ['Drag', 'move / box select'], ['R', 'rotate'],
      ['D', 'duplicate'], ['G', 'new layer'], ['Arrows', 'nudge 1 m'], ['Del', 'delete'], ['Ctrl+A', 'all'],
    ];
    env.bus.on('plan:changed', () => {
      const alive = new Set(env.plan.items);
      if (this.selection.some(it => !alive.has(it))) this.select(this.selection.filter(it => alive.has(it)));
    });
  }

  get primary() {
    return this.selection[this.selection.length - 1] || null;
  }

  select(list) {
    this.selection = list;
    this.snapIndex = 0;
    this.env.bus.emit('selection:changed', list);
    this.env.bus.emit('render');
  }

  deactivate() {
    this._drag = this._box = null;
    this.select([]);
  }

  cancel() {
    this._drag = this._box = null;
  }

  refresh() {
    this.env.bus.emit('render');
  }

  onPointerDown(p, e) {
    if (e.button !== 0) return;
    const { viewport, plan, library } = this.env;
    const w = viewport.screenToWorld(p.x, p.y);
    const hit = plan.hitTest(w.x, w.y, library);
    if (!hit) {
      if (!e.shiftKey) this.select([]);
      this._box = { a: p, b: p, add: e.shiftKey };
      return;
    }
    if (e.shiftKey) {
      const has = this.selection.includes(hit);
      this.select(has ? this.selection.filter(it => it !== hit) : [...this.selection, hit]);
      if (has) return;
    } else if (!this.selection.includes(hit)) {
      this.select([hit]);
    } else {
      this.select([...this.selection.filter(it => it !== hit), hit]); // make it the primary
    }
    const snap = this._primarySnap();
    this._drag = {
      start: p,
      moved: false,
      grab: { x: w.x - snap.x, y: w.y - snap.y },
      origin: new Map(this.selection.map(it => [it, { x: it.x, y: it.y }])),
    };
  }

  _primarySnap() {
    const pts = this.env.library.worldSnaps(this.primary);
    return pts[this.snapIndex % pts.length];
  }

  onPointerMove(p) {
    const { viewport, plan } = this.env;
    if (this._box) {
      this._box.b = p;
      this.env.bus.emit('render');
      return;
    }
    const d = this._drag;
    if (!d) return;
    if (!d.moved) {
      if (Math.hypot(p.x - d.start.x, p.y - d.start.y) < DRAG_THRESHOLD_PX) return;
      d.moved = true;
      plan.checkpoint();
    }
    const w = viewport.screenToWorld(p.x, p.y);
    const lead = this.primary;
    const pos = positionItem(this.env, {
      asset: lead.asset, rot: lead.rot, snapIndex: this.snapIndex, mode: this.env.tools.effectiveSnap,
      cursor: { x: w.x - d.grab.x, y: w.y - d.grab.y }, exclude: this.selection,
    });
    const o = d.origin.get(lead);
    const dx = pos.x - o.x, dy = pos.y - o.y;
    for (const it of this.selection) {
      const s = d.origin.get(it);
      it.x = s.x + dx;
      it.y = s.y + dy;
    }
    this.env.bus.emit('selection:moved');
    this.env.bus.emit('render');
  }

  onPointerUp() {
    if (this._box) {
      const { a, b, add } = this._box;
      const { viewport, plan } = this.env;
      const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
      this._box = null;
      if (x1 - x0 < DRAG_THRESHOLD_PX && y1 - y0 < DRAG_THRESHOLD_PX) return this.env.bus.emit('render');
      const hits = plan.visibleItems().filter(it => {
        const s = viewport.worldToScreen(it.x, it.y);
        return s.x >= x0 && s.x <= x1 && s.y >= y0 && s.y <= y1;
      });
      this.select(add ? [...new Set([...this.selection, ...hits])] : hits);
      return;
    }
    if (this._drag?.moved) this.env.plan.changed();
    this._drag = null;
  }

  onPick(p) {
    const { viewport, plan, library, tools, bus } = this.env;
    const w = viewport.screenToWorld(p.x, p.y);
    const hit = plan.hitTest(w.x, w.y, library);
    if (!hit) return;
    tools.activate('place');
    tools.tools.place.setAsset(hit.asset, hit.rot);
    bus.emit('asset:picked', hit.asset);
  }

  onDoubleClick(p) {
    const { viewport, plan, library, bus } = this.env;
    const w = viewport.screenToWorld(p.x, p.y);
    const hit = plan.hitTest(w.x, w.y, library);
    if (hit) bus.emit('asset:edit', hit.asset);
  }

  // --- commands (also used by the inspector) ---

  rotateSelection(steps) {
    if (!this.selection.length) return;
    this.env.plan.checkpoint();
    const deg = steps * ROTATION_STEP;
    const cx = this.selection.reduce((s, it) => s + it.x, 0) / this.selection.length;
    const cy = this.selection.reduce((s, it) => s + it.y, 0) / this.selection.length;
    for (const it of this.selection) {
      const r = rotate(it.x - cx, it.y - cy, deg);
      it.x = cx + r.x;
      it.y = cy + r.y;
      it.rot = wrapDeg(it.rot + deg);
    }
    this.env.plan.changed();
  }

  nudge(dx, dy) {
    if (!this.selection.length) return;
    this.env.plan.checkpoint();
    const d = this.env.viewport.viewToWorld(dx, dy);
    for (const it of this.selection) {
      it.x += d.x;
      it.y += d.y;
    }
    this.env.plan.changed();
  }

  deleteSelection() {
    if (!this.selection.length) return;
    this.env.plan.checkpoint();
    this.env.plan.removeItems(this.selection);
  }

  placeMore() {
    const it = this.primary;
    if (!it) return;
    this.env.tools.activate('place');
    this.env.tools.tools.place.setAsset(it.asset, it.rot);
  }

  moveToGroup(groupId) {
    const { plan } = this.env;
    if (!this.selection.length) return;
    plan.checkpoint();
    if (groupId === 'new') groupId = plan.addGroup(`Layer ${plan.groups.length + 1}`).id;
    plan.moveItemsToGroup(this.selection, groupId);
  }

  onKeyDown(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.code === 'KeyA') {
      this.select(this.env.plan.visibleItems());
      return true;
    }
    if (ctrl) return false;
    const arrows = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (arrows[e.code]) this.nudge(...arrows[e.code]);
    else if (e.code === 'KeyR') this.rotateSelection(e.shiftKey ? -1 : 1);
    else if (e.code === 'KeyQ' || e.code === 'KeyE') {
      const n = this.primary ? this.env.library.worldSnaps(this.primary).length : 1;
      this.snapIndex = (this.snapIndex + (e.code === 'KeyE' ? 1 : n - 1)) % n;
      this.env.bus.emit('render');
    } else if (e.code === 'KeyD') this.placeMore();
    else if (e.code === 'KeyG') this.moveToGroup('new');
    else if (e.code === 'Delete' || e.code === 'Backspace') this.deleteSelection();
    else if (e.code === 'Escape') this.select([]);
    else return false;
    return true;
  }

  drawOverlay(ctx, vp) {
    const { library } = this.env;
    ctx.save();
    ctx.strokeStyle = '#4ee3ec';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    for (const it of this.selection) {
      const def = library.get(it.asset);
      if (!def) continue;
      ctx.save();
      vp.applyTo(ctx);
      ctx.translate(it.x, it.y);
      ctx.rotate(it.rot * Math.PI / 180);
      ctx.beginPath();
      tracePath(ctx, def.outline);
      ctx.restore();
      ctx.stroke();
    }
    ctx.setLineDash([]);
    if (this.primary && library.get(this.primary.asset)) {
      const s = this._primarySnap();
      const dot = vp.worldToScreen(s.x, s.y);
      ctx.fillStyle = '#ff6b6b';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (this._box) {
      const { a, b } = this._box;
      ctx.strokeStyle = '#4ee3ec';
      ctx.fillStyle = 'rgba(78, 227, 236, 0.08)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    }
    ctx.restore();
  }
}
