export class GridSettings {
  constructor(bus) {
    this.bus = bus;
    this._visible = true;
    this._color = '#f3f5fe';
    this._lineWidth = 0.5;
    this._opacity = 0.12;
    this._majorEvery = 4;
  }

  get visible() { return this._visible; }
  set visible(v) {
    this._visible = !!v;
    this.bus.emit('grid:changed');
    this.bus.emit('render:request');
  }

  get color() { return this._color; }
  set color(v) {
    this._color = v;
    this.bus.emit('grid:changed');
    this.bus.emit('render:request');
  }

  get lineWidth() { return this._lineWidth; }
  set lineWidth(v) {
    const n = parseFloat(v);
    if (!isFinite(n) || n <= 0) return;
    this._lineWidth = n;
    this.bus.emit('grid:changed');
    this.bus.emit('render:request');
  }

  get opacity() { return this._opacity; }
  set opacity(v) {
    const n = parseFloat(v);
    if (!isFinite(n)) return;
    this._opacity = Math.min(1, Math.max(0, n));
    this.bus.emit('grid:changed');
    this.bus.emit('render:request');
  }

  get majorEvery() { return this._majorEvery; }
  set majorEvery(v) {
    const n = Math.round(v);
    if (!isFinite(n) || n < 2) return;
    this._majorEvery = n;
    this.bus.emit('grid:changed');
    this.bus.emit('render:request');
  }
}
