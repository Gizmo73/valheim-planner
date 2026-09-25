// The `u` argument passed to every asset's draw(ctx, w, h, c, u).
// Randomness is seeded by the asset id so a texture looks the same every time it's drawn.

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = [...h].map(ch => ch + ch).join('');
  const n = parseInt(h, 16) || 0;
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function rgbToHex(rgb) {
  return '#' + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.map((v, i) => v + (B[i] - v) * t));
}

export function makeUtils(seed, ppm, shape, size) {
  const rand = mulberry32(hashString(seed));
  return {
    ppm, // texture pixels per metre
    shape, // 'rect' | 'circle' | 'octagon' | 'triangle' | 'custom'
    size, // [width, depth] in metres
    rand,
    range: (a, b) => a + rand() * (b - a),
    // amount -1..1: negative darkens towards black, positive lightens towards white. Returns hex.
    shade: (hex, amount) => mix(hex, amount < 0 ? '#000000' : '#ffffff', Math.abs(amount)),
    mix,
    rgba: (hex, alpha) => `rgba(${hexToRgb(hex).join(', ')}, ${alpha})`,
  };
}
