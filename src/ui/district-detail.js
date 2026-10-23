import { formatCount } from '../formatters.js';
import { balanceSymbol, balanceWords } from './district-list.js';

export const DETAIL_PROMPT = "Pick a district's pen to edit it and see its status here.";

// The text of the selected district's detail, so tests and the page read the same words.
export function describeDistrict(district, balanceInfo, balance, matchup) {
  const state = balanceInfo?.balance ?? 'empty';
  const offset = balanceInfo?.offset ?? 0;
  let leader = 'Empty';
  if (district.status === 'sideA') leader = `${matchup.sideA.name} +${district.marginPercent.toFixed(1)}`;
  else if (district.status === 'sideB') leader = `${matchup.sideB.name} +${district.marginPercent.toFixed(1)}`;
  else if (district.status === 'tie') leader = 'Tied';
  let distance = '';
  if (state === 'over') distance = `${formatCount(offset)} over`;
  else if (state === 'under') distance = `${formatCount(-offset)} under`;
  else if (state === 'ok') distance = 'within range';
  const pieces = district.components.length;
  return {
    title: `District ${district.number}`,
    status: `${balanceSymbol(state)} ${balanceWords(state)}`,
    balance: state,
    distance,
    leader,
    voters: `${formatCount(district.totalVoters)} voters`,
    range: `${formatCount(balance.lower)} to ${formatCount(balance.upper)} voters`,
    precincts: String(district.precinctIds.length),
    connected: pieces <= 1 ? 'Yes' : `No, in ${pieces} pieces`,
  };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Fills the detail's body for the selected district, or with the prompt when none is selected. The editing line that shares the
// container is left alone.
export function renderDistrictDetail(container, { district, balanceInfo, balance, matchup }) {
  const body = container.querySelector('[data-role="district-detail-body"]') ?? container;
  if (!district) {
    body.replaceChildren(el('p', 'detail-prompt', DETAIL_PROMPT));
    return null;
  }
  const text = describeDistrict(district, balanceInfo, balance, matchup);
  const title = el('h3', 'detail-title', text.title);
  const status = el('span', 'detail-status', text.status);
  status.dataset.balance = text.balance;
  status.dataset.key = 'status';
  const distance = el('span', 'detail-distance', text.distance);
  distance.dataset.key = 'distance';
  title.append(status, distance);
  const rows = el('dl', 'detail-rows');
  const add = (key, label, value, wide = false) => {
    const dt = el('dt', '', label);
    const dd = el('dd', '', value);
    dd.dataset.key = key;
    if (wide) {
      dt.classList.add('wide');
      dd.classList.add('wide');
    }
    rows.append(dt, dd);
  };
  add('leader', 'Leading', text.leader);
  add('voters', 'Voters', text.voters);
  add('range', 'Allowed range', text.range, true);
  add('precincts', 'Precincts', text.precincts);
  add('connected', 'Connected', text.connected);
  body.replaceChildren(title, rows);
  return text;
}
