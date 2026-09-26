export default {
  name: 'Log Beam 2m',
  category: 'wood',
  ids: ['wood_wall_log'],
  size: [2, 0.35],
  shape: 'rect',
  snaps: [[-1, 0], [1, 0]],
  modifier: null,
  colors: { main: '#6b4a2b' },
  draw(ctx, w, h, c, u) {
    // Round log: bark edges shading to a lighter core, with a few knots.
    if (h > w) { ctx.translate(w, 0); ctx.rotate(Math.PI / 2); [w, h] = [h, w]; }
    const body = ctx.createLinearGradient(0, 0, 0, h);
    body.addColorStop(0, u.shade(c.main, -0.45));
    body.addColorStop(0.5, u.shade(c.main, 0.15));
    body.addColorStop(1, u.shade(c.main, -0.45));
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = u.rgba(u.shade(c.main, -0.6), 0.5);
    ctx.lineWidth = 1;
    for (let i = 0; i < w / 6; i++) {
      const x = u.range(0, w), y = u.range(0, h);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + u.range(0.1, 0.4) * u.ppm, y + u.range(-1, 1));
      ctx.stroke();
    }
    ctx.fillStyle = u.rgba(u.shade(c.main, -0.6), 0.6);
    for (let k = 0; k < w / u.ppm; k++) {
      ctx.beginPath();
      ctx.ellipse(u.range(0, w), u.range(h * 0.3, h * 0.7), h * 0.12, h * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};
