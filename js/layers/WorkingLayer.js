const METRES_PER_PIXEL = 4;

export class WorkingLayer {
  constructor(originX, originY, width, height, bus) {
    this.bus = bus;
    this.id = null;
    this.name = 'Working Area';
    this.type = 'working';
    this.visible = true;
    this.originX = originX;
    this.originY = originY;
    this.width = width;
    this.height = height;
    this.gridWidthM = width * METRES_PER_PIXEL;
    this.gridHeightM = height * METRES_PER_PIXEL;
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
    const cellMap = 1 / METRES_PER_PIXEL;
    const cellScreen = cellMap * viewport.zoom;

    const majorCellMap = 1;
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

    if (drawMinor) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 0.5 / viewport.zoom;
      ctx.beginPath();

      const startX = this.originX + Math.ceil((visLeft - this.originX) / cellMap) * cellMap;
      for (let x = startX; x <= visRight; x += cellMap) {
        ctx.moveTo(x, visTop);
        ctx.lineTo(x, visBottom);
      }

      const startY = this.originY + Math.ceil((visTop - this.originY) / cellMap) * cellMap;
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

      const startX = this.originX + Math.ceil((visLeft - this.originX) / majorCellMap) * majorCellMap;
      for (let x = startX; x <= visRight; x += majorCellMap) {
        ctx.moveTo(x, visTop);
        ctx.lineTo(x, visBottom);
      }

      const startY = this.originY + Math.ceil((visTop - this.originY) / majorCellMap) * majorCellMap;
      for (let y = startY; y <= visBottom; y += majorCellMap) {
        ctx.moveTo(visLeft, y);
        ctx.lineTo(visRight, y);
      }

      ctx.stroke();
    }
  }
}
