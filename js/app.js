import { EventBus } from './core/EventBus.js';
import { Viewport } from './core/Viewport.js';
import { Grid } from './core/Grid.js';
import { Plan } from './core/Plan.js';
import { Renderer } from './core/Renderer.js';
import { wrapDeg } from './core/geometry.js';
import { serialisePlan, loadPlan } from './core/planFile.js';
import { AssetLibrary } from './assets/AssetLibrary.js';
import { Screenshot } from './world/Screenshot.js';
import { ToolManager } from './tools/ToolManager.js';
import { SelectTool } from './tools/SelectTool.js';
import { PlaceTool } from './tools/PlaceTool.js';
import { CalibrateTool } from './tools/CalibrateTool.js';
import { Toolbar } from './ui/Toolbar.js';
import { ContextBar } from './ui/ContextBar.js';
import { AssetPanel } from './ui/AssetPanel.js';
import { LayerPanel } from './ui/LayerPanel.js';
import { SettingsPanel } from './ui/SettingsPanel.js';
import { Inspector } from './ui/Inspector.js';
import { StatusBar } from './ui/StatusBar.js';
import { AssetEditor } from './ui/AssetEditor.js';
import { ImportDialog } from './ui/ImportDialog.js';
import { download, pickFiles, toast, icon } from './ui/dom.js';

const $ = id => document.getElementById(id);
const bus = new EventBus();
const canvas = $('canvas');
const viewport = new Viewport(bus);
const env = {
  bus,
  viewport,
  grid: new Grid(bus),
  plan: new Plan(bus),
  library: new AssetLibrary(bus),
  tools: new ToolManager(canvas, viewport, bus),
  actions: {},
};
const { plan, grid, library, tools } = env;

tools.register('select', new SelectTool(env));
tools.register('place', new PlaceTool(env));
tools.register('calibrate', new CalibrateTool(env));
new Renderer(canvas, env);

try {
  await library.load();
} catch (err) {
  console.error(err);
  toast('The asset library failed to load', 'error');
}

// --- actions ---

function contentBounds() {
  const b = plan.bounds(library);
  if (b) return b;
  if (plan.terrain) {
    const t = plan.terrain, x = t.x0 - t.anchor.x, y = t.anchor.z - (t.z0 + t.rows);
    return { minX: x, minY: y, maxX: x + t.cols, maxY: y + t.rows };
  }
  if (plan.screenshot) {
    const s = plan.screenshot;
    const pts = [[0, 0], [s.width, 0], [s.width, s.height], [0, s.height]].map(([x, y]) => s.imageToWorld(x, y));
    return { minX: Math.min(...pts.map(p => p.x)), maxX: Math.max(...pts.map(p => p.x)), minY: Math.min(...pts.map(p => p.y)), maxY: Math.max(...pts.map(p => p.y)) };
  }
  return { minX: -10, minY: -10, maxX: 10, maxY: 10 };
}

// Turn the view so most of the build is square to the screen, then line the grid up with it.
function orient() {
  const counts = new Map();
  for (const it of plan.items) {
    if (library.get(it.asset)?.category === 'nature') continue;
    const k = wrapDeg(Math.round(it.rot / 22.5) * 22.5) % 90;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  const [yaw] = [...counts].sort((a, b) => b[1] - a[1])[0] || [0];
  viewport.setRotation(wrapDeg(-yaw));
  viewport.fit(contentBounds());
  grid.alignTo(plan.items, library, viewport);
}

async function openPlanFile(file) {
  try {
    await loadPlan(await file.text(), env);
    tools.activate('select');
    viewport.fit(contentBounds());
    bus.emit('screenshot:changed');
    toast(`Opened ${file.name}`);
  } catch (err) {
    console.error(err);
    toast(`Couldn't open plan: ${err.message}`, 'error');
  }
}

async function setScreenshot(file) {
  try {
    const shot = await Screenshot.fromFile(file);
    shot.placeInView(viewport);
    plan.screenshot = shot;
    bus.emit('screenshot:changed');
    plan.changed();
    tools.activate('calibrate');
  } catch (err) {
    toast(err.message, 'error');
  }
}

Object.assign(env.actions, {
  fit: () => viewport.fit(contentBounds()),
  orient,
  importWorld: () => bus.emit('import:open'),
  addScreenshot: async () => {
    const [file] = await pickFiles({ accept: 'image/*' });
    if (file) setScreenshot(file);
  },
  open: async () => {
    const [file] = await pickFiles({ accept: '.json,application/json' });
    if (file) openPlanFile(file);
  },
  save: () => {
    const name = (plan.anchor?.text || 'valheim-plan').replace(/[^\w-]+/g, '_');
    download(`${name}.json`, serialisePlan(env));
  },
});

// --- UI ---

new Toolbar($('toolbar'), env);
new ContextBar($('context-bar'), env);
new AssetPanel($('tab-assets'), env);
new LayerPanel($('tab-layers'), env);
new SettingsPanel($('tab-settings'), env);
new Inspector($('inspector'), env);
new StatusBar($('statusbar'), env);
new AssetEditor(env);
new ImportDialog(env);

for (const btn of document.querySelectorAll('[data-tab]')) {
  btn.addEventListener('click', () => {
    for (const b of document.querySelectorAll('[data-tab]')) b.classList.toggle('active', b === btn);
    for (const p of document.querySelectorAll('.tab-panel')) p.hidden = p.id !== `tab-${btn.dataset.tab}`;
  });
}

for (const el of document.querySelectorAll('[data-icon]')) el.prepend(icon(el.dataset.icon));
$('empty-import').addEventListener('click', env.actions.importWorld);
$('empty-screenshot').addEventListener('click', env.actions.addScreenshot);
$('empty-open').addEventListener('click', env.actions.open);
const syncEmpty = () => { $('empty-state').hidden = !plan.isEmpty() || tools.name === 'place'; };
for (const ev of ['plan:changed', 'screenshot:changed', 'tool:changed']) bus.on(ev, syncEmpty);

// Selects, sliders and toggles hand focus back once used, so shortcuts keep working.
document.addEventListener('change', e => {
  if (!e.target.matches('input[type=text], input[type=number], input[type=search], input[type=password], textarea')) e.target.blur();
});

// The grid follows the build: re-align whenever the view turns.
bus.on('view:rotated', () => grid.alignTo(plan.items, library, viewport));

const stage = $('stage');
stage.addEventListener('dragover', e => e.preventDefault());
stage.addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (file.type.startsWith('image/')) setScreenshot(file);
  else if (file.name.endsWith('.json')) openPlanFile(file);
  else env.actions.importWorld();
});

tools.onGlobalKey = e => {
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl) {
    if (e.code === 'KeyZ') e.shiftKey ? plan.redo() : plan.undo();
    else if (e.code === 'KeyY') plan.redo();
    else if (e.code === 'KeyS') env.actions.save();
    else if (e.code === 'KeyO') env.actions.open();
    else return false;
    return true;
  }
  if (e.code === 'KeyV') tools.activate('select');
  else if (e.code === 'KeyB') tools.activate('place');
  else if (e.code === 'KeyA') tools.activate('calibrate');
  else if (e.code === 'BracketLeft') viewport.rotateBy(-1);
  else if (e.code === 'BracketRight') viewport.rotateBy(1);
  else if (e.code === 'Home') env.actions.fit();
  else return false;
  return true;
};

tools.activate('select');
syncEmpty();
window.planner = env; // handy from the devtools console
