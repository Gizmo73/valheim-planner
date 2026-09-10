import { WoodPlankFloor } from './WoodPlankFloor.js';
import { WoodPlankFloor1x1 } from './WoodPlankFloor1x1.js';
import { WoodBeam1m, WoodBeam2m, WoodBeamVertical } from './WoodBeam.js';
import { LogBeam2m, LogBeam4m, LogPole } from './LogBeam.js';
import { WoodStairs2x2, WoodStairs1x2 } from './WoodStairs.js';
import { WoodWall1m, WoodWall2m } from './WoodWall.js';
import { Grausten1x1, Grausten2x1, Grausten4x1, Grausten2x2, Grausten4x4 } from './GraustenFloor.js';
import { StoneFloor1x1, StoneFloor2x1, StoneFloor2x2, StoneFloor4x1 } from './StoneFloor.js';
import { StoneStairs2x2 } from './StoneStairs.js';
import { Marble1x1, Marble2x1, Marble2x2, MarbleColumn1x1, MarbleColumn2x2, MarbleStairs2x2 } from './BlackMarble.js';
import { ThatchStraight, ThatchInnerCorner, ThatchOuterCorner, ThatchRidge } from './ThatchRoof.js';
import { ShingleStraight, ShingleInnerCorner, ShingleOuterCorner, ShingleRidge } from './ShingleRoof.js';

const registry = [
  { type: 'wood-plank-floor', name: 'Wood Floor 2x2', cls: WoodPlankFloor, widthM: 2, heightM: 2, category: 'Wood' },
  { type: 'wood-plank-floor-1x1', name: 'Wood Floor 1x1', cls: WoodPlankFloor1x1, widthM: 1, heightM: 1, category: 'Wood' },
  { type: 'wood-beam-2m', name: 'Wood Beam 2m', cls: WoodBeam2m, widthM: 2, heightM: 0.5, category: 'Wood' },
  { type: 'wood-beam-1m', name: 'Wood Beam 1m', cls: WoodBeam1m, widthM: 1, heightM: 0.5, category: 'Wood' },
  { type: 'wood-beam-vertical', name: 'Vertical Beam', cls: WoodBeamVertical, widthM: 0.5, heightM: 0.5, category: 'Wood' },
  { type: 'log-beam-2m', name: 'Log Beam 2m', cls: LogBeam2m, widthM: 2, heightM: 0.2, category: 'Wood' },
  { type: 'log-beam-4m', name: 'Log Beam 4m', cls: LogBeam4m, widthM: 4, heightM: 0.2, category: 'Wood' },
  { type: 'log-pole', name: 'Log Pole', cls: LogPole, widthM: 0.2, heightM: 0.2, category: 'Wood' },
  { type: 'wood-stairs-2x2', name: 'Wood Stairs 2x2', cls: WoodStairs2x2, widthM: 2, heightM: 2, category: 'Wood' },
  { type: 'wood-stairs-1x2', name: 'Wood Stairs 1x2', cls: WoodStairs1x2, widthM: 1, heightM: 2, category: 'Wood' },
  { type: 'wood-wall-1m', name: 'Wood Wall 1m', cls: WoodWall1m, widthM: 1, heightM: 0.3, category: 'Wood' },
  { type: 'wood-wall-2m', name: 'Wood Wall 2m', cls: WoodWall2m, widthM: 2, heightM: 0.3, category: 'Wood' },
  { type: 'grausten-1x1', name: 'Grausten 1x1', cls: Grausten1x1, widthM: 1, heightM: 1, category: 'Grausten' },
  { type: 'grausten-2x1', name: 'Grausten 2x1', cls: Grausten2x1, widthM: 2, heightM: 1, category: 'Grausten' },
  { type: 'grausten-4x1', name: 'Grausten 4x1', cls: Grausten4x1, widthM: 4, heightM: 1, category: 'Grausten' },
  { type: 'grausten-2x2', name: 'Grausten 2x2', cls: Grausten2x2, widthM: 2, heightM: 2, category: 'Grausten' },
  { type: 'grausten-4x4', name: 'Grausten 4x4', cls: Grausten4x4, widthM: 4, heightM: 4, category: 'Grausten' },
  { type: 'stone-1x1', name: 'Stone 1x1', cls: StoneFloor1x1, widthM: 1, heightM: 1, category: 'Stone' },
  { type: 'stone-2x1', name: 'Stone 2x1', cls: StoneFloor2x1, widthM: 2, heightM: 1, category: 'Stone' },
  { type: 'stone-2x2', name: 'Stone 2x2', cls: StoneFloor2x2, widthM: 2, heightM: 2, category: 'Stone' },
  { type: 'stone-4x1', name: 'Stone 4x1', cls: StoneFloor4x1, widthM: 4, heightM: 1, category: 'Stone' },
  { type: 'stone-stairs-2x2', name: 'Stone Stairs 2x2', cls: StoneStairs2x2, widthM: 2, heightM: 2, category: 'Stone' },
  { type: 'marble-1x1', name: 'Marble 1x1', cls: Marble1x1, widthM: 1, heightM: 1, category: 'Black Marble' },
  { type: 'marble-2x1', name: 'Marble 2x1', cls: Marble2x1, widthM: 2, heightM: 1, category: 'Black Marble' },
  { type: 'marble-2x2', name: 'Marble 2x2', cls: Marble2x2, widthM: 2, heightM: 2, category: 'Black Marble' },
  { type: 'marble-column-1x1', name: 'Marble Column 1x1', cls: MarbleColumn1x1, widthM: 1, heightM: 1, category: 'Black Marble' },
  { type: 'marble-column-2x2', name: 'Marble Column 2x2', cls: MarbleColumn2x2, widthM: 2, heightM: 2, category: 'Black Marble' },
  { type: 'marble-stairs-2x2', name: 'Marble Stairs 2x2', cls: MarbleStairs2x2, widthM: 2, heightM: 2, category: 'Black Marble' },
  { type: 'thatch-straight', name: 'Thatch Straight', cls: ThatchStraight, widthM: 2, heightM: 2, category: 'Thatch' },
  { type: 'thatch-inner-corner', name: 'Thatch Inner Corner', cls: ThatchInnerCorner, widthM: 2, heightM: 2, category: 'Thatch' },
  { type: 'thatch-outer-corner', name: 'Thatch Outer Corner', cls: ThatchOuterCorner, widthM: 2, heightM: 2, category: 'Thatch' },
  { type: 'thatch-ridge', name: 'Thatch Ridge', cls: ThatchRidge, widthM: 2, heightM: 2, category: 'Thatch' },
  { type: 'shingle-straight', name: 'Shingle Straight', cls: ShingleStraight, widthM: 2, heightM: 2, category: 'Shingle' },
  { type: 'shingle-inner-corner', name: 'Shingle Inner Corner', cls: ShingleInnerCorner, widthM: 2, heightM: 2, category: 'Shingle' },
  { type: 'shingle-outer-corner', name: 'Shingle Outer Corner', cls: ShingleOuterCorner, widthM: 2, heightM: 2, category: 'Shingle' },
  { type: 'shingle-ridge', name: 'Shingle Ridge', cls: ShingleRidge, widthM: 2, heightM: 2, category: 'Shingle' },
];

export function getAssetTypes() {
  return registry;
}

export function getEntry(type) {
  return registry.find(r => r.type === type) || null;
}

export function getCategories() {
  const cats = [];
  const seen = new Set();
  for (const r of registry) {
    if (!seen.has(r.category)) {
      seen.add(r.category);
      cats.push(r.category);
    }
  }
  return cats;
}

export function createAsset(type) {
  const entry = registry.find(r => r.type === type);
  if (!entry) return null;
  return new entry.cls();
}

export function updateAssetSize(type, widthM, heightM) {
  const entry = registry.find(r => r.type === type);
  if (!entry) return;
  entry.widthM = widthM;
  entry.heightM = heightM;
}
