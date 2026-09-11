export class MapLayer {
  constructor(bus) {
    this.bus = bus;
    this.id = 'map';
    this.name = 'Map';
    this.type = 'map';
    this.visible = true;
    this.image = null;
    this.width = 0;
    this.height = 0;
    this._dataURL = null;
    this._previewCorrection = null;
  }

  loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this._dataURL = e.target.result;
        const img = new Image();
        img.onload = () => {
          this.image = img;
          this.width = img.naturalWidth;
          this.height = img.naturalHeight;
          this.bus.emit('map:loaded', { width: this.width, height: this.height });
          this.bus.emit('render:request');
          resolve();
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  loadFromDataURL(dataURL) {
    return new Promise((resolve, reject) => {
      this._dataURL = dataURL;
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this.width = img.naturalWidth;
        this.height = img.naturalHeight;
        this.bus.emit('map:loaded', { width: this.width, height: this.height });
        this.bus.emit('render:request');
        resolve();
      };
      img.onerror = reject;
      img.src = dataURL;
    });
  }

  applyCorrectedImage(canvas) {
    this.image = canvas;
    this.width = canvas.width;
    this.height = canvas.height;
    this._dataURL = null;
    this.bus.emit('map:loaded', { width: this.width, height: this.height });
    this.bus.emit('render:request');
  }

  getDataURL() {
    if (!this._dataURL && this.image && this.image instanceof HTMLCanvasElement) {
      this._dataURL = this.image.toDataURL('image/jpeg', 0.92);
    }
    return this._dataURL;
  }

  setPreviewCorrectionField(anchorX, anchorY, mpp, correctionFn, hasCorrections) {
    this._previewCorrection = { anchorX, anchorY, mpp, correctionFn, hasCorrections };
    this.bus.emit('render:request');
  }

  clearPreviewCorrection() {
    this._previewCorrection = null;
    this.bus.emit('render:request');
  }

  applyMeshWarpCorrection(anchorX, anchorY, mpp, correctionFn) {
    const w = this.width;
    const h = this.height;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');
    const cellSize = 16;
    for (let sy = 0; sy < h; sy += cellSize) {
      for (let sx = 0; sx < w; sx += cellSize) {
        const sw = Math.min(cellSize, w - sx);
        const sh = Math.min(cellSize, h - sy);
        const gx = (sx + sw / 2 - anchorX) * mpp;
        const gy = (sy + sh / 2 - anchorY) * mpp;
        const corr = correctionFn(gx, gy);
        const dx = anchorX + (sx - anchorX) * corr.corrX;
        const dy = anchorY + (sy - anchorY) * corr.corrY;
        const dw = sw * corr.corrX;
        const dh = sh * corr.corrY;
        ctx.drawImage(this.image, sx, sy, sw, sh, dx, dy, dw, dh);
      }
    }
    return out;
  }

  render(ctx, viewport, canvasWidth, canvasHeight) {
    if (!this.image) return;
    if (this._previewCorrection && this._previewCorrection.hasCorrections && this._previewCorrection.hasCorrections()) {
      this._renderMeshWarp(ctx);
    } else {
      ctx.drawImage(this.image, 0, 0, this.width, this.height);
    }
  }

  _renderMeshWarp(ctx) {
    const { anchorX, anchorY, mpp, correctionFn } = this._previewCorrection;
    const w = this.width;
    const h = this.height;
    const cellSize = 32;
    for (let sy = 0; sy < h; sy += cellSize) {
      for (let sx = 0; sx < w; sx += cellSize) {
        const sw = Math.min(cellSize, w - sx);
        const sh = Math.min(cellSize, h - sy);
        const gx = (sx + sw / 2 - anchorX) * mpp;
        const gy = (sy + sh / 2 - anchorY) * mpp;
        const corr = correctionFn(gx, gy);
        const dx = anchorX + (sx - anchorX) * corr.corrX;
        const dy = anchorY + (sy - anchorY) * corr.corrY;
        const dw = sw * corr.corrX;
        const dh = sh * corr.corrY;
        ctx.drawImage(this.image, sx, sy, sw, sh, dx, dy, dw, dh);
      }
    }
  }
}
