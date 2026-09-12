import { refreshIcons } from './icons.js';

export class CalibrationPanel {
  constructor(mapScale, calibrationTool, bus) {
    this.mapScale = mapScale;
    this.calibrationTool = calibrationTool;
    this.bus = bus;
    this._modal = document.getElementById('scale-modal');
    this._backdrop = document.getElementById('scale-backdrop');
    this._hint = document.getElementById('scale-hint');
    this._hintText = document.getElementById('scale-hint-text');
    this._previewBar = document.getElementById('scale-preview-bar');
    this._open = false;
    this._previewing = false;

    this._renderModal();

    bus.on('scale:openModal', () => this._openModal());
    bus.on('scale:changed', () => this._renderModal());
    bus.on('scale:lockChanged', () => this._renderModal());
    bus.on('calibration:modeChanged', () => this._renderModal());
    bus.on('calibration:gridChanged', () => this._renderModal());
    bus.on('calibration:snapResult', () => this._renderModal());
    bus.on('tool:changed', (name) => {
      if (name !== 'calibrate' && this._open && !this._previewing) this._closeModal();
    });
    bus.on('calibration:previewChanged', (active) => {
      this._previewing = active;
      if (active) this._closeModal(true);
      this._renderPreviewBar();
    });

    // Refresh the hint/pin counter while dragging pins.
    bus.on('render:request', () => {
      if (this._open && this.mapScale.mapMode === 'local') this._renderHint();
    });
  }

  _openModal() {
    this._open = true;
    this.bus.emit('tool:activate', 'calibrate');
    this._modal.classList.remove('hidden');
    this._backdrop.classList.remove('hidden');
    this._renderModal();
  }

  _closeModal(skipToolChange) {
    this._open = false;
    this._modal.classList.add('hidden');
    this._backdrop.classList.add('hidden');
    this._hint.classList.add('hidden');
    if (!skipToolChange) this.bus.emit('tool:activate', 'select');
  }

  _renderModal() {
    if (!this._open) return;
    const isLocal = this.mapScale.mapMode === 'local';

    this._modal.innerHTML = '';

    const heading = document.createElement('div');
    heading.style.display = 'flex';
    heading.style.flexDirection = 'column';
    heading.style.gap = '6px';
    const h2 = document.createElement('div');
    h2.className = 'scale-modal-title';
    h2.textContent = 'Set map scale';
    const desc = document.createElement('div');
    desc.className = 'scale-modal-desc';
    desc.textContent = isLocal
      ? 'Drop a pin on each corner of a shape you know the size of. The planner works out metres per pixel and straightens the photo.'
      : 'Drag the reference circle to match a known distance on the world map.';
    heading.appendChild(h2);
    heading.appendChild(desc);
    this._modal.appendChild(heading);

    // Map type
    const typeField = document.createElement('div');
    const typeLabel = document.createElement('span');
    typeLabel.className = 'scale-field-label';
    typeLabel.textContent = 'Map type';
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
    typeField.appendChild(typeLabel);
    typeField.appendChild(seg);
    this._modal.appendChild(typeField);

    if (isLocal) {
      const gridField = document.createElement('div');
      const gridLabel = document.createElement('span');
      gridLabel.className = 'scale-field-label';
      gridLabel.textContent = 'Reference grid';
      gridField.appendChild(gridLabel);

      const row1 = document.createElement('div');
      row1.className = 'scale-input-row';
      const colsInput = document.createElement('input');
      colsInput.type = 'number';
      colsInput.className = 'scale-input';
      colsInput.style.width = '54px';
      colsInput.min = '2';
      colsInput.max = '10';
      colsInput.value = this.mapScale.cbCols;
      colsInput.addEventListener('change', () => { this.mapScale.cbCols = parseInt(colsInput.value, 10); });
      colsInput.addEventListener('keydown', (e) => e.stopPropagation());
      const acrossLabel = document.createElement('span');
      acrossLabel.className = 'scale-input-label';
      acrossLabel.textContent = 'pins across';
      const rowsInput = document.createElement('input');
      rowsInput.type = 'number';
      rowsInput.className = 'scale-input';
      rowsInput.style.width = '54px';
      rowsInput.min = '2';
      rowsInput.max = '10';
      rowsInput.value = this.mapScale.cbRows;
      rowsInput.addEventListener('change', () => { this.mapScale.cbRows = parseInt(rowsInput.value, 10); });
      rowsInput.addEventListener('keydown', (e) => e.stopPropagation());
      const downLabel = document.createElement('span');
      downLabel.className = 'scale-input-label';
      downLabel.textContent = 'down';
      row1.appendChild(colsInput);
      row1.appendChild(acrossLabel);
      row1.appendChild(rowsInput);
      row1.appendChild(downLabel);
      gridField.appendChild(row1);

      const row2 = document.createElement('div');
      row2.className = 'scale-input-row';
      row2.style.marginTop = '7px';
      const spacingInput = document.createElement('input');
      spacingInput.type = 'number';
      spacingInput.className = 'scale-input';
      spacingInput.style.width = '54px';
      spacingInput.min = '2';
      spacingInput.value = this.mapScale.cbSpacing;
      spacingInput.addEventListener('change', () => { this.mapScale.cbSpacing = parseFloat(spacingInput.value); });
      spacingInput.addEventListener('keydown', (e) => e.stopPropagation());
      const spacingLabel = document.createElement('span');
      spacingLabel.className = 'scale-input-label';
      spacingLabel.textContent = 'metres between pins';
      row2.appendChild(spacingInput);
      row2.appendChild(spacingLabel);
      gridField.appendChild(row2);

      this._modal.appendChild(gridField);
    }

    // Scale
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

    // Actions
    const actions = document.createElement('div');
    actions.className = 'scale-actions';

    if (isLocal) {
      const snapBtn = document.createElement('button');
      snapBtn.innerHTML = '<span><i data-lucide="crosshair"></i></span>Snap pins to nearest corner';
      snapBtn.style.display = 'flex';
      snapBtn.style.alignItems = 'center';
      snapBtn.style.justifyContent = 'center';
      snapBtn.style.gap = '7px';
      snapBtn.addEventListener('click', () => this.bus.emit('calibration:snapAll'));
      actions.appendChild(snapBtn);
    }

    const row = document.createElement('div');
    row.className = 'row';
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => this._closeModal());
    row.appendChild(cancelBtn);

    if (isLocal) {
      const applyBtn = document.createElement('button');
      applyBtn.className = 'primary';
      applyBtn.textContent = 'Straighten map';
      applyBtn.addEventListener('click', () => this.bus.emit('calibration:apply'));
      row.appendChild(applyBtn);
    } else {
      const doneBtn = document.createElement('button');
      doneBtn.className = 'primary';
      doneBtn.textContent = 'Done';
      doneBtn.addEventListener('click', () => this._closeModal());
      row.appendChild(doneBtn);
    }
    actions.appendChild(row);
    this._modal.appendChild(actions);

    refreshIcons();
    this._renderHint();
  }

  _renderHint() {
    if (!this._open || this.mapScale.mapMode !== 'local') {
      this._hint.classList.add('hidden');
      return;
    }
    const enabled = this.calibrationTool.enabled;
    const total = enabled.length;
    const placed = total; // pins always exist once the checkerboard is generated
    this._hintText.textContent = total > 0
      ? `Drag each pin onto a grid corner · ${placed} of ${total} placed`
      : 'Drag each pin onto a grid corner';
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
    sub.textContent = `Scale set to ${this.mapScale.metresPerPixel.toFixed(2)} m/px · grid anchored to the top-left pin`;
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
