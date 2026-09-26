import { h, button, field, toggle, slider, toast } from './dom.js';
import { githubSettings, saveGithubSettings } from '../assets/github.js';

const GRID_COLOURS = ['#4ee3ec', '#f3f5fe', '#9184d9', '#f0b64e', '#1c1e2c'];
const MAJOR_EVERY = [2, 4, 5, 8, 10];

export class SettingsPanel {
  constructor(el, env) {
    this.env = env;
    this.background = h('div', { class: 'section' });
    this.libraryBox = h('div', { class: 'section' });
    this.info = h('div', { class: 'section' });
    el.append(this._grid(), this._lighting(), this.background, this.libraryBox, this.info);
    env.bus.on('library:changed', () => this._library());
    env.bus.on('screenshot:changed', () => this._background());
    env.bus.on('plan:changed', () => { this._background(); this._info(); });
    this._background();
    this._library();
    this._info();
  }

  _grid() {
    const { grid, plan, library, viewport, bus } = this.env;
    const s = grid.settings;
    const custom = h('input', { type: 'color', value: s.color, title: 'Custom colour', onInput: e => setColour(e.target.value) });
    const swatches = GRID_COLOURS.map(c => h('button', { class: 'swatch', style: { background: c }, title: c, onClick: () => setColour(c) }));
    const mark = () => swatches.forEach((b, i) => b.classList.toggle('active', GRID_COLOURS[i] === s.color));
    const setColour = c => { grid.set('color', c); custom.value = c; mark(); };
    mark();
    const width = (key, label) => {
      const value = h('span', { class: 'field-value' }, `${s[key]} px`);
      return h('div', { class: 'field' },
        h('div', { class: 'field-row' }, h('span', { class: 'field-label' }, label), value),
        slider(0.5, 4, 0.25, s[key], v => { grid.set(key, v); value.textContent = `${v} px`; }));
    };
    const every = h('select', { onChange: e => grid.set('majorEvery', +e.target.value) }, MAJOR_EVERY.map(n => h('option', { value: n }, `every ${n} m`)));
    every.value = s.majorEvery;
    return h('div', { class: 'section' },
      h('div', { class: 'section-label' }, 'Grid'),
      h('label', { class: 'field-row' }, h('span', { class: 'field-label' }, 'Show grid'), toggle(s.visible, v => grid.set('visible', v))),
      h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Colour'), h('div', { class: 'swatches' }, swatches, custom)),
      width('minorWidth', 'Minor lines'),
      width('majorWidth', 'Major lines'),
      h('label', { class: 'field-row' }, h('span', { class: 'field-label' }, 'Major lines'), every),
      h('label', { class: 'field-row' }, h('span', { class: 'field-label' }, 'Draw over pieces'), toggle(s.abovePieces, v => grid.set('abovePieces', v))),
      h('div', { class: 'row-buttons' },
        button('magnet', 'Align to pieces', () => {
          toast(grid.alignTo(plan.items, library, viewport) ? 'Grid aligned to pieces' : 'No pieces square to the screen at this rotation');
        }, { class: 'chip', title: 'Line the grid up with pieces that are square to the screen' }),
        button('crosshair', 'Reset', () => { grid.offset = { x: 0, y: 0 }; bus.emit('render'); }, { class: 'chip', title: 'Put a grid line through the anchor' })),
    );
  }

  _lighting() {
    const { lighting } = this.env;
    const s = lighting.settings;
    const direction = h('span', { class: 'field-value' });
    const strength = h('span', { class: 'field-value' });
    const labels = () => {
      direction.textContent = `from ${s.azimuth}° ${lighting.compass}`;
      strength.textContent = `${Math.round(s.strength * 100)}%`;
    };
    labels();
    const row = (label, value, control) => h('div', { class: 'field' },
      h('div', { class: 'field-row' }, h('span', { class: 'field-label' }, label), value), control);
    return h('div', { class: 'section' },
      h('div', { class: 'section-label' }, 'Lighting'),
      h('label', { class: 'field-row' }, h('span', { class: 'field-label' }, 'Shade roof faces'), toggle(s.roofs, v => lighting.set('roofs', v))),
      row('Light direction', direction, slider(0, 355, 5, s.azimuth, v => { lighting.set('azimuth', v); labels(); })),
      row('Strength', strength, slider(0.1, 1, 0.05, s.strength, v => { lighting.set('strength', v); labels(); })),
      h('p', { class: 'note' }, 'One sun-style light shades roof faces by the way they slope, and lights the terrain. The dot on the compass shows where it comes from.'),
    );
  }

  _background() {
    const { plan, bus, tools } = this.env;
    const parts = [h('div', { class: 'section-label' }, 'Background')];
    const shot = plan.screenshot;
    if (shot) {
      parts.push(
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Screenshot opacity'), slider(0.1, 1, 0.05, shot.opacity, v => { shot.opacity = v; bus.emit('render'); })),
        h('div', { class: 'row-buttons' },
          button('scan', 'Align image', () => tools.activate('calibrate'), { class: 'chip' }),
          button('trash-2', 'Remove', () => { plan.screenshot = null; tools.activate('select'); bus.emit('screenshot:changed'); plan.changed(); }, { class: 'chip danger' })),
      );
    }
    const t = plan.terrain;
    if (t) {
      parts.push(
        h('div', { class: 'field' }, h('span', { class: 'field-label' }, 'Terrain opacity'), slider(0.1, 1, 0.05, t.opacity, v => { t.opacity = v; bus.emit('render'); })),
        h('div', { class: 'row-buttons' }, button('trash-2', 'Remove terrain', () => { plan.terrain = null; plan.changed(); }, { class: 'chip danger' })),
      );
    }
    if (!shot && !t) parts.push(h('p', { class: 'empty-note' }, 'No screenshot or terrain yet.'));
    this.background.replaceChildren(...parts);
  }

  _library() {
    const { library } = this.env;
    const gh = githubSettings();
    const changes = library.changes();
    const status = h('p', { class: 'library-status' }, changes.length ? `${changes.length} local change${changes.length > 1 ? 's' : ''}: ${changes.map(c => `${c.id} (${c.status})`).join(', ')}` : 'Library matches the repo.');
    const input = (key, type, placeholder) => h('input', { type, value: gh[key], placeholder, onChange: e => saveGithubSettings({ [key]: e.target.value.trim() }) });
    const push = button('git-commit-horizontal', `Push ${changes.length || ''} to repo`, async () => {
      push.disabled = true;
      status.textContent = 'Committing…';
      try {
        const n = await library.push();
        toast(`Pushed ${n} asset change${n === 1 ? '' : 's'}`);
      } catch (err) {
        status.textContent = err.message;
        status.classList.add('error');
        push.disabled = false;
      }
    }, { class: 'chip accent', disabled: !changes.length });
    this.libraryBox.replaceChildren(
      h('div', { class: 'section-label' }, 'Asset library'),
      h('p', { class: 'note' }, 'Asset edits are saved in this browser. Push commits them to the repo as one commit.'),
      field('GitHub token', input('token', 'password', 'github_pat_…')),
      field('Repository', input('repo', 'text', 'owner/repo')),
      field('Branch', input('branch', 'text', 'main')),
      status,
      h('div', { class: 'row-buttons' }, push),
    );
  }

  _info() {
    const { plan } = this.env;
    const rows = [
      ['Anchor', plan.anchor ? `"${plan.anchor.text}" at ${Math.round(plan.anchor.world.x)}, ${Math.round(plan.anchor.world.z)}` : 'none'],
      ['Pieces', plan.items.length],
      ['Layers', plan.groups.length],
    ];
    this.info.replaceChildren(h('div', { class: 'section-label' }, 'Plan'), ...rows.map(([k, v]) => h('div', { class: 'info-row' }, h('span', null, k), h('span', null, String(v)))));
  }
}
