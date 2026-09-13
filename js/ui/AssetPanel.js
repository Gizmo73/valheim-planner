import { getAssetTypes, getCategories, updateAssetSize, registerCategory } from '../assets/AssetRegistry.js';
import { renderThumbnail } from '../assets/textureCache.js';
import { createCategoryTemplate, evalCategoryModule, downloadText } from '../assets/categorySource.js';
import { refreshIcons } from './icons.js';
import { TILE_METRES } from '../core/MapScale.js';

function slugify(label) {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'category';
}

const THUMB_DISPLAY_SIZE = 64;

function formatSize(widthM, heightM) {
  const wTiles = widthM / TILE_METRES;
  const hTiles = heightM / TILE_METRES;
  const round = (n) => Math.round(n * 100) / 100;
  let tileLabel;
  if (wTiles === hTiles) {
    tileLabel = wTiles === 1 ? '1 tile' : `${round(wTiles)} tiles`;
  } else {
    tileLabel = `${round(wTiles)} × ${round(hTiles)} tiles`;
  }
  return `${tileLabel} · ${widthM} × ${heightM} m`;
}

export class AssetPanel {
  constructor(bus) {
    this.bus = bus;
    this._el = document.getElementById('asset-list');
    this._searchInput = document.getElementById('asset-search');
    this._selected = null;
    this._itemsByType = {};
    this._collapsed = new Set();
    this._query = '';
    this._init();

    this.bus.on('asset:startPlace', (type) => {
      this._selectByType(type);
    });

    this._searchInput.addEventListener('input', () => {
      this._query = this._searchInput.value.trim().toLowerCase();
      this._render();
    });
  }

  _init() {
    this._render();
  }

  _render() {
    this._el.innerHTML = '';
    this._itemsByType = {};

    const types = getAssetTypes();
    const categories = getCategories();

    for (const cat of categories) {
      const entries = types.filter(t => t.category === cat &&
        (!this._query || t.name.toLowerCase().includes(this._query)));
      if (entries.length === 0) continue;

      const group = document.createElement('div');
      group.className = 'asset-category-group';

      const collapsed = this._collapsed.has(cat);
      const header = document.createElement('button');
      header.className = 'asset-category-header';
      header.innerHTML = `<span><i data-lucide="${collapsed ? 'chevron-right' : 'chevron-down'}"></i></span>${cat}<span class="cat-count">${entries.length}</span>`;
      header.addEventListener('click', () => {
        if (collapsed) this._collapsed.delete(cat);
        else this._collapsed.add(cat);
        this._render();
      });
      group.appendChild(header);

      if (!collapsed) {
        const grid = document.createElement('div');
        grid.className = 'asset-grid';
        for (const t of entries) {
          grid.appendChild(this._buildItem(t));
        }
        group.appendChild(grid);
      }

      this._el.appendChild(group);
    }

    if (!this._query) this._el.appendChild(this._buildNewCategoryCard());

    refreshIcons();
  }

  _buildNewCategoryCard() {
    const card = document.createElement('div');
    card.className = 'new-category-card';

    const label = document.createElement('label');
    label.className = 'edit-field-label';
    label.textContent = 'New category';
    const input = document.createElement('input');
    input.className = 'edit-input';
    input.type = 'text';
    input.placeholder = 'e.g. Black Marble Trim';
    const path = document.createElement('div');
    path.className = 'new-category-path';
    const updatePath = () => {
      const id = slugify(input.value || 'category');
      path.textContent = `→ assets/categories/${id}.js`;
    };
    input.addEventListener('input', updatePath);
    updatePath();

    const createBtn = document.createElement('button');
    createBtn.className = 'btn-outline';
    createBtn.textContent = 'Create';
    createBtn.addEventListener('click', async () => {
      const rawLabel = input.value.trim();
      if (!rawLabel) return;
      const id = slugify(rawLabel);
      const text = createCategoryTemplate(id, rawLabel);
      const result = await evalCategoryModule(text);
      if (!result.ok) {
        alert('Could not create category: ' + result.error);
        return;
      }
      registerCategory(id, result.module, `js/assets/categories/${id}.js`);
      downloadText(`${id}.js`, text);
      input.value = '';
      updatePath();
      this._render();
      alert(`Created "${rawLabel}" for this session and downloaded ${id}.js.\n\nTo keep it after a reload, add it to js/assets/AssetRegistry.js: import it and add it to the categories list, the same way the existing categories are registered.`);
    });

    card.appendChild(label);
    card.appendChild(input);
    card.appendChild(path);
    card.appendChild(createBtn);
    return card;
  }

  _buildItem(t) {
    const item = document.createElement('div');
    item.className = 'asset-item';
    item.dataset.type = t.type;
    if (this._selected === t.type) item.classList.add('selected');

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'asset-thumb-wrap';
    const thumb = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    const bufSize = Math.round(THUMB_DISPLAY_SIZE * dpr);
    thumb.width = bufSize;
    thumb.height = bufSize;
    thumb.className = 'asset-thumb';
    const tCtx = thumb.getContext('2d');
    const tex = renderThumbnail(t.categoryId, t.type, t.widthM, t.heightM, bufSize);
    tCtx.drawImage(tex, 0, 0, bufSize, bufSize);
    thumbWrap.appendChild(thumb);

    const pencil = document.createElement('button');
    pencil.className = 'asset-pencil';
    pencil.title = 'Edit piece';
    pencil.innerHTML = '<i data-lucide="pencil"></i>';
    pencil.addEventListener('click', (e) => {
      e.stopPropagation();
      this.bus.emit('asset:edit', t.type);
    });
    thumbWrap.appendChild(pencil);

    const label = document.createElement('div');
    label.className = 'asset-label';

    const name = document.createElement('div');
    name.className = 'asset-name';
    name.textContent = t.name;

    const size = document.createElement('div');
    size.className = 'asset-size';
    size.textContent = formatSize(t.widthM, t.heightM);
    size.title = 'Click to edit size';
    size.addEventListener('click', (e) => {
      e.stopPropagation();
      this._editSize(t, size);
    });

    label.appendChild(name);
    label.appendChild(size);

    item.appendChild(thumbWrap);
    item.appendChild(label);

    item.addEventListener('click', () => {
      this.bus.emit('asset:startPlace', t.type);
    });

    this._itemsByType[t.type] = item;
    return item;
  }

  _editSize(entry, sizeEl) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'asset-size-input';
    input.value = `${entry.widthM}x${entry.heightM}`;
    sizeEl.replaceWith(input);
    input.focus();
    input.select();

    const finish = () => {
      const val = input.value.trim();
      const match = val.match(/^([\d.]+)\s*x\s*([\d.]+)$/);
      if (match) {
        const w = parseFloat(match[1]);
        const h = parseFloat(match[2]);
        if (w > 0 && h > 0) {
          updateAssetSize(entry.type, w, h);
          entry.widthM = w;
          entry.heightM = h;
        }
      }
      this._render();
    };

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
      if (e.code === 'Enter') { input.blur(); }
      if (e.code === 'Escape') { this._render(); }
    });
  }

  _selectByType(type) {
    this._selected = type;
    this._render();
  }

  clearSelection() {
    this._selected = null;
    this._render();
  }
}
