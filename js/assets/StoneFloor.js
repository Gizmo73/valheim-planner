import { Asset } from './Asset.js';

const TILE_PX = 64;
const textureCache = {};

function generateTexture(tilesW, tilesH) {
  const key = `${tilesW}x${tilesH}`;
  if (textureCache[key]) return textureCache[key];

  const w = tilesW * TILE_PX;
  const h = tilesH * TILE_PX;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#6B6B6B';
  ctx.fillRect(0, 0, w, h);

  const baseColors = ['#5E5E5E', '#686868', '#626262', '#6E6E6E', '#5A5A5A', '#646464'];

  for (let ty = 0; ty < tilesH; ty++) {
    for (let tx = 0; tx < tilesW; tx++) {
      const bx = tx * TILE_PX;
      const by = ty * TILE_PX;
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

  textureCache[key] = c;
  return c;
}

function makeThumbnail(tilesW, tilesH) {
  const tex = generateTexture(tilesW, tilesH);
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const ctx = c.getContext('2d');
  const scale = Math.min(44 / tex.width, 44 / tex.height);
  const dw = tex.width * scale;
  const dh = tex.height * scale;
  ctx.drawImage(tex, (48 - dw) / 2, (48 - dh) / 2, dw, dh);
  return c;
}

function stoneAsset(type, wm, hm) {
  const tilesW = wm;
  const tilesH = hm;

  return class extends Asset {
    constructor() {
      super(type, wm, hm);
      this._texture = generateTexture(tilesW, tilesH);
    }

    draw(ctx, x, y, w, h) {
      ctx.drawImage(this._texture, x, y, w, h);
    }

    static getThumbnail() {
      return makeThumbnail(tilesW, tilesH);
    }
  };
}

export const StoneFloor1x1 = stoneAsset('stone-floor-1x1', 1, 1);
export const StoneFloor2x1 = stoneAsset('stone-floor-2x1', 2, 1);
export const StoneFloor4x1 = stoneAsset('stone-floor-4x1', 4, 1);
export const StoneFloor2x2 = stoneAsset('stone-floor-2x2', 2, 2);
export const StoneFloor4x4 = stoneAsset('stone-floor-4x4', 4, 4);
