import { lookupByHash } from './pieceLookup.js';

const MATERIAL_COLORS = {
  'Wood':      { fill: 'rgba(139, 90, 43, 0.65)',  stroke: '#8B5A2B' },
  'HardWood':  { fill: 'rgba(101, 67, 33, 0.65)',  stroke: '#654321' },
  'Stone':     { fill: 'rgba(136, 140, 141, 0.65)', stroke: '#888C8D' },
  'Marble':    { fill: 'rgba(200, 200, 210, 0.65)', stroke: '#C8C8D2' },
  'Iron':      { fill: 'rgba(90, 100, 110, 0.65)',  stroke: '#5A646E' },
  'BlackMarble': { fill: 'rgba(50, 45, 55, 0.65)', stroke: '#322D37' },
  'default':   { fill: 'rgba(100, 100, 100, 0.65)', stroke: '#666' },
};

function getColor(material) {
  return MATERIAL_COLORS[material] || MATERIAL_COLORS.default;
}

export class BlueprintLayer {
  constructor(bus) {
    this.bus = bus;
    this.id = 'blueprint';
    this.name = 'Blueprint';
    this.type = 'blueprint';
    this.visible = true;

    this.pieces = [];
    this.signPos = null;
    this.cutHeight = Infinity;
    this.cutHeightRelative = Infinity;
    this.signHeight = 0;
    this.minHeight = 0;
    this.maxHeight = 0;
    this.heightLevels = [];
    this.terrainCompilers = [];
    this.showTerrain = false;
  }

  setPieces(pieces, sign) {
    this.signPos = { x: sign.pos.x, z: sign.pos.z, y: sign.pos.y };
    this.signHeight = sign.pos.y;

    this.pieces = pieces.map(zdo => {
      const info = lookupByHash(zdo.prefabHash);
      const snap = info ? info.snap : null;

      let bottom = zdo.pos.y;
      let top = zdo.pos.y;
      if (snap && snap.points) {
        const ys = snap.points.map(p => p[1]);
        bottom = zdo.pos.y + Math.min(...ys);
        top = zdo.pos.y + Math.max(...ys);
        if (Math.abs(top - bottom) < 0.01) {
          bottom -= 0.125;
          top += 0.125;
        }
      }

      return {
        zdo,
        info,
        snap,
        name: info ? info.name : `unknown_${zdo.prefabHash}`,
        en: info ? info.en : 'Unknown',
        material: info ? info.material : '',
        localX: zdo.pos.x - sign.pos.x,
        localZ: zdo.pos.z - sign.pos.z,
        worldY: zdo.pos.y,
        bottom,
        top,
        yawDeg: zdo.yawSnapped,
      };
    });

    this.pieces.sort((a, b) => a.bottom - b.bottom);

    const ys = this.pieces.map(p => p.worldY);
    this.minHeight = Math.min(...ys) - this.signHeight;
    this.maxHeight = Math.max(...ys) - this.signHeight;

    const levelSet = new Set();
    for (const p of this.pieces) {
      levelSet.add(Math.round((p.worldY - this.signHeight) * 2) / 2);
    }
    this.heightLevels = [...levelSet].sort((a, b) => a - b);

    this.cutHeightRelative = this.maxHeight + 10;
    this.cutHeight = this.cutHeightRelative + this.signHeight;
  }

  setCutHeight(relativeHeight) {
    this.cutHeightRelative = relativeHeight;
    this.cutHeight = relativeHeight + this.signHeight;
    this.bus.emit('render:request');
  }

  setTerrainCompilers(tcs) {
    this.terrainCompilers = tcs;
  }

  render(ctx, viewport, canvasW, canvasH) {
    if (!this.pieces.length || !this.signPos) return;

    ctx.save();

    this._renderGrid(ctx, viewport, canvasW, canvasH);

    if (this.showTerrain) {
      this._renderTerrainEdits(ctx, viewport);
    }

    const tolerance = 0.05;

    for (const piece of this.pieces) {
      const aboveCut = piece.top > (this.cutHeight + tolerance);
      const alpha = aboveCut ? 0.15 : 1.0;

      ctx.save();
      ctx.globalAlpha = alpha;

      const canvasX = piece.localX;
      const canvasY = -piece.localZ;

      ctx.translate(canvasX, canvasY);
      const yawRad = piece.yawDeg * Math.PI / 180;
      ctx.rotate(yawRad);

      if (piece.snap) {
        this._drawPiece(ctx, piece, viewport.zoom, aboveCut);
      } else {
        this._drawMarker(ctx, piece, viewport.zoom);
      }

      ctx.restore();
    }

    this._drawSign(ctx, viewport.zoom);

    ctx.restore();
  }

  _drawPiece(ctx, piece, zoom, aboveCut) {
    const snap = piece.snap;
    const colors = getColor(piece.material);

    switch (snap.type) {
      case 'rect':
      case 'roof':
      case 'roof_inner_corner':
      case 'roof_outer_corner':
      case 'roof_ridge': {
        ctx.beginPath();
        for (let i = 0; i < snap.points.length; i++) {
          const px = snap.points[i][0];
          const pz = -snap.points[i][2];
          if (i === 0) ctx.moveTo(px, pz);
          else ctx.lineTo(px, pz);
        }
        ctx.closePath();
        ctx.fillStyle = colors.fill;
        ctx.fill();
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = 1.5 / zoom;
        ctx.stroke();
        break;
      }
      case 'wall':
      case 'wall_slope':
      case 'line':
      case 'beam_slope': {
        const p0 = snap.points[0];
        const p1 = snap.points[1];
        ctx.beginPath();
        ctx.moveTo(p0[0], -p0[2]);
        ctx.lineTo(p1[0], -p1[2]);
        ctx.strokeStyle = colors.stroke;
        ctx.lineWidth = Math.max(2.5 / zoom, 0.08);
        ctx.lineCap = 'round';
        ctx.stroke();

        if (snap.t && snap.t > 0) {
          const dx = p1[0] - p0[0], dz = -(p1[2] - p0[2]);
          const len = Math.hypot(dx, dz);
          if (len > 0) {
            const nx = -dz / len * snap.t / 2;
            const ny = dx / len * snap.t / 2;
            ctx.beginPath();
            ctx.moveTo(p0[0] + nx, -p0[2] + ny);
            ctx.lineTo(p1[0] + nx, -p1[2] + ny);
            ctx.lineTo(p1[0] - nx, -p1[2] - ny);
            ctx.lineTo(p0[0] - nx, -p0[2] - ny);
            ctx.closePath();
            ctx.fillStyle = colors.fill;
            ctx.fill();
            ctx.strokeStyle = colors.stroke;
            ctx.lineWidth = 1 / zoom;
            ctx.stroke();
          }
        }
        break;
      }
      case 'pole': {
        const r = Math.max(0.15, 2 / zoom);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fillStyle = colors.stroke;
        ctx.fill();
        break;
      }
      default: {
        this._drawMarker(ctx, piece, zoom);
      }
    }
  }

  _drawMarker(ctx, piece, zoom) {
    const r = Math.max(0.12, 2 / zoom);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(230, 160, 30, 0.8)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.5 / zoom;
    ctx.stroke();

    if (zoom > 0.3) {
      ctx.save();
      ctx.rotate(-(piece.yawDeg * Math.PI / 180));
      const fontSize = Math.max(8 / zoom, 0.25);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(piece.en, 0, -r - 2 / zoom);
      ctx.restore();
    }
  }

  _renderGrid(ctx, viewport, canvasW, canvasH) {
    const zoom = viewport.zoom;
    const step = 2;

    if (zoom * step < 4) return;

    const topLeft = viewport.screenToMap(0, 0);
    const bottomRight = viewport.screenToMap(canvasW, canvasH);

    const startX = Math.floor(topLeft.x / step) * step;
    const endX = Math.ceil(bottomRight.x / step) * step;
    const startY = Math.floor(topLeft.y / step) * step;
    const endY = Math.ceil(bottomRight.y / step) * step;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 0.5 / zoom;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += step) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 0.8 / zoom;
    ctx.beginPath();
    if (startX <= 0 && endX >= 0) { ctx.moveTo(0, startY); ctx.lineTo(0, endY); }
    if (startY <= 0 && endY >= 0) { ctx.moveTo(startX, 0); ctx.lineTo(endX, 0); }
    ctx.stroke();
  }

  _drawSign(ctx, zoom) {
    const r = Math.max(0.2, 4 / zoom);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 80, 80, 0.9)';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 / zoom;
    ctx.stroke();

    if (zoom > 0.15) {
      const fontSize = Math.max(10 / zoom, 0.4);
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('BLUEPRINT', 0, -r - 3 / zoom);
    }
  }

  _renderTerrainEdits(ctx, viewport) {
    for (const tc of this.terrainCompilers) {
      if (!tc.parsed) continue;
      const zoneX = tc.zdo.pos.x;
      const zoneZ = tc.zdo.pos.z;

      for (let row = 0; row < 65; row++) {
        for (let col = 0; col < 65; col++) {
          const idx = row * 65 + col;
          const h = tc.parsed.heightGrid[idx];
          const p = tc.parsed.paintGrid[idx];

          if (!h.modified && !p.modified) continue;

          const worldX = zoneX + (col - 32);
          const worldZ = zoneZ + (row - 32);
          const cx = worldX - this.signPos.x;
          const cy = -(worldZ - this.signPos.z);

          if (h.modified) {
            const delta = h.level + h.smooth;
            if (Math.abs(delta) > 0.01) {
              ctx.fillStyle = delta > 0
                ? `rgba(180, 80, 40, ${Math.min(Math.abs(delta) * 0.3, 0.5)})`
                : `rgba(40, 80, 180, ${Math.min(Math.abs(delta) * 0.3, 0.5)})`;
              ctx.fillRect(cx - 0.5, cy - 0.5, 1, 1);
            }
          }

          if (p.modified) {
            const maxC = Math.max(p.r, p.g, p.b, p.a);
            if (maxC > 0.01) {
              let paintColor;
              if (p.r >= p.g && p.r >= p.b && p.r >= p.a) paintColor = 'rgba(139, 119, 101, 0.3)';
              else if (p.g >= p.r && p.g >= p.b && p.g >= p.a) paintColor = 'rgba(80, 120, 50, 0.3)';
              else if (p.b >= p.r && p.b >= p.g && p.b >= p.a) paintColor = 'rgba(100, 100, 120, 0.3)';
              else paintColor = 'rgba(160, 140, 100, 0.3)';
              ctx.fillStyle = paintColor;
              ctx.fillRect(cx - 0.5, cy - 0.5, 1, 1);
            }
          }
        }
      }
    }
  }

  getBounds() {
    if (!this.pieces.length) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of this.pieces) {
      const cx = p.localX;
      const cy = -p.localZ;
      minX = Math.min(minX, cx - 2);
      maxX = Math.max(maxX, cx + 2);
      minY = Math.min(minY, cy - 2);
      maxY = Math.max(maxY, cy + 2);
    }
    return { minX, maxX, minY, maxY };
  }
}
