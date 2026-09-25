import { h, icon, button } from './dom.js';

const MODES = [
  { name: 'select', label: 'Select', icon: 'mouse-pointer-2', key: 'V' },
  { name: 'place', label: 'Place', icon: 'blocks', key: 'B' },
  { name: 'calibrate', label: 'Align image', icon: 'scan', key: 'A' },
];

export class Toolbar {
  constructor(el, { bus, tools, viewport, plan, actions }) {
    this.modeButtons = {};
    const modes = h('div', { class: 'seg' }, MODES.map(m => {
      const b = button(m.icon, m.label, () => tools.activate(m.name), { class: 'seg-btn', title: `${m.label} (${m.key})` });
      this.modeButtons[m.name] = b;
      return b;
    }));
    this.angle = h('span', { class: 'angle', title: 'View rotation' }, '0°');
    const view = h('div', { class: 'group' },
      button('rotate-ccw', null, () => viewport.rotateBy(-1), { class: 'icon-btn', title: 'Rotate view 22.5° anticlockwise ([)' }),
      this.angle,
      button('rotate-cw', null, () => viewport.rotateBy(1), { class: 'icon-btn', title: 'Rotate view 22.5° clockwise (])' }),
      button('maximize', null, actions.fit, { class: 'icon-btn', title: 'Zoom to fit (Home)' }),
    );
    this.undo = button('undo-2', null, () => plan.undo(), { class: 'icon-btn', title: 'Undo (Ctrl+Z)' });
    this.redo = button('redo-2', null, () => plan.redo(), { class: 'icon-btn', title: 'Redo (Ctrl+Shift+Z)' });
    el.append(
      h('span', { class: 'brand' }, icon('hammer'), 'Valheim Planner'),
      h('span', { class: 'sep' }),
      modes,
      h('span', { class: 'sep' }),
      view,
      h('span', { class: 'spacer' }),
      this.undo, this.redo,
      h('span', { class: 'sep' }),
      button('globe', 'Import world', actions.importWorld, { class: 'chip', title: 'Import a Valheim world save' }),
      button('image-plus', 'Screenshot', actions.addScreenshot, { class: 'chip', title: 'Add or replace the screenshot' }),
      button('folder-open', 'Open', actions.open, { class: 'chip', title: 'Open a saved plan (Ctrl+O)' }),
      button('save', 'Save', actions.save, { class: 'chip accent', title: 'Save plan (Ctrl+S)' }),
    );

    const sync = () => {
      for (const [name, b] of Object.entries(this.modeButtons)) {
        b.classList.toggle('active', tools.name === name);
        b.disabled = tools.tools[name]?.enabled?.() === false;
      }
      this.undo.disabled = !plan.canUndo;
      this.redo.disabled = !plan.canRedo;
    };
    bus.on('tool:changed', sync);
    bus.on('plan:changed', sync);
    bus.on('screenshot:changed', sync);
    bus.on('view:rotated', deg => { this.angle.textContent = `${deg}°`; });
    sync();
  }
}
