import { stableHash } from './saveReader.js';
import { TERRAIN_PREFABS } from './vegetation.js';

let loading = null;
let byHash = new Map();
let byName = new Map();

// valheim_pieces.json: English names, materials and vertical extents of hammer pieces.
export function loadPieces() {
  loading ||= fetch(new URL('../../valheim_pieces.json', import.meta.url))
    .then(r => r.json())
    .then(({ pieces }) => {
      byHash = new Map(pieces.map(p => [p.hash, p]));
      byName = new Map(pieces.map(p => [p.name, p]));
    })
    .catch(err => console.warn('valheim_pieces.json failed to load', err));
  return loading;
}

export function pieceByHash(hash) {
  return byHash.get(hash) || null;
}

export function pieceByName(name) {
  return byName.get(name) || null;
}

// Lowest point of a piece relative to its pivot, from its snap points.
export function pieceBottom(piece) {
  const pts = piece?.snap?.points;
  return pts ? Math.min(...pts.map(p => p[1])) : 0;
}

// Plan footprint suggested by the piece table, used to prefill new assets.
export function pieceFootprint(piece) {
  const s = piece?.snap;
  if (!s) return null;
  const xs = s.points.map(p => p[0]), zs = s.points.map(p => p[2]);
  const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...zs) - Math.min(...zs);
  if (s.type === 'pole') return [0.25, 0.25];
  return [w || 0.25, d || s.t || 0.25];
}

// Everything the internal-ID picker can suggest: hammer pieces plus ground prefabs.
export function searchIds(query, limit = 12) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out = [];
  for (const p of byName.values()) {
    if (p.name.toLowerCase().includes(q) || p.en?.toLowerCase().includes(q)) out.push({ id: p.name, label: p.en });
  }
  for (const [kind, names] of Object.entries(TERRAIN_PREFABS)) {
    for (const n of names) if (n.toLowerCase().includes(q)) out.push({ id: n, label: kind });
  }
  return out.slice(0, limit);
}

export { stableHash };
