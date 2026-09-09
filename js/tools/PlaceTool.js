import { createAsset } from '../assets/AssetRegistry.js';
import { mapToGrid, snapToGrid, gridToMap } from '../core/CoordinateSystem.js';

export class PlaceTool {
  constructor(viewport, layerManager, assetLayer, bus) {
    this.viewport = viewport;
    this.layerManager = layerManager;
    this.assetLayer = assetLayer;
    this.bus = bus;
    this.assetType = null;
    this.rotation = 0;
    this._previewAsset = null;
    this._cursorMap = null;
    this._activeLayer = null;
  }

  setAssetType(type) {
    this.assetType = type;
    this.rotation = 0;
    this._previewAsset = createAsset(type);
  }

  activate() {}

  deactivate() {
    this._previewAsset = null;
    this._cursorMap = null;
  }

  _findWorkingLayer(mapX, mapY) {
    const layers = this.layerManager.getByType('working');
    for (let i = layers.length - 1; i >= 0; i--) {
      if (layers[i].visible && layers[i].containsMapPoint(mapX, mapY)) {
        return layers[i];
      }
    }
    return layers.length > 0 ? layers[layers.length - 1] : null;
  }

  _getSnappedPosition(mapX, mapY) {
    const layer = this._findWorkingLayer(mapX, mapY);
    if (!layer) return null;

    const grid = mapToGrid(mapX, mapY, layer);
    const snapped = snapToGrid(grid.x, grid.y);
    const mapPos = gridToMap(snapped.x, snapped.y, layer);
    return { mapX: mapPos.x, mapY: mapPos.y, gridX: snapped.x, gridY: snapped.y, layer };
  }

  onMouseMove(pos) {
    this._cursorMap = this.viewport.screenToMap(pos.x, pos.y);
    this.bus.emit('render:request');
  }

  onMouseDown(pos) {
    if (!this.assetType || !this._cursorMap) return;

    const snapped = this._getSnappedPosition(this._cursorMap.x, this._cursorMap.y);
    if (!snapped) return;

    const asset = createAsset(this.assetType);
    asset.gridX = snapped.gridX;
    asset.gridY = snapped.gridY;
    asset.rotation = this.rotation;
    asset.workingLayer = snapped.layer;
    this.assetLayer.addAsset(asset);
  }

  onWheel(pos, e) {
    const dir = e.deltaY > 0 ? 15 : -15;
    this.rotation = ((this.rotation + dir) % 360 + 360) % 360;
    this.bus.emit('render:request');
    return true;
  }

  onKeyDown(e) {
    if (e.code === 'ArrowLeft' || e.code === 'ArrowDown') {
      this.rotation = ((this.rotation - 15) % 360 + 360) % 360;
      this.bus.emit('render:request');
      e.preventDefault();
    } else if (e.code === 'ArrowRight' || e.code === 'ArrowUp') {
      this.rotation = ((this.rotation + 15) % 360 + 360) % 360;
      this.bus.emit('render:request');
      e.preventDefault();
    } else if (e.code === 'Escape') {
      this.bus.emit('tool:activate', 'select');
    }
  }

  renderOverlay(ctx, viewport) {
    if (!this._previewAsset || !this._cursorMap) return;

    const snapped = this._getSnappedPosition(this._cursorMap.x, this._cursorMap.y);
    if (!snapped) return;

    ctx.save();
    ctx.translate(viewport.panX, viewport.panY);
    ctx.scale(viewport.zoom, viewport.zoom);
    this._previewAsset.renderPreview(ctx, snapped.mapX, snapped.mapY, this.rotation, 0.6);
    ctx.restore();

    const screenPos = viewport.mapToScreen(snapped.mapX, snapped.mapY);
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '11px monospace';
    ctx.fillText(`${this.rotation}°`, screenPos.x + 4, screenPos.y - 6);
    ctx.restore();
  }
}
