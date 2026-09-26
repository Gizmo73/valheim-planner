import { h, button, toggle, slider } from './dom.js';
import { alignHelp } from './help.js';

const SNAP_MODES = [['grid', 'grid-3x3', 'Grid'], ['piece', 'magnet', 'Pieces'], ['free', 'move', 'Free']];
const FIT_LABEL = { 2: 'Scale, rotation and position set', 3: 'Plus skew', 4: 'Plus perspective' };

// Options for the current mode, shown under the toolbar.
export class ContextBar {
  constructor(el, env) {
    this.el = el;
    this.env = env;
    const render = () => this.render();
    for (const ev of ['tool:changed', 'place:changed', 'snap:changed', 'screenshot:changed', 'align:changed', 'selection:changed', 'library:changed']) env.bus.on(ev, render);
    render();
  }

  render() {
    const { tools } = this.env;
    const parts = { select: () => this._select(), place: () => this._place(), calibrate: () => this._calibrate() }[tools.name];
    this.el.replaceChildren(...(parts ? parts() : []).filter(Boolean));
  }

  _snapSeg() {
    const { tools } = this.env;
    return [
      h('span', { class: 'ctx-label' }, 'Snap'),
      h('div', { class: 'seg small' }, SNAP_MODES.map(([mode, ic, label]) =>
        button(ic, label, () => tools.setSnapMode(mode), { class: `seg-btn${tools.effectiveSnap === mode ? ' active' : ''}` }))),
      h('span', { class: 'ctx-hint' }, 'hold Ctrl: pieces · Alt: free'),
    ];
  }

  _select() {
    const n = this.env.tools.tools.select.selection.length;
    return [...this._snapSeg(), h('span', { class: 'spacer' }), h('span', { class: 'ctx-hint' }, n ? `${n} selected` : 'Drag empty space to box-select')];
  }

  _place() {
    const { library, tools } = this.env;
    const place = tools.tools.place;
    const def = library.get(place.asset);
    if (!def) return [h('span', { class: 'ctx-hint' }, 'Choose an asset from the Assets panel')];
    const thumb = library.thumbnail(def, 56);
    thumb.className = 'ctx-thumb';
    const n = library.snaps(def).length;
    return [
      thumb,
      h('span', { class: 'ctx-name' }, def.name),
      h('span', { class: 'ctx-hint' }, `${def.size[0]} × ${def.size[1]} m`),
      h('span', { class: 'sep' }),
      button('rotate-ccw', null, () => place.rotateBy(-1), { class: 'icon-btn', title: 'Rotate anticlockwise (Shift+R)' }),
      h('span', { class: 'angle' }, `${place.viewRotation}°`),
      button('rotate-cw', null, () => place.rotateBy(1), { class: 'icon-btn', title: 'Rotate clockwise (R)' }),
      n > 1 && h('span', { class: 'sep' }),
      n > 1 && button('chevron-left', null, () => place.cycleSnap(-1), { class: 'icon-btn', title: 'Previous snap point (Q)' }),
      n > 1 && h('span', { class: 'ctx-hint' }, `snap point ${place.snapIndex % n + 1}/${n}`),
      n > 1 && button('chevron-right', null, () => place.cycleSnap(1), { class: 'icon-btn', title: 'Next snap point (E)' }),
      h('span', { class: 'sep' }),
      ...this._snapSeg(),
      h('span', { class: 'sep' }),
      button('paint-bucket', 'Fill area', () => place.toggleFill(), { class: `chip${place.fillMode ? ' active' : ''}`, title: 'Drag a rectangle to fill (F)' }),
      h('span', { class: 'spacer' }),
      button('check', 'Done', () => tools.activate('select'), { class: 'chip', title: 'Back to Select (Esc)' }),
    ];
  }

  _calibrate() {
    const { plan, tools, bus } = this.env;
    const shot = plan.screenshot;
    if (!shot) return [];
    const n = shot.pairs.length;
    const res = shot.residual();
    // What to do next, so the two-click rhythm is obvious.
    const step = tools.tools.calibrate.pending ? 'Now click the same spot on your pieces'
      : n === 0 ? 'Click a spot on the screenshot'
        : n === 1 ? 'Pin a second spot, far from the first'
          : FIT_LABEL[Math.min(n, shot.perspective ? 4 : 3)] + (res ? ` · error ${res.toFixed(2)} m` : '');
    return [
      alignHelp(),
      h('span', { class: 'ctx-name' }, `${n} pin${n === 1 ? '' : 's'}`),
      h('span', { class: `ctx-hint${n < 2 ? ' ctx-step' : ''}` }, step),
      shot.unstable && h('span', { class: 'ctx-hint error' }, 'Pins disagree — perspective ignored, check them'),
      h('span', { class: 'sep' }),
      h('label', { class: 'ctx-toggle' }, toggle(shot.perspective, v => { shot.perspective = v; shot.solve(); bus.emit('screenshot:changed'); bus.emit('render'); }), 'Perspective (4+ pins)'),
      h('span', { class: 'sep' }),
      h('span', { class: 'ctx-label' }, 'Opacity'),
      slider(0.1, 1, 0.05, shot.opacity, v => { shot.opacity = v; bus.emit('render'); }),
      h('span', { class: 'spacer' }),
      button('eraser', 'Clear pins', () => tools.tools.calibrate.clear(), { class: 'chip', disabled: !n }),
      button('check', 'Done', () => tools.activate('select'), { class: 'chip' }),
    ];
  }
}
