export const PAIR_ROLES = ['across', 'down', 'check'];
export const CALIB_METHODS = ['pairs', 'rectangle'];

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

    // Local mode, method 'pairs': three fixed measurement-pair slots. `check`
    // never carries a tile count — it's a cardinal-angle sanity edge.
    this._calibMethod = 'pairs';
    this._pairs = {
      across: { a: null, b: null, tiles: null },
      down: { a: null, b: null, tiles: null },
      check: { a: null, b: null, tiles: null },
    };
    this._selectedRole = null;

    // Local mode, method 'rectangle': four corners (in order around the
    // rectangle, so edge 0->1 is the width and 1->2 is the height) plus a
    // known width/height. The pairs above double as post-solve validators
    // in this method — dropped anywhere, compared against what the solved
    // homography implies there.
    this._rectangle = { corners: [null, null, null, null], widthTiles: null, heightTiles: null };

    // Shared drag state. `_dragTarget` is either { corner: 0..3 } or
    // { role, key: 'a'|'b' }.
    this._dragging = false;
    this._dragType = null;
    this._dragStart = null;
    this._startRadius = 0;
    this._startCenter = null;
    this._dragTarget = null;
    this._dragOffset = null;

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

    bus.on('map:loaded', () => {
      this._worldInitialized = false;
      this._resetCalibration();
    });
  }

  get pairs() {
    return {
      across: { ...this._pairs.across },
      down: { ...this._pairs.down },
      check: { ...this._pairs.check },
    };
  }

  get rectangle() {
    return {
      corners: this._rectangle.corners.map(c => (c ? { ...c } : null)),
      widthTiles: this._rectangle.widthTiles,
      heightTiles: this._rectangle.heightTiles,
    };
  }

  get calibMethod() {
    return this._calibMethod;
  }

  set calibMethod(val) {
    if (!CALIB_METHODS.includes(val)) return;
    this._calibMethod = val;
    this.bus.emit('calibration:methodChanged', val);
    this.bus.emit('render:request');
  }

  get previewActive() {
    return this._previewActive;
  }

  get selectedRole() {
    return this._selectedRole;
  }

  set selectedRole(role) {
    this._selectedRole = PAIR_ROLES.includes(role) ? role : null;
    this.bus.emit('render:request');
  }

  _resetCalibration() {
    this._pairs = {
      across: { a: null, b: null, tiles: null },
      down: { a: null, b: null, tiles: null },
      check: { a: null, b: null, tiles: null },
    };
    this._rectangle = { corners: [null, null, null, null], widthTiles: null, heightTiles: null };
    this._selectedRole = null;
    this.bus.emit('calibration:pairsChanged');
  }

  resetPairs() {
    this._resetCalibration();
    this.bus.emit('render:request');
  }

  setPairTiles(role, tiles) {
    if (role !== 'across' && role !== 'down') return;
    const n = parseFloat(tiles);
    this._pairs[role].tiles = (n > 0 && isFinite(n)) ? n : null;
    this.bus.emit('calibration:pairsChanged');
    this.bus.emit('render:request');
  }

  clearPair(role) {
    if (!PAIR_ROLES.includes(role)) return;
    this._pairs[role] = { a: null, b: null, tiles: null };
    this.bus.emit('calibration:pairsChanged');
    this.bus.emit('render:request');
  }

  setRectangleSize(widthTiles, heightTiles) {
    const w = parseFloat(widthTiles);
    const h = parseFloat(heightTiles);
    this._rectangle.widthTiles = (w > 0 && isFinite(w)) ? w : null;
    this._rectangle.heightTiles = (h > 0 && isFinite(h)) ? h : null;
    this.bus.emit('calibration:pairsChanged');
    this.bus.emit('render:request');
  }

  clearRectangle() {
    this._rectangle = { corners: [null, null, null, null], widthTiles: null, heightTiles: null };
    this.bus.emit('calibration:pairsChanged');
    this.bus.emit('render:request');
  }

  _nextIncompleteRole() {
    for (const role of PAIR_ROLES) {
      const p = this._pairs[role];
      if (!p.a || !p.b) return role;
    }
    return null;
  }

  activate() {
    if (this._previewActive) return;
    if (this._mode === 'world') this._activateWorld();
  }

  deactivate() {
    if (this._previewActive) this.exitPreview();
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
    return true; // clicking anywhere in local mode either drags or places a pin
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

  // --- Generic point access for whatever the drag target is ---

  _getPoint(target) {
    if (!target) return null;
    if ('corner' in target) return this._rectangle.corners[target.corner];
    return this._pairs[target.role][target.key];
  }

  _setPoint(target, pt) {
    if (!target) return;
    if ('corner' in target) this._rectangle.corners[target.corner] = pt;
    else this._pairs[target.role][target.key] = pt;
  }

  _hitTestLocal(mapX, mapY) {
    const threshold = 15 / this.viewport.zoom;
    if (this._calibMethod === 'rectangle') {
      for (let i = 0; i < 4; i++) {
        const pt = this._rectangle.corners[i];
        if (!pt) continue;
        if (Math.hypot(mapX - pt.x, mapY - pt.y) < threshold) return { corner: i };
      }
    }
    for (const role of PAIR_ROLES) {
      const p = this._pairs[role];
      for (const key of ['a', 'b']) {
        const pt = p[key];
        if (!pt) continue;
        if (Math.hypot(mapX - pt.x, mapY - pt.y) < threshold) return { role, key };
      }
    }
    return null;
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
      return;
    }

    // Local mode: pins are never snapped or nudged — they stay exactly
    // where dropped or dragged.
    const hit = this._hitTestLocal(map.x, map.y);
    if (hit) {
      const pt = this._getPoint(hit);
      this._dragging = true;
      this._dragTarget = hit;
      this._dragOffset = { x: pt.x - map.x, y: pt.y - map.y };
      if ('role' in hit) this._selectedRole = hit.role;
      this.bus.emit('render:request');
      return;
    }

    if (this._calibMethod === 'rectangle') {
      const idx = this._rectangle.corners.findIndex(c => !c);
      if (idx >= 0) {
        this._rectangle.corners[idx] = { x: map.x, y: map.y };
        this.bus.emit('calibration:pairsChanged');
        if (idx === 3) this.bus.emit('calibration:rectangleCompleted');
        this.bus.emit('render:request');
        return;
      }
    }

    const role = this._nextIncompleteRole();
    if (!role) return;
    const p = this._pairs[role];
    if (!p.a) p.a = { x: map.x, y: map.y };
    else p.b = { x: map.x, y: map.y };
    this._selectedRole = role;
    this.bus.emit('calibration:pairsChanged');
    if (p.a && p.b) this.bus.emit('calibration:pairCompleted', role);
    this.bus.emit('render:request');
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
      return;
    }

    this._setPoint(this._dragTarget, {
      x: map.x + this._dragOffset.x,
      y: map.y + this._dragOffset.y,
    });
    this.bus.emit('render:request');
  }

  onMouseUp() {
    if (this._previewActive) {
      this._onPreviewMouseUp();
      return;
    }
    if (this._dragging) {
      this._dragging = false;
      this._dragType = null;
      const draggedTarget = this._dragTarget;
      this._dragTarget = null;
      this._dragOffset = null;
      if (draggedTarget) this.bus.emit('calibration:pairsChanged');
      this.bus.emit('render:request');
    }
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

  onDblClick() {
    // No-op: local-mode pins no longer toggle enabled/disabled.
  }

  // --- Grid preview intersection detection (straighten → keep/discard) ---

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

  _onPreviewMouseDown(pos) {
    const hit = this._hitTestPreview(pos);

    if (hit) {
      const ax = this._previewAnchorX;
      const ay = this._previewAnchorY;
      if (Math.abs(hit.mapX - ax) < 1 && Math.abs(hit.mapY - ay) < 1) {
        this._pvDragging = true;
        this._pvDragMode = 'translate';
        this._pvDragStartScreen = { x: pos.x, y: pos.y };
        this._pvDragStartAnchor = { x: ax, y: ay };
        return;
      }
      const screenAnchor = this.viewport.mapToScreen(ax, ay);
      this._pvDragging = true;
      this._pvDragMode = 'scale';
      this._pvDragStartScreen = { x: pos.x, y: pos.y };
      this._pvDragStartMpp = this._previewMpp;
      this._pvDragStartDist = Math.hypot(pos.x - screenAnchor.x, pos.y - screenAnchor.y);
      return;
    }

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

  _drawSegment(ctx, zoom, a, b, colorStart, colorEnd, dashed) {
    ctx.lineWidth = 4 / zoom;
    ctx.strokeStyle = 'rgba(22, 24, 38, 0.7)';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grad.addColorStop(0, colorStart);
    grad.addColorStop(1, colorEnd);
    ctx.lineWidth = 2 / zoom;
    if (dashed) ctx.setLineDash([6 / zoom, 4 / zoom]);
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  _drawPin(ctx, zoom, pt, ringColor, active) {
    const r = (active ? 9.5 : 8.5) / zoom;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(28, 30, 44, 0.95)';
    ctx.fill();
    ctx.lineWidth = 1 / zoom;
    ctx.strokeStyle = 'rgba(22, 24, 38, 0.9)';
    ctx.stroke();
    ctx.lineWidth = 2.5 / zoom;
    ctx.strokeStyle = ringColor;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawChip(ctx, screenPt, label, ringColor) {
    ctx.save();
    ctx.font = '500 12px Inter, system-ui, sans-serif';
    const textW = ctx.measureText(label).width;
    const chipW = textW + 20;
    const chipH = 24;
    ctx.fillStyle = '#1c1e2c';
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 1;
    _roundRect(ctx, screenPt.x - chipW / 2, screenPt.y - chipH / 2, chipW, chipH, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ddd9fd';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, screenPt.x, screenPt.y + 0.5);
    ctx.restore();
  }

  _renderLocalOverlay(ctx, viewport) {
    const zoom = viewport.zoom;
    const ROLE_COLOR = {
      across: { line: '#b5abfc', lineEnd: '#ddd9fd' },
      down: { line: '#b5abfc', lineEnd: '#ddd9fd' },
      check: { line: '#f5d547', lineEnd: '#f5d547' },
    };
    const LETTER = { across: 'A', down: 'B', check: 'C' };
    const inRectMethod = this._calibMethod === 'rectangle';

    ctx.save();
    ctx.translate(viewport.panX, viewport.panY);
    ctx.scale(zoom, zoom);

    if (inRectMethod) {
      const corners = this._rectangle.corners;
      for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        if (!a || !b) continue;
        this._drawSegment(ctx, zoom, a, b, '#b5abfc', '#ddd9fd', false);
      }
      for (let i = 0; i < 4; i++) {
        const pt = corners[i];
        if (!pt) continue;
        const dragging = this._dragging && this._dragTarget && this._dragTarget.corner === i;
        this._drawPin(ctx, zoom, pt, '#ddd9fd', dragging);
      }
    }

    for (const role of PAIR_ROLES) {
      const p = this._pairs[role];
      if (!p.a) continue;
      const colors = ROLE_COLOR[role];
      const selected = this._selectedRole === role;

      if (p.b) {
        this._drawSegment(ctx, zoom, p.a, p.b, colors.line, colors.lineEnd, role === 'check');
      }

      for (const key of ['a', 'b']) {
        const pt = p[key];
        if (!pt) continue;
        const dragging = this._dragging && this._dragTarget
          && this._dragTarget.role === role && this._dragTarget.key === key;
        const ringColor = selected ? '#ddd9fd' : colors.lineEnd;
        this._drawPin(ctx, zoom, pt, ringColor, dragging);
      }
    }

    ctx.restore();

    // Mid-line/corner chips, drawn in screen space so text stays legible at any zoom.
    if (inRectMethod) {
      const corners = this._rectangle.corners;
      for (let i = 0; i < 4; i++) {
        const pt = corners[i];
        if (!pt) continue;
        const screen = viewport.mapToScreen(pt.x, pt.y);
        this._drawChip(ctx, screen, String(i + 1), '#3f424d');
      }
      if (corners[0] && corners[1]) {
        const mid = viewport.mapToScreen((corners[0].x + corners[1].x) / 2, (corners[0].y + corners[1].y) / 2);
        const label = this._rectangle.widthTiles
          ? `W  ${this._rectangle.widthTiles} tiles`
          : 'W  · click to set width';
        this._drawChip(ctx, mid, label, '#9184d9');
      }
      if (corners[1] && corners[2]) {
        const mid = viewport.mapToScreen((corners[1].x + corners[2].x) / 2, (corners[1].y + corners[2].y) / 2);
        const label = this._rectangle.heightTiles
          ? `H  ${this._rectangle.heightTiles} tiles`
          : 'H  · click to set height';
        this._drawChip(ctx, mid, label, '#9184d9');
      }
    }

    for (const role of PAIR_ROLES) {
      const p = this._pairs[role];
      if (!p.a || !p.b) continue;
      const midMap = { x: (p.a.x + p.b.x) / 2, y: (p.a.y + p.b.y) / 2 };
      const mid = viewport.mapToScreen(midMap.x, midMap.y);
      const selected = this._selectedRole === role;

      let label;
      if (role === 'check') {
        label = inRectMethod ? 'Check angle' : 'Check angle';
      } else if (inRectMethod) {
        label = `${LETTER[role]}  validate`;
      } else {
        const tiles = p.tiles;
        label = tiles ? `${LETTER[role]}  ${tiles} tiles` : `${LETTER[role]}  · click to set tiles`;
      }

      const ringColor = selected ? '#9184d9' : (role === 'check' ? 'rgba(245,213,71,0.6)' : '#3f424d');
      this._drawChip(ctx, mid, label, ringColor);
    }
  }

  _renderMagnifier(ctx, viewport) {
    if (!this._dragging || !this._dragTarget) return;
    const pin = this._getPoint(this._dragTarget);
    if (!pin) return;

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

    // Draw every placed pin inside the magnifier, dragged one highlighted.
    ctx.save();
    ctx.translate(ipx, ipy);
    ctx.scale(innerZoom, innerZoom);
    const isDraggedTarget = (target) => {
      if (!target) return false;
      if ('corner' in this._dragTarget) return 'corner' in target && target.corner === this._dragTarget.corner;
      return 'role' in target && target.role === this._dragTarget.role && target.key === this._dragTarget.key;
    };
    if (this._calibMethod === 'rectangle') {
      for (let i = 0; i < 4; i++) {
        const pt = this._rectangle.corners[i];
        if (!pt) continue;
        const active = isDraggedTarget({ corner: i });
        const r = (active ? 5 : 3) / innerZoom;
        ctx.fillStyle = active ? 'rgba(255, 220, 80, 1)' : 'rgba(181, 171, 252, 0.5)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1 / innerZoom;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    for (const role of PAIR_ROLES) {
      const p = this._pairs[role];
      for (const key of ['a', 'b']) {
        const pt = p[key];
        if (!pt) continue;
        const active = isDraggedTarget({ role, key });
        const r = (active ? 5 : 3) / innerZoom;
        ctx.fillStyle = active ? 'rgba(255, 220, 80, 1)' : 'rgba(181, 171, 252, 0.5)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1 / innerZoom;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.restore();

    // Magnifier crosshair
    ctx.strokeStyle = 'rgba(181, 171, 252, 0.9)';
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
    ctx.strokeStyle = 'rgba(181, 171, 252, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Tether line
    ctx.save();
    ctx.strokeStyle = 'rgba(181, 171, 252, 0.25)';
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
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
