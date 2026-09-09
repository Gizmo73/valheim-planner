export class Viewport {
  constructor(bus) {
    this.bus = bus;
    this.panX = 0;
    this.panY = 0;
    this.zoom = 1;
    this.minZoom = 0.02;
    this.maxZoom = 256;
  }

  screenToMap(sx, sy) {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom,
    };
  }

  mapToScreen(mx, my) {
    return {
      x: mx * this.zoom + this.panX,
      y: my * this.zoom + this.panY,
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
    this.panX = screenX - mapBefore.x * this.zoom;
    this.panY = screenY - mapBefore.y * this.zoom;

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
    const scaleX = canvasWidth / mapW;
    const scaleY = canvasHeight / mapH;
    let targetZoom = Math.min(scaleX, scaleY) * 0.85;
    if (minZoom && targetZoom < minZoom) targetZoom = minZoom;
    targetZoom = Math.min(targetZoom, this.maxZoom);
    this.zoom = targetZoom;
    this.panX = canvasWidth / 2 - (mapX + mapW / 2) * this.zoom;
    this.panY = canvasHeight / 2 - (mapY + mapH / 2) * this.zoom;
    this.bus.emit('viewport:changed');
    this.bus.emit('render:request');
  }

  getVisibleMapBounds(canvasWidth, canvasHeight) {
    const topLeft = this.screenToMap(0, 0);
    const bottomRight = this.screenToMap(canvasWidth, canvasHeight);
    return {
      x: topLeft.x,
      y: topLeft.y,
      w: bottomRight.x - topLeft.x,
      h: bottomRight.y - topLeft.y,
    };
  }
}
