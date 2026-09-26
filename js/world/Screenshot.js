import { applyH, invertH, isAffine, multiplyH, solveAlignment } from '../core/geometry.js';

const MAX_WARP_PX = 4096;
const PINS_NEEDED = { none: 0, move: 1, similarity: 2, affine: 3, perspective: 4 };
const BUNCHED_SPAN = 0.35; // two pins closer than this fraction of the image diagonal
const BUNCHED_AREA = 0.12; // 3+ pins enclosing less than this fraction of the image

function hullArea(pts) {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = list => list.reduce((h, q) => {
    while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
    h.push(q);
    return h;
  }, []);
  const hull = [...half(p).slice(0, -1), ...half([...p].reverse()).slice(0, -1)];
  return Math.abs(hull.reduce((a, q, i) => a + q.x * hull[(i + 1) % hull.length].y - hull[(i + 1) % hull.length].x * q.y, 0)) / 2;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image'));
    img.src = src;
  });
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// A visual-aid image aligned to the world by point pairs:
// each pair ties an image pixel to a world position (metres). H maps image px -> world.
export class Screenshot {
  constructor(image, dataURL) {
    this.image = image;
    this.dataURL = dataURL;
    this.pairs = [];
    this.perspective = true;
    this.opacity = 0.6;
    this.visible = true;
    this.base = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    this.H = this.base;
    this.dragging = false;
    this._warp = null;
  }

  static async fromFile(file) {
    const url = await readAsDataURL(file);
    return new Screenshot(await loadImage(url), url);
  }

  static async fromJSON(data) {
    const s = new Screenshot(await loadImage(data.dataURL), data.dataURL);
    Object.assign(s, { pairs: data.pairs || [], perspective: data.perspective ?? true, opacity: data.opacity ?? 0.6, visible: data.visible ?? true, base: data.base || s.base });
    s.solve();
    return s;
  }

  toJSON() {
    const { dataURL, pairs, perspective, opacity, visible, base } = this;
    return { dataURL, pairs, perspective, opacity, visible, base };
  }

  get width() { return this.image.naturalWidth; }
  get height() { return this.image.naturalHeight; }

  // Initial, uncalibrated placement: upright on screen, filling most of the view.
  placeInView(vp) {
    const k = Math.min(vp.width / this.width, vp.height / this.height) * 0.8 / vp.zoom;
    const c = vp.screenToWorld(vp.width / 2, vp.height / 2);
    const cv = vp.worldToView(c.x, c.y);
    const toView = [[k, 0, cv.x - this.width * k / 2], [0, k, cv.y - this.height * k / 2], [0, 0, 1]];
    const r = vp.rotation * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r);
    this.base = multiplyH([[cos, sin, 0], [-sin, cos, 0], [0, 0, 1]], toView);
    this.solve();
  }

  solve() {
    const n = this.pairs.length;
    if (n === 0) {
      this.H = this.base;
    } else if (n === 1) {
      const [p] = this.pairs;
      const at = applyH(this.base, p.img.x, p.img.y);
      this.H = multiplyH([[1, 0, p.world.x - at.x], [0, 1, p.world.y - at.y], [0, 0, 1]], this.base);
    } else {
      this.H = solveAlignment(this.pairs, this.perspective) || this.H;
    }
    // Pins that disagree can fold the image behind the camera; fall back to the skew fit then.
    this.unstable = !isAffine(this.H) && this._corners().some(([x, y]) => this.H[2][0] * x + this.H[2][1] * y + this.H[2][2] <= 0);
    if (this.unstable) this.H = solveAlignment(this.pairs, false) || this.base;
    this.errors = this._checkPins();
    this.bunched = this._bunched();
    this._warp = null;
  }

  get model() {
    const n = this.pairs.length;
    if (n < 3) return ['none', 'move', 'similarity'][n];
    return n === 3 || !this.perspective || this.unstable ? 'affine' : 'perspective';
  }

  // Pins beyond what the fit needs. With none spare the fit is exact and its accuracy can't be checked.
  get spare() {
    return this.pairs.length - PINS_NEEDED[this.model];
  }

  // How far each pin lands from where it belongs under the fit. null when the fit is exact
  // (no spare pin), because then every pin lands perfectly whatever the clicks were.
  _checkPins() {
    if (this.spare < 1) return null;
    return this.pairs.map(p => {
      const q = applyH(this.H, p.img.x, p.img.y);
      return Math.hypot(q.x - p.world.x, q.y - p.world.y);
    });
  }

  // Typical error (m), allowing for the fit bending towards its own pins: sum of squares over the
  // spare coordinates (2 per pin, minus what the fit uses). null for an exact fit.
  get accuracy() {
    if (!this.errors) return null;
    return Math.sqrt(this.errors.reduce((s, e) => s + e * e, 0) / (2 * this.spare));
  }

  // Pins close together, or in a line, cover little of the image, so errors grow towards its edges.
  _bunched() {
    const pts = this.pairs.map(p => p.img);
    if (pts.length < 2) return false;
    if (pts.length === 2) return Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) < BUNCHED_SPAN * Math.hypot(this.width, this.height);
    return hullArea(pts) < BUNCHED_AREA * this.width * this.height;
  }

  _corners() {
    return [[0, 0], [this.width, 0], [this.width, this.height], [0, this.height]];
  }

  // Once calibrated, keep the result as the base so removing pins doesn't throw the image away.
  commitBase() {
    if (this.pairs.length >= 2 && isAffine(this.H)) this.base = this.H;
  }

  imageToWorld(x, y) { return applyH(this.H, x, y); }

  worldToImage(x, y) {
    const inv = invertH(this.H);
    return inv ? applyH(inv, x, y) : { x, y };
  }

  draw(ctx) {
    if (!this.visible) return;
    ctx.save();
    ctx.globalAlpha = this.opacity;
    let H = this.H;
    if (!isAffine(H) && this.dragging) H = solveAlignment(this.pairs, false) || H;
    if (isAffine(H)) {
      ctx.transform(H[0][0], H[1][0], H[0][1], H[1][1], H[0][2], H[1][2]);
      ctx.drawImage(this.image, 0, 0);
    } else {
      const w = this._warp || (this._warp = this._buildWarp());
      if (w) ctx.drawImage(w.canvas, w.x, w.y, w.w, w.h);
    }
    ctx.restore();
  }

  // Perspective can't be expressed as a canvas transform, so resample once into world space.
  _buildWarp() {
    const { width: iw, height: ih, H } = this;
    const pts = this._corners().map(([x, y]) => applyH(H, x, y));
    const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
    const ppm = Math.min(Math.sqrt((iw * ih) / ((maxX - minX) * (maxY - minY))), MAX_WARP_PX / Math.max(maxX - minX, maxY - minY));
    const ow = Math.ceil((maxX - minX) * ppm), oh = Math.ceil((maxY - minY) * ppm);
    const inv = invertH(H);
    if (!inv || !(ow > 0 && oh > 0)) return null;

    const src = document.createElement('canvas');
    src.width = iw; src.height = ih;
    const sctx = src.getContext('2d');
    sctx.drawImage(this.image, 0, 0);
    const sd = sctx.getImageData(0, 0, iw, ih).data;

    const out = document.createElement('canvas');
    out.width = ow; out.height = oh;
    const octx = out.getContext('2d');
    const od = octx.createImageData(ow, oh);
    const d = od.data;
    for (let oy = 0; oy < oh; oy++) {
      for (let ox = 0; ox < ow; ox++) {
        const s = applyH(inv, minX + (ox + 0.5) / ppm, minY + (oy + 0.5) / ppm);
        if (s.x < 0 || s.y < 0 || s.x >= iw - 1 || s.y >= ih - 1) continue;
        const x0 = s.x | 0, y0 = s.y | 0, fx = s.x - x0, fy = s.y - y0;
        const i00 = (y0 * iw + x0) * 4, i10 = i00 + 4, i01 = i00 + iw * 4, i11 = i01 + 4;
        const o = (oy * ow + ox) * 4;
        for (let c = 0; c < 4; c++) {
          d[o + c] = (sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx) * (1 - fy) + (sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx) * fy;
        }
      }
    }
    octx.putImageData(od, 0, 0);
    return { canvas: out, x: minX, y: minY, w: ow / ppm, h: oh / ppm };
  }
}
