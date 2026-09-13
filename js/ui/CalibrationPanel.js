import { refreshIcons } from './icons.js';
import { MapScale, TILE_METRES } from '../core/MapScale.js';

const ROLE_LETTER = { across: 'A', down: 'B', check: 'C' };
const ROLE_LABEL = { across: 'Across', down: 'Down', check: 'Check angle' };
const PAIR_ORDER = ['across', 'down', 'check'];

export class CalibrationPanel {
  constructor(mapScale, calibrationTool, bus) {
    this.mapScale = mapScale;
    this.calibrationTool = calibrationTool;
    this.bus = bus;
    this._modal = document.getElementById('scale-modal');
    this._hint = document.getElementById('scale-hint');
    this._hintText = document.getElementById('scale-hint-text');
    this._previewBar = document.getElementById('scale-preview-bar');
    this._open = false;
    this._previewing = false;
    this._focusRole = null;
    this._focusRectangle = false;

    this._renderModal();

    bus.on('scale:openModal', () => this._openModal());
    bus.on('scale:changed', () => this._renderModal());
    bus.on('scale:lockChanged', () => this._renderModal());
    bus.on('calibration:modeChanged', () => this._renderModal());
    bus.on('calibration:methodChanged', () => this._renderModal());
    bus.on('calibration:unitChanged', () => this._renderModal());
    bus.on('calibration:pairsChanged', () => this._renderModal());
    bus.on('calibration:pairCompleted', (role) => {
      this._focusRole = role;
      this._renderModal();
    });
    bus.on('calibration:rectangleCompleted', () => {
      this._focusRectangle = true;
      this._renderModal();
    });
    bus.on('tool:changed', (name) => {
      if (name !== 'calibrate' && this._open && !this._previewing) this._closeModal();
    });
    bus.on('calibration:previewChanged', (active) => {
      this._previewing = active;
      if (active) this._closeModal(true);
      this._renderPreviewBar();
    });
  }

  _openModal() {
    this._open = true;
    this.bus.emit('tool:activate', 'calibrate');
    this._modal.classList.remove('hidden');
    this._renderModal();
  }

  _closeModal(skipToolChange) {
    this._open = false;
    this._modal.classList.add('hidden');
    this._hint.classList.add('hidden');
    if (!skipToolChange) this.bus.emit('tool:activate', 'select');
  }

  _renderModal() {
    if (!this._open) return;
    const isLocal = this.mapScale.mapMode === 'local';
    this._modal.innerHTML = '';

    // Map type (kept minimal — the redesign only covers local calibration)
    const typeField = document.createElement('div');
    const seg = document.createElement('div');
    seg.className = 'seg';
    seg.style.width = '100%';
    const localBtn = document.createElement('button');
    localBtn.className = 'seg-btn' + (isLocal ? ' active' : '');
    localBtn.style.flex = '1';
    localBtn.textContent = 'Local area';
    localBtn.addEventListener('click', () => { this.mapScale.mapMode = 'local'; });
    const worldBtn = document.createElement('button');
    worldBtn.className = 'seg-btn' + (!isLocal ? ' active' : '');
    worldBtn.style.flex = '1';
    worldBtn.textContent = 'World map';
    worldBtn.addEventListener('click', () => { this.mapScale.mapMode = 'world'; });
    seg.appendChild(localBtn);
    seg.appendChild(worldBtn);
    typeField.appendChild(seg);
    this._modal.appendChild(typeField);

    if (isLocal) {
      this._renderLocalModal();
    } else {
      this._renderWorldModal();
    }

    refreshIcons();
    this._renderHint();
  }

  _renderLocalModal() {
    const tool = this.calibrationTool;
    const method = tool.calibMethod;
    const unit = this.mapScale.calibrationUnit;

    const heading = document.createElement('div');
    heading.style.display = 'flex';
    heading.style.flexDirection = 'column';
    heading.style.gap = '6px';
    const h2 = document.createElement('div');
    h2.className = 'scale-modal-title';
    const desc = document.createElement('div');
    desc.className = 'scale-modal-desc';
    if (method === 'rectangle') {
      h2.textContent = 'Measure a rectangle';
      desc.textContent = 'Drop pins on the four corners of something rectangular you know the size of — a foundation, a floor section. This corrects real camera perspective, not just rotation and shear.';
    } else {
      h2.textContent = 'Measure in tiles';
      desc.textContent = 'Drop a pin at each end of something you can count, then say how many tiles long it is. Across and Down are enough; the optional Check edge validates rotation against a known cardinal build angle.';
    }
    heading.appendChild(h2);
    heading.appendChild(desc);
    this._modal.appendChild(heading);

    // Method toggle
    const methodField = document.createElement('div');
    const methodLabel = document.createElement('span');
    methodLabel.className = 'scale-field-label';
    methodLabel.textContent = 'Method';
    const methodSeg = document.createElement('div');
    methodSeg.className = 'seg';
    methodSeg.style.width = '100%';
    const pairsBtn = document.createElement('button');
    pairsBtn.className = 'seg-btn' + (method === 'pairs' ? ' active' : '');
    pairsBtn.style.flex = '1';
    pairsBtn.textContent = 'Pairs';
    pairsBtn.addEventListener('click', () => { tool.calibMethod = 'pairs'; });
    const rectBtn = document.createElement('button');
    rectBtn.className = 'seg-btn' + (method === 'rectangle' ? ' active' : '');
    rectBtn.style.flex = '1';
    rectBtn.textContent = 'Rectangle corners';
    rectBtn.addEventListener('click', () => { tool.calibMethod = 'rectangle'; });
    methodSeg.appendChild(pairsBtn);
    methodSeg.appendChild(rectBtn);
    methodField.appendChild(methodLabel);
    methodField.appendChild(methodSeg);
    this._modal.appendChild(methodField);

    // Unit toggle
    const unitField = document.createElement('div');
    const unitLabel = document.createElement('span');
    unitLabel.className = 'scale-field-label';
    unitLabel.textContent = 'Unit';
    const unitSeg = document.createElement('div');
    unitSeg.className = 'seg';
    unitSeg.style.width = '100%';
    const tilesBtn = document.createElement('button');
    tilesBtn.className = 'seg-btn' + (unit === 'tiles' ? ' active' : '');
    tilesBtn.style.flex = '1';
    tilesBtn.textContent = `Tiles (${TILE_METRES} m)`;
    tilesBtn.addEventListener('click', () => { this.mapScale.calibrationUnit = 'tiles'; });
    const metresBtn = document.createElement('button');
    metresBtn.className = 'seg-btn' + (unit === 'metres' ? ' active' : '');
    metresBtn.style.flex = '1';
    metresBtn.textContent = 'Metres';
    metresBtn.addEventListener('click', () => { this.mapScale.calibrationUnit = 'metres'; });
    unitSeg.appendChild(tilesBtn);
    unitSeg.appendChild(metresBtn);
    unitField.appendChild(unitLabel);
    unitField.appendChild(unitSeg);
    this._modal.appendChild(unitField);

    if (method === 'rectangle') {
      this._renderRectangleMethod(unit);
    } else {
      this._renderPairsMethod(unit);
    }
  }

  _renderPairsMethod(unit) {
    const tool = this.calibrationTool;
    const pairs = tool.pairs;

    const pairsField = document.createElement('div');
    pairsField.style.display = 'flex';
    pairsField.style.flexDirection = 'column';
    pairsField.style.gap = '8px';
    const pairsLabel = document.createElement('span');
    pairsLabel.className = 'scale-field-label';
    pairsLabel.textContent = 'Measurement pairs';
    pairsField.appendChild(pairsLabel);

    for (const role of PAIR_ORDER) {
      pairsField.appendChild(this._pairCard(role, pairs[role], unit, { mode: 'solve' }));
    }
    this._modal.appendChild(pairsField);

    this._modal.appendChild(Object.assign(document.createElement('div'), { className: 'scale-hr' }));

    const solve = MapScale.solveCalibration(pairs);
    const fitField = document.createElement('div');
    fitField.style.display = 'flex';
    fitField.style.flexDirection = 'column';
    fitField.style.gap = '6px';
    const fitLabel = document.createElement('span');
    fitLabel.className = 'scale-field-label';
    fitLabel.textContent = 'Solved fit';
    fitField.appendChild(fitLabel);

    const fmtPx = (v) => (v == null ? '—' : `${v.toFixed(1)} px`);
    fitField.appendChild(this._fitRow('Tile across', fmtPx(solve.pxPerTileX)));
    fitField.appendChild(this._fitRow('Tile down', fmtPx(solve.pxPerTileY)));
    fitField.appendChild(this._fitRow('Shear', solve.mode === 'affine' ? `${solve.shearDeg.toFixed(1)}°` : '—'));
    fitField.appendChild(this._fitRow('Residual', solve.residualPx == null ? '—' : `${solve.residualPx.toFixed(1)} px`,
      solve.residualPx != null && solve.residualPx < 1 ? '#9ee6a8' : null));

    if (solve.angleCheck) {
      fitField.appendChild(this._fitRow(
        'Angle check',
        `${solve.angleCheck.deviationDeg >= 0 ? '+' : ''}${solve.angleCheck.deviationDeg.toFixed(1)}° from ${solve.angleCheck.nearestMultipleDeg.toFixed(1)}°`,
        solve.angleCheck.flagged ? '#f5d547' : '#9ee6a8'
      ));
    }
    this._modal.appendChild(fitField);

    const info = document.createElement('div');
    info.className = 'scale-info-note';
    info.innerHTML = '<span class="icon"><i data-lucide="info"></i></span><span>Across and Down solve scale, rotation and shear — this assumes the source image has no real camera perspective. The Check edge nudges rotation/shear toward the nearest 22.5° build angle.</span>';
    this._modal.appendChild(info);

    this._renderActions(solve.mode === 'affine' || solve.mode === 'iso');
  }

  _renderRectangleMethod(unit) {
    const tool = this.calibrationTool;
    const rect = tool.rectangle;
    const rectSolve = MapScale.solveRectangle(rect.corners, rect.widthTiles, rect.heightTiles);

    const rectField = document.createElement('div');
    rectField.style.display = 'flex';
    rectField.style.flexDirection = 'column';
    rectField.style.gap = '8px';
    const rectLabel = document.createElement('span');
    rectLabel.className = 'scale-field-label';
    rectLabel.textContent = 'Rectangle';
    rectField.appendChild(rectLabel);
    rectField.appendChild(this._rectangleCard(unit, rect, rectSolve));
    this._modal.appendChild(rectField);

    const validateField = document.createElement('div');
    validateField.style.display = 'flex';
    validateField.style.flexDirection = 'column';
    validateField.style.gap = '8px';
    const validateLabel = document.createElement('span');
    validateLabel.className = 'scale-field-label';
    validateLabel.textContent = 'Validate (optional)';
    validateField.appendChild(validateLabel);
    const validateDesc = document.createElement('div');
    validateDesc.className = 'scale-modal-desc';
    validateDesc.style.marginTop = '-4px';
    validateDesc.textContent = 'Drop a pair elsewhere on the map to check the rectangle solve holds up away from the corners.';
    validateField.appendChild(validateDesc);

    const pairs = tool.pairs;
    for (const role of PAIR_ORDER) {
      validateField.appendChild(this._pairCard(role, pairs[role], unit, { mode: 'validate', rectSolve }));
    }
    this._modal.appendChild(validateField);

    this._modal.appendChild(Object.assign(document.createElement('div'), { className: 'scale-hr' }));

    const fitField = document.createElement('div');
    fitField.style.display = 'flex';
    fitField.style.flexDirection = 'column';
    fitField.style.gap = '6px';
    const fitLabel = document.createElement('span');
    fitLabel.className = 'scale-field-label';
    fitLabel.textContent = 'Solved fit';
    fitField.appendChild(fitLabel);
    fitField.appendChild(this._fitRow('Width edge', rectSolve ? `${rectSolve.widthPx.toFixed(0)} px` : '—'));
    fitField.appendChild(this._fitRow('Height edge', rectSolve ? `${rectSolve.heightPx.toFixed(0)} px` : '—'));
    fitField.appendChild(this._fitRow('Output scale', rectSolve ? `${(rectSolve.outPxPerMetre * TILE_METRES).toFixed(1)} px/tile` : '—'));
    this._modal.appendChild(fitField);

    const info = document.createElement('div');
    info.className = 'scale-info-note';
    info.innerHTML = '<span class="icon"><i data-lucide="info"></i></span><span>Four corners with a known size fully determine a true perspective correction — unlike Pairs, this un-converges vanishing lines from an angled shot.</span>';
    this._modal.appendChild(info);

    this._renderActions(!!rectSolve);
  }

  _renderActions(canStraighten) {
    const actions = document.createElement('div');
    actions.className = 'scale-actions';
    const row = document.createElement('div');
    row.className = 'row';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._closeModal());
    row.appendChild(cancelBtn);

    const applyBtn = document.createElement('button');
    applyBtn.className = 'primary';
    applyBtn.textContent = 'Straighten map';
    applyBtn.disabled = !canStraighten;
    applyBtn.addEventListener('click', () => this.bus.emit('calibration:apply'));
    row.appendChild(applyBtn);
    actions.appendChild(row);
    this._modal.appendChild(actions);
  }

  _rectangleCard(unit, rect, rectSolve) {
    const tool = this.calibrationTool;
    const placed = rect.corners.filter(Boolean).length;
    const card = document.createElement('div');
    card.className = 'scale-pair-card';

    const header = document.createElement('div');
    header.className = 'scale-pair-header';
    const badge = document.createElement('span');
    badge.className = 'scale-pair-badge';
    badge.textContent = '▭';
    const label = document.createElement('span');
    label.className = 'scale-pair-label';
    label.textContent = 'Corners 1–4';
    header.appendChild(badge);
    header.appendChild(label);

    if (placed > 0) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'scale-pair-clear';
      clearBtn.innerHTML = '<i data-lucide="trash-2"></i>';
      clearBtn.title = 'Clear the rectangle';
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        tool.clearRectangle();
      });
      header.appendChild(clearBtn);
    }
    card.appendChild(header);

    const value = document.createElement('div');
    value.className = 'scale-pair-value';
    value.style.flexWrap = 'wrap';

    if (placed < 4) {
      value.textContent = `Click the map to drop corner ${placed + 1} of 4`;
      value.classList.add('scale-pair-hint');
    } else {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.style.width = '100%';

      const makeInput = (value_, placeholder) => {
        const input = document.createElement('input');
        input.type = 'number';
        input.step = unit === 'tiles' ? '0.5' : (TILE_METRES / 2).toString();
        input.min = '0';
        input.className = 'scale-pair-input';
        input.style.width = '52px';
        input.value = value_ != null ? value_ : '';
        input.placeholder = placeholder;
        input.addEventListener('keydown', (e) => e.stopPropagation());
        return input;
      };

      const wDisplay = rect.widthTiles != null ? (unit === 'tiles' ? rect.widthTiles : rect.widthTiles * TILE_METRES) : null;
      const hDisplay = rect.heightTiles != null ? (unit === 'tiles' ? rect.heightTiles : rect.heightTiles * TILE_METRES) : null;
      const wInput = makeInput(wDisplay, 'W');
      const hInput = makeInput(hDisplay, 'H');
      const commit = () => {
        const wv = parseFloat(wInput.value);
        const hv = parseFloat(hInput.value);
        const wTiles = wv > 0 ? (unit === 'tiles' ? wv : wv / TILE_METRES) : null;
        const hTiles = hv > 0 ? (unit === 'tiles' ? hv : hv / TILE_METRES) : null;
        tool.setRectangleSize(wTiles, hTiles);
      };
      wInput.addEventListener('change', commit);
      hInput.addEventListener('change', commit);

      const xSep = document.createElement('span');
      xSep.textContent = '×';
      xSep.style.color = 'var(--color-neutral-500)';
      const unitLabel = document.createElement('span');
      unitLabel.className = 'scale-pair-unit';
      unitLabel.textContent = unit === 'tiles' ? 'tiles' : 'm';

      row.appendChild(wInput);
      row.appendChild(xSep);
      row.appendChild(hInput);
      row.appendChild(unitLabel);
      value.appendChild(row);

      const readout = document.createElement('span');
      readout.className = 'scale-pair-readout';
      readout.style.width = '100%';
      readout.style.textAlign = 'right';
      if (rectSolve) {
        readout.textContent = `${rectSolve.widthPx.toFixed(0)} × ${rectSolve.heightPx.toFixed(0)} px`;
      } else {
        const wPx = Math.hypot(rect.corners[1].x - rect.corners[0].x, rect.corners[1].y - rect.corners[0].y);
        const hPx = Math.hypot(rect.corners[2].x - rect.corners[1].x, rect.corners[2].y - rect.corners[1].y);
        readout.textContent = `${wPx.toFixed(0)} × ${hPx.toFixed(0)} px`;
      }
      value.appendChild(readout);

      if (this._focusRectangle) {
        this._focusRectangle = false;
        requestAnimationFrame(() => wInput.focus());
      }
    }
    card.appendChild(value);
    return card;
  }

  _pairCard(role, pair, unit, opts) {
    const tool = this.calibrationTool;
    const mode = opts && opts.mode || 'solve';
    const rectSolve = opts && opts.rectSolve;
    const selected = tool.selectedRole === role;
    const card = document.createElement('div');
    card.className = 'scale-pair-card' + (selected ? ' selected' : '');
    card.addEventListener('click', () => { tool.selectedRole = role; });

    const header = document.createElement('div');
    header.className = 'scale-pair-header';
    const badge = document.createElement('span');
    badge.className = 'scale-pair-badge';
    badge.textContent = ROLE_LETTER[role];
    const label = document.createElement('span');
    label.className = 'scale-pair-label';
    label.textContent = ROLE_LABEL[role] + (role === 'check' ? ' (optional)' : '');
    header.appendChild(badge);
    header.appendChild(label);

    if (pair.a || pair.b) {
      const clearBtn = document.createElement('button');
      clearBtn.className = 'scale-pair-clear';
      clearBtn.innerHTML = '<i data-lucide="trash-2"></i>';
      clearBtn.title = 'Clear this pair';
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        tool.clearPair(role);
      });
      header.appendChild(clearBtn);
    }
    card.appendChild(header);

    const value = document.createElement('div');
    value.className = 'scale-pair-value';

    if (!pair.a) {
      value.textContent = 'Click the map to drop the first pin';
      value.classList.add('scale-pair-hint');
    } else if (!pair.b) {
      value.textContent = 'Click the map to drop the second pin';
      value.classList.add('scale-pair-hint');
    } else if (role === 'check') {
      const dx = pair.b.x - pair.a.x, dy = pair.b.y - pair.a.y;
      const lenPx = Math.hypot(dx, dy);
      if (mode === 'validate' && rectSolve) {
        const ev = MapScale.evaluatePairAgainstRectangle(rectSolve, pair);
        const span = document.createElement('span');
        if (ev) {
          const sign = ev.angleDeviationDeg >= 0 ? '+' : '';
          span.textContent = `${sign}${ev.angleDeviationDeg.toFixed(1)}° from ${ev.nearestMultipleDeg.toFixed(1)}°`;
          span.style.color = ev.angleFlagged ? '#f5d547' : '#9ee6a8';
        } else {
          span.textContent = `${lenPx.toFixed(0)} px edge`;
        }
        value.appendChild(span);
      } else {
        value.textContent = `${lenPx.toFixed(0)} px edge · feeds rotation/shear`;
        value.classList.add('scale-pair-hint');
      }
    } else {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = unit === 'tiles' ? '0.5' : (TILE_METRES / 2).toString();
      input.min = '0';
      input.className = 'scale-pair-input';
      const displayVal = pair.tiles != null
        ? (unit === 'tiles' ? pair.tiles : pair.tiles * TILE_METRES)
        : '';
      input.value = displayVal;
      input.placeholder = unit === 'tiles' ? 'tiles' : 'm';
      input.addEventListener('keydown', (e) => e.stopPropagation());
      input.addEventListener('change', () => {
        const v = parseFloat(input.value);
        if (!(v > 0)) { tool.setPairTiles(role, null); return; }
        tool.setPairTiles(role, unit === 'tiles' ? v : v / TILE_METRES);
      });
      const unitLabel = document.createElement('span');
      unitLabel.className = 'scale-pair-unit';
      unitLabel.textContent = unit === 'tiles' ? 'tiles' : 'm';

      const readout = document.createElement('span');
      readout.className = 'scale-pair-readout';
      const dx = pair.b.x - pair.a.x, dy = pair.b.y - pair.a.y;
      const lenPx = Math.hypot(dx, dy);

      if (mode === 'validate') {
        const ev = rectSolve ? MapScale.evaluatePairAgainstRectangle(rectSolve, pair) : null;
        if (ev) {
          if (pair.tiles > 0) {
            const sign = ev.deviationPct >= 0 ? '+' : '';
            readout.textContent = `implies ${ev.impliedTiles.toFixed(2)} tiles (${sign}${ev.deviationPct.toFixed(1)}%)`;
            readout.style.color = ev.lengthFlagged ? '#f5d547' : '#9ee6a8';
          } else {
            readout.textContent = `implies ${ev.impliedTiles.toFixed(2)} tiles`;
          }
        } else {
          readout.textContent = `${lenPx.toFixed(0)} px`;
        }
      } else if (pair.tiles > 0) {
        const metres = pair.tiles * TILE_METRES;
        const pxPerTile = lenPx / pair.tiles;
        readout.textContent = unit === 'tiles'
          ? `${metres.toFixed(1)} m · ${pxPerTile.toFixed(1)} px/tile`
          : `${pair.tiles.toFixed(2)} tiles · ${pxPerTile.toFixed(1)} px/tile`;
      } else {
        readout.textContent = `${lenPx.toFixed(0)} px`;
      }

      value.appendChild(input);
      value.appendChild(unitLabel);
      value.appendChild(readout);

      if (this._focusRole === role) {
        this._focusRole = null;
        requestAnimationFrame(() => input.focus());
      }
    }
    card.appendChild(value);
    return card;
  }

  _fitRow(label, value, color) {
    const row = document.createElement('div');
    row.className = 'scale-fit-row';
    const l = document.createElement('span');
    l.textContent = label;
    const v = document.createElement('span');
    v.textContent = value;
    if (color) v.style.color = color;
    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  _renderWorldModal() {
    const heading = document.createElement('div');
    heading.style.display = 'flex';
    heading.style.flexDirection = 'column';
    heading.style.gap = '6px';
    const h2 = document.createElement('div');
    h2.className = 'scale-modal-title';
    h2.textContent = 'Set map scale';
    const desc = document.createElement('div');
    desc.className = 'scale-modal-desc';
    desc.textContent = 'Drag the reference circle to match a known distance on the world map.';
    heading.appendChild(h2);
    heading.appendChild(desc);
    this._modal.appendChild(heading);

    const scaleField = document.createElement('div');
    const scaleLabel = document.createElement('span');
    scaleLabel.className = 'scale-field-label';
    scaleLabel.textContent = 'Scale';
    const scaleRow = document.createElement('div');
    scaleRow.className = 'scale-input-row';
    const mppInput = document.createElement('input');
    mppInput.type = 'number';
    mppInput.className = 'scale-input';
    mppInput.style.width = '72px';
    mppInput.step = '0.01';
    mppInput.min = '0.01';
    mppInput.value = this.mapScale.metresPerPixel.toFixed(2);
    mppInput.disabled = this.mapScale.locked;
    mppInput.addEventListener('change', () => {
      const val = parseFloat(mppInput.value);
      if (val > 0 && isFinite(val)) this.mapScale.metresPerPixel = val;
    });
    mppInput.addEventListener('keydown', (e) => e.stopPropagation());
    const mppLabel = document.createElement('span');
    mppLabel.className = 'scale-input-label';
    mppLabel.textContent = 'm / px';
    const lockBtn = document.createElement('button');
    lockBtn.className = 'btn-chip';
    lockBtn.style.marginLeft = 'auto';
    lockBtn.innerHTML = this.mapScale.locked
      ? '<span><i data-lucide="lock"></i></span><span>Locked</span>'
      : '<span><i data-lucide="unlock"></i></span><span>Unlocked</span>';
    lockBtn.style.border = '1px solid var(--color-neutral-800)';
    lockBtn.addEventListener('click', () => { this.mapScale.locked = !this.mapScale.locked; });
    scaleRow.appendChild(mppInput);
    scaleRow.appendChild(mppLabel);
    scaleRow.appendChild(lockBtn);
    scaleField.appendChild(scaleLabel);
    scaleField.appendChild(scaleRow);
    this._modal.appendChild(scaleField);

    const actions = document.createElement('div');
    actions.className = 'scale-actions';
    const row = document.createElement('div');
    row.className = 'row';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._closeModal());
    row.appendChild(cancelBtn);
    const doneBtn = document.createElement('button');
    doneBtn.className = 'primary';
    doneBtn.textContent = 'Done';
    doneBtn.addEventListener('click', () => this._closeModal());
    row.appendChild(doneBtn);
    actions.appendChild(row);
    this._modal.appendChild(actions);
  }

  _renderHint() {
    if (!this._open || this.mapScale.mapMode !== 'local') {
      this._hint.classList.add('hidden');
      return;
    }
    this._hintText.textContent = 'Drag a pin to move it · pins stay exactly where you put them';
    this._hint.classList.remove('hidden');
  }

  _renderPreviewBar() {
    this._previewBar.innerHTML = '';
    if (!this._previewing) {
      this._previewBar.classList.add('hidden');
      return;
    }
    this._previewBar.classList.remove('hidden');

    const info = document.createElement('div');
    info.className = 'preview-info';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = 'Does the grid line up with the ground?';
    const sub = document.createElement('div');
    sub.className = 'sub';
    sub.textContent = `Scale set to ${this.mapScale.metresPerPixel.toFixed(2)} m/px · grid anchored to the calibration origin`;
    info.appendChild(title);
    info.appendChild(sub);
    this._previewBar.appendChild(info);

    const sep = document.createElement('span');
    sep.style.width = '1px';
    sep.style.height = '34px';
    sep.style.background = 'var(--color-neutral-800)';
    this._previewBar.appendChild(sep);

    const actions = document.createElement('div');
    actions.className = 'preview-actions';
    const discardBtn = document.createElement('button');
    discardBtn.innerHTML = '<span><i data-lucide="undo-2"></i></span>Discard, back to pins';
    discardBtn.addEventListener('click', () => this.bus.emit('calibration:previewCancel'));
    const keepBtn = document.createElement('button');
    keepBtn.className = 'primary';
    keepBtn.innerHTML = '<span><i data-lucide="check"></i></span>Keep this alignment';
    keepBtn.addEventListener('click', () => this.bus.emit('calibration:previewConfirm'));
    actions.appendChild(discardBtn);
    actions.appendChild(keepBtn);
    this._previewBar.appendChild(actions);

    refreshIcons();
  }
}
