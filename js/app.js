import { EventBus } from './core/EventBus.js';
import { Viewport } from './core/Viewport.js';
import { MapScale } from './core/MapScale.js';
import { GridSettings } from './core/GridSettings.js';
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
import { PlanPanel } from './ui/PlanPanel.js';
import { SelectionInspector } from './ui/SelectionInspector.js';
import { CalibrationPanel } from './ui/CalibrationPanel.js';
import { MobileControls } from './ui/MobileControls.js';
import { refreshIcons } from './ui/icons.js';

const bus = new EventBus();
const canvas = document.getElementById('main-canvas');
const viewport = new Viewport(bus);
const mapScale = new MapScale(bus);
const gridSettings = new GridSettings(bus);

const layerManager = new LayerManager(bus);
const mapLayer = new MapLayer(bus);
const assetLayer = new AssetLayer(bus);

layerManager.addLayer(mapLayer);
layerManager.addLayer(assetLayer);

const toolManager = new ToolManager(canvas, viewport, bus);
const panTool = new PanTool(viewport, bus);
const regionTool = new RegionSelectTool(viewport, layerManager, mapScale, bus, gridSettings);
const placeTool = new PlaceTool(viewport, layerManager, assetLayer, mapScale, bus);
const selectTool = new SelectTool(viewport, layerManager, assetLayer, mapScale, bus);
const calibrationTool = new CalibrationTool(viewport, mapLayer, mapScale, bus);

toolManager.register('pan', panTool);
toolManager.register('region', regionTool);
toolManager.register('place', placeTool);
toolManager.register('select', selectTool);
toolManager.register('calibrate', calibrationTool);

const renderer = new Renderer(canvas, viewport, layerManager, toolManager, bus);

const toolbar = new Toolbar(toolManager, mapScale, bus);
const placeContextBar = new PlaceContextBar(placeTool, toolManager, bus);
const layerPanel = new LayerPanel(layerManager, assetLayer, bus);
const assetPanel = new AssetPanel(bus);
const planPanel = new PlanPanel(gridSettings, mapScale, assetLayer, bus);
const selectionInspector = new SelectionInspector(selectTool, viewport, assetLayer, toolManager, bus);
const calibrationPanel = new CalibrationPanel(mapScale, calibrationTool, bus);
const mobileControls = new MobileControls(toolManager, selectTool, mapScale, bus);

const saveLoad = new SaveLoad(layerManager, mapLayer, assetLayer, mapScale, viewport, renderer, bus);

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
window._app = { bus, viewport, mapScale, mapLayer, assetLayer, layerManager, toolManager, renderer };

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

bus.on('calibration:snapAll', () => {
  const failed = calibrationTool.snapAllPins();
  if (failed.length > 0) {
    bus.emit('calibration:snapResult', {
      ok: false,
      why: 'no corner found for pin(s) ' + failed.join(', '),
    });
  } else {
    bus.emit('calibration:snapResult', { ok: true, why: 'all pins snapped' });
  }
});

bus.on('calibration:apply', () => {
  if (!mapLayer.image) return;
  const srcPins = calibrationTool.pins;
  const worldPins = calibrationTool.pinWorldCoords();
  const enabled = calibrationTool.enabled;

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

  const result = PerspectiveTransform.correctImageCheckerboard(
    mapLayer.image, srcPins, worldPins, enabled
  );
  if (!result) return;

  mapLayer.applyCorrectedImage(result.canvas);
  mapScale.locked = false;
  mapScale.metresPerPixel = result.metresPerPixel;
  viewport.fitImage(mapLayer.width, mapLayer.height, renderer.width, renderer.height);

  if (mapScale.mapMode === 'local') {
    const existing = layerManager.getByType('working');
    const oldLayer = existing[0] || null;
    for (const wl of existing) layerManager.removeLayer(wl.id);

    const wl = new WorkingLayer(0, 0, mapLayer.width, mapLayer.height, bus, mapScale, gridSettings);
    wl.name = 'Build area 1';
    if (result.refRect) {
      wl.gridAnchorX = result.refRect.x;
      wl.gridAnchorY = result.refRect.y;
    }
    layerManager.addLayer(wl);

    const newMpp = result.metresPerPixel;
    const newAx = wl.gridAnchorX != null ? wl.gridAnchorX : wl.originX;
    const newAy = wl.gridAnchorY != null ? wl.gridAnchorY : wl.originY;
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

    const anchorX = result.refRect ? result.refRect.x : 0;
    const anchorY = result.refRect ? result.refRect.y : 0;
    calibrationTool.enterPreview(anchorX, anchorY, result.metresPerPixel);
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
      const wl = new WorkingLayer(saved.originX, saved.originY, saved.width, saved.height, bus, mapScale, gridSettings);
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
