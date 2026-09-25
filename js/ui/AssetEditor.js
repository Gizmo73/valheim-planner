import { h, button, openModal, toast } from './dom.js';
import { CATEGORIES, category, formFor, templateFor, isTemplate } from '../assets/categories.js';
import { MODIFIERS } from '../assets/modifiers.js';
import { SHAPES, outline, snapSets, defaultSnaps } from '../assets/shapes.js';
import { storable } from '../assets/assetFile.js';
import { renderTexture } from '../assets/AssetLibrary.js';
import { loadPieces, pieceByName, pieceFootprint, searchIds } from '../world/pieces.js';

const SHAPE_ICONS = { rect: 'square', triangle: 'triangle-right', octagon: 'octagon', circle: 'circle', custom: 'pentagon' };
const HIT_PX = 10;
const same = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
const r3 = n => Math.round(n * 1000) / 1000;

/**
 * New / edit asset. Steps follow the workflow: name, size, internal IDs, category, snap points,
 * modifier, colour, then the draw code with a live preview. Edits to existing assets save to
 * this browser as you go; "Push" in Settings commits them to the repo.
 */
export class AssetEditor {
  constructor({ bus, library }) {
    this.bus = bus;
    this.library = library;
    bus.on('asset:edit', id => this.open(id));
    bus.on('asset:new', prefill => this.open(null, prefill));
  }

  open(id, prefill = {}) {
    const existing = id && this.library.get(id);
    this.id = existing ? id : null;
    const cat = prefill.category || 'wood';
    const size = prefill.size || [2, 2];
    this.draft = existing ? structuredClone(storable(existing)) : {
      name: prefill.name || '',
      category: cat,
      ids: prefill.ids || [],
      size,
      shape: 'rect',
      snaps: defaultSnaps(outline('rect', size)),
      modifier: null,
      colors: { main: category(cat).color },
      drawSrc: templateFor(cat, formFor(cat, 'rect', size)),
    };
    this._tex = null;
    this._hover = null;
    loadPieces();
    const resize = new ResizeObserver(() => this._drawPreview());
    this.modal = openModal(this._layout(), { className: 'editor-modal', onClose: () => { resize.disconnect(); this.modal = null; } });
    this._syncAll();
    resize.observe(this.canvas);
    (existing ? this.code : this.nameInput).focus();
  }

  // --- state ---

  _def() {
    return this.library.draft(this.id || this.library.uniqueId(this.draft.name || 'new_asset'), this.draft);
  }

  _update(patch, { syncForm = true } = {}) {
    const before = this.draft;
    const next = { ...before, ...patch };
    const shapeChanged = patch.size || patch.shape;
    const defaults = (shape, size) => JSON.stringify(defaultSnaps(outline(shape, size)));
    if (shapeChanged && JSON.stringify(before.snaps) === defaults(before.shape, before.size)) {
      next.snaps = defaultSnaps(outline(next.shape, next.size));
    }
    if ((shapeChanged || patch.category) && isTemplate(before.drawSrc)) {
      next.drawSrc = templateFor(next.category, formFor(next.category, next.shape, next.size));
    }
    if (patch.category && before.colors.main === category(before.category).color) {
      next.colors = { ...next.colors, main: category(next.category).color };
    }
    this.draft = next;
    this._tex = null;
    if (this.id) {
      clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => this.library.save(this.id, this.draft), 150);
    }
    if (syncForm) this._syncAll();
    else this._syncPreview();
  }

  // --- layout ---

  _layout() {
    this.title = h('div', { class: 'ed-title' });
    this.path = h('div', { class: 'ed-path' });
    this.nameInput = h('input', { type: 'text', placeholder: 'e.g. Wood Floor 2x2', onInput: e => this._update({ name: e.target.value }, { syncForm: false }) });
    this.wInput = h('input', { type: 'number', min: 0.05, step: 0.05, onChange: () => this._setSize() });
    this.dInput = h('input', { type: 'number', min: 0.05, step: 0.05, onChange: () => this._setSize() });
    this.shapeSeg = h('div', { class: 'seg small' });
    this.customVerts = h('textarea', { class: 'verts', rows: 2, placeholder: 'x,y  x,y  x,y … (metres from centre)', onChange: e => this._setVerts(e.target.value) });
    this.idChips = h('div', { class: 'chips' });
    this.idResults = h('div', { class: 'id-results' });
    this.idInput = h('input', {
      type: 'text', placeholder: 'Search pieces, trees, rocks… Enter adds',
      onInput: () => this._searchIds(),
      onKeydown: e => { if (e.key === 'Enter') { e.preventDefault(); this._addId(this.idInput.value.trim()); } },
      onBlur: () => setTimeout(() => { this.idResults.hidden = true; }, 150),
    });
    this.catSelect = h('select', { onChange: e => this._update({ category: e.target.value }) }, CATEGORIES.map(c => h('option', { value: c.id }, c.label)));
    this.snapInfo = h('span', { class: 'field-value' });
    this.modSelect = h('select', { onChange: e => this._update({ modifier: e.target.value || null }) },
      h('option', { value: '' }, 'None'), MODIFIERS.map(m => h('option', { value: m.id }, m.label)));
    this.colours = h('div', { class: 'colours' });
    this.canvas = h('canvas', { class: 'ed-preview', onMousemove: e => this._hoverAt(e), onMouseleave: () => { this._hover = null; this._drawPreview(); }, onClick: () => this._toggleSnap() });
    this.code = h('textarea', { class: 'code', spellcheck: false, onInput: () => this._codeChanged(), onKeydown: e => this._codeKey(e) });
    this.error = h('div', { class: 'ed-error' });
    this.copyFrom = h('select', { class: 'copy-from', onChange: e => this._copyFrom(e.target.value) });

    const step = (n, label, ...body) => h('div', { class: 'ed-step' }, h('div', { class: 'ed-step-label' }, h('span', { class: 'n' }, n), label), ...body);
    const form = h('div', { class: 'ed-form' },
      step(1, 'Name', this.nameInput),
      step(2, 'Size',
        h('div', { class: 'dims' }, this.wInput, h('span', null, '×'), this.dInput, h('span', { class: 'unit' }, 'm')),
        h('div', { class: 'note' }, 'Width × depth seen from above. Forward (the way arrows point up) is the top edge.'),
        this.shapeSeg, this.customVerts),
      step(3, 'Internal IDs', this.idChips, h('div', { class: 'id-search' }, this.idInput, this.idResults),
        h('div', { class: 'note' }, 'Prefab names from the save. World imports place this asset wherever any of them appear.')),
      step(4, 'Category', h('div', { class: 'inline' }, this.catSelect,
        button('wand-sparkles', 'Default code', () => this._resetCode(), { class: 'chip', title: 'Replace the draw code with this category\'s default for this shape' }))),
      step(5, 'Snap points', h('div', { class: 'chips' },
        ...['corners', 'edges', 'centre', 'cardinals'].map(set => button(null, set, () => this._toggleSet(set), { class: 'chip', 'data-set': set })),
        button(null, 'clear', () => this._update({ snaps: [] }), { class: 'chip' })),
        h('div', { class: 'note' }, 'Click points on the preview to add or remove them. ', this.snapInfo)),
      step(6, 'Modifier', this.modSelect, h('div', { class: 'note' }, 'Overlay for direction: stairs, roof slope, corners, ridge.')),
      step(7, 'Colour', this.colours),
    );

    const codePane = h('div', { class: 'ed-code' },
      h('div', { class: 'ed-code-head' },
        h('span', { class: 'n' }, 8), h('code', null, 'draw(ctx, w, h, c, u)'), h('span', { class: 'spacer' }), this.copyFrom),
      h('div', { class: 'note' }, 'w, h: texture px · c.main: colour · u.ppm px per metre · u.rand() · u.range(a, b) · u.shade(hex, ±0–1) · u.mix(a, b, t) · u.rgba(hex, a) · u.shape · u.size'),
      this.code,
      this.error);

    this.footer = h('div', { class: 'ed-footer' });
    return h('div', { class: 'editor' },
      h('div', { class: 'ed-head' }, h('div', null, this.title, this.path), button('x', null, () => this.modal.close(), { class: 'icon-btn', title: 'Close (Esc)' })),
      h('div', { class: 'ed-body' }, form, h('div', { class: 'ed-right' }, this.canvas, codePane)),
      this.footer);
  }

  _syncAll() {
    const d = this.draft;
    this.nameInput.value = d.name;
    this.wInput.value = d.size[0];
    this.dInput.value = d.size[1];
    const shapeKey = Array.isArray(d.shape) ? 'custom' : d.shape;
    this.shapeSeg.replaceChildren(...[...SHAPES, 'custom'].map(s => button(SHAPE_ICONS[s], null, () => this._setShape(s), { class: `seg-btn${shapeKey === s ? ' active' : ''}`, title: s })));
    this.customVerts.hidden = shapeKey !== 'custom';
    if (Array.isArray(d.shape)) this.customVerts.value = d.shape.map(p => p.join(',')).join('  ');
    this.idChips.replaceChildren(...d.ids.map(id => h('span', { class: 'id-chip', title: pieceByName(id)?.en || '' }, id,
      button('x', null, () => this._update({ ids: d.ids.filter(x => x !== id) }), { class: 'chip-x', title: 'Remove' }))));
    this.catSelect.value = d.category;
    this.modSelect.value = d.modifier || '';
    this.colours.replaceChildren(...Object.entries(d.colors).map(([key, val]) => h('label', { class: 'colour' },
      h('input', { type: 'color', value: val, onInput: e => this._update({ colors: { ...this.draft.colors, [key]: e.target.value } }, { syncForm: false }) }),
      h('span', null, key), h('code', null, val))));
    if (this.code.value !== d.drawSrc) this.code.value = d.drawSrc;
    this.copyFrom.replaceChildren(h('option', { value: '' }, 'Copy drawing from…'),
      ...this.library.list().filter(a => a.id !== this.id).map(a => h('option', { value: a.id }, a.name)));
    this._syncPreview();
  }

  _syncPreview() {
    const d = this.draft;
    const def = this._def();
    this.title.textContent = d.name || 'New asset';
    this.path.textContent = `js/assets/library/${def.id}.js${this.id ? ` · ${this.library.status(this.id) || 'saved in repo'}` : ' · not created yet'}`;
    const sets = snapSets(def.outline);
    for (const chip of this.el().querySelectorAll('[data-set]')) {
      const pts = sets[chip.dataset.set];
      chip.hidden = !pts;
      chip.classList.toggle('active', !!pts && pts.every(p => d.snaps.some(s => same(s, p))));
    }
    this.snapInfo.textContent = `${d.snaps.length} active`;
    this.footer.replaceChildren(...[
      this.id && button('trash-2', 'Delete', () => this._delete(), { class: 'chip danger' }),
      this.id && this.library.status(this.id) && this.library.baseline.has(this.id) && button('undo-2', 'Revert to repo', () => this._revert(), { class: 'chip' }),
      h('span', { class: 'spacer' }),
      this.id ? button('check', 'Done', () => this.modal.close(), { class: 'chip accent' })
        : button('plus', 'Create asset', () => this._create(), { class: 'chip accent' }),
    ].filter(Boolean));
    this._drawPreview();
  }

  el() {
    return this.modal?.el || document;
  }

  // --- form handlers ---

  _setSize() {
    const w = parseFloat(this.wInput.value), d = parseFloat(this.dInput.value);
    if (w > 0 && d > 0) this._update({ size: [w, d] });
  }

  _setShape(s) {
    if (s !== 'custom') return this._update({ shape: s });
    const [w, d] = this.draft.size;
    this._update({ shape: outline('rect', [w, d]).poly });
  }

  _setVerts(text) {
    const pts = text.trim().split(/\s+/).map(p => p.split(',').map(Number)).filter(p => p.length === 2 && p.every(Number.isFinite));
    if (pts.length >= 3) this._update({ shape: pts });
    else toast('A custom shape needs at least three x,y points', 'error');
  }

  _searchIds() {
    const results = searchIds(this.idInput.value);
    this.idResults.replaceChildren(...results.map(r => h('button', { type: 'button', class: 'id-result', onMousedown: e => { e.preventDefault(); this._addId(r.id); } },
      h('span', null, r.id), h('span', { class: 'muted' }, r.label || ''))));
    this.idResults.hidden = !results.length;
  }

  _addId(id) {
    if (!id) return;
    this.idInput.value = '';
    this.idResults.hidden = true;
    const patch = { ids: [...new Set([...this.draft.ids, id])] };
    const piece = pieceByName(id);
    if (!this.id && piece && !this.draft.name) {
      patch.name = piece.en;
      const fp = pieceFootprint(piece);
      if (fp) patch.size = fp.map(r3);
    }
    this._update(patch);
  }

  _toggleSet(set) {
    const pts = snapSets(this._def().outline)[set] || [];
    const snaps = this.draft.snaps;
    const all = pts.every(p => snaps.some(s => same(s, p)));
    this._update({ snaps: all ? snaps.filter(s => !pts.some(p => same(s, p))) : [...snaps, ...pts.filter(p => !snaps.some(s => same(s, p)))] });
  }

  _resetCode() {
    const d = this.draft;
    this._update({ drawSrc: templateFor(d.category, formFor(d.category, Array.isArray(d.shape) ? 'custom' : d.shape, d.size)) });
  }

  _copyFrom(id) {
    const src = this.library.get(id);
    this.copyFrom.value = '';
    if (src) this._update({ drawSrc: src.drawSrc, colors: { ...src.colors }, modifier: this.draft.modifier ?? src.modifier });
  }

  _codeChanged() {
    clearTimeout(this._codeTimer);
    this._codeTimer = setTimeout(() => this._update({ drawSrc: this.code.value }, { syncForm: false }), 200);
  }

  _codeKey(e) {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const { selectionStart: s, selectionEnd: t, value } = this.code;
    this.code.value = value.slice(0, s) + '  ' + value.slice(t);
    this.code.selectionStart = this.code.selectionEnd = s + 2;
    this._codeChanged();
  }

  _create() {
    const d = this.draft;
    if (!d.name.trim()) return toast('Give the asset a name first', 'error');
    const id = this.library.uniqueId(d.name);
    this.library.save(id, d);
    toast(`Created ${d.name} — push from Settings to add it to the repo`);
    this.modal.close();
  }

  _delete() {
    if (!confirm(`Delete "${this.draft.name}"? Placed pieces using it will show as missing.`)) return;
    this.library.remove(this.id);
    this.modal.close();
  }

  async _revert() {
    clearTimeout(this._saveTimer);
    await this.library.revert(this.id);
    this.draft = structuredClone(storable(this.library.get(this.id)));
    this._tex = null;
    this._syncAll();
  }

  // --- preview ---

  _geometry() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const [w, d] = this.draft.size;
    const scale = Math.max(4, Math.min((r.width - 70) / w, (r.height - 70) / d));
    return { cw: r.width, ch: r.height, dpr, scale, ox: r.width / 2, oy: r.height / 2 };
  }

  _candidates(def) {
    return Object.values(snapSets(def.outline)).flat();
  }

  _hoverAt(e) {
    const g = this._geometry();
    const r = this.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const pts = [...this._candidates(this._def()), ...this.draft.snaps];
    this._hover = pts.find(([x, y]) => Math.hypot(g.ox + x * g.scale - mx, g.oy + y * g.scale - my) < HIT_PX) || null;
    this._drawPreview();
  }

  _toggleSnap() {
    const p = this._hover;
    if (!p) return;
    const snaps = this.draft.snaps;
    this._update({ snaps: snaps.some(s => same(s, p)) ? snaps.filter(s => !same(s, p)) : [...snaps, [r3(p[0]), r3(p[1])]] });
  }

  _drawPreview() {
    if (!this.modal) return;
    const def = this._def();
    this._tex ||= renderTexture(def);
    this.error.textContent = def.error || def.runtimeError || '';
    this.code.classList.toggle('errored', !!this.error.textContent);

    const g = this._geometry();
    const c = this.canvas;
    c.width = Math.round(g.cw * g.dpr);
    c.height = Math.round(g.ch * g.dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(g.dpr, 0, 0, g.dpr, 0, 0);
    ctx.clearRect(0, 0, g.cw, g.ch);

    ctx.strokeStyle = 'rgba(78, 227, 236, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = g.ox % g.scale; x < g.cw; x += g.scale) { ctx.moveTo(x, 0); ctx.lineTo(x, g.ch); }
    for (let y = g.oy % g.scale; y < g.ch; y += g.scale) { ctx.moveTo(0, y); ctx.lineTo(g.cw, y); }
    ctx.stroke();

    const [w, d] = def.size;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this._tex, g.ox - w / 2 * g.scale, g.oy - d / 2 * g.scale, w * g.scale, d * g.scale);
    ctx.strokeStyle = '#b5abfc';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (def.outline.ellipse) ctx.ellipse(g.ox, g.oy, def.outline.ellipse[0] * g.scale, def.outline.ellipse[1] * g.scale, 0, 0, Math.PI * 2);
    else def.outline.poly.forEach(([x, y], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, g.ox + x * g.scale, g.oy + y * g.scale));
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = 'rgba(181, 171, 252, 0.7)';
    ctx.font = '500 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▲ forward', g.ox, g.oy - d / 2 * g.scale - 10);

    const dot = ([x, y], r, fill) => {
      ctx.beginPath();
      ctx.arc(g.ox + x * g.scale, g.oy + y * g.scale, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
    };
    for (const p of this._candidates(def)) if (!this.draft.snaps.some(s => same(s, p))) dot(p, 4, 'rgba(233, 233, 237, 0.45)');
    const cands = this._candidates(def);
    for (const p of this.draft.snaps) dot(p, 5.5, cands.some(q => same(p, q)) ? '#ff6b6b' : '#f0b64e');
    if (this._hover) {
      dot(this._hover, 7, 'rgba(245, 213, 71, 0.35)');
      ctx.fillStyle = '#f5d547';
      ctx.textAlign = 'left';
      ctx.fillText(`${r3(this._hover[0])}, ${r3(this._hover[1])} m`, g.ox + this._hover[0] * g.scale + 10, g.oy + this._hover[1] * g.scale - 8);
    }
  }
}
