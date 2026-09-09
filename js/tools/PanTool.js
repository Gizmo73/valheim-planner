export class PanTool {
  constructor(viewport, bus) {
    this.viewport = viewport;
    this.bus = bus;
    this._dragging = false;
    this._last = null;
  }

  activate() {}
  deactivate() { this._dragging = false; }

  onMouseDown(pos) {
    this._dragging = true;
    this._last = pos;
  }

  onMouseMove(pos) {
    if (!this._dragging) return;
    this.viewport.panBy(pos.x - this._last.x, pos.y - this._last.y);
    this._last = pos;
  }

  onMouseUp() {
    this._dragging = false;
  }
}
