import { refreshIcons } from './icons.js';

export class SelectionInspector {
  constructor(selectTool, viewport, assetLayer, toolManager, bus) {
    this.selectTool = selectTool;
    this.viewport = viewport;
    this.assetLayer = assetLayer;
    this.toolManager = toolManager;
    this.bus = bus;
    this._el = document.getElementById('selection-inspector');
    this._container = document.getElementById('canvas-container');

    bus.on('asset:selected', () => this._render());
    bus.on('tool:changed', () => this._render());
    bus.on('render:request', () => this._render());
  }

  _render() {
    const selection = this.selectTool.selection;
    const isSelectTool = this.toolManager.currentToolName === 'select';

    if (!isSelectTool || selection.length === 0) {
      this._el.classList.add('hidden');
      return;
    }

    this._el.classList.remove('hidden');
    this._el.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'sel-title';
    title.textContent = selection.length === 1 ? '1 piece selected' : `${selection.length} pieces selected`;
    this._el.appendChild(title);

    const footprint = selection.reduce((sum, a) => sum + a.widthM * a.heightM, 0);
    const primary = this.selectTool.selected;
    const group = primary ? this.assetLayer.getGroup(primary.groupId) : null;

    const rows = document.createElement('div');
    rows.className = 'sel-rows';
    rows.appendChild(this._row('Footprint', `${footprint.toFixed(1)} m²`));
    if (group) rows.appendChild(this._row('Group', group.name));
    this._el.appendChild(rows);

    this._el.appendChild(Object.assign(document.createElement('div'), { className: 'sel-hr' }));

    const actions = document.createElement('div');
    actions.className = 'sel-actions';
    actions.appendChild(this._actionBtn('rotate-cw', 'Rotate', () => this.bus.emit('mobile:rotate', 22.5)));
    actions.appendChild(this._actionBtn('copy', 'Duplicate', () => this.bus.emit('mobile:duplicate')));
    actions.appendChild(this._actionBtn('boxes', 'Group', () => this.bus.emit('mobile:group')));
    actions.appendChild(this._actionBtn('trash-2', 'Delete', () => this.bus.emit('mobile:delete')));
    this._el.appendChild(actions);

    this._position(selection);
    refreshIcons();
  }

  _row(label, value) {
    const row = document.createElement('div');
    row.className = 'sel-row';
    row.innerHTML = `<span>${label}</span><span>${value}</span>`;
    return row;
  }

  _actionBtn(icon, label, onClick) {
    const btn = document.createElement('button');
    btn.innerHTML = `<span><i data-lucide="${icon}"></i></span>${label}`;
    btn.addEventListener('click', onClick);
    return btn;
  }

  _position(selection) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const a of selection) {
      const s1 = this.viewport.mapToScreen(a.mapX, a.mapY);
      const s2 = this.viewport.mapToScreen(a.mapX + a.mapWidth, a.mapY + a.mapHeight);
      minX = Math.min(minX, s1.x, s2.x);
      minY = Math.min(minY, s1.y, s2.y);
      maxX = Math.max(maxX, s1.x, s2.x);
      maxY = Math.max(maxY, s1.y, s2.y);
    }
    if (!isFinite(minX)) return;

    const containerW = this._container.clientWidth;
    const width = 214;
    let left = maxX + 16;
    if (left + width > containerW - 8) left = Math.max(8, minX - width - 16);
    let top = minY;
    this._el.style.left = `${left}px`;
    this._el.style.top = `${Math.max(8, top)}px`;
  }
}
