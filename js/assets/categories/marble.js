import { shapeFromVariant } from '../shapes.js';

export const meta = {
  id: 'marble',
  label: 'Black Marble',
  variants: [
    { id: 'marble-1x1', label: 'Marble 1x1', widthM: 1, heightM: 1, shapeKind: 'rect', snapPoints: null },
    { id: 'marble-2x1', label: 'Marble 2x1', widthM: 2, heightM: 1, shapeKind: 'rect', snapPoints: null },
    { id: 'marble-2x2', label: 'Marble 2x2', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
    { id: 'marble-column-1x1', label: 'Marble Column 1x1', widthM: 1, heightM: 1, shapeKind: 'circle', snapPoints: [{ x: 0, y: 0 }] },
    { id: 'marble-column-2x2', label: 'Marble Column 2x2', widthM: 2, heightM: 2, shapeKind: 'octagon', snapPoints: [{ x: 0, y: 0 }] },
    { id: 'marble-stairs-2x2', label: 'Marble Stairs 2x2', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
  ],
};

export function shape(id) {
  return shapeFromVariant(meta, id);
}

function drawMarbleBase(ctx, w, h) {
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
}

export function texture(ctx, id) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  drawMarbleBase(ctx, w, h);

  if (id === 'marble-stairs-2x2') {
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
  } else if (id === 'marble-column-1x1' || id === 'marble-column-2x2') {
    ctx.strokeStyle = 'rgba(60, 58, 64, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  } else {
    ctx.strokeStyle = 'rgba(60, 58, 64, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }
}
