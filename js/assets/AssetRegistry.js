import { CategoryAsset } from './CategoryAsset.js';
import { invalidateCategory, invalidateVariant } from './textureCache.js';
import * as wood from './categories/wood.js';
import * as grausten from './categories/grausten.js';
import * as stone from './categories/stone.js';
import * as marble from './categories/marble.js';
import * as thatch from './categories/thatch.js';
import * as shingle from './categories/shingle.js';

export const CATEGORY_PATHS = {
  wood: 'js/assets/categories/wood.js',
  grausten: 'js/assets/categories/grausten.js',
  stone: 'js/assets/categories/stone.js',
  marble: 'js/assets/categories/marble.js',
  thatch: 'js/assets/categories/thatch.js',
  shingle: 'js/assets/categories/shingle.js',
};

const categories = new Map();
for (const [id, mod] of [
  ['wood', wood], ['grausten', grausten], ['stone', stone],
  ['marble', marble], ['thatch', thatch], ['shingle', shingle],
]) {
  categories.set(id, mod);
}

function findVariant(type) {
  for (const [catId, mod] of categories) {
    const v = mod.meta.variants.find(x => x.id === type);
    if (v) return { catId, variant: v, module: mod };
  }
  return null;
}

export function getCategoryModule(id) {
  return categories.get(id) || null;
}

export function getCategoryIds() {
  return [...categories.keys()];
}

export function setCategoryModule(id, module) {
  categories.set(id, module);
  invalidateCategory(id);
}

export function registerCategory(id, module, path) {
  categories.set(id, module);
  if (path) CATEGORY_PATHS[id] = path;
}

export function getAssetTypes() {
  const list = [];
  for (const [catId, mod] of categories) {
    for (const v of mod.meta.variants) {
      list.push({
        type: v.id,
        name: v.label,
        widthM: v.widthM,
        heightM: v.heightM,
        category: mod.meta.label,
        categoryId: catId,
      });
    }
  }
  return list;
}

export function getCategories() {
  const seen = new Set();
  const out = [];
  for (const mod of categories.values()) {
    if (!seen.has(mod.meta.label)) { seen.add(mod.meta.label); out.push(mod.meta.label); }
  }
  return out;
}

export function getEntry(type) {
  const found = findVariant(type);
  if (!found) return null;
  return {
    type: found.variant.id,
    name: found.variant.label,
    widthM: found.variant.widthM,
    heightM: found.variant.heightM,
    category: found.module.meta.label,
    categoryId: found.catId,
  };
}

export function getVariant(type) {
  return findVariant(type);
}

export function createAsset(type) {
  const found = findVariant(type);
  if (!found) return null;
  const { catId, variant } = found;
  return new CategoryAsset(type, catId, variant.id, variant.widthM, variant.heightM, variant.snapPoints);
}

export function updateAssetSize(type, widthM, heightM) {
  const found = findVariant(type);
  if (!found) return;
  found.variant.widthM = widthM;
  found.variant.heightM = heightM;
  invalidateVariant(found.catId, found.variant.id);
}
