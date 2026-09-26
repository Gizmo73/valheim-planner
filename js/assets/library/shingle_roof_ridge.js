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
    // Pointed shingles in offset rows, 0.5 m wide, tips on the bottom edge.
    const sw = 0.5 * u.ppm, sh = sw * 1.5, step = sh * 0.5;
    const k = u.ppm / 64; // line weights as they were at 64 px/m
    ctx.fillStyle = u.shade(c.main, -0.12);
    ctx.fillRect(0, 0, w, h);
    const rows = Math.ceil(h / step);
    const top = h - rows * step;
    for (let r = -1; r <= rows; r++) {
      const y = top + r * step;
      const odd = Math.abs(r) % 2 === 1;
      for (let x = odd ? -sw / 2 : 0; x < w + sw; x += sw) {
        if (r === rows && odd && (x < 0 || x + sw / 2 > w)) continue;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + sw / 2, y + sh * 0.4);
        ctx.lineTo(x, y + sh);
        ctx.lineTo(x - sw / 2, y + sh * 0.4);
        ctx.closePath();
        ctx.fillStyle = u.shade(c.main, (Math.abs(r) % 3) * 0.03);
        ctx.fill();
        ctx.strokeStyle = 'rgba(8, 6, 4, 0.85)';
        ctx.lineWidth = 1.5 * k;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(130, 120, 110, 0.35)';
        ctx.lineWidth = k;
        ctx.beginPath();
        ctx.moveTo(x - sw / 2, y + sh * 0.4);
        ctx.lineTo(x, y + sh);
        ctx.stroke();
      }
    }
  },
};
