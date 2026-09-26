import { h, icon, button } from './dom.js';

// Layers draw bottom to top; the list shows the top layer first. The height slider hides layers
// from the top down, e.g. to peel floors off an imported build.
export class LayerPanel {
  constructor(el, { bus, plan }) {
    Object.assign(this, { el, bus, plan });
    this.height = h('input', { type: 'range', min: 0, step: 1, onInput: e => plan.setVisibleCount(+e.target.value) });
    this.heightLabel = h('span', { class: 'field-value' });
    this.list = h('div', { class: 'layer-list' });
    this.base = h('div', { class: 'layer-list' });
    el.append(
      h('div', { class: 'panel-head' },
        h('span', { class: 'panel-title' }, 'Layers'),
        button('plus', 'New layer', () => { plan.checkpoint(); plan.addGroup(`Layer ${plan.groups.length + 1}`); }, { class: 'chip' })),
      h('div', { class: 'height-slider' }, h('div', { class: 'field-row' }, h('span', { class: 'field-label' }, 'Height'), this.heightLabel), this.height),
      this.list,
      h('div', { class: 'section-label' }, 'Background'),
      this.base,
    );
    for (const ev of ['plan:changed', 'screenshot:changed']) bus.on(ev, () => this.render());
    this.render();
  }

  render() {
    const { plan } = this;
    const n = plan.groups.length;
    this.height.max = n;
    this.height.value = plan.visibleCount;
    this.heightLabel.textContent = plan.visibleCount >= n ? `all ${n} shown` : `${plan.visibleCount} of ${n} shown`;
    this.list.replaceChildren(...[...plan.groups].reverse().map(g => this._row(g)));
    this.base.replaceChildren(
      ...[['Screenshot', 'image', plan.screenshot], ['Terrain', 'mountain', plan.terrain]]
        .filter(([, , obj]) => obj)
        .map(([name, ic, obj]) => h('div', { class: `layer-row${obj.visible ? '' : ' off'}` },
          button(obj.visible ? 'eye' : 'eye-off', null, () => { obj.visible = !obj.visible; this.render(); this.bus.emit('render'); }, { class: 'icon-btn', title: 'Show / hide' }),
          icon(ic), h('span', { class: 'layer-name' }, name))),
    );
    if (!this.base.children.length) this.base.append(h('p', { class: 'empty-note' }, 'Import a world for terrain, or add a screenshot.'));
  }

  _row(g) {
    const { plan } = this;
    const index = plan.groupIndex(g.id);
    const cut = index >= plan.visibleCount;
    const name = h('span', { class: 'layer-name', title: 'Double-click to rename' }, g.name);
    name.addEventListener('dblclick', () => {
      const input = h('input', { type: 'text', value: g.name, class: 'rename' });
      const done = commit => {
        if (commit && input.value.trim() && input.value.trim() !== g.name) {
          plan.checkpoint();
          g.name = input.value.trim();
        }
        plan.changed();
      };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.onblur = null; done(false); } });
      input.onblur = () => done(true);
      name.replaceWith(input);
      input.focus();
      input.select();
    });
    const row = h('div', {
      class: `layer-row${g.id === plan.activeGroup ? ' active' : ''}${g.visible ? '' : ' off'}${cut ? ' cut' : ''}`,
      draggable: true,
      title: cut ? 'Hidden by the height slider' : 'Click to place new pieces on this layer',
      'data-id': g.id,
      onClick: () => {
        // No re-render here, so a double-click on the name still reaches it.
        plan.activeGroup = g.id;
        for (const r of this.list.children) r.classList.toggle('active', r.dataset.id === g.id);
      },
      onDragstart: e => e.dataTransfer.setData('text/layer', g.id),
      onDragover: e => { e.preventDefault(); row.classList.add('drop'); },
      onDragleave: () => row.classList.remove('drop'),
      onDrop: e => {
        e.preventDefault();
        const from = e.dataTransfer.getData('text/layer');
        if (!from || from === g.id) return plan.changed();
        plan.checkpoint();
        plan.moveGroup(from, index);
      },
    },
    button(g.visible ? 'eye' : 'eye-off', null, e => { e.stopPropagation(); g.visible = !g.visible; plan.changed(); }, { class: 'icon-btn', title: 'Show / hide' }),
    name,
    h('span', { class: 'count' }, plan.countIn(g.id)),
    h('span', { class: 'grip', title: 'Drag to reorder' }, icon('grip-vertical')),
    plan.groups.length > 1 && button('trash-2', null, e => {
      e.stopPropagation();
      plan.checkpoint();
      plan.removeGroup(g.id);
    }, { class: 'icon-btn danger', title: 'Delete layer (its pieces move to the layer below)' }));
    return row;
  }
}
