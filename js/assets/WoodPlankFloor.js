import { Asset } from './Asset.js';

const TEXTURE_SIZE = 128;
let cachedTexture = null;

function generateTexture() {
  if (cachedTexture) return cachedTexture;

  const c = document.createElement('canvas');
  c.width = TEXTURE_SIZE;
  c.height = TEXTURE_SIZE;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#8B6914';
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  const plankCount = 4;
  const plankH = TEXTURE_SIZE / plankCount;
  const colors = ['#7A5C12', '#8B6914', '#9A7520', '#806018'];

  for (let i = 0; i < plankCount; i++) {
    const y = i * plankH;
    ctx.fillStyle = colors[i];
    ctx.fillRect(0, y + 1, TEXTURE_SIZE, plankH - 2);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(TEXTURE_SIZE, y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 220, 150, 0.08)';
    ctx.lineWidth = 0.5;
    for (let g = 0; g < 6; g++) {
      const gy = y + 3 + g * (plankH / 7);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x < TEXTURE_SIZE; x += 10) {
        ctx.lineTo(x + 10, gy + (Math.random() - 0.5) * 1.5);
      }
      ctx.stroke();
    }
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, TEXTURE_SIZE - 1, TEXTURE_SIZE - 1);

  cachedTexture = c;
  return c;
}

export class WoodPlankFloor extends Asset {
  constructor() {
    super('wood-plank-floor', 2, 2);
    this._texture = generateTexture();
  }

  draw(ctx, x, y, w, h) {
    ctx.drawImage(this._texture, x, y, w, h);
  }

  static getThumbnail() {
    return generateTexture();
  }
}
