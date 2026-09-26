import { Screenshot } from '../world/Screenshot.js';
import { Terrain } from '../world/Terrain.js';

const VERSION = 2;

export function serialisePlan({ plan, grid, viewport }) {
  return JSON.stringify({
    version: VERSION,
    ...plan.toJSON(),
    view: { rotation: viewport.rotation },
    gridOffset: grid.offset,
    terrain: plan.terrain?.toJSON() || null,
    screenshot: plan.screenshot?.toJSON() || null,
  });
}

export async function loadPlan(json, { plan, grid, viewport }) {
  let data = JSON.parse(json);
  if (data.version === 1) data = migrateV1(data);
  if (data.version !== VERSION) throw new Error(`Unsupported plan version ${data.version}`);
  plan.terrain = data.terrain ? Terrain.fromJSON(data.terrain) : null;
  plan.screenshot = data.screenshot ? await Screenshot.fromJSON(data.screenshot) : null;
  grid.offset = data.gridOffset || { x: 0, y: 0 };
  viewport.setRotation(data.view?.rotation || 0);
  plan.load(data);
}

// Old asset ids -> [new id, old width, old depth]. v1 stored top-left corners, so sizes are needed.
const V1_ASSETS = {
  'wood-plank-floor': ['wood_floor_2x2', 2, 2], 'wood-plank-floor-1x1': ['wood_floor_1x1', 1, 1],
  'wood-beam-2m': ['wood_beam_2m', 2, 0.5], 'wood-beam-1m': ['wood_beam_1m', 1, 0.5], 'wood-beam-vertical': ['wood_pole', 0.5, 0.5],
  'log-beam-2m': ['log_beam_2m', 2, 0.2], 'log-beam-4m': ['log_beam_4m', 4, 0.2], 'log-pole': ['log_pole', 0.2, 0.2],
  'wood-stairs-2x2': ['wood_stairs', 2, 2], 'wood-stairs-1x2': ['wood_stairs', 1, 2],
  'wood-wall-1m': ['wood_wall_1m', 1, 0.3], 'wood-wall-2m': ['wood_wall_2m', 2, 0.3],
  'stone-1x1': ['stone_wall_1x1', 1, 1], 'stone-2x1': ['stone_wall_2x1', 2, 1], 'stone-2x2': ['stone_floor_2x2', 2, 2],
  'stone-4x1': ['stone_wall_4x2', 4, 1], 'stone-stairs-2x2': ['stone_stairs', 2, 2],
  'grausten-1x1': ['grausten_1x1', 1, 1], 'grausten-2x1': ['grausten_2x1', 2, 1], 'grausten-4x1': ['grausten_4x1', 4, 1],
  'grausten-2x2': ['grausten_2x2', 2, 2], 'grausten-4x4': ['grausten_4x4', 4, 4],
  'marble-1x1': ['marble_1x1', 1, 1], 'marble-2x1': ['marble_2x1', 2, 1], 'marble-2x2': ['marble_2x2', 2, 2],
  'marble-column-1x1': ['marble_column_small', 1, 1], 'marble-column-2x2': ['marble_column_wide', 2, 2], 'marble-stairs-2x2': ['marble_stairs', 2, 2],
  'thatch-straight': ['thatch_roof', 2, 2], 'thatch-inner-corner': ['thatch_roof_inner', 2, 2],
  'thatch-outer-corner': ['thatch_roof_outer', 2, 2], 'thatch-ridge': ['thatch_roof_ridge', 2, 2],
  'shingle-straight': ['shingle_roof', 2, 2], 'shingle-inner-corner': ['shingle_roof_inner', 2, 2],
  'shingle-outer-corner': ['shingle_roof_outer', 2, 2], 'shingle-ridge': ['shingle_roof_ridge', 2, 2],
};

// v1 plans were map-image based: positions in metres relative to each build area's grid anchor (map px).
function migrateV1(d) {
  const mpp = d.scale?.metresPerPixel || 1;
  const anchors = new Map((d.workingLayers || []).map(w => [w.id, { x: (w.gridAnchorX ?? w.originX) * mpp, y: (w.gridAnchorY ?? w.originY) * mpp }]));
  const groups = (d.groups || [{ id: 'default', name: 'Default', visible: true }]).map(g => ({ id: `g${g.id}`, name: g.name, visible: g.visible !== false }));
  const items = (d.assets || []).map((a, i) => {
    const [asset, w, h] = V1_ASSETS[a.type] || [a.type, 1, 1];
    const o = anchors.get(a.workingLayerId) || { x: 0, y: 0 };
    return { id: `i${i + 1}`, asset, x: o.x + a.gridX + w / 2, y: o.y + a.gridY + h / 2, rot: a.rotation || 0, group: `g${a.groupId || 'default'}` };
  });
  return {
    version: VERSION,
    groups,
    items,
    visibleCount: groups.length,
    screenshot: d.mapImage ? { dataURL: d.mapImage, base: [[mpp, 0, 0], [0, mpp, 0], [0, 0, 1]], pairs: [] } : null,
  };
}
