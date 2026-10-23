import { TIE_COLOR } from '../matchups.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function renderLegend(container, matchup) {
  const heading = el('h2', '', 'Legend');
  const rows = el('dl', 'legend-rows');
  for (const side of [matchup.sideA, matchup.sideB]) {
    const dt = el('dt');
    const shades = el('span', 'legend-shades');
    shades.setAttribute('aria-hidden', 'true');
    for (const shade of side.shades) {
      const chip = el('span');
      chip.style.background = shade;
      shades.append(chip);
    }
    dt.append(shades, el('span', '', `${side.name} lead`));
    rows.append(dt);
  }
  const tie = el('dt');
  const tieSwatch = el('span', 'swatch');
  tieSwatch.style.background = TIE_COLOR;
  tie.append(tieSwatch, el('span', '', 'Tie'));
  rows.append(tie);
  const empty = el('dt');
  empty.append(el('span', 'swatch empty'), el('span', '', 'Empty district'));
  rows.append(empty);
  const note = el('p', 'legend-note', 'Darker shades mean a bigger lead. Districts are shaded by their overall result. Hover a district (or its row) to see its precincts\' own colors. Precincts without a district show their own color with dots.');
  container.replaceChildren(heading, rows, note);
}
