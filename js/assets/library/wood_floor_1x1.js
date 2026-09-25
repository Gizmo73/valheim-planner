export default {
  name: 'Wood Floor 1x1',
  category: 'wood',
  ids: ['wood_floor_1x1'],
  size: [1, 1],
  shape: 'rect',
  snaps: [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5], [0, -0.5], [0.5, 0], [0, 0.5], [-0.5, 0]],
  modifier: null,
  colors: { main: '#9a7236' },
  draw(ctx, w, h, c, u) {
    // Planks 0.25 m wide along the width, with staggered joints.
    const plank = 0.25 * u.ppm;
    ctx.fillStyle = u.shade(c.main, -0.5);
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += plank) {
      let x = -u.range(0, 1) * u.ppm;
      while (x < w) {
        const len = u.range(1, 2) * u.ppm;
        ctx.fillStyle = u.shade(c.main, u.range(-0.12, 0.12));
        ctx.fillRect(x + 1, y + 1, len - 2, plank - 2);
        ctx.strokeStyle = u.rgba(u.shade(c.main, -0.4), 0.45);
        ctx.lineWidth = 1;
        for (let g = 0; g < 3; g++) {
          const gy = y + plank * u.range(0.2, 0.8);
          ctx.beginPath();
          ctx.moveTo(x + 2, gy);
          ctx.bezierCurveTo(x + len / 3, gy + u.range(-2, 2), x + len * 2 / 3, gy + u.range(-2, 2), x + len - 2, gy);
          ctx.stroke();
        }
        x += len;
      }
    }
  },
};
