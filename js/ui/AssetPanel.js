import { getAssetTypes } from '../assets/AssetRegistry.js';

export class AssetPanel {
  constructor(bus) {
    this.bus = bus;
    this._el = document.getElementById('asset-list');
    this._selected = null;
    this._init();
  }

  _init() {
    const types = getAssetTypes();

    for (const t of types) {
      const item = document.createElement('div');
      item.className = 'asset-item';
      item.dataset.type = t.type;

      const thumb = document.createElement('canvas');
      thumb.width = 48;
      thumb.height = 48;
      const tCtx = thumb.getContext('2d');
      const tex = t.cls.getThumbnail();
      tCtx.drawImage(tex, 0, 0, 48, 48);
      thumb.className = 'asset-thumb';

      const label = document.createElement('div');
      label.className = 'asset-label';
      label.textContent = t.name;

      const size = document.createElement('div');
      size.className = 'asset-size';
      size.textContent = `${t.widthM}x${t.heightM}m`;

      const info = document.createElement('div');
      info.className = 'asset-info';
      info.appendChild(label);
      info.appendChild(size);

      item.appendChild(thumb);
      item.appendChild(info);

      item.addEventListener('click', () => {
        if (this._selected) this._selected.classList.remove('selected');
        item.classList.add('selected');
        this._selected = item;
        this.bus.emit('asset:startPlace', t.type);
      });

      this._el.appendChild(item);
    }
  }

  clearSelection() {
    if (this._selected) {
      this._selected.classList.remove('selected');
      this._selected = null;
    }
  }
}
