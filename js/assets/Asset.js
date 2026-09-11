let nextAssetId = 1;

export class Asset {
  constructor(type, widthM, heightM) {
    this.id = 'asset-' + nextAssetId++;
    this.type = type;
    this.widthM = widthM;
    this.heightM = heightM;
    this.gridX = 0;
    this.gridY = 0;
    this.rotation = 0;
    this.workingLayer = null;
    this.mapScale = null;
    this.groupId = 'default';
    this._shape = 'rect';
    this._snapAlignment = 'corner';
  }

  get _mpp() {
    return this.mapScale ? this.mapScale.metresPerPixel : 4;
  }

  get mapX() {
    if (!this.workingLayer) return 0;
    const ax = this.workingLayer.gridAnchorX != null ? this.workingLayer.gridAnchorX : this.workingLayer.originX;
    return ax + this.gridX / this._mpp;
  }

  get mapY() {
    if (!this.workingLayer) return 0;
    const ay = this.workingLayer.gridAnchorY != null ? this.workingLayer.gridAnchorY : this.workingLayer.originY;
    return ay + this.gridY / this._mpp;
  }

  get mapWidth() {
    return this.widthM / this._mpp;
  }

  get mapHeight() {
    return this.heightM / this._mpp;
  }

  getGridSnapOffset() {
    if (this._snapAlignment === 'center') {
      return { x: -this.widthM / 2, y: -this.heightM / 2 };
    }
    return { x: 0, y: 0 };
  }

  getGridSnapPoints() {
    const hw = this.widthM / 2;
    const hh = this.heightM / 2;
    return [
      { x: -hw, y: -hh },
      { x: hw, y: -hh },
      { x: hw, y: hh },
      { x: -hw, y: hh },
    ];
  }

  getLocalSnapOffsets() {
    const hw = this.mapWidth / 2;
    const hh = this.mapHeight / 2;
    return [
      [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh],
      [0, -hh], [hw, 0], [0, hh], [-hw, 0],
    ];
  }

  rotate(degrees) {
    this.rotation = ((this.rotation + degrees) % 360 + 360) % 360;
  }

  containsPoint(mapPtX, mapPtY) {
    const cx = this.mapX + this.mapWidth / 2;
    const cy = this.mapY + this.mapHeight / 2;

    const rad = -this.rotation * Math.PI / 180;
    const dx = mapPtX - cx;
    const dy = mapPtY - cy;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

    if (this._shape === 'circle') {
      const r = Math.max(this.mapWidth, this.mapHeight) / 2;
      const minR = 0.5 / this._mpp;
      const effectiveR = Math.max(r, minR);
      return localX * localX + localY * localY <= effectiveR * effectiveR;
    }

    const minHit = 0.5 / this._mpp;
    const hw = Math.max(this.mapWidth / 2, minHit);
    const hh = Math.max(this.mapHeight / 2, minHit);
    return Math.abs(localX) <= hw && Math.abs(localY) <= hh;
  }

  _drawOutline(ctx, zoom) {
    ctx.lineWidth = 1 / zoom;
    if (this._shape === 'circle') {
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(this.mapWidth, this.mapHeight) / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (this._shape === 'octagon') {
      const hw = this.mapWidth / 2, hh = this.mapHeight / 2;
      const d = Math.min(this.mapWidth, this.mapHeight) * 0.2;
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
      ctx.beginPath();
      ctx.moveTo(-hw + d, -hh);
      ctx.lineTo(hw - d, -hh);
      ctx.lineTo(hw, -hh + d);
      ctx.lineTo(hw, hh - d);
      ctx.lineTo(hw - d, hh);
      ctx.lineTo(-hw + d, hh);
      ctx.lineTo(-hw, hh - d);
      ctx.lineTo(-hw, -hh + d);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
      ctx.strokeRect(-this.mapWidth / 2, -this.mapHeight / 2, this.mapWidth, this.mapHeight);
    }
  }

  render(ctx, viewport) {
    const cx = this.mapX + this.mapWidth / 2;
    const cy = this.mapY + this.mapHeight / 2;
    const zoom = viewport ? viewport.zoom : 1;
    const screenW = this.mapWidth * zoom;
    const screenH = this.mapHeight * zoom;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation * Math.PI / 180);

    if (screenW >= 4 && screenH >= 4) {
      this.draw(ctx, -this.mapWidth / 2, -this.mapHeight / 2, this.mapWidth, this.mapHeight);
      this._drawOutline(ctx, zoom);
    } else {
      const s = 5 / zoom;
      ctx.fillStyle = '#e8a020';
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1 / zoom;
      ctx.strokeRect(-s, -s, s * 2, s * 2);
    }

    ctx.restore();
  }

  renderPreview(ctx, mapX, mapY, rotation, alpha, viewport) {
    const cx = mapX + this.mapWidth / 2;
    const cy = mapY + this.mapHeight / 2;
    const zoom = viewport ? viewport.zoom : 1;
    const screenW = this.mapWidth * zoom;
    const screenH = this.mapHeight * zoom;

    ctx.save();
    ctx.globalAlpha = alpha || 0.6;
    ctx.translate(cx, cy);
    ctx.rotate(rotation * Math.PI / 180);

    if (screenW >= 4 && screenH >= 4) {
      this.draw(ctx, -this.mapWidth / 2, -this.mapHeight / 2, this.mapWidth, this.mapHeight);
      this._drawOutline(ctx, zoom);
    } else {
      const s = 5 / zoom;
      ctx.fillStyle = '#e8a020';
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1 / zoom;
      ctx.strokeRect(-s, -s, s * 2, s * 2);
    }

    ctx.restore();
  }

  serialize() {
    return {
      type: this.type,
      gridX: this.gridX,
      gridY: this.gridY,
      rotation: this.rotation,
      groupId: this.groupId,
      workingLayerId: this.workingLayer ? this.workingLayer.id : null,
    };
  }

  draw(ctx, x, y, w, h) {
    ctx.fillStyle = '#888';
    ctx.fillRect(x, y, w, h);
  }
}
