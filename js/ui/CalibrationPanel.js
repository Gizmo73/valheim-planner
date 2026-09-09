export class CalibrationPanel {
  constructor(mapScale, bus) {
    this.mapScale = mapScale;
    this.bus = bus;
    this._container = null;
    this._mppInput = null;
    this._lockBtn = null;
    this._calBtn = null;
    this._init();

    bus.on('map:loaded', () => this._show());
    bus.on('scale:changed', () => this._updateInput());
    bus.on('scale:lockChanged', () => this._updateLock());
    bus.on('tool:changed', (name) => {
      if (this._calBtn) this._calBtn.classList.toggle('active', name === 'calibrate');
    });
  }

  _init() {
    const toolbar = document.getElementById('toolbar');

    this._container = document.createElement('div');
    this._container.className = 'calibration-controls';
    this._container.style.display = 'none';

    const sep = document.createElement('div');
    sep.className = 'toolbar-sep';

    this._calBtn = document.createElement('button');
    this._calBtn.className = 'toolbar-btn';
    this._calBtn.innerHTML = '<span class="toolbar-icon">⊙</span><span class="toolbar-label">Calibrate</span>';
    this._calBtn.addEventListener('click', () => this.bus.emit('tool:activate', 'calibrate'));

    const mppLabel = document.createElement('span');
    mppLabel.className = 'calibration-label';
    mppLabel.textContent = 'm/px:';

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

    this._lockBtn = document.createElement('button');
    this._lockBtn.className = 'calibration-lock';
    this._lockBtn.textContent = '🔓';
    this._lockBtn.title = 'Lock scale';
    this._lockBtn.addEventListener('click', () => {
      this.mapScale.locked = !this.mapScale.locked;
    });

    this._container.appendChild(sep);
    this._container.appendChild(this._calBtn);
    this._container.appendChild(mppLabel);
    this._container.appendChild(this._mppInput);
    this._container.appendChild(this._lockBtn);

    const zoomLabel = document.getElementById('zoom-label');
    toolbar.insertBefore(this._container, zoomLabel);
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
}
