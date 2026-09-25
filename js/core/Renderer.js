// Draw order: terrain -> screenshot -> (grid) -> layers bottom to top -> (grid) -> anchor -> tool overlay.
export class Renderer {
  constructor(canvas, { bus, viewport, grid, plan, library, tools }) {
    Object.assign(this, { canvas, viewport, grid, plan, library, tools });
    this.ctx = canvas.getContext('2d');
    this._queued = false;
    bus.on('render', () => this.request());
    new ResizeObserver(() => this._resize()).observe(canvas.parentElement);
    this._resize();
  }

  _resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.viewport.resize(w, h);
    this.request();
  }

  request() {
    if (this._queued) return;
    this._queued = true;
    requestAnimationFrame(() => {
      this._queued = false;
      this._draw();
    });
  }

  _draw() {
    const { ctx, viewport: vp, grid, plan } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, vp.width, vp.height);

    ctx.save();
    vp.applyTo(ctx);
    plan.terrain?.draw(ctx);
    plan.screenshot?.draw(ctx);
    ctx.restore();

    if (!grid.settings.abovePieces) grid.draw(ctx, vp);

    ctx.save();
    vp.applyTo(ctx);
    for (const it of plan.drawOrder()) this.library.drawItem(ctx, it, vp.zoom);
    ctx.restore();

    if (grid.settings.abovePieces) grid.draw(ctx, vp);
    if (plan.anchor) this._drawAnchor(ctx, vp);
    this.tools.drawOverlay(ctx, vp);
  }

  _drawAnchor(ctx, vp) {
    const p = vp.worldToScreen(0, 0);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ff6b6b';
    ctx.strokeStyle = '#161826';
    ctx.lineWidth = 2;
    ctx.fillRect(-5, -5, 10, 10);
    ctx.strokeRect(-5, -5, 10, 10);
    ctx.restore();
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#ffd9d9';
    ctx.textAlign = 'center';
    ctx.fillText(this.plan.anchor.text, p.x, p.y - 12);
  }
}
