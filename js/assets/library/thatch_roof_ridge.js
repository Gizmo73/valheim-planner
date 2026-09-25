export default {
  name: 'Thatch Roof Ridge',
  category: 'thatch',
  ids: ['wood_roof_top', 'wood_roof_top_45', 'wood_roof_top_67'],
  size: [2, 2],
  shape: 'rect',
  snaps: [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]],
  modifier: 'roof-ridge',
  colors: { main: '#c29b38' },
  draw(ctx, w, h, c, u) {
    // Straw laid down the slope, tied in courses every 0.5 m.
    ctx.fillStyle = c.main;
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1.5;
    for (let x = 0; x < w; x += 2.5) {
      ctx.strokeStyle = u.rgba(u.shade(c.main, u.range(-0.4, 0.35)), 0.6);
      ctx.beginPath();
      ctx.moveTo(x + u.range(-1, 1), 0);
      ctx.lineTo(x + u.range(-2, 2), h);
      ctx.stroke();
    }
    ctx.fillStyle = u.rgba(u.shade(c.main, -0.6), 0.35);
    for (let y = 0.5 * u.ppm; y < h; y += 0.5 * u.ppm) ctx.fillRect(0, y - 2, w, 3);
  },
};
