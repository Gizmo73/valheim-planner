import { h } from './dom.js';

const GLOBAL_HINTS = [['Space+Drag / Middle', 'pan'], ['Wheel', 'zoom'], ['[ ]', 'rotate view']];

// Shortcuts for the current mode, plus the cursor position relative to the anchor.
export class StatusBar {
  constructor(el, { bus, tools, viewport }) {
    this.hints = h('div', { class: 'hints' });
    this.coords = h('span', { class: 'coords' });
    el.append(this.hints, this.coords);
    bus.on('tool:changed', () => {
      this.hints.replaceChildren(...[...(tools.current?.hints || []), ...GLOBAL_HINTS].map(([k, v]) => h('span', { class: 'hint' }, h('kbd', null, k), v)));
    });
    const update = () => {
      const p = tools.pointer;
      if (!p) return;
      const w = viewport.screenToWorld(p.x, p.y);
      // Shown in Valheim's axes: x east, z north, relative to the anchor.
      this.coords.textContent = `x ${w.x.toFixed(1)}  z ${(-w.y).toFixed(1)} m · ${viewport.zoom.toFixed(1)} px/m`;
    };
    bus.on('pointer:moved', update);
    bus.on('view:changed', update);
  }
}
