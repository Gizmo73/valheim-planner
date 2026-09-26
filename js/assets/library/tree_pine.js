export default {
  name: 'Pine',
  category: 'nature',
  ids: ['Pinetree_01'],
  size: [5, 5],
  shape: 'circle',
  snaps: [[0, 0]],
  modifier: null,
  colors: { main: '#3c6340' },
  draw(ctx, w, h, c, u) {
    // Conifer from above: layered star of branches around the trunk.
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2;
    for (let layer = 0; layer < 4; layer++) {
      const lr = r * (1 - layer * 0.22), n = 9 - layer, turn = u.range(0, Math.PI);
      ctx.fillStyle = u.shade(c.main, -0.3 + layer * 0.15);
      ctx.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = turn + (i / (n * 2)) * Math.PI * 2, d = i % 2 ? lr * 0.55 : lr;
        ctx.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#4a3423';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  },
};
