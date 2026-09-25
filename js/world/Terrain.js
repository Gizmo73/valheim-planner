export const WATER_LEVEL = 30; // Valheim sea level, metres
const BUCKET = 16;
const MIN_SAMPLES = 6;
const MAX_RING = 8;

const PAINT_COLOURS = [[122, 96, 72], [86, 66, 46], [138, 138, 134]]; // dirt, cultivated, paved

function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function unb64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function lerp(a, b, t) {
  return a.map((v, i) => v + (b[i] - v) * t);
}

function rampColour(h) {
  if (h < WATER_LEVEL) return lerp([66, 132, 150], [18, 48, 74], Math.min(1, (WATER_LEVEL - h) / 12));
  const r = h - WATER_LEVEL;
  if (r < 1.2) return [196, 180, 132];
  if (r < 30) return lerp([98, 124, 60], [62, 90, 42], (r - 1.2) / 28.8);
  if (r < 80) return lerp([62, 90, 42], [112, 106, 96], (r - 30) / 50);
  if (r < 120) return lerp([112, 106, 96], [226, 232, 236], (r - 80) / 40);
  return [226, 232, 236];
}

// Inverse-distance weighting of scattered height samples onto a 1 m grid.
function interpolate(samples, x0, z0, cols, rows) {
  const buckets = new Map();
  for (const s of samples) {
    const key = `${Math.floor(s.x / BUCKET)},${Math.floor(s.z / BUCKET)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(s);
  }
  const mean = samples.reduce((a, s) => a + s.y, 0) / samples.length;
  const heights = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const wx = x0 + i, wz = z0 + j;
      const bx = Math.floor(wx / BUCKET), bz = Math.floor(wz / BUCKET);
      let found = [];
      for (let r = 0; r <= MAX_RING && (found.length < MIN_SAMPLES || r < 2); r++) {
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
            const b = buckets.get(`${bx + dx},${bz + dz}`);
            if (b) found = found.concat(b);
          }
        }
      }
      let sw = 0, sh = 0;
      for (const s of found) {
        const w = 1 / ((s.x - wx) ** 2 + (s.z - wz) ** 2 + 1);
        sw += w;
        sh += w * s.y;
      }
      heights[j * cols + i] = sw ? sh / sw : mean;
    }
  }
  return heights;
}

function blur(h, cols, rows) {
  const out = new Float32Array(h.length);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let s = 0, n = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const x = i + di, y = j + dj;
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          s += h[y * cols + x]; n++;
        }
      }
      out[j * cols + i] = s / n;
    }
  }
  return out;
}

/**
 * samples: world points {x, y, z} of things that sit on the ground (trees, rocks, bushes, ores).
 * edits: terrain modifications {x, z, level, paint:[dirt, cultivated, paved]} from TerrainComp data.
 * The result is approximate — good enough to read coastlines and hills around a build.
 */
export function buildTerrain(samples, edits, anchor, radius) {
  const x0 = Math.floor(anchor.x - radius), z0 = Math.floor(anchor.z - radius);
  const cols = Math.ceil(anchor.x + radius) - x0 + 1, rows = Math.ceil(anchor.z + radius) - z0 + 1;
  let heights = interpolate(samples, x0, z0, cols, rows);
  heights = blur(blur(heights, cols, rows), cols, rows);
  let paint = null;
  for (const e of edits) {
    const i = Math.round(e.x) - x0, j = Math.round(e.z) - z0;
    if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
    const k = j * cols + i;
    heights[k] += e.level;
    if (e.paint) {
      paint ||= new Uint8Array(cols * rows * 3);
      for (let c = 0; c < 3; c++) paint[k * 3 + c] = Math.min(255, Math.round(e.paint[c] * 255));
    }
  }
  return new Terrain({ x0, z0, cols, rows, heights, paint, anchor: { x: anchor.x, z: anchor.z } });
}

export class Terrain {
  constructor({ x0, z0, cols, rows, heights, paint, anchor }) {
    Object.assign(this, { x0, z0, cols, rows, heights, paint, anchor });
    this.visible = true;
    this.opacity = 1;
    this.canvas = this._render();
  }

  _render() {
    const { cols, rows, heights: h, paint } = this;
    const c = document.createElement('canvas');
    c.width = cols;
    c.height = rows;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(cols, rows);
    const at = (i, j) => h[Math.min(rows - 1, Math.max(0, j)) * cols + Math.min(cols - 1, Math.max(0, i))];
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const height = h[k];
        let col = rampColour(height);
        if (paint) {
          const w = [paint[k * 3], paint[k * 3 + 1], paint[k * 3 + 2]].map(v => v / 255);
          for (let p = 0; p < 3; p++) if (w[p] > 0.02) col = lerp(col, PAINT_COLOURS[p], Math.min(1, w[p]));
        }
        if (height >= WATER_LEVEL) {
          // Hillshade, lit from the north-west (world +z is north).
          const dx = (at(i + 1, j) - at(i - 1, j)) / 2, dz = (at(i, j + 1) - at(i, j - 1)) / 2;
          const n = Math.hypot(dx, 1, dz);
          const light = (dx * 0.577 + 0.577 - dz * 0.577) / n;
          const shade = 0.6 + 0.55 * Math.max(0, light);
          col = col.map(v => v * shade);
          const coast = [at(i + 1, j), at(i - 1, j), at(i, j + 1), at(i, j - 1)].some(v => v < WATER_LEVEL);
          if (coast) col = lerp(col, [226, 214, 170], 0.5);
        }
        const o = ((rows - 1 - j) * cols + i) * 4; // north up
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  draw(ctx) {
    if (!this.visible) return;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    ctx.imageSmoothingEnabled = true;
    const left = this.x0 - this.anchor.x - 0.5;
    const top = this.anchor.z - (this.z0 + this.rows - 1) - 0.5;
    ctx.drawImage(this.canvas, left, top, this.cols, this.rows);
    ctx.restore();
  }

  toJSON() {
    const dm = Int16Array.from(this.heights, v => Math.round(v * 10));
    const { x0, z0, cols, rows, anchor, visible, opacity } = this;
    return { x0, z0, cols, rows, anchor, visible, opacity, heights: b64(new Uint8Array(dm.buffer)), paint: this.paint && b64(this.paint) };
  }

  static fromJSON(d) {
    const dm = new Int16Array(unb64(d.heights).buffer);
    const t = new Terrain({ ...d, heights: Float32Array.from(dm, v => v / 10), paint: d.paint ? unb64(d.paint) : null });
    t.visible = d.visible ?? true;
    t.opacity = d.opacity ?? 1;
    return t;
  }
}
