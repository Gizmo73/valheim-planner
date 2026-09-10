import { Asset } from './Asset.js';

const TILE_PX = 64;
const textureCache = {};

function generateMarbleBase(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#1C1C1E';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 12; i++) {
    const bx = Math.random() * w;
    const by = Math.random() * h;
    const br = 10 + Math.random() * 30;
    const grad = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    grad.addColorStop(0, 'rgba(40, 38, 44, 0.3)');
    grad.addColorStop(1, 'rgba(28, 28, 30, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.strokeStyle = 'rgba(180, 175, 170, 0.12)';
  ctx.lineWidth = 1;
  for (let v = 0; v < 4; v++) {
    ctx.beginPath();
    let vx = Math.random() * w;
    let vy = Math.random() * h;
    ctx.moveTo(vx, vy);
    for (let s = 0; s < 6; s++) {
      vx += (Math.random() - 0.5) * 30;
      vy += (Math.random() - 0.3) * 25;
      ctx.lineTo(vx, vy);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(150, 145, 140, 0.08)';
  ctx.lineWidth = 0.5;
  for (let v = 0; v < 6; v++) {
    ctx.beginPath();
    let vx = Math.random() * w;
    let vy = Math.random() * h;
    ctx.moveTo(vx, vy);
    for (let s = 0; s < 4; s++) {
      vx += (Math.random() - 0.5) * 20;
      vy += (Math.random() - 0.5) * 20;
      ctx.lineTo(vx, vy);
    }
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
  ctx.fillRect(0, 0, w, h / 2);

  return c;
}

function generateMarbleTexture(tilesW, tilesH) {
  const key = `floor-${tilesW}x${tilesH}`;
  if (textureCache[key]) return textureCache[key];
  const w = tilesW * TILE_PX, h = tilesH * TILE_PX;
  const c = generateMarbleBase(w, h);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(60, 58, 64, 0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  textureCache[key] = c;
  return c;
}

function generateMarbleStairsTexture() {
  if (textureCache['stairs']) return textureCache['stairs'];
  const w = 2 * TILE_PX, h = 2 * TILE_PX;
  const c = generateMarbleBase(w, h);
  const ctx = c.getContext('2d');

  ctx.strokeStyle = 'rgba(100, 95, 90, 0.3)';
  ctx.lineWidth = 1.5;
  const steps = 5;
  for (let i = 1; i < steps; i++) {
    const y = (i / steps) * h;
    ctx.beginPath();
    ctx.moveTo(4, y);
    ctx.lineTo(w - 4, y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(200, 195, 190, 0.12)';
  ctx.beginPath();
  ctx.moveTo(w / 2, 8);
  ctx.lineTo(w / 2 - 10, 22);
  ctx.lineTo(w / 2 + 10, 22);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(60, 58, 64, 0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  textureCache['stairs'] = c;
  return c;
}

function generateColumnTexture(size) {
  const key = `col-${size}`;
  if (textureCache[key]) return textureCache[key];
  const px = size * TILE_PX;
  const c = generateMarbleBase(px, px);
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(60, 58, 64, 0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, px - 1, px - 1);
  textureCache[key] = c;
  return c;
}

function makeThumbnail(texFn, w, h, shape) {
  const tex = texFn();
  const c = document.createElement('canvas');
  c.width = 48; c.height = 48;
  const ctx = c.getContext('2d');
  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(24, 24, 20, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(tex, 4, 4, 40, 40);
  } else if (shape === 'octagon') {
    const d = 8;
    ctx.beginPath();
    ctx.moveTo(2 + d, 2);
    ctx.lineTo(46 - d, 2);
    ctx.lineTo(46, 2 + d);
    ctx.lineTo(46, 46 - d);
    ctx.lineTo(46 - d, 46);
    ctx.lineTo(2 + d, 46);
    ctx.lineTo(2, 46 - d);
    ctx.lineTo(2, 2 + d);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(tex, 2, 2, 44, 44);
  } else {
    const scale = Math.min(44 / w, 44 / h);
    const dw = w * scale;
    const dh = h * scale;
    ctx.drawImage(tex, (48 - dw) / 2, (48 - dh) / 2, dw, dh);
  }
  return c;
}

function marbleFloorAsset(type, wm, hm) {
  const tilesW = wm, tilesH = hm;
  return class extends Asset {
    constructor() {
      super(type, wm, hm);
      this._texture = generateMarbleTexture(tilesW, tilesH);
    }
    draw(ctx, x, y, w, h) {
      ctx.drawImage(this._texture, x, y, w, h);
    }
    static getThumbnail() {
      return makeThumbnail(() => generateMarbleTexture(tilesW, tilesH), tilesW * TILE_PX, tilesH * TILE_PX);
    }
  };
}

export const Marble1x1 = marbleFloorAsset('marble-1x1', 1, 1);
export const Marble2x1 = marbleFloorAsset('marble-2x1', 2, 1);
export const Marble2x2 = marbleFloorAsset('marble-2x2', 2, 2);

export class MarbleColumn1x1 extends Asset {
  constructor() {
    super('marble-column-1x1', 1, 1);
    this._shape = 'circle';
    this._texture = generateColumnTexture(1);
  }

  getLocalSnapOffsets() {
    return [[0, 0]];
  }

  draw(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(this._texture, x, y, w, h);
    ctx.restore();
  }

  static getThumbnail() {
    return makeThumbnail(() => generateColumnTexture(1), TILE_PX, TILE_PX, 'circle');
  }
}

export class MarbleColumn2x2 extends Asset {
  constructor() {
    super('marble-column-2x2', 2, 2);
    this._shape = 'octagon';
    this._texture = generateColumnTexture(2);
  }

  getLocalSnapOffsets() {
    return [[0, 0]];
  }

  draw(ctx, x, y, w, h) {
    const d = Math.min(w, h) * 0.2;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + d, y);
    ctx.lineTo(x + w - d, y);
    ctx.lineTo(x + w, y + d);
    ctx.lineTo(x + w, y + h - d);
    ctx.lineTo(x + w - d, y + h);
    ctx.lineTo(x + d, y + h);
    ctx.lineTo(x, y + h - d);
    ctx.lineTo(x, y + d);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(this._texture, x, y, w, h);
    ctx.restore();
  }

  static getThumbnail() {
    return makeThumbnail(() => generateColumnTexture(2), 2 * TILE_PX, 2 * TILE_PX, 'octagon');
  }
}

export class MarbleStairs2x2 extends Asset {
  constructor() {
    super('marble-stairs-2x2', 2, 2);
    this._texture = generateMarbleStairsTexture();
  }

  draw(ctx, x, y, w, h) {
    ctx.drawImage(this._texture, x, y, w, h);
  }

  static getThumbnail() {
    return makeThumbnail(() => generateMarbleStairsTexture(), 2 * TILE_PX, 2 * TILE_PX);
  }
}
