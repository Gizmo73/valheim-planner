import { readWorldFolder, filterNearSign, decompressTCData, parseTCData, HASH_TCDATA } from './saveReader.js';
import { loadPieceLookup, lookupByHash } from './pieceLookup.js';
import { refreshIcons } from '../ui/icons.js';

export class ImportUI {
  constructor(bus, blueprintLayer, viewport, renderer, layerManager) {
    this.bus = bus;
    this.blueprintLayer = blueprintLayer;
    this.viewport = viewport;
    this.renderer = renderer;
    this.layerManager = layerManager;
    this._radius = 40;
    this._modal = null;
    this._slider = null;
    this._sliderContainer = null;
    this._buildModal();
    this._buildSlider();
  }

  _buildModal() {
    this._modal = document.createElement('div');
    this._modal.id = 'import-modal';
    this._modal.className = 'import-modal hidden';
    this._modal.innerHTML = `
      <div class="import-modal-content">
        <div class="import-header">
          <h2><i data-lucide="folder-open"></i> Import World Save</h2>
          <button class="import-close" title="Close"><i data-lucide="x"></i></button>
        </div>
        <div class="import-body">
          <div class="import-step import-step-pick">
            <p>Select your Valheim world folder. It lives at:</p>
            <code>%USERPROFILE%\\AppData\\LocalLow\\IronGate\\Valheim\\worlds_local\\&lt;WorldName&gt;</code>
            <div class="import-actions">
              <button class="btn-accent import-pick-btn"><i data-lucide="folder-open"></i> Choose World Folder</button>
              <div class="import-radius-row">
                <label>Radius: <input type="number" class="import-radius" value="40" min="10" max="200" step="5"> m</label>
              </div>
            </div>
          </div>
          <div class="import-step import-step-progress hidden">
            <div class="import-progress-bar"><div class="import-progress-fill"></div></div>
            <p class="import-status">Reading...</p>
          </div>
          <div class="import-step import-step-result hidden">
            <div class="import-summary"></div>
            <div class="import-sign-select hidden"></div>
            <div class="import-result-actions">
              <button class="btn-accent import-confirm-btn">Load Blueprint</button>
              <button class="btn-outline import-cancel-btn">Cancel</button>
            </div>
          </div>
          <div class="import-step import-step-error hidden">
            <p class="import-error-text"></p>
            <button class="btn-outline import-retry-btn">Try Again</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('app').appendChild(this._modal);

    this._modal.querySelector('.import-close').addEventListener('click', () => this.hide());
    this._modal.querySelector('.import-pick-btn').addEventListener('click', () => this._pickFolder());
    this._modal.querySelector('.import-confirm-btn').addEventListener('click', () => this._confirm());
    this._modal.querySelector('.import-cancel-btn').addEventListener('click', () => this.hide());
    this._modal.querySelector('.import-retry-btn').addEventListener('click', () => this._showStep('pick'));
    this._modal.querySelector('.import-radius').addEventListener('change', (e) => {
      this._radius = parseInt(e.target.value, 10) || 40;
    });

    this._pendingResult = null;
    this._selectedSign = null;
  }

  _buildSlider() {
    this._sliderContainer = document.createElement('div');
    this._sliderContainer.id = 'height-slider-container';
    this._sliderContainer.className = 'height-slider-container hidden';
    this._sliderContainer.innerHTML = `
      <div class="height-slider-header">
        <span class="height-slider-icon"><i data-lucide="sliders-horizontal"></i></span>
        <span class="height-slider-label">Height cut</span>
        <span class="height-slider-value"></span>
        <button class="height-slider-toggle" title="Toggle terrain edits"><i data-lucide="mountain"></i></button>
        <button class="height-slider-close" title="Hide"><i data-lucide="x"></i></button>
      </div>
      <input type="range" class="height-slider" min="-10" max="20" step="0.5" value="20">
    `;
    document.getElementById('canvas-container').appendChild(this._sliderContainer);

    this._slider = this._sliderContainer.querySelector('.height-slider');
    this._slider.addEventListener('input', () => this._onSliderChange());

    this._sliderContainer.querySelector('.height-slider-close').addEventListener('click', () => {
      this._sliderContainer.classList.add('hidden');
    });

    this._sliderContainer.querySelector('.height-slider-toggle').addEventListener('click', () => {
      this.blueprintLayer.showTerrain = !this.blueprintLayer.showTerrain;
      this._sliderContainer.querySelector('.height-slider-toggle').classList.toggle('active', this.blueprintLayer.showTerrain);
      this.bus.emit('render:request');
    });
  }

  _onSliderChange() {
    const val = parseFloat(this._slider.value);
    this.blueprintLayer.setCutHeight(val);
    this._sliderContainer.querySelector('.height-slider-value').textContent = `${val >= 100 ? 'all' : val.toFixed(1)} m`;
  }

  show() {
    this._modal.classList.remove('hidden');
    this._showStep('pick');
    refreshIcons();
  }

  hide() {
    this._modal.classList.add('hidden');
  }

  showSlider() {
    const bl = this.blueprintLayer;
    this._slider.min = Math.floor(bl.minHeight * 2) / 2;
    this._slider.max = Math.ceil(bl.maxHeight * 2) / 2 + 5;
    this._slider.value = this._slider.max;
    this._sliderContainer.classList.remove('hidden');
    this._onSliderChange();
    refreshIcons();
  }

  _showStep(name) {
    for (const el of this._modal.querySelectorAll('.import-step')) {
      el.classList.add('hidden');
    }
    this._modal.querySelector(`.import-step-${name}`).classList.remove('hidden');
  }

  async _pickFolder() {
    let files;
    if (window.showDirectoryPicker) {
      try {
        const dirHandle = await window.showDirectoryPicker();
        files = await this._collectFiles(dirHandle);
      } catch (e) {
        if (e.name === 'AbortError') return;
        this._showError(e.message);
        return;
      }
    } else {
      files = await this._pickViaInput();
      if (!files) return;
    }

    await this._processFiles(files);
  }

  async _collectFiles(dirHandle, path) {
    const files = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        files.push(file);
      }
    }
    return files;
  }

  _pickViaInput() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.multiple = true;
      input.addEventListener('change', () => {
        resolve(input.files.length > 0 ? Array.from(input.files) : null);
      });
      input.click();
    });
  }

  async _processFiles(files) {
    this._showStep('progress');
    const progressBar = this._modal.querySelector('.import-progress-fill');
    const statusEl = this._modal.querySelector('.import-status');

    try {
      await loadPieceLookup();

      const result = await readWorldFolder(files, (msg) => {
        statusEl.textContent = msg;
      });

      this._pendingResult = result;

      if (result.signs.length === 0) {
        this._showStep('result');
        const summary = this._modal.querySelector('.import-summary');
        summary.innerHTML = `
          <p><strong>No BLUEPRINT sign found.</strong></p>
          <p>Found ${result.playerBuilt.length} player-built pieces in ${result.chunkFileCount} chunks (${result.totalZdos.toLocaleString()} total ZDOs).</p>
          <p>Place a sign reading "BLUEPRINT" in your world at the desired plan centre, save, and try again.</p>
        `;
        this._modal.querySelector('.import-confirm-btn').classList.add('hidden');
        return;
      }

      this._selectedSign = result.signs[0];
      const nearPieces = filterNearSign(result.playerBuilt, this._selectedSign, this._radius);

      const counts = {};
      for (const p of nearPieces) {
        const info = lookupByHash(p.prefabHash);
        const name = info ? info.en : `Unknown (${p.prefabHash})`;
        counts[name] = (counts[name] || 0) + 1;
      }
      const topPieces = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);

      this._showStep('result');
      const summary = this._modal.querySelector('.import-summary');
      summary.innerHTML = `
        <p>Generation <strong>${result.generation}</strong> &middot; ${result.chunkFileCount} chunks &middot; ${result.totalZdos.toLocaleString()} ZDOs</p>
        <p><strong>${result.playerBuilt.length}</strong> player-built pieces total, <strong>${nearPieces.length}</strong> within ${this._radius} m of BLUEPRINT sign</p>
        <p>Sign at (${this._selectedSign.pos.x.toFixed(1)}, ${this._selectedSign.pos.y.toFixed(1)}, ${this._selectedSign.pos.z.toFixed(1)})</p>
        <table class="import-piece-table">
          <thead><tr><th>Piece</th><th>Count</th></tr></thead>
          <tbody>${topPieces.map(([n, c]) => `<tr><td>${n}</td><td>${c}</td></tr>`).join('')}</tbody>
        </table>
        ${result.rotationLog.length > 0 ? `<p class="import-note">${result.rotationLog.length} rotation quirks logged (0.5° snaps applied)</p>` : ''}
      `;
      this._modal.querySelector('.import-confirm-btn').classList.remove('hidden');

      if (result.signs.length > 1) {
        const selectDiv = this._modal.querySelector('.import-sign-select');
        selectDiv.classList.remove('hidden');
        selectDiv.innerHTML = `<p>Multiple BLUEPRINT signs found:</p><select class="import-sign-picker">
          ${result.signs.map((s, i) => `<option value="${i}">(${s.pos.x.toFixed(1)}, ${s.pos.z.toFixed(1)})</option>`).join('')}
        </select>`;
        selectDiv.querySelector('select').addEventListener('change', (e) => {
          this._selectedSign = result.signs[parseInt(e.target.value, 10)];
        });
      }

      progressBar.style.width = '100%';
    } catch (e) {
      console.error('Import error:', e);
      this._showError(e.message);
    }
  }

  _showError(msg) {
    this._showStep('error');
    this._modal.querySelector('.import-error-text').textContent = msg;
  }

  async _confirm() {
    if (!this._pendingResult || !this._selectedSign) return;

    const result = this._pendingResult;
    const sign = this._selectedSign;
    const nearPieces = filterNearSign(result.playerBuilt, sign, this._radius);

    this.blueprintLayer.setPieces(nearPieces, sign);

    const nearTCs = result.terrainCompilers.filter(tc => {
      const dx = tc.pos.x - sign.pos.x;
      const dz = tc.pos.z - sign.pos.z;
      return Math.sqrt(dx * dx + dz * dz) <= this._radius + 64;
    });

    for (const tc of nearTCs) {
      if (tc.bytes && tc.bytes.has(1305470367)) {
        try {
          const raw = tc.bytes.get(1305470367);
          const decompressed = await decompressTCData(raw);
          tc.parsed = parseTCData(decompressed);
        } catch (e) {
          console.warn('Failed to decompress TCData:', e);
        }
      }
      tc.zdo = tc;
    }

    this.blueprintLayer.setTerrainCompilers(nearTCs.filter(tc => tc.parsed));

    if (!this.layerManager.getById('blueprint')) {
      this.layerManager.addLayer(this.blueprintLayer);
    }
    this.blueprintLayer.visible = true;

    const bounds = this.blueprintLayer.getBounds();
    if (bounds) {
      const w = bounds.maxX - bounds.minX;
      const h = bounds.maxY - bounds.minY;
      this.viewport.fitRect(bounds.minX, bounds.minY, w, h, this.renderer.width, this.renderer.height);
    }

    document.getElementById('empty-state').style.display = 'none';

    this.hide();
    this.showSlider();
    this.bus.emit('render:request');
  }
}
