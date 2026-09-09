import { EventBus } from './core/EventBus.js';
import { Viewport } from './core/Viewport.js';
import { Renderer } from './core/Renderer.js';
import { LayerManager } from './layers/LayerManager.js';
import { MapLayer } from './layers/MapLayer.js';
import { AssetLayer } from './layers/AssetLayer.js';
import { ToolManager } from './tools/ToolManager.js';
import { PanTool } from './tools/PanTool.js';
import { RegionSelectTool } from './tools/RegionSelectTool.js';
import { PlaceTool } from './tools/PlaceTool.js';
import { SelectTool } from './tools/SelectTool.js';
import { Toolbar } from './ui/Toolbar.js';
import { LayerPanel } from './ui/LayerPanel.js';
import { AssetPanel } from './ui/AssetPanel.js';

const bus = new EventBus();
const canvas = document.getElementById('main-canvas');
const viewport = new Viewport(bus);

const layerManager = new LayerManager(bus);
const mapLayer = new MapLayer(bus);
const assetLayer = new AssetLayer(bus);

layerManager.addLayer(mapLayer);
layerManager.addLayer(assetLayer);

const toolManager = new ToolManager(canvas, viewport, bus);
const panTool = new PanTool(viewport, bus);
const regionTool = new RegionSelectTool(viewport, layerManager, bus);
const placeTool = new PlaceTool(viewport, layerManager, assetLayer, bus);
const selectTool = new SelectTool(viewport, layerManager, assetLayer, bus);

toolManager.register('pan', panTool);
toolManager.register('region', regionTool);
toolManager.register('place', placeTool);
toolManager.register('select', selectTool);

const renderer = new Renderer(canvas, viewport, layerManager, toolManager, bus);

const toolbar = new Toolbar(toolManager, bus);
const layerPanel = new LayerPanel(layerManager, bus);
const assetPanel = new AssetPanel(bus);

bus.on('file:selected', async (file) => {
  await mapLayer.loadFromFile(file);
  viewport.fitImage(mapLayer.width, mapLayer.height, renderer.width, renderer.height);
  document.getElementById('empty-state').style.display = 'none';
});

bus.on('asset:startPlace', (type) => {
  placeTool.setAssetType(type);
  toolManager.activate('place');
});

bus.on('tool:activate', (name) => {
  toolManager.activate(name);
  if (name !== 'place') assetPanel.clearSelection();
});

bus.on('tool:changed', (name) => {
  if (name !== 'place') assetPanel.clearSelection();
});

toolManager.activate('select');

document.getElementById('help-close').addEventListener('click', () => {
  document.getElementById('help-panel').style.display = 'none';
});
