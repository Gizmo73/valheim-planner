// Overlay presets drawn on top of any asset's texture. Texture "up" is the piece's forward (+z).
// Roof arrows point downhill; the stairs arrow points up the stairs.

// Arrow pointing along +y (down) before rotation; 90° points left, 180° up.
function arrow(ctx, x, y, deg, len) {
  const head = len * 0.4, half = len / 2, shaft = head * 0.4;
  const p = new Path2D();
  p.moveTo(0, half);
  p.lineTo(-head, half - head);
  p.lineTo(-shaft, half - head);
  p.lineTo(-shaft, -half);
  p.lineTo(shaft, -half);
  p.lineTo(shaft, half - head);
  p.lineTo(head, half - head);
  p.closePath();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(deg * Math.PI / 180);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.translate(len * 0.05, len * 0.07);
  ctx.fill(p);
  ctx.translate(-len * 0.05, -len * 0.07);
  ctx.fillStyle = 'rgba(255, 215, 0, 0.9)';
  ctx.fill(p);
  ctx.strokeStyle = '#1a130b';
  ctx.lineWidth = Math.max(1, len * 0.05);
  ctx.stroke(p);
  ctx.restore();
}

function badge(ctx, w, letter) {
  const r = Math.min(w, 200) * 0.09, x = w - r * 1.6, y = r * 1.6;
  ctx.save();
  ctx.fillStyle = 'rgba(15, 12, 10, 0.85)';
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd700';
  ctx.font = `bold ${r * 1.1}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, x, y + r * 0.05);
  ctx.restore();
}

function diagonal(ctx, w, h, style) {
  ctx.strokeStyle = style;
  ctx.lineWidth = Math.min(w, h) * 0.03;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(w, 0);
  ctx.stroke();
}

export const MODIFIERS = [
  {
    id: 'stairs',
    label: 'Stairs',
    draw(ctx, w, h) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = Math.max(1, h * 0.012);
      ctx.beginPath();
      for (let i = 1; i < 6; i++) { ctx.moveTo(0, (i / 6) * h); ctx.lineTo(w, (i / 6) * h); }
      ctx.stroke();
      arrow(ctx, w / 2, h / 2, 180, Math.min(w, h) * 0.5);
    },
  },
  {
    id: 'roof',
    label: 'Roof',
    draw(ctx, w, h) {
      arrow(ctx, w / 2, h / 2, 0, Math.min(w, h) * 0.4);
    },
  },
  {
    id: 'roof-inner',
    label: 'Roof inner corner',
    draw(ctx, w, h) {
      diagonal(ctx, w, h, 'rgba(15, 8, 0, 0.9)');
      arrow(ctx, w * 0.32, h * 0.32, 0, Math.min(w, h) * 0.3);
      arrow(ctx, w * 0.68, h * 0.68, 90, Math.min(w, h) * 0.3);
      badge(ctx, w, 'I');
    },
  },
  {
    id: 'roof-outer',
    label: 'Roof outer corner',
    draw(ctx, w, h) {
      diagonal(ctx, w, h, 'rgba(255, 245, 200, 0.8)');
      arrow(ctx, w * 0.32, h * 0.32, 90, Math.min(w, h) * 0.3);
      arrow(ctx, w * 0.68, h * 0.68, 0, Math.min(w, h) * 0.3);
      badge(ctx, w, 'O');
    },
  },
  {
    id: 'roof-ridge',
    label: 'Roof ridge',
    draw(ctx, w, h) {
      const band = h * 0.06;
      ctx.fillStyle = 'rgba(40, 26, 12, 0.85)';
      ctx.fillRect(0, h / 2 - band / 2, w, band);
      arrow(ctx, w / 2, h * 0.25, 180, Math.min(w, h) * 0.28);
      arrow(ctx, w / 2, h * 0.75, 0, Math.min(w, h) * 0.28);
    },
  },
];

export function modifier(id) {
  return MODIFIERS.find(m => m.id === id) || null;
}
