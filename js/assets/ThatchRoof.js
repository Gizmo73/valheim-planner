import { Asset } from './Asset.js';

const TILE_PX = 64;
const textureCache = {};

function generateThatchBase(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#B89530';
  ctx.fillRect(0, 0, w, h);

  for (let y = 0; y < h; y += 3) {
    const v = Math.random() * 15;
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0}, ${Math.random() > 0.5 ? 200 : 0}, 0, ${v / 255})`;
    ctx.fillRect(0, y, w, 3);
  }

  ctx.strokeStyle = 'rgba(160, 130, 40, 0.12)';
  ctx.lineWidth = 0.5;
  for (let i = -w; i < w + h; i += 3) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + h * 0.15 + (Math.random() - 0.5) * 4, h);
    ctx.stroke();
  }

  const bundleH = 20;
  ctx.strokeStyle = 'rgba(100, 80, 20, 0.12)';
  ctx.lineWidth = 1;
  for (let y = bundleH; y < h; y += bundleH) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < w; x += 8) {
      ctx.lineTo(x + 8, y + (Math.random() - 0.5) * 1.5);
    }
    ctx.stroke();
  }

  return c;
}

function generateThatchTexture(variant) {
  if (textureCache[variant]) return textureCache[variant];

  const w = 2 * TILE_PX, h = 2 * TILE_PX;
  const c = generateThatchBase(w, h);
  const ctx = c.getContext('2d');

  if (variant === 'inner-corner') {
    ctx.strokeStyle = 'rgba(80, 60, 10, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(4, h * 0.6);
    ctx.lineTo(4, h - 4);
    ctx.lineTo(w * 0.4, h - 4);
    ctx.stroke();
    ctx.fillStyle = 'rgba(80, 60, 10, 0.3)';
    ctx.beginPath();
    ctx.arc(4, h - 4, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (variant === 'outer-corner') {
    ctx.fillStyle = 'rgba(80, 60, 10, 0.25)';
    ctx.beginPath();
    ctx.moveTo(4, h - 4);
    ctx.lineTo(4, h - 20);
    ctx.lineTo(20, h - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(80, 60, 10, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else if (variant === 'ridge') {
    ctx.strokeStyle = 'rgba(80, 60, 10, 0.3)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2 + 2);
    ctx.lineTo(w, h / 2 + 2);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  textureCache[variant] = c;
  return c;
}

function makeThumbnail(variant) {
  const tex = generateThatchTexture(variant);
  const c = document.createElement('canvas');
  c.width = 48; c.height = 48;
  const ctx = c.getContext('2d');
  ctx.drawImage(tex, 2, 2, 44, 44);
  return c;
}

function thatchAsset(type, variant) {
  return class extends Asset {
    constructor() {
      super(type, 2, 2);
      this._texture = generateThatchTexture(variant);
    }
    draw(ctx, x, y, w, h) {
      ctx.drawImage(this._texture, x, y, w, h);
    }
    static getThumbnail() {
      return makeThumbnail(variant);
    }
  };
}

export const ThatchStraight = thatchAsset('thatch-straight', 'straight');
export const ThatchInnerCorner = thatchAsset('thatch-inner-corner', 'inner-corner');
export const ThatchOuterCorner = thatchAsset('thatch-outer-corner', 'outer-corner');
export const ThatchRidge = thatchAsset('thatch-ridge', 'ridge');
