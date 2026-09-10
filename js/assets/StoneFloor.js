import { Asset } from './Asset.js';

const TILE_PX = 64;
const textureCache = {};

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function generateCobblestoneBase(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#4E4A44';
  ctx.fillRect(0, 0, w, h);

  const sw = 18, sh = 14, gap = 2.5;
  for (let row = -1; row <= Math.ceil(h / (sh + gap)); row++) {
    const offset = (row % 2) * ((sw + gap) * 0.5);
    for (let col = -1; col <= Math.ceil(w / (sw + gap)); col++) {
      const bx = col * (sw + gap) + offset + (Math.random() - 0.5) * 2;
      const by = row * (sh + gap) + (Math.random() - 0.5) * 1.5;
      const bw = sw + (Math.random() - 0.5) * 4;
      const bh = sh + (Math.random() - 0.5) * 3;
      const shade = 95 + Math.floor(Math.random() * 35);

      ctx.fillStyle = `rgb(${shade - 3}, ${shade}, ${shade - 5})`;
      roundedRect(ctx, bx, by, bw, bh, 3);
      ctx.fill();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      roundedRect(ctx, bx + 2, by + 1, bw - 4, bh * 0.4, 2);
      ctx.fill();
    }
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  return c;
}

function generateTexture(tilesW, tilesH) {
  const key = `${tilesW}x${tilesH}`;
  if (textureCache[key]) return textureCache[key];
  const c = generateCobblestoneBase(tilesW * TILE_PX, tilesH * TILE_PX);
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
  const tilesW = wm, tilesH = hm;
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

export const StoneFloor1x1 = stoneAsset('stone-1x1', 1, 1);
export const StoneFloor2x1 = stoneAsset('stone-2x1', 2, 1);
export const StoneFloor2x2 = stoneAsset('stone-2x2', 2, 2);
export const StoneFloor4x1 = stoneAsset('stone-4x1', 4, 1);
