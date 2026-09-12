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

    // Checkerboard mode state
    this._pins = [];
    this._enabled = [];
    this._localInitialized = false;
    this._snapEnabled = true;
    this._snapRadius = 15;
    this._imageData = null;
    this._gray = null;

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
    this._pvDragging = false;
    this._pvDragMode = null; // 'translate' or 'scale'
    this._pvDragStartScreen = null;
    this._pvDragStartAnchor = null;
    this._pvDragStartMpp = 0;
    this._pvDragStartDist = 0;
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

    bus.on('calibration:gridChanged', () => {
      if (this._mode === 'local') {
        this._localInitialized = false;
        this._activateLocal();
        this.bus.emit('render:request');
      }
    });

    bus.on('map:loaded', () => {
      this._worldInitialized = false;
      this._localInitialized = false;
      this._imageData = null;
      this._gray = null;
    });
  }

  get pins() {
    return this._pins.map(p => ({ ...p }));
  }

  get enabled() {
    return [...this._enabled];
  }

  get previewActive() {
    return this._previewActive;
  }

  get snapEnabled() {
    return this._snapEnabled;
  }

  set snapEnabled(val) {
    this._snapEnabled = !!val;
  }

  get snapRadius() {
    return this._snapRadius;
  }

  set snapRadius(val) {
    this._snapRadius = Math.max(3, Math.min(40, Math.round(val)));
  }

  pinWorldCoords() {
    const cols = this.mapScale.cbCols;
    const rows = this.mapScale.cbRows;
    const spacing = this.mapScale.cbSpacing;
    const tileSize = 2;
    const gcx = (cols - 1) * spacing / 2;
    const gcy = (rows - 1) * spacing / 2;
    const coords = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tx = c * spacing;
        const ty = r * spacing;
        coords.push({ x: tx, y: ty });
        const dx = Math.sign(gcx - tx) || 1;
        const dy = Math.sign(gcy - ty) || 1;
        coords.push({ x: tx + dx * tileSize, y: ty + dy * tileSize });
      }
    }
    return coords;
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
    this._pvDragging = false;
    this._pvDragMode = null;
    this._pvHoveredIntersection = null;
    this.bus.emit('calibration:previewChanged', true);
    this.bus.emit('render:request');
  }

  exitPreview() {
    this._previewActive = false;
    this._pvDragging = false;
    this._pvDragMode = null;
    this._pvHoveredIntersection = null;
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
    const pinCount = this.mapScale.cbCols * this.mapScale.cbRows * 2;
    if (this._localInitialized && this._pins.length === pinCount) return;
    if (!this.mapLayer.image) return;

    const w = this.mapLayer.width;
    const h = this.mapLayer.height;
    const cols = this.mapScale.cbCols;
    const rows = this.mapScale.cbRows;
    const spacing = this.mapScale.cbSpacing;
    const tileSize = 2;

    const gridWorldW = (cols - 1) * spacing;
    const gridWorldH = (rows - 1) * spacing;
    const scaleX = gridWorldW > 0 ? (w * 0.6) / gridWorldW : 1;
    const scaleY = gridWorldH > 0 ? (h * 0.6) / gridWorldH : 1;
    const scale = Math.min(scaleX, scaleY);

    const cx = w / 2;
    const cy = h / 2;
    const originX = cx - (gridWorldW * scale) / 2;
    const originY = cy - (gridWorldH * scale) / 2;

    const gcx = (cols - 1) * spacing / 2;
    const gcy = (rows - 1) * spacing / 2;

    this._pins = [];
    this._enabled = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tx = c * spacing;
        const ty = r * spacing;
        this._pins.push({
          x: originX + tx * scale,
          y: originY + ty * scale,
        });
        this._enabled.push(true);
        const dx = Math.sign(gcx - tx) || 1;
        const dy = Math.sign(gcy - ty) || 1;
        this._pins.push({
          x: originX + (tx + dx * tileSize) * scale,
          y: originY + (ty + dy * tileSize) * scale,
        });
        this._enabled.push(true);
      }
    }

    this._localInitialized = true;
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
    for (let i = 0; i < this._pins.length; i++) {
      const dist = Math.hypot(mapX - this._pins[i].x, mapY - this._pins[i].y);
      if (dist < threshold) return i;
    }
    return -1;
  }

  // --- Corner snap detection (Shi-Tomasi + sub-pixel refinement) ---

  _ensureImageData() {
    if (!this._imageData) {
      const tmp = document.createElement('canvas');
      tmp.width = this.mapLayer.width;
      tmp.height = this.mapLayer.height;
      const t = tmp.getContext('2d');
      t.drawImage(this.mapLayer.image, 0, 0, this.mapLayer.width, this.mapLayer.height);
      this._imageData = t.getImageData(0, 0, this.mapLayer.width, this.mapLayer.height);
      this._gray = null;
    }
    if (!this._gray) {
      const d = this._imageData.data;
      const n = this.mapLayer.width * this.mapLayer.height;
      const g = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
      }
      this._gray = g;
    }
  }

  _snapPoint(p, R) {
    const g = this._gray;
    const W = this.mapLayer.width;
    const H = this.mapLayer.height;
    const ws = 5;
    const cx = Math.round(p.x), cy = Math.round(p.y);
    const half = R + ws + 3;
    const x0 = Math.max(1, cx - half), y0 = Math.max(1, cy - half);
    const x1 = Math.min(W - 2, cx + half), y1 = Math.min(H - 2, cy + half);
    const pw = x1 - x0 + 1, ph = y1 - y0 + 1;
    if (pw < 2 * ws + 5 || ph < 2 * ws + 5) return { ok: false, why: 'too close to edge' };

    const B = new Float32Array(pw * ph);
    for (let y = 0; y < ph; y++) for (let x = 0; x < pw; x++) {
      const i = (y0 + y) * W + (x0 + x);
      B[y * pw + x] = (4 * g[i] + 2 * (g[i - 1] + g[i + 1] + g[i - W] + g[i + W])
        + g[i - W - 1] + g[i - W + 1] + g[i + W - 1] + g[i + W + 1]) / 16;
    }

    const GX = new Float32Array(pw * ph), GY = new Float32Array(pw * ph);
    for (let y = 1; y < ph - 1; y++) for (let x = 1; x < pw - 1; x++) {
      const i = y * pw + x;
      GX[i] = (B[i + 1] - B[i - 1]) / 2;
      GY[i] = (B[i + pw] - B[i - pw]) / 2;
    }
    const inside = (lx, ly) => lx >= 1 && ly >= 1 && lx < pw - 1 && ly < ph - 1;

    const sig2 = 2 * (R * 0.6) ** 2;
    let best = null, bestScore = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > R * R) continue;
      const lx = cx + dx - x0, ly = cy + dy - y0;
      let a = 0, b = 0, c = 0;
      for (let wy = -2; wy <= 2; wy++) for (let wx = -2; wx <= 2; wx++) {
        if (!inside(lx + wx, ly + wy)) continue;
        const i = (ly + wy) * pw + lx + wx;
        a += GX[i] * GX[i]; b += GX[i] * GY[i]; c += GY[i] * GY[i];
      }
      const lmin = (a + c) / 2 - Math.sqrt(((a - c) / 2) ** 2 + b * b);
      const score = lmin * Math.exp(-(dx * dx + dy * dy) / sig2);
      if (score > bestScore) { bestScore = score; best = { x: cx + dx, y: cy + dy }; }
    }
    if (!best) return { ok: false, why: 'no contrast' };

    let px = best.x, py = best.y, A11 = 0, A12 = 0, A22 = 0;
    const wsig2 = 2 * (ws * 0.5) ** 2;
    for (let iter = 0; iter < 20; iter++) {
      A11 = 0; A12 = 0; A22 = 0;
      let bx = 0, by = 0;
      const rx = Math.round(px), ry = Math.round(py);
      for (let dy = -ws; dy <= ws; dy++) for (let dx = -ws; dx <= ws; dx++) {
        const qx = rx + dx, qy = ry + dy;
        const lx = qx - x0, ly = qy - y0;
        if (!inside(lx, ly)) continue;
        const i = ly * pw + lx, gx = GX[i], gy = GY[i];
        const w = Math.exp(-((qx - px) ** 2 + (qy - py) ** 2) / wsig2);
        A11 += w * gx * gx; A12 += w * gx * gy; A22 += w * gy * gy;
        bx += w * (gx * gx * qx + gx * gy * qy);
        by += w * (gx * gy * qx + gy * gy * qy);
      }
      const det = A11 * A22 - A12 * A12;
      if (det <= 1e-9) return { ok: false, why: 'flat area' };
      const nx = (A22 * bx - A12 * by) / det;
      const ny = (A11 * by - A12 * bx) / det;
      const move = Math.hypot(nx - px, ny - py);
      px = nx; py = ny;
      if (move < 0.01) break;
    }

    const tr = (A11 + A22) / 2;
    const disc = Math.sqrt(((A11 - A22) / 2) ** 2 + A12 * A12);
    const ratio = (tr - disc) / (tr + disc);
    if (ratio < 0.05) return { ok: false, why: 'edge, not corner' };
    const dist = Math.hypot(px - p.x, py - p.y);
    if (dist > R + 1) return { ok: false, why: 'too far' };
    return { ok: true, x: px, y: py, dist };
  }

  snapPin(i) {
    if (!this.mapLayer.image || i < 0 || i >= this._pins.length) return null;
    this._ensureImageData();
    const res = this._snapPoint(this._pins[i], this._snapRadius);
    if (res.ok) this._pins[i] = { x: res.x, y: res.y };
    return res;
  }

  snapAllPins() {
    if (!this.mapLayer.image) return [];
    this._ensureImageData();
    const failed = [];
    for (let i = 0; i < this._pins.length; i++) {
      if (!this._enabled[i]) continue;
      const res = this._snapPoint(this._pins[i], this._snapRadius);
      if (res.ok) {
        this._pins[i] = { x: res.x, y: res.y };
      } else {
        failed.push(i + 1);
      }
    }
    this.bus.emit('render:request');
    return failed;
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
      const idx = this._dragIndex;
      this._dragging = false;
      this._dragType = null;
      this._dragIndex = -1;

      if (this._mode === 'local' && idx >= 0 && this._snapEnabled) {
        const res = this.snapPin(idx);
        if (res) {
          this.bus.emit('calibration:snapResult', {
            pin: idx + 1,
            ok: res.ok,
            dist: res.dist,
            why: res.why,
          });
        }
      }

      this.bus.emit('render:request');
    }
  }

  // --- Preview mouse handlers ---

  _onPreviewMouseDown(pos) {
    const hit = this._hitTestPreview(pos);

    if (hit) {
      const ax = this._previewAnchorX;
      const ay = this._previewAnchorY;
      if (Math.abs(hit.mapX - ax) < 1 && Math.abs(hit.mapY - ay) < 1) {
        // Anchor point itself — start translate
        this._pvDragging = true;
        this._pvDragMode = 'translate';
        this._pvDragStartScreen = { x: pos.x, y: pos.y };
        this._pvDragStartAnchor = { x: ax, y: ay };
        return;
      }
      // Non-anchor intersection — start scale
      const screenAnchor = this.viewport.mapToScreen(ax, ay);
      this._pvDragging = true;
      this._pvDragMode = 'scale';
      this._pvDragStartScreen = { x: pos.x, y: pos.y };
      this._pvDragStartMpp = this._previewMpp;
      this._pvDragStartDist = Math.hypot(pos.x - screenAnchor.x, pos.y - screenAnchor.y);
      return;
    }

    // Click on empty space — start translate
    this._pvDragging = true;
    this._pvDragMode = 'translate';
    this._pvDragStartScreen = { x: pos.x, y: pos.y };
    this._pvDragStartAnchor = { x: this._previewAnchorX, y: this._previewAnchorY };
  }

  _onPreviewMouseMove(pos) {
    if (!this._pvDragging) {
      const hit = this._hitTestPreview(pos);
      this._pvHoveredIntersection = hit;
      this.bus.emit('render:request');
      return;
    }

    if (this._pvDragMode === 'translate') {
      const dx = (pos.x - this._pvDragStartScreen.x) / this.viewport.zoom;
      const dy = (pos.y - this._pvDragStartScreen.y) / this.viewport.zoom;
      this._previewAnchorX = this._pvDragStartAnchor.x + dx;
      this._previewAnchorY = this._pvDragStartAnchor.y + dy;
    } else if (this._pvDragMode === 'scale') {
      const screenAnchor = this.viewport.mapToScreen(this._previewAnchorX, this._previewAnchorY);
      const curDist = Math.hypot(pos.x - screenAnchor.x, pos.y - screenAnchor.y);
      if (this._pvDragStartDist > 10 && curDist > 5) {
        const ratio = this._pvDragStartDist / curDist;
        this._previewMpp = Math.max(0.001, this._pvDragStartMpp * ratio);
      }
    }

    this.bus.emit('render:request');
  }

  _onPreviewMouseUp() {
    this._pvDragging = false;
    this._pvDragMode = null;
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

  // Double-click to toggle pin enabled/disabled
  onDblClick(pos) {
    if (this._previewActive || this._mode !== 'local') return;
    const map = this.viewport.screenToMap(pos.x, pos.y);
    const idx = this._hitTestLocal(map.x, map.y);
    if (idx < 0) return;

    const enabledCount = this._enabled.filter(Boolean).length;
    if (this._enabled[idx] && enabledCount <= 4) {
      this.bus.emit('calibration:snapResult', {
        pin: idx + 1,
        ok: false,
        why: 'at least 4 pins must stay enabled',
      });
      return;
    }
    this._enabled[idx] = !this._enabled[idx];
    this.bus.emit('calibration:snapResult', {
      pin: idx + 1,
      ok: true,
      why: this._enabled[idx] ? 'included' : 'excluded',
    });
    this.bus.emit('render:request');
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

    const { intersections } = this._getVisibleIntersections(viewport);
    if (intersections.length > 0) {
      const handleRadius = 5;

      for (const ix of intersections) {
        const screen = viewport.mapToScreen(ix.mapX, ix.mapY);
        const isAnchor = Math.abs(ix.gridX) < 0.01 && Math.abs(ix.gridY) < 0.01;
        const isHovered = this._pvHoveredIntersection &&
          Math.abs(this._pvHoveredIntersection.mapX - ix.mapX) < 0.01 &&
          Math.abs(this._pvHoveredIntersection.mapY - ix.mapY) < 0.01;

        if (isAnchor) continue;

        if (isHovered) {
          ctx.fillStyle = 'rgba(0, 200, 255, 0.6)';
          ctx.strokeStyle = 'rgba(0, 200, 255, 1)';
        } else {
          ctx.fillStyle = 'rgba(0, 200, 255, 0.15)';
          ctx.strokeStyle = 'rgba(0, 200, 255, 0.4)';
        }

        const r = isHovered ? handleRadius + 2 : handleRadius;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(8, 8, 340, this._pvDragging ? 62 : 44);
    ctx.fillStyle = 'rgba(0, 200, 255, 0.9)';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('Grid Preview  —  drag to move, drag node to scale', 14, 24);
    ctx.font = '11px monospace';
    ctx.fillStyle = 'rgba(200, 200, 200, 0.9)';
    ctx.fillText(`Scale: ${this._previewMpp.toFixed(4)} m/px`, 14, 42);
    if (this._pvDragging && this._pvDragMode === 'scale') {
      ctx.fillStyle = 'rgba(255, 200, 50, 0.8)';
      ctx.fillText(`scaling: ${this._previewMpp.toFixed(4)} m/px`, 14, 58);
    } else if (this._pvDragging && this._pvDragMode === 'translate') {
      ctx.fillStyle = 'rgba(255, 200, 50, 0.8)';
      ctx.fillText('moving grid...', 14, 58);
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
      `D ${diamPx}px  |  ${mpp.toFixed(2)} m/px`,
      screenCenter.x - 70,
      screenBottom.y + 20
    );
    ctx.restore();
  }

  _renderLocalOverlay(ctx, viewport) {
    if (!this._localInitialized || this._pins.length === 0) return;

    const cols = this.mapScale.cbCols;
    const rows = this.mapScale.cbRows;
    const zoom = viewport.zoom;

    ctx.save();
    ctx.translate(viewport.panX, viewport.panY);
    ctx.scale(zoom, zoom);

    // Grid lines between center pins and links to corner pins
    ctx.lineWidth = 1 / zoom;
    const pinsPerTarget = 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ci = (r * cols + c) * pinsPerTarget;
        const ki = ci + 1;
        // Dashed line between center pins
        ctx.strokeStyle = 'rgba(255, 200, 50, 0.25)';
        ctx.setLineDash([6 / zoom, 4 / zoom]);
        if (c < cols - 1) {
          const nextCi = ci + pinsPerTarget;
          ctx.beginPath();
          ctx.moveTo(this._pins[ci].x, this._pins[ci].y);
          ctx.lineTo(this._pins[nextCi].x, this._pins[nextCi].y);
          ctx.stroke();
        }
        if (r < rows - 1) {
          const belowCi = ((r + 1) * cols + c) * pinsPerTarget;
          ctx.beginPath();
          ctx.moveTo(this._pins[ci].x, this._pins[ci].y);
          ctx.lineTo(this._pins[belowCi].x, this._pins[belowCi].y);
          ctx.stroke();
        }
        // Dotted line from center to its corner pin
        ctx.strokeStyle = 'rgba(255, 200, 50, 0.15)';
        ctx.setLineDash([2 / zoom, 3 / zoom]);
        ctx.beginPath();
        ctx.moveTo(this._pins[ci].x, this._pins[ci].y);
        ctx.lineTo(this._pins[ki].x, this._pins[ki].y);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Pin markers — center pins get checkerboard icons, corner pins get smaller dots
    const pinR = 8 / zoom;
    const cornerR = 5 / zoom;
    const cbHalf = 7 / zoom;
    for (let i = 0; i < this._pins.length; i++) {
      const pin = this._pins[i];
      const isCenter = i % 2 === 0;
      const targetIdx = Math.floor(i / 2);
      const isOrigin = targetIdx === 0 && isCenter;
      const active = this._dragging && this._dragIndex === i;
      const enabled = this._enabled[i];

      if (isCenter) {
        // 2x2 checkerboard icon at center pin
        if (enabled) {
          ctx.globalAlpha = active ? 0.85 : 0.55;
          ctx.fillStyle = isOrigin ? '#8B9A6B' : '#5A5650';
          ctx.fillRect(pin.x - cbHalf, pin.y - cbHalf, cbHalf, cbHalf);
          ctx.fillStyle = '#1C1C1E';
          ctx.fillRect(pin.x, pin.y - cbHalf, cbHalf, cbHalf);
          ctx.fillStyle = '#1C1C1E';
          ctx.fillRect(pin.x - cbHalf, pin.y, cbHalf, cbHalf);
          ctx.fillStyle = '#5A5650';
          ctx.fillRect(pin.x, pin.y, cbHalf, cbHalf);
          ctx.globalAlpha = 1;
        }

        // Center pin ring
        const colour = !enabled ? 'rgba(150,150,150,.6)'
          : active ? 'rgba(255, 220, 80, 1)' : 'rgba(255, 200, 50, 0.85)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 3 / zoom;
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, pinR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1.5 / zoom;
        if (!enabled) ctx.setLineDash([3 / zoom, 3 / zoom]);
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, pinR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Crosshair
        const ch = 4 / zoom;
        ctx.strokeStyle = colour;
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        ctx.moveTo(pin.x - ch, pin.y); ctx.lineTo(pin.x + ch, pin.y);
        ctx.moveTo(pin.x, pin.y - ch); ctx.lineTo(pin.x, pin.y + ch);
        ctx.stroke();

        // Label
        const fontSize = Math.max(1, Math.round(10 / zoom));
        ctx.font = `bold ${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3 / zoom;
        ctx.fillStyle = enabled ? '#fff' : '#888';
        const labelY = pin.y - pinR - fontSize * 0.7;
        ctx.strokeText(String(targetIdx + 1), pin.x, labelY);
        ctx.fillText(String(targetIdx + 1), pin.x, labelY);

        // Origin marker
        if (isOrigin && enabled) {
          ctx.fillStyle = 'rgba(139, 154, 107, 0.9)';
          ctx.font = `bold ${Math.max(1, Math.round(8 / zoom))}px monospace`;
          ctx.fillText('ORIGIN', pin.x, pin.y + pinR + fontSize * 0.8);
        }
      } else {
        // Corner pin — smaller filled dot
        const colour = !enabled ? 'rgba(150,150,150,.4)'
          : active ? 'rgba(255, 220, 80, 1)' : 'rgba(255, 180, 50, 0.7)';
        ctx.fillStyle = colour;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1.5 / zoom;
        if (!enabled) ctx.setLineDash([2 / zoom, 2 / zoom]);
        ctx.beginPath();
        ctx.arc(pin.x, pin.y, cornerR, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        // Small crosshair
        const ch = 3 / zoom;
        ctx.strokeStyle = colour;
        ctx.lineWidth = 0.8 / zoom;
        ctx.beginPath();
        ctx.moveTo(pin.x - ch, pin.y); ctx.lineTo(pin.x + ch, pin.y);
        ctx.moveTo(pin.x, pin.y - ch); ctx.lineTo(pin.x, pin.y + ch);
        ctx.stroke();

        // Corner label
        const fontSize = Math.max(1, Math.round(8 / zoom));
        ctx.font = `${fontSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2 / zoom;
        ctx.fillStyle = enabled ? 'rgba(255,255,255,0.7)' : '#666';
        const labelY = pin.y - cornerR - fontSize * 0.6;
        ctx.strokeText(`${targetIdx + 1}c`, pin.x, labelY);
        ctx.fillText(`${targetIdx + 1}c`, pin.x, labelY);
      }
    }

    ctx.restore();

    // Info text in screen space
    const spacing = this.mapScale.cbSpacing;
    const enabledCount = this._enabled.filter(Boolean).length;
    const maxPinY = Math.max(...this._pins.map(p => p.y));
    const avgX = this._pins.reduce((s, p) => s + p.x, 0) / this._pins.length;
    const screenPos = viewport.mapToScreen(avgX, maxPinY + 30 / zoom);
    ctx.save();
    ctx.fillStyle = 'rgba(255, 200, 50, 0.9)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${cols}x${rows} targets (${this._pins.length} pins) @ ${spacing}m  |  ${enabledCount} active  |  dbl-click to toggle`,
      screenPos.x, screenPos.y
    );
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

    // Draw pins inside magnifier
    ctx.save();
    ctx.translate(ipx, ipy);
    ctx.scale(innerZoom, innerZoom);
    for (let i = 0; i < this._pins.length; i++) {
      const p = this._pins[i];
      const r = (i === this._dragIndex ? 5 : 3) / innerZoom;
      ctx.fillStyle = i === this._dragIndex ? 'rgba(255, 220, 80, 1)' : 'rgba(255, 200, 50, 0.4)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 1 / innerZoom;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Magnifier crosshair
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 14, cy); ctx.lineTo(cx - 5, cy);
    ctx.moveTo(cx + 5, cy);  ctx.lineTo(cx + 14, cy);
    ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy - 5);
    ctx.moveTo(cx, cy + 5);  ctx.lineTo(cx, cy + 14);
    ctx.stroke();

    ctx.restore();

    // Magnifier border
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 200, 50, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Tether line
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
