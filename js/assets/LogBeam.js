import { Asset } from './Asset.js';

const BEAM_WIDTH_M = 0.2;

let cachedTex2m = null;
let cachedTex4m = null;
let cachedTexPole = null;

function generateLogBeamTexture(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#5C3D1E';
  ctx.fillRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
  grad.addColorStop(0.3, 'rgba(255, 200, 130, 0.08)');
  grad.addColorStop(0.5, 'rgba(255, 200, 130, 0.12)');
  grad.addColorStop(0.7, 'rgba(255, 200, 130, 0.08)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(80, 50, 20, 0.25)';
  ctx.lineWidth = 0.5;
  for (let g = 0; g < w; g += 4) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g + (Math.random() - 0.5) * 3, h);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  return c;
}

function generatePoleTexture() {
  const size = 24;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#5C3D1E';
  ctx.fillRect(0, 0, size, size);

  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(200, 160, 100, 0.15)');
  grad.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(100, 70, 30, 0.15)';
  ctx.lineWidth = 0.5;
  for (let r = 3; r < size / 2; r += 3) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  return c;
}

function getTexture2m() {
  if (!cachedTex2m) cachedTex2m = generateLogBeamTexture(64, 12);
  return cachedTex2m;
}

function getTexture4m() {
  if (!cachedTex4m) cachedTex4m = generateLogBeamTexture(128, 12);
  return cachedTex4m;
}

function getTexturePole() {
  if (!cachedTexPole) cachedTexPole = generatePoleTexture();
  return cachedTexPole;
}

function makeThumbnail(texFn, srcW, srcH) {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const ctx = c.getContext('2d');
  const tex = texFn();
  const scale = Math.min(44 / srcW, 44 / srcH);
  const dw = srcW * scale;
  const dh = srcH * scale;
  ctx.drawImage(tex, (48 - dw) / 2, (48 - dh) / 2, dw, dh);
  return c;
}

export class LogBeam2m extends Asset {
  constructor() {
    super('log-beam-2m', 2, BEAM_WIDTH_M);
  }

  getLocalSnapOffsets() {
    const hw = this.mapWidth / 2;
    return [[-hw, 0], [hw, 0]];
  }

  draw(ctx, x, y, w, h) {
    ctx.drawImage(getTexture2m(), x, y, w, h);
  }

  static getThumbnail() {
    return makeThumbnail(getTexture2m, 64, 12);
  }
}

export class LogBeam4m extends Asset {
  constructor() {
    super('log-beam-4m', 4, BEAM_WIDTH_M);
  }

  getLocalSnapOffsets() {
    const hw = this.mapWidth / 2;
    return [[-hw, 0], [hw, 0]];
  }

  draw(ctx, x, y, w, h) {
    ctx.drawImage(getTexture4m(), x, y, w, h);
  }

  static getThumbnail() {
    return makeThumbnail(getTexture4m, 128, 12);
  }
}

export class LogPole extends Asset {
  constructor() {
    super('log-pole', BEAM_WIDTH_M, BEAM_WIDTH_M);
    this._shape = 'circle';
  }

  getLocalSnapOffsets() {
    return [[0, 0]];
  }

  draw(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h / 2, Math.min(w, h) / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(getTexturePole(), x, y, w, h);
    ctx.restore();
  }

  static getThumbnail() {
    const c = document.createElement('canvas');
    c.width = 48; c.height = 48;
    const ctx = c.getContext('2d');
    const tex = getTexturePole();
    ctx.beginPath();
    ctx.arc(24, 24, 11, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(tex, 13, 13, 22, 22);
    return c;
  }
}
