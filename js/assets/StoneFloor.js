import { Asset } from './Asset.js';

const TILE_PX = 64;
const textureCache = {};

export function generateStoneBase(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  // Smooth grey base
  ctx.fillStyle = '#5A5650';
  ctx.fillRect(0, 0, w, h);

  // Very subtle tonal variation - large soft patches
  for (let i = 0; i < 8; i++) {
    const px = Math.random() * w;
    const py = Math.random() * h;
    const pr = 15 + Math.random() * 30;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
    const v = Math.random() > 0.5 ? 255 : 0;
    grad.addColorStop(0, `rgba(${v}, ${v}, ${v}, 0.025)`);
    grad.addColorStop(1, 'rgba(128, 128, 128, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Very faint surface noise
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 6;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }
  ctx.putImageData(imgData, 0, 0);

  // Subtle mortar lines between blocks - very low contrast
  const blockW = 24 + Math.random() * 8;
  const blockH = 16 + Math.random() * 6;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 0.5;
  for (let row = 0; row <= Math.ceil(h / blockH); row++) {
    const y = row * blockH;
    const offset = (row % 2) * (blockW * 0.5);
    // Horizontal mortar line
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < w; x += 6) {
      ctx.lineTo(x + 6, y + (Math.random() - 0.5) * 0.5);
    }
    ctx.stroke();
    // Vertical mortar lines
    for (let col = 0; col <= Math.ceil(w / blockW); col++) {
      const x = col * blockW + offset;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 0.5, y + blockH);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.10)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  return c;
}

function generateTexture(tilesW, tilesH) {
  const key = `${tilesW}x${tilesH}`;
  if (textureCache[key]) return textureCache[key];
  const c = generateStoneBase(tilesW * TILE_PX, tilesH * TILE_PX);
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
