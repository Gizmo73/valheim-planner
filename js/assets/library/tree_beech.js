export default {
  name: 'Beech',
  category: 'nature',
  ids: ['Beech1', 'Beech_small1', 'Beech_small2'],
  size: [7, 7],
  shape: 'circle',
  snaps: [[0, 0]],
  modifier: null,
  colors: { main: '#4f7a32' },
  draw(ctx, w, h, c, u) {
    // Leafy canopy from above, trunk showing through the middle.
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
    ctx.fillStyle = u.shade(c.main, -0.35);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.95, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 40; i++) {
      const a = u.range(0, Math.PI * 2), d = Math.sqrt(u.rand()) * r * 0.7;
      ctx.fillStyle = u.shade(c.main, u.range(-0.2, 0.25));
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, r * u.range(0.15, 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#4a3423';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  },
};
