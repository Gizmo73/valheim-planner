let pieces = null;
let hashMap = null;

export async function loadPieceLookup(url) {
  if (pieces) return;
  const resp = await fetch(url || 'valheim_pieces.json');
  const data = await resp.json();
  pieces = data.pieces;
  hashMap = new Map();
  for (const p of pieces) {
    hashMap.set(p.hash, p);
  }
}

export function lookupByHash(hash) {
  if (!hashMap) return null;
  return hashMap.get(hash) || null;
}

export function getAllPieces() {
  return pieces || [];
}

export function isLoaded() {
  return pieces !== null;
}
