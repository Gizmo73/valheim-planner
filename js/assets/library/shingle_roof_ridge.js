export default {
  name: 'Shingle Roof Ridge',
  category: 'shingle',
  ids: ['darkwood_roof_top', 'darkwood_roof_top_45', 'darkwood_roof_top_67'],
  size: [2, 2],
  shape: 'rect',
  snaps: [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [1, 0], [0, 1], [-1, 0]],
  modifier: 'roof-ridge',
  colors: { main: '#4d4038' },
  draw(ctx, w, h, c, u) {
    // Overlapping shingles, laid bottom course first so each course overlaps the one below.
    ctx.fillStyle = u.shade(c.main, -0.5);
    ctx.fillRect(0, 0, w, h);
    const sw = 0.25 * u.ppm, course = 0.2 * u.ppm;
    let row = 0;
    for (let y = h; y > -course * 2; y -= course, row++) {
      for (let x = (row % 2) * -sw / 2; x < w; x += sw) {
        ctx.fillStyle = u.shade(c.main, u.range(-0.15, 0.15));
        ctx.beginPath();
        ctx.moveTo(x + 1, y);
        ctx.lineTo(x + sw - 1, y);
        ctx.lineTo(x + sw - 1, y + course * 1.4);
        ctx.quadraticCurveTo(x + sw / 2, y + course * 1.8, x + 1, y + course * 1.4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = u.rgba('#000000', 0.45);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  },
};
