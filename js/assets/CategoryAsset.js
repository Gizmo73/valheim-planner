import { Asset } from './Asset.js';
import { isCircle, pointInPolygon, boundsOf } from './shapes.js';
import { getCategoryModule } from './AssetRegistry.js';
import { renderVariantTexture } from './textureCache.js';

export class CategoryAsset extends Asset {
  constructor(type, categoryId, variantId, widthM, heightM, snapPoints) {
    super(type, widthM, heightM);
    this.categoryId = categoryId;
    this.variantId = variantId;
    this._snapPoints = snapPoints || null;
  }

  _shapeResult() {
    const mod = getCategoryModule(this.categoryId);
    return mod ? mod.shape(this.variantId) : null;
  }

  containsPoint(mapPtX, mapPtY) {
    const shapeResult = this._shapeResult();
    if (!shapeResult) return super.containsPoint(mapPtX, mapPtY);

    const cx = this.mapX + this.mapWidth / 2;
    const cy = this.mapY + this.mapHeight / 2;
    const rad = -this.rotation * Math.PI / 180;
    const dx = mapPtX - cx;
    const dy = mapPtY - cy;
    const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
    const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
    const mpp = this._mpp;

    if (isCircle(shapeResult)) {
      const r = Math.max(shapeResult.r / mpp, 0.5 / mpp);
      return localX * localX + localY * localY <= r * r;
    }

    // Guarantee a usable hit target even when the shape is tiny on screen,
    // mirroring the base class's minimum-touch-size guard.
    const minHit = 0.5 / mpp;
    const scaleX = Math.max(1, (minHit * 2) / Math.max(this.mapWidth, 1e-6));
    const scaleY = Math.max(1, (minHit * 2) / Math.max(this.mapHeight, 1e-6));
    const verts = shapeResult.map(p => ({ x: (p.x / mpp) * scaleX, y: (p.y / mpp) * scaleY }));
    return pointInPolygon(localX, localY, verts);
  }

  _drawOutline(ctx, zoom) {
    const shapeResult = this._shapeResult();
    if (!shapeResult) { super._drawOutline(ctx, zoom); return; }
    const mpp = this._mpp;
    ctx.lineWidth = 1 / zoom;
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.beginPath();
    if (isCircle(shapeResult)) {
      ctx.arc(0, 0, shapeResult.r / mpp, 0, Math.PI * 2);
    } else {
      shapeResult.forEach((p, i) => {
        const px = p.x / mpp, py = p.y / mpp;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath();
    }
    ctx.stroke();
  }

  getGridSnapPoints() {
    if (this._snapPoints && this._snapPoints.length) {
      return this._snapPoints.map(p => ({ x: p.x, y: p.y }));
    }
    const hw = this.widthM / 2, hh = this.heightM / 2;
    return [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }];
  }

  getLocalSnapOffsets() {
    const mpp = this._mpp;
    return this.getGridSnapPoints().map(p => [p.x / mpp, p.y / mpp]);
  }

  draw(ctx, x, y, w, h) {
    const tex = renderVariantTexture(this.categoryId, this.variantId, this.widthM, this.heightM);
    if (!tex) return;
    const shapeResult = this._shapeResult();
    if (!shapeResult) { ctx.drawImage(tex, x, y, w, h); return; }

    ctx.save();
    ctx.beginPath();
    if (isCircle(shapeResult)) {
      ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    } else {
      const b = boundsOf(shapeResult);
      const bw = Math.max(b.maxX - b.minX, 1e-6), bh = Math.max(b.maxY - b.minY, 1e-6);
      shapeResult.forEach((p, i) => {
        const px = x + (p.x - b.minX) / bw * w;
        const py = y + (p.y - b.minY) / bh * h;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.closePath();
    }
    ctx.clip();
    ctx.drawImage(tex, x, y, w, h);
    ctx.restore();
  }
}
