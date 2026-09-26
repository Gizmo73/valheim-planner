export default {
  name: 'Stone Stairs',
  category: 'stone',
  ids: ['stone_stair'],
  size: [2, 2],
  shape: 'rect',
  snaps: [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]],
  modifier: 'stairs',
  colors: { main: '#8a867e' },
  draw(ctx, w, h, c, u) {
    // Cobbles of varied size on a mortar bed.
    const size = 0.33 * u.ppm;
    ctx.fillStyle = u.shade(c.main, -0.45);
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row * size < h; row++) {
      for (let x = (row % 2) * -size / 2; x < w; x += size) {
        const bw = size * u.range(0.8, 0.92), bh = size * u.range(0.8, 0.92);
        const bx = x + (size - bw) / 2 + u.range(-1, 1), by = row * size + (size - bh) / 2 + u.range(-1, 1);
        ctx.fillStyle = u.shade(c.main, u.range(-0.15, 0.12));
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, size * 0.3);
        ctx.fill();
        ctx.fillStyle = u.rgba('#ffffff', 0.07);
        ctx.beginPath();
        ctx.roundRect(bx + bw * 0.15, by + bh * 0.1, bw * 0.5, bh * 0.35, size * 0.15);
        ctx.fill();
      }
    }
  },
};
