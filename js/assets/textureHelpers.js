import { isCircle } from './shapes.js';

// Builds the shape's outline as a Path2D in pixel space (canvas is assumed
// sized to the shape's bounding box, origin at the shape's centre).
export function shapePath(shapeResult, mPerPx) {
  const path = new Path2D();
  if (isCircle(shapeResult)) {
    const r = shapeResult.r / mPerPx;
    path.arc(0, 0, r, 0, Math.PI * 2);
    return path;
  }
  shapeResult.forEach((p, i) => {
    const px = p.x / mPerPx, py = p.y / mPerPx;
    if (i === 0) path.moveTo(px, py); else path.lineTo(px, py);
  });
  path.closePath();
  return path;
}

// Clips subsequent drawing to the shape's outline. Caller should ctx.save()
// beforehand and ctx.restore() when done painting.
export function fillShape(ctx, shapeResult, mPerPx) {
  const path = shapePath(shapeResult, mPerPx);
  ctx.clip(path);
  return path;
}

export function checker(ctx, colorA, colorB, pxSize, w, h) {
  for (let y = 0; y * pxSize < h; y++) {
    for (let x = 0; x * pxSize < w; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? colorA : colorB;
      ctx.fillRect(x * pxSize, y * pxSize, pxSize, pxSize);
    }
  }
}

export function stripes(ctx, colorA, colorB, pxSize, w, h, orientation = 'horizontal') {
  const vertical = orientation === 'vertical';
  const length = vertical ? w : h;
  const count = Math.ceil((vertical ? w : h) / pxSize);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = i % 2 === 0 ? colorA : colorB;
    if (vertical) ctx.fillRect(i * pxSize, 0, pxSize, h);
    else ctx.fillRect(0, i * pxSize, w, pxSize);
  }
  void length;
}

export function speckle(ctx, w, h, { count = 40, color = 'rgba(0,0,0,0.08)', minR = 1, maxR = 3 } = {}) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = minR + Math.random() * (maxR - minR);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}
