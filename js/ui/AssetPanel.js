import { h, icon, button } from './dom.js';
import { CATEGORIES } from '../assets/categories.js';

const THUMB_PX = 56;

export class AssetPanel {
  constructor(el, { bus, library, tools }) {
    Object.assign(this, { el, bus, library, tools });
    this.query = '';
    this.collapsed = new Set();
    this.search = h('input', { type: 'search', placeholder: 'Search assets or IDs', onInput: e => { this.query = e.target.value.trim().toLowerCase(); this.render(); } });
    this.list = h('div', { class: 'asset-list' });
    el.append(
      h('div', { class: 'panel-head' },
        h('div', { class: 'search' }, icon('search'), this.search),
        button('plus', 'New', () => bus.emit('asset:new'), { class: 'chip accent', title: 'Create a new asset' })),
      this.list,
    );
    bus.on('library:changed', () => this.render());
    for (const ev of ['place:changed', 'tool:changed']) bus.on(ev, () => { if (this._selected() !== this._shown) this.render(); });
    bus.on('asset:picked', id => this._reveal(id));
    this.render();
  }

  _selected() {
    return this.tools.name === 'place' ? this.tools.tools.place.asset : null;
  }

  _reveal(id) {
    this.render();
    this.list.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  render() {
    const q = this.query;
    const match = a => !q || a.name.toLowerCase().includes(q) || a.ids.some(id => id.toLowerCase().includes(q));
    const assets = this.library.list().filter(match);
    const selected = this._shown = this._selected();
    const groups = CATEGORIES.map(cat => [cat, assets.filter(a => a.category === cat.id)]).filter(([, list]) => list.length);
    this.list.replaceChildren(...groups.map(([cat, list]) => {
      const open = !this.collapsed.has(cat.id) || q;
      return h('section', { class: 'asset-group' },
        h('button', {
          class: 'asset-group-head',
          onClick: () => { this.collapsed.has(cat.id) ? this.collapsed.delete(cat.id) : this.collapsed.add(cat.id); this.render(); },
        }, icon(open ? 'chevron-down' : 'chevron-right'), cat.label, h('span', { class: 'count' }, list.length)),
        open && h('div', { class: 'asset-grid' }, list.map(a => this._tile(a, a.id === selected))));
    }), groups.length ? '' : h('p', { class: 'empty-note' }, 'No assets match.'));
  }

  _tile(a, selected) {
    const thumb = this.library.thumbnail(a, THUMB_PX * (window.devicePixelRatio || 1));
    thumb.className = 'asset-thumb';
    const status = this.library.status(a.id);
    return h('div', {
      class: `asset-tile${selected ? ' selected' : ''}`,
      'data-id': a.id,
      title: a.ids.length ? `Internal IDs: ${a.ids.join(', ')}` : 'No internal ID — won\'t match world imports',
      onClick: () => {
        this.tools.activate('place');
        this.tools.tools.place.setAsset(a.id);
      },
    },
    thumb,
    h('div', { class: 'asset-name' }, a.name),
    h('div', { class: 'asset-size' }, `${a.size[0]} × ${a.size[1]} m`),
    status && h('span', { class: `asset-status ${status}`, title: `${status} — not pushed to the repo yet` }),
    button('pencil', null, e => { e.stopPropagation(); this.bus.emit('asset:edit', a.id); }, { class: 'asset-edit', title: 'Edit asset' }));
  }
}
