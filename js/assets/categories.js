// Categories group assets in the panel and supply the starting draw code for new assets.
// Each template is the body of draw(ctx, w, h, c, u): w/h are texture pixels, c the colours,
// u the helpers in drawUtils.js. Drawing is already clipped to the asset's shape.

const WOOD = {
  floor: `// Planks 0.25 m wide along the width, with staggered joints.
const plank = 0.25 * u.ppm;
ctx.fillStyle = u.shade(c.main, -0.5);
ctx.fillRect(0, 0, w, h);
for (let y = 0; y < h; y += plank) {
  let x = -u.range(0, 1) * u.ppm;
  while (x < w) {
    const len = u.range(1, 2) * u.ppm;
    ctx.fillStyle = u.shade(c.main, u.range(-0.12, 0.12));
    ctx.fillRect(x + 1, y + 1, len - 2, plank - 2);
    ctx.strokeStyle = u.rgba(u.shade(c.main, -0.4), 0.45);
    ctx.lineWidth = 1;
    for (let g = 0; g < 3; g++) {
      const gy = y + plank * u.range(0.2, 0.8);
      ctx.beginPath();
      ctx.moveTo(x + 2, gy);
      ctx.bezierCurveTo(x + len / 3, gy + u.range(-2, 2), x + len * 2 / 3, gy + u.range(-2, 2), x + len - 2, gy);
      ctx.stroke();
    }
    x += len;
  }
}`,
  beam: `// Grain along the long side; darker edges read as a squared beam.
if (h > w) { ctx.translate(w, 0); ctx.rotate(Math.PI / 2); [w, h] = [h, w]; }
ctx.fillStyle = c.main;
ctx.fillRect(0, 0, w, h);
ctx.lineWidth = 1;
for (let i = 0; i < h / 2; i++) {
  const y = u.range(0, h);
  ctx.strokeStyle = u.rgba(u.shade(c.main, u.range(-0.45, 0.15)), 0.5);
  ctx.beginPath();
  ctx.moveTo(0, y);
  for (let x = 0; x <= w; x += 12) ctx.lineTo(x, y + u.range(-0.8, 0.8));
  ctx.stroke();
}
const edge = ctx.createLinearGradient(0, 0, 0, h);
edge.addColorStop(0, u.rgba('#000000', 0.4));
edge.addColorStop(0.25, u.rgba('#000000', 0));
edge.addColorStop(0.75, u.rgba('#000000', 0));
edge.addColorStop(1, u.rgba('#000000', 0.4));
ctx.fillStyle = edge;
ctx.fillRect(0, 0, w, h);`,
  pole: `// End grain: growth rings inside a darker rim.
const r = Math.min(w, h) / 2;
ctx.fillStyle = u.shade(c.main, 0.15);
ctx.fillRect(0, 0, w, h);
ctx.strokeStyle = u.rgba(u.shade(c.main, -0.5), 0.6);
ctx.lineWidth = Math.max(1, r / 12);
for (let ring = r * 0.8; ring > r * 0.1; ring -= r / 5) {
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, ring, 0, Math.PI * 2);
  ctx.stroke();
}
ctx.strokeStyle = u.shade(c.main, -0.35);
ctx.lineWidth = r * 0.3;
ctx.beginPath();
if (u.shape === 'circle') ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
else ctx.rect(0, 0, w, h);
ctx.stroke();`,
};

const STONE = {
  floor: `// Cobbles of varied size on a mortar bed.
const size = 0.33 * u.ppm;
ctx.fillStyle = u.shade(c.main, -0.45);
ctx.fillRect(0, 0, w, h);
for (let row = 0; row * size < h; row++) {
  for (let x = (row % 2) * -size / 2; x < w; x += size) {
    const bw = size * u.range(0.8, 0.92), bh = size * u.range(0.8, 0.92);
    const bx = x + (size - bw) / 2 + u.range(-1, 1), by = row * size + (size - bh) / 2 + u.range(-1, 1);
    ctx.fillStyle = u.shade(c.main, u.range(-0.15, 0.12));
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, size * 0.3);
    ctx.fill();
    ctx.fillStyle = u.rgba('#ffffff', 0.07);
    ctx.beginPath();
    ctx.roundRect(bx + bw * 0.15, by + bh * 0.1, bw * 0.5, bh * 0.35, size * 0.15);
    ctx.fill();
  }
}`,
  beam: `// Dressed blocks along the wall, joints staggered between courses.
if (h > w) { ctx.translate(w, 0); ctx.rotate(Math.PI / 2); [w, h] = [h, w]; }
const course = Math.min(h, 0.5 * u.ppm);
ctx.fillStyle = u.shade(c.main, -0.45);
ctx.fillRect(0, 0, w, h);
for (let y = 0, row = 0; y < h; y += course, row++) {
  let x = row % 2 ? -0.5 * u.ppm : 0;
  while (x < w) {
    const len = u.range(0.8, 1.2) * u.ppm;
    ctx.fillStyle = u.shade(c.main, u.range(-0.12, 0.12));
    ctx.fillRect(x + 2, y + 2, len - 4, course - 4);
    x += len;
  }
}`,
  pole: `// A single dressed block with a bevelled top.
const b = Math.min(w, h) * 0.18;
ctx.fillStyle = u.shade(c.main, -0.2);
ctx.fillRect(0, 0, w, h);
ctx.fillStyle = c.main;
ctx.fillRect(b, b, w - b * 2, h - b * 2);
ctx.fillStyle = u.rgba('#ffffff', 0.08);
ctx.fillRect(b, b, w - b * 2, (h - b * 2) / 3);`,
};

const MARBLE_BASE = `ctx.fillStyle = c.main;
ctx.fillRect(0, 0, w, h);
for (let i = 0; i < (w * h) / (u.ppm * u.ppm) * 6; i++) {
  const x = u.range(0, w), y = u.range(0, h), r = u.range(0.1, 0.4) * u.ppm;
  const cloud = ctx.createRadialGradient(x, y, 0, x, y, r);
  cloud.addColorStop(0, u.rgba(u.shade(c.main, 0.15), 0.35));
  cloud.addColorStop(1, u.rgba(c.main, 0));
  ctx.fillStyle = cloud;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
for (let v = 0; v < (w + h) / u.ppm * 1.5; v++) {
  let x = u.range(0, w), y = u.range(0, h);
  ctx.strokeStyle = u.rgba(u.shade(c.main, 0.75), u.range(0.15, 0.35));
  ctx.lineWidth = u.range(0.5, 1.5);
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let s = 0; s < 8; s++) {
    x += u.range(-0.2, 0.3) * u.ppm;
    y += u.range(-0.15, 0.15) * u.ppm;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}`;

const MARBLE = {
  floor: `// Polished black marble: cloudy base, pale veins, faint seams every metre.
${MARBLE_BASE}
ctx.strokeStyle = u.rgba('#ffffff', 0.08);
ctx.lineWidth = 1;
ctx.beginPath();
for (let x = u.ppm; x < w; x += u.ppm) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
for (let y = u.ppm; y < h; y += u.ppm) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
ctx.stroke();`,
  pole: `// Marble column top: veined face with a polished rim.
${MARBLE_BASE}
const rim = Math.min(w, h) * 0.06;
ctx.strokeStyle = u.rgba('#ffffff', 0.14);
ctx.lineWidth = rim;
ctx.beginPath();
if (u.shape === 'circle') ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - rim, 0, Math.PI * 2);
else ctx.rect(rim, rim, w - rim * 2, h - rim * 2);
ctx.stroke();`,
};

const GRAUSTEN = {
  floor: `// Square slabs with deep mortar joints and a little surface speckle.
const tile = 0.5 * u.ppm, joint = Math.max(2, 0.03 * u.ppm);
ctx.fillStyle = u.shade(c.main, -0.5);
ctx.fillRect(0, 0, w, h);
for (let y = 0; y < h; y += tile) {
  for (let x = 0; x < w; x += tile) {
    ctx.fillStyle = u.shade(c.main, u.range(-0.1, 0.1));
    ctx.fillRect(x + joint / 2, y + joint / 2, tile - joint, tile - joint);
    ctx.fillStyle = u.rgba('#000000', 0.12);
    for (let s = 0; s < 6; s++) {
      ctx.beginPath();
      ctx.arc(x + u.range(0, tile), y + u.range(0, tile), u.range(0.5, 2), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}`,
  beam: `// Long blocks in running bond with pale mortar lines.
if (h > w) { ctx.translate(w, 0); ctx.rotate(Math.PI / 2); [w, h] = [h, w]; }
const course = Math.min(h, 0.5 * u.ppm), joint = Math.max(2, 0.03 * u.ppm);
ctx.fillStyle = u.shade(c.main, 0.25);
ctx.fillRect(0, 0, w, h);
for (let y = 0, row = 0; y < h; y += course, row++) {
  for (let x = row % 2 ? -0.5 * u.ppm : 0; x < w; x += u.ppm) {
    ctx.fillStyle = u.shade(c.main, u.range(-0.1, 0.1));
    ctx.fillRect(x + joint / 2, y + joint / 2, u.ppm - joint, course - joint);
  }
}`,
  pole: `// One block framed by mortar.
const joint = Math.max(2, Math.min(w, h) * 0.08);
ctx.fillStyle = u.shade(c.main, 0.25);
ctx.fillRect(0, 0, w, h);
ctx.fillStyle = c.main;
ctx.fillRect(joint, joint, w - joint * 2, h - joint * 2);`,
};

const THATCH = {
  floor: `// Straw laid down the slope, tied in courses every 0.5 m.
ctx.fillStyle = c.main;
ctx.fillRect(0, 0, w, h);
ctx.lineWidth = 1.5;
for (let x = 0; x < w; x += 2.5) {
  ctx.strokeStyle = u.rgba(u.shade(c.main, u.range(-0.4, 0.35)), 0.6);
  ctx.beginPath();
  ctx.moveTo(x + u.range(-1, 1), 0);
  ctx.lineTo(x + u.range(-2, 2), h);
  ctx.stroke();
}
ctx.fillStyle = u.rgba(u.shade(c.main, -0.6), 0.35);
for (let y = 0.5 * u.ppm; y < h; y += 0.5 * u.ppm) ctx.fillRect(0, y - 2, w, 3);`,
};

const SHINGLE = {
  floor: `// Overlapping shingles, laid bottom course first so each course overlaps the one below.
ctx.fillStyle = u.shade(c.main, -0.5);
ctx.fillRect(0, 0, w, h);
const sw = 0.25 * u.ppm, course = 0.2 * u.ppm;
let row = 0;
for (let y = h; y > -course * 2; y -= course, row++) {
  for (let x = (row % 2) * -sw / 2; x < w; x += sw) {
    ctx.fillStyle = u.shade(c.main, u.range(-0.15, 0.15));
    ctx.beginPath();
    ctx.moveTo(x + 1, y);
    ctx.lineTo(x + sw - 1, y);
    ctx.lineTo(x + sw - 1, y + course * 1.4);
    ctx.quadraticCurveTo(x + sw / 2, y + course * 1.8, x + 1, y + course * 1.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = u.rgba('#000000', 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}`,
};

const NATURE = {
  tree: `// Leafy canopy from above, trunk showing through the middle.
const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
ctx.fillStyle = u.shade(c.main, -0.35);
ctx.beginPath();
ctx.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
ctx.fill();
for (let i = 0; i < 40; i++) {
  const a = u.range(0, Math.PI * 2), d = Math.sqrt(u.rand()) * r * 0.7;
  ctx.fillStyle = u.shade(c.main, u.range(-0.2, 0.25));
  ctx.beginPath();
  ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * u.range(0.15, 0.3), 0, Math.PI * 2);
  ctx.fill();
}
ctx.fillStyle = '#4a3423';
ctx.beginPath();
ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
ctx.fill();`,
};

const OTHER = {
  floor: `// Flat colour with a bevelled edge.
ctx.fillStyle = c.main;
ctx.fillRect(0, 0, w, h);
const b = Math.max(2, Math.min(w, h) * 0.08);
ctx.strokeStyle = u.rgba('#ffffff', 0.15);
ctx.lineWidth = b;
ctx.strokeRect(b / 2, b / 2, w - b, h - b);`,
};

export const CATEGORIES = [
  { id: 'wood', label: 'Wood', color: '#9a7236', templates: WOOD },
  { id: 'darkwood', label: 'Darkwood', color: '#57402d', templates: WOOD },
  { id: 'stone', label: 'Stone', color: '#8a867e', templates: STONE },
  { id: 'marble', label: 'Black Marble', color: '#2b2b31', templates: MARBLE },
  { id: 'grausten', label: 'Grausten', color: '#62646a', templates: GRAUSTEN },
  { id: 'thatch', label: 'Thatch', color: '#c29b38', templates: THATCH },
  { id: 'shingle', label: 'Shingle', color: '#4d4038', templates: SHINGLE },
  { id: 'nature', label: 'Nature', color: '#4f7a32', templates: NATURE },
  { id: 'other', label: 'Other', color: '#8a8f9e', templates: OTHER },
];

export function category(id) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

// Beams, poles and floors of the same material look very different, so pick by footprint.
export function formFor(categoryId, shape, [w, h]) {
  if (categoryId === 'nature') return 'tree';
  const lo = Math.min(w, h), hi = Math.max(w, h);
  if (shape === 'circle' || hi <= 0.6) return 'pole';
  if (hi / lo >= 2 && lo <= 1) return 'beam';
  return 'floor';
}

export function templateFor(categoryId, form) {
  const t = category(categoryId).templates;
  return t[form] || t.floor || Object.values(t)[0];
}

export function isTemplate(code) {
  const src = code.trim();
  return CATEGORIES.some(c => Object.values(c.templates).some(t => t.trim() === src));
}
