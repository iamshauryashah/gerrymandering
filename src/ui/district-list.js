import { formatCount, getResultColor } from '../formatters.js';

const PEN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm17.71-10.21a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';

function statusLabel(district, matchup) {
  if (district.status === 'sideA') return `${matchup.sideA.name} +${district.marginPercent.toFixed(1)}`;
  if (district.status === 'sideB') return `${matchup.sideB.name} +${district.marginPercent.toFixed(1)}`;
  if (district.status === 'tie') return 'Tied';
  return 'Empty';
}

const SYMBOLS = { empty: '○', under: '▼', ok: '●', over: '▲' };
const WORDS = { empty: 'Empty', under: 'Too small', ok: 'Within range', over: 'Too large' };
export const balanceSymbol = (balance) => SYMBOLS[balance] ?? SYMBOLS.empty;
export const balanceWords = (balance) => WORDS[balance] ?? WORDS.empty;

// A district's leader in a few characters, for the small tiles.
function shortLabel(district, matchup) {
  if (district.status === 'sideA') return `${matchup.sideA.shortName} +${district.marginPercent.toFixed(1)}`;
  if (district.status === 'sideB') return `${matchup.sideB.shortName} +${district.marginPercent.toFixed(1)}`;
  if (district.status === 'tie') return 'Tied';
  return 'Empty';
}

export function balanceLabel(info) {
  if (info.balance === 'empty') return 'Empty';
  if (info.balance === 'over') return `Too large +${formatCount(info.offset)}`;
  if (info.balance === 'under') return `Too small −${formatCount(-info.offset)}`;
  return 'Within range';
}

export function createDistrictList(list, { onPenToggle, onDistrictEnter, onDistrictMove, onDistrictLeave } = {}) {
  let rows = [];

  function rowNumber(event) {
    const row = event.target.closest?.('.district-row');
    return row && list.contains(row) ? Number(row.dataset.district) : null;
  }

  list.addEventListener('click', (event) => {
    const pen = event.target.closest?.('.pen');
    if (pen && list.contains(pen)) onPenToggle?.(Number(pen.dataset.district));
  });
  list.addEventListener('pointerover', (event) => {
    const n = rowNumber(event);
    const from = event.relatedTarget?.closest?.('.district-row');
    if (n && (!from || Number(from.dataset.district) !== n)) onDistrictEnter?.(n, { x: event.clientX, y: event.clientY });
  });
  list.addEventListener('pointermove', (event) => {
    const n = rowNumber(event);
    if (n) onDistrictMove?.(n, { x: event.clientX, y: event.clientY });
  });
  list.addEventListener('pointerout', (event) => {
    const n = rowNumber(event);
    const to = event.relatedTarget?.closest?.('.district-row');
    if (n && (!to || Number(to.dataset.district) !== n)) {
      onDistrictLeave?.(n);
    }
  });
  list.addEventListener('focusin', (event) => {
    const n = rowNumber(event);
    const row = event.target.closest('.district-row');
    if (n) onDistrictEnter?.(n, row);
  });
  list.addEventListener('focusout', (event) => {
    const n = rowNumber(event);
    const to = event.relatedTarget?.closest?.('.district-row');
    if (n && (!to || Number(to.dataset.district) !== n)) onDistrictLeave?.(n);
  });

  function build(count) {
    rows = Array.from({ length: count }, (_, i) => {
      const number = i + 1;
      const row = document.createElement('li');
      row.className = 'district-row';
      row.dataset.district = String(number);
      row.tabIndex = 0;
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'district-name';
      name.textContent = `District ${number}`;
      const status = document.createElement('span');
      status.className = 'district-status';
      const leader = document.createElement('span');
      leader.className = 'district-leader';
      leader.append(swatch, status);
      const balance = document.createElement('span');
      balance.className = 'district-balance';
      const amount = document.createElement('span');
      amount.className = 'district-amount';
      const pen = document.createElement('button');
      pen.type = 'button';
      pen.className = 'pen';
      pen.dataset.district = String(number);
      pen.setAttribute('aria-label', `Edit district ${number}`);
      pen.setAttribute('aria-pressed', 'false');
      pen.title = `Edit district ${number}`;
      pen.innerHTML = PEN_ICON;
      row.append(leader, balance, amount, pen, name);
      return { row, swatch, status, balance, amount, pen };
    });
    list.replaceChildren(...rows.map((r) => r.row));
  }

  return {
    render(districts, matchup, editingDistrict = null, balanceInfo = null) {
      if (rows.length !== districts.length) build(districts.length);
      districts.forEach((district, i) => {
        const { row, swatch, status, balance, amount, pen } = rows[i];
        const info = balanceInfo?.districts[i];
        balance.hidden = !info;
        balance.dataset.balance = info?.balance ?? '';
        balance.textContent = info ? `${balanceSymbol(info.balance)} ${balanceWords(info.balance)}` : '';
        amount.textContent = info?.offset ? (info.offset > 0 ? `+${formatCount(info.offset)}` : `−${formatCount(-info.offset)}`) : '';
        const color = getResultColor(district.status, district.marginPercent, matchup);
        swatch.classList.toggle('empty', color === 'empty');
        swatch.style.background = color === 'empty' ? '' : color;
        swatch.textContent = String(district.number);
        status.textContent = shortLabel(district, matchup);
        const selected = district.number === editingDistrict;
        row.classList.toggle('selected', selected);
        row.dataset.status = district.status;
        const balanceText = info && info.balance !== 'empty' ? `, ${balanceLabel(info)}` : '';
        row.setAttribute('aria-label', `District ${district.number}: ${statusLabel(district, matchup)}, ${district.precinctIds.length} precincts${balanceText}`);
        pen.setAttribute('aria-pressed', String(selected));
      });
    },
    getRow(number) {
      return rows[number - 1]?.row ?? null;
    },
    getPen(number) {
      return rows[number - 1]?.pen ?? null;
    },
  };
}
