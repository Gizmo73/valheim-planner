import { Asset } from './Asset.js';

const textureCache = {};

function generateWallTexture(lengthPx, thickPx) {
  const key = `${lengthPx}x${thickPx}`;
  if (textureCache[key]) return textureCache[key];

  const c = document.createElement('canvas');
  c.width = lengthPx;
  c.height = thickPx;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#6B4F12';
  ctx.fillRect(0, 0, lengthPx, thickPx);

  const plankW = 12;
  const colors = ['#5E4410', '#6B4F12', '#7A5C18', '#624A10'];
  for (let i = 0; i < Math.ceil(lengthPx / plankW); i++) {
    const px = i * plankW;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(px + 0.5, 0, plankW - 1, thickPx);

    ctx.strokeStyle = 'rgba(255, 200, 100, 0.06)';
    ctx.lineWidth = 0.5;
    for (let g = 0; g < 2; g++) {
      const gx = px + 2 + g * (plankW / 3);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx + (Math.random() - 0.5) * 2, thickPx);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, lengthPx - 1, thickPx - 1);

  textureCache[key] = c;
  return c;
}

function makeThumbnail(lengthPx, thickPx) {
  const tex = generateWallTexture(lengthPx, thickPx);
  const c = document.createElement('canvas');
  c.width = 48; c.height = 48;
  const ctx = c.getContext('2d');
  const scale = Math.min(44 / lengthPx, 44 / thickPx);
  const dw = lengthPx * scale;
  const dh = thickPx * scale;
  ctx.drawImage(tex, (48 - dw) / 2, (48 - dh) / 2, dw, dh);
  return c;
}

function wallAsset(type, lengthM, thickM) {
  const lpx = lengthM * 64;
  const tpx = Math.max(thickM * 64, 8);

  return class extends Asset {
    constructor() {
      super(type, lengthM, thickM);
      this._snapAlignment = 'center';
    }

    getGridSnapPoints() {
      const hw = this.widthM / 2;
      return [{ x: -hw, y: 0 }, { x: hw, y: 0 }];
    }

    getLocalSnapOffsets() {
      const hw = this.mapWidth / 2;
      return [[-hw, 0], [hw, 0]];
    }

    draw(ctx, x, y, w, h) {
      ctx.drawImage(generateWallTexture(lpx, tpx), x, y, w, h);
    }

    static getThumbnail() {
      return makeThumbnail(lpx, tpx);
    }
  };
}

export const WoodWall1m = wallAsset('wood-wall-1m', 1, 0.3);
export const WoodWall2m = wallAsset('wood-wall-2m', 2, 0.3);
