import { shapeFromVariant } from '../shapes.js';

export const meta = {
  id: 'grausten',
  label: 'Grausten',
  variants: [
    { id: 'grausten-1x1', label: 'Grausten 1x1', widthM: 1, heightM: 1, shapeKind: 'rect', snapPoints: null },
    { id: 'grausten-2x1', label: 'Grausten 2x1', widthM: 2, heightM: 1, shapeKind: 'rect', snapPoints: null },
    { id: 'grausten-4x1', label: 'Grausten 4x1', widthM: 4, heightM: 1, shapeKind: 'rect', snapPoints: null },
    { id: 'grausten-2x2', label: 'Grausten 2x2', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
    { id: 'grausten-4x4', label: 'Grausten 4x4', widthM: 4, heightM: 4, shapeKind: 'rect', snapPoints: null },
  ],
};

export function shape(id) {
  return shapeFromVariant(meta, id);
}

export function texture(ctx, id) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  const TILE_PX = 64;
  const tilesW = Math.max(1, Math.round(w / TILE_PX));
  const tilesH = Math.max(1, Math.round(h / TILE_PX));

  ctx.fillStyle = '#6B6B6B';
  ctx.fillRect(0, 0, w, h);

  const baseColors = ['#5E5E5E', '#686868', '#626262', '#6E6E6E', '#5A5A5A', '#646464'];

  for (let ty = 0; ty < tilesH; ty++) {
    for (let tx = 0; tx < tilesW; tx++) {
      const bx = tx * TILE_PX, by = ty * TILE_PX;
      const ci = (tx + ty * tilesW) % baseColors.length;

      ctx.fillStyle = baseColors[ci];
      ctx.fillRect(bx + 1, by + 1, TILE_PX - 2, TILE_PX - 2);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      for (let s = 0; s < 8; s++) {
        const sx = bx + Math.random() * TILE_PX;
        const sy = by + Math.random() * TILE_PX;
        const sr = 2 + Math.random() * 4;
        ctx.beginPath();
        ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 0.5;
      for (let g = 0; g < 3; g++) {
        const gy = by + 8 + g * (TILE_PX / 4);
        ctx.beginPath();
        ctx.moveTo(bx, gy);
        for (let x = bx; x < bx + TILE_PX; x += 8) {
          ctx.lineTo(x + 8, gy + (Math.random() - 0.5) * 2);
        }
        ctx.stroke();
      }
    }
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 1;
  for (let ty = 0; ty <= tilesH; ty++) {
    ctx.beginPath();
    ctx.moveTo(0, ty * TILE_PX);
    ctx.lineTo(w, ty * TILE_PX);
    ctx.stroke();
  }
  for (let tx = 0; tx <= tilesW; tx++) {
    ctx.beginPath();
    ctx.moveTo(tx * TILE_PX, 0);
    ctx.lineTo(tx * TILE_PX, h);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}
