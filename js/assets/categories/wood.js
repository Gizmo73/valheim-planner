import { shapeFromVariant } from '../shapes.js';

const PX_PER_M = 64;

export const meta = {
  id: 'wood',
  label: 'Wood',
  variants: [
    { id: 'wood-plank-floor', label: 'Wood Floor 2x2', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
    { id: 'wood-plank-floor-1x1', label: 'Wood Floor 1x1', widthM: 1, heightM: 1, shapeKind: 'rect', snapPoints: null },
    { id: 'wood-beam-2m', label: 'Wood Beam 2m', widthM: 2, heightM: 0.5, shapeKind: 'rect', snapPoints: [{ x: -1, y: 0 }, { x: 1, y: 0 }] },
    { id: 'wood-beam-1m', label: 'Wood Beam 1m', widthM: 1, heightM: 0.5, shapeKind: 'rect', snapPoints: [{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }] },
    { id: 'wood-beam-vertical', label: 'Vertical Beam', widthM: 0.5, heightM: 0.5, shapeKind: 'rect', snapPoints: [{ x: 0, y: 0 }] },
    { id: 'log-beam-2m', label: 'Log Beam 2m', widthM: 2, heightM: 0.2, shapeKind: 'rect', snapPoints: [{ x: -1, y: 0 }, { x: 1, y: 0 }] },
    { id: 'log-beam-4m', label: 'Log Beam 4m', widthM: 4, heightM: 0.2, shapeKind: 'rect', snapPoints: [{ x: -2, y: 0 }, { x: 2, y: 0 }] },
    { id: 'log-pole', label: 'Log Pole', widthM: 0.2, heightM: 0.2, shapeKind: 'circle', snapPoints: [{ x: 0, y: 0 }] },
    { id: 'wood-stairs-2x2', label: 'Wood Stairs 2x2', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
    { id: 'wood-stairs-1x2', label: 'Wood Stairs 1x2', widthM: 1, heightM: 2, shapeKind: 'rect', snapPoints: null },
    { id: 'wood-wall-1m', label: 'Wood Wall 1m', widthM: 1, heightM: 0.3, shapeKind: 'rect', snapPoints: [{ x: -0.5, y: 0 }, { x: 0.5, y: 0 }] },
    { id: 'wood-wall-2m', label: 'Wood Wall 2m', widthM: 2, heightM: 0.3, shapeKind: 'rect', snapPoints: [{ x: -1, y: 0 }, { x: 1, y: 0 }] },
  ],
};

export function shape(id) {
  return shapeFromVariant(meta, id);
}

function drawPlankFloor(ctx, w, h) {
  ctx.fillStyle = '#8B6914';
  ctx.fillRect(0, 0, w, h);

  const plankCount = Math.max(1, Math.round((h / PX_PER_M) / 0.5));
  const plankH = h / plankCount;
  const colors = ['#7A5C12', '#8B6914', '#9A7520', '#806018'];

  for (let i = 0; i < plankCount; i++) {
    const y = i * plankH;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(0, y + 1, w, plankH - 2);

    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 220, 150, 0.08)';
    ctx.lineWidth = 0.5;
    for (let g = 0; g < 6; g++) {
      const gy = y + 3 + g * (plankH / 7);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x < w; x += 10) {
        ctx.lineTo(x + 10, gy + (Math.random() - 0.5) * 1.5);
      }
      ctx.stroke();
    }
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

function drawBeam(ctx, w, h) {
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
}

function drawLogBeam(ctx, w, h) {
  ctx.fillStyle = '#5C3D1E';
  ctx.fillRect(0, 0, w, h);

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
  grad.addColorStop(0.3, 'rgba(255, 200, 130, 0.08)');
  grad.addColorStop(0.5, 'rgba(255, 200, 130, 0.12)');
  grad.addColorStop(0.7, 'rgba(255, 200, 130, 0.08)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(80, 50, 20, 0.25)';
  ctx.lineWidth = 0.5;
  for (let g = 0; g < w; g += 4) {
    ctx.beginPath();
    ctx.moveTo(g, 0);
    ctx.lineTo(g + (Math.random() - 0.5) * 3, h);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

function drawLogPole(ctx, w, h) {
  ctx.fillStyle = '#5C3D1E';
  ctx.fillRect(0, 0, w, h);

  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) / 2);
  grad.addColorStop(0, 'rgba(200, 160, 100, 0.15)');
  grad.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(100, 70, 30, 0.15)';
  ctx.lineWidth = 0.5;
  for (let r = 3; r < Math.min(w, h) / 2; r += 3) {
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawStairs(ctx, w, h) {
  ctx.fillStyle = '#8B6914';
  ctx.fillRect(0, 0, w, h);

  const hMetres = h / PX_PER_M;
  const plankCount = Math.max(1, Math.round(hMetres * 2) + 1);
  const plankH = h / plankCount;
  const colors = ['#7A5C12', '#8B6914', '#9A7520', '#806018', '#8B6914'];

  for (let i = 0; i < plankCount; i++) {
    const py = i * plankH;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(0, py + 0.5, w, plankH - 1);

    ctx.strokeStyle = 'rgba(255, 220, 150, 0.06)';
    ctx.lineWidth = 0.5;
    for (let g = 0; g < 3; g++) {
      const gy = py + 2 + g * (plankH / 4);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      for (let x = 0; x < w; x += 10) {
        ctx.lineTo(x + 10, gy + (Math.random() - 0.5) * 1);
      }
      ctx.stroke();
    }
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1.5;
  const steps = Math.max(1, Math.round(hMetres * 2));
  for (let i = 1; i < steps; i++) {
    const y = (i / steps) * h;
    ctx.beginPath();
    ctx.moveTo(2, y);
    ctx.lineTo(w - 2, y);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.beginPath();
  ctx.moveTo(w / 2, 6);
  ctx.lineTo(w / 2 - 8, 18);
  ctx.lineTo(w / 2 + 8, 18);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

function drawWall(ctx, w, h) {
  ctx.fillStyle = '#6B4F12';
  ctx.fillRect(0, 0, w, h);

  const plankW = 12;
  const colors = ['#5E4410', '#6B4F12', '#7A5C18', '#624A10'];
  for (let i = 0; i < Math.ceil(w / plankW); i++) {
    const px = i * plankW;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(px + 0.5, 0, plankW - 1, h);

    ctx.strokeStyle = 'rgba(255, 200, 100, 0.06)';
    ctx.lineWidth = 0.5;
    for (let g = 0; g < 2; g++) {
      const gx = px + 2 + g * (plankW / 3);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx + (Math.random() - 0.5) * 2, h);
      ctx.stroke();
    }
  }

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

export function texture(ctx, id) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  if (id === 'wood-plank-floor' || id === 'wood-plank-floor-1x1') drawPlankFloor(ctx, w, h);
  else if (id === 'wood-beam-2m' || id === 'wood-beam-1m' || id === 'wood-beam-vertical') drawBeam(ctx, w, h);
  else if (id === 'log-beam-2m' || id === 'log-beam-4m') drawLogBeam(ctx, w, h);
  else if (id === 'log-pole') drawLogPole(ctx, w, h);
  else if (id === 'wood-stairs-2x2' || id === 'wood-stairs-1x2') drawStairs(ctx, w, h);
  else if (id === 'wood-wall-1m' || id === 'wood-wall-2m') drawWall(ctx, w, h);
}
