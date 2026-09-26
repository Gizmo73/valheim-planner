import { load, save } from '../core/storage.js';
import { DEG, rotate } from '../core/geometry.js';
import { stableHash } from '../world/saveReader.js';
import { normalize, storable, toFileText, slugify } from './assetFile.js';
import { CATEGORIES } from './categories.js';
import { modifier, materialPasses, drawDetail, drawMarkings, shadeFaces } from './modifiers.js';
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

// Two layers: `base` (material and surface detail) and `markings` (arrows, badges), so scene
// lighting can shade the surface without dimming the markings. markings is null if there are none.
export function renderTexture(def, baked = true) {
  const [w, h] = def.size;
  const ppm = Math.min(MAX_PPM, MAX_TEXTURE_PX / Math.max(w, h));
  const W = Math.max(1, Math.round(w * ppm)), H = Math.max(1, Math.round(h * ppm));
  const layer = () => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    tracePath(ctx, def.outline, ppm, W / 2, H / 2);
    ctx.clip();
    return { canvas, ctx };
  };
  const { canvas: base, ctx } = layer();
  const mod = modifier(def.modifier);
  const shape = Array.isArray(def.shape) ? 'custom' : def.shape;
  def.runtimeError = null;
  for (const { area, flow } of materialPasses(mod, W, H)) {
    ctx.save();
    if (area) {
      ctx.beginPath();
      area.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.clip();
    }
    // Turn the material so its "down" runs along this face's slope.
    const quarter = Math.round(flow / 90) % 2 === 1;
    const [mw, mh] = quarter ? [H, W] : [W, H];
    ctx.translate(W / 2, H / 2);
    ctx.rotate(flow * DEG);
    ctx.translate(-mw / 2, -mh / 2);
    try {
      def.draw(ctx, mw, mh, { ...def.colors }, makeUtils(def.id, ppm, shape, def.size));
    } catch (err) {
      def.runtimeError = err.message;
      ctx.fillStyle = '#a33';
      ctx.fillRect(0, 0, mw, mh);
    }
    ctx.restore();
  }
  if (!mod) return { base, markings: null };
  drawDetail(mod, ctx, W, H, baked);
  const marks = layer();
  drawMarkings(mod, marks.ctx, W, H);
  return { base, markings: marks.canvas };
}

// Loads every asset file listed in library/index.json, then layers local edits (localStorage)
// on top. Edits stay local until pushed to the repo.
export class AssetLibrary {
  constructor(bus) {
    this.bus = bus;
    this.assets = new Map();
    this.baseline = new Map(); // id -> file text as served
    this._textures = new Map();
    this.bakedShadows = true;
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

  // Scene lighting replaces the fixed valley/hip shading, so textures are redrawn without it.
  setBakedShadows(on) {
    if (on === this.bakedShadows) return;
    this.bakedShadows = on;
    this._textures.clear();
    this.bus.emit('library:changed');
    this.bus.emit('render');
  }

  texture(id) {
    if (!this._textures.has(id)) this._textures.set(id, renderTexture(this.get(id), this.bakedShadows));
    return this._textures.get(id);
  }

  thumbnail(def, px) {
    const { base, markings } = def === this.get(def.id) ? this.texture(def.id) : renderTexture(def, this.bakedShadows);
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const k = Math.min(px * 0.86 / base.width, px * 0.86 / base.height);
    const ctx = c.getContext('2d');
    for (const layer of [base, markings]) if (layer) ctx.drawImage(layer, (px - base.width * k) / 2, (px - base.height * k) / 2, base.width * k, base.height * k);
    return c;
  }

  drawItem(ctx, it, zoom, alpha = 1, lighting = null) {
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
      const [w, h] = a.size;
      const { base, markings } = this.texture(a.id);
      ctx.drawImage(base, -w / 2, -h / 2, w, h);
      if (lighting?.settings.roofs) shadeFaces(modifier(a.modifier), ctx, a.size, it.rot, lighting);
      if (markings) ctx.drawImage(markings, -w / 2, -h / 2, w, h);
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
