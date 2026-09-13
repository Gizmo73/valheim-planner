import { TILE_METRES } from './MapScale.js';

const STORAGE_KEY = 'valheim-planner:fineTuneStep';
export const NUDGE_STEPS = [1, 5, 0.25]; // px, px, tiles

function loadStep() {
  try {
    const n = parseFloat(localStorage.getItem(STORAGE_KEY));
    return NUDGE_STEPS.includes(n) ? n : NUDGE_STEPS[0];
  } catch {
    return NUDGE_STEPS[0];
  }
}

/**
 * Transient "nudge the solved alignment" state for the Plan tab's Fine
 * tune section. Nothing here touches the map image or mapScale directly —
 * it only tracks pending deltas relative to the current (already
 * straightened) calibration. WorkingLayer reads it to draw a live preview
 * grid; app.js's 'finetune:lock' handler bakes it in by re-warping the
 * image (reusing MapScale.buildStraightenMatrix), the same machinery
 * calibration itself uses.
 */
export class FineTuneState {
  constructor(mapScale, bus) {
    this.mapScale = mapScale;
    this.bus = bus;
    this._dxPx = 0;
    this._dyPx = 0;
    this._rotationDeg = 0;
    this._axisMode = 'uniform'; // latched: 'uniform' | 'x' | 'y'
    this._heldAxis = null; // transient key-hold override
    this._across = null; // px/tile override; null = derive from mapScale
    this._down = null;
    this._step = loadStep();
  }

  get baselinePxPerTile() {
    return TILE_METRES / this.mapScale.metresPerPixel;
  }

  get across() { return this._across != null ? this._across : this.baselinePxPerTile; }
  get down() { return this._down != null ? this._down : this.baselinePxPerTile; }
  get dxPx() { return this._dxPx; }
  get dyPx() { return this._dyPx; }
  get rotationDeg() { return this._rotationDeg; }

  get axisMode() { return this._heldAxis || this._axisMode; }
  get latchedAxisMode() { return this._axisMode; }
  set axisMode(v) {
    if (v !== 'uniform' && v !== 'x' && v !== 'y') return;
    this._axisMode = v;
    this._emit();
  }

  clearLatch() {
    this._axisMode = 'uniform';
    this._heldAxis = null;
    this._emit();
  }

  holdAxis(axis) {
    this._heldAxis = axis === 'x' || axis === 'y' ? axis : null;
    this._emit();
  }

  get step() { return this._step; }
  set step(v) {
    if (!NUDGE_STEPS.includes(v)) return;
    this._step = v;
    try { localStorage.setItem(STORAGE_KEY, String(v)); } catch { /* ignore */ }
    this.bus.emit('finetune:changed');
  }

  get hasPending() {
    return this._dxPx !== 0 || this._dyPx !== 0 || this._rotationDeg !== 0
      || this._across != null || this._down != null;
  }

  _emit() {
    this.bus.emit('finetune:changed');
    this.bus.emit('render:request');
  }

  nudge(dx, dy) {
    const stepPx = this._step < 1 ? this._step * this.baselinePxPerTile : this._step;
    this._dxPx += dx * stepPx;
    this._dyPx += dy * stepPx;
    this._emit();
  }

  recentre() {
    this._dxPx = 0;
    this._dyPx = 0;
    this._emit();
  }

  nudgeRotation(deltaDeg) {
    this._rotationDeg += deltaDeg;
    this._emit();
  }

  setAcross(v) {
    const n = parseFloat(v);
    if (!(n > 0) || !isFinite(n)) return;
    if (this.axisMode === 'uniform') {
      const ratio = n / this.across;
      this._across = n;
      this._down = this.down * ratio;
    } else {
      this._across = n;
    }
    this._emit();
  }

  setDown(v) {
    const n = parseFloat(v);
    if (!(n > 0) || !isFinite(n)) return;
    if (this.axisMode === 'uniform') {
      const ratio = n / this.down;
      this._down = n;
      this._across = this.across * ratio;
    } else {
      this._down = n;
    }
    this._emit();
  }

  reset() {
    this._dxPx = 0;
    this._dyPx = 0;
    this._rotationDeg = 0;
    this._across = null;
    this._down = null;
    this._emit();
  }
}
