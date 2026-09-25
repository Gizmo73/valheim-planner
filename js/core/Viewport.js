import { DEG, wrapDeg } from './geometry.js';

export const ROTATION_STEP = 22.5;

// World units are metres: x = east, y = south (Valheim -z), origin at the anchor sign.
// Screen = pan + zoom * R(rotation) * world.
export class Viewport {
  constructor(bus) {
    this.bus = bus;
    this.panX = 0;
    this.panY = 0;
    this.zoom = 24; // px per metre
    this.rotation = 0; // degrees
    this.width = 0;
    this.height = 0;
    this.minZoom = 0.5;
    this.maxZoom = 400;
  }

  _changed() {
    this.bus.emit('view:changed');
    this.bus.emit('render');
  }

  // Keeps whatever was at the centre of the view there when the canvas changes size.
  resize(w, h) {
    this.panX += (w - this.width) / 2;
    this.panY += (h - this.height) / 2;
    this.width = w;
    this.height = h;
  }

  worldToScreen(x, y) {
    const c = Math.cos(this.rotation * DEG), s = Math.sin(this.rotation * DEG);
    return { x: this.panX + this.zoom * (x * c - y * s), y: this.panY + this.zoom * (x * s + y * c) };
  }

  screenToWorld(sx, sy) {
    const c = Math.cos(this.rotation * DEG), s = Math.sin(this.rotation * DEG);
    const ux = (sx - this.panX) / this.zoom, uy = (sy - this.panY) / this.zoom;
    return { x: ux * c + uy * s, y: -ux * s + uy * c };
  }

  // "View" space is world rotated to screen orientation, still in metres — the grid lives here.
  worldToView(x, y) {
    const c = Math.cos(this.rotation * DEG), s = Math.sin(this.rotation * DEG);
    return { x: x * c - y * s, y: x * s + y * c };
  }

  viewToWorld(x, y) {
    const c = Math.cos(this.rotation * DEG), s = Math.sin(this.rotation * DEG);
    return { x: x * c + y * s, y: -x * s + y * c };
  }

  applyTo(ctx) {
    ctx.translate(this.panX, this.panY);
    ctx.rotate(this.rotation * DEG);
    ctx.scale(this.zoom, this.zoom);
  }

  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
    this._changed();
  }

  zoomAt(sx, sy, factor) {
    const zoom = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom * factor));
    if (zoom === this.zoom) return;
    const w = this.screenToWorld(sx, sy);
    this.zoom = zoom;
    const after = this.worldToScreen(w.x, w.y);
    this.panX += sx - after.x;
    this.panY += sy - after.y;
    this._changed();
  }

  // Rotates about the screen centre so the view doesn't jump.
  setRotation(deg) {
    const centre = this.screenToWorld(this.width / 2, this.height / 2);
    this.rotation = wrapDeg(deg);
    const after = this.worldToScreen(centre.x, centre.y);
    this.panX += this.width / 2 - after.x;
    this.panY += this.height / 2 - after.y;
    this.bus.emit('view:rotated', this.rotation);
    this._changed();
  }

  rotateBy(steps) {
    this.setRotation(this.rotation + steps * ROTATION_STEP);
  }

  fit(bounds, padding = 0.1) {
    if (!bounds) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of [[bounds.minX, bounds.minY], [bounds.maxX, bounds.minY], [bounds.maxX, bounds.maxY], [bounds.minX, bounds.maxY]]) {
      const v = this.worldToView(x, y);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    const w = Math.max(maxX - minX, 4), h = Math.max(maxY - minY, 4);
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, Math.min(this.width / w, this.height / h) * (1 - padding * 2)));
    this.panX = this.width / 2 - this.zoom * (minX + maxX) / 2;
    this.panY = this.height / 2 - this.zoom * (minY + maxY) / 2;
    this._changed();
  }
}
