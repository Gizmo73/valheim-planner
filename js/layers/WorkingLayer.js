import { MapScale, TILE_METRES } from '../core/MapScale.js';

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const MINOR_ALPHA = 0.5;
const MAJOR_ALPHA = 0.95;

export class WorkingLayer {
  constructor(originX, originY, width, height, bus, mapScale, gridSettings, fineTuneState) {
    this.bus = bus;
    this.mapScale = mapScale;
    this.gridSettings = gridSettings || null;
    this.fineTuneState = fineTuneState || null;
    this.id = null;
    this.name = 'Build area';
    this.type = 'working';
    this.visible = true;
    this.originX = originX;
    this.originY = originY;
    this.width = width;
    this.height = height;
    this.gridAnchorX = null;
    this.gridAnchorY = null;
  }

  get _mpp() {
    return this.mapScale ? this.mapScale.metresPerPixel : 4;
  }

  get gridWidthM() {
    return this.width * this._mpp;
  }

  get gridHeightM() {
    return this.height * this._mpp;
  }

  containsMapPoint(mx, my) {
    return mx >= this.originX && mx <= this.originX + this.width
        && my >= this.originY && my <= this.originY + this.height;
  }

  render(ctx, viewport, canvasWidth, canvasHeight) {
    this.renderBase(ctx, viewport, canvasWidth, canvasHeight);
    this.renderGrid(ctx, viewport, canvasWidth, canvasHeight);
  }

  renderBase(ctx, viewport, canvasWidth, canvasHeight) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.7)';
    ctx.lineWidth = 2 / viewport.zoom;
    ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
    ctx.strokeRect(this.originX, this.originY, this.width, this.height);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(0, 200, 255, 0.04)';
    ctx.fillRect(this.originX, this.originY, this.width, this.height);
    ctx.restore();
  }

  renderGrid(ctx, viewport, canvasWidth, canvasHeight) {
    ctx.save();
    this._drawGrid(ctx, viewport, canvasWidth, canvasHeight);
    ctx.restore();
  }

  _drawGrid(ctx, viewport, canvasWidth, canvasHeight) {
    const gs = this.gridSettings;
    if (gs && !gs.visible) return;

    const mpp = this._mpp;
    const baselinePxPerTile = TILE_METRES / mpp;
    const ft = this.fineTuneState;
    const dxPx = ft ? ft.dxPx : 0;
    const dyPx = ft ? ft.dyPx : 0;
    const rotationDeg = ft ? ft.rotationDeg : 0;
    const acrossPxPerTile = ft ? ft.across : baselinePxPerTile;
    const downPxPerTile = ft ? ft.down : baselinePxPerTile;

    const acrossScreen = acrossPxPerTile * viewport.zoom;
    const downScreen = downPxPerTile * viewport.zoom;
    const majorEvery = gs ? gs.majorEvery : 5;

    const drawMinor = acrossScreen >= 8 && downScreen >= 8;
    const drawMajor = (acrossScreen * majorEvery) >= 8 && (downScreen * majorEvery) >= 8;
    if (!drawMinor && !drawMajor) return;

    const visBounds = viewport.getVisibleMapBounds(canvasWidth, canvasHeight);
    const visLeft = Math.max(this.originX, visBounds.x);
    const visTop = Math.max(this.originY, visBounds.y);
    const visRight = Math.min(this.originX + this.width, visBounds.x + visBounds.w);
    const visBottom = Math.min(this.originY + this.height, visBounds.y + visBounds.h);
    if (visLeft >= visRight || visTop >= visBottom) return;

    const baseAnchorX = this.gridAnchorX != null ? this.gridAnchorX : this.originX;
    const baseAnchorY = this.gridAnchorY != null ? this.gridAnchorY : this.originY;
    const anchorX = baseAnchorX + dxPx;
    const anchorY = baseAnchorY + dyPx;

    const { across: acrossDir, down: downDir } = MapScale.axisUnitVectors(rotationDeg);

    // Project the visible-area corners onto each axis (relative to anchor)
    // to find the tile-index range to draw — a rotated grid's index range
    // isn't a simple rectangle in screen space.
    const corners = [
      { x: visLeft, y: visTop }, { x: visRight, y: visTop },
      { x: visRight, y: visBottom }, { x: visLeft, y: visBottom },
    ];
    let aMin = Infinity, aMax = -Infinity, dMin = Infinity, dMax = -Infinity;
    for (const c of corners) {
      const rx = c.x - anchorX, ry = c.y - anchorY;
      const a = rx * acrossDir.x + ry * acrossDir.y;
      const d = rx * downDir.x + ry * downDir.y;
      aMin = Math.min(aMin, a); aMax = Math.max(aMax, a);
      dMin = Math.min(dMin, d); dMax = Math.max(dMax, d);
    }
    // Half the diagonal, so a line drawn through any grid index still
    // fully spans the visible area even after rotation.
    const halfDiag = Math.hypot(aMax - aMin, dMax - dMin) / 2 + Math.max(acrossPxPerTile, downPxPerTile);

    const color = gs ? gs.color : '#4ee3ec';
    const minorWidth = gs ? gs.minorWidth : 1.5;
    const majorWidth = gs ? gs.majorWidth : 2.5;

    const drawFamily = (spacing, dir, otherDir, lo, hi, width, alpha) => {
      if (spacing <= 0) return;
      ctx.strokeStyle = hexToRgba(color, alpha);
      ctx.lineWidth = width / viewport.zoom;
      ctx.beginPath();
      const iStart = Math.floor(lo / spacing);
      const iEnd = Math.ceil(hi / spacing);
      for (let i = iStart; i <= iEnd; i++) {
        const base = i * spacing;
        const cx = anchorX + dir.x * base;
        const cy = anchorY + dir.y * base;
        ctx.moveTo(cx - otherDir.x * halfDiag, cy - otherDir.y * halfDiag);
        ctx.lineTo(cx + otherDir.x * halfDiag, cy + otherDir.y * halfDiag);
      }
      ctx.stroke();
    };

    ctx.save();
    ctx.beginPath();
    ctx.rect(visLeft, visTop, visRight - visLeft, visBottom - visTop);
    ctx.clip();

    if (drawMinor) {
      drawFamily(acrossPxPerTile, acrossDir, downDir, aMin, aMax, minorWidth, MINOR_ALPHA);
      drawFamily(downPxPerTile, downDir, acrossDir, dMin, dMax, minorWidth, MINOR_ALPHA);
    }
    if (drawMajor) {
      drawFamily(acrossPxPerTile * majorEvery, acrossDir, downDir, aMin, aMax, majorWidth, MAJOR_ALPHA);
      drawFamily(downPxPerTile * majorEvery, downDir, acrossDir, dMin, dMax, majorWidth, MAJOR_ALPHA);
    }

    ctx.restore();
  }
}
