export class WorkingLayer {
  constructor(originX, originY, width, height, bus, mapScale) {
    this.bus = bus;
    this.mapScale = mapScale;
    this.id = null;
    this.name = 'Working Area';
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
    ctx.save();

    ctx.strokeStyle = 'rgba(0, 200, 255, 0.7)';
    ctx.lineWidth = 2 / viewport.zoom;
    ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
    ctx.strokeRect(this.originX, this.originY, this.width, this.height);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(0, 200, 255, 0.04)';
    ctx.fillRect(this.originX, this.originY, this.width, this.height);

    this._drawGrid(ctx, viewport, canvasWidth, canvasHeight);

    ctx.restore();
  }

  _drawGrid(ctx, viewport, canvasWidth, canvasHeight) {
    const mpp = this._mpp;
    const cellMap = 1 / mpp;
    const cellScreen = cellMap * viewport.zoom;

    const majorCellMap = 4 / mpp;
    const majorCellScreen = majorCellMap * viewport.zoom;

    let drawMinor = cellScreen >= 8;
    let drawMajor = majorCellScreen >= 8;

    if (!drawMinor && !drawMajor) return;

    const visBounds = viewport.getVisibleMapBounds(canvasWidth, canvasHeight);
    const visLeft = Math.max(this.originX, visBounds.x);
    const visTop = Math.max(this.originY, visBounds.y);
    const visRight = Math.min(this.originX + this.width, visBounds.x + visBounds.w);
    const visBottom = Math.min(this.originY + this.height, visBounds.y + visBounds.h);

    if (visLeft >= visRight || visTop >= visBottom) return;

    const anchorX = this.gridAnchorX != null ? this.gridAnchorX : this.originX;
    const anchorY = this.gridAnchorY != null ? this.gridAnchorY : this.originY;

    if (drawMinor) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 0.5 / viewport.zoom;
      ctx.beginPath();

      const startX = anchorX + Math.ceil((visLeft - anchorX) / cellMap) * cellMap;
      for (let x = startX; x <= visRight; x += cellMap) {
        ctx.moveTo(x, visTop);
        ctx.lineTo(x, visBottom);
      }

      const startY = anchorY + Math.ceil((visTop - anchorY) / cellMap) * cellMap;
      for (let y = startY; y <= visBottom; y += cellMap) {
        ctx.moveTo(visLeft, y);
        ctx.lineTo(visRight, y);
      }

      ctx.stroke();
    }

    if (drawMajor) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1 / viewport.zoom;
      ctx.beginPath();

      const startX = anchorX + Math.ceil((visLeft - anchorX) / majorCellMap) * majorCellMap;
      for (let x = startX; x <= visRight; x += majorCellMap) {
        ctx.moveTo(x, visTop);
        ctx.lineTo(x, visBottom);
      }

      const startY = anchorY + Math.ceil((visTop - anchorY) / majorCellMap) * majorCellMap;
      for (let y = startY; y <= visBottom; y += majorCellMap) {
        ctx.moveTo(visLeft, y);
        ctx.lineTo(visRight, y);
      }

      ctx.stroke();
    }
  }
}
