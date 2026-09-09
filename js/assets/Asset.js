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
  }

  get _mpp() {
    return this.mapScale ? this.mapScale.metresPerPixel : 4;
  }

  get mapX() {
    if (!this.workingLayer) return 0;
    return this.workingLayer.originX + this.gridX / this._mpp;
  }

  get mapY() {
    if (!this.workingLayer) return 0;
    return this.workingLayer.originY + this.gridY / this._mpp;
  }

  get mapWidth() {
    return this.widthM / this._mpp;
  }

  get mapHeight() {
    return this.heightM / this._mpp;
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

    const minHit = 0.5 / this._mpp;
    const hw = Math.max(this.mapWidth / 2, minHit);
    const hh = Math.max(this.mapHeight / 2, minHit);
    return Math.abs(localX) <= hw && Math.abs(localY) <= hh;
  }

  render(ctx, viewport) {
    const cx = this.mapX + this.mapWidth / 2;
    const cy = this.mapY + this.mapHeight / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation * Math.PI / 180);
    this.draw(ctx, -this.mapWidth / 2, -this.mapHeight / 2, this.mapWidth, this.mapHeight);

    const lw = viewport ? 1 / viewport.zoom : 0.5;
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = lw;
    ctx.strokeRect(-this.mapWidth / 2, -this.mapHeight / 2, this.mapWidth, this.mapHeight);

    ctx.restore();
  }

  renderPreview(ctx, mapX, mapY, rotation, alpha, viewport) {
    const cx = mapX + this.mapWidth / 2;
    const cy = mapY + this.mapHeight / 2;

    ctx.save();
    ctx.globalAlpha = alpha || 0.6;
    ctx.translate(cx, cy);
    ctx.rotate(rotation * Math.PI / 180);
    this.draw(ctx, -this.mapWidth / 2, -this.mapHeight / 2, this.mapWidth, this.mapHeight);

    const lw = viewport ? 1 / viewport.zoom : 0.5;
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.4)';
    ctx.lineWidth = lw;
    ctx.strokeRect(-this.mapWidth / 2, -this.mapHeight / 2, this.mapWidth, this.mapHeight);

    ctx.restore();
  }

  draw(ctx, x, y, w, h) {
    ctx.fillStyle = '#888';
    ctx.fillRect(x, y, w, h);
  }
}
