export default {
  name: 'Stone Pillar',
  category: 'stone',
  ids: ['stone_pillar'],
  size: [1, 1],
  shape: 'rect',
  snaps: [[0, 0]],
  modifier: null,
  colors: { main: '#8a867e' },
  draw(ctx, w, h, c, u) {
    // A single dressed block with a bevelled top.
    const b = Math.min(w, h) * 0.18;
    ctx.fillStyle = u.shade(c.main, -0.2);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = c.main;
    ctx.fillRect(b, b, w - b * 2, h - b * 2);
    ctx.fillStyle = u.rgba('#ffffff', 0.08);
    ctx.fillRect(b, b, w - b * 2, (h - b * 2) / 3);
  },
};
