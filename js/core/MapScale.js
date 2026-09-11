export const WORLD_DIAMETER = 21000;

export class MapScale {
  constructor(bus) {
    this.bus = bus;
    this._metresPerPixel = 4;
    this._locked = false;
    this._mapMode = 'local';
    this._cbCols = 2;
    this._cbRows = 2;
    this._cbSpacing = 16;
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

  get cbCols() { return this._cbCols; }

  set cbCols(val) {
    const v = Math.round(val);
    if (v >= 2 && v <= 10) {
      this._cbCols = v;
      this.bus.emit('calibration:gridChanged');
    }
  }

  get cbRows() { return this._cbRows; }

  set cbRows(val) {
    const v = Math.round(val);
    if (v >= 2 && v <= 10) {
      this._cbRows = v;
      this.bus.emit('calibration:gridChanged');
    }
  }

  get cbSpacing() { return this._cbSpacing; }

  set cbSpacing(val) {
    if (val >= 2 && isFinite(val)) {
      this._cbSpacing = val;
      this.bus.emit('calibration:gridChanged');
    }
  }

  circleDiameterPx() {
    return WORLD_DIAMETER / this._metresPerPixel;
  }

  setFromCircleDiameter(diameterPx) {
    this.metresPerPixel = WORLD_DIAMETER / diameterPx;
  }
}
