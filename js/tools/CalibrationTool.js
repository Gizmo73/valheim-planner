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

    // Grid preview state
    this._previewActive = false;
    this._previewAnchorX = 0;
    this._previewAnchorY = 0;
    this._previewMpp = 1;
    this._radialObservations = new Map();
    this._radialK1x = 0;
    this._radialK1y = 0;
    this._pvDragging = false;
    this._pvDragStartScreen = null;
    this._pvDragGridKey = null;
    this._pvDragStartCorr = null;
    this._pvDragDistX = 0;
    this._pvDragDistY = 0;
    this._pvHoveredIntersection = null;

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

  get previewActive() {
    return this._previewActive;
  }

  get localCorrections() {
    return this._radialObservations;
  }

  activate() {
    if (this._previewActive) return;
    if (this._mode === 'world') {
      this._activateWorld();
    } else {
      this._activateLocal();
    }
  }

  deactivate() {
    if (this._previewActive) {
      this.exitPreview();
    }
  }

  enterPreview(anchorX, anchorY, mpp) {
    this._previewActive = true;
    this._previewAnchorX = anchorX;
    this._previewAnchorY = anchorY;
    this._previewMpp = mpp;
    this._radialObservations = new Map();
    this._radialK1x = 0;
    this._radialK1y = 0;
    this._pvDragging = false;
    this._pvHoveredIntersection = null;
    this.mapLayer.setPreviewCorrectionField(
      anchorX, anchorY, mpp,
      (gx, gy) => this.getCorrectionAt(gx, gy),
      () => this._radialObservations.size > 0
    );
    this.bus.emit('calibration:previewChanged', true);
    this.bus.emit('render:request');
  }

  exitPreview() {
    this._previewActive = false;
    this._pvDragging = false;
    this._pvHoveredIntersection = null;
    this._radialObservations.clear();
    this._radialK1x = 0;
    this._radialK1y = 0;
    this.mapLayer.clearPreviewCorrection();
    this.bus.emit('calibration:previewChanged', false);
    this.bus.emit('render:request');
  }

  hitTest(pos) {
    if (this._previewActive) {
      return this._hitTestPreview(pos) !== null;
    }
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

  // --- Radial distortion model ---

  getCorrectionAt(gx, gy) {
    const r2 = gx * gx + gy * gy;
    const cx = Math.max(0.5, Math.min(2.0, 1 + this._radialK1x * r2));
    const cy = Math.max(0.5, Math.min(2.0, 1 + this._radialK1y * r2));
    return { corrX: cx, corrY: cy };
  }

  _fitRadialModel() {
    let numX = 0, denX = 0, numY = 0, denY = 0;
    for (const [key, obs] of this._radialObservations) {
      const sep = key.indexOf(',');
      const gx = parseFloat(key.slice(0, sep));
      const gy = parseFloat(key.slice(sep + 1));
      const r2 = gx * gx + gy * gy;
      const r4 = r2 * r2;
      if (obs.corrX !== null) { numX += (obs.corrX - 1) * r2; denX += r4; }
      if (obs.corrY !== null) { numY += (obs.corrY - 1) * r2; denY += r4; }
    }
    this._radialK1x = denX > 1e-10 ? numX / denX : 0;
    this._radialK1y = denY > 1e-10 ? numY / denY : 0;
  }

  // --- Grid preview intersection detection ---

  _getVisibleIntersections(viewport) {
    const mpp = this._previewMpp;
    const ax = this._previewAnchorX;
    const ay = this._previewAnchorY;
    const zoom = viewport.zoom;

    const canvas = document.getElementById('main-canvas');
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas ? canvas.width / dpr : window.innerWidth;
    const ch = canvas ? canvas.height / dpr : window.innerHeight;
    const visBounds = viewport.getVisibleMapBounds(cw, ch);

    const majorCell = 4 / mpp;
    const minorCell = 1 / mpp;
    const majorScreen = majorCell * zoom;
    const minorScreen = minorCell * zoom;
    const viewportSize = Math.min(cw, ch);

    let cellMap;
    let gridSpacing;
    if (majorScreen >= 20 && majorScreen < viewportSize * 0.8) {
      cellMap = majorCell;
      gridSpacing = 4;
    } else if (minorScreen >= 8) {
      cellMap = minorCell;
      gridSpacing = 1;
    } else {
      return { intersections: [], gridSpacing: 4 };
    }

    const intersections = [];
    const startX = ax + Math.ceil((visBounds.x - ax) / cellMap) * cellMap;
    const startY = ay + Math.ceil((visBounds.y - ay) / cellMap) * cellMap;
    const endX = visBounds.x + visBounds.w;
    const endY = visBounds.y + visBounds.h;

    const maxCount = 400;
    let count = 0;
    for (let x = startX; x <= endX && count < maxCount; x += cellMap) {
      for (let y = startY; y <= endY && count < maxCount; y += cellMap) {
        const gx = Math.round((x - ax) * mpp);
        const gy = Math.round((y - ay) * mpp);
        intersections.push({ mapX: x, mapY: y, gridX: gx, gridY: gy });
        count++;
      }
    }
    return { intersections, gridSpacing };
  }

  _hitTestPreview(pos) {
    const threshold = 14;
    const { intersections } = this._getVisibleIntersections(this.viewport);
    let best = null;
    let bestDist = Infinity;
    for (const ix of intersections) {
      const screen = this.viewport.mapToScreen(ix.mapX, ix.mapY);
      const dist = Math.hypot(screen.x - pos.x, screen.y - pos.y);
      if (dist < threshold && dist < bestDist) {
        bestDist = dist;
        best = ix;
      }
    }
    return best;
  }

  // --- Mouse handlers ---

  onMouseDown(pos) {
    if (this._previewActive) {
      this._onPreviewMouseDown(pos);
      return;
    }
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
    if (this._previewActive) {
      this._onPreviewMouseMove(pos);
      return;
    }
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

  onMouseUp(pos) {
    if (this._previewActive) {
      this._onPreviewMouseUp();
      return;
    }
    if (this._dragging) {
      this._dragging = false;
      this._dragType = null;
      this._dragIndex = -1;
      this.bus.emit('render:request');
    }
  }

  // --- Preview mouse handlers ---

  _onPreviewMouseDown(pos) {
    const hit = this._hitTestPreview(pos);
    if (!hit) return;

    const ax = this._previewAnchorX;
    const ay = this._previewAnchorY;
    if (Math.abs(hit.mapX - ax) < 1 && Math.abs(hit.mapY - ay) < 1) return;

    const key = `${hit.gridX},${hit.gridY}`;
    const modelPred = this.getCorrectionAt(hit.gridX, hit.gridY);

    this._pvDragging = true;
    this._pvDragStartScreen = { x: pos.x, y: pos.y };
    this._pvDragGridKey = key;
    this._pvDragStartCorr = { corrX: modelPred.corrX, corrY: modelPred.corrY };

    const screenAnchor = this.viewport.mapToScreen(ax, ay);
    this._pvDragDistX = pos.x - screenAnchor.x;
    this._pvDragDistY = pos.y - screenAnchor.y;
  }

  _onPreviewMouseMove(pos) {
    if (!this._pvDragging) {
      const hit = this._hitTestPreview(pos);
      this._pvHoveredIntersection = hit;
      this.bus.emit('render:request');
      return;
    }

    const dx = (pos.x - this._pvDragStartScreen.x) * this._pinDampening;
    const dy = (pos.y - this._pvDragStartScreen.y) * this._pinDampening;
    const distX = this._pvDragDistX;
    const distY = this._pvDragDistY;

    let corrX = null, corrY = null;
    if (Math.abs(distX) > 10) {
      corrX = this._pvDragStartCorr.corrX * distX / (distX + dx);
      corrX = Math.max(0.5, Math.min(2.0, corrX));
    }
    if (Math.abs(distY) > 10) {
      corrY = this._pvDragStartCorr.corrY * distY / (distY + dy);
      corrY = Math.max(0.5, Math.min(2.0, corrY));
    }

    const existing = this._radialObservations.get(this._pvDragGridKey);
    if (existing) {
      if (corrX !== null) existing.corrX = corrX;
      if (corrY !== null) existing.corrY = corrY;
    } else {
      this._radialObservations.set(this._pvDragGridKey, { corrX, corrY });
    }
    this._fitRadialModel();
    this.bus.emit('render:request');
  }

  _onPreviewMouseUp() {
    this._pvDragging = false;
  }

  onKeyDown(e) {
    if (e.code === 'Escape') {
      if (this._previewActive) {
        this.bus.emit('calibration:previewCancel');
      } else {
        this.bus.emit('tool:activate', 'select');
      }
    }
  }

  // --- Rendering ---

  renderOverlay(ctx, viewport) {
    if (this._previewActive) {
      this._renderPreviewOverlay(ctx, viewport);
      return;
    }
    if (this._mode === 'world') {
      this._renderWorldOverlay(ctx, viewport);
    } else {
      this._renderLocalOverlay(ctx, viewport);
      this._renderMagnifier(ctx, viewport);
    }
  }

  _renderPreviewOverlay(ctx, viewport) {
    const mpp = this._previewMpp;
    const ax = this._previewAnchorX;
    const ay = this._previewAnchorY;
    const zoom = viewport.zoom;

    const canvasEl = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvasEl.width / dpr;
    const ch = canvasEl.height / dpr;

    const visBounds = viewport.getVisibleMapBounds(cw, ch);
    const visLeft = visBounds.x;
    const visTop = visBounds.y;
    const visRight = visBounds.x + visBounds.w;
    const visBottom = visBounds.y + visBounds.h;

    ctx.save();
    ctx.translate(viewport.panX, viewport.panY);
    ctx.scale(zoom, zoom);

    // Minor grid (1m) - only if big enough on screen
    const minorCell = 1 / mpp;
    const minorScreen = minorCell * zoom;
    if (minorScreen >= 8) {
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.15)';
      ctx.lineWidth = 0.5 / zoom;
      ctx.beginPath();
      const startX = ax + Math.ceil((visLeft - ax) / minorCell) * minorCell;
      for (let x = startX; x <= visRight; x += minorCell) {
        ctx.moveTo(x, visTop);
        ctx.lineTo(x, visBottom);
      }
      const startY = ay + Math.ceil((visTop - ay) / minorCell) * minorCell;
      for (let y = startY; y <= visBottom; y += minorCell) {
        ctx.moveTo(visLeft, y);
        ctx.lineTo(visRight, y);
      }
      ctx.stroke();
    }

    // Major grid (4m)
    const majorCell = 4 / mpp;
    const majorScreen = majorCell * zoom;
    if (majorScreen >= 8) {
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)';
      ctx.lineWidth = 1 / zoom;
      ctx.beginPath();
      const startX = ax + Math.ceil((visLeft - ax) / majorCell) * majorCell;
      for (let x = startX; x <= visRight; x += majorCell) {
        ctx.moveTo(x, visTop);
        ctx.lineTo(x, visBottom);
      }
      const startY = ay + Math.ceil((visTop - ay) / majorCell) * majorCell;
      for (let y = startY; y <= visBottom; y += majorCell) {
        ctx.moveTo(visLeft, y);
        ctx.lineTo(visRight, y);
      }
      ctx.stroke();
    }

    // Anchor crosshair
    const chSize = 12 / zoom;
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.8)';
    ctx.lineWidth = 2 / zoom;
    ctx.beginPath();
    ctx.moveTo(ax - chSize, ay);
    ctx.lineTo(ax + chSize, ay);
    ctx.moveTo(ax, ay - chSize);
    ctx.lineTo(ax, ay + chSize);
    ctx.stroke();

    ctx.restore();

    // Draw interactive handles at grid intersections (in screen space)
    const { intersections } = this._getVisibleIntersections(viewport);
    if (intersections.length > 0) {
      const handleRadius = 5;

      for (const ix of intersections) {
        if (Math.abs(ix.gridX) < 0.01 && Math.abs(ix.gridY) < 0.01) continue;

        const screen = viewport.mapToScreen(ix.mapX, ix.mapY);
        const key = `${ix.gridX},${ix.gridY}`;
        const hasCorrHere = this._radialObservations.has(key);
        const isHovered = this._pvHoveredIntersection &&
          Math.abs(this._pvHoveredIntersection.mapX - ix.mapX) < 0.01 &&
          Math.abs(this._pvHoveredIntersection.mapY - ix.mapY) < 0.01;
        const isDragged = this._pvDragging && this._pvDragGridKey === key;

        if (isDragged) {
          ctx.fillStyle = 'rgba(255, 220, 80, 0.9)';
          ctx.strokeStyle = 'rgba(255, 200, 50, 1)';
        } else if (isHovered) {
          ctx.fillStyle = 'rgba(0, 200, 255, 0.6)';
          ctx.strokeStyle = 'rgba(0, 200, 255, 1)';
        } else if (hasCorrHere) {
          ctx.fillStyle = 'rgba(255, 160, 50, 0.5)';
          ctx.strokeStyle = 'rgba(255, 160, 50, 0.8)';
        } else {
          ctx.fillStyle = 'rgba(0, 200, 255, 0.15)';
          ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)';
        }

        const r = (isHovered || isDragged || hasCorrHere) ? handleRadius + 2 : handleRadius;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Info HUD in screen space
    const hovNonAnchor = this._pvHoveredIntersection &&
      !(Math.abs(this._pvHoveredIntersection.gridX) < 0.01 && Math.abs(this._pvHoveredIntersection.gridY) < 0.01);
    const hasModel = this._radialObservations.size > 0;
    const showDetail = this._pvDragging || hovNonAnchor || hasModel;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(8, 8, 340, showDetail ? 78 : 44);
    ctx.fillStyle = 'rgba(0, 200, 255, 0.9)';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('Radial Correction  —  drag intersections to fit', 14, 24);
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    const n = this._radialObservations.size;
    ctx.fillText(`Base: ${mpp.toFixed(4)} m/px  |  ${n} sample${n !== 1 ? 's' : ''}`, 14, 42);
    if (hasModel) {
      ctx.fillStyle = 'rgba(180, 140, 255, 0.9)';
      ctx.fillText(`k1x: ${this._radialK1x.toExponential(3)}  k1y: ${this._radialK1y.toExponential(3)}`, 14, 58);
    }
    if (this._pvDragging && this._pvDragGridKey) {
      const corr = this.getCorrectionAt(
        ...this._pvDragGridKey.split(',').map(Number)
      );
      ctx.fillStyle = 'rgba(255, 200, 50, 0.8)';
      ctx.fillText(`model at drag: X ×${corr.corrX.toFixed(3)}  Y ×${corr.corrY.toFixed(3)}`, 14, 74);
    } else if (hovNonAnchor) {
      const hGx = this._pvHoveredIntersection.gridX;
      const hGy = this._pvHoveredIntersection.gridY;
      const corr = this.getCorrectionAt(hGx, hGy);
      const r = Math.hypot(hGx, hGy).toFixed(1);
      ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
      ctx.fillText(`(${hGx},${hGy}) r=${r}: X ×${corr.corrX.toFixed(3)}  Y ×${corr.corrY.toFixed(3)}`, 14, 74);
    }
    ctx.restore();
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
