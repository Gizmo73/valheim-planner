import { shapeFromVariant } from '../shapes.js';

export const meta = {
  id: 'shingle',
  label: 'Shingle',
  variants: [
    { id: 'shingle-straight', label: 'Shingle Straight', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
    { id: 'shingle-inner-corner', label: 'Shingle Inner Corner', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
    { id: 'shingle-outer-corner', label: 'Shingle Outer Corner', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
    { id: 'shingle-ridge', label: 'Shingle Ridge', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
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

function drawShingleGrid(ctx, x, y, w, h, orientation = 'down') {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  if (orientation === 'right') {
    ctx.translate(x + w, y);
    ctx.rotate(Math.PI / 2);
    const temp = w;
    w = h;
    h = temp;
    x = 0;
    y = 0;
  }

  ctx.fillStyle = '#22201F';
  ctx.fillRect(x, y, w, h);

  const cols = 4;
  const shingleW = w / cols;
  const shingleH = shingleW * 1.5;
  const rowStep = shingleH * 0.5;

  const numRows = Math.ceil(h / rowStep);
  const startY = (y + h) - (numRows * rowStep);

  for (let r = -1; r <= numRows; r++) {
    const rowY = startY + (r * rowStep);

    const isOdd = Math.abs(r) % 2 !== 0;
    const offsetX = isOdd ? shingleW * 0.5 : 0;
    const numCols = isOdd ? cols + 1 : cols;
    const startC = isOdd ? -1 : 0;

    for (let c = startC; c < startC + numCols; c++) {
      const shingleX = x + (c * shingleW) + offsetX;

      if (r === numRows && isOdd && (c < 0 || c >= cols)) {
        continue;
      }

      ctx.save();
      ctx.beginPath();

      ctx.moveTo(shingleX, rowY);
      ctx.lineTo(shingleX + shingleW * 0.5, rowY + shingleH * 0.4);
      ctx.lineTo(shingleX, rowY + shingleH);
      ctx.lineTo(shingleX - shingleW * 0.5, rowY + shingleH * 0.4);
      ctx.closePath();

      const shade = 38 + (Math.abs(r) % 3) * 7;
      ctx.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 8})`;
      ctx.fill();

      ctx.strokeStyle = 'rgba(8, 6, 4, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

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

function drawBadge(ctx, w, letter) {
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
  ctx.fillText(letter, w - 18, 18.5);
  ctx.restore();
}

export function texture(ctx, id) {
  const w = ctx.canvas.width, h = ctx.canvas.height;

  if (id === 'shingle-straight') {
    drawShingleGrid(ctx, 0, 0, w, h, 'down');
    drawDirectionArrow(ctx, w / 2, h / 2, 0, 26);
  } else if (id === 'shingle-inner-corner') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawShingleGrid(ctx, 0, 0, w, h, 'down');
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawShingleGrid(ctx, 0, 0, w, h, 'right');
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    const shadowDist = 24;
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

    drawDirectionArrow(ctx, w * 0.32, h * 0.32, 0, 20);
    drawDirectionArrow(ctx, w * 0.68, h * 0.68, 90, 20);

    drawBadge(ctx, w, 'I');
  } else if (id === 'shingle-outer-corner') {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawShingleGrid(ctx, 0, 0, w, h, 'down');
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(0, h);
    ctx.closePath();
    ctx.clip();
    drawShingleGrid(ctx, 0, 0, w, h, 'right');
    ctx.restore();

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

    ctx.strokeStyle = 'rgba(180, 170, 150, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h); ctx.lineTo(w, 0);
    ctx.stroke();

    drawDirectionArrow(ctx, w * 0.32, h * 0.32, 90, 20);
    drawDirectionArrow(ctx, w * 0.68, h * 0.68, 0, 20);

    drawBadge(ctx, w, 'O');
  } else if (id === 'shingle-ridge') {
    drawShingleGrid(ctx, 0, 0, w, h / 2 - 2, 'down');
    drawShingleGrid(ctx, 0, h / 2 + 2, w, h / 2 - 2, 'down');

    ctx.fillStyle = '#5C3E21';
    ctx.fillRect(0, h / 2 - 5, w, 10);
    ctx.strokeStyle = '#3D2612';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(0, h / 2 - 5, w, 10);

    drawDirectionArrow(ctx, w / 2, h * 0.25, 180, 18);
    drawDirectionArrow(ctx, w / 2, h * 0.75, 0, 18);
  }
}
