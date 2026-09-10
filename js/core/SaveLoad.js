import { createAsset } from '../assets/AssetRegistry.js';
import { WorkingLayer } from '../layers/WorkingLayer.js';

export class SaveLoad {
  constructor(layerManager, mapLayer, assetLayer, mapScale, viewport, renderer, bus) {
    this.layerManager = layerManager;
    this.mapLayer = mapLayer;
    this.assetLayer = assetLayer;
    this.mapScale = mapScale;
    this.viewport = viewport;
    this.renderer = renderer;
    this.bus = bus;
  }

  serialize() {
    const workingLayers = this.layerManager.getByType('working').map(wl => ({
      id: wl.id,
      name: wl.name,
      originX: wl.originX,
      originY: wl.originY,
      width: wl.width,
      height: wl.height,
      visible: wl.visible,
    }));

    const assets = this.assetLayer.assets.map(a => a.serialize());

    const groups = this.assetLayer.groups.map(g => ({
      id: g.id,
      name: g.name,
      visible: g.visible,
    }));

    return {
      version: 1,
      mapImage: this.mapLayer.getDataURL() || null,
      scale: {
        metresPerPixel: this.mapScale.metresPerPixel,
        locked: this.mapScale.locked,
      },
      workingLayers,
      groups,
      assets,
    };
  }

  async save() {
    const data = this.serialize();
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'valheim-build.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async load(file) {
    const text = await file.text();
    const data = JSON.parse(text);
    await this.deserialize(data);
  }

  async deserialize(data) {
    if (data.version !== 1) {
      throw new Error('Unsupported save file version');
    }

    const existingWorking = this.layerManager.getByType('working');
    for (const wl of existingWorking) {
      this.layerManager.removeLayer(wl.id);
    }
    this.assetLayer.assets = [];
    this.assetLayer.groups = [{ id: 'default', name: 'Default', visible: true }];

    if (data.scale) {
      this.mapScale.locked = false;
      this.mapScale.metresPerPixel = data.scale.metresPerPixel;
      this.mapScale.locked = data.scale.locked;
    }

    if (data.mapImage) {
      await this.mapLayer.loadFromDataURL(data.mapImage);
      this.viewport.fitImage(this.mapLayer.width, this.mapLayer.height,
        this.renderer.width, this.renderer.height);
      document.getElementById('empty-state').style.display = 'none';
    }

    const layerMap = {};
    if (data.workingLayers) {
      for (const wlData of data.workingLayers) {
        const wl = new WorkingLayer(
          wlData.originX, wlData.originY,
          wlData.width, wlData.height,
          this.bus, this.mapScale
        );
        wl.name = wlData.name;
        wl.visible = wlData.visible;
        this.layerManager.addLayer(wl);
        layerMap[wlData.id] = wl;
      }
    }

    if (data.groups) {
      this.assetLayer.groups = data.groups.map(g => ({
        id: g.id,
        name: g.name,
        visible: g.visible,
      }));
      if (!this.assetLayer.groups.find(g => g.id === 'default')) {
        this.assetLayer.groups.unshift({ id: 'default', name: 'Default', visible: true });
      }
    }

    if (data.assets) {
      for (const aData of data.assets) {
        const asset = createAsset(aData.type);
        if (!asset) continue;
        asset.mapScale = this.mapScale;
        asset.gridX = aData.gridX;
        asset.gridY = aData.gridY;
        asset.rotation = aData.rotation;
        asset.groupId = aData.groupId || 'default';
        asset.workingLayer = layerMap[aData.workingLayerId] || null;
        this.assetLayer.assets.push(asset);
      }
    }

    this.bus.emit('groups:changed');
    this.bus.emit('render:request');
  }
}
