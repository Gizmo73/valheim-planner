import { mapToGrid, snapToGrid, gridToMap } from '../core/CoordinateSystem.js';

export class SelectTool {
  constructor(viewport, layerManager, assetLayer, mapScale, bus) {
    this.viewport = viewport;
    this.layerManager = layerManager;
    this.assetLayer = assetLayer;
    this.mapScale = mapScale;
    this.bus = bus;
    this.selected = null;
    this.selection = [];
    this._dragging = false;
    this._boxSelecting = false;
    this._boxStart = null;
    this._boxEnd = null;
    this._dragOffset = null;
    this._dragOffsets = [];
    this._snapMode = 'grid';
    this._shiftDown = false;

    this.bus.on('snap:changed', (mode) => { this._snapMode = mode; });
    this.bus.on('mobile:rotate', (deg) => {
      if (this.selection.length > 0) {
        for (const a of this.selection) a.rotate(deg);
        this.bus.emit('render:request');
      }
    });
    this.bus.on('mobile:duplicate', () => {
      if (this.selected) this.bus.emit('asset:startPlace', this.selected.type);
    });
    this.bus.on('mobile:delete', () => {
      if (this.selection.length > 0) {
        this.assetLayer.removeAssets(this.selection);
        this.selection = [];
        this.selected = null;
        this.bus.emit('asset:selected', null);
      }
    });
    this.bus.on('mobile:group', () => {
      if (this.selection.length > 0) this._groupSelected();
    });
    this.bus.on('mobile:selectAll', () => {
      const allAssets = this.assetLayer.assets.slice();
      this._setSelection(allAssets);
      this.bus.emit('render:request');
    });
  }

  activate() {}

  hitTest(pos) {
    const map = this.viewport.screenToMap(pos.x, pos.y);
    const hit = this.assetLayer.hitTest(map.x, map.y);
    return hit !== null && hit !== undefined;
  }

  deactivate() {
    this.selected = null;
    this.selection = [];
    this._dragging = false;
    this._boxSelecting = false;
  }

  _isSelected(asset) {
    return this.selection.includes(asset);
  }

  _setSelection(assets) {
    this.selection = assets;
    this.selected = assets.length > 0 ? assets[0] : null;
    this.bus.emit('asset:selected', this.selected);
  }

  onMouseDown(pos, e) {
    const map = this.viewport.screenToMap(pos.x, pos.y);
    const hit = this.assetLayer.hitTest(map.x, map.y);
    const shift = e && e.shiftKey;

    if (hit) {
      if (shift) {
        if (this._isSelected(hit)) {
          this.selection = this.selection.filter(a => a !== hit);
          this.selected = this.selection.length > 0 ? this.selection[0] : null;
        } else {
          this.selection.push(hit);
          this.selected = hit;
        }
        this.bus.emit('asset:selected', this.selected);
      } else if (!this._isSelected(hit)) {
        this._setSelection([hit]);
      }

      this._dragging = true;
      this._dragOffsets = this.selection.map(a => ({
        asset: a,
        dx: map.x - a.mapX,
        dy: map.y - a.mapY,
      }));
      this._dragOffset = {
        x: map.x - hit.mapX,
        y: map.y - hit.mapY,
      };
    } else {
      if (!shift) {
        this._setSelection([]);
      }
      this._boxSelecting = true;
      this._boxStart = map;
      this._boxEnd = map;
    }
    this.bus.emit('render:request');
  }

  onMouseMove(pos) {
    const map = this.viewport.screenToMap(pos.x, pos.y);

    if (this._boxSelecting) {
      this._boxEnd = map;
      this.bus.emit('render:request');
      return;
    }

    if (!this._dragging || this.selection.length === 0) return;

    const primary = this.selected || this.selection[0];
    const primaryOffset = this._dragOffsets.find(o => o.asset === primary) || this._dragOffsets[0];
    if (!primaryOffset) return;

    const targetMapX = map.x - primaryOffset.dx;
    const targetMapY = map.y - primaryOffset.dy;
    const layer = primary.workingLayer;
    if (!layer) return;

    const mpp = this.mapScale.metresPerPixel;
    let finalGridX, finalGridY;

    if (this._snapMode === 'free') {
      const grid = mapToGrid(targetMapX, targetMapY, layer, mpp);
      finalGridX = grid.x;
      finalGridY = grid.y;
    } else if (this._snapMode === 'asset') {
      const result = this._assetSnapCalc(targetMapX, targetMapY, primary, layer, mpp);
      finalGridX = result.gridX;
      finalGridY = result.gridY;
    } else {
      const grid = mapToGrid(targetMapX, targetMapY, layer, mpp);
      const hw = primary.widthM / 2;
      const hh = primary.heightM / 2;
      const rad = primary.rotation * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const anchorX = primary._snapAlignment === 'center' ? 0 : -hw;
      const anchorY = primary._snapAlignment === 'center' ? 0 : -hh;
      const snapPtX = grid.x + hw + anchorX * cos - anchorY * sin;
      const snapPtY = grid.y + hh + anchorX * sin + anchorY * cos;
      const snapped = snapToGrid(snapPtX, snapPtY);
      finalGridX = snapped.x - hw - anchorX * cos + anchorY * sin;
      finalGridY = snapped.y - hh - anchorX * sin - anchorY * cos;
    }

    const deltaGridX = finalGridX - primary.gridX;
    const deltaGridY = finalGridY - primary.gridY;

    for (const a of this.selection) {
      a.gridX += deltaGridX;
      a.gridY += deltaGridY;
    }

    this.bus.emit('render:request');
  }

  _assetSnapCalc(targetMapX, targetMapY, asset, layer, mpp) {
    const existingPoints = this.assetLayer.getSnapPoints(this.selection);
    if (existingPoints.length === 0) {
      const grid = mapToGrid(targetMapX, targetMapY, layer, mpp);
      const offset = asset.getGridSnapOffset();
      const snapped = snapToGrid(grid.x - offset.x, grid.y - offset.y);
      return { gridX: snapped.x + offset.x, gridY: snapped.y + offset.y };
    }

    const hw = asset.mapWidth / 2;
    const hh = asset.mapHeight / 2;
    const rad = asset.rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const cx = targetMapX + hw;
    const cy = targetMapY + hh;
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

    const snappedMapX = targetMapX + bestDx;
    const snappedMapY = targetMapY + bestDy;
    const grid = mapToGrid(snappedMapX, snappedMapY, layer, mpp);
    return { gridX: grid.x, gridY: grid.y };
  }

  onMouseUp(pos, e) {
    if (this._boxSelecting) {
      this._boxSelecting = false;
      const map = this.viewport.screenToMap(pos.x, pos.y);
      this._boxEnd = map;

      const hits = this.assetLayer.hitTestRect(
        this._boxStart.x, this._boxStart.y,
        this._boxEnd.x, this._boxEnd.y
      );

      const shift = e && e.shiftKey;
      if (shift) {
        const existing = new Set(this.selection);
        for (const h of hits) {
          if (!existing.has(h)) this.selection.push(h);
        }
      } else {
        this.selection = hits;
      }
      this.selected = this.selection.length > 0 ? this.selection[0] : null;
      this.bus.emit('asset:selected', this.selected);
      this._boxStart = null;
      this._boxEnd = null;
      this.bus.emit('render:request');
      return;
    }

    this._dragging = false;
    this.bus.emit('render:request');
  }

  onKeyDown(e) {
    if (e.code === 'KeyQ' || e.code === 'ArrowLeft' || e.code === 'ArrowDown') {
      if (this.selection.length > 0) {
        for (const a of this.selection) a.rotate(-22.5);
        this.bus.emit('render:request');
        e.preventDefault();
      }
    } else if (e.code === 'KeyE' || e.code === 'ArrowRight' || e.code === 'ArrowUp') {
      if (this.selection.length > 0) {
        for (const a of this.selection) a.rotate(22.5);
        this.bus.emit('render:request');
        e.preventDefault();
      }
    } else if (e.code === 'KeyD') {
      if (this.selected) {
        this.bus.emit('asset:startPlace', this.selected.type);
        e.preventDefault();
      }
    } else if (e.code === 'Delete' || e.code === 'Backspace') {
      if (this.selection.length > 0) {
        this.assetLayer.removeAssets(this.selection);
        this.selection = [];
        this.selected = null;
        this.bus.emit('asset:selected', null);
        e.preventDefault();
      }
    } else if (e.code === 'Escape') {
      this._setSelection([]);
      this.bus.emit('render:request');
    } else if (e.code === 'KeyG') {
      if (this.selection.length > 0) {
        this._groupSelected();
        e.preventDefault();
      }
    } else if (e.code === 'KeyA' && (e.ctrlKey || e.metaKey)) {
      const allAssets = this.assetLayer.assets.slice();
      this._setSelection(allAssets);
      this.bus.emit('render:request');
      e.preventDefault();
    }
  }

  _groupSelected() {
    const name = prompt('Enter group name:');
    if (!name || !name.trim()) return;
    const group = this.assetLayer.addGroup(name.trim());
    const ids = this.selection.map(a => a.id);
    this.assetLayer.moveAssetsToGroup(ids, group.id);
  }

  renderOverlay(ctx, viewport) {
    if (this._boxSelecting && this._boxStart && this._boxEnd) {
      const s = viewport.mapToScreen(this._boxStart.x, this._boxStart.y);
      const e = viewport.mapToScreen(this._boxEnd.x, this._boxEnd.y);
      ctx.save();
      ctx.strokeStyle = '#00c8ff';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.fillStyle = 'rgba(0, 200, 255, 0.08)';
      const x = Math.min(s.x, e.x);
      const y = Math.min(s.y, e.y);
      const w = Math.abs(e.x - s.x);
      const h = Math.abs(e.y - s.y);
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      ctx.restore();
    }

    for (const asset of this.selection) {
      this._drawSelectionOutline(ctx, viewport, asset);
    }

    if (this.selection.length > 0 && this.selected) {
      ctx.save();
      const asset = this.selected;
      const cx = asset.mapX + asset.mapWidth / 2;
      const cy = asset.mapY + asset.mapHeight / 2;
      const hw = asset.mapWidth / 2;
      const hh = asset.mapHeight / 2;
      const rad = asset.rotation * Math.PI / 180;
      const corner = viewport.mapToScreen(
        cx + (-hw) * Math.cos(rad) - (-hh) * Math.sin(rad),
        cy + (-hw) * Math.sin(rad) + (-hh) * Math.cos(rad)
      );
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '11px monospace';
      let label = `${asset.rotation}°`;
      if (this.selection.length > 1) label += ` [${this.selection.length}]`;
      ctx.fillText(label, corner.x + 8, corner.y - 8);
      ctx.restore();
    }
  }

  _drawSelectionOutline(ctx, viewport, asset) {
    const cx = asset.mapX + asset.mapWidth / 2;
    const cy = asset.mapY + asset.mapHeight / 2;
    const hw = asset.mapWidth / 2;
    const hh = asset.mapHeight / 2;
    const rad = asset.rotation * Math.PI / 180;

    const corners = [
      [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh],
    ].map(([lx, ly]) => {
      const rx = lx * Math.cos(rad) - ly * Math.sin(rad);
      const ry = lx * Math.sin(rad) + ly * Math.cos(rad);
      return viewport.mapToScreen(cx + rx, cy + ry);
    });

    ctx.save();
    ctx.strokeStyle = '#00c8ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) {
      ctx.lineTo(corners[i].x, corners[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    const handleSize = 4;
    ctx.fillStyle = '#00c8ff';
    for (const c of corners) {
      ctx.fillRect(c.x - handleSize, c.y - handleSize, handleSize * 2, handleSize * 2);
    }

    ctx.restore();
  }
}
