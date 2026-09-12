import { refreshIcons } from './icons.js';

const TOOLS = [
  { name: 'select', label: 'Select', icon: 'mouse-pointer-2' },
  { name: 'place', label: 'Place', icon: 'blocks' },
  { name: 'region', label: 'Build area', icon: 'square-dashed' },
  { name: 'pan', label: 'Pan', icon: 'hand' },
];

export class Toolbar {
  constructor(toolManager, mapScale, bus) {
    this.toolManager = toolManager;
    this.mapScale = mapScale;
    this.bus = bus;
    this._buttons = {};
    this._el = document.getElementById('topbar');
    this._menuOpen = false;
    this._init();

    bus.on('tool:changed', (name) => this._updateActive(name));
    bus.on('scale:changed', () => this._updateScaleChip());
    bus.on('scale:lockChanged', () => this._updateScaleChip());
    bus.on('map:loaded', () => this._updateScaleChip());
  }

  _init() {
    this._el.innerHTML = '';

    const name = document.createElement('span');
    name.className = 'plan-name';
    name.textContent = 'Build Planner';
    this._el.appendChild(name);

    const sep = document.createElement('span');
    sep.className = 'topbar-sep';
    this._el.appendChild(sep);

    const seg = document.createElement('div');
    seg.className = 'seg';
    for (const t of TOOLS) {
      const btn = document.createElement('button');
      btn.className = 'seg-btn';
      btn.innerHTML = `<span class="icon"><i data-lucide="${t.icon}"></i></span><span>${t.label}</span>`;
      btn.title = t.label;
      btn.addEventListener('click', () => {
        this.bus.emit('tool:activate', t.name);
        if (t.name === 'place') {
          this.bus.emit('panel:showTab', 'pieces');
          this.bus.emit('sidebar:open');
        }
      });
      this._buttons[t.name] = btn;
      seg.appendChild(btn);
    }
    this._el.appendChild(seg);

    const right = document.createElement('div');
    right.id = 'topbar-right';

    this._scaleChip = document.createElement('button');
    this._scaleChip.className = 'btn-chip';
    this._scaleChip.addEventListener('click', () => this.bus.emit('scale:openModal'));
    right.appendChild(this._scaleChip);

    const sep2 = document.createElement('span');
    sep2.className = 'topbar-sep';
    right.appendChild(sep2);

    const mapBtn = document.createElement('button');
    mapBtn.className = 'btn-chip';
    mapBtn.innerHTML = '<span class="icon"><i data-lucide="image-plus"></i></span><span class="label-text">Map image</span>';
    mapBtn.title = 'Map image';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    mapBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) {
        this.bus.emit('file:selected', fileInput.files[0]);
        fileInput.value = '';
      }
    });
    right.appendChild(mapBtn);
    right.appendChild(fileInput);

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn-chip';
    saveBtn.innerHTML = '<span class="icon"><i data-lucide="save"></i></span><span class="label-text">Save</span>';
    saveBtn.title = 'Save plan';
    saveBtn.addEventListener('click', () => this.bus.emit('project:save'));
    right.appendChild(saveBtn);

    const moreBtn = document.createElement('button');
    moreBtn.className = 'btn-chip icon-only';
    moreBtn.innerHTML = '<i data-lucide="ellipsis-vertical"></i>';
    moreBtn.title = 'More';
    const loadInput = document.createElement('input');
    loadInput.type = 'file';
    loadInput.accept = '.json';
    loadInput.style.display = 'none';
    moreBtn.addEventListener('click', () => loadInput.click());
    loadInput.addEventListener('change', () => {
      if (loadInput.files[0]) {
        this.bus.emit('project:load', loadInput.files[0]);
        loadInput.value = '';
      }
    });
    moreBtn.title = 'Open plan';
    right.appendChild(moreBtn);
    right.appendChild(loadInput);

    this._el.appendChild(right);

    this._updateScaleChip();
    refreshIcons();
  }

  _updateScaleChip() {
    const mpp = this.mapScale.metresPerPixel;
    if (this.mapScale.locked) {
      this._scaleChip.innerHTML = `<span class="icon"><i data-lucide="lock"></i></span><span>Scale locked · ${mpp.toFixed(2)} m/px</span>`;
    } else {
      this._scaleChip.innerHTML = `<span class="icon"><i data-lucide="ruler"></i></span><span>Set map scale</span>`;
    }
    refreshIcons();
  }

  _updateActive(name) {
    for (const [key, btn] of Object.entries(this._buttons)) {
      btn.classList.toggle('active', key === name);
    }
  }
}
