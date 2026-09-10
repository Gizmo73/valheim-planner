import { Asset } from './Asset.js';

const BEAM_WIDTH_M = 0.5;

let cachedTex1m = null;
let cachedTex2m = null;
let cachedTexVert = null;

function generateBeamTexture(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#6B4F12';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255, 200, 100, 0.1)';
  ctx.lineWidth = 0.5;
  for (let g = 0; g < w; g += 3) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g + (Math.random() - 0.5) * 2, h);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  return c;
}

function getTexture1m() {
  if (!cachedTex1m) cachedTex1m = generateBeamTexture(48, 16);
  return cachedTex1m;
}

function getTexture2m() {
  if (!cachedTex2m) cachedTex2m = generateBeamTexture(64, 16);
  return cachedTex2m;
}

function getTextureVert() {
  if (!cachedTexVert) cachedTexVert = generateBeamTexture(16, 16);
  return cachedTexVert;
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

export class WoodBeam1m extends Asset {
  constructor() {
    super('wood-beam-1m', 1, BEAM_WIDTH_M);
    this._snapAlignment = 'center';
  }

  getLocalSnapOffsets() {
    const hw = this.mapWidth / 2;
    return [[-hw, 0], [hw, 0]];
  }

  draw(ctx, x, y, w, h) {
    ctx.drawImage(getTexture1m(), x, y, w, h);
  }

  static getThumbnail() {
    return makeThumbnail(getTexture1m, 48, 16);
  }
}

export class WoodBeam2m extends Asset {
  constructor() {
    super('wood-beam-2m', 2, BEAM_WIDTH_M);
    this._snapAlignment = 'center';
  }

  getLocalSnapOffsets() {
    const hw = this.mapWidth / 2;
    return [[-hw, 0], [hw, 0]];
  }

  draw(ctx, x, y, w, h) {
    ctx.drawImage(getTexture2m(), x, y, w, h);
  }

  static getThumbnail() {
    return makeThumbnail(getTexture2m, 64, 16);
  }
}

export class WoodBeamVertical extends Asset {
  constructor() {
    super('wood-beam-vertical', BEAM_WIDTH_M, BEAM_WIDTH_M);
    this._snapAlignment = 'center';
  }

  getLocalSnapOffsets() {
    return [[0, 0]];
  }

  draw(ctx, x, y, w, h) {
    ctx.drawImage(getTextureVert(), x, y, w, h);
  }

  static getThumbnail() {
    return makeThumbnail(getTextureVert, 16, 16);
  }
}
