export class Toolbar {
  constructor(toolManager, bus) {
    this.toolManager = toolManager;
    this.bus = bus;
    this._buttons = {};
    this._el = document.getElementById('toolbar');
    this._init();

    bus.on('tool:changed', (name) => this._updateActive(name));
  }

  _init() {
    const tools = [
      { name: 'select', label: 'Select', icon: '↖' },
      { name: 'region', label: 'Region', icon: '⬚' },
      { name: 'pan', label: 'Pan', icon: '✋' },
    ];

    const group = document.createElement('div');
    group.className = 'toolbar-group';

    for (const t of tools) {
      const btn = document.createElement('button');
      btn.className = 'toolbar-btn';
      btn.title = t.label;
      btn.innerHTML = `<span class="toolbar-icon">${t.icon}</span><span class="toolbar-label">${t.label}</span>`;
      btn.addEventListener('click', () => this.toolManager.activate(t.name));
      this._buttons[t.name] = btn;
      group.appendChild(btn);
    }

    this._el.appendChild(group);

    const sep = document.createElement('div');
    sep.className = 'toolbar-sep';
    this._el.appendChild(sep);

    const uploadBtn = document.createElement('button');
    uploadBtn.className = 'toolbar-btn';
    uploadBtn.innerHTML = '<span class="toolbar-icon">📁</span><span class="toolbar-label">Upload Map</span>';
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    uploadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) {
        this.bus.emit('file:selected', fileInput.files[0]);
        fileInput.value = '';
      }
    });
    this._el.appendChild(uploadBtn);
    this._el.appendChild(fileInput);

    const zoomLabel = document.createElement('span');
    zoomLabel.className = 'zoom-label';
    zoomLabel.id = 'zoom-label';
    zoomLabel.textContent = '100%';
    this._el.appendChild(zoomLabel);

    this.bus.on('viewport:changed', () => {
      const vp = this.toolManager.viewport;
      zoomLabel.textContent = Math.round(vp.zoom * 100) + '%';
    });
  }

  _updateActive(name) {
    for (const [key, btn] of Object.entries(this._buttons)) {
      btn.classList.toggle('active', key === name);
    }
  }
}
