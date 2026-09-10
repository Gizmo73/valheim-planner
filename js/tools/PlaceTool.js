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
    this._fillMode = false;
    this._fillStart = null;
    this._fillEnd = null;
    this._filling = false;

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
    this._fillMode = false;
    this._filling = false;
    this._previewAsset = createAsset(type);
    if (this._previewAsset) this._previewAsset.mapScale = this.mapScale;
  }

  activate() {
    if (this.assetType && !this._previewAsset) {
      this._previewAsset = createAsset(this.assetType);
      if (this._previewAsset) this._previewAsset.mapScale = this.mapScale;
    }
  }

  deactivate() {
    this._previewAsset = null;
    this._cursorMap = null;
    this._snappedPos = null;
    this._fillMode = false;
    this._filling = false;
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

    const offset = this._previewAsset ? this._previewAsset.getGridSnapOffset() : { x: 0, y: 0 };
    const snapped = snapToGrid(grid.x - offset.x, grid.y - offset.y);
    const adjustedX = snapped.x + offset.x;
    const adjustedY = snapped.y + offset.y;

    const mapPos = gridToMap(adjustedX, adjustedY, layer, mpp);
    return { mapX: mapPos.x, mapY: mapPos.y, gridX: adjustedX, gridY: adjustedY, layer, mode: 'grid' };
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

    if (this._filling) {
      this._fillEnd = { ...this._cursorMap };
      this.bus.emit('render:request');
      return;
    }

    this._snappedPos = this._getPosition(this._cursorMap.x, this._cursorMap.y);
    this.bus.emit('render:request');
  }

  onMouseDown(pos) {
    if (!this.assetType) return;

    const rawMap = this.viewport.screenToMap(pos.x, pos.y);

    if (this._fillMode) {
      this._filling = true;
      this._fillStart = { ...rawMap };
      this._fillEnd = { ...rawMap };
      return;
    }

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

  onMouseUp(pos) {
    if (this._filling && this._fillStart && this._fillEnd) {
      this._executeFill();
      this._filling = false;
      this._fillStart = null;
      this._fillEnd = null;
    }
  }

  _executeFill() {
    if (!this._previewAsset || !this._fillStart || !this._fillEnd) return;

    const layer = this._findWorkingLayer(this._fillStart.x, this._fillStart.y);
    if (!layer) return;

    const mpp = this.mapScale.metresPerPixel;
    const asset = this._previewAsset;

    const rad = this.rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const effectiveW = Math.abs(asset.widthM * cos) + Math.abs(asset.heightM * sin);
    const effectiveH = Math.abs(asset.widthM * sin) + Math.abs(asset.heightM * cos);

    const g1 = mapToGrid(this._fillStart.x, this._fillStart.y, layer, mpp);
    const g2 = mapToGrid(this._fillEnd.x, this._fillEnd.y, layer, mpp);

    const offset = asset.getGridSnapOffset();
    const startGridX = Math.min(g1.x, g2.x);
    const startGridY = Math.min(g1.y, g2.y);
    const endGridX = Math.max(g1.x, g2.x);
    const endGridY = Math.max(g1.y, g2.y);

    const snapStartX = Math.round(startGridX / effectiveW) * effectiveW;
    const snapStartY = Math.round(startGridY / effectiveH) * effectiveH;

    let count = 0;
    const maxAssets = 500;

    for (let gx = snapStartX; gx < endGridX; gx += effectiveW) {
      for (let gy = snapStartY; gy < endGridY; gy += effectiveH) {
        if (count >= maxAssets) break;
        const placed = createAsset(this.assetType);
        placed.mapScale = this.mapScale;
        placed.gridX = gx + offset.x;
        placed.gridY = gy + offset.y;
        placed.rotation = this.rotation;
        placed.workingLayer = layer;
        this.assetLayer.addAsset(placed);
        count++;
      }
      if (count >= maxAssets) break;
    }

    this._fillMode = false;
    this.bus.emit('render:request');
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
    } else if (e.code === 'KeyF') {
      this._fillMode = !this._fillMode;
      this._filling = false;
      this.bus.emit('render:request');
      e.preventDefault();
    } else if (e.code === 'Escape') {
      if (this._fillMode) {
        this._fillMode = false;
        this._filling = false;
        this.bus.emit('render:request');
      } else {
        this.bus.emit('tool:activate', 'select');
      }
    }
  }

  renderOverlay(ctx, viewport) {
    if (!this._previewAsset) return;

    if (this._filling && this._fillStart && this._fillEnd) {
      this._renderFillPreview(ctx, viewport);
      return;
    }

    if (!this._snappedPos) return;

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
    if (this._fillMode) label += ' [FILL]';
    else if (this._snapMode === 'asset') label += ' [snap]';
    else if (this._snapMode === 'free') label += ' [free]';
    ctx.fillText(label, screenPos.x + 4, screenPos.y - 6);
    ctx.restore();
  }

  _renderFillPreview(ctx, viewport) {
    const s = viewport.mapToScreen(this._fillStart.x, this._fillStart.y);
    const e = viewport.mapToScreen(this._fillEnd.x, this._fillEnd.y);

    ctx.save();
    ctx.strokeStyle = '#ff8800';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.fillStyle = 'rgba(255, 136, 0, 0.1)';

    const x = Math.min(s.x, e.x);
    const y = Math.min(s.y, e.y);
    const w = Math.abs(e.x - s.x);
    const h = Math.abs(e.y - s.y);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '11px monospace';
    const asset = this._previewAsset;
    const mpp = this.mapScale.metresPerPixel;
    const rectW = Math.abs(this._fillEnd.x - this._fillStart.x) * mpp;
    const rectH = Math.abs(this._fillEnd.y - this._fillStart.y) * mpp;
    ctx.fillText(`Fill: ${rectW.toFixed(1)}x${rectH.toFixed(1)}m`, x + 4, y - 6);

    ctx.restore();
  }
}
