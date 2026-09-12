import { refreshIcons } from './icons.js';

export class LayerPanel {
  constructor(layerManager, assetLayer, bus) {
    this.layerManager = layerManager;
    this.assetLayer = assetLayer;
    this.bus = bus;
    this._el = document.getElementById('layer-list');
    this._dragGroupId = null;
    this._rebuild();

    bus.on('layer:created', () => this._rebuild());
    bus.on('layer:removed', () => this._rebuild());
    bus.on('layer:visibility', () => this._rebuild());
    bus.on('groups:changed', () => this._rebuild());
    bus.on('asset:placed', () => this._rebuild());
    bus.on('asset:deleted', () => this._rebuild());
    bus.on('asset:selected', () => this._rebuild());
  }

  _rebuild() {
    this._el.innerHTML = '';

    const label = document.createElement('div');
    label.className = 'plan-section-label layer-section-label layer-group-header';
    label.innerHTML = '<span>Groups</span>';
    const addBtn = document.createElement('button');
    addBtn.className = 'layer-add-group';
    addBtn.innerHTML = '<span><i data-lucide="plus"></i></span>New group';
    addBtn.title = 'Add group';
    addBtn.addEventListener('click', () => {
      const name = prompt('Group name:');
      if (name && name.trim()) {
        this.assetLayer.addGroup(name.trim());
      }
    });
    label.appendChild(addBtn);
    this._el.appendChild(label);

    const groups = [...this.assetLayer.groups].reverse();
    for (const group of groups) {
      this._addGroupRow(group);
    }

    const mapLabel = document.createElement('div');
    mapLabel.className = 'layer-section-label';
    mapLabel.textContent = 'Map';
    this._el.appendChild(mapLabel);

    const layers = [...this.layerManager.layers].reverse();
    for (const layer of layers) {
      if (layer.type === 'asset') continue;
      this._addLayerRow(layer);
    }

    refreshIcons();
  }

  _addLayerRow(layer) {
    const row = document.createElement('div');
    row.className = 'layer-row map-row' + (layer.visible ? '' : ' hidden-layer');

    const eye = document.createElement('button');
    eye.className = 'layer-eye';
    eye.innerHTML = `<i data-lucide="${layer.visible ? 'eye' : 'eye-off'}"></i>`;
    eye.title = layer.visible ? 'Hide' : 'Show';
    eye.addEventListener('click', () => this.layerManager.toggleVisibility(layer.id));

    const name = document.createElement('span');
    name.className = 'layer-name';
    name.textContent = layer.type === 'map' ? 'Map image' : layer.name;

    row.appendChild(eye);
    row.appendChild(name);

    if (layer.type === 'working') {
      const del = document.createElement('button');
      del.className = 'layer-delete';
      del.innerHTML = '<i data-lucide="trash-2"></i>';
      del.title = 'Remove';
      del.addEventListener('click', () => this.layerManager.removeLayer(layer.id));
      row.appendChild(del);
    }

    this._el.appendChild(row);
  }

  _addGroupRow(group) {
    const count = this.assetLayer.getGroupAssets(group.id).length;

    const row = document.createElement('div');
    row.className = 'layer-row' + (group.visible ? '' : ' hidden-layer');
    row.draggable = true;
    row.dataset.groupId = group.id;

    row.addEventListener('dragstart', () => { this._dragGroupId = group.id; });
    row.addEventListener('dragover', (e) => e.preventDefault());
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      this._reorder(this._dragGroupId, group.id);
    });

    const eye = document.createElement('button');
    eye.className = 'layer-eye';
    eye.innerHTML = `<i data-lucide="${group.visible ? 'eye' : 'eye-off'}"></i>`;
    eye.title = group.visible ? 'Hide' : 'Show';
    eye.addEventListener('click', () => this.assetLayer.toggleGroupVisibility(group.id));

    const info = document.createElement('div');
    info.className = 'layer-info';
    const nameEl = document.createElement('span');
    nameEl.className = 'layer-name';
    nameEl.textContent = group.name;
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
    const meta = document.createElement('span');
    meta.className = 'layer-meta';
    meta.textContent = group.visible ? `${count} pieces` : `${count} pieces · hidden`;
    info.appendChild(nameEl);
    info.appendChild(meta);

    const grip = document.createElement('span');
    grip.className = 'layer-drag';
    grip.innerHTML = '<i data-lucide="grip-vertical"></i>';

    row.appendChild(eye);
    row.appendChild(info);
    row.appendChild(grip);

    if (group.id !== 'default') {
      const del = document.createElement('button');
      del.className = 'layer-delete';
      del.innerHTML = '<i data-lucide="trash-2"></i>';
      del.title = 'Remove group (pieces move to Default)';
      del.addEventListener('click', () => this.assetLayer.removeGroup(group.id));
      row.appendChild(del);
    }

    this._el.appendChild(row);
  }

  _reorder(fromId, toId) {
    if (!fromId || fromId === toId) return;
    const groups = this.assetLayer.groups;
    const fromIdx = groups.findIndex(g => g.id === fromId);
    const toIdx = groups.findIndex(g => g.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = groups.splice(fromIdx, 1);
    groups.splice(toIdx, 0, moved);
    this.bus.emit('groups:changed');
    this.bus.emit('render:request');
  }
}
