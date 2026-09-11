export class ToolManager {
  constructor(canvas, viewport, bus) {
    this.canvas = canvas;
    this.viewport = viewport;
    this.bus = bus;
    this.tools = {};
    this.currentTool = null;
    this.currentToolName = null;
    this._isPanning = false;
    this._panStart = null;
    this._spaceDown = false;
    this.snapMode = 'grid';

    // Mouse events
    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    canvas.addEventListener('dblclick', (e) => this._onDblClick(e));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));

    // Touch events
    this._touchState = { active: [], startTime: 0, startPos: null, moved: false, panning: false };
    this._pinch = { active: false, startDist: 0, startZoom: 0, center: null };
    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });
    canvas.addEventListener('touchcancel', (e) => this._onTouchEnd(e), { passive: false });
  }

  register(name, tool) {
    this.tools[name] = tool;
  }

  activate(name) {
    if (this.currentTool && this.currentTool.deactivate) {
      this.currentTool.deactivate();
    }
    this.currentToolName = name;
    this.currentTool = this.tools[name] || null;
    if (this.currentTool && this.currentTool.activate) {
      this.currentTool.activate();
    }
    this.bus.emit('tool:changed', name);
    this.bus.emit('render:request');
  }

  _getPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  _getTouchPos(touch) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  }

  // --- Mouse handlers ---

  _onMouseDown(e) {
    const pos = this._getPos(e);

    if (e.button === 1 || (e.button === 0 && this._spaceDown)) {
      this._isPanning = true;
      this._panStart = { x: e.clientX, y: e.clientY };
      this.canvas.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }

    if (this.currentTool && this.currentTool.onMouseDown) {
      this.currentTool.onMouseDown(pos, e);
    }
  }

  _onMouseMove(e) {
    const pos = this._getPos(e);

    if (this._isPanning) {
      const dx = e.clientX - this._panStart.x;
      const dy = e.clientY - this._panStart.y;
      this._panStart = { x: e.clientX, y: e.clientY };
      this.viewport.panBy(dx, dy);
      return;
    }

    if (this.currentTool && this.currentTool.onMouseMove) {
      this.currentTool.onMouseMove(pos, e);
    }
  }

  _onMouseUp(e) {
    if (this._isPanning) {
      this._isPanning = false;
      this.canvas.style.cursor = '';
      return;
    }

    if (this.currentTool && this.currentTool.onMouseUp) {
      const pos = this._getPos(e);
      this.currentTool.onMouseUp(pos, e);
    }
  }

  _onDblClick(e) {
    const pos = this._getPos(e);
    if (this.currentTool && this.currentTool.onDblClick) {
      this.currentTool.onDblClick(pos, e);
    }
  }

  _onWheel(e) {
    e.preventDefault();
    if (this._isPanning) return;
    const pos = this._getPos(e);

    if (this.currentTool && this.currentTool.onWheel) {
      const handled = this.currentTool.onWheel(pos, e);
      if (handled) return;
    }

    this.viewport.zoomAt(pos.x, pos.y, e.deltaY);
  }

  _onKeyDown(e) {
    if (e.code === 'Space' && !e.repeat) {
      this._spaceDown = true;
      this.canvas.style.cursor = 'grab';
      e.preventDefault();
      return;
    }

    if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && !e.repeat) {
      this.snapMode = this.snapMode === 'asset' ? 'grid' : 'asset';
      this.bus.emit('snap:changed', this.snapMode);
      this.bus.emit('render:request');
      e.preventDefault();
      return;
    }

    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) {
      this.snapMode = this.snapMode === 'free' ? 'grid' : 'free';
      this.bus.emit('snap:changed', this.snapMode);
      this.bus.emit('render:request');
      e.preventDefault();
      return;
    }

    if (this.currentTool && this.currentTool.onKeyDown) {
      this.currentTool.onKeyDown(e);
    }
  }

  _onKeyUp(e) {
    if (e.code === 'Space') {
      this._spaceDown = false;
      if (!this._isPanning) {
        this.canvas.style.cursor = '';
      }
    }
  }

  // --- Touch handlers ---

  _onTouchStart(e) {
    e.preventDefault();
    const touches = e.touches;
    const ts = this._touchState;

    if (touches.length === 1) {
      const t = touches[0];
      const pos = this._getTouchPos(t);
      ts.startTime = Date.now();
      ts.startPos = { x: t.clientX, y: t.clientY };
      ts.moved = false;
      ts.panning = false;
      ts.toolDrag = false;
      ts.lastPos = { x: t.clientX, y: t.clientY };

      if (this.currentTool && this.currentTool.hitTest && this.currentTool.hitTest(pos)) {
        ts.toolDrag = true;
        if (this.currentTool.onMouseDown) {
          this.currentTool.onMouseDown(pos, {});
        }
      }
    } else if (touches.length === 2) {
      if (ts.toolDrag && this.currentTool && this.currentTool.onMouseUp) {
        const pos = this._getTouchPos(touches[0]);
        this.currentTool.onMouseUp(pos, {});
      }
      ts.toolDrag = false;
      ts.panning = false;
      ts.moved = true;
      const t0 = touches[0];
      const t1 = touches[1];
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      const rect = this.canvas.getBoundingClientRect();
      this._pinch = {
        active: true,
        startDist: Math.hypot(dx, dy),
        startZoom: this.viewport.zoom,
        center: {
          x: (t0.clientX + t1.clientX) / 2 - rect.left,
          y: (t0.clientY + t1.clientY) / 2 - rect.top,
        },
        lastDist: Math.hypot(dx, dy),
      };
    }
  }

  _onTouchMove(e) {
    e.preventDefault();
    const touches = e.touches;
    const ts = this._touchState;

    if (touches.length === 2 && this._pinch.active) {
      const t0 = touches[0];
      const t1 = touches[1];
      const dx = t1.clientX - t0.clientX;
      const dy = t1.clientY - t0.clientY;
      const dist = Math.hypot(dx, dy);
      const scale = dist / this._pinch.startDist;
      const newZoom = Math.max(
        this.viewport.minZoom,
        Math.min(this.viewport.maxZoom, this._pinch.startZoom * scale)
      );

      const mapBefore = this.viewport.screenToMap(this._pinch.center.x, this._pinch.center.y);
      this.viewport.zoom = newZoom;
      this.viewport.panX = this._pinch.center.x - mapBefore.x * this.viewport.zoom;
      this.viewport.panY = this._pinch.center.y - mapBefore.y * this.viewport.zoom;
      this.viewport.bus.emit('viewport:changed');
      this.viewport.bus.emit('render:request');
      return;
    }

    if (touches.length === 1) {
      const t = touches[0];

      if (ts.toolDrag) {
        const pos = this._getTouchPos(t);
        ts.lastPos = { x: t.clientX, y: t.clientY };
        ts.moved = true;
        if (this.currentTool && this.currentTool.onMouseMove) {
          this.currentTool.onMouseMove(pos, {});
        }
        return;
      }

      const dx = t.clientX - ts.startPos.x;
      const dy = t.clientY - ts.startPos.y;

      if (!ts.moved && Math.hypot(dx, dy) > 10) {
        ts.moved = true;
        ts.panning = true;
        ts.lastPos = { x: t.clientX, y: t.clientY };
      }

      if (ts.panning) {
        const pdx = t.clientX - ts.lastPos.x;
        const pdy = t.clientY - ts.lastPos.y;
        ts.lastPos = { x: t.clientX, y: t.clientY };
        this.viewport.panBy(pdx, pdy);
      }
    }
  }

  _onTouchEnd(e) {
    e.preventDefault();
    const ts = this._touchState;

    if (this._pinch.active && e.touches.length < 2) {
      this._pinch.active = false;
      if (e.touches.length === 1) {
        const t = e.touches[0];
        ts.startPos = { x: t.clientX, y: t.clientY };
        ts.lastPos = { x: t.clientX, y: t.clientY };
        ts.moved = true;
        ts.panning = true;
        ts.toolDrag = false;
      }
      return;
    }

    if (e.touches.length === 0) {
      if (ts.toolDrag) {
        const ct = e.changedTouches[0];
        const pos = ct
          ? this._getTouchPos(ct)
          : this._getTouchPos({ clientX: ts.lastPos.x, clientY: ts.lastPos.y });
        if (this.currentTool && this.currentTool.onMouseUp) {
          this.currentTool.onMouseUp(pos, {});
        }
      } else if (!ts.moved) {
        const elapsed = Date.now() - ts.startTime;
        if (elapsed < 300 && ts.startPos) {
          const pos = this._getTouchPos({ clientX: ts.startPos.x, clientY: ts.startPos.y });
          if (this.currentTool) {
            if (this.currentTool.onMouseDown) this.currentTool.onMouseDown(pos, {});
            if (this.currentTool.onMouseUp) this.currentTool.onMouseUp(pos, {});
          }
        }
      }

      ts.panning = false;
      ts.moved = false;
      ts.toolDrag = false;
    }
  }

  // --- Snap mode (called from mobile controls too) ---

  setSnapMode(mode) {
    this.snapMode = mode;
    this.bus.emit('snap:changed', mode);
    this.bus.emit('render:request');
  }

  renderOverlay(ctx, viewport) {
    if (this.currentTool && this.currentTool.renderOverlay) {
      this.currentTool.renderOverlay(ctx, viewport);
    }
  }
}
