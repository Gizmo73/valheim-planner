export const DEG = Math.PI / 180;

export function rotate(x, y, deg) {
  const c = Math.cos(deg * DEG), s = Math.sin(deg * DEG);
  return { x: x * c - y * s, y: x * s + y * c };
}

export function wrapDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

// --- 3x3 projective matrices (row-major [[a,b,c],[d,e,f],[g,h,1]]) ---

export function applyH(H, x, y) {
  const w = H[2][0] * x + H[2][1] * y + H[2][2];
  return { x: (H[0][0] * x + H[0][1] * y + H[0][2]) / w, y: (H[1][0] * x + H[1][1] * y + H[1][2]) / w };
}

export function multiplyH(A, B) {
  return A.map((row, i) => [0, 1, 2].map(j => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
}

export function invertH(M) {
  const [[a, b, c], [d, e, f], [g, h, i]] = M;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-12) return null;
  const k = 1 / det;
  return [
    [(e * i - f * h) * k, (c * h - b * i) * k, (b * f - c * e) * k],
    [(f * g - d * i) * k, (a * i - c * g) * k, (c * d - a * f) * k],
    [(d * h - e * g) * k, (b * g - a * h) * k, (a * e - b * d) * k],
  ];
}

export function isAffine(H) {
  return Math.abs(H[2][0]) < 1e-12 && Math.abs(H[2][1]) < 1e-12;
}

function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    if (Math.abs(M[col][col]) < 1e-12) return null;
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let j = col; j <= n; j++) M[r][j] -= f * M[col][j];
    }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n];
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j];
    x[i] /= M[i][i];
  }
  return x;
}

// Least squares via the normal equations: rows of A times x ≈ b.
function leastSquares(rows, b) {
  const n = rows[0].length;
  const AtA = Array.from({ length: n }, () => new Array(n).fill(0));
  const Atb = new Array(n).fill(0);
  rows.forEach((r, k) => {
    for (let i = 0; i < n; i++) {
      Atb[i] += r[i] * b[k];
      for (let j = 0; j < n; j++) AtA[i][j] += r[i] * r[j];
    }
  });
  return solveLinear(AtA, Atb);
}

function similarity([p, q]) {
  const dzx = q.img.x - p.img.x, dzy = q.img.y - p.img.y;
  const dwx = q.world.x - p.world.x, dwy = q.world.y - p.world.y;
  const d = dzx * dzx + dzy * dzy;
  if (d < 1e-12) return null;
  const ar = (dwx * dzx + dwy * dzy) / d, ai = (dwy * dzx - dwx * dzy) / d;
  const bx = p.world.x - (ar * p.img.x - ai * p.img.y);
  const by = p.world.y - (ai * p.img.x + ar * p.img.y);
  return [[ar, -ai, bx], [ai, ar, by], [0, 0, 1]];
}

function affine(pairs) {
  const rows = pairs.map(p => [p.img.x, p.img.y, 1]);
  const x = leastSquares(rows, pairs.map(p => p.world.x));
  const y = leastSquares(rows, pairs.map(p => p.world.y));
  return x && y ? [x, y, [0, 0, 1]] : null;
}

// Hartley normalisation keeps the DLT well conditioned with pixel-sized inputs.
function normaliser(pts) {
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const d = pts.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / pts.length || 1;
  const k = Math.SQRT2 / d;
  return [[k, 0, -k * cx], [0, k, -k * cy], [0, 0, 1]];
}

function homography(pairs) {
  const Ti = normaliser(pairs.map(p => p.img));
  const Tw = normaliser(pairs.map(p => p.world));
  const rows = [], b = [];
  for (const p of pairs) {
    const s = applyH(Ti, p.img.x, p.img.y), d = applyH(Tw, p.world.x, p.world.y);
    rows.push([s.x, s.y, 1, 0, 0, 0, -d.x * s.x, -d.x * s.y]); b.push(d.x);
    rows.push([0, 0, 0, s.x, s.y, 1, -d.y * s.x, -d.y * s.y]); b.push(d.y);
  }
  const h = leastSquares(rows, b);
  const TwInv = h && invertH(Tw);
  if (!TwInv) return null;
  return multiplyH(multiplyH(TwInv, [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]]), Ti);
}

// Image px -> world metres. 2 pairs: move/rotate/scale, 3: + skew, 4+: + perspective.
export function solveAlignment(pairs, perspective = true) {
  if (pairs.length < 2) return null;
  if (pairs.length === 2) return similarity(pairs);
  if (pairs.length === 3 || !perspective) return affine(pairs);
  return homography(pairs);
}
