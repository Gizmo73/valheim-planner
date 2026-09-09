export const WORLD_DIAMETER = 21000;

export class MapScale {
  constructor(bus) {
    this.bus = bus;
    this._metresPerPixel = 4;
    this._locked = false;
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

  circleDiameterPx() {
    return WORLD_DIAMETER / this._metresPerPixel;
  }

  setFromCircleDiameter(diameterPx) {
    this.metresPerPixel = WORLD_DIAMETER / diameterPx;
  }
}
