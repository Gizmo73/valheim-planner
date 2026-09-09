import { mapToGrid, snapToGrid, gridToMap } from '../core/CoordinateSystem.js';

export class SelectTool {
  constructor(viewport, layerManager, assetLayer, bus) {
    this.viewport = viewport;
    this.layerManager = layerManager;
    this.assetLayer = assetLayer;
    this.bus = bus;
    this.selected = null;
    this._dragging = false;
    this._dragOffset = null;
  }

  activate() {}

  deactivate() {
    this.selected = null;
    this._dragging = false;
  }

  onMouseDown(pos) {
    const map = this.viewport.screenToMap(pos.x, pos.y);
    const hit = this.assetLayer.hitTest(map.x, map.y);

    if (hit) {
      this.selected = hit;
      this._dragging = true;
      this._dragOffset = {
        x: map.x - hit.mapX,
        y: map.y - hit.mapY,
      };
      this.bus.emit('asset:selected', hit);
    } else {
      this.selected = null;
      this.bus.emit('asset:selected', null);
    }
    this.bus.emit('render:request');
  }

  onMouseMove(pos) {
    if (!this._dragging || !this.selected) return;

    const map = this.viewport.screenToMap(pos.x, pos.y);
    const targetMapX = map.x - this._dragOffset.x;
    const targetMapY = map.y - this._dragOffset.y;

    const layer = this.selected.workingLayer;
    if (!layer) return;

    const grid = mapToGrid(targetMapX, targetMapY, layer);
    const snapped = snapToGrid(grid.x, grid.y);
    this.selected.gridX = snapped.x;
    this.selected.gridY = snapped.y;
    this.bus.emit('render:request');
  }

  onMouseUp() {
    this._dragging = false;
  }

  onWheel(pos, e) {
    if (!this.selected) return false;
    const dir = e.deltaY > 0 ? 15 : -15;
    this.selected.rotate(dir);
    this.bus.emit('render:request');
    return true;
  }

  onKeyDown(e) {
    if (!this.selected) return;

    if (e.code === 'ArrowLeft' || e.code === 'ArrowDown') {
      this.selected.rotate(-15);
      this.bus.emit('render:request');
      e.preventDefault();
    } else if (e.code === 'ArrowRight' || e.code === 'ArrowUp') {
      this.selected.rotate(15);
      this.bus.emit('render:request');
      e.preventDefault();
    } else if (e.code === 'Delete' || e.code === 'Backspace') {
      this.assetLayer.removeAsset(this.selected);
      this.selected = null;
      this.bus.emit('asset:selected', null);
      e.preventDefault();
    } else if (e.code === 'Escape') {
      this.selected = null;
      this.bus.emit('asset:selected', null);
      this.bus.emit('render:request');
    }
  }

  renderOverlay(ctx, viewport) {
    if (!this.selected) return;

    const asset = this.selected;
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

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '11px monospace';
    ctx.fillText(`${asset.rotation}°`, corners[0].x + 8, corners[0].y - 8);

    ctx.restore();
  }
}
