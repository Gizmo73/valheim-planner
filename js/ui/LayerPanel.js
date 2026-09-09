export class LayerPanel {
  constructor(layerManager, bus) {
    this.layerManager = layerManager;
    this.bus = bus;
    this._el = document.getElementById('layer-list');
    this._rebuild();

    bus.on('layer:created', () => this._rebuild());
    bus.on('layer:removed', () => this._rebuild());
    bus.on('layer:visibility', () => this._rebuild());
  }

  _rebuild() {
    this._el.innerHTML = '';
    const layers = [...this.layerManager.layers].reverse();

    for (const layer of layers) {
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
  }
}
