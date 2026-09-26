export default {
  name: 'Wood Wall Sloped',
  category: 'wood',
  ids: ['wood_wall_roof_a', 'wood_wall_roof_45', 'wood_wall_roof_67_a', 'wood_wall_roof_upsidedown', 'wood_wall_roof_45_upsidedown', 'wood_wall_roof_67_upsidedown', 'wood_wall_roof_top', 'wood_wall_roof_top_45', 'wood_wall_roof_top_67'],
  size: [2, 0.2],
  shape: 'rect',
  snaps: [[-1, 0], [1, 0]],
  modifier: null,
  colors: { main: '#9a7236' },
  draw(ctx, w, h, c, u) {
    // Grain along the long side; darker edges read as a squared beam.
    if (h > w) { ctx.translate(w, 0); ctx.rotate(Math.PI / 2); [w, h] = [h, w]; }
    ctx.fillStyle = c.main;
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
    for (let i = 0; i < h / 2; i++) {
      const y = u.range(0, h);
      ctx.strokeStyle = u.rgba(u.shade(c.main, u.range(-0.45, 0.15)), 0.5);
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 12) ctx.lineTo(x, y + u.range(-0.8, 0.8));
      ctx.stroke();
    }
    const edge = ctx.createLinearGradient(0, 0, 0, h);
    edge.addColorStop(0, u.rgba('#000000', 0.4));
    edge.addColorStop(0.25, u.rgba('#000000', 0));
    edge.addColorStop(0.75, u.rgba('#000000', 0));
    edge.addColorStop(1, u.rgba('#000000', 0.4));
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, w, h);
  },
};
