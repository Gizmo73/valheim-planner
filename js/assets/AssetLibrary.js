import { load, save } from '../core/storage.js';
import { DEG, rotate } from '../core/geometry.js';
import { stableHash } from '../world/saveReader.js';
import { normalize, storable, toFileText, slugify } from './assetFile.js';
import { CATEGORIES } from './categories.js';
import { modifier } from './modifiers.js';
import { tracePath, containsLocal } from './shapes.js';
import { makeUtils } from './drawUtils.js';
import { commitFiles } from './github.js';

const LIBRARY_DIR = 'js/assets/library';
const MAX_PPM = 96;
const MAX_TEXTURE_PX = 1024;

function compile(def, previous) {
  try {
    def.draw = new Function('ctx', 'w', 'h', 'c', 'u', def.drawSrc);
    def.error = null;
  } catch (err) {
    def.draw = previous?.draw || (() => {});
    def.error = err.message;
  }
  return def;
}

export function renderTexture(def) {
  const [w, h] = def.size;
  const ppm = Math.min(MAX_PPM, MAX_TEXTURE_PX / Math.max(w, h));
  const W = Math.max(1, Math.round(w * ppm)), H = Math.max(1, Math.round(h * ppm));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const clip = () => {
    ctx.beginPath();
    tracePath(ctx, def.outline, ppm, W / 2, H / 2);
    ctx.clip();
  };
  ctx.save();
  clip();
  try {
    def.draw(ctx, W, H, { ...def.colors }, makeUtils(def.id, ppm, Array.isArray(def.shape) ? 'custom' : def.shape, def.size));
    def.runtimeError = null;
  } catch (err) {
    def.runtimeError = err.message;
    ctx.fillStyle = '#a33';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
  const mod = modifier(def.modifier);
  if (mod) {
    ctx.save();
    clip();
    mod.draw(ctx, W, H);
    ctx.restore();
  }
  return canvas;
}

// Loads every asset file listed in library/index.json, then layers local edits (localStorage)
// on top. Edits stay local until pushed to the repo.
export class AssetLibrary {
  constructor(bus) {
    this.bus = bus;
    this.assets = new Map();
    this.baseline = new Map(); // id -> file text as served
    this._textures = new Map();
    this._byHash = new Map();
  }

  async load() {
    const ids = await fetch(new URL('./library/index.json', import.meta.url)).then(r => r.json());
    await Promise.all(ids.map(async id => {
      try {
        const mod = await import(new URL(`./library/${id}.js`, import.meta.url));
        const def = normalize(id, mod.default);
        this.baseline.set(id, toFileText(def));
        this.assets.set(id, compile(def));
      } catch (err) {
        console.error(`Asset ${id} failed to load`, err);
      }
    }));

    const overrides = load('assets', {});
    for (const [id, o] of Object.entries(overrides)) {
      if (o.deleted) {
        if (this.baseline.has(id)) this.assets.delete(id);
        else delete overrides[id];
        continue;
      }
      const def = normalize(id, o);
      // Already pushed and deployed: the served file now matches, so the local copy is redundant.
      if (this.baseline.get(id) === toFileText(def)) delete overrides[id];
      else this.assets.set(id, compile(def));
    }
    save('assets', overrides);
    this._reindex();
  }

  _reindex() {
    this._byHash = new Map();
    for (const a of this.assets.values()) for (const id of a.ids) this._byHash.set(stableHash(id), a.id);
  }

  _persist(id, value) {
    const overrides = load('assets', {});
    if (value) overrides[id] = value;
    else delete overrides[id];
    save('assets', overrides);
  }

  _changed(id) {
    this._textures.delete(id);
    this._reindex();
    this.bus.emit('library:changed', id);
    this.bus.emit('render');
  }

  get(id) {
    return this.assets.get(id) || null;
  }

  list() {
    const order = CATEGORIES.map(c => c.id);
    return [...this.assets.values()].sort((a, b) =>
      order.indexOf(a.category) - order.indexOf(b.category) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  assetForHash(hash) {
    return this._byHash.get(hash) || null;
  }

  uniqueId(name) {
    const base = slugify(name);
    let id = base, n = 2;
    while (this.assets.has(id) || this.baseline.has(id)) id = `${base}_${n++}`;
    return id;
  }

  // Normalises and compiles without committing — used for live previews in the editor.
  draft(id, raw) {
    return compile(normalize(id, raw), this.get(id));
  }

  save(id, raw) {
    const def = compile(normalize(id, raw), this.get(id));
    this.assets.set(id, def);
    this._persist(id, storable(def));
    this._changed(id);
    return def;
  }

  remove(id) {
    this.assets.delete(id);
    this._persist(id, this.baseline.has(id) ? { deleted: true } : null);
    this._changed(id);
  }

  async revert(id) {
    this._persist(id, null);
    if (this.baseline.has(id)) {
      const mod = await import(new URL(`./library/${id}.js`, import.meta.url));
      this.assets.set(id, compile(normalize(id, mod.default)));
    } else {
      this.assets.delete(id);
    }
    this._changed(id);
  }

  status(id) {
    if (!this.assets.has(id)) return this.baseline.has(id) ? 'deleted' : null;
    if (!this.baseline.has(id)) return 'new';
    return this.baseline.get(id) === toFileText(this.assets.get(id)) ? null : 'modified';
  }

  changes() {
    const ids = new Set([...this.assets.keys(), ...this.baseline.keys()]);
    return [...ids].map(id => ({ id, status: this.status(id) })).filter(c => c.status);
  }

  async push() {
    const changes = this.changes();
    if (!changes.length) return 0;
    const files = changes.map(({ id, status }) => ({
      path: `${LIBRARY_DIR}/${id}.js`,
      content: status === 'deleted' ? null : toFileText(this.assets.get(id)),
    }));
    const manifest = [...this.assets.keys()].sort();
    if (changes.some(c => c.status !== 'modified')) {
      files.push({ path: `${LIBRARY_DIR}/index.json`, content: JSON.stringify(manifest, null, 2) + '\n' });
    }
    const names = changes.map(c => c.id);
    await commitFiles(files, `Update asset library: ${names.slice(0, 5).join(', ')}${names.length > 5 ? ` and ${names.length - 5} more` : ''}`);
    this.baseline = new Map(manifest.map(id => [id, toFileText(this.assets.get(id))]));
    this.bus.emit('library:changed');
    return changes.length;
  }

  // --- drawing & geometry ---

  texture(id) {
    if (!this._textures.has(id)) this._textures.set(id, renderTexture(this.get(id)));
    return this._textures.get(id);
  }

  thumbnail(def, px) {
    const tex = def === this.get(def.id) ? this.texture(def.id) : renderTexture(def);
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const k = Math.min(px * 0.86 / tex.width, px * 0.86 / tex.height);
    c.getContext('2d').drawImage(tex, (px - tex.width * k) / 2, (px - tex.height * k) / 2, tex.width * k, tex.height * k);
    return c;
  }

  drawItem(ctx, it, zoom, alpha = 1) {
    const a = this.get(it.asset);
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot * DEG);
    ctx.globalAlpha = alpha;
    if (!a) {
      ctx.fillStyle = '#ff00c8';
      ctx.fillRect(-0.5, -0.5, 1, 1);
    } else if (a.radius * zoom < 2) {
      ctx.fillStyle = a.colors.main;
      ctx.fillRect(-a.size[0] / 2, -a.size[1] / 2, a.size[0], a.size[1]);
    } else {
      ctx.drawImage(this.texture(a.id), -a.size[0] / 2, -a.size[1] / 2, a.size[0], a.size[1]);
      ctx.beginPath();
      tracePath(ctx, a.outline);
      ctx.lineWidth = 1 / zoom;
      ctx.strokeStyle = 'rgba(10, 10, 16, 0.55)';
      ctx.stroke();
    }
    ctx.restore();
  }

  contains(it, x, y) {
    const a = this.get(it.asset);
    const l = rotate(x - it.x, y - it.y, -it.rot);
    if (!a || a.radius < 0.3) return Math.hypot(l.x, l.y) <= 0.3; // keep tiny pieces clickable
    return containsLocal(a.outline, l.x, l.y);
  }

  snaps(def) {
    return def.snaps.length ? def.snaps : [[0, 0]];
  }

  // Snap points of a placed item (or a ghost) in world metres.
  worldSnaps(it) {
    const a = this.get(it.asset);
    if (!a) return [{ x: it.x, y: it.y }];
    return this.snaps(a).map(([sx, sy]) => {
      const r = rotate(sx, sy, it.rot);
      return { x: it.x + r.x, y: it.y + r.y };
    });
  }
}
