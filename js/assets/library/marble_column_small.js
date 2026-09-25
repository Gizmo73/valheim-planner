export default {
  name: 'Black Marble Column Small',
  category: 'marble',
  ids: ['blackmarble_column_1'],
  size: [1, 1],
  shape: 'circle',
  snaps: [[0, 0]],
  modifier: null,
  colors: { main: '#2b2b31' },
  draw(ctx, w, h, c, u) {
    // Marble column top: veined face with a polished rim.
    ctx.fillStyle = c.main;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < (w * h) / (u.ppm * u.ppm) * 6; i++) {
      const x = u.range(0, w), y = u.range(0, h), r = u.range(0.1, 0.4) * u.ppm;
      const cloud = ctx.createRadialGradient(x, y, 0, x, y, r);
      cloud.addColorStop(0, u.rgba(u.shade(c.main, 0.15), 0.35));
      cloud.addColorStop(1, u.rgba(c.main, 0));
      ctx.fillStyle = cloud;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let v = 0; v < (w + h) / u.ppm * 1.5; v++) {
      let x = u.range(0, w), y = u.range(0, h);
      ctx.strokeStyle = u.rgba(u.shade(c.main, 0.75), u.range(0.15, 0.35));
      ctx.lineWidth = u.range(0.5, 1.5);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 8; s++) {
        x += u.range(-0.2, 0.3) * u.ppm;
        y += u.range(-0.15, 0.15) * u.ppm;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const rim = Math.min(w, h) * 0.06;
    ctx.strokeStyle = u.rgba('#ffffff', 0.14);
    ctx.lineWidth = rim;
    ctx.beginPath();
    if (u.shape === 'circle') ctx.arc(w / 2, h / 2, Math.min(w, h) / 2 - rim, 0, Math.PI * 2);
    else ctx.rect(rim, rim, w - rim * 2, h - rim * 2);
    ctx.stroke();
  },
};
