// Draw order: terrain -> screenshot -> (grid) -> layers bottom to top -> (grid) -> anchor -> compass -> tool overlay.
// While aligning, the screenshot goes over the pieces so the features you pin aren't hidden.
export class Renderer {
  constructor(canvas, { bus, viewport, grid, plan, library, tools, lighting }) {
    Object.assign(this, { canvas, viewport, grid, plan, library, tools, lighting });
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
    const aligning = this.tools.name === 'calibrate';
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, vp.width, vp.height);

    ctx.save();
    vp.applyTo(ctx);
    plan.terrain?.draw(ctx, this.lighting);
    if (!aligning) plan.screenshot?.draw(ctx);
    ctx.restore();

    if (!grid.settings.abovePieces) grid.draw(ctx, vp);

    ctx.save();
    vp.applyTo(ctx);
    for (const it of plan.drawOrder()) this.library.drawItem(ctx, it, vp.zoom, 1, this.lighting);
    if (aligning) plan.screenshot?.draw(ctx);
    ctx.restore();

    if (grid.settings.abovePieces) grid.draw(ctx, vp);
    if (plan.anchor) this._drawAnchor(ctx, vp);
    this._drawCompass(ctx, vp);
    this.tools.drawOverlay(ctx, vp);
  }

  // North and the light direction, which both turn with the view.
  _drawCompass(ctx, vp) {
    const r = 20, cx = r + 16, cy = vp.height - r - 16;
    const toScreen = (x, y) => {
      const a = vp.worldToScreen(0, 0), b = vp.worldToScreen(x, y);
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
    };
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(22, 24, 38, 0.8)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(181, 171, 252, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const n = toScreen(0, -1);
    ctx.font = '600 10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ddd9fd';
    ctx.fillText('N', cx + n.x * (r - 8), cy + n.y * (r - 8));
    const a = this.lighting.settings.azimuth * Math.PI / 180;
    const l = toScreen(Math.sin(a), -Math.cos(a));
    ctx.beginPath();
    ctx.arc(cx + l.x * r, cy + l.y * r, 5, 0, Math.PI * 2);
    ctx.fillStyle = this.lighting.settings.roofs ? '#f5d547' : 'rgba(245, 213, 71, 0.4)';
    ctx.fill();
    ctx.restore();
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
