import { createAsset } from '../assets/AssetRegistry.js';
import { mapToGrid, snapToGrid, gridToMap } from '../core/CoordinateSystem.js';

export class PlaceTool {
  constructor(viewport, layerManager, assetLayer, mapScale, bus) {
    this.viewport = viewport;
    this.layerManager = layerManager;
    this.assetLayer = assetLayer;
    this.mapScale = mapScale;
    this.bus = bus;
    this.assetType = null;
    this.rotation = 0;
    this._previewAsset = null;
    this._cursorMap = null;
    this._snappedPos = null;
    this._snapMode = 'grid';
    this.bus.on('snap:changed', (mode) => {
      this._snapMode = mode;
      if (this._cursorMap) {
        this._snappedPos = this._getPosition(this._cursorMap.x, this._cursorMap.y);
      }
    });
    this.bus.on('mobile:rotate', (deg) => {
      this.rotation = ((this.rotation + deg) % 360 + 360) % 360;
      if (this._cursorMap) {
        this._snappedPos = this._getPosition(this._cursorMap.x, this._cursorMap.y);
      }
      this.bus.emit('render:request');
    });
  }

  setAssetType(type) {
    this.assetType = type;
    this.rotation = 0;
    this._previewAsset = createAsset(type);
    if (this._previewAsset) this._previewAsset.mapScale = this.mapScale;
  }

  activate() {}

  deactivate() {
    this._previewAsset = null;
    this._cursorMap = null;
    this._snappedPos = null;
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

  _getPosition(mapX, mapY) {
    if (this._snapMode === 'free') return this._getFreePosition(mapX, mapY);
    if (this._snapMode === 'asset') return this._getAssetSnappedPosition(mapX, mapY);
    return this._getGridSnappedPosition(mapX, mapY);
  }

  _getGridSnappedPosition(mapX, mapY) {
    const layer = this._findWorkingLayer(mapX, mapY);
    if (!layer) return null;

    const mpp = this.mapScale.metresPerPixel;
    const grid = mapToGrid(mapX, mapY, layer, mpp);
    const snapped = snapToGrid(grid.x, grid.y);
    const mapPos = gridToMap(snapped.x, snapped.y, layer, mpp);
    return { mapX: mapPos.x, mapY: mapPos.y, gridX: snapped.x, gridY: snapped.y, layer, mode: 'grid' };
  }

  _getFreePosition(mapX, mapY) {
    const layer = this._findWorkingLayer(mapX, mapY);
    if (!layer) return null;

    const mpp = this.mapScale.metresPerPixel;
    const grid = mapToGrid(mapX, mapY, layer, mpp);
    return { mapX, mapY, gridX: grid.x, gridY: grid.y, layer, mode: 'free' };
  }

  _getAssetSnappedPosition(mapX, mapY) {
    const layer = this._findWorkingLayer(mapX, mapY);
    if (!layer) return null;

    const existingPoints = this.assetLayer.getSnapPoints();
    if (existingPoints.length === 0) return this._getGridSnappedPosition(mapX, mapY);

    const asset = this._previewAsset;
    const hw = asset.mapWidth / 2;
    const hh = asset.mapHeight / 2;
    const rad = this.rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const cx = mapX + hw;
    const cy = mapY + hh;
    const snapPts = asset.getLocalSnapOffsets().map(([lx, ly]) => ({
      x: cx + lx * cos - ly * sin,
      y: cy + lx * sin + ly * cos,
    }));

    let bestDist = Infinity;
    let bestDx = 0;
    let bestDy = 0;

    for (const ep of existingPoints) {
      for (const sp of snapPts) {
        const dx = ep.x - sp.x;
        const dy = ep.y - sp.y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          bestDx = dx;
          bestDy = dy;
        }
      }
    }

    const snappedMapX = mapX + bestDx;
    const snappedMapY = mapY + bestDy;
    const mpp = this.mapScale.metresPerPixel;
    const grid = mapToGrid(snappedMapX, snappedMapY, layer, mpp);
    return { mapX: snappedMapX, mapY: snappedMapY, gridX: grid.x, gridY: grid.y, layer, mode: 'asset' };
  }

  onMouseMove(pos) {
    this._cursorMap = this.viewport.screenToMap(pos.x, pos.y);
    this._snappedPos = this._getPosition(this._cursorMap.x, this._cursorMap.y);
    this.bus.emit('render:request');
  }

  onMouseDown(pos) {
    if (!this.assetType) return;

    const rawMap = this.viewport.screenToMap(pos.x, pos.y);
    const snapped = this._getPosition(rawMap.x, rawMap.y);
    if (!snapped) return;

    const asset = createAsset(this.assetType);
    asset.mapScale = this.mapScale;
    asset.gridX = snapped.gridX;
    asset.gridY = snapped.gridY;
    asset.rotation = this.rotation;
    asset.workingLayer = snapped.layer;
    this.assetLayer.addAsset(asset);
  }

  onKeyDown(e) {
    if (e.code === 'KeyQ' || e.code === 'ArrowLeft' || e.code === 'ArrowDown') {
      this.rotation = (this.rotation - 22.5 + 360) % 360;
      if (this._cursorMap) {
        this._snappedPos = this._getPosition(this._cursorMap.x, this._cursorMap.y);
      }
      this.bus.emit('render:request');
      e.preventDefault();
    } else if (e.code === 'KeyE' || e.code === 'ArrowRight' || e.code === 'ArrowUp') {
      this.rotation = (this.rotation + 22.5) % 360;
      if (this._cursorMap) {
        this._snappedPos = this._getPosition(this._cursorMap.x, this._cursorMap.y);
      }
      this.bus.emit('render:request');
      e.preventDefault();
    } else if (e.code === 'Escape') {
      this.bus.emit('tool:activate', 'select');
    }
  }

  renderOverlay(ctx, viewport) {
    if (!this._previewAsset || !this._snappedPos) return;

    const snapped = this._snappedPos;

    ctx.save();
    ctx.translate(viewport.panX, viewport.panY);
    ctx.scale(viewport.zoom, viewport.zoom);
    this._previewAsset.renderPreview(ctx, snapped.mapX, snapped.mapY, this.rotation, 0.6, viewport);
    ctx.restore();

    const screenPos = viewport.mapToScreen(snapped.mapX, snapped.mapY);
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '11px monospace';
    let label = `${this.rotation}°`;
    if (this._snapMode === 'asset') label += ' [snap]';
    else if (this._snapMode === 'free') label += ' [free]';
    ctx.fillText(label, screenPos.x + 4, screenPos.y - 6);
    ctx.restore();
  }
}
