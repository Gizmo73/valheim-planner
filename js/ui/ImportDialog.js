import { h, icon, button, field, toggle, openModal, pickFiles, toast } from './dom.js';
import { load, save } from '../core/storage.js';
import { readSave } from '../world/saveReader.js';
import { loadPieces, pieceByName, pieceFootprint } from '../world/pieces.js';
import { analyseImport, applyImport, signTexts } from '../world/importWorld.js';

function guessCategory(piece) {
  const n = piece?.name || '';
  if (n.startsWith('darkwood_roof')) return 'shingle';
  if (n.startsWith('wood_roof')) return 'thatch';
  if (n.includes('darkwood')) return 'darkwood';
  return { Wood: 'wood', HardWood: 'wood', Timberwood: 'wood', Stone: 'stone', Marble: 'marble', Ashstone: 'grausten' }[piece?.material] || 'other';
}

async function expandZips(files) {
  const out = [];
  for (const f of files) {
    if (!f.name.toLowerCase().endsWith('.zip')) {
      out.push(f);
      continue;
    }
    if (!window.JSZip) throw new Error('Zip support failed to load — pick the files directly instead.');
    const zip = await window.JSZip.loadAsync(f);
    zip.forEach((path, entry) => {
      if (!entry.dir) out.push({ name: path.split('/').pop(), arrayBuffer: () => entry.async('arraybuffer') });
    });
  }
  return out;
}

// Import a world save: pick the files, name the anchor sign, check the summary, import.
export class ImportDialog {
  constructor(env) {
    this.env = env;
    env.bus.on('import:open', () => this.open());
    env.bus.on('library:changed', () => { if (this.modal && this.save) this._analyse(); });
  }

  open() {
    this.save = null;
    this.result = null;
    this.opts = { anchorText: 'BLUEPRINT', radius: 60, levelStep: 2, trees: true, terrain: true, ...load('importOptions', {}) };
    this.status = h('p', { class: 'import-status' }, 'Drop a .zip of the world folder here, or every file in it.');
    this.drop = h('div', { class: 'drop-zone' },
      icon('folder-input'),
      this.status,
      h('div', { class: 'row-buttons' },
        button('files', 'Choose files', async () => this._load(await pickFiles({ multiple: true })), { class: 'chip accent' }),
        button('folder-open', 'Choose folder', async () => this._load(await pickFiles({ directory: true })), { class: 'chip' })),
      h('p', { class: 'note' }, 'Worlds live in %USERPROFILE%\\AppData\\LocalLow\\IronGate\\Valheim\\worlds_local'));
    this.drop.addEventListener('dragover', e => { e.preventDefault(); this.drop.classList.add('over'); });
    this.drop.addEventListener('dragleave', () => this.drop.classList.remove('over'));
    this.drop.addEventListener('drop', e => {
      e.preventDefault();
      this.drop.classList.remove('over');
      this._load([...e.dataTransfer.files]);
    });

    const opt = (key, parse = v => v) => e => { this.opts[key] = parse(e.target.value); this._analyse(); };
    this.anchor = h('input', { type: 'text', value: this.opts.anchorText, onInput: opt('anchorText') });
    this.signs = h('div', { class: 'chips' });
    this.summary = h('div', { class: 'import-summary' });
    this.importBtn = button('download', 'Import', () => this._import(), { class: 'chip accent', disabled: true });

    this.modal = openModal(h('div', { class: 'import' },
      h('div', { class: 'ed-head' }, h('div', { class: 'ed-title' }, 'Import world save'), button('x', null, () => this.modal.close(), { class: 'icon-btn' })),
      this.drop,
      h('div', { class: 'import-options' },
        field('Anchor sign text', this.anchor, this.signs),
        h('div', { class: 'inline' },
          field('Radius (m)', h('input', { type: 'number', min: 5, max: 500, step: 5, value: this.opts.radius, onChange: opt('radius', Number) })),
          field('New layer every (m, 0 = one)', h('input', { type: 'number', min: 0, max: 20, step: 0.5, value: this.opts.levelStep, onChange: opt('levelStep', Number) }))),
        h('div', { class: 'inline' },
          h('label', { class: 'field-row' }, toggle(this.opts.trees, v => { this.opts.trees = v; this._analyse(); }), 'Trees'),
          h('label', { class: 'field-row' }, toggle(this.opts.terrain, v => { this.opts.terrain = v; this._analyse(); }), 'Terrain from vegetation'))),
      this.summary,
      h('div', { class: 'ed-footer' }, h('span', { class: 'spacer' }), button(null, 'Cancel', () => this.modal.close(), { class: 'chip' }), this.importBtn),
    ), { className: 'import-modal', onClose: () => { this.modal = null; } });
  }

  async _load(files) {
    if (!files?.length) return;
    try {
      this.status.classList.remove('error');
      this.status.textContent = 'Reading…';
      const [expanded] = await Promise.all([expandZips(files), loadPieces()]);
      this.save = await readSave(expanded, msg => { this.status.textContent = msg; });
      this.status.textContent = `Read ${this.save.chunkCount} chunks · ${this.save.zdos.length.toLocaleString()} objects · ${this.save.signs.length} signs`;
      this.signs.replaceChildren(...signTexts(this.save).slice(0, 30).map(t =>
        button(null, t, () => { this.anchor.value = this.opts.anchorText = t; this._analyse(); }, { class: 'chip small' })));
      this._analyse();
    } catch (err) {
      console.error(err);
      this.save = null;
      this.status.textContent = err.message;
      this.status.classList.add('error');
    }
  }

  _analyse() {
    if (!this.save) return;
    save('importOptions', this.opts);
    const r = this.result = analyseImport(this.save, this.opts, this.env.library);
    this.importBtn.disabled = !!r.error;
    if (r.error) {
      this.summary.replaceChildren(h('p', { class: 'error' }, r.error, ' Pick one of the sign texts above.'));
      return;
    }
    const levels = new Set(r.pieces.map(p => p.level)).size;
    this.summary.replaceChildren(...[
      h('div', { class: 'stats' },
        h('span', null, h('b', null, r.pieces.length), ' pieces'),
        h('span', null, h('b', null, levels), ` layer${levels === 1 ? '' : 's'}`),
        h('span', null, h('b', null, r.trees.length), ' trees'),
        h('span', null, h('b', null, r.samples.length), ' terrain samples')),
      r.duplicateAnchors > 0 && h('p', { class: 'note' }, `${r.duplicateAnchors + 1} signs read "${this.opts.anchorText}" — using the first.`),
      r.unmatched.length > 0 && h('div', { class: 'unmatched' },
        h('div', { class: 'section-label' }, `Not placed — no asset has these IDs (${r.unmatched.reduce((s, u) => s + u.count, 0)})`),
        ...r.unmatched.slice(0, 12).map(u => h('div', { class: 'unmatched-row' },
          h('span', { class: 'count' }, `${u.count}×`), h('span', null, u.name), h('code', null, u.id), h('span', { class: 'spacer' }),
          !u.id.startsWith('#') && button('plus', 'Create asset', () => this._createAsset(u.id), { class: 'chip small' })))),
    ].filter(Boolean));
  }

  _createAsset(id) {
    const piece = pieceByName(id);
    this.env.bus.emit('asset:new', { ids: [id], name: piece?.en || id, size: pieceFootprint(piece) || [2, 2], category: guessCategory(piece) });
  }

  async _import() {
    const { plan, actions } = this.env;
    if (!this.result || this.result.error) return;
    if (!plan.isEmpty() && !confirm('Replace the current plan\'s pieces, layers and terrain with this import? (The screenshot is kept.)')) return;
    this.importBtn.disabled = true;
    this.status.textContent = 'Building…';
    await applyImport(this.result, this.opts, plan);
    this.modal.close();
    actions.orient();
    toast(`Imported ${this.result.pieces.length} pieces around "${plan.anchor.text}"`);
  }
}
