export default {
  name: 'Wood Pole',
  category: 'wood',
  ids: ['wood_pole', 'wood_pole2'],
  size: [0.2, 0.2],
  shape: 'rect',
  snaps: [[0, 0]],
  modifier: null,
  colors: { main: '#9a7236' },
  draw(ctx, w, h, c, u) {
    // End grain: growth rings inside a darker rim.
    const r = Math.min(w, h) / 2;
    ctx.fillStyle = u.shade(c.main, 0.15);
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = u.rgba(u.shade(c.main, -0.5), 0.6);
    ctx.lineWidth = Math.max(1, r / 12);
    for (let ring = r * 0.8; ring > r * 0.1; ring -= r / 5) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, ring, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = u.shade(c.main, -0.35);
    ctx.lineWidth = r * 0.3;
    ctx.beginPath();
    if (u.shape === 'circle') ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
    else ctx.rect(0, 0, w, h);
    ctx.stroke();
  },
};
