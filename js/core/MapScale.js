import { PerspectiveTransform } from './PerspectiveTransform.js';

export const WORLD_DIAMETER = 21000;
export const TILE_METRES = 2;

const CARDINAL_STEP_RAD = Math.PI / 8; // 22.5°
const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

function wrapRad(a) {
  a = a % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

function buildAxisMatrix(theta, shearRad, sx, sy) {
  const downAngle = theta + Math.PI / 2 + shearRad;
  return [
    [sx * Math.cos(theta), sy * Math.cos(downAngle)],
    [sx * Math.sin(theta), sy * Math.sin(downAngle)],
  ];
}

function invert2x2(M) {
  const det = M[0][0] * M[1][1] - M[0][1] * M[1][0];
  if (Math.abs(det) < 1e-9) return null;
  const k = 1 / det;
  return [[M[1][1] * k, -M[0][1] * k], [-M[1][0] * k, M[0][0] * k]];
}

function apply2x2(M, v) {
  return { x: M[0][0] * v.x + M[0][1] * v.y, y: M[1][0] * v.x + M[1][1] * v.y };
}

// How far a check edge's direction (transformed into tile-grid space) falls
// from the nearest 22.5° build-rotation increment.
function checkDeviation(theta, shearRad, sx, sy, dC) {
  const M = buildAxisMatrix(theta, shearRad, sx, sy);
  const Minv = invert2x2(M);
  if (!Minv) return null;
  const tileVec = apply2x2(Minv, dC);
  if (Math.hypot(tileVec.x, tileVec.y) < 1e-9) return null;
  const angleTile = Math.atan2(tileVec.y, tileVec.x);
  const k = Math.round(angleTile / CARDINAL_STEP_RAD);
  const target = k * CARDINAL_STEP_RAD;
  return { angleTile, target, deviation: wrapRad(angleTile - target), k };
}

// Weighted Gauss-Newton over [theta, shear]. The across/down pairs are hard,
// counted measurements (high weight, anchoring the fit near where they alone
// would put it); the cardinal-angle check is a soft prior — it nudges the
// solve toward the nearest 22.5° build increment rather than overriding the
// measured pairs.
function refineWithCheck(theta0, shearRad0, dA, dB, sx, sy, dC) {
  let theta = theta0;
  let shear = shearRad0;
  const wA = 40, wB = 40, wC = 1;
  const angA = Math.atan2(dA.y, dA.x);
  const angB = Math.atan2(dB.y, dB.x);

  for (let iter = 0; iter < 8; iter++) {
    const chk = checkDeviation(theta, shear, sx, sy, dC);
    if (!chk) break;

    const rA = wrapRad(angA - theta);
    const rB = wrapRad(angB - (theta + Math.PI / 2 + shear));
    const rC = chk.deviation;

    const h = 1e-4;
    const chkT = checkDeviation(theta + h, shear, sx, sy, dC);
    const chkS = checkDeviation(theta, shear + h, sx, sy, dC);
    const drC_dTheta = chkT ? wrapRad(chkT.deviation - rC) / h : 0;
    const drC_dShear = chkS ? wrapRad(chkS.deviation - rC) / h : 0;

    // J rows: [d/dtheta, d/dshear] for rA, rB, rC
    const J = [[-1, 0], [-1, -1], [drC_dTheta, drC_dShear]];
    const R = [rA, rB, rC];
    const W = [wA, wB, wC];

    let A00 = 0, A01 = 0, A11 = 0, b0 = 0, b1 = 0;
    for (let i = 0; i < 3; i++) {
      const w = W[i], j0 = J[i][0], j1 = J[i][1], r = R[i];
      A00 += w * j0 * j0; A01 += w * j0 * j1; A11 += w * j1 * j1;
      b0 += w * j0 * r; b1 += w * j1 * r;
    }
    const det = A00 * A11 - A01 * A01;
    if (Math.abs(det) < 1e-9) break;
    const dTheta = -(A11 * b0 - A01 * b1) / det;
    const dShear = -(A00 * b1 - A01 * b0) / det;
    theta += dTheta;
    shear += dShear;
    if (Math.abs(dTheta) < 1e-9 && Math.abs(dShear) < 1e-9) break;
  }

  return { theta, shear };
}

export class MapScale {
  constructor(bus) {
    this.bus = bus;
    this._metresPerPixel = 4;
    this._locked = false;
    this._mapMode = 'local';
    this._calibrationUnit = 'tiles';
  }

  get metresPerPixel() {
    return this._metresPerPixel;
  }

  set metresPerPixel(val) {
    if (this._locked) return;
    if (val <= 0 || !isFinite(val)) return;
    this._metresPerPixel = val;
    this.bus.emit('scale:changed', val);
    this.bus.emit('render:request');
  }

  get locked() {
    return this._locked;
  }

  set locked(val) {
    this._locked = !!val;
    this.bus.emit('scale:lockChanged', this._locked);
  }

  get mapMode() {
    return this._mapMode;
  }

  set mapMode(val) {
    if (val !== 'world' && val !== 'local') return;
    this._mapMode = val;
    this.bus.emit('calibration:modeChanged', val);
  }

  get calibrationUnit() {
    return this._calibrationUnit;
  }

  set calibrationUnit(val) {
    if (val !== 'tiles' && val !== 'metres') return;
    this._calibrationUnit = val;
    this.bus.emit('calibration:unitChanged', val);
  }

  circleDiameterPx() {
    return WORLD_DIAMETER / this._metresPerPixel;
  }

  setFromCircleDiameter(diameterPx) {
    this.metresPerPixel = WORLD_DIAMETER / diameterPx;
  }

  /**
   * Solve px-per-tile, rotation and shear from measurement pairs.
   * pairs: { across: {a,b,tiles}|null, down: {a,b,tiles}|null, check: {a,b}|null }
   * a/b are {x,y} pixel points; tiles is a tile count (1 tile = TILE_METRES).
   * The optional `check` pair carries no tile count — it's a cardinal-angle
   * (multiple of 22.5°) sanity edge that also nudges rotation/shear.
   */
  static solveCalibration(pairs) {
    const across = pairs && pairs.across;
    const down = pairs && pairs.down;
    const check = pairs && pairs.check;

    const hasAcross = !!(across && across.a && across.b && across.tiles > 0);
    const hasDown = !!(down && down.a && down.b && down.tiles > 0);

    if (!hasAcross) {
      return {
        mode: 'none', pxPerTileX: null, pxPerTileY: null,
        rotationDeg: 0, shearDeg: 0, residualPx: null, angleCheck: null,
      };
    }

    const dA = { x: across.b.x - across.a.x, y: across.b.y - across.a.y };
    const lenA = Math.hypot(dA.x, dA.y);
    const pxPerTileA = lenA / across.tiles;
    const thetaA = Math.atan2(dA.y, dA.x);

    if (!hasDown) {
      return {
        mode: 'iso',
        pxPerTileX: pxPerTileA,
        pxPerTileY: pxPerTileA,
        rotationDeg: thetaA * RAD2DEG,
        shearDeg: 0,
        residualPx: 0,
        angleCheck: null,
      };
    }

    const dB = { x: down.b.x - down.a.x, y: down.b.y - down.a.y };
    const lenB = Math.hypot(dB.x, dB.y);
    const pxPerTileB = lenB / down.tiles;
    const thetaB = Math.atan2(dB.y, dB.x);

    let theta = thetaA;
    let shear = wrapRad(thetaB - theta - Math.PI / 2);

    let angleCheck = null;
    const hasCheck = !!(check && check.a && check.b);
    if (hasCheck) {
      const dC = { x: check.b.x - check.a.x, y: check.b.y - check.a.y };
      const refined = refineWithCheck(theta, shear, dA, dB, pxPerTileA, pxPerTileB, dC);
      theta = refined.theta;
      shear = refined.shear;
      const chk = checkDeviation(theta, shear, pxPerTileA, pxPerTileB, dC);
      if (chk) {
        const deviationDeg = chk.deviation * RAD2DEG;
        angleCheck = {
          angleDeg: ((chk.angleTile * RAD2DEG) % 360 + 360) % 360,
          nearestMultipleDeg: ((chk.target * RAD2DEG) % 360 + 360) % 360,
          deviationDeg,
          flagged: Math.abs(deviationDeg) > 2,
        };
      }
    }

    // Residual: how far each measurement's own direction still disagrees
    // with the solved rotation/shear, expressed in pixels at that
    // measurement's own length.
    const rA = wrapRad(thetaA - theta);
    const rB = wrapRad(thetaB - (theta + Math.PI / 2 + shear));
    const errs = [lenA * Math.sin(rA), lenB * Math.sin(rB)];
    if (hasCheck && angleCheck) {
      const dC = { x: check.b.x - check.a.x, y: check.b.y - check.a.y };
      const lenC = Math.hypot(dC.x, dC.y);
      errs.push(lenC * Math.sin(angleCheck.deviationDeg * DEG2RAD));
    }
    const residualPx = Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length);

    return {
      mode: 'affine',
      pxPerTileX: pxPerTileA,
      pxPerTileY: pxPerTileB,
      rotationDeg: theta * RAD2DEG,
      shearDeg: shear * RAD2DEG,
      residualPx,
      angleCheck,
    };
  }

  /**
   * Build the 3x3 affine matrix (image px -> straightened output px) that
   * removes the solved rotation/shear/anisotropic-scale, anchored so the
   * across pair's first pin keeps its pixel position. `outPxPerTile` is the
   * uniform px-per-tile the output image should end up at.
   */
  static buildStraightenMatrix(solve, anchor, outPxPerTile) {
    if (solve.mode !== 'affine' && solve.mode !== 'iso') return null;
    const theta = solve.rotationDeg * DEG2RAD;
    const shear = solve.shearDeg * DEG2RAD;
    const M = buildAxisMatrix(theta, shear, solve.pxPerTileX, solve.pxPerTileY);
    const Minv = invert2x2(M);
    if (!Minv) return null;
    const D = [[outPxPerTile, 0], [0, outPxPerTile]];
    // A = D * Minv
    const A = [
      [D[0][0] * Minv[0][0] + D[0][1] * Minv[1][0], D[0][0] * Minv[0][1] + D[0][1] * Minv[1][1]],
      [D[1][0] * Minv[0][0] + D[1][1] * Minv[1][0], D[1][0] * Minv[0][1] + D[1][1] * Minv[1][1]],
    ];
    const tx = anchor.x - (A[0][0] * anchor.x + A[0][1] * anchor.y);
    const ty = anchor.y - (A[1][0] * anchor.x + A[1][1] * anchor.y);
    return [[A[0][0], A[0][1], tx], [A[1][0], A[1][1], ty], [0, 0, 1]];
  }

  /**
   * Solve genuine perspective correction from four rectangle corners with a
   * known width and height. Unlike solveCalibration's affine fit, this
   * recovers a true homography — it can un-converge vanishing lines from an
   * angled camera shot, because four absolute correspondences (not just
   * pairwise lengths) fully determine a projective transform.
   *
   * corners: [c0,c1,c2,c3] pixel points in order around the rectangle, so
   * edge c0->c1 is the width and c1->c2 is the height.
   * Returns { H, outPxPerMetre, widthPx, heightPx } mapping source image
   * px -> straightened output px, anchored so c0 keeps its pixel position.
   */
  static solveRectangle(corners, widthTiles, heightTiles) {
    if (!corners || corners.length !== 4 || corners.some(c => !c)) return null;
    if (!(widthTiles > 0) || !(heightTiles > 0)) return null;

    const widthPx = Math.hypot(corners[1].x - corners[0].x, corners[1].y - corners[0].y);
    const heightPx = Math.hypot(corners[2].x - corners[1].x, corners[2].y - corners[1].y);
    const wM = widthTiles * TILE_METRES;
    const hM = heightTiles * TILE_METRES;
    const outPxPerMetre = (widthPx / wM + heightPx / hM) / 2;
    if (!(outPxPerMetre > 0) || !isFinite(outPxPerMetre)) return null;

    const anchor = corners[0];
    const dst = [
      { x: anchor.x, y: anchor.y },
      { x: anchor.x + wM * outPxPerMetre, y: anchor.y },
      { x: anchor.x + wM * outPxPerMetre, y: anchor.y + hM * outPxPerMetre },
      { x: anchor.x, y: anchor.y + hM * outPxPerMetre },
    ];
    const H = PerspectiveTransform.computeHomography(corners, dst);
    if (!H) return null;

    return { H, outPxPerMetre, widthPx, heightPx, anchor };
  }

  /**
   * Validate a measurement pair against an already-solved rectangle
   * homography: project both pins through H and read off the implied tile
   * length and the angle relative to the rectangle's own axes. Purely
   * informational — it never feeds back into the rectangle solve, which is
   * already exact from the four corners.
   */
  static evaluatePairAgainstRectangle(rectSolve, pair) {
    if (!rectSolve || !pair || !pair.a || !pair.b) return null;
    const { H, outPxPerMetre } = rectSolve;
    const oa = PerspectiveTransform.transformPoint(H, pair.a.x, pair.a.y);
    const ob = PerspectiveTransform.transformPoint(H, pair.b.x, pair.b.y);
    const outPx = Math.hypot(ob.x - oa.x, ob.y - oa.y);
    const impliedTiles = outPx / outPxPerMetre / TILE_METRES;

    const angleDeg = ((Math.atan2(ob.y - oa.y, ob.x - oa.x) * RAD2DEG) % 360 + 360) % 360;
    const k = Math.round(angleDeg / 22.5);
    const nearestMultipleDeg = (k * 22.5) % 360;
    let angleDeviationDeg = angleDeg - nearestMultipleDeg;
    if (angleDeviationDeg > 180) angleDeviationDeg -= 360;
    if (angleDeviationDeg < -180) angleDeviationDeg += 360;

    const result = {
      impliedTiles, angleDeg, nearestMultipleDeg, angleDeviationDeg,
      angleFlagged: Math.abs(angleDeviationDeg) > 2,
    };
    if (pair.tiles > 0) {
      result.deviationPct = (impliedTiles - pair.tiles) / pair.tiles * 100;
      result.lengthFlagged = Math.abs(result.deviationPct) > 5;
    }
    return result;
  }
}
