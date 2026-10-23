import { formatCount } from '../formatters.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const percent = (value) => `${Math.round(value * 10) / 10}%`;

export function describePlan(status) {
  if (status.valid) return 'Valid plan';
  const missing = [];
  if (!status.complete) missing.push(`${status.unassigned} ${status.unassigned === 1 ? 'precinct has' : 'precincts have'} no district`);
  if (!status.contiguous) missing.push('a district is in pieces');
  if (status.balance.empty) missing.push(`${status.balance.empty} ${status.balance.empty === 1 ? 'district is' : 'districts are'} empty`);
  else if (!status.balanced) missing.push('districts are not balanced');
  return `Not valid yet: ${missing.join('; ')}`;
}

export function renderPlanStatus(container, status) {
  const { balance } = status;
  const heading = el('h2', '', 'Plan check');
  const overall = el('p', 'plan-overall', describePlan(status));
  overall.dataset.valid = String(status.valid);

  const balanceLine = el('p', 'balance-result');
  balanceLine.dataset.pass = String(balance.pass);
  balanceLine.textContent = balance.pass
    ? `Balance: pass (district sizes within ${percent(balance.ratio * 100)} of each other)`
    : `Balance: fail (district sizes must be within ${percent(balance.ratio * 100)} of each other)`;

  const rows = el('dl', 'plan-rows');
  const add = (key, label, value) => {
    const dd = el('dd', '', value);
    dd.dataset.key = key;
    rows.append(el('dt', '', label), dd);
  };
  const hasFilled = balance.empty < status.balance.districts.length;
  add('ideal', 'Ideal district size', formatCount(balance.ideal));
  add('largest', 'Largest district', hasFilled ? formatCount(balance.largest) : '—');
  add('smallest', 'Smallest district', hasFilled ? formatCount(balance.smallest) : '—');
  add('difference', 'Difference', hasFilled ? `${formatCount(balance.difference)} voters (${percent(balance.differencePercent)})` : '—');
  add('limit', 'Allowed difference', percent(balance.ratio * 100));
  add('unassigned', 'Precincts with no district', String(status.unassigned));
  container.replaceChildren(heading, overall, balanceLine, rows);
}
