const STORAGE_KEY = 'valheim-planner:gridSettings';

const DEFAULTS = {
  visible: true,
  color: '#4ee3ec',
  minorWidth: 1.5,
  majorWidth: 2.5,
  majorEvery: 5,
  abovePieces: true,
};

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export class GridSettings {
  constructor(bus) {
    this.bus = bus;
    const saved = loadPersisted();
    this._visible = saved.visible != null ? saved.visible : DEFAULTS.visible;
    this._color = saved.color || DEFAULTS.color;
    this._minorWidth = saved.minorWidth > 0 ? saved.minorWidth : DEFAULTS.minorWidth;
    this._majorWidth = saved.majorWidth > 0 ? saved.majorWidth : DEFAULTS.majorWidth;
    this._majorEvery = saved.majorEvery >= 2 ? saved.majorEvery : DEFAULTS.majorEvery;
    this._abovePieces = saved.abovePieces != null ? saved.abovePieces : DEFAULTS.abovePieces;
  }

  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        visible: this._visible,
        color: this._color,
        minorWidth: this._minorWidth,
        majorWidth: this._majorWidth,
        majorEvery: this._majorEvery,
        abovePieces: this._abovePieces,
      }));
    } catch {
      // localStorage unavailable (private mode, etc.) — settings just won't persist.
    }
  }

  _changed() {
    this._persist();
    this.bus.emit('grid:changed');
    this.bus.emit('render:request');
  }

  get visible() { return this._visible; }
  set visible(v) { this._visible = !!v; this._changed(); }

  get color() { return this._color; }
  set color(v) { this._color = v; this._changed(); }

  get minorWidth() { return this._minorWidth; }
  set minorWidth(v) {
    const n = parseFloat(v);
    if (!isFinite(n) || n <= 0) return;
    this._minorWidth = n;
    this._changed();
  }

  get majorWidth() { return this._majorWidth; }
  set majorWidth(v) {
    const n = parseFloat(v);
    if (!isFinite(n) || n <= 0) return;
    this._majorWidth = n;
    this._changed();
  }

  get majorEvery() { return this._majorEvery; }
  set majorEvery(v) {
    const n = Math.round(v);
    if (!isFinite(n) || n < 2) return;
    this._majorEvery = n;
    this._changed();
  }

  get abovePieces() { return this._abovePieces; }
  set abovePieces(v) { this._abovePieces = !!v; this._changed(); }
}
