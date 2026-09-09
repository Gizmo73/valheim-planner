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

    canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));
    canvas.addEventListener('wheel', (e) => this._onWheel(e), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this._onKeyDown(e));
    window.addEventListener('keyup', (e) => this._onKeyUp(e));
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
    const pos = this._getPos(e);

    if (this._isPanning) {
      this._isPanning = false;
      this.canvas.style.cursor = '';
      return;
    }

    if (this.currentTool && this.currentTool.onMouseUp) {
      this.currentTool.onMouseUp(pos, e);
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

  renderOverlay(ctx, viewport) {
    if (this.currentTool && this.currentTool.renderOverlay) {
      this.currentTool.renderOverlay(ctx, viewport);
    }
  }
}
