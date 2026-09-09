export class AssetLayer {
  constructor(bus) {
    this.bus = bus;
    this.id = 'assets';
    this.name = 'Assets';
    this.type = 'asset';
    this.visible = true;
    this.assets = [];
  }

  addAsset(asset) {
    this.assets.push(asset);
    this.bus.emit('asset:placed', asset);
    this.bus.emit('render:request');
  }

  removeAsset(asset) {
    const idx = this.assets.indexOf(asset);
    if (idx !== -1) {
      this.assets.splice(idx, 1);
      this.bus.emit('asset:deleted', asset);
      this.bus.emit('render:request');
    }
  }

  hitTest(mapX, mapY) {
    for (let i = this.assets.length - 1; i >= 0; i--) {
      if (this.assets[i].containsPoint(mapX, mapY)) {
        return this.assets[i];
      }
    }
    return null;
  }

  render(ctx) {
    for (const asset of this.assets) {
      asset.render(ctx);
    }
  }
}
