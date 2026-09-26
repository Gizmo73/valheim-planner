import { cleanSignText, readTerrainEdits, stableHash } from './saveReader.js';
import { pieceBottom, pieceByHash } from './pieces.js';
import { TERRAIN_PREFAB_NAMES } from './vegetation.js';
import { buildTerrain } from './Terrain.js';

const TERRAIN_MARGIN = 24;
const TERRAIN_HASHES = new Set(TERRAIN_PREFAB_NAMES.map(stableHash));

function distSq(a, b) {
  return (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
}

export function signTexts(save) {
  return [...new Set(save.signs.map(s => cleanSignText(s.text)))].sort();
}

/**
 * Works out what an import would produce without touching the plan, so the dialog can
 * show a summary and re-run instantly when the anchor text or radius changes.
 * opts: { anchorText, radius, levelStep, trees, terrain }
 */
export function analyseImport(save, opts, library) {
  const want = opts.anchorText.trim().toLowerCase();
  const anchors = save.signs.filter(s => cleanSignText(s.text).toLowerCase() === want);
  if (!anchors.length) return { error: `No sign reading "${opts.anchorText}" found.` };
  const sign = anchors[0];
  const r2 = opts.radius ** 2, t2 = (opts.radius + TERRAIN_MARGIN) ** 2;

  const pieces = [], trees = [], samples = [];
  const unmatched = new Map();
  for (const z of save.zdos) {
    if (z === sign) continue;
    const d = distSq(z.pos, sign.pos);
    if (z.player) {
      if (d > r2) continue;
      const asset = library.assetForHash(z.prefab);
      if (asset) {
        pieces.push({ z, asset });
      } else {
        const p = pieceByHash(z.prefab);
        const key = p?.name || `#${z.prefab}`;
        const u = unmatched.get(key) || { id: key, name: p?.en || 'Unknown prefab', count: 0 };
        u.count++;
        unmatched.set(key, u);
      }
      continue;
    }
    if (d <= t2 && TERRAIN_HASHES.has(z.prefab) && z.pos.y > -100 && z.pos.y < 1000) samples.push(z.pos);
    if (opts.trees && d <= r2) {
      const asset = library.assetForHash(z.prefab);
      if (asset && library.get(asset).category === 'nature') trees.push({ z, asset });
    }
  }

  // Layers by height, measured from the lowest matched piece so the ground floor is Level 1.
  const bottoms = pieces.map(({ z }) => z.pos.y + pieceBottom(pieceByHash(z.prefab)));
  const base = bottoms.length ? Math.min(...bottoms) : 0;
  pieces.forEach((p, i) => {
    p.level = opts.levelStep > 0 ? Math.floor((bottoms[i] - base + 0.25) / opts.levelStep) : 0;
  });

  return {
    sign,
    duplicateAnchors: anchors.length - 1,
    pieces,
    trees,
    samples,
    unmatched: [...unmatched.values()].sort((a, b) => b.count - a.count),
    terrainComps: opts.terrain ? save.terrainComps.filter(z => distSq(z.pos, sign.pos) <= (opts.radius + TERRAIN_MARGIN + 46) ** 2) : [],
  };
}

export async function applyImport(result, opts, plan) {
  const { sign } = result;
  const toPlan = z => ({ x: z.pos.x - sign.pos.x, y: -(z.pos.z - sign.pos.z) });

  plan.reset();
  const first = plan.groups[0];
  const levels = [...new Set(result.pieces.map(p => p.level))].sort((a, b) => a - b);
  const groupFor = new Map();
  levels.forEach((lv, i) => {
    const name = opts.levelStep > 0 ? `Level ${lv + 1} (+${lv * opts.levelStep} m)` : 'Build';
    const g = i === 0 ? Object.assign(first, { name }) : plan.addGroup(name);
    groupFor.set(lv, g.id);
  });
  for (const { z, asset, level } of result.pieces) {
    const p = toPlan(z);
    plan.addItem(asset, p.x, p.y, z.yaw, groupFor.get(level));
  }
  if (result.trees.length) {
    const g = plan.addGroup('Trees');
    for (const { z, asset } of result.trees) {
      const p = toPlan(z);
      plan.addItem(asset, p.x, p.y, z.yaw, g.id);
    }
  }
  plan.activeGroup = groupFor.get(levels[0]) || plan.groups[0].id;
  plan.anchor = { text: cleanSignText(sign.text), world: { ...sign.pos } };

  plan.terrain = null;
  if (opts.terrain && result.samples.length >= 8) {
    const edits = [];
    for (const tc of result.terrainComps) {
      try {
        edits.push(...await readTerrainEdits(tc));
      } catch (err) {
        console.warn('Skipped unreadable terrain data', err);
      }
    }
    plan.terrain = buildTerrain(result.samples, edits, sign.pos, opts.radius + TERRAIN_MARGIN);
  }
  plan.changed();
}
