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

  getAssetCorners(asset) {
    const cx = asset.mapX + asset.mapWidth / 2;
    const cy = asset.mapY + asset.mapHeight / 2;
    const hw = asset.mapWidth / 2;
    const hh = asset.mapHeight / 2;
    const rad = asset.rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([lx, ly]) => ({
      x: cx + lx * cos - ly * sin,
      y: cy + lx * sin + ly * cos,
    }));
  }

  getSnapPoints(excludeAsset) {
    const points = [];
    for (const asset of this.assets) {
      if (asset === excludeAsset) continue;
      const corners = this.getAssetCorners(asset);
      for (const c of corners) points.push(c);
      for (let i = 0; i < corners.length; i++) {
        const next = corners[(i + 1) % corners.length];
        points.push({
          x: (corners[i].x + next.x) / 2,
          y: (corners[i].y + next.y) / 2,
        });
      }
    }
    return points;
  }

  render(ctx, viewport) {
    for (const asset of this.assets) {
      asset.render(ctx, viewport);
    }
  }
}
