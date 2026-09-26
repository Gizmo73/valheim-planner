// Overlay presets for any asset. Texture "up" is the piece's forward (+z).
//
// Roof modifiers split the piece into faces. Each face has the area it covers and the way it
// drains (`flow`, degrees: 0 down, 90 left, 180 up, 270 right). The asset's material is drawn once
// per face, turned so its "down" follows the flow, and the face's arrow uses the same angle — so
// strands, shingle overlaps and arrows always agree. Materials never need to know about faces.
//
// Orientation matches pieces placed in-game: a straight roof rises towards the texture bottom.

const ALL = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];
const ABOVE_DIAGONAL = (w, h) => [[0, 0], [w, 0], [0, h]]; // the diagonal runs bottom-left to top-right
const BELOW_DIAGONAL = (w, h) => [[w, 0], [w, h], [0, h]];
const TOP_HALF = (w, h) => [[0, 0], [w, 0], [w, h / 2], [0, h / 2]];
const BOTTOM_HALF = (w, h) => [[0, h / 2], [w, h / 2], [w, h], [0, h]];

// Arrow pointing along +y (down) before rotation.
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

function diagonal(ctx, w, h, style, width) {
  ctx.strokeStyle = style;
  ctx.lineWidth = Math.min(w, h) * width;
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(w, 0);
  ctx.stroke();
}

// Shading that fades away from the diagonal into one face. side: -1 above it, 1 below it.
function diagonalShade(ctx, w, h, side, dist, stops) {
  const d = Math.min(w, h) * dist;
  const g = ctx.createLinearGradient(0, h, side * d, h + side * d);
  stops.forEach(([at, alpha]) => g.addColorStop(at, `rgba(0, 0, 0, ${alpha})`));
  ctx.save();
  ctx.beginPath();
  (side < 0 ? ABOVE_DIAGONAL : BELOW_DIAGONAL)(w, h).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
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
    faces: [{ area: ALL, flow: 180, arrow: [0.5, 0.5, 0.4] }],
  },
  {
    id: 'roof-inner',
    label: 'Roof inner corner',
    // Valley: both faces drain into the diagonal.
    faces: [
      { area: ABOVE_DIAGONAL, flow: 270, arrow: [0.32, 0.32, 0.3] },
      { area: BELOW_DIAGONAL, flow: 180, arrow: [0.68, 0.68, 0.3] },
    ],
    draw(ctx, w, h) {
      const stops = [[0, 0.7], [0.5, 0.3], [1, 0]];
      diagonalShade(ctx, w, h, -1, 0.14, stops);
      diagonalShade(ctx, w, h, 1, 0.14, stops);
      diagonal(ctx, w, h, 'rgba(15, 8, 0, 0.9)', 0.02);
      badge(ctx, w, 'I');
    },
  },
  {
    id: 'roof-outer',
    label: 'Roof outer corner',
    // Hip: both faces drain away from the diagonal.
    faces: [
      { area: ABOVE_DIAGONAL, flow: 180, arrow: [0.32, 0.32, 0.3] },
      { area: BELOW_DIAGONAL, flow: 270, arrow: [0.68, 0.68, 0.3] },
    ],
    draw(ctx, w, h) {
      diagonalShade(ctx, w, h, -1, 0.19, [[0, 0.65], [0.4, 0.25], [1, 0]]);
      diagonal(ctx, w, h, 'rgba(255, 245, 200, 0.8)', 0.016);
      badge(ctx, w, 'O');
    },
  },
  {
    id: 'roof-ridge',
    label: 'Roof ridge',
    faces: [
      { area: TOP_HALF, flow: 180, arrow: [0.5, 0.25, 0.28] },
      { area: BOTTOM_HALF, flow: 0, arrow: [0.5, 0.75, 0.28] },
    ],
    draw(ctx, w, h) {
      const band = h * 0.06;
      ctx.fillStyle = 'rgba(40, 26, 12, 0.85)';
      ctx.fillRect(0, h / 2 - band / 2, w, band);
    },
  },
];

export function modifier(id) {
  return MODIFIERS.find(m => m.id === id) || null;
}

// Where the asset's material goes: one pass per face, or the whole texture unturned.
export function materialPasses(mod, w, h) {
  return mod?.faces ? mod.faces.map(f => ({ area: f.area(w, h), flow: f.flow })) : [{ area: null, flow: 0 }];
}

export function drawOverlay(mod, ctx, w, h) {
  mod.draw?.(ctx, w, h);
  for (const f of mod.faces || []) {
    const [x, y, size] = f.arrow;
    arrow(ctx, w * x, h * y, f.flow, Math.min(w, h) * size);
  }
}
