import { outline, defaultSnaps, SHAPES } from './shapes.js';
import { category } from './categories.js';

// One asset = one file in js/assets/library/<id>.js:
//
//   export default {
//     name, category, ids, size: [width, depth], shape, snaps, modifier, colors,
//     draw(ctx, w, h, c, u) { ... },
//   };
//
// Only the fields below are stored; everything else is derived at load.
const STORED = ['name', 'category', 'ids', 'size', 'shape', 'snaps', 'modifier', 'colors', 'drawSrc'];

const num = n => String(Math.round(n * 1000) / 1000);
const str = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const points = pts => `[${pts.map(([x, y]) => `[${num(x)}, ${num(y)}]`).join(', ')}]`;

export function slugify(name) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'asset';
}

function dedent(src) {
  const lines = src.replace(/\t/g, '  ').split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const pad = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
  return lines.map(l => l.slice(pad)).join('\n');
}

export function functionBody(fn) {
  const s = fn.toString();
  return dedent(s.slice(s.indexOf('{') + 1, s.lastIndexOf('}')));
}

export function normalize(id, raw) {
  const size = [0, 1].map(i => (raw.size?.[i] > 0 ? +raw.size[i] : 1));
  const shape = Array.isArray(raw.shape) && raw.shape.length >= 3 ? raw.shape : SHAPES.includes(raw.shape) ? raw.shape : 'rect';
  const def = {
    id,
    name: String(raw.name || id),
    category: category(raw.category).id,
    ids: [...new Set((raw.ids || []).map(s => String(s).trim()).filter(Boolean))],
    size,
    shape,
    modifier: raw.modifier || null,
    colors: { main: category(raw.category).color, ...raw.colors },
    drawSrc: raw.drawSrc ?? (typeof raw.draw === 'function' ? functionBody(raw.draw) : ''),
  };
  def.outline = outline(shape, size);
  def.snaps = Array.isArray(raw.snaps) ? raw.snaps : defaultSnaps(def.outline);
  def.radius = Math.hypot(...size) / 2;
  return def;
}

export function storable(def) {
  return Object.fromEntries(STORED.map(k => [k, def[k]]));
}

export function toFileText(def) {
  const body = def.drawSrc.split('\n').map(l => (l ? `    ${l}` : '')).join('\n');
  return [
    'export default {',
    `  name: ${str(def.name)},`,
    `  category: ${str(def.category)},`,
    `  ids: [${def.ids.map(str).join(', ')}],`,
    `  size: [${def.size.map(num).join(', ')}],`,
    `  shape: ${Array.isArray(def.shape) ? points(def.shape) : str(def.shape)},`,
    `  snaps: ${points(def.snaps)},`,
    `  modifier: ${def.modifier ? str(def.modifier) : 'null'},`,
    `  colors: { ${Object.entries(def.colors).map(([k, v]) => `${k}: ${str(v)}`).join(', ')} },`,
    '  draw(ctx, w, h, c, u) {',
    body,
    '  },',
    '};',
    '',
  ].join('\n');
}
