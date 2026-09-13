import { getCategoryModule } from './AssetRegistry.js';

// Fixed rendering resolution for on-map textures — matches the old
// per-file generators' dominant convention (64px per metre) so existing
// pieces keep their prior sharpness.
export const REFERENCE_PX_PER_METRE = 64;

const cache = new Map();

function keyFor(categoryId, variantId, pxPerMetre) {
  return `${categoryId}:${variantId}:${pxPerMetre}`;
}

export function renderVariantTexture(categoryId, variantId, widthM, heightM, pxPerMetre = REFERENCE_PX_PER_METRE) {
  const key = keyFor(categoryId, variantId, pxPerMetre);
  const cached = cache.get(key);
  if (cached) return cached;

  const mod = getCategoryModule(categoryId);
  if (!mod) return null;

  const w = Math.max(1, Math.round(widthM * pxPerMetre));
  const h = Math.max(1, Math.round(heightM * pxPerMetre));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  try {
    mod.texture(ctx, variantId, 1 / pxPerMetre);
  } catch (e) {
    ctx.fillStyle = '#a33';
    ctx.fillRect(0, 0, w, h);
  }
  cache.set(key, c);
  return c;
}

export function invalidateCategory(categoryId) {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(categoryId + ':')) cache.delete(key);
  }
}

// Renders a variant's full-resolution texture, scaled down (with margin)
// into a canvas of `bufSize` device pixels — used for asset-panel and
// edit-sheet thumbnails, which need a small, DPR-crisp square regardless
// of the piece's actual on-map aspect ratio.
export function renderThumbnail(categoryId, variantId, widthM, heightM, bufSize) {
  const tex = renderVariantTexture(categoryId, variantId, widthM, heightM);
  const c = document.createElement('canvas');
  c.width = bufSize;
  c.height = bufSize;
  const ctx = c.getContext('2d');
  if (!tex) return c;
  const margin = bufSize * (4 / 48);
  const inner = bufSize - margin * 2;
  const scale = Math.min(inner / tex.width, inner / tex.height);
  const dw = tex.width * scale, dh = tex.height * scale;
  ctx.drawImage(tex, (bufSize - dw) / 2, (bufSize - dh) / 2, dw, dh);
  return c;
}

export function invalidateVariant(categoryId, variantId) {
  for (const key of [...cache.keys()]) {
    if (key.startsWith(`${categoryId}:${variantId}:`)) cache.delete(key);
  }
}
