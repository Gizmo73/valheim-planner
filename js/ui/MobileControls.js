export class MobileControls {
  constructor(toolManager, bus) {
    this.toolManager = toolManager;
    this.bus = bus;
    this._currentTool = null;
    this._hasSelection = false;
    this._el = document.getElementById('mobile-controls');
    if (!this._el) return;

    this._init();

    bus.on('tool:changed', (name) => {
      this._currentTool = name;
      this._updateVisibility();
    });
    bus.on('asset:selected', (asset) => {
      this._hasSelection = !!asset;
      this._updateVisibility();
    });
    bus.on('snap:changed', (mode) => {
      this._updateSnapButtons(mode);
    });
  }

  _init() {
    const actions = [
      { id: 'rotate-ccw', label: '↺', title: 'Rotate left', group: 'rotate' },
      { id: 'rotate-cw', label: '↻', title: 'Rotate right', group: 'rotate' },
      { id: 'sep1', sep: true },
      { id: 'snap-grid', label: 'Grid', title: 'Grid snap', group: 'snap', toggle: true },
      { id: 'snap-asset', label: 'Snap', title: 'Asset snap', group: 'snap', toggle: true },
      { id: 'snap-free', label: 'Free', title: 'Free place', group: 'snap', toggle: true },
      { id: 'sep2', sep: true },
      { id: 'duplicate', label: 'Dup', title: 'Duplicate', group: 'select-only' },
      { id: 'delete', label: 'Del', title: 'Delete', group: 'select-only' },
    ];

    this._buttons = {};

    for (const a of actions) {
      if (a.sep) {
        const sep = document.createElement('div');
        sep.className = 'mobile-sep';
        this._el.appendChild(sep);
        continue;
      }

      const btn = document.createElement('button');
      btn.className = 'mobile-btn';
      if (a.toggle) btn.classList.add('toggle');
      btn.textContent = a.label;
      btn.title = a.title;
      btn.dataset.action = a.id;
      btn.dataset.group = a.group;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._onAction(a.id);
      });
      this._buttons[a.id] = btn;
      this._el.appendChild(btn);
    }

    this._updateSnapButtons('grid');
    this._updateVisibility();
  }

  _onAction(action) {
    switch (action) {
      case 'rotate-ccw':
        this.bus.emit('mobile:rotate', -22.5);
        break;
      case 'rotate-cw':
        this.bus.emit('mobile:rotate', 22.5);
        break;
      case 'snap-grid':
        this.toolManager.setSnapMode('grid');
        break;
      case 'snap-asset':
        this.toolManager.setSnapMode('asset');
        break;
      case 'snap-free':
        this.toolManager.setSnapMode('free');
        break;
      case 'duplicate':
        this.bus.emit('mobile:duplicate');
        break;
      case 'delete':
        this.bus.emit('mobile:delete');
        break;
    }
  }

  _updateSnapButtons(mode) {
    for (const [id, btn] of Object.entries(this._buttons)) {
      if (id.startsWith('snap-')) {
        btn.classList.toggle('active', id === 'snap-' + mode);
      }
    }
  }

  _updateVisibility() {
    if (!this._el) return;
    const isPlace = this._currentTool === 'place';
    const isSelect = this._currentTool === 'select';
    const show = isPlace || isSelect;

    this._el.classList.toggle('hidden', !show);

    for (const [id, btn] of Object.entries(this._buttons)) {
      const group = btn.dataset.group;
      if (group === 'select-only') {
        btn.classList.toggle('hidden', !isSelect || !this._hasSelection);
      }
    }
  }
}
