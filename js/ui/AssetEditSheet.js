import { getVariant, updateVariant, resetVariantToFileData, isVariantDirty, getCategoryModule, previewCategoryModule, commitCategoryModule } from '../assets/AssetRegistry.js';
import { renderVariantTexture, renderThumbnail } from '../assets/textureCache.js';
import { fetchCategorySource, replaceMetaBlock, downloadText, evalCategoryModule } from '../assets/categorySource.js';
import { snapCandidates, isCircle, boundsOf } from '../assets/shapes.js';
import { refreshIcons } from './icons.js';
import { getAllPieces, loadPieceLookup } from '../save/pieceLookup.js';

const SHAPE_OPTIONS = [
  { kind: 'rect', label: 'Rectangular', icon: 'square' },
  { kind: 'triangle', label: 'Triangular', icon: 'triangle' },
  { kind: 'octagon', label: 'Octagonal', icon: 'octagon' },
  { kind: 'circle', label: 'Circular', icon: 'circle' },
];

const STALE_TOLERANCE_M = 0.05;
const HIT_RADIUS_PX = 12;

function fmt(n) {
  return Math.round(n * 100) / 100;
}

function pointsClose(a, b) {
  return Math.abs(a.x - b.x) < STALE_TOLERANCE_M && Math.abs(a.y - b.y) < STALE_TOLERANCE_M;
}

export class AssetEditSheet {
  constructor(bus) {
    this.bus = bus;
    this._el = document.getElementById('asset-edit-modal');
    this._type = null;
    this._categoryId = null;
    this._tab = 'attributes';
    this._hover = null;
  }

  open(type) {
    const found = getVariant(type);
    if (!found) return;
    this._type = type;
    this._categoryId = found.catId;
    this._tab = 'attributes';
    this._hover = null;
    this._el.classList.remove('hidden');
    this._render();
  }

  async close() {
    const state = this._sourceState;
    if (state && !state.committed && state.text != null && state.original != null && state.text !== state.original) {
      // An edited-but-unsaved Source preview is live in the whole app
      // (map render, thumbnails everywhere) — put the real file back.
      const result = await evalCategoryModule(state.original);
      if (result.ok) previewCategoryModule(state.categoryId, result.module);
      this.bus.emit('render:request');
    }
    this._sourceState = null;
    this._el.classList.add('hidden');
    this._el.innerHTML = '';
  }

  _variant() {
    const found = getVariant(this._type);
    return found ? found.variant : null;
  }

  _shape() {
    const mod = getCategoryModule(this._categoryId);
    return mod ? mod.shape(this._type) : null;
  }

  _touch(patch) {
    updateVariant(this._categoryId, this._type, patch);
    this.bus.emit('render:request');
    this.bus.emit('library:changed');
    this._render();
  }

  _render() {
    const v = this._variant();
    if (!v) { this.close(); return; }
    const mod = getCategoryModule(this._categoryId);
    const dirty = isVariantDirty(this._categoryId, this._type);

    this._el.innerHTML = '';
    const backdrop = document.createElement('div');
    backdrop.className = 'edit-sheet-backdrop';
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) this.close(); });

    const sheet = document.createElement('div');
    sheet.className = 'edit-sheet';

    const left = document.createElement('div');
    left.className = 'edit-sheet-left';

    const header = document.createElement('div');
    header.className = 'edit-sheet-header';
    const titleRow = document.createElement('div');
    titleRow.className = 'edit-sheet-title-row';
    const name = document.createElement('div');
    name.className = 'edit-sheet-name';
    name.textContent = v.label;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'edit-sheet-close';
    closeBtn.innerHTML = '<i data-lucide="x"></i>';
    closeBtn.addEventListener('click', () => this.close());
    titleRow.appendChild(name);
    if (dirty) {
      const badge = document.createElement('span');
      badge.className = 'edit-dirty-badge';
      badge.textContent = 'unsaved';
      titleRow.appendChild(badge);
    }
    titleRow.appendChild(closeBtn);
    const path = document.createElement('div');
    path.className = 'edit-sheet-path';
    path.textContent = `assets/categories/${this._categoryId}.js · ${v.id}`;
    header.appendChild(titleRow);
    header.appendChild(path);

    const tabs = document.createElement('div');
    tabs.className = 'edit-tabs';
    for (const [key, label] of [['attributes', 'Attributes'], ['shape', 'Shape & snap'], ['source', 'Source']]) {
      const b = document.createElement('button');
      b.className = 'edit-tab' + (this._tab === key ? ' active' : '');
      b.textContent = label;
      b.addEventListener('click', () => { this._tab = key; this._render(); });
      tabs.appendChild(b);
    }

    const body = document.createElement('div');
    body.className = 'edit-tab-content';
    if (this._tab === 'attributes') this._renderAttributes(body, v, mod);
    else if (this._tab === 'shape') this._renderShapeSnap(body, v);
    else this._renderSource(body);

    left.appendChild(header);
    left.appendChild(tabs);
    left.appendChild(body);

    if (this._tab !== 'source') {
      const footer = document.createElement('div');
      footer.className = 'edit-footer';
      const resetBtn = document.createElement('button');
      resetBtn.textContent = 'Reset to file data';
      resetBtn.disabled = !dirty;
      resetBtn.addEventListener('click', () => {
        resetVariantToFileData(this._categoryId, this._type);
        this.bus.emit('render:request');
        this.bus.emit('library:changed');
        this._render();
      });
      const saveBtn = document.createElement('button');
      saveBtn.className = 'primary';
      saveBtn.textContent = 'Save to file';
      saveBtn.addEventListener('click', () => this._saveToFile());
      footer.appendChild(resetBtn);
      footer.appendChild(saveBtn);
      left.appendChild(footer);
    }

    const right = document.createElement('div');
    right.className = 'edit-sheet-right';

    sheet.appendChild(left);
    sheet.appendChild(right);
    backdrop.appendChild(sheet);
    this._el.appendChild(backdrop);

    // Built after the DOM is attached: the canvas needs a real layout box
    // (getBoundingClientRect) before its first draw.
    this._renderCanvasColumn(right, v);
    refreshIcons();
  }

  _renderAttributes(body, v, mod) {
    const nameField = document.createElement('div');
    const nameLabel = document.createElement('label');
    nameLabel.className = 'edit-field-label';
    nameLabel.textContent = 'Name';
    const nameInput = document.createElement('input');
    nameInput.className = 'edit-input';
    nameInput.type = 'text';
    nameInput.value = v.label;
    nameInput.addEventListener('change', () => {
      const val = nameInput.value.trim();
      if (val) this._touch({ label: val });
    });
    nameField.appendChild(nameLabel);
    nameField.appendChild(nameInput);
    const note = document.createElement('div');
    note.className = 'edit-input-note';
    note.textContent = `From file: ${v.id}`;
    nameField.appendChild(note);

    const dimsField = document.createElement('div');
    const dimsLabel = document.createElement('label');
    dimsLabel.className = 'edit-field-label';
    dimsLabel.textContent = 'Dimensions — always metres';
    const dimsRow = document.createElement('div');
    dimsRow.className = 'edit-dims-row';
    const wInput = document.createElement('input');
    wInput.className = 'edit-dim-input';
    wInput.type = 'number';
    wInput.step = '0.1';
    wInput.min = '0.1';
    wInput.value = v.widthM;
    const xSep = document.createElement('span');
    xSep.className = 'edit-dims-x';
    xSep.textContent = '×';
    const hInput = document.createElement('input');
    hInput.className = 'edit-dim-input';
    hInput.type = 'number';
    hInput.step = '0.1';
    hInput.min = '0.1';
    hInput.value = v.heightM;
    const unit = document.createElement('span');
    unit.className = 'edit-dims-unit';
    unit.textContent = 'm';
    const commitDims = () => {
      const w = parseFloat(wInput.value), h = parseFloat(hInput.value);
      if (w > 0 && h > 0) this._touch({ widthM: w, heightM: h });
    };
    wInput.addEventListener('change', commitDims);
    hInput.addEventListener('change', commitDims);
    dimsRow.appendChild(wInput);
    dimsRow.appendChild(xSep);
    dimsRow.appendChild(hInput);
    dimsRow.appendChild(unit);
    dimsField.appendChild(dimsLabel);
    dimsField.appendChild(dimsRow);
    const dimsNote = document.createElement('div');
    dimsNote.className = 'edit-input-note';
    dimsNote.textContent = 'Assets are always metres. Tiles are a calibration convenience only.';
    dimsField.appendChild(dimsNote);

    const shapeField = document.createElement('div');
    const shapeLabel = document.createElement('label');
    shapeLabel.className = 'edit-field-label';
    shapeLabel.textContent = 'Shape';
    const grid = document.createElement('div');
    grid.className = 'shape-grid';
    for (const opt of SHAPE_OPTIONS) {
      const b = document.createElement('button');
      b.className = 'shape-btn' + (v.shapeKind === opt.kind && !v.customVerts ? ' active' : '');
      b.innerHTML = `<i data-lucide="${opt.icon}"></i><span>${opt.label}</span>`;
      b.addEventListener('click', () => this._touch({ shapeKind: opt.kind, customVerts: null }));
      grid.appendChild(b);
    }
    const polyBtn = document.createElement('button');
    polyBtn.className = 'shape-btn full' + (v.customVerts ? ' active' : '');
    const vertCount = v.customVerts ? v.customVerts.length : (mod.shape(v.id) && !isCircle(mod.shape(v.id)) ? mod.shape(v.id).length : 0);
    polyBtn.innerHTML = `<i data-lucide="code-2"></i><span>Polygon from source${v.customVerts ? ` · ${vertCount} vertices` : ''}</span>`;
    polyBtn.disabled = !v.customVerts;
    grid.appendChild(polyBtn);
    shapeField.appendChild(shapeLabel);
    shapeField.appendChild(grid);
    if (!v.customVerts) {
      const shapeNote = document.createElement('div');
      shapeNote.className = 'edit-input-note';
      shapeNote.textContent = 'A custom polygon can only be authored from the Source tab.';
      shapeField.appendChild(shapeNote);
    }

    const idField = document.createElement('div');
    idField.className = 'edit-internal-id-field';
    const idLabel = document.createElement('label');
    idLabel.className = 'edit-field-label';
    idLabel.textContent = 'Internal ID';
    idField.appendChild(idLabel);

    const idWrap = document.createElement('div');
    idWrap.className = 'edit-internal-id-wrap';
    const idInput = document.createElement('input');
    idInput.className = 'edit-input';
    idInput.type = 'text';
    idInput.placeholder = 'Search Valheim pieces...';
    idInput.value = v.internalId || '';
    const idDropdown = document.createElement('div');
    idDropdown.className = 'edit-id-dropdown hidden';
    idWrap.appendChild(idInput);
    idWrap.appendChild(idDropdown);
    idField.appendChild(idWrap);

    if (v.internalId) {
      const idNote = document.createElement('div');
      idNote.className = 'edit-input-note';
      const allPieces = getAllPieces();
      const match = allPieces.find(p => p.name === v.internalId);
      idNote.textContent = match ? `${match.en} · ${match.material || 'no material'} · ${match.category || 'uncategorized'}` : 'No match in piece table';
      const clearBtn = document.createElement('button');
      clearBtn.className = 'edit-id-clear';
      clearBtn.textContent = 'Clear';
      clearBtn.addEventListener('click', () => {
        this._touch({ internalId: null });
      });
      idNote.appendChild(clearBtn);
      idField.appendChild(idNote);
    }

    const showResults = (query) => {
      const allPieces = getAllPieces();
      if (!allPieces.length || !query) { idDropdown.classList.add('hidden'); return; }
      const q = query.toLowerCase();
      const matches = allPieces
        .filter(p => p.name.toLowerCase().includes(q) || (p.en && p.en.toLowerCase().includes(q)))
        .slice(0, 12);
      if (!matches.length) { idDropdown.classList.add('hidden'); return; }
      idDropdown.innerHTML = '';
      for (const p of matches) {
        const opt = document.createElement('div');
        opt.className = 'edit-id-option';
        opt.innerHTML = `<span class="edit-id-name">${p.name}</span><span class="edit-id-en">${p.en || ''}</span>`;
        opt.addEventListener('mousedown', (e) => {
          e.preventDefault();
          this._touch({ internalId: p.name });
        });
        idDropdown.appendChild(opt);
      }
      idDropdown.classList.remove('hidden');
    };

    idInput.addEventListener('input', () => showResults(idInput.value));
    idInput.addEventListener('focus', () => { if (idInput.value) showResults(idInput.value); });
    idInput.addEventListener('blur', () => { setTimeout(() => idDropdown.classList.add('hidden'), 150); });

    loadPieceLookup().catch(() => {});

    body.appendChild(nameField);
    body.appendChild(idField);
    body.appendChild(dimsField);
    body.appendChild(shapeField);
  }

  _snapGroups(shapeResult) {
    const cand = snapCandidates(shapeResult);
    const groups = [];
    if (isCircle(shapeResult)) {
      groups.push({ key: 'centre', label: 'Centre', points: [cand.centroid] });
      groups.push({ key: 'cardinals', label: '4 cardinal points', points: cand.cardinals });
    } else {
      groups.push({ key: 'vertices', label: `${cand.vertices.length} vertices`, points: cand.vertices });
      groups.push({ key: 'edgeMids', label: `${cand.edgeMids.length} edge centres`, points: cand.edgeMids });
      groups.push({ key: 'centre', label: 'Centre', points: [cand.centroid] });
    }
    return groups;
  }

  _renderShapeSnap(body, v) {
    const shapeResult = this._shape();
    const groups = this._snapGroups(shapeResult);
    const active = v.snapPoints || [];

    const setField = document.createElement('div');
    const setLabel = document.createElement('label');
    setLabel.className = 'edit-field-label';
    setLabel.textContent = 'Add a set';
    const setRow = document.createElement('div');
    setRow.className = 'snap-set-row';
    for (const g of groups) {
      const allActive = g.points.length > 0 && g.points.every(p => active.some(a => pointsClose(a, p)));
      const chip = document.createElement('button');
      chip.className = 'snap-chip' + (allActive ? ' active' : '');
      chip.textContent = g.label;
      chip.addEventListener('click', () => {
        let next;
        if (allActive) {
          next = active.filter(a => !g.points.some(p => pointsClose(a, p)));
        } else {
          next = [...active];
          for (const p of g.points) {
            if (!next.some(a => pointsClose(a, p))) next.push({ x: fmt(p.x), y: fmt(p.y) });
          }
        }
        this._touch({ snapPoints: next });
      });
      setRow.appendChild(chip);
    }
    setField.appendChild(setLabel);
    setField.appendChild(setRow);

    const listField = document.createElement('div');
    listField.className = 'snap-list';
    const listHeader = document.createElement('div');
    listHeader.className = 'snap-list-header';
    listHeader.innerHTML = `<span>Snap points</span>`;
    const count = document.createElement('span');
    count.className = 'snap-list-count';
    count.textContent = String(active.length);
    listHeader.appendChild(count);
    listField.appendChild(listHeader);

    const allCandidates = this._allCandidatePoints(shapeResult);
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const stale = !allCandidates.some(c => pointsClose(c, p));
      const row = document.createElement('div');
      row.className = 'snap-row' + (stale ? ' stale' : '');
      const dot = document.createElement('span');
      dot.className = 'dot';
      const label = document.createElement('span');
      label.textContent = stale ? 'Off outline' : 'Snap point';
      if (stale) label.className = 'stale-note';
      const offset = document.createElement('span');
      offset.className = 'offset';
      offset.textContent = `${fmt(p.x)}, ${fmt(p.y)} m`;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'snap-row-remove';
      removeBtn.innerHTML = '<i data-lucide="x"></i>';
      removeBtn.addEventListener('click', () => {
        const next = active.filter((_, idx) => idx !== i);
        this._touch({ snapPoints: next });
      });
      row.appendChild(dot);
      row.appendChild(label);
      row.appendChild(offset);
      row.appendChild(removeBtn);
      listField.appendChild(row);
    }

    body.appendChild(setField);
    body.appendChild(listField);
  }

  async _renderSource(body) {
    const categoryId = this._categoryId;
    if (!this._sourceState || this._sourceState.categoryId !== categoryId) {
      this._sourceState = { categoryId, text: null, original: null, error: null };
    }
    const state = this._sourceState;
    body.style.minHeight = '0';

    const toolbar = document.createElement('div');
    toolbar.className = 'source-toolbar';
    const badge = document.createElement('span');
    badge.className = 'edit-dirty-badge';
    badge.textContent = 'unsaved';
    badge.style.display = 'none';
    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    const revertBtn = document.createElement('button');
    revertBtn.textContent = 'Revert';
    const runBtn = document.createElement('button');
    runBtn.className = 'primary';
    runBtn.textContent = 'Run & save';
    toolbar.appendChild(badge);
    toolbar.appendChild(spacer);
    toolbar.appendChild(revertBtn);
    toolbar.appendChild(runBtn);

    const errorBanner = document.createElement('div');
    errorBanner.className = 'source-error';

    const textarea = document.createElement('textarea');
    textarea.className = 'source-editor';
    textarea.spellcheck = false;

    const thumbSection = document.createElement('div');
    thumbSection.className = 'source-thumb-section';
    const thumbTitle = document.createElement('div');
    thumbTitle.className = 'source-thumb-title';
    thumbTitle.textContent = 'Live thumbnails · redrawn on every keystroke';
    const thumbGrid = document.createElement('div');
    thumbGrid.className = 'source-thumb-grid';
    thumbSection.appendChild(thumbTitle);
    thumbSection.appendChild(thumbGrid);

    body.appendChild(toolbar);
    body.appendChild(errorBanner);
    body.appendChild(textarea);
    body.appendChild(thumbSection);

    const redrawThumbs = () => {
      const mod = getCategoryModule(categoryId);
      thumbGrid.innerHTML = '';
      if (!mod) return;
      for (const v of mod.meta.variants) {
        const item = document.createElement('div');
        item.className = 'source-thumb-item';
        const c = document.createElement('canvas');
        const dpr = window.devicePixelRatio || 1;
        const size = Math.round(56 * dpr);
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        ctx.drawImage(renderThumbnail(categoryId, v.id, v.widthM, v.heightM, size), 0, 0, size, size);
        const label = document.createElement('span');
        label.textContent = v.label;
        item.appendChild(c);
        item.appendChild(label);
        thumbGrid.appendChild(item);
      }
    };

    const setBadge = (dirty) => { badge.style.display = dirty ? '' : 'none'; };

    let debounceTimer = null;
    const applyText = async (text, { commit = false } = {}) => {
      const result = await evalCategoryModule(text);
      if (result.ok) {
        errorBanner.classList.remove('visible');
        textarea.classList.remove('errored');
        if (commit) commitCategoryModule(categoryId, result.module);
        else previewCategoryModule(categoryId, result.module);
        this.bus.emit('render:request');
        this.bus.emit('library:changed');
        redrawThumbs();
      } else {
        errorBanner.textContent = result.error;
        errorBanner.classList.add('visible');
        textarea.classList.add('errored');
        // Keep the last good module active — do not swap in a broken one.
      }
      setBadge(text !== state.original);
      return result;
    };

    textarea.addEventListener('input', () => {
      state.text = textarea.value;
      setBadge(state.text !== state.original);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => applyText(state.text), 150);
    });

    revertBtn.addEventListener('click', async () => {
      state.text = state.original;
      textarea.value = state.text;
      await applyText(state.text);
    });

    runBtn.addEventListener('click', async () => {
      const result = await applyText(state.text, { commit: true });
      if (result.ok) {
        state.committed = true;
        state.original = state.text;
        setBadge(false);
        downloadText(`${categoryId}.js`, state.text);
      }
    });

    if (state.text == null) {
      const original = await fetchCategorySource(categoryId);
      state.original = original;
      state.text = original;
    }
    textarea.value = state.text || '';
    setBadge(state.text !== state.original);
    redrawThumbs();
  }

  _allCandidatePoints(shapeResult) {
    const cand = snapCandidates(shapeResult);
    if (isCircle(shapeResult)) return [cand.centroid, ...cand.cardinals];
    return [...cand.vertices, ...cand.edgeMids, cand.centroid];
  }

  _renderCanvasColumn(right, v) {
    const wrap = document.createElement('div');
    wrap.className = 'edit-canvas-wrap';
    const canvas = document.createElement('canvas');
    const tooltip = document.createElement('div');
    tooltip.className = 'edit-canvas-tooltip hidden';
    wrap.appendChild(canvas);
    wrap.appendChild(tooltip);

    const showCanvas = this._tab !== 'source';
    if (!showCanvas) {
      right.appendChild(wrap);
      return;
    }

    const legend = document.createElement('div');
    legend.className = 'edit-canvas-legend';
    legend.innerHTML = `
      <div class="edit-legend">
        <span><span class="dot" style="background:#ff6b6b"></span>Active</span>
        <span><span class="dot" style="background:rgba(233,233,237,.45)"></span>Available</span>
        <span><span class="dot" style="background:#f5d547"></span>Hovered</span>
        <span>Left click adds · double click removes · coordinates in metres from the asset origin</span>
      </div>`;

    right.appendChild(wrap);
    right.appendChild(legend);

    this._wireCanvas(canvas, tooltip, v);
  }

  _geometry(canvas, shapeResult) {
    const rect0 = canvas.getBoundingClientRect();
    const w = Math.max(1, rect0.width), h = Math.max(1, rect0.height);
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const b = boundsOf(shapeResult);
    const bw = Math.max(b.maxX - b.minX, 0.2), bh = Math.max(b.maxY - b.minY, 0.2);
    const margin = 48;
    // Hard floor: a zero/negative scale (e.g. the canvas measured before
    // layout) would turn the grid-line loops below into infinite loops.
    const scale = Math.max(4, Math.min((w - margin * 2) / bw, (h - margin * 2) / bh));
    const originX = w / 2 - (b.minX + b.maxX) / 2 * scale;
    const originY = h / 2 - (b.minY + b.maxY) / 2 * scale;
    return { w, h, dpr, scale, originX, originY };
  }

  _wireCanvas(canvas, tooltip, initialVariant) {
    const draw = () => {
      const v = this._variant();
      if (!v) return;
      const shapeResult = this._shape();
      const geo = this._geometry(canvas, shapeResult);
      const ctx = canvas.getContext('2d');
      ctx.setTransform(geo.dpr, 0, 0, geo.dpr, 0, 0);
      ctx.clearRect(0, 0, geo.w, geo.h);

      // Reference grid
      ctx.strokeStyle = 'rgba(78,227,236,0.12)';
      ctx.lineWidth = 1;
      const gridStep = geo.scale;
      for (let x = geo.originX % gridStep; x < geo.w; x += gridStep) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, geo.h); ctx.stroke();
      }
      for (let y = geo.originY % gridStep; y < geo.h; y += gridStep) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(geo.w, y); ctx.stroke();
      }

      // Shape fill (real texture) + outline
      const b = boundsOf(shapeResult);
      const px = geo.originX + b.minX * geo.scale, py = geo.originY + b.minY * geo.scale;
      const pw = (b.maxX - b.minX) * geo.scale, ph = (b.maxY - b.minY) * geo.scale;
      const tex = renderVariantTexture(this._categoryId, v.id, v.widthM, v.heightM);
      ctx.save();
      ctx.beginPath();
      this._traceShapePath(ctx, shapeResult, geo);
      ctx.clip();
      if (tex) ctx.drawImage(tex, px, py, pw, ph);
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = '#b5abfc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      this._traceShapePath(ctx, shapeResult, geo);
      ctx.stroke();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(181,171,252,0.5)';
      ctx.beginPath();
      ctx.moveTo(geo.originX, 0); ctx.lineTo(geo.originX, geo.h);
      ctx.moveTo(0, geo.originY); ctx.lineTo(geo.w, geo.originY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      const active = v.snapPoints || [];
      const candidates = this._allCandidatePoints(shapeResult);
      for (const c of candidates) {
        const isActive = active.some(a => pointsClose(a, c));
        if (isActive) continue;
        const sx = geo.originX + c.x * geo.scale, sy = geo.originY + c.y * geo.scale;
        const isHover = this._hover && pointsClose(this._hover, c);
        ctx.beginPath();
        ctx.arc(sx, sy, isHover ? 6.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = isHover ? '#f5d547' : 'rgba(233,233,237,0.45)';
        if (isHover) {
          ctx.save();
          ctx.shadowColor = 'rgba(0,0,0,.85)';
          ctx.shadowBlur = 0;
          ctx.lineWidth = 3;
          ctx.strokeStyle = 'rgba(245,213,71,.28)';
          ctx.stroke();
          ctx.restore();
        }
        ctx.fill();
      }
      for (const p of active) {
        const sx = geo.originX + p.x * geo.scale, sy = geo.originY + p.y * geo.scale;
        ctx.beginPath();
        ctx.arc(sx, sy, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(22,24,38,.85)';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6b6b';
        ctx.fill();
      }

      if (this._hover) {
        const sx = geo.originX + this._hover.x * geo.scale, sy = geo.originY + this._hover.y * geo.scale;
        tooltip.classList.remove('hidden');
        tooltip.style.left = `${sx}px`;
        tooltip.style.top = `${sy}px`;
        tooltip.textContent = `${fmt(this._hover.x)}, ${fmt(this._hover.y)} m`;
      } else {
        tooltip.classList.add('hidden');
      }
    };

    const findNear = (mx, my) => {
      const v = this._variant();
      const shapeResult = this._shape();
      const geo = this._geometry(canvas, shapeResult);
      const candidates = this._allCandidatePoints(shapeResult);
      let best = null, bestD = HIT_RADIUS_PX;
      for (const c of candidates) {
        const sx = geo.originX + c.x * geo.scale, sy = geo.originY + c.y * geo.scale;
        const d = Math.hypot(sx - mx, sy - my);
        if (d < bestD) { bestD = d; best = c; }
      }
      const active = v.snapPoints || [];
      for (const p of active) {
        const sx = geo.originX + p.x * geo.scale, sy = geo.originY + p.y * geo.scale;
        const d = Math.hypot(sx - mx, sy - my);
        if (d < bestD) { bestD = d; best = p; }
      }
      return best;
    };

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this._hover = findNear(e.clientX - r.left, e.clientY - r.top);
      draw();
    });
    canvas.addEventListener('mouseleave', () => { this._hover = null; draw(); });
    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      const near = findNear(e.clientX - r.left, e.clientY - r.top);
      if (!near) return;
      const v = this._variant();
      const active = v.snapPoints || [];
      if (active.some(a => pointsClose(a, near))) return;
      this._touch({ snapPoints: [...active, { x: fmt(near.x), y: fmt(near.y) }] });
    });
    canvas.addEventListener('dblclick', (e) => {
      const r = canvas.getBoundingClientRect();
      const near = findNear(e.clientX - r.left, e.clientY - r.top);
      if (!near) return;
      const v = this._variant();
      const active = v.snapPoints || [];
      if (!active.some(a => pointsClose(a, near))) return;
      this._touch({ snapPoints: active.filter(a => !pointsClose(a, near)) });
    });

    this._redrawCanvas = draw;
    draw();
    if (!this._resizeObserver) {
      this._resizeObserver = new ResizeObserver(() => { if (this._redrawCanvas) this._redrawCanvas(); });
    }
    this._resizeObserver.observe(canvas);
    void initialVariant;
  }

  _traceShapePath(ctx, shapeResult, geo) {
    if (isCircle(shapeResult)) {
      ctx.moveTo(geo.originX + shapeResult.r * geo.scale, geo.originY);
      ctx.arc(geo.originX, geo.originY, shapeResult.r * geo.scale, 0, Math.PI * 2);
    } else {
      shapeResult.forEach((p, i) => {
        const sx = geo.originX + p.x * geo.scale, sy = geo.originY + p.y * geo.scale;
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      });
      ctx.closePath();
    }
  }

  async _saveToFile() {
    const mod = getCategoryModule(this._categoryId);
    const sourceText = await fetchCategorySource(this._categoryId);
    if (!sourceText) return;
    const newText = replaceMetaBlock(sourceText, mod.meta);
    downloadText(`${this._categoryId}.js`, newText);
  }
}
