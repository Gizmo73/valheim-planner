import { getEntry } from '../assets/AssetRegistry.js';
import { refreshIcons } from './icons.js';

const SNAP_MODES = [
  { mode: 'grid', label: 'Grid', icon: 'grid-3x3' },
  { mode: 'asset', label: 'Edge of piece', icon: 'magnet' },
  { mode: 'free', label: 'Free', icon: 'move' },
];

export class PlaceContextBar {
  constructor(placeTool, toolManager, bus) {
    this.placeTool = placeTool;
    this.toolManager = toolManager;
    this.bus = bus;
    this._el = document.getElementById('context-bar');
    this._visible = false;

    bus.on('tool:changed', (name) => {
      this._visible = name === 'place';
      this._el.classList.toggle('hidden', !this._visible);
      if (this._visible) this._render();
    });
    bus.on('place:changed', () => { if (this._visible) this._render(); });
    bus.on('snap:changed', () => { if (this._visible) this._render(); });
  }

  _render() {
    const state = this.placeTool.getState();
    const entry = state.assetType ? getEntry(state.assetType) : null;
    this._el.innerHTML = '';
    if (!entry) return;

    const piece = document.createElement('div');
    piece.className = 'ctx-piece';
    const swatch = document.createElement('canvas');
    swatch.width = 28;
    swatch.height = 28;
    swatch.className = 'ctx-piece-swatch';
    const tctx = swatch.getContext('2d');
    tctx.drawImage(entry.cls.getThumbnail(), 0, 0, 28, 28);
    const nameEl = document.createElement('span');
    nameEl.className = 'ctx-piece-name';
    nameEl.textContent = entry.name;
    const sizeEl = document.createElement('span');
    sizeEl.className = 'ctx-piece-size';
    sizeEl.textContent = `${entry.widthM} × ${entry.heightM} m`;
    piece.appendChild(swatch);
    piece.appendChild(nameEl);
    piece.appendChild(sizeEl);
    this._el.appendChild(piece);

    this._addSep();

    const ccw = this._button('rotate-ccw', '', () => this.bus.emit('mobile:rotate', -22.5));
    ccw.classList.add('icon-only');
    this._el.appendChild(ccw);

    const angle = document.createElement('span');
    angle.className = 'ctx-angle';
    angle.textContent = `${state.rotation}°`;
    this._el.appendChild(angle);

    const cw = this._button('rotate-cw', '', () => this.bus.emit('mobile:rotate', 22.5));
    cw.classList.add('icon-only');
    this._el.appendChild(cw);

    if (state.snapCount > 1) {
      this._addSep();
      const prev = this._button('chevron-left', 'Snap point', () => this.bus.emit('mobile:snapPrev'));
      this._el.appendChild(prev);
      const next = this._button('chevron-right', 'Snap point', () => this.bus.emit('mobile:snapNext'), true);
      this._el.appendChild(next);
    }

    this._addSep();
    const snapLabel = document.createElement('span');
    snapLabel.className = 'ctx-label';
    snapLabel.textContent = 'Snap';
    this._el.appendChild(snapLabel);

    for (const s of SNAP_MODES) {
      const btn = this._button(s.icon, s.label, () => this.toolManager.setSnapMode(s.mode));
      btn.classList.toggle('active', state.snapMode === s.mode);
      this._el.appendChild(btn);
    }

    this._addSep();
    const fillBtn = this._button('paint-bucket', 'Fill area', () => this.bus.emit('mobile:fill'));
    fillBtn.classList.toggle('active', state.fillMode);
    this._el.appendChild(fillBtn);

    const doneBtn = this._button('check', 'Done placing', () => this.bus.emit('tool:activate', 'select'));
    doneBtn.classList.add('ctx-done');
    this._el.appendChild(doneBtn);

    refreshIcons();
  }

  _addSep() {
    const sep = document.createElement('span');
    sep.className = 'ctx-sep';
    this._el.appendChild(sep);
  }

  _button(icon, label, onClick, iconAfter) {
    const btn = document.createElement('button');
    btn.className = 'ctx-btn';
    if (label) {
      btn.innerHTML = iconAfter
        ? `${label}<span><i data-lucide="${icon}"></i></span>`
        : `<span><i data-lucide="${icon}"></i></span>${label}`;
    } else {
      btn.innerHTML = `<i data-lucide="${icon}"></i>`;
    }
    btn.addEventListener('click', onClick);
    return btn;
  }
}
