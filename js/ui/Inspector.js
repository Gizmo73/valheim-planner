import { h, button } from './dom.js';

const WIDTH = 220;

// Floating panel beside the current selection.
export class Inspector {
  constructor(el, { bus, plan, library, viewport, tools }) {
    Object.assign(this, { el, bus, plan, library, viewport, tools });
    this.select = tools.tools.select;
    bus.on('selection:changed', () => this.render());
    bus.on('plan:changed', () => this.render());
    bus.on('tool:changed', () => this.render());
    for (const ev of ['view:changed', 'selection:moved']) bus.on(ev, () => this.position());
  }

  render() {
    const sel = this.select.selection;
    if (this.tools.name !== 'select' || !sel.length) {
      this.el.hidden = true;
      return;
    }
    const { plan, library } = this;
    const names = [...new Set(sel.map(it => library.get(it.asset)?.name || it.asset))];
    const layers = new Set(sel.map(it => it.group));
    const layer = h('select', { onChange: e => this.select.moveToGroup(e.target.value) },
      layers.size > 1 && h('option', { value: '', disabled: true }, 'Mixed layers'),
      [...plan.groups].reverse().map(g => h('option', { value: g.id }, g.name)),
      h('option', { value: 'new' }, '+ New layer'));
    layer.value = layers.size > 1 ? '' : sel[0].group;
    const primary = this.select.primary;
    this.el.replaceChildren(
      h('div', { class: 'insp-title' }, sel.length === 1 ? names[0] : `${sel.length} pieces`),
      h('div', { class: 'insp-sub' }, names.length > 1 ? `${names.length} kinds` : sel.length === 1 ? `${Math.round(primary.rot * 10) / 10}° · ${primary.x.toFixed(2)}, ${primary.y.toFixed(2)} m` : names[0]),
      h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Layer'), layer),
      h('div', { class: 'insp-actions' },
        button('rotate-cw', 'Rotate', () => this.select.rotateSelection(1), { title: 'Rotate 22.5° (R)' }),
        button('copy-plus', 'Duplicate', () => this.select.placeMore(), { title: 'Place more of this piece (D)' }),
        button('pencil', 'Edit asset', () => this.bus.emit('asset:edit', primary.asset), { title: 'Edit this asset' }),
        button('trash-2', 'Delete', () => this.select.deleteSelection(), { class: 'danger', title: 'Delete (Del)' })),
    );
    this.el.hidden = false;
    this.position();
  }

  position() {
    const sel = this.select.selection;
    if (this.el.hidden || !sel.length) return;
    const { viewport: vp } = this;
    let maxX = -Infinity, minX = Infinity, minY = Infinity;
    for (const it of sel) {
      const r = this.library.get(it.asset)?.radius || 0.5;
      const s = vp.worldToScreen(it.x, it.y);
      maxX = Math.max(maxX, s.x + r * vp.zoom);
      minX = Math.min(minX, s.x - r * vp.zoom);
      minY = Math.min(minY, s.y - r * vp.zoom);
    }
    let left = maxX + 16;
    if (left + WIDTH > vp.width - 8) left = Math.max(8, minX - WIDTH - 16);
    this.el.style.left = `${left}px`;
    this.el.style.top = `${Math.min(Math.max(8, minY), vp.height - this.el.offsetHeight - 8)}px`;
  }
}
