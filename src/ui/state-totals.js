import { formatStatewideMakeup } from '../formatters.js';

const HEADING_ID = 'state-totals-heading';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// The whole state's voters: every precinct counts, so districts never change this block.
export function renderStateTotals(container, state, matchup) {
  const makeup = formatStatewideMakeup(state.precincts, matchup);

  const heading = el('h2', '', 'Statewide voters');
  heading.id = HEADING_ID;

  const total = el('p', 'totals-total', 'Total voters: ');
  const totalNumber = el('span', '', makeup.totalVoters);
  totalNumber.dataset.key = 'total';
  total.append(totalNumber);

  const summary = el('p', 'totals-summary', makeup.summary);
  summary.dataset.status = makeup.status;

  const bar = el('div', 'makeup-bar');
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', makeup.ariaLabel);
  const rows = el('dl', 'totals-rows');
  for (const side of makeup.sides) {
    const segment = el('span', 'makeup-segment');
    segment.dataset.side = side.key;
    segment.style.width = `${side.share}%`;
    segment.style.background = side.color;
    bar.append(segment);

    const group = el('div', 'totals-side');
    group.dataset.side = side.key;
    const term = el('dt');
    const swatch = el('span', 'swatch');
    swatch.style.background = side.color;
    swatch.setAttribute('aria-hidden', 'true');
    term.append(swatch, el('span', 'totals-name', side.name));
    const percent = el('dd', 'totals-percent', side.percent);
    percent.dataset.key = `${side.key}Percent`;
    const voters = el('dd', 'totals-voters', `${side.voters} voters`);
    voters.dataset.key = `${side.key}Voters`;
    group.append(term, percent, voters);
    rows.append(group);
  }

  container.replaceChildren(heading, total, summary, bar, rows);
}
