export class PerspectiveTransform {

  static _solveLinear(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let maxVal = Math.abs(M[col][col]);
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(M[row][col]) > maxVal) {
          maxVal = Math.abs(M[row][col]);
          maxRow = row;
        }
      }
      [M[col], M[maxRow]] = [M[maxRow], M[col]];
      if (Math.abs(M[col][col]) < 1e-12) return null;
      for (let row = col + 1; row < n; row++) {
        const f = M[row][col] / M[col][col];
        for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
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

  static computeHomography(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const { x: sx, y: sy } = src[i];
      const { x: dx, y: dy } = dst[i];
      A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
      b.push(dx);
      A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
      b.push(dy);
    }
    const h = PerspectiveTransform._solveLinear(A, b);
    if (!h) return null;
    return [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
  }

  static _mul3(A, B) {
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        for (let k = 0; k < 3; k++) C[i][j] += A[i][k] * B[k][j];
    return C;
  }

  static _normaliser(pts) {
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p.x; cy += p.y; }
    cx /= pts.length; cy /= pts.length;
    let d = 0;
    for (const p of pts) d += Math.hypot(p.x - cx, p.y - cy);
    d /= pts.length;
    const s = d > 0 ? Math.SQRT2 / d : 1;
    return [[s, 0, -s * cx], [0, s, -s * cy], [0, 0, 1]];
  }

  static homographyLS(src, dst) {
    if (src.length < 4) return null;
    if (src.length === 4) return PerspectiveTransform.computeHomography(src, dst);

    const Ts = PerspectiveTransform._normaliser(src);
    const Td = PerspectiveTransform._normaliser(dst);
    const s = src.map(p => PerspectiveTransform.transformPoint(Ts, p.x, p.y));
    const d = dst.map(p => PerspectiveTransform.transformPoint(Td, p.x, p.y));

    const N = Array.from({ length: 8 }, () => new Array(8).fill(0));
    const r = new Array(8).fill(0);
    for (let i = 0; i < s.length; i++) {
      const x = s[i].x, y = s[i].y, u = d[i].x, v = d[i].y;
      const rows = [
        [x, y, 1, 0, 0, 0, -u * x, -u * y, u],
        [0, 0, 0, x, y, 1, -v * x, -v * y, v],
      ];
      for (const row of rows)
        for (let a = 0; a < 8; a++) {
          r[a] += row[a] * row[8];
          for (let b = 0; b < 8; b++) N[a][b] += row[a] * row[b];
        }
    }

    const h = PerspectiveTransform._solveLinear(N, r);
    if (!h) return null;
    const Hn = [[h[0], h[1], h[2]], [h[3], h[4], h[5]], [h[6], h[7], 1]];
    const TdInv = PerspectiveTransform.invert3x3(Td);
    if (!TdInv) return null;
    const H = PerspectiveTransform._mul3(TdInv, PerspectiveTransform._mul3(Hn, Ts));
    const k = H[2][2];
    if (Math.abs(k) < 1e-12) return null;
    return H.map(row => row.map(v => v / k));
  }

  static invert3x3(M) {
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

  static transformPoint(H, x, y) {
    const w = H[2][0] * x + H[2][1] * y + H[2][2];
    return {
      x: (H[0][0] * x + H[0][1] * y + H[0][2]) / w,
      y: (H[1][0] * x + H[1][1] * y + H[1][2]) / w,
    };
  }

  static _warpImage(sourceImg, Hinv) {
    const imgW = sourceImg.naturalWidth || sourceImg.width;
    const imgH = sourceImg.naturalHeight || sourceImg.height;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = imgW;
    srcCanvas.height = imgH;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(sourceImg, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, imgW, imgH).data;

    const outCanvas = document.createElement('canvas');
    outCanvas.width = imgW;
    outCanvas.height = imgH;
    const outCtx = outCanvas.getContext('2d');
    const outImg = outCtx.createImageData(imgW, imgH);
    const out = outImg.data;

    const h0 = Hinv[0][0], h1 = Hinv[0][1], h2 = Hinv[0][2];
    const h3 = Hinv[1][0], h4 = Hinv[1][1], h5 = Hinv[1][2];
    const h6 = Hinv[2][0], h7 = Hinv[2][1], h8 = Hinv[2][2];
    const maxX = imgW - 1, maxY = imgH - 1;

    for (let dy = 0; dy < imgH; dy++) {
      for (let dx = 0; dx < imgW; dx++) {
        const w = h6 * dx + h7 * dy + h8;
        const sx = (h0 * dx + h1 * dy + h2) / w;
        const sy = (h3 * dx + h4 * dy + h5) / w;

        if (sx < 0 || sx >= maxX || sy < 0 || sy >= maxY) continue;

        const x0 = sx | 0;
        const y0 = sy | 0;
        const fx = sx - x0;
        const fy = sy - y0;
        const w00 = (1 - fx) * (1 - fy);
        const w10 = fx * (1 - fy);
        const w01 = (1 - fx) * fy;
        const w11 = fx * fy;

        const i00 = (y0 * imgW + x0) * 4;
        const i10 = i00 + 4;
        const i01 = i00 + imgW * 4;
        const i11 = i01 + 4;
        const oi = (dy * imgW + dx) * 4;

        out[oi]     = srcData[i00]     * w00 + srcData[i10]     * w10 + srcData[i01]     * w01 + srcData[i11]     * w11;
        out[oi + 1] = srcData[i00 + 1] * w00 + srcData[i10 + 1] * w10 + srcData[i01 + 1] * w01 + srcData[i11 + 1] * w11;
        out[oi + 2] = srcData[i00 + 2] * w00 + srcData[i10 + 2] * w10 + srcData[i01 + 2] * w01 + srcData[i11 + 2] * w11;
        out[oi + 3] = srcData[i00 + 3] * w00 + srcData[i10 + 3] * w10 + srcData[i01 + 3] * w01 + srcData[i11 + 3] * w11;
      }
    }

    outCtx.putImageData(outImg, 0, 0);
    return outCanvas;
  }

  static correctImageCheckerboard(sourceImg, srcPins, worldPins, enabled) {
    const src = [], world = [];
    for (let i = 0; i < srcPins.length; i++) {
      if (enabled[i]) {
        src.push(srcPins[i]);
        world.push(worldPins[i]);
      }
    }
    if (src.length < 4) return null;

    let sumPpm = 0, ppmCount = 0;
    for (let i = 0; i < src.length; i++) {
      for (let j = i + 1; j < src.length; j++) {
        const pxDist = Math.hypot(src[i].x - src[j].x, src[i].y - src[j].y);
        const wDist = Math.hypot(world[i].x - world[j].x, world[i].y - world[j].y);
        if (wDist > 1e-6) {
          sumPpm += pxDist / wDist;
          ppmCount++;
        }
      }
    }
    if (ppmCount === 0) return null;
    const ppm = sumPpm / ppmCount;

    let srcCx = 0, srcCy = 0, wCx = 0, wCy = 0;
    for (let i = 0; i < src.length; i++) {
      srcCx += src[i].x; srcCy += src[i].y;
      wCx += world[i].x; wCy += world[i].y;
    }
    srcCx /= src.length; srcCy /= src.length;
    wCx /= src.length; wCy /= src.length;

    const dstPx = world.map(w => ({
      x: srcCx + (w.x - wCx) * ppm,
      y: srcCy + (w.y - wCy) * ppm,
    }));

    const H = PerspectiveTransform.homographyLS(src, dstPx);
    if (!H) return null;
    const Hinv = PerspectiveTransform.invert3x3(H);
    if (!Hinv) return null;

    const outCanvas = PerspectiveTransform._warpImage(sourceImg, Hinv);

    const originX = srcCx - wCx * ppm;
    const originY = srcCy - wCy * ppm;

    return {
      canvas: outCanvas,
      metresPerPixel: 1 / ppm,
      refRect: { x: originX, y: originY },
    };
  }
}
