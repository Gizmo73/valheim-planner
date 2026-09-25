export default {
  name: 'Grausten 4x1',
  category: 'grausten',
  ids: [],
  size: [4, 1],
  shape: 'rect',
  snaps: [[-2, -0.5], [2, -0.5], [2, 0.5], [-2, 0.5], [0, -0.5], [2, 0], [0, 0.5], [-2, 0]],
  modifier: null,
  colors: { main: '#62646a' },
  draw(ctx, w, h, c, u) {
    // Long blocks in running bond with pale mortar lines.
    if (h > w) { ctx.translate(w, 0); ctx.rotate(Math.PI / 2); [w, h] = [h, w]; }
    const course = Math.min(h, 0.5 * u.ppm), joint = Math.max(2, 0.03 * u.ppm);
    ctx.fillStyle = u.shade(c.main, 0.25);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0, row = 0; y < h; y += course, row++) {
      for (let x = row % 2 ? -0.5 * u.ppm : 0; x < w; x += u.ppm) {
        ctx.fillStyle = u.shade(c.main, u.range(-0.1, 0.1));
        ctx.fillRect(x + joint / 2, y + joint / 2, u.ppm - joint, course - joint);
      }
    }
  },
};
