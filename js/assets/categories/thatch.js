import { shapeFromVariant } from '../shapes.js';

export const meta = {
  id: 'thatch',
  label: 'Thatch',
  variants: [
    { id: 'thatch-straight', label: 'Thatch Straight', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
    { id: 'thatch-inner-corner', label: 'Thatch Inner Corner', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
    { id: 'thatch-outer-corner', label: 'Thatch Outer Corner', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
    { id: 'thatch-ridge', label: 'Thatch Ridge', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
  ],
};

export function shape(id) {
  return shapeFromVariant(meta, id);
}

function drawDirectionArrow(ctx, centerX, centerY, angleDegrees, length = 24) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate((angleDegrees * Math.PI) / 180);

  const headSize = length * 0.4;
  const halfLen = length / 2;

  const path = new Path2D();
  path.moveTo(0, halfLen);
  path.lineTo(-headSize, halfLen - headSize);
  path.lineTo(-headSize * 0.4, halfLen - headSize);
  path.lineTo(-headSize * 0.4, -halfLen);
  path.lineTo(headSize * 0.4, -halfLen);
  path.lineTo(headSize * 0.4, halfLen - headSize);
  path.lineTo(headSize, halfLen - headSize);
  path.closePath();

  ctx.save();
  ctx.translate(1.5, 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill(path);
  ctx.restore();

  ctx.fillStyle = 'rgba(255, 215, 0, 0.85)';
  ctx.fill(path);

  ctx.strokeStyle = '#1A130B';
  ctx.lineWidth = 1.2;
  ctx.stroke(path);

  ctx.restore();
}

function drawThatchStrands(ctx, x, y, w, h, direction) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.fillStyle = '#C29B38';
  ctx.fillRect(x, y, w, h);

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

function drawBadge(ctx, w, letter) {
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
  ctx.fillText(letter, w - 18, 18.5);
  ctx.restore();
}

export function texture(ctx, id) {
  const w = ctx.canvas.width, h = ctx.canvas.height;

  if (id === 'thatch-straight') {
    drawThatchStrands(ctx, 0, 0, w, h, 'down');
    drawDirectionArrow(ctx, w / 2, h / 2, 0, 26);
  } else if (id === 'thatch-inner-corner') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawThatchStrands(ctx, 0, 0, w, h, 'down');
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawThatchStrands(ctx, 0, 0, w, h, 'right');
    ctx.restore();

    const shadowDist = 18;

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

    ctx.strokeStyle = 'rgba(15, 8, 0, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(w, 0);
    ctx.stroke();

    drawDirectionArrow(ctx, w * 0.32, h * 0.32, 0, 20);
    drawDirectionArrow(ctx, w * 0.68, h * 0.68, 90, 20);

    drawBadge(ctx, w, 'I');
  } else if (id === 'thatch-outer-corner') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawThatchStrands(ctx, 0, 0, w, h, 'down');
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawThatchStrands(ctx, 0, 0, w, h, 'right');
    ctx.restore();

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

    ctx.strokeStyle = 'rgba(255, 245, 200, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(w, 0);
    ctx.stroke();

    drawDirectionArrow(ctx, w * 0.32, h * 0.32, 90, 20);
    drawDirectionArrow(ctx, w * 0.68, h * 0.68, 0, 20);

    drawBadge(ctx, w, 'O');
  } else if (id === 'thatch-ridge') {
    drawThatchStrands(ctx, 0, 0, w, h / 2 - 2, 'down');
    drawThatchStrands(ctx, 0, h / 2 + 2, w, h / 2 - 2, 'down');

    ctx.fillStyle = '#6B4E1B';
    ctx.fillRect(0, h / 2 - 3, w, 6);

    drawDirectionArrow(ctx, w / 2, h * 0.25, 180, 18);
    drawDirectionArrow(ctx, w / 2, h * 0.75, 0, 18);
  }
}
