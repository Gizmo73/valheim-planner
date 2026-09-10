import { Asset } from './Asset.js';

const TILE_PX = 64;
const textureCache = {};

function drawThatchStrands(ctx, x, y, w, h, direction) {
  // direction: 'down' = strands run top-to-bottom, 'right' = strands run left-to-right
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = '#B89530';
  ctx.fillRect(x, y, w, h);

  if (direction === 'right') {
    for (let cx = x; cx < x + w; cx += 3) {
      const v = Math.random() * 12;
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 200 : 80}, ${Math.random() > 0.5 ? 160 : 60}, 0, ${v / 255})`;
      ctx.fillRect(cx, y, 3, h);
    }

    ctx.strokeStyle = 'rgba(160, 130, 40, 0.10)';
    ctx.lineWidth = 0.5;
    for (let i = y - w; i < y + h + w; i += 3) {
      ctx.beginPath();
      ctx.moveTo(x, i);
      ctx.lineTo(x + w, i + w * 0.15 + (Math.random() - 0.5) * 4);
      ctx.stroke();
    }

    const bundleW = 20;
    ctx.strokeStyle = 'rgba(100, 80, 20, 0.10)';
    ctx.lineWidth = 1;
    for (let bx = x + bundleW; bx < x + w; bx += bundleW) {
      ctx.beginPath();
      ctx.moveTo(bx, y);
      for (let by = y; by < y + h; by += 8) {
        ctx.lineTo(bx + (Math.random() - 0.5) * 1.5, by + 8);
      }
      ctx.stroke();
    }
  } else {
    for (let cy = y; cy < y + h; cy += 3) {
      const v = Math.random() * 12;
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 200 : 80}, ${Math.random() > 0.5 ? 160 : 60}, 0, ${v / 255})`;
      ctx.fillRect(x, cy, w, 3);
    }

    ctx.strokeStyle = 'rgba(160, 130, 40, 0.10)';
    ctx.lineWidth = 0.5;
    for (let i = x - h; i < x + w + h; i += 3) {
      ctx.beginPath();
      ctx.moveTo(i, y);
      ctx.lineTo(i + h * 0.15 + (Math.random() - 0.5) * 4, y + h);
      ctx.stroke();
    }

    const bundleH = 20;
    ctx.strokeStyle = 'rgba(100, 80, 20, 0.10)';
    ctx.lineWidth = 1;
    for (let by = y + bundleH; by < y + h; by += bundleH) {
      ctx.beginPath();
      ctx.moveTo(x, by);
      for (let bx = x; bx < x + w; bx += 8) {
        ctx.lineTo(bx + 8, by + (Math.random() - 0.5) * 1.5);
      }
      ctx.stroke();
    }
  }

  ctx.restore();
}

function generateThatchTexture(variant) {
  if (textureCache[variant]) return textureCache[variant];

  const w = 2 * TILE_PX, h = 2 * TILE_PX;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  if (variant === 'straight') {
    drawThatchStrands(ctx, 0, 0, w, h, 'down');
  } else if (variant === 'inner-corner') {
    // Bottom-left is the inner corner: strands run down on the left half,
    // strands run right on the bottom half, meeting at bottom-left
    drawThatchStrands(ctx, 0, 0, w, h, 'down');
    drawThatchStrands(ctx, 0, h / 2, w, h / 2, 'right');

    // Diagonal seam where directions meet
    ctx.strokeStyle = 'rgba(80, 60, 10, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h - 1);
    ctx.lineTo(w, h / 2 - 1);
    ctx.stroke();
  } else if (variant === 'outer-corner') {
    // Bottom-left is the outer corner: strands fan out from corner
    drawThatchStrands(ctx, 0, 0, w, h / 2, 'down');
    drawThatchStrands(ctx, w / 2, h / 2, w / 2, h / 2, 'down');
    drawThatchStrands(ctx, 0, h / 2, w / 2, h / 2, 'right');

    // Diagonal seam at corner
    ctx.strokeStyle = 'rgba(80, 60, 10, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2 + 1);
    ctx.lineTo(w / 2 + 1, h);
    ctx.stroke();
  } else if (variant === 'ridge') {
    // Top half strands go down, bottom half strands go down (opposite sides of ridge)
    drawThatchStrands(ctx, 0, 0, w, h / 2 - 2, 'down');
    drawThatchStrands(ctx, 0, h / 2 + 2, w, h / 2 - 2, 'down');

    // Ridge board - a darker wooden strip across the center
    ctx.fillStyle = '#7A5C18';
    ctx.fillRect(0, h / 2 - 3, w, 6);
    // Wood grain on ridge board
    ctx.strokeStyle = 'rgba(60, 45, 10, 0.25)';
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx < w; gx += 6) {
      ctx.beginPath();
      ctx.moveTo(gx, h / 2 - 3);
      ctx.lineTo(gx + (Math.random() - 0.5) * 2, h / 2 + 3);
      ctx.stroke();
    }
    // Highlight and shadow edges
    ctx.strokeStyle = 'rgba(255, 220, 150, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2 - 3);
    ctx.lineTo(w, h / 2 - 3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, h / 2 + 3);
    ctx.lineTo(w, h / 2 + 3);
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
