import { TIE_COLOR } from '../matchups.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function summarizeControl(total, matchup) {
  const count = total.sideA + total.sideB + total.tied + total.empty;
  if (total.sideA > total.sideB) return `${matchup.sideA.name} control ${total.sideA} of ${count} districts`;
  if (total.sideB > total.sideA) return `${matchup.sideB.name} control ${total.sideB} of ${count} districts`;
  return `${matchup.sideA.name} and ${matchup.sideB.name} split ${count} districts evenly`;
}

export function renderControlTotal(container, total, matchup) {
  const heading = el('h2', '', 'District control');
  const summary = el('p', 'control-summary', summarizeControl(total, matchup));
  const rows = el('dl', 'control-rows');
  const add = (key, label, value, color) => {
    const dt = el('dt');
    const swatch = el('span', color === 'empty' ? 'swatch empty' : 'swatch');
    if (color !== 'empty') swatch.style.background = color;
    swatch.setAttribute('aria-hidden', 'true');
    dt.append(swatch, el('span', 'control-label', label));
    const dd = el('dd', 'control-count', String(value));
    dd.dataset.key = key;
    rows.append(dt, dd);
  };
  add('sideA', matchup.sideA.name, total.sideA, matchup.sideA.shades[3]);
  add('sideB', matchup.sideB.name, total.sideB, matchup.sideB.shades[3]);
  add('tied', 'Tied', total.tied, TIE_COLOR);
  add('empty', 'Empty', total.empty, 'empty');
  if (total.unassigned !== undefined) add('unassigned', 'Unassigned precincts', total.unassigned, 'empty');
  container.replaceChildren(heading, summary, rows);
}
