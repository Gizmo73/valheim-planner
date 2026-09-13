import { shapeFromVariant } from '../shapes.js';

export const meta = {
  id: 'stone',
  label: 'Stone',
  variants: [
    { id: 'stone-1x1', label: 'Stone 1x1', widthM: 1, heightM: 1, shapeKind: 'rect', snapPoints: null },
    { id: 'stone-2x1', label: 'Stone 2x1', widthM: 2, heightM: 1, shapeKind: 'rect', snapPoints: null },
    { id: 'stone-2x2', label: 'Stone 2x2', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
    { id: 'stone-4x1', label: 'Stone 4x1', widthM: 4, heightM: 1, shapeKind: 'rect', snapPoints: null },
    { id: 'stone-stairs-2x2', label: 'Stone Stairs 2x2', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
  ],
};

export function shape(id) {
  return shapeFromVariant(meta, id);
}

export function drawStoneBase(ctx, w, h) {
  ctx.fillStyle = '#5A5650';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 8; i++) {
    const px = Math.random() * w;
    const py = Math.random() * h;
    const pr = 15 + Math.random() * 30;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
    const v = Math.random() > 0.5 ? 255 : 0;
    grad.addColorStop(0, `rgba(${v}, ${v}, ${v}, 0.025)`);
    grad.addColorStop(1, 'rgba(128, 128, 128, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 6;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }
  ctx.putImageData(imgData, 0, 0);

  const blockW = 24 + Math.random() * 8;
  const blockH = 16 + Math.random() * 6;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 0.5;
  for (let row = 0; row <= Math.ceil(h / blockH); row++) {
    const y = row * blockH;
    const offset = (row % 2) * (blockW * 0.5);
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < w; x += 6) {
      ctx.lineTo(x + 6, y + (Math.random() - 0.5) * 0.5);
    }
    ctx.stroke();
    for (let col = 0; col <= Math.ceil(w / blockW); col++) {
      const x = col * blockW + offset;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 0.5, y + blockH);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.10)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

export function texture(ctx, id) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  drawStoneBase(ctx, w, h);

  if (id === 'stone-stairs-2x2') {
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
  }
}
