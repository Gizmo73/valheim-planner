// h('button', { class, onClick, title }, ...children) — tiny element builder.
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style') Object.assign(el.style, v);
    else if (k in el && typeof el[k] !== 'function') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

// Lucide icon as an inline SVG ('rotate-cw' -> lucide.icons.RotateCw).
export function icon(name) {
  const lucide = window.lucide;
  const key = name.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
  const node = lucide?.icons?.[key];
  if (!node) return h('span', { class: 'lucide' });
  const svg = lucide.createElement(node);
  svg.classList.add('lucide');
  return svg;
}

export function button(iconName, label, onClick, props = {}) {
  return h('button', { type: 'button', onClick, ...props }, iconName && icon(iconName), label && h('span', null, label));
}

export function field(label, ...control) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), ...control);
}

export function toggle(checked, onChange) {
  return h('input', { type: 'checkbox', class: 'switch', checked, onChange: e => onChange(e.target.checked) });
}

export function slider(min, max, step, value, onInput) {
  return h('input', { type: 'range', min, max, step, value, onInput: e => onInput(parseFloat(e.target.value)) });
}

export function pickFiles({ accept = '', multiple = false, directory = false } = {}) {
  return new Promise(resolve => {
    const input = h('input', { type: 'file', accept, multiple, style: { display: 'none' } });
    if (directory) input.webkitdirectory = true;
    input.addEventListener('change', () => {
      resolve([...input.files]);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Modals are what blocks keyboard shortcuts (see keysBlocked in ToolManager).
export function openModal(content, { onClose, className = '' } = {}) {
  const box = h('div', { class: `modal ${className}` }, content);
  const backdrop = h('div', { class: 'modal-backdrop' }, box);
  backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) close(); });
  const onKey = e => {
    if (e.key !== 'Escape' || document.activeElement?.tagName === 'TEXTAREA') return;
    e.stopPropagation(); // don't let the same Esc reach the active tool
    close();
  };
  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);
  function close() {
    if (!backdrop.isConnected) return;
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    onClose?.();
  }
  return { el: box, close };
}

let toastTimer = null;
export function toast(message, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, kind === 'error' ? 6000 : 2600);
}
