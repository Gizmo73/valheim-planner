import { Asset } from './Asset.js';

const TILE_PX = 64;
const textureCache = {};

function drawThatchStrands(ctx, x, y, w, h, direction) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Base warm thatch color
  ctx.fillStyle = '#C29B38';
  ctx.fillRect(x, y, w, h);

  // Evenly spaced fine grain lines
  const step = 3;
  if (direction === 'right') {
    for (let cy = y; cy < y + h; cy += step) {
      ctx.fillStyle = (cy % (step * 2) === 0) 
        ? 'rgba(255, 235, 160, 0.35)' 
        : 'rgba(50, 35, 10, 0.25)';
      ctx.fillRect(x, cy, w, 1.5);
    }
  } else {
    for (let cx = x; cx < x + w; cx += step) {
      ctx.fillStyle = (cx % (step * 2) === 0) 
        ? 'rgba(255, 235, 160, 0.35)' 
        : 'rgba(50, 35, 10, 0.25)';
      ctx.fillRect(cx, y, 1.5, h);
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
    // 1. Upper-left triangle (vertical strands)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawThatchStrands(ctx, 0, 0, w, h, 'right');
    ctx.restore();

    // 2. Lower-right triangle (horizontal strands)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawThatchStrands(ctx, 0, 0, w, h, 'down');
    ctx.restore();

    // 3. Dual Valley Crease Shadows (Uniform along the entire seam)
    const shadowDist = 18;

    // A. Upper-Left Shadow (casting inward perpendicular to seam)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();

    const shadowGradLeft = ctx.createLinearGradient(0, h, -shadowDist, h - shadowDist);
    shadowGradLeft.addColorStop(0, 'rgba(0, 0, 0, 0.70)');
    shadowGradLeft.addColorStop(0.5, 'rgba(0, 0, 0, 0.30)');
    shadowGradLeft.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = shadowGradLeft;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // B. Lower-Right Shadow (casting inward perpendicular to seam)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();

    const shadowGradRight = ctx.createLinearGradient(0, h, shadowDist, h + shadowDist);
    shadowGradRight.addColorStop(0, 'rgba(0, 0, 0, 0.70)');
    shadowGradRight.addColorStop(0.5, 'rgba(0, 0, 0, 0.30)');
    shadowGradRight.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = shadowGradRight;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // C. Center Deep Crease Contact Line
    ctx.strokeStyle = 'rgba(15, 8, 0, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(w, 0);
    ctx.stroke();

    // 4. "I" Badge Indicator
    ctx.save();
    ctx.fillStyle = 'rgba(20, 15, 5, 0.75)';
    ctx.beginPath();
    ctx.arc(w - 18, 18, 12, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('I', w - 18, 18.5);
    ctx.restore();

  } else if (variant === 'outer-corner') {
    // 1. Lower-right triangle (vertical strands)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawThatchStrands(ctx, 0, 0, w, h, 'right');
    ctx.restore();

    // 2. Upper-left triangle (horizontal strands)
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawThatchStrands(ctx, 0, 0, w, h, 'down');
    ctx.restore();

    // 3. Drop shadow cast strictly onto lower-right face
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(w, 0); ctx.lineTo(w, h);
    ctx.closePath();
    ctx.clip();

    const shadowDist = 24;
    const shadowGrad = ctx.createLinearGradient(0, h, shadowDist, h + shadowDist);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
    shadowGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.25)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = shadowGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // 4. Highlight ridge crest
    ctx.strokeStyle = 'rgba(255, 245, 200, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(w, 0);
    ctx.stroke();

    // 5. "O" Badge Indicator
    ctx.save();
    ctx.fillStyle = 'rgba(20, 15, 5, 0.75)';
    ctx.beginPath();
    ctx.arc(w - 18, 18, 12, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('O', w - 18, 18.5);
    ctx.restore();

  } else if (variant === 'ridge') {
    drawThatchStrands(ctx, 0, 0, w, h / 2 - 2, 'down');
    drawThatchStrands(ctx, 0, h / 2 + 2, w, h / 2 - 2, 'down');
    ctx.fillStyle = '#6B4E1B';
    ctx.fillRect(0, h / 2 - 3, w, 6);
  }

  textureCache[variant] = c;
  return c;
}

function makeThumbnail(variant) {
  return generateThatchTexture(variant);
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
