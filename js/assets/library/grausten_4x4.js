export default {
  name: 'Grausten 4x4',
  category: 'grausten',
  ids: [],
  size: [4, 4],
  shape: 'rect',
  snaps: [[-2, -2], [2, -2], [2, 2], [-2, 2], [0, -2], [2, 0], [0, 2], [-2, 0]],
  modifier: null,
  colors: { main: '#62646a' },
  draw(ctx, w, h, c, u) {
    // Square slabs with deep mortar joints and a little surface speckle.
    const tile = 0.5 * u.ppm, joint = Math.max(2, 0.03 * u.ppm);
    ctx.fillStyle = u.shade(c.main, -0.5);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) {
        ctx.fillStyle = u.shade(c.main, u.range(-0.1, 0.1));
        ctx.fillRect(x + joint / 2, y + joint / 2, tile - joint, tile - joint);
        ctx.fillStyle = u.rgba('#000000', 0.12);
        for (let s = 0; s < 6; s++) {
          ctx.beginPath();
          ctx.arc(x + u.range(0, tile), y + u.range(0, tile), u.range(0.5, 2), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  },
};
