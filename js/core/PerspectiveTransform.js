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

  static correctImage(sourceImg, srcPins, tileW, tileH) {
    const imgW = sourceImg.naturalWidth || sourceImg.width;
    const imgH = sourceImg.naturalHeight || sourceImg.height;

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = imgW;
    srcCanvas.height = imgH;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(sourceImg, 0, 0);
    const srcData = srcCtx.getImageData(0, 0, imgW, imgH).data;

    const topLen = Math.hypot(srcPins[1].x - srcPins[0].x, srcPins[1].y - srcPins[0].y);
    const botLen = Math.hypot(srcPins[2].x - srcPins[3].x, srcPins[2].y - srcPins[3].y);
    const leftLen = Math.hypot(srcPins[3].x - srcPins[0].x, srcPins[3].y - srcPins[0].y);
    const rightLen = Math.hypot(srcPins[2].x - srcPins[1].x, srcPins[2].y - srcPins[1].y);

    const ppm = (((topLen + botLen) / 2) / tileW + ((leftLen + rightLen) / 2) / tileH) / 2;
    const tw = tileW * ppm;
    const th = tileH * ppm;

    const cx = (srcPins[0].x + srcPins[1].x + srcPins[2].x + srcPins[3].x) / 4;
    const cy = (srcPins[0].y + srcPins[1].y + srcPins[2].y + srcPins[3].y) / 4;
    const dstPins = [
      { x: cx - tw / 2, y: cy - th / 2 },
      { x: cx + tw / 2, y: cy - th / 2 },
      { x: cx + tw / 2, y: cy + th / 2 },
      { x: cx - tw / 2, y: cy + th / 2 },
    ];

    const H = PerspectiveTransform.computeHomography(srcPins, dstPins);
    if (!H) return null;
    const Hinv = PerspectiveTransform.invert3x3(H);
    if (!Hinv) return null;

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
    return {
      canvas: outCanvas,
      metresPerPixel: 1 / ppm,
      refRect: { x: cx - tw / 2, y: cy - th / 2, w: tw, h: th },
    };
  }
}
