import { Asset } from './Asset.js';

const TILE_PX = 64;
const textureCache = {};

function generateWoodStairTexture(tilesW, tilesH) {
  const key = `${tilesW}x${tilesH}`;
  if (textureCache[key]) return textureCache[key];

  const w = tilesW * TILE_PX;
  const h = tilesH * TILE_PX;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#8B6914';
  ctx.fillRect(0, 0, w, h);

  const plankCount = tilesH * 2 + 1;
  const plankH = h / plankCount;
  const colors = ['#7A5C12', '#8B6914', '#9A7520', '#806018', '#8B6914'];

  for (let i = 0; i < plankCount; i++) {
    const py = i * plankH;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(0, py + 0.5, w, plankH - 1);

    ctx.strokeStyle = 'rgba(255, 220, 150, 0.06)';
    ctx.lineWidth = 0.5;
    for (let g = 0; g < 3; g++) {
      const gy = py + 2 + g * (plankH / 4);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x < w; x += 10) {
        ctx.lineTo(x + 10, gy + (Math.random() - 0.5) * 1);
      }
      ctx.stroke();
    }
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1.5;
  const steps = tilesH * 2;
  for (let i = 1; i < steps; i++) {
    const y = (i / steps) * h;
    ctx.beginPath();
    ctx.moveTo(2, y);
    ctx.lineTo(w - 2, y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  ctx.moveTo(w / 2, 6);
  ctx.lineTo(w / 2 - 8, 18);
  ctx.lineTo(w / 2 + 8, 18);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  textureCache[key] = c;
  return c;
}

function makeThumbnail(tilesW, tilesH) {
  const tex = generateWoodStairTexture(tilesW, tilesH);
  const c = document.createElement('canvas');
  c.width = 48; c.height = 48;
  const ctx = c.getContext('2d');
  const scale = Math.min(44 / tex.width, 44 / tex.height);
  const dw = tex.width * scale;
  const dh = tex.height * scale;
  ctx.drawImage(tex, (48 - dw) / 2, (48 - dh) / 2, dw, dh);
  return c;
}

function woodStairAsset(type, wm, hm) {
  return class extends Asset {
    constructor() {
      super(type, wm, hm);
      this._texture = generateWoodStairTexture(wm, hm);
    }
    draw(ctx, x, y, w, h) {
      ctx.drawImage(this._texture, x, y, w, h);
    }
    static getThumbnail() {
      return makeThumbnail(wm, hm);
    }
  };
}

export const WoodStairs2x2 = woodStairAsset('wood-stairs-2x2', 2, 2);
export const WoodStairs1x2 = woodStairAsset('wood-stairs-1x2', 1, 2);
