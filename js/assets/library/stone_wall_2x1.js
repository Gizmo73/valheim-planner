export default {
  name: 'Stone Wall 2x1',
  category: 'stone',
  ids: ['stone_wall_2x1'],
  size: [2, 1],
  shape: 'rect',
  snaps: [[-1, -0.5], [1, -0.5], [1, 0.5], [-1, 0.5], [0, -0.5], [1, 0], [0, 0.5], [-1, 0]],
  modifier: null,
  colors: { main: '#8a867e' },
  draw(ctx, w, h, c, u) {
    // Dressed blocks along the wall, joints staggered between courses.
    if (h > w) { ctx.translate(w, 0); ctx.rotate(Math.PI / 2); [w, h] = [h, w]; }
    const course = Math.min(h, 0.5 * u.ppm);
    ctx.fillStyle = u.shade(c.main, -0.45);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += course, row++) {
      let x = row % 2 ? -0.5 * u.ppm : 0;
      while (x < w) {
        const len = u.range(0.8, 1.2) * u.ppm;
        ctx.fillStyle = u.shade(c.main, u.range(-0.12, 0.12));
        ctx.fillRect(x + 2, y + 2, len - 4, course - 4);
        x += len;
      }
    }
  },
};
