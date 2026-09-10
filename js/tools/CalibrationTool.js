import { WORLD_DIAMETER } from '../core/MapScale.js';

export class CalibrationTool {
  constructor(viewport, mapLayer, mapScale, bus) {
    this.viewport = viewport;
    this.mapLayer = mapLayer;
    this.mapScale = mapScale;
    this.bus = bus;

    this._mode = mapScale.mapMode;

    // World mode state
    this._centerX = 0;
    this._centerY = 0;
    this._radius = 0;
    this._worldInitialized = false;
    this._updatingFromCircle = false;

    // Local mode state
    this._pins = [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    this._localInitialized = false;

    // Shared drag state
    this._dragging = false;
    this._dragType = null;
    this._dragStart = null;
    this._startRadius = 0;
    this._startCenter = null;
    this._dragIndex = -1;
    this._startPin = null;
    this._pinDampening = 1 / 4;

    bus.on('scale:changed', () => {
      if (!this._updatingFromCircle && this._worldInitialized && this._mode === 'world') {
        this._radius = this.mapScale.circleDiameterPx() / 2;
        this.bus.emit('render:request');
      }
    });

    bus.on('calibration:modeChanged', (mode) => {
      this._mode = mode;
      this.bus.emit('render:request');
    });

    bus.on('map:loaded', () => {
      this._worldInitialized = false;
      this._localInitialized = false;
    });
  }

  get pins() {
    return this._pins.map(p => ({ ...p }));
  }

  activate() {
    if (this._mode === 'world') {
      this._activateWorld();
    } else {
      this._activateLocal();
    }
  }

  deactivate() {}

  hitTest(pos) {
    if (this.mapScale.locked) return false;
    const map = this.viewport.screenToMap(pos.x, pos.y);
    if (this._mode === 'world') {
      return this._hitTestWorld(map.x, map.y) !== null;
    }
    return this._hitTestLocal(map.x, map.y) >= 0;
  }

  _activateWorld() {
    if (!this._worldInitialized && this.mapLayer.image) {
      this._centerX = this.mapLayer.width / 2;
      this._centerY = this.mapLayer.height / 2;
      this._radius = Math.min(this.mapLayer.width, this.mapLayer.height) * 0.4;
      this._updateScaleFromCircle();
      this._worldInitialized = true;
    }
  }

  _activateLocal() {
    if (!this._localInitialized && this.mapLayer.image) {
      const w = this.mapLayer.width;
      const h = this.mapLayer.height;
      const size = Math.min(w, h) * 0.3;
      const cx = w / 2;
      const cy = h / 2;
      const tileW = this.mapScale.tileW;
      const tileH = this.mapScale.tileH;
      const aspect = tileW / tileH;
      let hw, hh;
      if (aspect >= 1) {
        hw = size / 2;
        hh = hw / aspect;
      } else {
        hh = size / 2;
        hw = hh * aspect;
      }
      this._pins = [
        { x: cx - hw, y: cy - hh },
        { x: cx + hw, y: cy - hh },
        { x: cx + hw, y: cy + hh },
        { x: cx - hw, y: cy + hh },
      ];
      this._localInitialized = true;
    }
  }

  _updateScaleFromCircle() {
    this._updatingFromCircle = true;
    this.mapScale.setFromCircleDiameter(this._radius * 2);
    this._updatingFromCircle = false;
  }

  _hitTestWorld(mapX, mapY) {
    const dist = Math.hypot(mapX - this._centerX, mapY - this._centerY);
    const threshold = 12 / this.viewport.zoom;
    if (Math.abs(dist - this._radius) < threshold) return 'edge';
    if (dist < this._radius - threshold) return 'center';
    return null;
  }

  _hitTestLocal(mapX, mapY) {
    const threshold = 15 / this.viewport.zoom;
    for (let i = 0; i < 4; i++) {
      const dist = Math.hypot(mapX - this._pins[i].x, mapY - this._pins[i].y);
      if (dist < threshold) return i;
    }
    return -1;
  }

  onMouseDown(pos) {
    if (this.mapScale.locked) return;
    const map = this.viewport.screenToMap(pos.x, pos.y);

    if (this._mode === 'world') {
      const hit = this._hitTestWorld(map.x, map.y);
      if (!hit) return;
      this._dragging = true;
      this._dragType = hit;
      this._dragStart = map;
      this._startRadius = this._radius;
      this._startCenter = { x: this._centerX, y: this._centerY };
    } else {
      const idx = this._hitTestLocal(map.x, map.y);
      if (idx < 0) return;
      this._dragging = true;
      this._dragIndex = idx;
      this._dragStart = map;
      this._startPin = { ...this._pins[idx] };
    }
  }

  onMouseMove(pos) {
    if (!this._dragging) return;
    const map = this.viewport.screenToMap(pos.x, pos.y);

    if (this._mode === 'world') {
      if (this._dragType === 'edge') {
        this._radius = Math.max(10, Math.hypot(map.x - this._centerX, map.y - this._centerY));
        this._updateScaleFromCircle();
      } else if (this._dragType === 'center') {
        this._centerX = this._startCenter.x + (map.x - this._dragStart.x);
        this._centerY = this._startCenter.y + (map.y - this._dragStart.y);
        this.bus.emit('render:request');
      }
    } else {
      const d = this._pinDampening;
      this._pins[this._dragIndex] = {
        x: this._startPin.x + (map.x - this._dragStart.x) * d,
        y: this._startPin.y + (map.y - this._dragStart.y) * d,
      };
      this.bus.emit('render:request');
    }
  }

  onMouseUp() {
    if (this._dragging) {
      this._dragging = false;
      this._dragType = null;
      this._dragIndex = -1;
      this.bus.emit('render:request');
    }
  }

  onKeyDown(e) {
    if (e.code === 'Escape') {
      this.bus.emit('tool:activate', 'select');
    }
  }

  renderOverlay(ctx, viewport) {
    if (this._mode === 'world') {
      this._renderWorldOverlay(ctx, viewport);
    } else {
      this._renderLocalOverlay(ctx, viewport);
      this._renderMagnifier(ctx, viewport);
    }
  }

  _renderWorldOverlay(ctx, viewport) {
    if (!this._worldInitialized) return;

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

  _renderLocalOverlay(ctx, viewport) {
    if (!this._localInitialized) return;

    ctx.save();
    ctx.translate(viewport.panX, viewport.panY);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Quad outline
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.8)';
    ctx.lineWidth = 2 / viewport.zoom;
    ctx.setLineDash([8 / viewport.zoom, 5 / viewport.zoom]);
    ctx.beginPath();
    ctx.moveTo(this._pins[0].x, this._pins[0].y);
    for (let i = 1; i < 4; i++) {
      ctx.lineTo(this._pins[i].x, this._pins[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Crosshair lines between opposite midpoints
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.3)';
    ctx.lineWidth = 1 / viewport.zoom;
    const midTop = { x: (this._pins[0].x + this._pins[1].x) / 2, y: (this._pins[0].y + this._pins[1].y) / 2 };
    const midBot = { x: (this._pins[3].x + this._pins[2].x) / 2, y: (this._pins[3].y + this._pins[2].y) / 2 };
    const midLeft = { x: (this._pins[0].x + this._pins[3].x) / 2, y: (this._pins[0].y + this._pins[3].y) / 2 };
    const midRight = { x: (this._pins[1].x + this._pins[2].x) / 2, y: (this._pins[1].y + this._pins[2].y) / 2 };
    ctx.beginPath();
    ctx.moveTo(midTop.x, midTop.y);
    ctx.lineTo(midBot.x, midBot.y);
    ctx.moveTo(midLeft.x, midLeft.y);
    ctx.lineTo(midRight.x, midRight.y);
    ctx.stroke();

    // Pin handles
    const pinRadius = 8 / viewport.zoom;
    const labels = ['1', '2', '3', '4'];
    for (let i = 0; i < 4; i++) {
      const pin = this._pins[i];
      const active = this._dragging && this._dragIndex === i;

      ctx.fillStyle = active ? 'rgba(255, 220, 80, 1)' : 'rgba(255, 200, 50, 0.85)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 2 / viewport.zoom;
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, pinRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const fontSize = Math.max(1, Math.round(10 / viewport.zoom));
      ctx.fillStyle = '#000';
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labels[i], pin.x, pin.y);
    }

    ctx.restore();

    // Info text in screen space
    const cx = (this._pins[0].x + this._pins[1].x + this._pins[2].x + this._pins[3].x) / 4;
    const cy = (this._pins[0].y + this._pins[1].y + this._pins[2].y + this._pins[3].y) / 4;
    const maxPinY = Math.max(this._pins[0].y, this._pins[1].y, this._pins[2].y, this._pins[3].y);
    const screenPos = viewport.mapToScreen(cx, maxPinY + 20 / viewport.zoom);
    ctx.save();
    ctx.fillStyle = 'rgba(255, 200, 50, 0.9)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    const tileW = this.mapScale.tileW;
    const tileH = this.mapScale.tileH;
    ctx.fillText(`${tileW}×${tileH} tiles  |  drag pins to reference corners`, screenPos.x, screenPos.y);
    ctx.restore();
  }

  _renderMagnifier(ctx, viewport) {
    if (!this._dragging || this._dragIndex < 0) return;

    const pin = this._pins[this._dragIndex];
    const screenPin = viewport.mapToScreen(pin.x, pin.y);
    const canvasW = ctx.canvas.width;
    const canvasH = ctx.canvas.height;

    const R = 70;
    const MAG = 4;
    const innerZoom = viewport.zoom * MAG;

    let cx = screenPin.x;
    let cy = screenPin.y - R - 35;
    if (cy - R < 10) cy = screenPin.y + R + 35;
    cx = Math.max(R + 5, Math.min(canvasW - R - 5, cx));
    cy = Math.max(R + 5, Math.min(canvasH - R - 5, cy));

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#111';
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    const ipx = cx - pin.x * innerZoom;
    const ipy = cy - pin.y * innerZoom;

    if (this.mapLayer.image) {
      ctx.save();
      ctx.translate(ipx, ipy);
      ctx.scale(innerZoom, innerZoom);
      ctx.drawImage(this.mapLayer.image, 0, 0, this.mapLayer.width, this.mapLayer.height);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(ipx, ipy);
    ctx.scale(innerZoom, innerZoom);

    ctx.strokeStyle = 'rgba(255, 200, 50, 0.6)';
    ctx.lineWidth = 1.5 / innerZoom;
    ctx.setLineDash([4 / innerZoom, 3 / innerZoom]);
    ctx.beginPath();
    ctx.moveTo(this._pins[0].x, this._pins[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(this._pins[i].x, this._pins[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < 4; i++) {
      const p = this._pins[i];
      const r = (i === this._dragIndex ? 5 : 3) / innerZoom;
      ctx.fillStyle = i === this._dragIndex ? 'rgba(255, 220, 80, 1)' : 'rgba(255, 200, 50, 0.5)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1 / innerZoom;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(255, 200, 50, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy);  ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5);  ctx.lineTo(cx, cy + 14);
    ctx.stroke();

    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const edgeY = cy < screenPin.y ? cy + R : cy - R;
    ctx.beginPath();
    ctx.moveTo(cx, edgeY);
    ctx.lineTo(screenPin.x, screenPin.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }
}
