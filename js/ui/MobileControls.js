import { refreshIcons } from './icons.js';

const TABS = [
  { name: 'select', label: 'Select', icon: 'mouse-pointer-2' },
  { name: 'pieces', label: 'Pieces', icon: 'blocks' },
  { name: 'layers', label: 'Layers', icon: 'layers' },
  { name: 'plan', label: 'Plan', icon: 'sliders-horizontal' },
];

export class MobileControls {
  constructor(toolManager, selectTool, mapScale, bus) {
    this.toolManager = toolManager;
    this.selectTool = selectTool;
    this.mapScale = mapScale;
    this.bus = bus;
    this._tabbar = document.getElementById('mobile-tabbar');
    this._context = document.getElementById('mobile-context');
    this._currentTool = null;
    this._activePanelTab = null;

    this._initTabbar();

    bus.on('tool:changed', (name) => {
      this._currentTool = name;
      this._updateTabbarActive();
      this._renderContext();
    });
    bus.on('asset:selected', () => this._renderContext());
    bus.on('panel:tabChanged', (name) => {
      this._activePanelTab = name;
      this._updateTabbarActive();
    });
    bus.on('sidebar:changed', () => this._updateTabbarActive());
    bus.on('calibration:modeChanged', () => this._renderContext());

    this._renderContext();
  }

  _initTabbar() {
    this._tabbar.innerHTML = '';
    for (const t of TABS) {
      const btn = document.createElement('button');
      btn.className = 'mobile-tab';
      btn.dataset.tab = t.name;
      btn.innerHTML = `<span class="icon"><i data-lucide="${t.icon}"></i></span>${t.label}`;
      btn.addEventListener('click', () => this._onTabClick(t.name));
      this._tabbar.appendChild(btn);
    }
    refreshIcons();
  }

  _onTabClick(name) {
    if (name === 'select') {
      this.bus.emit('sidebar:close');
      this.bus.emit('tool:activate', 'select');
      return;
    }
    this.bus.emit('panel:showTab', name);
    this.bus.emit('sidebar:open');
  }

  _updateTabbarActive() {
    const isSelectTool = this._currentTool === 'select' || this._currentTool === 'place';
    const sheetOpen = document.getElementById('sidebar').classList.contains('open');
    for (const btn of this._tabbar.children) {
      const name = btn.dataset.tab;
      if (name === 'select') {
        btn.classList.toggle('active', !sheetOpen);
      } else {
        btn.classList.toggle('active', sheetOpen && this._activePanelTab === name);
      }
    }
  }

  _renderContext() {
    this._context.innerHTML = '';
    const isSelect = this._currentTool === 'select';
    const hasSelection = this.selectTool.selection.length > 0;

    if (!isSelect || !hasSelection) {
      this._context.classList.add('hidden');
      return;
    }
    this._context.classList.remove('hidden');

    const inner = document.createElement('div');
    inner.className = 'mobile-context-inner';

    inner.appendChild(this._btn('rotate-cw', 'Rotate', () => this.bus.emit('mobile:rotate', 22.5)));
    inner.appendChild(this._btn('copy', 'Duplicate', () => this.bus.emit('mobile:duplicate')));
    inner.appendChild(this._btn('boxes', 'Group', () => this.bus.emit('mobile:group')));
    inner.appendChild(this._btn('trash-2', 'Delete', () => this.bus.emit('mobile:delete')));
    inner.appendChild(this._btn('check-check', 'Select all', () => this.bus.emit('mobile:selectAll')));

    if (this.mapScale.mapMode === 'world') {
      inner.appendChild(this._btn('square-dashed', 'Build area', () => this.toolManager.activate('region')));
    }

    this._context.appendChild(inner);
    refreshIcons();
  }

  _btn(icon, label, onClick) {
    const btn = document.createElement('button');
    btn.className = 'mobile-action-btn';
    btn.innerHTML = `<span class="icon"><i data-lucide="${icon}"></i></span>${label}`;
    btn.addEventListener('click', onClick);
    return btn;
  }
}
