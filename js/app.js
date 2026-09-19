import { EventBus } from './core/EventBus.js';
import { Viewport } from './core/Viewport.js';
import { MapScale, TILE_METRES } from './core/MapScale.js';
import { GridSettings } from './core/GridSettings.js';
import { FineTuneState } from './core/FineTuneState.js';
import { PerspectiveTransform } from './core/PerspectiveTransform.js';
import { Renderer } from './core/Renderer.js';
import { SaveLoad } from './core/SaveLoad.js';
import { LayerManager } from './layers/LayerManager.js';
import { MapLayer } from './layers/MapLayer.js';
import { AssetLayer } from './layers/AssetLayer.js';
import { ToolManager } from './tools/ToolManager.js';
import { PanTool } from './tools/PanTool.js';
import { RegionSelectTool } from './tools/RegionSelectTool.js';
import { PlaceTool } from './tools/PlaceTool.js';
import { SelectTool } from './tools/SelectTool.js';
import { CalibrationTool } from './tools/CalibrationTool.js';
import { WorkingLayer } from './layers/WorkingLayer.js';
import { Toolbar } from './ui/Toolbar.js';
import { PlaceContextBar } from './ui/PlaceContextBar.js';
import { LayerPanel } from './ui/LayerPanel.js';
import { AssetPanel } from './ui/AssetPanel.js';
import { AssetEditSheet } from './ui/AssetEditSheet.js';
import { PlanPanel } from './ui/PlanPanel.js';
import { SelectionInspector } from './ui/SelectionInspector.js';
import { CalibrationPanel } from './ui/CalibrationPanel.js';
import { MobileControls } from './ui/MobileControls.js';
import { refreshIcons } from './ui/icons.js';
import { BlueprintLayer } from './save/BlueprintLayer.js';
import { ImportUI } from './save/ImportUI.js';

const bus = new EventBus();
const canvas = document.getElementById('main-canvas');
const viewport = new Viewport(bus);
const mapScale = new MapScale(bus);
const gridSettings = new GridSettings(bus);
const fineTuneState = new FineTuneState(mapScale, bus);

const layerManager = new LayerManager(bus);
const mapLayer = new MapLayer(bus);
const assetLayer = new AssetLayer(bus);

layerManager.addLayer(mapLayer);
layerManager.addLayer(assetLayer);

const toolManager = new ToolManager(canvas, viewport, bus);
const panTool = new PanTool(viewport, bus);
const regionTool = new RegionSelectTool(viewport, layerManager, mapScale, bus, gridSettings, fineTuneState);
const placeTool = new PlaceTool(viewport, layerManager, assetLayer, mapScale, bus);
const selectTool = new SelectTool(viewport, layerManager, assetLayer, mapScale, bus);
const calibrationTool = new CalibrationTool(viewport, mapLayer, mapScale, bus);

toolManager.register('pan', panTool);
toolManager.register('region', regionTool);
toolManager.register('place', placeTool);
toolManager.register('select', selectTool);
toolManager.register('calibrate', calibrationTool);

const renderer = new Renderer(canvas, viewport, layerManager, toolManager, bus, gridSettings);

const toolbar = new Toolbar(toolManager, mapScale, bus);
const placeContextBar = new PlaceContextBar(placeTool, toolManager, bus);
const layerPanel = new LayerPanel(layerManager, assetLayer, bus);
const assetPanel = new AssetPanel(bus);
const assetEditSheet = new AssetEditSheet(bus);
bus.on('asset:edit', (type) => assetEditSheet.open(type));
const planPanel = new PlanPanel(gridSettings, mapScale, assetLayer, layerManager, fineTuneState, bus);
const selectionInspector = new SelectionInspector(selectTool, viewport, assetLayer, toolManager, bus);
const calibrationPanel = new CalibrationPanel(mapScale, calibrationTool, bus);
const mobileControls = new MobileControls(toolManager, selectTool, mapScale, bus);

const blueprintLayer = new BlueprintLayer(bus);
const importUI = new ImportUI(bus, blueprintLayer, viewport, renderer, layerManager);

const saveLoad = new SaveLoad(layerManager, mapLayer, assetLayer, mapScale, viewport, renderer, bus, gridSettings, fineTuneState);

bus.on('file:selected', async (file) => {
  await mapLayer.loadFromFile(file);
  viewport.fitImage(mapLayer.width, mapLayer.height, renderer.width, renderer.height);
  document.getElementById('empty-state').style.display = 'none';
});

// --- Tabbed side panel (Pieces / Layers / Plan) ---
const TAB_NAMES = ['pieces', 'layers', 'plan'];
let activeTab = 'pieces';

function showTab(name) {
  activeTab = name;
  for (const t of TAB_NAMES) {
    document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== name);
  }
  for (const btn of document.querySelectorAll('.panel-tab')) {
    btn.classList.toggle('active', btn.dataset.tab === name);
  }
  bus.emit('panel:tabChanged', name);
}

for (const btn of document.querySelectorAll('.panel-tab')) {
  btn.addEventListener('click', () => showTab(btn.dataset.tab));
}

bus.on('panel:showTab', (name) => showTab(name));
showTab('pieces');

// --- Empty-state actions ---
const emptyMapInput = document.createElement('input');
emptyMapInput.type = 'file';
emptyMapInput.accept = 'image/*';
emptyMapInput.style.display = 'none';
document.body.appendChild(emptyMapInput);
document.getElementById('empty-choose-map').addEventListener('click', () => emptyMapInput.click());
emptyMapInput.addEventListener('change', () => {
  if (emptyMapInput.files[0]) {
    bus.emit('file:selected', emptyMapInput.files[0]);
    emptyMapInput.value = '';
  }
});

const emptyLoadInput = document.createElement('input');
emptyLoadInput.type = 'file';
emptyLoadInput.accept = '.json';
emptyLoadInput.style.display = 'none';
document.body.appendChild(emptyLoadInput);
document.getElementById('empty-open-plan').addEventListener('click', () => emptyLoadInput.click());
emptyLoadInput.addEventListener('change', () => {
  if (emptyLoadInput.files[0]) {
    bus.emit('project:load', emptyLoadInput.files[0]);
    emptyLoadInput.value = '';
  }
});

document.getElementById('empty-import-save').addEventListener('click', () => importUI.show());

bus.on('import:open', () => importUI.show());

// --- All-shortcuts overlay ---
document.getElementById('all-shortcuts-btn').addEventListener('click', () => {
  document.getElementById('help-panel').classList.remove('hidden');
});

refreshIcons();

bus.on('project:save', () => {
  saveLoad.save();
});

bus.on('project:load', async (file) => {
  try {
    await saveLoad.load(file);
  } catch (err) {
    alert('Failed to load project: ' + err.message);
  }
});

bus.on('asset:startPlace', (type) => {
  placeTool.setAssetType(type);
  if (toolManager.currentToolName !== 'place') {
    toolManager.activate('place');
  }

  const mpp = mapScale.metresPerPixel;
  const cellScreen = (1 / mpp) * viewport.zoom;
  if (cellScreen < 8) {
    const layers = layerManager.getByType('working');
    const layer = layers.find(l => l.visible) || layers[0];
    if (layer) {
      const minZoom = 12 * mpp;
      viewport.fitRect(layer.originX, layer.originY, layer.width, layer.height,
        renderer.width, renderer.height, minZoom);
    }
  }

  closeSidebar();
  bus.emit('render:request');
});

bus.on('tool:activate', (name) => {
  toolManager.activate(name);
  if (name !== 'place') assetPanel.clearSelection();
});

bus.on('tool:changed', (name) => {
  if (name !== 'place') assetPanel.clearSelection();
});

toolManager.activate('select');

// Test hook
window._app = { bus, viewport, mapScale, mapLayer, assetLayer, layerManager, toolManager, renderer, calibrationTool, gridSettings, fineTuneState, assetEditSheet, saveLoad, blueprintLayer, importUI };

document.getElementById('help-close').addEventListener('click', () => {
  document.getElementById('help-panel').classList.add('hidden');
});

// Sidebar (a right-hand rail on desktop, a bottom sheet on mobile)
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebar-backdrop');

function closeSidebar() {
  sidebar.classList.remove('open');
  backdrop.classList.add('hidden');
  bus.emit('sidebar:changed', false);
}

function openSidebar() {
  sidebar.classList.add('open');
  backdrop.classList.remove('hidden');
  bus.emit('sidebar:changed', true);
}

if (backdrop) {
  backdrop.addEventListener('click', closeSidebar);
}

bus.on('sidebar:toggle', () => {
  if (sidebar.classList.contains('open')) closeSidebar();
  else openSidebar();
});
bus.on('sidebar:open', openSidebar);
bus.on('sidebar:close', closeSidebar);

// State preserved across the preview step
let _preCalibrationState = null;

bus.on('calibration:apply', () => {
  if (!mapLayer.image) return;

  // Anchor the straightened output on a fixed point of the solved matrix —
  // the rectangle's first corner, or the across pair's first pin — so the
  // rest of the plan (working layer, existing assets) needs only a single
  // reference point to re-anchor against.
  let H, outPxPerTile, anchor;
  if (calibrationTool.calibMethod === 'rectangle') {
    const rect = calibrationTool.rectangle;
    const rectSolve = MapScale.solveRectangle(rect.corners, rect.widthTiles, rect.heightTiles);
    if (!rectSolve) return;
    H = rectSolve.H;
    outPxPerTile = rectSolve.outPxPerMetre * TILE_METRES;
    anchor = rect.corners[0];
  } else {
    const pairs = calibrationTool.pairs;
    const solve = MapScale.solveCalibration(pairs);
    if (solve.mode !== 'affine' && solve.mode !== 'iso') return;
    anchor = pairs.across.a;
    outPxPerTile = (solve.pxPerTileX + solve.pxPerTileY) / 2;
    H = MapScale.buildStraightenMatrix(solve, anchor, outPxPerTile);
    if (!H) return;
  }

  const oldImage = mapLayer.image;
  const oldWidth = mapLayer.width;
  const oldHeight = mapLayer.height;
  const oldMpp = mapScale.metresPerPixel;
  const oldLayers = layerManager.getByType('working').map(wl => ({
    id: wl.id, name: wl.name,
    originX: wl.originX, originY: wl.originY,
    width: wl.width, height: wl.height,
    gridAnchorX: wl.gridAnchorX, gridAnchorY: wl.gridAnchorY,
    visible: wl.visible,
  }));
  const oldAssets = assetLayer.assets.map(a => ({
    asset: a,
    gridX: a.gridX, gridY: a.gridY,
    workingLayer: a.workingLayer,
  }));

  _preCalibrationState = { oldImage, oldWidth, oldHeight, oldMpp, oldLayers, oldAssets };

  const outCanvas = PerspectiveTransform.correctImageFromMatrix(mapLayer.image, H);
  if (!outCanvas) { _preCalibrationState = null; return; }

  mapLayer.applyCorrectedImage(outCanvas);
  mapScale.locked = false;
  mapScale.metresPerPixel = TILE_METRES / outPxPerTile;
  viewport.fitImage(mapLayer.width, mapLayer.height, renderer.width, renderer.height);

  if (mapScale.mapMode === 'local') {
    const existing = layerManager.getByType('working');
    const oldLayer = existing[0] || null;
    for (const wl of existing) layerManager.removeLayer(wl.id);

    const wl = new WorkingLayer(0, 0, mapLayer.width, mapLayer.height, bus, mapScale, gridSettings, fineTuneState);
    wl.name = 'Build area 1';
    wl.gridAnchorX = anchor.x;
    wl.gridAnchorY = anchor.y;
    layerManager.addLayer(wl);

    const newMpp = mapScale.metresPerPixel;
    const newAx = anchor.x;
    const newAy = anchor.y;
    for (const asset of assetLayer.assets) {
      if (asset.workingLayer && oldLayer) {
        const oldAx = oldLayer.gridAnchorX != null ? oldLayer.gridAnchorX : oldLayer.originX;
        const oldAy = oldLayer.gridAnchorY != null ? oldLayer.gridAnchorY : oldLayer.originY;
        const mapPx = oldAx + asset.gridX / oldMpp;
        const mapPy = oldAy + asset.gridY / oldMpp;
        asset.gridX = (mapPx - newAx) * newMpp;
        asset.gridY = (mapPy - newAy) * newMpp;
      }
      asset.workingLayer = wl;
    }

    // Hide the working layer grid during preview (the tool draws its own)
    wl.visible = false;

    calibrationTool.enterPreview(anchor.x, anchor.y, newMpp);
  } else {
    _preCalibrationState = null;
    toolManager.activate('select');
  }
});

bus.on('calibration:previewConfirm', () => {
  const mpp = calibrationTool._previewMpp;
  const ax = calibrationTool._previewAnchorX;
  const ay = calibrationTool._previewAnchorY;

  mapScale.locked = false;
  mapScale.metresPerPixel = mpp;

  const layers = layerManager.getByType('working');
  if (layers[0]) {
    layers[0].gridAnchorX = ax;
    layers[0].gridAnchorY = ay;
    layers[0].visible = true;
  }

  calibrationTool.exitPreview();
  calibrationTool.resetPairs();
  _preCalibrationState = null;
  toolManager.activate('select');
  bus.emit('render:request');
});

bus.on('calibration:previewCancel', () => {
  calibrationTool.exitPreview();

  if (_preCalibrationState) {
    const s = _preCalibrationState;

    // Restore original image
    mapLayer.image = s.oldImage;
    mapLayer.width = s.oldWidth;
    mapLayer.height = s.oldHeight;
    mapLayer._dataURL = null;

    mapScale.locked = false;
    mapScale.metresPerPixel = s.oldMpp;

    // Restore working layers
    const existing = layerManager.getByType('working');
    for (const wl of existing) layerManager.removeLayer(wl.id);
    for (const saved of s.oldLayers) {
      const wl = new WorkingLayer(saved.originX, saved.originY, saved.width, saved.height, bus, mapScale, gridSettings, fineTuneState);
      wl.name = saved.name;
      wl.gridAnchorX = saved.gridAnchorX;
      wl.gridAnchorY = saved.gridAnchorY;
      wl.visible = saved.visible;
      layerManager.addLayer(wl);
    }

    // Restore asset positions
    for (const saved of s.oldAssets) {
      saved.asset.gridX = saved.gridX;
      saved.asset.gridY = saved.gridY;
      saved.asset.workingLayer = saved.workingLayer;
    }

    viewport.fitImage(mapLayer.width, mapLayer.height, renderer.width, renderer.height);
    _preCalibrationState = null;
  }

  toolManager.activate('select');
  bus.emit('render:request');
});

bus.on('finetune:lock', () => {
  if (!mapLayer.image || !fineTuneState.hasPending) return;
  const layers = layerManager.getByType('working');
  const mainLayer = layers[0];
  if (!mainLayer) return;

  const mainBaseAnchor = {
    x: mainLayer.gridAnchorX != null ? mainLayer.gridAnchorX : mainLayer.originX,
    y: mainLayer.gridAnchorY != null ? mainLayer.gridAnchorY : mainLayer.originY,
  };
  const nudgedAnchor = { x: mainBaseAnchor.x + fineTuneState.dxPx, y: mainBaseAnchor.y + fineTuneState.dyPx };

  const solve = {
    mode: 'affine',
    pxPerTileX: fineTuneState.across,
    pxPerTileY: fineTuneState.down,
    rotationDeg: fineTuneState.rotationDeg,
    shearDeg: 0,
  };
  const outPxPerTile = (fineTuneState.across + fineTuneState.down) / 2;
  const H = MapScale.buildStraightenMatrix(solve, nudgedAnchor, outPxPerTile);
  if (!H) return;

  const oldMpp = mapScale.metresPerPixel;
  const outCanvas = PerspectiveTransform.correctImageFromMatrix(mapLayer.image, H);
  if (!outCanvas) return;

  // Snapshot old anchors/asset positions before mutating anything, then
  // carry every one of them through the same matrix H so multiple working
  // areas (and their assets) all shift consistently.
  const oldLayerAnchors = layers.map(w => ({
    layer: w,
    x: w.gridAnchorX != null ? w.gridAnchorX : w.originX,
    y: w.gridAnchorY != null ? w.gridAnchorY : w.originY,
  }));
  const oldAssetMapPx = assetLayer.assets.map(a => {
    if (!a.workingLayer) return { asset: a, mapPx: null };
    const ax = a.workingLayer.gridAnchorX != null ? a.workingLayer.gridAnchorX : a.workingLayer.originX;
    const ay = a.workingLayer.gridAnchorY != null ? a.workingLayer.gridAnchorY : a.workingLayer.originY;
    return { asset: a, mapPx: { x: ax + a.gridX / oldMpp, y: ay + a.gridY / oldMpp } };
  });

  mapLayer.applyCorrectedImage(outCanvas);
  mapScale.locked = false;
  mapScale.metresPerPixel = TILE_METRES / outPxPerTile;
  const newMpp = mapScale.metresPerPixel;

  for (const { layer, x, y } of oldLayerAnchors) {
    const newAnchor = PerspectiveTransform.transformPoint(H, x, y);
    layer.gridAnchorX = newAnchor.x;
    layer.gridAnchorY = newAnchor.y;
  }

  for (const { asset, mapPx } of oldAssetMapPx) {
    if (!mapPx) continue;
    const newMapPx = PerspectiveTransform.transformPoint(H, mapPx.x, mapPx.y);
    const wl = asset.workingLayer;
    asset.gridX = (newMapPx.x - wl.gridAnchorX) * newMpp;
    asset.gridY = (newMapPx.y - wl.gridAnchorY) * newMpp;
  }

  viewport.fitImage(mapLayer.width, mapLayer.height, renderer.width, renderer.height);
  fineTuneState.reset();
  bus.emit('render:request');
});

// --- Fine tune keyboard shortcuts (arrow keys nudge, X/Y hold scales one
// axis only, Escape clears a latch) ---
function isTypingTarget(el) {
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

window.addEventListener('keydown', (e) => {
  if (isTypingTarget(document.activeElement)) return;
  if (e.code === 'Escape') { fineTuneState.clearLatch(); return; }
  if (!layerManager.getByType('working')[0]) return;

  if (e.code === 'ArrowUp') { fineTuneState.nudge(0, -1); e.preventDefault(); }
  else if (e.code === 'ArrowDown') { fineTuneState.nudge(0, 1); e.preventDefault(); }
  else if (e.code === 'ArrowLeft') { fineTuneState.nudge(-1, 0); e.preventDefault(); }
  else if (e.code === 'ArrowRight') { fineTuneState.nudge(1, 0); e.preventDefault(); }
  else if (e.code === 'KeyX') { fineTuneState.holdAxis('x'); }
  else if (e.code === 'KeyY') { fineTuneState.holdAxis('y'); }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyX' || e.code === 'KeyY') fineTuneState.holdAxis(null);
});
