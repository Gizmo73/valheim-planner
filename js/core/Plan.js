const HISTORY_LIMIT = 100;

// The document: layers (bottom -> top), placed items, anchor, terrain and screenshot.
// Item: { id, asset, x, y, rot, group } — centre in world metres, rot in degrees (Valheim yaw).
export class Plan {
  constructor(bus) {
    this.bus = bus;
    this._nextId = 1;
    this._undo = [];
    this._redo = [];
    this.anchor = null; // { text, world: {x, y, z} }
    this.terrain = null;
    this.screenshot = null;
    this.reset();
  }

  reset() {
    this.items = [];
    this.groups = [];
    this.visibleCount = 0;
    this.addGroup('Layer 1');
    this._undo = [];
    this._redo = [];
  }

  id(prefix) {
    return `${prefix}${this._nextId++}`;
  }

  changed() {
    this.bus.emit('plan:changed');
    this.bus.emit('render');
  }

  // --- undo ---

  _snapshot() {
    return JSON.stringify({ items: this.items, groups: this.groups, visibleCount: this.visibleCount, activeGroup: this.activeGroup });
  }

  _restore(json) {
    const s = JSON.parse(json);
    Object.assign(this, s);
    this.changed();
  }

  checkpoint() {
    this._undo.push(this._snapshot());
    if (this._undo.length > HISTORY_LIMIT) this._undo.shift();
    this._redo = [];
  }

  get canUndo() { return this._undo.length > 0; }
  get canRedo() { return this._redo.length > 0; }

  undo() {
    if (!this._undo.length) return;
    this._redo.push(this._snapshot());
    this._restore(this._undo.pop());
  }

  redo() {
    if (!this._redo.length) return;
    this._undo.push(this._snapshot());
    this._restore(this._redo.pop());
  }

  // --- layers ---

  group(id) {
    return this.groups.find(g => g.id === id) || null;
  }

  groupIndex(id) {
    return this.groups.findIndex(g => g.id === id);
  }

  // The height slider shows the bottom `visibleCount` layers.
  isGroupShown(g) {
    return g.visible && this.groups.indexOf(g) < this.visibleCount;
  }

  addGroup(name, index = this.groups.length) {
    const allShown = this.visibleCount >= this.groups.length;
    const g = { id: this.id('g'), name, visible: true };
    this.groups.splice(index, 0, g);
    if (allShown || index < this.visibleCount) this.visibleCount++;
    this.activeGroup = g.id;
    this.changed();
    return g;
  }

  removeGroup(id) {
    const i = this.groupIndex(id);
    if (i < 0 || this.groups.length === 1) return;
    const target = this.groups[i > 0 ? i - 1 : 1];
    for (const it of this.items) if (it.group === id) it.group = target.id;
    this.groups.splice(i, 1);
    if (i < this.visibleCount) this.visibleCount--;
    if (this.activeGroup === id) this.activeGroup = target.id;
    this.changed();
  }

  moveGroup(id, toIndex) {
    const from = this.groupIndex(id);
    if (from < 0 || from === toIndex) return;
    const [g] = this.groups.splice(from, 1);
    this.groups.splice(toIndex, 0, g);
    this.changed();
  }

  setVisibleCount(n) {
    this.visibleCount = Math.max(0, Math.min(this.groups.length, n));
    this.changed();
  }

  // Makes sure newly placed pieces are visible rather than vanishing into a hidden layer.
  revealGroup(id) {
    const g = this.group(id);
    if (!g) return;
    g.visible = true;
    this.visibleCount = Math.max(this.visibleCount, this.groupIndex(id) + 1);
  }

  // --- items ---

  addItem(asset, x, y, rot, group = this.activeGroup) {
    const it = { id: this.id('i'), asset, x, y, rot, group };
    this.items.push(it);
    return it;
  }

  removeItems(list) {
    const drop = new Set(list);
    this.items = this.items.filter(it => !drop.has(it));
    this.changed();
  }

  moveItemsToGroup(list, groupId) {
    for (const it of list) it.group = groupId;
    this.changed();
  }

  countIn(groupId) {
    return this.items.reduce((n, it) => n + (it.group === groupId), 0);
  }

  // Visible items, bottom layer first.
  *drawOrder() {
    const byGroup = new Map(this.groups.map(g => [g.id, []]));
    for (const it of this.items) byGroup.get(it.group)?.push(it);
    for (const g of this.groups) if (this.isGroupShown(g)) yield* byGroup.get(g.id);
  }

  visibleItems() {
    return [...this.drawOrder()];
  }

  hitTest(x, y, library) {
    const list = this.visibleItems();
    for (let i = list.length - 1; i >= 0; i--) {
      if (library.contains(list[i], x, y)) return list[i];
    }
    return null;
  }

  bounds(library) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const it of this.items) {
      const r = (library.get(it.asset)?.radius) || 1;
      minX = Math.min(minX, it.x - r); maxX = Math.max(maxX, it.x + r);
      minY = Math.min(minY, it.y - r); maxY = Math.max(maxY, it.y + r);
    }
    return minX < maxX ? { minX, minY, maxX, maxY } : null;
  }

  isEmpty() {
    return !this.items.length && !this.terrain && !this.screenshot;
  }

  toJSON() {
    return { groups: this.groups, items: this.items, visibleCount: this.visibleCount, activeGroup: this.activeGroup, anchor: this.anchor };
  }

  load({ groups, items, visibleCount, activeGroup, anchor }) {
    this.groups = groups?.length ? groups : [{ id: 'g0', name: 'Layer 1', visible: true }];
    this.items = items || [];
    this.visibleCount = visibleCount ?? this.groups.length;
    this.activeGroup = this.group(activeGroup) ? activeGroup : this.groups[this.groups.length - 1].id;
    this.anchor = anchor || null;
    const ids = [...this.groups, ...this.items].map(o => parseInt(String(o.id).slice(1), 10) || 0);
    this._nextId = Math.max(0, ...ids) + 1;
    this._undo = [];
    this._redo = [];
    this.changed();
  }
}
