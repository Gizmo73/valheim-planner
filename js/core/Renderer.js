export class Renderer {
  constructor(canvas, viewport, layerManager, toolManager, bus, gridSettings) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.viewport = viewport;
    this.layerManager = layerManager;
    this.toolManager = toolManager;
    this.bus = bus;
    this.gridSettings = gridSettings || null;
    this.needsRender = true;
    this._rafId = null;

    bus.on('render:request', () => { this.needsRender = true; });

    const ro = new ResizeObserver(() => this._resize());
    ro.observe(canvas.parentElement);
    this._resize();
    this._loop();
  }

  _resize() {
    const parent = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = w;
    this.height = h;
    this.needsRender = true;
  }

  _loop() {
    if (this.needsRender) {
      this.needsRender = false;
      this._draw();
    }
    this._rafId = requestAnimationFrame(() => this._loop());
  }

  _draw() {
    const ctx = this.ctx;
    const vp = this.viewport;

    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.translate(vp.panX, vp.panY);
    ctx.scale(vp.zoom, vp.zoom);

    this._renderLayers(ctx, vp);

    ctx.restore();

    if (this.toolManager) {
      this.toolManager.renderOverlay(ctx, vp);
    }
  }

  // Working-layer grids sit either above or below the asset layer,
  // controlled by gridSettings.abovePieces — everything else renders in
  // its normal layer-array order.
  _renderLayers(ctx, vp) {
    const layers = this.layerManager.layers;
    const abovePieces = this.gridSettings ? this.gridSettings.abovePieces : true;

    const mapLayers = layers.filter(l => l.visible && l.type === 'map');
    const workingLayers = layers.filter(l => l.visible && l.type === 'working');
    const otherLayers = layers.filter(l => l.visible && l.type !== 'map' && l.type !== 'working');

    for (const l of mapLayers) l.render(ctx, vp, this.width, this.height);
    for (const wl of workingLayers) wl.renderBase(ctx, vp, this.width, this.height);
    if (!abovePieces) for (const wl of workingLayers) wl.renderGrid(ctx, vp, this.width, this.height);
    for (const l of otherLayers) l.render(ctx, vp, this.width, this.height);
    if (abovePieces) for (const wl of workingLayers) wl.renderGrid(ctx, vp, this.width, this.height);
  }
}
