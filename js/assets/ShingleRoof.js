import { Asset } from './Asset.js';

const TILE_PX = 64;
const textureCache = {};

function drawDirectionArrow(ctx, centerX, centerY, angleDegrees, length = 24) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((angleDegrees * Math.PI) / 180);

  const headSize = length * 0.4;
  const halfLen = length / 2;

  // Path definition for a clean downward-pointing arrow
  const path = new Path2D();
  path.moveTo(0, halfLen);                            // Arrow tip
  path.lineTo(-headSize, halfLen - headSize);         // Left head wing
  path.lineTo(-headSize * 0.4, halfLen - headSize);   // Left inner neck
  path.lineTo(-headSize * 0.4, -halfLen);             // Top-left stem
  path.lineTo(headSize * 0.4, -halfLen);              // Top-right stem
  path.lineTo(headSize * 0.4, halfLen - headSize);    // Right inner neck
  path.lineTo(headSize, halfLen - headSize);          // Right head wing
  path.closePath();

  // 1. Subtle drop shadow underneath
  ctx.save();
  ctx.translate(1.5, 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill(path);
  ctx.restore();

  // 2. Gold Arrow Fill
  ctx.fillStyle = 'rgba(255, 215, 0, 0.85)';
  ctx.fill(path);

  // 3. Crisp Outline
  ctx.strokeStyle = '#1A130B';
  ctx.lineWidth = 1.2;
  ctx.stroke(path);

  ctx.restore();
}

function drawShingleGrid(ctx, x, y, w, h, orientation = 'down') {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  // Handle 90-degree side rotation via canvas transform
  if (orientation === 'right') {
    ctx.translate(x + w, y);
    ctx.rotate(Math.PI / 2);
    const temp = w;
    w = h;
    h = temp;
    x = 0;
    y = 0;
  }

  // Dark weathered charcoal base
  ctx.fillStyle = '#22201F';
  ctx.fillRect(x, y, w, h);

  // 1. Grid snapping: fit exactly 4 full shingle columns across tile width
  const cols = 4;
  const shingleW = w / cols;
  const shingleH = shingleW * 1.5; // Elongated 1.5:1 height aspect ratio
  const rowStep = shingleH * 0.5;

  // 2. Snap bottom row so shingle tips hit the exact bottom boundary (y + h)
  const numRows = Math.ceil(h / rowStep);
  const startY = (y + h) - (numRows * rowStep);

  // Render rows from top to bottom so lower shingles overlap upper ones
  for (let r = -1; r <= numRows; r++) {
    const rowY = startY + (r * rowStep);
    
    // Shift alternating rows by half a shingle width
    const isOdd = Math.abs(r) % 2 !== 0;
    const offsetX = isOdd ? shingleW * 0.5 : 0;
    const numCols = isOdd ? cols + 1 : cols;
    const startC = isOdd ? -1 : 0;

    for (let c = startC; c < startC + numCols; c++) {
      const shingleX = x + (c * shingleW) + offsetX;

      // Skip drawing partial edge shingles on the bottommost row
      if (r === numRows && isOdd && (c < 0 || c >= cols)) {
        continue;
      }

      ctx.save();
      ctx.beginPath();
      
      // Full pointed diamond profile
      ctx.moveTo(shingleX, rowY);
      ctx.lineTo(shingleX + shingleW * 0.5, rowY + shingleH * 0.4);
      ctx.lineTo(shingleX, rowY + shingleH);
      ctx.lineTo(shingleX - shingleW * 0.5, rowY + shingleH * 0.4);
      ctx.closePath();

      // Shingle Body Color
      const shade = 38 + (Math.abs(r) % 3) * 7;
      ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 8})`;
      ctx.fill();

      // Drop shadow underneath individual shingles
      ctx.strokeStyle = 'rgba(8, 6, 4, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Top-left wood highlight
      ctx.strokeStyle = 'rgba(130, 120, 110, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(shingleX - shingleW * 0.5, rowY + shingleH * 0.4);
      ctx.lineTo(shingleX, rowY + shingleH);
      ctx.stroke();

      ctx.restore();
    }
  }

  ctx.restore();
}

function generateShingleTexture(variant) {
  if (textureCache[variant]) return textureCache[variant];

  const w = 2 * TILE_PX, h = 2 * TILE_PX;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');

  if (variant === 'straight') {
    drawShingleGrid(ctx, 0, 0, w, h, 'down');
    
    // Downward arrow in the center
    drawDirectionArrow(ctx, w / 2, h / 2, 0, 26);

  } else if (variant === 'inner-corner') {
    // 1. Upper-left face
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawShingleGrid(ctx, 0, 0, w, h, 'down');
    ctx.restore();

    // 2. Lower-right face
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawShingleGrid(ctx, 0, 0, w, h, 'right');
    ctx.restore();

    // 3. Valley Crease Ambient Occlusion Shadow
    const shadowDist = 24;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    const shadowGradLeft = ctx.createLinearGradient(0, h, -shadowDist, h - shadowDist);
    shadowGradLeft.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    shadowGradLeft.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = shadowGradLeft;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    const shadowGradRight = ctx.createLinearGradient(0, h, shadowDist, h + shadowDist);
    shadowGradRight.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    shadowGradRight.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = shadowGradRight;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // 4. Wooden Beam along the Inner Ridge Valley
    ctx.save();
    const beamWidth = 14;

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.lineWidth = beamWidth + 6;
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(w, 0);
    ctx.stroke();

    ctx.strokeStyle = '#7A5229';
    ctx.lineWidth = beamWidth;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(w, 0);
    ctx.stroke();

    ctx.strokeStyle = '#A3723D';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0 - 2, h - 2); ctx.lineTo(w - 2, 0 - 2);
    ctx.stroke();

    ctx.strokeStyle = '#3D2612';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0 + 3, h + 3); ctx.lineTo(w + 3, 0 + 3);
    ctx.stroke();

    ctx.restore();

    // Arrows indicating directional flow for both corner sides
    drawDirectionArrow(ctx, w * 0.32, h * 0.32, 0, 20); // Top-left side points right
    drawDirectionArrow(ctx, w * 0.68, h * 0.68, 90, 20);   // Bottom-right side points down

    // 5. "I" Badge Indicator
    ctx.save();
    ctx.fillStyle = 'rgba(15, 12, 10, 0.85)';
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
    // 1. Lower-right face
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawShingleGrid(ctx, 0, 0, w, h, 'down');
    ctx.restore();

    // 2. Upper-left face
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawShingleGrid(ctx, 0, 0, w, h, 'right');
    ctx.restore();

    // 3. Drop Shadow onto Lower-Right Face
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(w, 0); ctx.lineTo(w, h);
    ctx.closePath();
    ctx.clip();

    const shadowDist = 26;
    const shadowGrad = ctx.createLinearGradient(0, h, shadowDist, h + shadowDist);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.80)');
    shadowGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.35)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = shadowGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // 4. Highlighted Hip Crest Edge Line
    ctx.strokeStyle = 'rgba(180, 170, 150, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(w, 0);
    ctx.stroke();

    // Arrows indicating directional flow for both corner sides
    drawDirectionArrow(ctx, w * 0.32, h * 0.32, 90, 20);   // Top-left side points down
    drawDirectionArrow(ctx, w * 0.68, h * 0.68, 0, 20); // Bottom-right side points right

    // 5. "O" Badge Indicator
    ctx.save();
    ctx.fillStyle = 'rgba(15, 12, 10, 0.85)';
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
    drawShingleGrid(ctx, 0, 0, w, h / 2 - 2, 'down');
    drawShingleGrid(ctx, 0, h / 2 + 2, w, h / 2 - 2, 'down');
    
    // Horizontal Wooden Ridge Cap
    ctx.fillStyle = '#5C3E21';
    ctx.fillRect(0, h / 2 - 5, w, 10);
    ctx.strokeStyle = '#3D2612';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, h / 2 - 5, w, 10);

    // Flow arrows on top and bottom sections
    drawDirectionArrow(ctx, w / 2, h * 0.25, 180, 18); // Top section points up
    drawDirectionArrow(ctx, w / 2, h * 0.75, 0, 18);   // Bottom section points down
  }

  textureCache[variant] = c;
  return c;
}

function makeThumbnail(variant) {
  return generateShingleTexture(variant);
}

function shingleAsset(type, variant) {
  return class extends Asset {
    constructor() {
      super(type, 2, 2);
      this._texture = generateShingleTexture(variant);
    }
    draw(ctx, x, y, w, h) {
      ctx.drawImage(this._texture, x, y, w, h);
    }
    static getThumbnail() {
      return makeThumbnail(variant);
    }
  };
}

export const ShingleStraight = shingleAsset('shingle-straight', 'straight');
export const ShingleInnerCorner = shingleAsset('shingle-inner-corner', 'inner-corner');
export const ShingleOuterCorner = shingleAsset('shingle-outer-corner', 'outer-corner');
export const ShingleRidge = shingleAsset('shingle-ridge', 'ridge');
