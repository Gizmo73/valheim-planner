import { refreshIcons } from './icons.js';

const GRID_COLORS = ['#4ee3ec', '#f3f5fe', '#9184d9', '#f0b64e'];
const MAJOR_EVERY_OPTIONS = [2, 3, 4, 5, 6, 8, 10];
const STEP_LABELS = [[1, '1 px'], [5, '5 px'], [0.25, '¼ tile']];
const NUDGE_ICONS = { up: 'arrow-up', down: 'arrow-down', left: 'arrow-left', right: 'arrow-right' };
const NUDGE_DELTAS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const AXIS_MODES = [['uniform', 'maximize-2', 'Uniform'], ['x', 'move-horizontal', 'X'], ['y', 'move-vertical', 'Y']];

export class PlanPanel {
  constructor(gridSettings, mapScale, assetLayer, layerManager, fineTuneState, bus) {
    this.gridSettings = gridSettings;
    this.mapScale = mapScale;
    this.assetLayer = assetLayer;
    this.layerManager = layerManager;
    this.fineTuneState = fineTuneState;
    this.bus = bus;
    this._el = document.getElementById('plan-panel');
    this._axisPill = document.getElementById('finetune-axis-pill');
    this._axisPillText = document.getElementById('finetune-axis-text');
    this._axisPillKbd = document.getElementById('finetune-axis-kbd');
    this._render();

    bus.on('grid:changed', () => this._render());
    bus.on('scale:changed', () => this._render());
    bus.on('calibration:modeChanged', () => this._render());
    bus.on('asset:placed', () => this._render());
    bus.on('asset:deleted', () => this._render());
    bus.on('layer:created', () => this._render());
    bus.on('layer:removed', () => this._render());
    bus.on('finetune:changed', () => this._render());
  }

  _workingLayer() {
    return this.layerManager.getByType('working')[0] || null;
  }

  _render() {
    this._el.innerHTML = '';
    this._el.appendChild(this._fineTuneSection());
    this._el.appendChild(Object.assign(document.createElement('div'), { className: 'plan-hr' }));
    this._el.appendChild(this._gridSection());
    this._el.appendChild(Object.assign(document.createElement('div'), { className: 'plan-hr' }));
    this._el.appendChild(this._summarySection());
    refreshIcons();
    this._renderAxisPill();
  }

  _fineTuneSection() {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '11px';

    const label = document.createElement('div');
    label.className = 'plan-section-label';
    label.textContent = 'Fine tune';
    wrap.appendChild(label);

    const wl = this._workingLayer();
    if (!wl) {
      const note = document.createElement('div');
      note.className = 'plan-disabled-note';
      note.textContent = 'Calibrate the map to enable fine tuning.';
      wrap.appendChild(note);
      return wrap;
    }

    const ft = this.fineTuneState;

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '10px';
    row.appendChild(this._nudgePad(ft));
    row.appendChild(this._stepAndRotation(ft));
    wrap.appendChild(row);

    wrap.appendChild(this._axisCard(ft));

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '7px';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn-chip';
    resetBtn.style.flex = '1';
    resetBtn.style.justifyContent = 'center';
    resetBtn.style.border = '1px solid var(--color-control-border)';
    resetBtn.textContent = 'Reset to solved';
    resetBtn.disabled = !ft.hasPending;
    resetBtn.addEventListener('click', () => ft.reset());
    const lockBtn = document.createElement('button');
    lockBtn.className = 'btn-chip';
    lockBtn.style.flex = '1';
    lockBtn.style.justifyContent = 'center';
    lockBtn.style.border = '1px solid var(--color-accent)';
    lockBtn.style.color = 'var(--color-accent-300)';
    lockBtn.textContent = 'Lock alignment';
    lockBtn.disabled = !ft.hasPending;
    lockBtn.addEventListener('click', () => this.bus.emit('finetune:lock'));
    actions.appendChild(resetBtn);
    actions.appendChild(lockBtn);
    wrap.appendChild(actions);

    return wrap;
  }

  _nudgePad(ft) {
    const pad = document.createElement('div');
    pad.className = 'nudge-pad';
    const layout = [
      [null, 'up', null],
      ['left', 'center', 'right'],
      [null, 'down', null],
    ];
    for (const line of layout) {
      for (const d of line) {
        if (!d) { pad.appendChild(document.createElement('span')); continue; }
        const btn = document.createElement('button');
        if (d === 'center') {
          btn.className = 'nudge-btn center';
          btn.innerHTML = '<i data-lucide="locate-fixed"></i>';
          btn.title = 'Recentre';
          btn.addEventListener('click', () => ft.recentre());
        } else {
          btn.className = 'nudge-btn';
          btn.innerHTML = `<i data-lucide="${NUDGE_ICONS[d]}"></i>`;
          const [dx, dy] = NUDGE_DELTAS[d];
          btn.addEventListener('click', () => ft.nudge(dx, dy));
        }
        pad.appendChild(btn);
      }
    }
    return pad;
  }

  _stepAndRotation(ft) {
    const col = document.createElement('div');
    col.style.display = 'flex';
    col.style.flexDirection = 'column';
    col.style.gap = '7px';
    col.style.flex = '1';
    col.style.minWidth = '0';

    const stepLabel = document.createElement('span');
    stepLabel.style.font = '500 11px Inter, system-ui, sans-serif';
    stepLabel.style.color = 'var(--color-label)';
    stepLabel.textContent = 'Nudge step';
    col.appendChild(stepLabel);

    const stepSeg = document.createElement('div');
    stepSeg.className = 'seg';
    for (const [n, text] of STEP_LABELS) {
      const b = document.createElement('button');
      b.className = 'seg-btn' + (ft.step === n ? ' active' : '');
      b.style.flex = '1';
      b.textContent = text;
      b.addEventListener('click', () => { ft.step = n; });
      stepSeg.appendChild(b);
    }
    col.appendChild(stepSeg);

    const rotRow = document.createElement('div');
    rotRow.style.display = 'flex';
    rotRow.style.alignItems = 'center';
    rotRow.style.gap = '7px';
    const rotLabel = document.createElement('span');
    rotLabel.style.font = '500 11px Inter, system-ui, sans-serif';
    rotLabel.style.color = 'var(--color-label)';
    rotLabel.style.flex = '1';
    rotLabel.textContent = 'Rotation';
    const minusBtn = document.createElement('button');
    minusBtn.className = 'rotation-btn';
    minusBtn.innerHTML = '<i data-lucide="rotate-ccw"></i>';
    minusBtn.addEventListener('click', () => ft.nudgeRotation(-0.1));
    const rotVal = document.createElement('span');
    rotVal.style.font = '500 11.5px ui-monospace, Menlo, monospace';
    rotVal.style.minWidth = '42px';
    rotVal.style.textAlign = 'center';
    rotVal.textContent = `${ft.rotationDeg.toFixed(1)}°`;
    const plusBtn = document.createElement('button');
    plusBtn.className = 'rotation-btn';
    plusBtn.innerHTML = '<i data-lucide="rotate-cw"></i>';
    plusBtn.addEventListener('click', () => ft.nudgeRotation(0.1));
    rotRow.appendChild(rotLabel);
    rotRow.appendChild(minusBtn);
    rotRow.appendChild(rotVal);
    rotRow.appendChild(plusBtn);
    col.appendChild(rotRow);

    return col;
  }

  _axisCard(ft) {
    const mode = ft.axisMode;
    const card = document.createElement('div');
    card.className = 'axis-card';

    const header = document.createElement('div');
    header.className = 'axis-card-header';
    header.innerHTML = '<span>Scale axis</span>';
    const modeLabel = document.createElement('span');
    modeLabel.className = 'mode';
    modeLabel.textContent = mode === 'x' ? 'X only' : mode === 'y' ? 'Y only' : '';
    header.appendChild(modeLabel);
    card.appendChild(header);

    const seg = document.createElement('div');
    seg.style.display = 'flex';
    seg.style.padding = '2px';
    seg.style.background = '#1c1e2c';
    seg.style.border = '1px solid var(--color-control-border)';
    seg.style.borderRadius = '7px';
    seg.style.gap = '2px';
    for (const [val, icon, text] of AXIS_MODES) {
      const b = document.createElement('button');
      const active = mode === val;
      Object.assign(b.style, {
        flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '5px', height: '30px', borderRadius: '5px',
        font: '500 11.5px Inter, system-ui, sans-serif', cursor: 'pointer',
      });
      if (active && val !== 'uniform') {
        Object.assign(b.style, { background: 'rgba(78,227,236,.16)', border: '1px solid #4ee3ec', color: '#bdf4f7' });
      } else if (active) {
        Object.assign(b.style, { background: 'var(--color-accent-tint-strong)', border: '1px solid var(--color-accent)', color: 'var(--color-accent-300)' });
      } else {
        Object.assign(b.style, { background: 'transparent', border: '1px solid transparent', color: 'var(--color-neutral-500)' });
      }
      b.innerHTML = `<span style="font-size:14px"><i data-lucide="${icon}"></i></span>${text}`;
      b.addEventListener('click', () => { ft.axisMode = val; });
      seg.appendChild(b);
    }
    card.appendChild(seg);

    card.appendChild(this._axisField('Across', ft.across, mode === 'uniform' || mode === 'x', (v) => ft.setAcross(v)));
    card.appendChild(this._axisField('Down', ft.down, mode === 'uniform' || mode === 'y', (v) => ft.setDown(v)));

    const footnote = document.createElement('div');
    footnote.className = 'axis-footnote';
    footnote.innerHTML = '<span style="font-size:14px"><i data-lucide="link-2-off"></i></span><span>Axes unlinked — stretching down leaves the horizontal fit alone.</span>';
    card.appendChild(footnote);

    return card;
  }

  _axisField(label, value, active, onChange) {
    const row = document.createElement('div');
    row.className = 'axis-field-row';
    const l = document.createElement('span');
    l.className = 'axis-field-label' + (active ? ' active' : '');
    l.textContent = label;
    const input = document.createElement('input');
    input.type = 'number';
    input.step = '0.1';
    input.min = '0';
    input.className = 'axis-input' + (active ? ' active' : '');
    input.value = value.toFixed(2);
    input.disabled = !active;
    input.addEventListener('keydown', (e) => e.stopPropagation());
    input.addEventListener('change', () => onChange(input.value));
    const unit = document.createElement('span');
    unit.style.font = '500 11px Inter, system-ui, sans-serif';
    unit.style.color = 'var(--color-muted)';
    unit.textContent = 'px/tile';
    row.appendChild(l);
    row.appendChild(input);
    row.appendChild(unit);
    return row;
  }

  _gridSection() {
    const gs = this.gridSettings;
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = '14px';

    const label = document.createElement('div');
    label.className = 'plan-section-label';
    label.textContent = 'Calibration grid';
    wrap.appendChild(label);

    const showRow = document.createElement('div');
    showRow.className = 'plan-row';
    showRow.innerHTML = '<span class="plan-row-label">Show grid</span>';
    const sw = document.createElement('div');
    sw.className = 'switch' + (gs.visible ? ' on' : '');
    sw.innerHTML = '<div class="switch-knob"></div>';
    sw.addEventListener('click', () => { gs.visible = !gs.visible; });
    showRow.appendChild(sw);
    wrap.appendChild(showRow);

    const colorField = document.createElement('div');
    colorField.className = 'plan-field';
    colorField.innerHTML = '<div class="plan-field-title"><span>Line colour</span><span></span></div>';
    const swatchRow = document.createElement('div');
    swatchRow.className = 'swatch-row';
    for (const c of GRID_COLORS) {
      const sBtn = document.createElement('button');
      sBtn.className = 'swatch' + (gs.color.toLowerCase() === c ? ' selected' : '');
      sBtn.style.background = c;
      sBtn.title = c;
      sBtn.addEventListener('click', () => { gs.color = c; });
      swatchRow.appendChild(sBtn);
    }
    const current = document.createElement('div');
    current.className = 'swatch-current';
    const dot = document.createElement('div');
    dot.className = 'dot';
    dot.style.background = gs.color;
    const hexChip = document.createElement('span');
    hexChip.style.font = '500 11px ui-monospace, Menlo, monospace';
    hexChip.style.color = 'var(--color-neutral-300)';
    hexChip.textContent = gs.color.toUpperCase();
    current.appendChild(dot);
    current.appendChild(hexChip);
    swatchRow.appendChild(current);
    colorField.appendChild(swatchRow);
    wrap.appendChild(colorField);

    wrap.appendChild(this._slider('Line width', `${gs.minorWidth} px`, 0.5, 4, 0.25, gs.minorWidth, (v) => { gs.minorWidth = v; }));
    wrap.appendChild(this._slider('Major line width', `${gs.majorWidth} px`, 0.5, 4, 0.25, gs.majorWidth, (v) => { gs.majorWidth = v; }));

    const majorRow = document.createElement('div');
    majorRow.className = 'plan-row';
    majorRow.innerHTML = '<span class="plan-row-label">Major line every</span>';
    const select = document.createElement('select');
    select.className = 'plan-stepper';
    for (const n of MAJOR_EVERY_OPTIONS) {
      const opt = document.createElement('option');
      opt.value = String(n);
      opt.textContent = `${n} tiles`;
      if (n === gs.majorEvery) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => { gs.majorEvery = parseInt(select.value, 10); });
    select.addEventListener('keydown', (e) => e.stopPropagation());
    majorRow.appendChild(select);
    wrap.appendChild(majorRow);

    const aboveRow = document.createElement('div');
    aboveRow.className = 'plan-row';
    aboveRow.innerHTML = '<span class="plan-row-label">Draw over pieces</span>';
    const aboveSw = document.createElement('div');
    aboveSw.className = 'switch' + (gs.abovePieces ? ' on' : '');
    aboveSw.innerHTML = '<div class="switch-knob"></div>';
    aboveSw.addEventListener('click', () => { gs.abovePieces = !gs.abovePieces; });
    aboveRow.appendChild(aboveSw);
    wrap.appendChild(aboveRow);

    return wrap;
  }

  _summarySection() {
    const summary = document.createElement('div');
    summary.className = 'plan-summary';
    summary.appendChild(this._summaryRow('Map type', this.mapScale.mapMode === 'local' ? 'Local area' : 'World map'));
    summary.appendChild(this._summaryRow('Scale', `${this.mapScale.metresPerPixel.toFixed(2)} m/px`));
    summary.appendChild(this._summaryRow('Pieces', String(this.assetLayer.assets.length)));
    return summary;
  }

  _renderAxisPill() {
    const ft = this.fineTuneState;
    const mode = ft.axisMode;
    if (mode === 'uniform' || !this._workingLayer()) {
      this._axisPill.classList.add('hidden');
      return;
    }
    this._axisPillText.textContent = mode === 'x' ? 'X-only scaling' : 'Y-only scaling';
    this._axisPillKbd.textContent = mode.toUpperCase();
    this._axisPill.classList.remove('hidden');
  }

  _summaryRow(label, value) {
    const row = document.createElement('div');
    row.className = 'plan-summary-row';
    row.innerHTML = `<span>${label}</span><span>${value}</span>`;
    return row;
  }

  _slider(label, valueLabel, min, max, step, value, onChange) {
    const field = document.createElement('div');
    field.className = 'plan-field';
    const title = document.createElement('div');
    title.className = 'plan-field-title';
    title.innerHTML = `<span>${label}</span><span>${valueLabel}</span>`;
    field.appendChild(title);

    const slider = document.createElement('div');
    slider.className = 'plan-slider';
    const track = document.createElement('div');
    track.className = 'plan-slider-track';
    const fill = document.createElement('div');
    fill.className = 'plan-slider-fill';
    const knob = document.createElement('div');
    knob.className = 'plan-slider-knob';
    const pct = (value - min) / (max - min);
    fill.style.width = `${pct * 100}%`;
    knob.style.left = `${pct * 100}%`;
    slider.appendChild(track);
    slider.appendChild(fill);
    slider.appendChild(knob);
    field.appendChild(slider);

    const setFromClientX = (clientX) => {
      const rect = slider.getBoundingClientRect();
      let p = (clientX - rect.left) / rect.width;
      p = Math.min(1, Math.max(0, p));
      let v = min + p * (max - min);
      v = Math.round(v / step) * step;
      v = Math.min(max, Math.max(min, v));
      onChange(parseFloat(v.toFixed(3)));
    };

    slider.addEventListener('pointerdown', (e) => {
      setFromClientX(e.clientX);
      const move = (ev) => setFromClientX(ev.clientX);
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });

    return field;
  }
}
