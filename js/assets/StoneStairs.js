import { Asset } from './Asset.js';
import { generateCobblestoneBase } from './StoneFloor.js';

const TILE_PX = 64;
let cachedTexture = null;

function generateTexture() {
  if (cachedTexture) return cachedTexture;
  const w = 2 * TILE_PX, h = 2 * TILE_PX;
  const c = generateCobblestoneBase(w, h);
  const ctx = c.getContext('2d');

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 1.5;
  const steps = 5;
  for (let i = 1; i < steps; i++) {
    const y = (i / steps) * h;
    ctx.beginPath();
    ctx.moveTo(4, y);
    ctx.lineTo(w - 4, y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.beginPath();
  ctx.moveTo(w / 2, 8);
  ctx.lineTo(w / 2 - 10, 24);
  ctx.lineTo(w / 2 + 10, 24);
  ctx.closePath();
  ctx.fill();

  cachedTexture = c;
  return c;
}

export class StoneStairs2x2 extends Asset {
  constructor() {
    super('stone-stairs-2x2', 2, 2);
    this._texture = generateTexture();
  }

  draw(ctx, x, y, w, h) {
    ctx.drawImage(this._texture, x, y, w, h);
  }

  static getThumbnail() {
    const tex = generateTexture();
    const c = document.createElement('canvas');
    c.width = 48; c.height = 48;
    const tCtx = c.getContext('2d');
    tCtx.drawImage(tex, 2, 2, 44, 44);
    return c;
  }
}
