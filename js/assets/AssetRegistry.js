import { WoodPlankFloor } from './WoodPlankFloor.js';

const registry = [
  {
    type: 'wood-plank-floor',
    name: 'Wood Floor 2x2',
    cls: WoodPlankFloor,
    widthM: 2,
    heightM: 2,
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
