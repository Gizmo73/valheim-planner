import { CATEGORY_PATHS } from './AssetRegistry.js';

const sourceCache = new Map();

export async function fetchCategorySource(categoryId) {
  if (sourceCache.has(categoryId)) return sourceCache.get(categoryId);
  const path = CATEGORY_PATHS[categoryId];
  if (!path) return null;
  const res = await fetch(`/${path}`);
  const text = await res.text();
  sourceCache.set(categoryId, text);
  return text;
}

export function primeCategorySource(categoryId, text) {
  sourceCache.set(categoryId, text);
}

function serializeValue(v, indent) {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    const items = v.map(item => padIn + serializeValue(item, indent + 1)).join(',\n');
    return `[\n${items},\n${pad}]`;
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 0) return '{}';
    const items = keys.map(k => `${padIn}${k}: ${serializeValue(v[k], indent + 1)}`).join(',\n');
    return `{\n${items},\n${pad}}`;
  }
  if (typeof v === 'string') return `'${v.replace(/'/g, "\\'")}'`;
  return String(v);
}

export function serializeMeta(meta) {
  return `export const meta = ${serializeValue(meta, 0)};`;
}

// Finds `export const meta = { ... };` in source text via brace-balanced
// scanning (a regex can't safely span meta's own nested braces) and swaps
// it for a freshly serialized version, leaving every other line — the
// hand-written shape()/texture() functions — untouched.
export function replaceMetaBlock(sourceText, meta) {
  const marker = 'export const meta';
  const start = sourceText.indexOf(marker);
  if (start === -1) return sourceText;
  const braceStart = sourceText.indexOf('{', start);
  if (braceStart === -1) return sourceText;

  let depth = 0, i = braceStart;
  for (; i < sourceText.length; i++) {
    const ch = sourceText[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) break; }
  }
  let end = i + 1;
  if (sourceText[end] === ';') end++;

  return sourceText.slice(0, start) + serializeMeta(meta) + sourceText.slice(end);
}

// Category files live one level under js/assets/ and import shared helpers
// with relative paths (e.g. `from '../shapes.js'`). A blob: URL has no
// meaningful directory of its own, so those relative imports can't resolve
// inside a dynamically-imported blob module — rewrite them to site-root
// absolute paths for evaluation only; the saved/downloaded text keeps the
// original relative form so it still works once placed back in the repo.
function resolveRelativeImportsForEval(sourceText) {
  // A blob: URL isn't a hierarchical scheme, so even a root-relative
  // "/js/assets/..." specifier fails to resolve from inside it — it needs
  // a fully-qualified absolute URL.
  const base = `${location.origin}/js/assets/`;
  return sourceText.replace(/from\s+(['"])\.\.\//g, `from $1${base}`);
}

export async function evalCategoryModule(sourceText) {
  const resolved = resolveRelativeImportsForEval(sourceText);
  const blob = new Blob([resolved], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    const mod = await import(/* webpackIgnore: true */ url);
    if (!mod.meta || typeof mod.shape !== 'function' || typeof mod.texture !== 'function') {
      return { ok: false, error: 'Module must export meta, shape() and texture()' };
    }
    if (!Array.isArray(mod.meta.variants) || mod.meta.variants.length === 0) {
      return { ok: false, error: 'meta.variants must be a non-empty array' };
    }
    return { ok: true, module: mod };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function createCategoryTemplate(id, label) {
  return `import { shapeFromVariant } from '../shapes.js';
import { checker } from '../textureHelpers.js';

export const meta = {
  id: '${id}',
  label: '${label}',
  variants: [
    { id: '${id}-2x2', label: '${label} 2x2', widthM: 2, heightM: 2, shapeKind: 'rect', snapPoints: null },
    // else if (id === '${id}-...') ... — new asset here
  ],
};

export function shape(id) {
  return shapeFromVariant(meta, id);
}

export function texture(ctx, id, mPerPx) {
  const px = 0.5 / mPerPx;
  checker(ctx, '#7a7a7a', '#636363', px, ctx.canvas.width, ctx.canvas.height);
}
`;
}

export function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
