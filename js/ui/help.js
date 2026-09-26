import { h, icon } from './dom.js';

let open = null;
const close = () => { open?.remove(); open = null; };
document.addEventListener('pointerdown', close, true);

// A "?" that shows a popover on hover or focus. The popover lives on <body> so scrolling bars can't clip it.
export function helpTip(title, ...content) {
  const pop = h('div', { class: 'help-pop', role: 'tooltip' }, h('div', { class: 'help-title' }, title), ...content);
  const el = h('span', { class: 'help', tabIndex: 0, 'aria-label': title }, icon('circle-help'));
  const show = () => {
    close();
    const r = el.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(r.left - 12, window.innerWidth - 340))}px`;
    pop.style.top = `${r.bottom + 8}px`;
    document.body.append(pop);
    open = pop;
  };
  el.addEventListener('mouseenter', show);
  el.addEventListener('focus', show);
  el.addEventListener('mouseleave', close);
  el.addEventListener('blur', close);
  return el;
}

export function alignHelp() {
  return helpTip('Aligning a screenshot',
    h('ol', null,
      h('li', null, 'Click a spot on the screenshot that you can also find on your pieces — a floor corner, a wall end or a pole.'),
      h('li', null, 'Click that same spot on the pieces. It snaps to piece corners and snap points, then grid points; hold Alt to click freely.'),
      h('li', null, 'Do the same for a second spot, as far from the first as you can. Scale, rotation and position now match the 1 m grid.')),
    h('p', null, 'Spread the pins out: pins close together drift at the edges of the image. Add one pin more than the fit needs (a 3rd, or a 5th with Perspective) and the bar shows how far off it is; each pin is coloured green, amber or red by its own error.'),
    h('p', null, 'Things higher or lower than your pins (roofs, treetops) shift towards the edges of an in-game screenshot — pin spots at the height you care about. While aligning, the screenshot shows over your pieces; lower the opacity to see both. Drag a pin to fine-tune, right-click to remove it. Only angled screenshots need Perspective.'));
}
