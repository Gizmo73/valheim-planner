import { WORLD_DIAMETER } from '../core/MapScale.js';

export class CalibrationTool {
  constructor(viewport, mapLayer, mapScale, bus) {
    this.viewport = viewport;
    this.mapLayer = mapLayer;
    this.mapScale = mapScale;
    this.bus = bus;
    this._centerX = 0;
    this._centerY = 0;
    this._radius = 0;
    this._dragging = false;
    this._dragType = null;
    this._dragStart = null;
    this._startRadius = 0;
    this._startCenter = null;
    this._initialized = false;
    this._updatingFromCircle = false;

    bus.on('scale:changed', () => {
      if (!this._updatingFromCircle && this._initialized) {
        this._radius = this.mapScale.circleDiameterPx() / 2;
        this.bus.emit('render:request');
      }
    });
  }

  activate() {
    if (!this._initialized && this.mapLayer.image) {
      this._centerX = this.mapLayer.width / 2;
      this._centerY = this.mapLayer.height / 2;
      this._radius = Math.min(this.mapLayer.width, this.mapLayer.height) * 0.4;
      this._updateScaleFromCircle();
      this._initialized = true;
    }
  }

  deactivate() {}

  _updateScaleFromCircle() {
    this._updatingFromCircle = true;
    this.mapScale.setFromCircleDiameter(this._radius * 2);
    this._updatingFromCircle = false;
  }

  _hitTest(mapX, mapY) {
    const dist = Math.hypot(mapX - this._centerX, mapY - this._centerY);
    const threshold = 12 / this.viewport.zoom;
    if (Math.abs(dist - this._radius) < threshold) return 'edge';
    if (dist < this._radius - threshold) return 'center';
    return null;
  }

  onMouseDown(pos) {
    if (this.mapScale.locked) return;
    const map = this.viewport.screenToMap(pos.x, pos.y);
    const hit = this._hitTest(map.x, map.y);
    if (!hit) return;
    this._dragging = true;
    this._dragType = hit;
    this._dragStart = map;
    this._startRadius = this._radius;
    this._startCenter = { x: this._centerX, y: this._centerY };
  }

  onMouseMove(pos) {
    if (!this._dragging) return;
    const map = this.viewport.screenToMap(pos.x, pos.y);

    if (this._dragType === 'edge') {
      this._radius = Math.max(10, Math.hypot(map.x - this._centerX, map.y - this._centerY));
      this._updateScaleFromCircle();
    } else if (this._dragType === 'center') {
      this._centerX = this._startCenter.x + (map.x - this._dragStart.x);
      this._centerY = this._startCenter.y + (map.y - this._dragStart.y);
      this.bus.emit('render:request');
    }
  }

  onMouseUp() {
    this._dragging = false;
    this._dragType = null;
  }

  onKeyDown(e) {
    if (e.code === 'Escape') {
      this.bus.emit('tool:activate', 'select');
    }
  }

  renderOverlay(ctx, viewport) {
    if (!this._initialized) return;

    ctx.save();
    ctx.translate(viewport.panX, viewport.panY);
    ctx.scale(viewport.zoom, viewport.zoom);

    ctx.strokeStyle = 'rgba(255, 200, 50, 0.8)';
    ctx.lineWidth = 2 / viewport.zoom;
    ctx.setLineDash([8 / viewport.zoom, 5 / viewport.zoom]);
    ctx.beginPath();
    ctx.arc(this._centerX, this._centerY, this._radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    const chSize = 12 / viewport.zoom;
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.6)';
    ctx.lineWidth = 1 / viewport.zoom;
    ctx.beginPath();
    ctx.moveTo(this._centerX - chSize, this._centerY);
    ctx.lineTo(this._centerX + chSize, this._centerY);
    ctx.moveTo(this._centerX, this._centerY - chSize);
    ctx.lineTo(this._centerX, this._centerY + chSize);
    ctx.stroke();

    const handleSize = 5 / viewport.zoom;
    ctx.fillStyle = 'rgba(255, 200, 50, 0.9)';
    const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    for (const a of angles) {
      const hx = this._centerX + this._radius * Math.cos(a);
      const hy = this._centerY + this._radius * Math.sin(a);
      ctx.fillRect(hx - handleSize, hy - handleSize, handleSize * 2, handleSize * 2);
    }

    ctx.restore();

    const screenCenter = viewport.mapToScreen(this._centerX, this._centerY);
    const screenBottom = viewport.mapToScreen(this._centerX, this._centerY + this._radius);
    ctx.save();
    ctx.fillStyle = 'rgba(255, 200, 50, 0.9)';
    ctx.font = '12px monospace';
    const diamPx = Math.round(this._radius * 2);
    const mpp = this.mapScale.metresPerPixel;
    ctx.fillText(
      `⌀ ${diamPx}px  |  ${mpp.toFixed(2)} m/px`,
      screenCenter.x - 70,
      screenBottom.y + 20
    );
    ctx.restore();
  }
}
