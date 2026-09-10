export class LayerPanel {
  constructor(layerManager, assetLayer, bus) {
    this.layerManager = layerManager;
    this.assetLayer = assetLayer;
    this.bus = bus;
    this._el = document.getElementById('layer-list');
    this._rebuild();

    bus.on('layer:created', () => this._rebuild());
    bus.on('layer:removed', () => this._rebuild());
    bus.on('layer:visibility', () => this._rebuild());
    bus.on('groups:changed', () => this._rebuild());
  }

  _rebuild() {
    this._el.innerHTML = '';

    const layers = [...this.layerManager.layers].reverse();
    for (const layer of layers) {
      if (layer.type === 'asset') continue;
      this._addLayerRow(layer);
    }

    const groupHeader = document.createElement('div');
    groupHeader.className = 'layer-group-header';
    groupHeader.innerHTML = '<span>Asset Groups</span>';
    const addBtn = document.createElement('button');
    addBtn.className = 'layer-add-group';
    addBtn.textContent = '+';
    addBtn.title = 'Add group';
    addBtn.addEventListener('click', () => {
      const name = prompt('Group name:');
      if (name && name.trim()) {
        this.assetLayer.addGroup(name.trim());
      }
    });
    groupHeader.appendChild(addBtn);
    this._el.appendChild(groupHeader);

    const groups = [...this.assetLayer.groups].reverse();
    for (const group of groups) {
      this._addGroupRow(group);
    }
  }

  _addLayerRow(layer) {
    const row = document.createElement('div');
    row.className = 'layer-row' + (layer.visible ? '' : ' hidden-layer');

    const eye = document.createElement('button');
    eye.className = 'layer-eye';
    eye.textContent = layer.visible ? '👁' : '—';
    eye.title = layer.visible ? 'Hide' : 'Show';
    eye.addEventListener('click', () => this.layerManager.toggleVisibility(layer.id));

    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = layer.name;

    row.appendChild(eye);
    row.appendChild(name);

    if (layer.type === 'working') {
      const del = document.createElement('button');
      del.className = 'layer-delete';
      del.textContent = '✕';
      del.title = 'Remove';
      del.addEventListener('click', () => this.layerManager.removeLayer(layer.id));
      row.appendChild(del);
    }

    this._el.appendChild(row);
  }

  _addGroupRow(group) {
    const count = this.assetLayer.getGroupAssets(group.id).length;
    const row = document.createElement('div');
    row.className = 'layer-row group-row' + (group.visible ? '' : ' hidden-layer');

    const eye = document.createElement('button');
    eye.className = 'layer-eye';
    eye.textContent = group.visible ? '👁' : '—';
    eye.title = group.visible ? 'Hide' : 'Show';
    eye.addEventListener('click', () => this.assetLayer.toggleGroupVisibility(group.id));

    const nameEl = document.createElement('span');
    nameEl.className = 'layer-name';
    nameEl.textContent = `${group.name} (${count})`;
    nameEl.title = 'Double-click to rename';
    nameEl.addEventListener('dblclick', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'layer-rename-input';
      input.value = group.name;
      nameEl.replaceWith(input);
      input.focus();
      input.select();
      const finish = () => {
        const val = input.value.trim();
        if (val) this.assetLayer.renameGroup(group.id, val);
        this._rebuild();
      };
      input.addEventListener('blur', finish);
      input.addEventListener('keydown', (e) => {
        if (e.code === 'Enter') finish();
        if (e.code === 'Escape') this._rebuild();
      });
    });

    const controls = document.createElement('div');
    controls.className = 'layer-controls';

    const upBtn = document.createElement('button');
    upBtn.className = 'layer-order-btn';
    upBtn.textContent = '▲';
    upBtn.title = 'Move up (render later / on top)';
    upBtn.addEventListener('click', () => this.assetLayer.moveGroupDown(group.id));

    const downBtn = document.createElement('button');
    downBtn.className = 'layer-order-btn';
    downBtn.textContent = '▼';
    downBtn.title = 'Move down (render earlier / below)';
    downBtn.addEventListener('click', () => this.assetLayer.moveGroupUp(group.id));

    controls.appendChild(upBtn);
    controls.appendChild(downBtn);

    row.appendChild(eye);
    row.appendChild(nameEl);
    row.appendChild(controls);

    if (group.id !== 'default') {
      const del = document.createElement('button');
      del.className = 'layer-delete';
      del.textContent = '✕';
      del.title = 'Remove group (assets move to Default)';
      del.addEventListener('click', () => this.assetLayer.removeGroup(group.id));
      row.appendChild(del);
    }

    this._el.appendChild(row);
  }
}
