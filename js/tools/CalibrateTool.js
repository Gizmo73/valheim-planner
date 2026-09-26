import { snapPoint } from './snapping.js';

const PIN_HIT_PX = 11;
const LOUPE_RADIUS = 64;
const LOUPE_ZOOM = 4;

// Aligns the screenshot with point pairs: click a feature on the image, then click where it
// belongs (snaps to piece corners and grid points). Pins stay draggable for fine-tuning.
export class CalibrateTool {
  constructor(env) {
    this.env = env;
    this._pending = null; // image px of a half-made pair
    this.cursor = 'crosshair';
    this._drag = -1;
    this.hints = [
      ['Click', 'a spot on the image'], ['Click', 'the same spot on a piece'], ['Drag pin', 'fine-tune'],
      ['Right-click pin', 'remove'], ['Alt', 'no snapping'], ['Esc', 'done'],
    ];
  }

  get pending() {
    return this._pending;
  }

  set pending(v) {
    if (v === this._pending) return;
    this._pending = v;
    this.env.bus.emit('align:changed');
  }

  get shot() {
    return this.env.plan.screenshot;
  }

  enabled() {
    return !!this.shot;
  }

  activate() {
    this.pending = null;
  }

  deactivate() {
    this.pending = null;
    this._drag = -1;
    if (this.shot) this.shot.dragging = false;
  }

  cancel() {
    this.deactivate();
  }

  refresh() {
    this.env.bus.emit('render');
  }

  _changed() {
    this.shot.solve();
    this.shot.commitBase();
    this.env.bus.emit('screenshot:changed');
    this.env.bus.emit('render');
  }

  _pairAt(p) {
    const { viewport } = this.env;
    return this.shot.pairs.findIndex(pr => {
      const s = viewport.worldToScreen(pr.world.x, pr.world.y);
      return Math.hypot(s.x - p.x, s.y - p.y) < PIN_HIT_PX;
    });
  }

  _target(p) {
    const w = this.env.viewport.screenToWorld(p.x, p.y);
    return snapPoint(this.env, w, this.env.tools.mods.alt);
  }

  removePair(i) {
    this.shot.pairs.splice(i, 1);
    this._changed();
  }

  clear() {
    this.shot.pairs = [];
    this.pending = null;
    this._changed();
  }

  onPointerDown(p, e) {
    if (!this.shot) return;
    const hit = this._pairAt(p);
    if (e.button === 2) {
      if (hit >= 0) this.removePair(hit);
      else this.pending = null;
      return this.refresh();
    }
    if (e.button !== 0) return;
    if (hit >= 0 && !this.pending) {
      this._drag = hit;
      this.shot.dragging = true;
      return;
    }
    if (!this.pending) {
      const w = this.env.viewport.screenToWorld(p.x, p.y);
      this.pending = this.shot.worldToImage(w.x, w.y);
      return this.refresh();
    }
    this.shot.pairs.push({ img: this.pending, world: this._target(p) });
    this.pending = null;
    this._changed();
  }

  onPointerMove(p) {
    if (this._drag >= 0) {
      this.shot.pairs[this._drag].world = this._target(p);
      this.shot.solve();
    }
    this.refresh();
  }

  onPointerUp() {
    if (this._drag < 0) return;
    this._drag = -1;
    this.shot.dragging = false;
    this._changed();
  }

  onKeyDown(e) {
    if (e.code === 'Escape') {
      if (this.pending) this.pending = null;
      else this.env.tools.activate('select');
    } else if ((e.code === 'Backspace' || e.code === 'Delete') && this.shot?.pairs.length) {
      this.removePair(this.shot.pairs.length - 1);
    } else return false;
    this.refresh();
    return true;
  }

  drawOverlay(ctx, vp) {
    const s = this.shot;
    if (!s) return;
    const pointer = this.env.tools.pointer;
    ctx.save();
    ctx.font = '600 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    s.pairs.forEach((pr, i) => {
      const at = vp.worldToScreen(pr.world.x, pr.world.y);
      const img = s.imageToWorld(pr.img.x, pr.img.y);
      const from = vp.worldToScreen(img.x, img.y);
      if (Math.hypot(from.x - at.x, from.y - at.y) > 1) {
        ctx.strokeStyle = '#f5d547';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(at.x, at.y);
        ctx.stroke();
      }
      this._pin(ctx, at, i + 1, i === this._drag);
    });
    if (this.pending) {
      const img = s.imageToWorld(this.pending.x, this.pending.y);
      const from = vp.worldToScreen(img.x, img.y);
      if (pointer) {
        const t = this._target(pointer);
        const to = vp.worldToScreen(t.x, t.y);
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = '#b5abfc';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.strokeRect(to.x - 4, to.y - 4, 8, 8);
      }
      this._pin(ctx, from, s.pairs.length + 1, true, true);
    }
    ctx.restore();
    if (pointer) this._loupe(ctx, pointer, vp);
  }

  _pin(ctx, at, n, active, hollow) {
    ctx.beginPath();
    ctx.arc(at.x, at.y, 8.5, 0, Math.PI * 2);
    ctx.fillStyle = hollow ? 'rgba(28, 30, 44, 0.6)' : 'rgba(28, 30, 44, 0.95)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = active ? '#f5d547' : '#b5abfc';
    ctx.stroke();
    ctx.fillStyle = '#ddd9fd';
    ctx.fillText(String(n), at.x, at.y + 0.5);
  }

  // Magnified view of what's under the cursor, for placing pins precisely.
  _loupe(ctx, p, vp) {
    const dpr = ctx.getTransform().a;
    const R = LOUPE_RADIUS, src = R / LOUPE_ZOOM;
    const cx = p.x + R * 1.4 + R > vp.width ? p.x - R * 1.4 : p.x + R * 1.4;
    const cy = p.y - R * 1.4 - R < 0 ? p.y + R * 1.4 : p.y - R * 1.4;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = '#161826';
    ctx.fill();
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ctx.canvas, (p.x - src) * dpr, (p.y - src) * dpr, src * 2 * dpr, src * 2 * dpr, cx - R, cy - R, R * 2, R * 2);
    ctx.strokeStyle = 'rgba(255, 107, 107, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = '#b5abfc';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
