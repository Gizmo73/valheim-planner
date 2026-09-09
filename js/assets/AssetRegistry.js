import { WoodPlankFloor } from './WoodPlankFloor.js';
import { WoodPlankFloor1x1 } from './WoodPlankFloor1x1.js';
import { WoodBeam1m, WoodBeam2m, WoodBeamVertical } from './WoodBeam.js';

const registry = [
  {
    type: 'wood-plank-floor',
    name: 'Wood Floor 2x2',
    cls: WoodPlankFloor,
    widthM: 2,
    heightM: 2,
  },
  {
    type: 'wood-plank-floor-1x1',
    name: 'Wood Floor 1x1',
    cls: WoodPlankFloor1x1,
    widthM: 1,
    heightM: 1,
  },
  {
    type: 'wood-beam-2m',
    name: 'Wood Beam 2m',
    cls: WoodBeam2m,
    widthM: 2,
    heightM: 0.1,
  },
  {
    type: 'wood-beam-1m',
    name: 'Wood Beam 1m',
    cls: WoodBeam1m,
    widthM: 1,
    heightM: 0.1,
  },
  {
    type: 'wood-beam-vertical',
    name: 'Vertical Beam',
    cls: WoodBeamVertical,
    widthM: 0.1,
    heightM: 0.1,
  },
];

export function getAssetTypes() {
  return registry;
}

export function createAsset(type) {
  const entry = registry.find(r => r.type === type);
  if (!entry) return null;
  return new entry.cls();
}
