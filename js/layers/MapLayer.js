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

  setPreviewCorrection(anchorX, anchorY, scaleX, scaleY) {
    this._previewCorrection = { anchorX, anchorY, scaleX, scaleY };
    this.bus.emit('render:request');
  }

  clearPreviewCorrection() {
    this._previewCorrection = null;
    this.bus.emit('render:request');
  }

  applyScaleCorrection(anchorX, anchorY, scaleX, scaleY) {
    const src = this.image;
    const w = this.width;
    const h = this.height;
    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');
    ctx.translate(anchorX, anchorY);
    ctx.scale(scaleX, scaleY);
    ctx.translate(-anchorX, -anchorY);
    ctx.drawImage(src, 0, 0, w, h);
    return out;
  }

  render(ctx, viewport, canvasWidth, canvasHeight) {
    if (!this.image) return;
    if (this._previewCorrection) {
      const { anchorX, anchorY, scaleX, scaleY } = this._previewCorrection;
      ctx.save();
      ctx.translate(anchorX, anchorY);
      ctx.scale(scaleX, scaleY);
      ctx.translate(-anchorX, -anchorY);
      ctx.drawImage(this.image, 0, 0, this.width, this.height);
      ctx.restore();
    } else {
      ctx.drawImage(this.image, 0, 0, this.width, this.height);
    }
  }
}
