import { WorkingLayer } from '../layers/WorkingLayer.js';

export class RegionSelectTool {
  constructor(viewport, layerManager, mapScale, bus, gridSettings) {
    this.viewport = viewport;
    this.layerManager = layerManager;
    this.mapScale = mapScale;
    this.bus = bus;
    this.gridSettings = gridSettings;
    this._dragging = false;
    this._startMap = null;
    this._currentMap = null;
  }

  activate() {}

  hitTest() {
    return true;
  }

  deactivate() {
    this._dragging = false;
    this._startMap = null;
    this._currentMap = null;
  }

  onMouseDown(pos) {
    this._startMap = this.viewport.screenToMap(pos.x, pos.y);
    this._dragging = true;
  }

  onMouseMove(pos) {
    if (!this._dragging) return;
    this._currentMap = this.viewport.screenToMap(pos.x, pos.y);
    this.bus.emit('render:request');
  }

  onMouseUp(pos) {
    if (!this._dragging) return;
    this._dragging = false;
    this._currentMap = this.viewport.screenToMap(pos.x, pos.y);

    const rect = this._getRect();
    if (rect.w > 1 && rect.h > 1) {
      const wl = new WorkingLayer(rect.x, rect.y, rect.w, rect.h, this.bus, this.mapScale, this.gridSettings);
      wl.name = 'Build area ' + (this.layerManager.getByType('working').length + 1);
      this.layerManager.addLayer(wl);
      this.bus.emit('tool:activate', 'select');
    }

    this._startMap = null;
    this._currentMap = null;
    this.bus.emit('render:request');
  }

  _getRect() {
    if (!this._startMap || !this._currentMap) return { x: 0, y: 0, w: 0, h: 0 };
    const x = Math.min(this._startMap.x, this._currentMap.x);
    const y = Math.min(this._startMap.y, this._currentMap.y);
    const w = Math.abs(this._currentMap.x - this._startMap.x);
    const h = Math.abs(this._currentMap.y - this._startMap.y);
    return { x, y, w, h };
  }

  renderOverlay(ctx, viewport) {
    if (!this._dragging || !this._startMap || !this._currentMap) return;

    const rect = this._getRect();
    const s1 = viewport.mapToScreen(rect.x, rect.y);
    const s2 = viewport.mapToScreen(rect.x + rect.w, rect.y + rect.h);

    ctx.save();
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);

    ctx.fillStyle = 'rgba(0, 200, 255, 0.1)';
    ctx.fillRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);

    const mpp = this.mapScale.metresPerPixel;
    const wM = Math.round(rect.w * mpp);
    const hM = Math.round(rect.h * mpp);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = '12px monospace';
    ctx.fillText(`${wM}m x ${hM}m`, s1.x + 4, s1.y - 6);

    ctx.restore();
  }
}
