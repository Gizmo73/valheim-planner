export class CalibrationPanel {
  constructor(mapScale, bus) {
    this.mapScale = mapScale;
    this.bus = bus;
    this._container = null;
    this._modeSelect = null;
    this._mppInput = null;
    this._lockBtn = null;
    this._calBtn = null;
    this._gridGroup = null;
    this._colsInput = null;
    this._rowsInput = null;
    this._spacingInput = null;
    this._snapBtn = null;
    this._applyBtn = null;
    this._previewGroup = null;
    this._confirmBtn = null;
    this._cancelBtn = null;
    this._isCalibrating = false;
    this._isPreviewing = false;
    this._init();

    bus.on('map:loaded', () => this._show());
    bus.on('scale:changed', () => this._updateInput());
    bus.on('scale:lockChanged', () => this._updateLock());
    bus.on('tool:changed', (name) => {
      this._isCalibrating = name === 'calibrate';
      if (this._calBtn) this._calBtn.classList.toggle('active', this._isCalibrating);
      this._updateVisibility();
    });
    bus.on('calibration:modeChanged', () => this._updateVisibility());
    bus.on('calibration:previewChanged', (active) => {
      this._isPreviewing = active;
      this._updateVisibility();
    });
  }

  _init() {
    const toolbar = document.getElementById('toolbar');

    this._container = document.createElement('div');
    this._container.className = 'calibration-controls';
    this._container.style.display = 'none';

    const sep = document.createElement('div');
    sep.className = 'toolbar-sep';
    this._container.appendChild(sep);

    // Mode dropdown
    this._modeSelect = document.createElement('select');
    this._modeSelect.className = 'calibration-select';
    this._modeSelect.title = 'Map type';
    const worldOpt = document.createElement('option');
    worldOpt.value = 'world';
    worldOpt.textContent = 'World Map';
    const localOpt = document.createElement('option');
    localOpt.value = 'local';
    localOpt.textContent = 'Local Area';
    this._modeSelect.appendChild(worldOpt);
    this._modeSelect.appendChild(localOpt);
    this._modeSelect.value = this.mapScale.mapMode;
    this._modeSelect.addEventListener('change', () => {
      this.mapScale.mapMode = this._modeSelect.value;
      this._updateVisibility();
    });
    this._modeSelect.addEventListener('keydown', (e) => e.stopPropagation());
    this._container.appendChild(this._modeSelect);

    // Calibrate button
    this._calBtn = document.createElement('button');
    this._calBtn.className = 'toolbar-btn';
    this._calBtn.innerHTML = '<span class="toolbar-icon">&#x2299;</span><span class="toolbar-label">Calibrate</span>';
    this._calBtn.addEventListener('click', () => this.bus.emit('tool:activate', 'calibrate'));
    this._container.appendChild(this._calBtn);

    // Grid config group (local mode only)
    this._gridGroup = document.createElement('div');
    this._gridGroup.className = 'calibration-tile-group';

    const gridLabel = document.createElement('span');
    gridLabel.className = 'calibration-label';
    gridLabel.textContent = 'Grid:';
    this._gridGroup.appendChild(gridLabel);

    this._colsInput = document.createElement('input');
    this._colsInput.type = 'number';
    this._colsInput.className = 'calibration-tile-input';
    this._colsInput.min = '2';
    this._colsInput.max = '10';
    this._colsInput.step = '1';
    this._colsInput.value = this.mapScale.cbCols;
    this._colsInput.title = 'Columns of checkerboard targets';
    this._colsInput.addEventListener('change', () => {
      const val = parseInt(this._colsInput.value, 10);
      if (val >= 2 && val <= 10) this.mapScale.cbCols = val;
    });
    this._colsInput.addEventListener('keydown', (e) => e.stopPropagation());
    this._gridGroup.appendChild(this._colsInput);

    const sep1 = document.createElement('span');
    sep1.className = 'calibration-tile-sep';
    sep1.textContent = '×';
    this._gridGroup.appendChild(sep1);

    this._rowsInput = document.createElement('input');
    this._rowsInput.type = 'number';
    this._rowsInput.className = 'calibration-tile-input';
    this._rowsInput.min = '2';
    this._rowsInput.max = '10';
    this._rowsInput.step = '1';
    this._rowsInput.value = this.mapScale.cbRows;
    this._rowsInput.title = 'Rows of checkerboard targets';
    this._rowsInput.addEventListener('change', () => {
      const val = parseInt(this._rowsInput.value, 10);
      if (val >= 2 && val <= 10) this.mapScale.cbRows = val;
    });
    this._rowsInput.addEventListener('keydown', (e) => e.stopPropagation());
    this._gridGroup.appendChild(this._rowsInput);

    const sep2 = document.createElement('span');
    sep2.className = 'calibration-tile-sep';
    sep2.textContent = '@';
    this._gridGroup.appendChild(sep2);

    this._spacingInput = document.createElement('input');
    this._spacingInput.type = 'number';
    this._spacingInput.className = 'calibration-tile-input calibration-spacing-input';
    this._spacingInput.min = '2';
    this._spacingInput.step = '1';
    this._spacingInput.value = this.mapScale.cbSpacing;
    this._spacingInput.title = 'Spacing between targets (metres)';
    this._spacingInput.addEventListener('change', () => {
      const val = parseFloat(this._spacingInput.value);
      if (val >= 2 && isFinite(val)) this.mapScale.cbSpacing = val;
    });
    this._spacingInput.addEventListener('keydown', (e) => e.stopPropagation());
    this._gridGroup.appendChild(this._spacingInput);

    const mLabel = document.createElement('span');
    mLabel.className = 'calibration-tile-sep';
    mLabel.textContent = 'm';
    this._gridGroup.appendChild(mLabel);

    this._container.appendChild(this._gridGroup);

    // Snap All button
    this._snapBtn = document.createElement('button');
    this._snapBtn.className = 'calibration-apply';
    this._snapBtn.textContent = 'Snap All';
    this._snapBtn.title = 'Auto-snap all enabled pins to nearest X-corner';
    this._snapBtn.addEventListener('click', () => {
      this.bus.emit('calibration:snapAll');
    });
    this._container.appendChild(this._snapBtn);

    // m/px label and input
    const mppLabel = document.createElement('span');
    mppLabel.className = 'calibration-label';
    mppLabel.textContent = 'm/px:';
    this._container.appendChild(mppLabel);

    this._mppInput = document.createElement('input');
    this._mppInput.type = 'number';
    this._mppInput.className = 'calibration-input';
    this._mppInput.step = '0.01';
    this._mppInput.min = '0.01';
    this._mppInput.value = this.mapScale.metresPerPixel.toFixed(2);
    this._mppInput.addEventListener('change', () => {
      const val = parseFloat(this._mppInput.value);
      if (val > 0 && isFinite(val)) {
        this.mapScale.metresPerPixel = val;
      }
    });
    this._mppInput.addEventListener('keydown', (e) => e.stopPropagation());
    this._container.appendChild(this._mppInput);

    // Lock button
    this._lockBtn = document.createElement('button');
    this._lockBtn.className = 'calibration-lock';
    this._lockBtn.textContent = '🔓';
    this._lockBtn.title = 'Lock scale';
    this._lockBtn.addEventListener('click', () => {
      this.mapScale.locked = !this.mapScale.locked;
    });
    this._container.appendChild(this._lockBtn);

    // Apply button (local mode, calibrating)
    this._applyBtn = document.createElement('button');
    this._applyBtn.className = 'calibration-apply';
    this._applyBtn.textContent = 'Apply';
    this._applyBtn.title = 'Apply perspective correction';
    this._applyBtn.addEventListener('click', () => {
      this.bus.emit('calibration:apply');
    });
    this._container.appendChild(this._applyBtn);

    // Preview confirm/cancel group
    this._previewGroup = document.createElement('div');
    this._previewGroup.className = 'calibration-preview-group';

    this._confirmBtn = document.createElement('button');
    this._confirmBtn.className = 'calibration-confirm';
    this._confirmBtn.textContent = 'Confirm';
    this._confirmBtn.title = 'Accept grid alignment and finalize';
    this._confirmBtn.addEventListener('click', () => {
      this.bus.emit('calibration:previewConfirm');
    });
    this._previewGroup.appendChild(this._confirmBtn);

    this._cancelBtn = document.createElement('button');
    this._cancelBtn.className = 'calibration-cancel';
    this._cancelBtn.textContent = 'Cancel';
    this._cancelBtn.title = 'Discard corrections and go back';
    this._cancelBtn.addEventListener('click', () => {
      this.bus.emit('calibration:previewCancel');
    });
    this._previewGroup.appendChild(this._cancelBtn);

    this._container.appendChild(this._previewGroup);

    const zoomLabel = document.getElementById('zoom-label');
    toolbar.insertBefore(this._container, zoomLabel);

    this._updateVisibility();
  }

  _show() {
    this._container.style.display = 'flex';
  }

  _updateInput() {
    this._mppInput.value = this.mapScale.metresPerPixel.toFixed(2);
  }

  _updateLock() {
    this._lockBtn.textContent = this.mapScale.locked ? '🔒' : '🔓';
    this._lockBtn.title = this.mapScale.locked ? 'Unlock scale' : 'Lock scale';
    this._mppInput.disabled = this.mapScale.locked;
  }

  _updateVisibility() {
    const isLocal = this.mapScale.mapMode === 'local';
    const previewing = this._isPreviewing;

    this._gridGroup.style.display = (isLocal && !previewing) ? 'flex' : 'none';
    this._snapBtn.style.display = (isLocal && this._isCalibrating && !previewing) ? 'inline-block' : 'none';
    this._applyBtn.style.display = (isLocal && this._isCalibrating && !previewing) ? 'inline-block' : 'none';
    this._previewGroup.style.display = previewing ? 'flex' : 'none';
    this._calBtn.style.display = previewing ? 'none' : '';
    this._modeSelect.style.display = previewing ? 'none' : '';
    this._modeSelect.disabled = previewing;

    if (this._modeSelect) this._modeSelect.value = this.mapScale.mapMode;
  }
}
