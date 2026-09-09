export class LayerManager {
  constructor(bus) {
    this.bus = bus;
    this.layers = [];
    this._nextId = 1;
  }

  addLayer(layer) {
    if (!layer.id) layer.id = 'layer-' + this._nextId++;
    this.layers.push(layer);
    this.bus.emit('layer:created', layer);
    this.bus.emit('render:request');
    return layer;
  }

  removeLayer(id) {
    const idx = this.layers.findIndex(l => l.id === id);
    if (idx !== -1) {
      const removed = this.layers.splice(idx, 1)[0];
      this.bus.emit('layer:removed', removed);
      this.bus.emit('render:request');
    }
  }

  toggleVisibility(id) {
    const layer = this.getById(id);
    if (layer) {
      layer.visible = !layer.visible;
      this.bus.emit('layer:visibility', layer);
      this.bus.emit('render:request');
    }
  }

  getById(id) {
    return this.layers.find(l => l.id === id) || null;
  }

  getByType(type) {
    return this.layers.filter(l => l.type === type);
  }

  renderAll(ctx, viewport, canvasWidth, canvasHeight) {
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      layer.render(ctx, viewport, canvasWidth, canvasHeight);
    }
  }
}
