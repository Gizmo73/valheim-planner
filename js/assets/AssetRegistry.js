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
const pristineMeta = new Map();
for (const [id, mod] of [
  ['wood', wood], ['grausten', grausten], ['stone', stone],
  ['marble', marble], ['thatch', thatch], ['shingle', shingle],
]) {
  categories.set(id, mod);
  pristineMeta.set(id, structuredClone(mod.meta));
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

// Swaps in a module for live preview (e.g. Source-tab keystroke re-eval)
// without touching the "pristine"/file baseline used by Reset to file data.
export function previewCategoryModule(id, module) {
  categories.set(id, module);
  invalidateCategory(id);
}

// Swaps in a module AND commits it as the new file baseline — call this
// once an edit is actually saved (Run & save / Save to file), not on
// every keystroke.
export function commitCategoryModule(id, module) {
  categories.set(id, module);
  pristineMeta.set(id, structuredClone(module.meta));
  invalidateCategory(id);
}

export function registerCategory(id, module, path) {
  categories.set(id, module);
  pristineMeta.set(id, structuredClone(module.meta));
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

function getPristineVariant(categoryId, variantId) {
  const meta = pristineMeta.get(categoryId);
  return meta ? meta.variants.find(v => v.id === variantId) || null : null;
}

// Applies a partial patch (name/label, widthM, heightM, shapeKind,
// customVerts, snapPoints, ...) to a variant's live meta entry.
export function updateVariant(categoryId, variantId, patch) {
  const mod = categories.get(categoryId);
  if (!mod) return null;
  const v = mod.meta.variants.find(x => x.id === variantId);
  if (!v) return null;
  Object.assign(v, patch);
  invalidateVariant(categoryId, variantId);
  return v;
}

export function resetVariantToFileData(categoryId, variantId) {
  const pristine = getPristineVariant(categoryId, variantId);
  if (!pristine) return null;
  return updateVariant(categoryId, variantId, structuredClone(pristine));
}

export function getInternalIdLookup() {
  const lookup = new Map();
  for (const [catId, mod] of categories) {
    for (const v of mod.meta.variants) {
      if (v.internalId) lookup.set(v.internalId, v.id);
    }
  }
  return lookup;
}

export function isVariantDirty(categoryId, variantId) {
  const mod = categories.get(categoryId);
  const pristine = getPristineVariant(categoryId, variantId);
  if (!mod || !pristine) return false;
  const live = mod.meta.variants.find(x => x.id === variantId);
  if (!live) return false;
  return JSON.stringify(live) !== JSON.stringify(pristine);
}
