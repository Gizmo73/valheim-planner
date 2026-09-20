export class Viewport {
  constructor(bus) {
    this.bus = bus;
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this.rotation = 0;
    this.minZoom = 0.02;
    this.maxZoom = 256;
  }

  screenToMap(sx, sy) {
    const ux = (sx - this.panX) / this.zoom;
    const uy = (sy - this.panY) / this.zoom;
    if (this.rotation === 0) return { x: ux, y: uy };
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    return {
      x: ux * cos - uy * sin,
      y: ux * sin + uy * cos,
    };
  }

  mapToScreen(mx, my) {
    let rx = mx, ry = my;
    if (this.rotation !== 0) {
      const cos = Math.cos(this.rotation);
      const sin = Math.sin(this.rotation);
      rx = mx * cos - my * sin;
      ry = mx * sin + my * cos;
    }
    return {
      x: rx * this.zoom + this.panX,
      y: ry * this.zoom + this.panY,
    };
  }

  panBy(dx, dy) {
    this.panX += dx;
    this.panY += dy;
    this.bus.emit('viewport:changed');
    this.bus.emit('render:request');
  }

  zoomAt(screenX, screenY, delta) {
    const factor = delta > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
    if (newZoom === this.zoom) return;

    const mapBefore = this.screenToMap(screenX, screenY);
    this.zoom = newZoom;
    const screenAfter = this.mapToScreen(mapBefore.x, mapBefore.y);
    this.panX += screenX - screenAfter.x;
    this.panY += screenY - screenAfter.y;

    this.bus.emit('viewport:changed');
    this.bus.emit('render:request');
  }

  fitImage(imgWidth, imgHeight, canvasWidth, canvasHeight) {
    const scaleX = canvasWidth / imgWidth;
    const scaleY = canvasHeight / imgHeight;
    this.zoom = Math.min(scaleX, scaleY) * 0.9;
    this.panX = (canvasWidth - imgWidth * this.zoom) / 2;
    this.panY = (canvasHeight - imgHeight * this.zoom) / 2;
    this.bus.emit('viewport:changed');
    this.bus.emit('render:request');
  }

  fitRect(mapX, mapY, mapW, mapH, canvasWidth, canvasHeight, minZoom) {
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const corners = [
      [mapX, mapY], [mapX + mapW, mapY],
      [mapX + mapW, mapY + mapH], [mapX, mapY + mapH],
    ];
    let rMinX = Infinity, rMaxX = -Infinity, rMinY = Infinity, rMaxY = -Infinity;
    for (const [cx, cy] of corners) {
      const rx = cx * cos - cy * sin;
      const ry = cx * sin + cy * cos;
      rMinX = Math.min(rMinX, rx); rMaxX = Math.max(rMaxX, rx);
      rMinY = Math.min(rMinY, ry); rMaxY = Math.max(rMaxY, ry);
    }
    const rW = rMaxX - rMinX;
    const rH = rMaxY - rMinY;

    const scaleX = canvasWidth / rW;
    const scaleY = canvasHeight / rH;
    let targetZoom = Math.min(scaleX, scaleY) * 0.85;
    if (minZoom && targetZoom < minZoom) targetZoom = minZoom;
    targetZoom = Math.min(targetZoom, this.maxZoom);
    this.zoom = targetZoom;

    const midX = (rMinX + rMaxX) / 2;
    const midY = (rMinY + rMaxY) / 2;
    this.panX = canvasWidth / 2 - midX * this.zoom;
    this.panY = canvasHeight / 2 - midY * this.zoom;
    this.bus.emit('viewport:changed');
    this.bus.emit('render:request');
  }

  getVisibleMapBounds(canvasWidth, canvasHeight) {
    const c0 = this.screenToMap(0, 0);
    const c1 = this.screenToMap(canvasWidth, 0);
    const c2 = this.screenToMap(canvasWidth, canvasHeight);
    const c3 = this.screenToMap(0, canvasHeight);
    const xs = [c0.x, c1.x, c2.x, c3.x];
    const ys = [c0.y, c1.y, c2.y, c3.y];
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
}
