export const WORLD_DIAMETER = 21000;

export class MapScale {
  constructor(bus) {
    this.bus = bus;
    this._metresPerPixel = 4;
    this._locked = false;
    this._mapMode = 'world';
    this._tileW = 2;
    this._tileH = 2;
  }

  get metresPerPixel() {
    return this._metresPerPixel;
  }

  set metresPerPixel(val) {
    if (this._locked) return;
    if (val <= 0 || !isFinite(val)) return;
    this._metresPerPixel = val;
    this.bus.emit('scale:changed', val);
    this.bus.emit('render:request');
  }

  get locked() {
    return this._locked;
  }

  set locked(val) {
    this._locked = !!val;
    this.bus.emit('scale:lockChanged', this._locked);
  }

  get mapMode() {
    return this._mapMode;
  }

  set mapMode(val) {
    if (val !== 'world' && val !== 'local') return;
    this._mapMode = val;
    this.bus.emit('calibration:modeChanged', val);
  }

  get tileW() { return this._tileW; }

  set tileW(val) {
    if (val > 0 && isFinite(val)) {
      this._tileW = val;
      this.bus.emit('calibration:tileSizeChanged', { w: this._tileW, h: this._tileH });
    }
  }

  get tileH() { return this._tileH; }

  set tileH(val) {
    if (val > 0 && isFinite(val)) {
      this._tileH = val;
      this.bus.emit('calibration:tileSizeChanged', { w: this._tileW, h: this._tileH });
    }
  }

  circleDiameterPx() {
    return WORLD_DIAMETER / this._metresPerPixel;
  }

  setFromCircleDiameter(diameterPx) {
    this.metresPerPixel = WORLD_DIAMETER / diameterPx;
  }
}
