export default {
  name: 'Yggdrasil Shoot',
  category: 'nature',
  ids: ['YggaShoot1', 'YggaShoot2', 'YggaShoot3', 'YggaShoot_small1'],
  size: [8, 8],
  shape: 'circle',
  snaps: [[0, 0]],
  modifier: null,
  colors: { main: '#8f86b8' },
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
