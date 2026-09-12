import { refreshIcons } from './icons.js';

const PRESET_COLORS = ['#f3f5fe', '#9184d9', '#d2cefd', '#b2b6ca'];
const MAJOR_STEPS = [2, 4, 8];

export class PlanPanel {
  constructor(gridSettings, mapScale, assetLayer, bus) {
    this.gridSettings = gridSettings;
    this.mapScale = mapScale;
    this.assetLayer = assetLayer;
    this.bus = bus;
    this._el = document.getElementById('plan-panel');
    this._render();

    bus.on('grid:changed', () => this._render());
    bus.on('scale:changed', () => this._render());
    bus.on('calibration:modeChanged', () => this._render());
    bus.on('asset:placed', () => this._render());
    bus.on('asset:deleted', () => this._render());
  }

  _render() {
    const gs = this.gridSettings;
    this._el.innerHTML = '';

    const label = document.createElement('div');
    label.className = 'plan-section-label';
    label.textContent = 'Grid overlay';
    this._el.appendChild(label);

    // Show grid toggle
    const showRow = document.createElement('div');
    showRow.className = 'plan-row';
    showRow.innerHTML = '<span class="plan-row-label">Show grid</span>';
    const sw = document.createElement('div');
    sw.className = 'switch' + (gs.visible ? ' on' : '');
    sw.innerHTML = '<div class="switch-knob"></div>';
    sw.addEventListener('click', () => { gs.visible = !gs.visible; });
    showRow.appendChild(sw);
    this._el.appendChild(showRow);

    // Line colour
    const colorField = document.createElement('div');
    colorField.className = 'plan-field';
    colorField.innerHTML = '<span class="plan-field-title" style="display:block"><span>Line colour</span></span>';
    const swatchRow = document.createElement('div');
    swatchRow.className = 'swatch-row';
    for (const c of PRESET_COLORS) {
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
    const hexInput = document.createElement('input');
    hexInput.type = 'text';
    hexInput.value = gs.color;
    hexInput.addEventListener('change', () => {
      const v = hexInput.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(v)) gs.color = v;
      else hexInput.value = gs.color;
    });
    current.appendChild(dot);
    current.appendChild(hexInput);
    swatchRow.appendChild(current);
    colorField.appendChild(swatchRow);
    this._el.appendChild(colorField);

    // Line width
    this._el.appendChild(this._slider('Line width', `${gs.lineWidth} px`, 0.5, 3, 0.5, gs.lineWidth, (v) => { gs.lineWidth = v; }));

    // Opacity
    this._el.appendChild(this._slider('Opacity', `${Math.round(gs.opacity * 100)}%`, 0.04, 1, 0.02, gs.opacity, (v) => { gs.opacity = v; }));

    // Major line
    const majorRow = document.createElement('div');
    majorRow.className = 'plan-row';
    majorRow.innerHTML = `<span class="plan-row-label">Major line</span>`;
    const stepper = document.createElement('div');
    stepper.className = 'plan-stepper';
    stepper.innerHTML = `<span>every ${gs.majorEvery} m</span><span><i data-lucide="chevron-down"></i></span>`;
    stepper.addEventListener('click', () => {
      const idx = MAJOR_STEPS.indexOf(gs.majorEvery);
      const next = MAJOR_STEPS[(idx + 1 + MAJOR_STEPS.length) % MAJOR_STEPS.length] || MAJOR_STEPS[0];
      gs.majorEvery = next;
    });
    majorRow.appendChild(stepper);
    this._el.appendChild(majorRow);

    // Preview
    const previewField = document.createElement('div');
    previewField.className = 'plan-field';
    previewField.innerHTML = '<span style="font-size:11px;color:var(--color-neutral-600)">Preview</span>';
    const preview = document.createElement('div');
    preview.className = 'plan-preview';
    preview.style.backgroundImage = this._gridCss(gs);
    previewField.appendChild(preview);
    this._el.appendChild(previewField);

    this._el.appendChild(Object.assign(document.createElement('div'), { className: 'plan-hr' }));

    // Summary
    const summary = document.createElement('div');
    summary.className = 'plan-summary';
    summary.appendChild(this._summaryRow('Map type', this.mapScale.mapMode === 'local' ? 'Local area' : 'World map'));
    summary.appendChild(this._summaryRow('Scale', `${this.mapScale.metresPerPixel.toFixed(2)} m/px`));
    summary.appendChild(this._summaryRow('Pieces', String(this.assetLayer.assets.length)));
    this._el.appendChild(summary);

    refreshIcons();
  }

  _summaryRow(label, value) {
    const row = document.createElement('div');
    row.className = 'plan-summary-row';
    row.innerHTML = `<span>${label}</span><span>${value}</span>`;
    return row;
  }

  _gridCss(gs) {
    const cell = 22;
    const major = cell * gs.majorEvery;
    const mix = (a) => this._mixHex(gs.color, a);
    const lines = (c, lw, step) =>
      `repeating-linear-gradient(90deg, ${c} 0 ${lw}px, transparent ${lw}px ${step}px),` +
      `repeating-linear-gradient(180deg, ${c} 0 ${lw}px, transparent ${lw}px ${step}px)`;
    return `${lines(mix(gs.opacity), gs.lineWidth, cell)},${lines(mix(Math.min(1, gs.opacity * 2.5)), gs.lineWidth * 2, major)}`;
  }

  _mixHex(hex, alpha) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
