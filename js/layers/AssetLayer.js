let nextGroupId = 1;

export class AssetLayer {
  constructor(bus) {
    this.bus = bus;
    this.id = 'assets';
    this.name = 'Assets';
    this.type = 'asset';
    this.visible = true;
    this.assets = [];
    this.groups = [
      { id: 'default', name: 'Default', visible: true },
    ];
  }

  addGroup(name) {
    const group = { id: 'group-' + nextGroupId++, name, visible: true };
    this.groups.push(group);
    this.bus.emit('groups:changed');
    return group;
  }

  removeGroup(groupId) {
    if (groupId === 'default') return;
    const idx = this.groups.findIndex(g => g.id === groupId);
    if (idx === -1) return;
    for (const asset of this.assets) {
      if (asset.groupId === groupId) asset.groupId = 'default';
    }
    this.groups.splice(idx, 1);
    this.bus.emit('groups:changed');
    this.bus.emit('render:request');
  }

  renameGroup(groupId, name) {
    const group = this.groups.find(g => g.id === groupId);
    if (group) {
      group.name = name;
      this.bus.emit('groups:changed');
    }
  }

  toggleGroupVisibility(groupId) {
    const group = this.groups.find(g => g.id === groupId);
    if (group) {
      group.visible = !group.visible;
      this.bus.emit('groups:changed');
      this.bus.emit('render:request');
    }
  }

  moveGroupUp(groupId) {
    const idx = this.groups.findIndex(g => g.id === groupId);
    if (idx > 0) {
      [this.groups[idx], this.groups[idx - 1]] = [this.groups[idx - 1], this.groups[idx]];
      this.bus.emit('groups:changed');
      this.bus.emit('render:request');
    }
  }

  moveGroupDown(groupId) {
    const idx = this.groups.findIndex(g => g.id === groupId);
    if (idx < this.groups.length - 1 && idx >= 0) {
      [this.groups[idx], this.groups[idx + 1]] = [this.groups[idx + 1], this.groups[idx]];
      this.bus.emit('groups:changed');
      this.bus.emit('render:request');
    }
  }

  moveAssetsToGroup(assetIds, groupId) {
    const group = this.groups.find(g => g.id === groupId);
    if (!group) return;
    for (const asset of this.assets) {
      if (assetIds.includes(asset.id)) {
        asset.groupId = groupId;
      }
    }
    this.bus.emit('groups:changed');
    this.bus.emit('render:request');
  }

  getGroupAssets(groupId) {
    return this.assets.filter(a => a.groupId === groupId);
  }

  getGroup(groupId) {
    return this.groups.find(g => g.id === groupId) || null;
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

  removeAssets(assets) {
    for (const asset of assets) {
      const idx = this.assets.indexOf(asset);
      if (idx !== -1) this.assets.splice(idx, 1);
    }
    this.bus.emit('render:request');
  }

  hitTest(mapX, mapY) {
    const visibleGroupIds = new Set(this.groups.filter(g => g.visible).map(g => g.id));
    for (let i = this.assets.length - 1; i >= 0; i--) {
      const asset = this.assets[i];
      if (visibleGroupIds.has(asset.groupId) && asset.containsPoint(mapX, mapY)) {
        return asset;
      }
    }
    return null;
  }

  hitTestAll(mapX, mapY) {
    const visibleGroupIds = new Set(this.groups.filter(g => g.visible).map(g => g.id));
    const hits = [];
    for (let i = this.assets.length - 1; i >= 0; i--) {
      const asset = this.assets[i];
      if (visibleGroupIds.has(asset.groupId) && asset.containsPoint(mapX, mapY)) {
        hits.push(asset);
      }
    }
    return hits;
  }

  hitTestRect(mapX1, mapY1, mapX2, mapY2) {
    const left = Math.min(mapX1, mapX2);
    const right = Math.max(mapX1, mapX2);
    const top = Math.min(mapY1, mapY2);
    const bottom = Math.max(mapY1, mapY2);
    const visibleGroupIds = new Set(this.groups.filter(g => g.visible).map(g => g.id));

    return this.assets.filter(asset => {
      if (!visibleGroupIds.has(asset.groupId)) return false;
      const cx = asset.mapX + asset.mapWidth / 2;
      const cy = asset.mapY + asset.mapHeight / 2;
      return cx >= left && cx <= right && cy >= top && cy <= bottom;
    });
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
    const excludeSet = new Set();
    if (excludeAsset) {
      if (Array.isArray(excludeAsset)) excludeAsset.forEach(a => excludeSet.add(a));
      else excludeSet.add(excludeAsset);
    }

    const points = [];
    for (const asset of this.assets) {
      if (excludeSet.has(asset)) continue;
      const cx = asset.mapX + asset.mapWidth / 2;
      const cy = asset.mapY + asset.mapHeight / 2;
      const rad = asset.rotation * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      for (const [lx, ly] of asset.getLocalSnapOffsets()) {
        points.push({
          x: cx + lx * cos - ly * sin,
          y: cy + lx * sin + ly * cos,
        });
      }
    }
    return points;
  }

  render(ctx, viewport) {
    for (const group of this.groups) {
      if (!group.visible) continue;
      for (const asset of this.assets) {
        if (asset.groupId === group.id) {
          asset.render(ctx, viewport);
        }
      }
    }
  }
}
