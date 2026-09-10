export class CalibrationPanel {
  constructor(mapScale, bus) {
    this.mapScale = mapScale;
    this.bus = bus;
    this._container = null;
    this._modeSelect = null;
    this._mppInput = null;
    this._lockBtn = null;
    this._calBtn = null;
    this._tileGroup = null;
    this._tileWInput = null;
    this._tileHInput = null;
    this._applyBtn = null;
    this._isCalibrating = false;
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

    // Tile size group (local mode only)
    this._tileGroup = document.createElement('div');
    this._tileGroup.className = 'calibration-tile-group';

    const tileLabel = document.createElement('span');
    tileLabel.className = 'calibration-label';
    tileLabel.textContent = 'Tiles:';
    this._tileGroup.appendChild(tileLabel);

    this._tileWInput = document.createElement('input');
    this._tileWInput.type = 'number';
    this._tileWInput.className = 'calibration-tile-input';
    this._tileWInput.min = '1';
    this._tileWInput.step = '1';
    this._tileWInput.value = this.mapScale.tileW;
    this._tileWInput.title = 'Reference width (tiles)';
    this._tileWInput.addEventListener('change', () => {
      const val = parseInt(this._tileWInput.value, 10);
      if (val > 0) this.mapScale.tileW = val;
    });
    this._tileWInput.addEventListener('keydown', (e) => e.stopPropagation());
    this._tileGroup.appendChild(this._tileWInput);

    const tileSep = document.createElement('span');
    tileSep.className = 'calibration-tile-sep';
    tileSep.textContent = '×';
    this._tileGroup.appendChild(tileSep);

    this._tileHInput = document.createElement('input');
    this._tileHInput.type = 'number';
    this._tileHInput.className = 'calibration-tile-input';
    this._tileHInput.min = '1';
    this._tileHInput.step = '1';
    this._tileHInput.value = this.mapScale.tileH;
    this._tileHInput.title = 'Reference height (tiles)';
    this._tileHInput.addEventListener('change', () => {
      const val = parseInt(this._tileHInput.value, 10);
      if (val > 0) this.mapScale.tileH = val;
    });
    this._tileHInput.addEventListener('keydown', (e) => e.stopPropagation());
    this._tileGroup.appendChild(this._tileHInput);

    this._container.appendChild(this._tileGroup);

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
    this._tileGroup.style.display = isLocal ? 'flex' : 'none';
    this._applyBtn.style.display = (isLocal && this._isCalibrating) ? 'inline-block' : 'none';
    if (this._modeSelect) this._modeSelect.value = this.mapScale.mapMode;
  }
}
