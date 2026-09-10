export class MobileControls {
  constructor(toolManager, bus) {
    this.toolManager = toolManager;
    this.bus = bus;
    this._currentTool = null;
    this._hasSelection = false;
    this._fillActive = false;
    this._mapMode = 'local';
    this._el = document.getElementById('mobile-controls');
    if (!this._el) return;

    this._init();

    bus.on('tool:changed', (name) => {
      this._currentTool = name;
      this._fillActive = false;
      this._updateVisibility();
    });
    bus.on('asset:selected', (asset) => {
      this._hasSelection = !!asset;
      this._updateVisibility();
    });
    bus.on('snap:changed', (mode) => {
      this._updateSnapButtons(mode);
    });
    bus.on('fill:changed', (active) => {
      this._fillActive = active;
      if (this._buttons['fill']) {
        this._buttons['fill'].classList.toggle('active', active);
      }
    });
    bus.on('calibration:modeChanged', (mode) => {
      this._mapMode = mode;
      this._updateVisibility();
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
      { id: 'fill', label: 'Fill', title: 'Grid fill', group: 'place-only', toggle: true },
      { id: 'select-all', label: 'All', title: 'Select all', group: 'select-any' },
      { id: 'duplicate', label: 'Dup', title: 'Duplicate', group: 'select-only' },
      { id: 'delete', label: 'Del', title: 'Delete', group: 'select-only' },
      { id: 'group', label: 'Grp', title: 'Group selected', group: 'select-only' },
      { id: 'sep3', sep: true, group: 'world-select' },
      { id: 'region', label: '⬚', title: 'New working area', group: 'world-select' },
    ];

    this._buttons = {};
    this._seps = [];

    for (const a of actions) {
      if (a.sep) {
        const sep = document.createElement('div');
        sep.className = 'mobile-sep';
        if (a.group) sep.dataset.group = a.group;
        this._el.appendChild(sep);
        this._seps.push(sep);
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
      case 'fill':
        this.bus.emit('mobile:fill');
        break;
      case 'select-all':
        this.bus.emit('mobile:selectAll');
        break;
      case 'duplicate':
        this.bus.emit('mobile:duplicate');
        break;
      case 'delete':
        this.bus.emit('mobile:delete');
        break;
      case 'group':
        this.bus.emit('mobile:group');
        break;
      case 'region':
        this.toolManager.activate('region');
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

    const isWorld = this._mapMode === 'world';

    for (const [id, btn] of Object.entries(this._buttons)) {
      const group = btn.dataset.group;
      let visible = show;
      if (group === 'select-only') {
        visible = isSelect && this._hasSelection;
      } else if (group === 'place-only') {
        visible = isPlace;
      } else if (group === 'select-any') {
        visible = isSelect;
      } else if (group === 'world-select') {
        visible = isSelect && isWorld;
      }
      btn.classList.toggle('hidden', !visible);
    }

    for (const sep of this._seps) {
      const group = sep.dataset.group;
      if (group === 'select-any') {
        sep.classList.toggle('hidden', !isSelect);
      } else if (group === 'place-only') {
        sep.classList.toggle('hidden', !isPlace);
      } else if (group === 'world-select') {
        sep.classList.toggle('hidden', !(isSelect && isWorld));
      }
    }
  }
}
