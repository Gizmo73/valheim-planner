const METRES_PER_PIXEL = 4;

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
  }

  get mapX() {
    if (!this.workingLayer) return 0;
    return this.workingLayer.originX + this.gridX / METRES_PER_PIXEL;
  }

  get mapY() {
    if (!this.workingLayer) return 0;
    return this.workingLayer.originY + this.gridY / METRES_PER_PIXEL;
  }

  get mapWidth() {
    return this.widthM / METRES_PER_PIXEL;
  }

  get mapHeight() {
    return this.heightM / METRES_PER_PIXEL;
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

    const hw = this.mapWidth / 2;
    const hh = this.mapHeight / 2;
    return Math.abs(localX) <= hw && Math.abs(localY) <= hh;
  }

  render(ctx) {
    const cx = this.mapX + this.mapWidth / 2;
    const cy = this.mapY + this.mapHeight / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation * Math.PI / 180);
    this.draw(ctx, -this.mapWidth / 2, -this.mapHeight / 2, this.mapWidth, this.mapHeight);
    ctx.restore();
  }

  renderPreview(ctx, mapX, mapY, rotation, alpha) {
    const cx = mapX + this.mapWidth / 2;
    const cy = mapY + this.mapHeight / 2;

    ctx.save();
    ctx.globalAlpha = alpha || 0.6;
    ctx.translate(cx, cy);
    ctx.rotate(rotation * Math.PI / 180);
    this.draw(ctx, -this.mapWidth / 2, -this.mapHeight / 2, this.mapWidth, this.mapHeight);
    ctx.restore();
  }

  draw(ctx, x, y, w, h) {
    ctx.fillStyle = '#888';
    ctx.fillRect(x, y, w, h);
  }
}
