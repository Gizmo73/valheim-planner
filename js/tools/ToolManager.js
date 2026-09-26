// Shortcuts never fire while a modal is open or a text field has focus.
export function keysBlocked() {
  if (document.querySelector('.modal-backdrop')) return true;
  const el = document.activeElement;
  return !!el && (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable);
}

/**
 * Routes pointer and keyboard input to the active tool. Panning is shared by every tool:
 * middle-drag, Space + drag, or two-finger touch. Shift + middle-click is "pick" (tool.onPick).
 * Hold Ctrl to snap to pieces, Alt for free placement; release to return to `snapMode`.
 */
export class ToolManager {
  constructor(canvas, viewport, bus) {
    Object.assign(this, { canvas, viewport, bus });
    this.tools = {};
    this.current = null;
    this.name = null;
    this.snapMode = 'grid';
    this.mods = { ctrl: false, alt: false, shift: false };
    this.pointer = null;
    this.onGlobalKey = null;
    this._space = false;
    this._pan = null;
    this._touches = new Map();

    canvas.addEventListener('pointerdown', e => this._down(e));
    canvas.addEventListener('pointermove', e => this._move(e));
    canvas.addEventListener('pointerup', e => this._up(e));
    canvas.addEventListener('pointercancel', e => this._up(e));
    canvas.addEventListener('pointerleave', () => { this.pointer = null; this.bus.emit('render'); });
    canvas.addEventListener('dblclick', e => this.current?.onDoubleClick?.(this._pos(e), e));
    canvas.addEventListener('wheel', e => this._wheel(e), { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('auxclick', e => e.preventDefault());
    window.addEventListener('keydown', e => this._key(e, true));
    window.addEventListener('keyup', e => this._key(e, false));
    window.addEventListener('blur', () => {
      this._space = false;
      this._setMods({ ctrlKey: false, altKey: false, shiftKey: false });
    });
  }

  register(name, tool) {
    this.tools[name] = tool;
  }

  activate(name) {
    if (!this.tools[name] || this.tools[name].enabled?.() === false) return;
    this.current?.deactivate?.();
    this.name = name;
    this.current = this.tools[name];
    this.current.activate?.();
    this._cursor();
    this.bus.emit('tool:changed', name);
    this.bus.emit('render');
  }

  setSnapMode(mode) {
    this.snapMode = mode;
    this.bus.emit('snap:changed', mode);
    this.current?.refresh?.();
  }

  // Snap mode after hold-modifiers are applied.
  get effectiveSnap() {
    return this.mods.alt ? 'free' : this.mods.ctrl ? 'piece' : this.snapMode;
  }

  drawOverlay(ctx, vp) {
    this.current?.drawOverlay?.(ctx, vp);
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _cursor() {
    this.canvas.style.cursor = this._pan ? 'grabbing' : this._space ? 'grab' : this.current?.cursor || 'default';
  }

  _setMods(e) {
    const next = { ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, shift: e.shiftKey };
    if (next.ctrl === this.mods.ctrl && next.alt === this.mods.alt && next.shift === this.mods.shift) return;
    this.mods = next;
    this.bus.emit('snap:changed', this.effectiveSnap);
    this.current?.refresh?.();
  }

  _down(e) {
    const p = this._pos(e);
    this._setMods(e);
    if (e.pointerType === 'touch') {
      this._touches.set(e.pointerId, p);
      if (this._touches.size === 2) {
        this.current?.cancel?.();
        this._pinch = this._pinchState();
        return;
      }
    }
    if (e.button === 1 && e.shiftKey) {
      e.preventDefault();
      this.current?.onPick?.(p);
      return;
    }
    this.canvas.setPointerCapture(e.pointerId);
    if (e.button === 1 || (e.button === 0 && this._space)) {
      e.preventDefault();
      this._pan = p;
      this._cursor();
      return;
    }
    this.current?.onPointerDown?.(p, e);
  }

  _move(e) {
    const p = this._pos(e);
    this.pointer = p;
    this._setMods(e);
    if (this._touches.has(e.pointerId)) {
      this._touches.set(e.pointerId, p);
      if (this._pinch) return this._pinchMove();
    }
    if (this._pan) {
      this.viewport.panBy(p.x - this._pan.x, p.y - this._pan.y);
      this._pan = p;
      return;
    }
    this.current?.onPointerMove?.(p, e);
    this.bus.emit('pointer:moved', p);
  }

  _up(e) {
    this._touches.delete(e.pointerId);
    if (this._pinch) {
      if (this._touches.size < 2) this._pinch = null;
      return;
    }
    if (this._pan) {
      this._pan = null;
      this._cursor();
      return;
    }
    this.current?.onPointerUp?.(this._pos(e), e);
  }

  _pinchState() {
    const [a, b] = [...this._touches.values()];
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }

  _pinchMove() {
    const next = this._pinchState();
    this.viewport.panBy(next.mid.x - this._pinch.mid.x, next.mid.y - this._pinch.mid.y);
    this.viewport.zoomAt(next.mid.x, next.mid.y, next.dist / this._pinch.dist);
    this._pinch = next;
  }

  _wheel(e) {
    e.preventDefault();
    const p = this._pos(e);
    const scale = e.deltaMode === 1 ? 16 : 1;
    this.viewport.zoomAt(p.x, p.y, Math.exp(-e.deltaY * scale * (e.ctrlKey ? 0.01 : 0.0015)));
  }

  _key(e, down) {
    this._setMods(e);
    if (e.key === 'Alt') e.preventDefault(); // stops Alt focusing the browser menu
    if (e.code === 'Space') {
      if (down && keysBlocked()) return;
      e.preventDefault();
      this._space = down;
      this._cursor();
      return;
    }
    if (!down || keysBlocked()) return;
    if (this.onGlobalKey?.(e)) {
      e.preventDefault();
      return;
    }
    if (this.current?.onKeyDown?.(e)) e.preventDefault();
  }
}
