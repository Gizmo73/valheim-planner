# valheim-planner
Grid based planner for Valheim builds — https://gizmo73.github.io/valheim-planner/

## Workflow
1. **Import world** — pick a zip of the world folder or all of its files, then type the text of the anchor sign.
   Pieces within the radius are placed as assets, split into layers by height; trees go in their own layer and
   ground objects (trees, rocks, bushes, ores) become an approximate heightmap with a water plane at 30 m.
   The same save can be re-imported around a different sign by changing the anchor text.
2. **Place** — pick an asset; `R` rotates, `Q/E` changes snap point, hold `Ctrl` to snap to pieces, `Alt` for free,
   `F` fills an area, `Shift + middle-click` picks the piece under the cursor.
3. **Screenshot** (optional) — add an image, then in *Align image* click a spot on it and where that spot belongs.
   2 pins fit move/rotate/scale, 3 add skew, 4+ add perspective.
4. **Save / Open** — plans are one JSON file with pieces, layers, terrain and the screenshot.

## Assets
Each asset is one file in `js/assets/library/`, listed in `js/assets/library/index.json`:

```js
export default {
  name: 'Wood Floor 2x2',
  category: 'wood',          // see js/assets/categories.js
  ids: ['wood_floor'],       // Valheim prefab names this asset stands in for on import
  size: [2, 2],              // width × depth in metres, seen from above
  shape: 'rect',             // rect | triangle | octagon | circle | [[x, y], ...]
  snaps: [[-1, -1], [1, -1]],// snap points, metres from the centre
  modifier: null,            // stairs | roof | roof-inner | roof-outer | roof-ridge
  colors: { main: '#9a7236' },
  draw(ctx, w, h, c, u) { /* texture, w × h pixels, already clipped to the shape */ },
};
```

Draw code only ever draws a slope running top to bottom. Roof modifiers split the piece into faces and
turn the material to each face's slope, so corners and ridges work for any roof material.

Edits made in the tool are kept in the browser; **Settings → Push** commits them to the repo in one commit
using a GitHub token with contents write access.

## Layout
- `js/core` — viewport, grid, plan document, renderer, plan files
- `js/assets` — asset library, file format, categories/templates, modifiers
- `js/world` — save parser, import, terrain, screenshot
- `js/tools` — select, place, align-image tools and input handling
- `js/ui` — panels and dialogs
- `valheim_pieces.json` — piece names, materials and snap geometry used for search and height layers
