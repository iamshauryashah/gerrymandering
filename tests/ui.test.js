import { test, assert, assertEqual } from './test-runner.js';
import { createApp } from '../src/main.js';
import { MATCHUPS } from '../src/matchups.js';
import { getControlTotal, getPlanStatus } from '../src/districts.js';
import { precinctsInCapsule } from '../src/brush.js';
import { getResultColor, getResult, formatCount, formatStatewideMakeup } from '../src/formatters.js';
import { renderStateTotals } from '../src/ui/state-totals.js';
import { MAX_CITIES, MIN_CITY_DISTANCE, addCity, checkCityPlacement, createPlan, encodeCustomCode } from '../src/custom-state.js';
import { generateState, buildCustomState } from './fixtures.js';

let markup = null;

async function mount(seed = 'demo-1', options = {}) {
  if (!markup) {
    const html = await (await fetch('../index.html')).text();
    markup = new DOMParser().parseFromString(html, 'text/html').querySelector('[data-role="app"]').outerHTML;
  }
  const fixture = document.getElementById('fixture');
  fixture.innerHTML = markup;
  const root = fixture.firstElementChild;
  const originalUrl = window.location.href;
  // Generating and building states is the slow part, so the app reuses the states other tests already made.
  // Outlines are fixed too: random outline seeds made some builder tests slow or fail on hard outlines.
  const app = createApp(root, { seed, makeState: generateState, buildState: buildCustomState, makeOutlineSeed: () => 'big0', ...options });
  return {
    root,
    app,
    cleanup: () => {
      app.destroy();
      fixture.innerHTML = '';
      // Some features write the address; no test may leave it changed for the next one.
      window.history.replaceState(null, '', originalUrl);
    },
  };
}

const loadPlan = (app) => app.setAssignments(app.state.referencePlan);
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

// Precincts in breadth-first order from a start precinct, so each one touches an earlier one.
function connectedOrder(state, startId, count) {
  const order = [startId];
  for (let i = 0; i < order.length && order.length < count; i += 1) {
    for (const n of state.precinctsById.get(order[i]).neighbors) {
      if (!order.includes(n) && order.length < count) order.push(n);
    }
  }
  return order;
}

const q = (root, role) => root.querySelector(`[data-role="${role}"]`);
const key = (target, k) => target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
const pointer = (target, type, x = 100, y = 100) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y }));
const focusEl = (el) => {
  el.focus();
  if (!document.hasFocus()) el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
};
const blurEl = (el) => {
  el.blur();
  if (!document.hasFocus()) el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
};
const rgb = (hex) => {
  const probe = document.createElement('span');
  probe.style.color = hex;
  return probe.style.color;
};

test('page shell has heading, toggle above map, district list beside it, and notice', async () => {
  const { root, cleanup } = await mount();
  assertEqual(root.querySelector('h1').textContent, 'Gerrymandering like Gerry the Salamander');
  const toggle = q(root, 'matchup-toggle');
  const map = q(root, 'map');
  const list = q(root, 'district-list');
  assertEqual(toggle.textContent, 'Democrats vs Republicans');
  assert(toggle.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING, 'toggle before map');
  // The district list sits in the panels column next to the map (before it in the page, so keyboard focus meets it first).
  assert(q(root, 'panels').contains(list), 'the list is in the panels column');
  assert(list.getBoundingClientRect().left >= map.getBoundingClientRect().right - 1, 'the list is to the right of the map');
  assert(/fictional/i.test(q(root, 'notice').textContent), 'fictional notice');
  cleanup();
});

const ownColor = (precinct, matchup = MATCHUPS[0]) => {
  const r = getResult(precinct.sideAVoters, precinct.sideBVoters);
  return getResultColor(r.status, r.marginPercent, matchup);
};
const districtColor = (district, matchup = MATCHUPS[0]) => getResultColor(district.status, district.marginPercent, matchup);
const hover = (target, type, related = null, pointerType = 'mouse') => target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: 100, clientY: 100, relatedTarget: related, pointerType }));
const precinctsOf = (app, number) => app.state.precincts.filter((c) => app.state.assignments[c.id] === number);

// Every precinct shows its district's color unless the district is revealed; unassigned precincts show their own.
function assertPainted(app, matchup = MATCHUPS[0], label = '') {
  const revealed = app.mapView.getRevealed();
  for (const precinct of app.state.precincts) {
    const path = app.mapView.getPrecinctElement(precinct.id);
    const number = app.state.assignments[precinct.id];
    assertEqual(path.dataset.ownFill, ownColor(precinct, matchup), `${label} own fill ${precinct.id}`);
    if (number && number !== revealed) {
      const color = districtColor(app.state.districts[number - 1], matchup);
      assertEqual(path.getAttribute('fill'), color, `${label} ${precinct.id} solid district ${number}`);
      assertEqual(path.style.stroke, rgb(color), `${label} ${precinct.id} seamless stroke`);
      assertEqual(path.dataset.revealed, 'false');
    } else {
      assertEqual(path.getAttribute('fill'), path.dataset.ownFill, `${label} ${precinct.id} own color`);
      assertEqual(path.style.stroke, '', `${label} ${precinct.id} default stroke`);
    }
  }
}

test('precincts in a district are painted the district badge and swatch color, with no seams (SC-001)', async () => {
  const { root, app, cleanup } = await mount();
  assertPainted(app, MATCHUPS[0], 'empty plan');
  loadPlan(app);
  assertPainted(app, MATCHUPS[0], 'reference plan');
  for (const district of app.state.districts) {
    const badge = root.querySelector(`.badge[data-district="${district.number}"] circle`).getAttribute('fill');
    const swatch = app.districtList.getRow(district.number).querySelector('.swatch').style.background;
    for (const precinct of precinctsOf(app, district.number)) {
      const fill = app.mapView.getPrecinctElement(precinct.id).getAttribute('fill');
      assertEqual(fill, badge, `district ${district.number} precinct matches badge`);
      assertEqual(rgb(fill), swatch, `district ${district.number} precinct matches swatch`);
    }
  }
  cleanup();
});

test('a district with mixed precinct results is one combined-result color (SC-002)', async () => {
  const { app, cleanup } = await mount();
  loadPlan(app);
  const mixed = app.state.districts.find((d) => new Set(precinctsOf(app, d.number).map((c) => ownColor(c))).size > 1);
  assert(mixed, 'some district mixes precinct colors');
  const fills = new Set(precinctsOf(app, mixed.number).map((c) => app.mapView.getPrecinctElement(c.id).getAttribute('fill')));
  assertEqual([...fills], [districtColor(mixed)], 'one combined color');
  cleanup();
});

test('unassigned precincts keep their own color and the no-district dots (FR-003)', async () => {
  const { root, app, cleanup } = await mount();
  loadPlan(app);
  const precinct = app.state.precincts[0];
  app.assignPrecinct(precinct.id, null);
  const path = app.mapView.getPrecinctElement(precinct.id);
  assertEqual(path.getAttribute('fill'), ownColor(precinct), 'own color');
  assert(path.classList.contains('unassigned'), 'marked unassigned');
  assert(q(root, 'unassigned').getAttribute('d').length > 10, 'dot overlay drawn');
  cleanup();
});

test('district colors update on add, move, remove, and matchup changes (SC-003, SC-004, FR-006)', async () => {
  const { root, app, cleanup } = await mount();
  const [first, second] = connectedOrder(app.state, app.state.precincts[0].id, 2);
  app.setEditing(1);
  app.editPrecinct(first);
  app.editPrecinct(second);
  assertPainted(app, MATCHUPS[0], 'after adds');
  app.setEditing(2);
  app.editPrecinct(second);
  assertEqual(app.state.assignments[second], 2, 'moved');
  assertPainted(app, MATCHUPS[0], 'after move');
  app.editPrecinct(second);
  assertEqual(app.state.assignments[second], null, 'removed');
  assertPainted(app, MATCHUPS[0], 'after remove');
  app.setEditing(null);
  loadPlan(app);
  const before = { ...app.state.assignments };
  click(q(root, 'matchup-toggle'));
  assertEqual(app.matchup, MATCHUPS[1]);
  assertPainted(app, MATCHUPS[1], 'after matchup toggle');
  for (const district of app.state.districts) {
    const badge = root.querySelector(`.badge[data-district="${district.number}"] circle`).getAttribute('fill');
    assertEqual(app.mapView.getPrecinctElement(precinctsOf(app, district.number)[0].id).getAttribute('fill'), badge, 'fill equals new badge color');
  }
  assertEqual(app.state.assignments, before, 'assignments unchanged');
  cleanup();
});

test('hovering or focusing a district reveals exactly its precincts without flicker (SC-005, FR-007, FR-008)', async () => {
  const { root, app, cleanup } = await mount();
  loadPlan(app);
  const district = app.state.districts.find((d) => d.precinctIds.length >= 2);
  const [a, b] = precinctsOf(app, district.number).filter((c) => c.neighbors.some((n) => app.state.assignments[n] === district.number));
  const pathA = app.mapView.getPrecinctElement(a.id);
  const pathB = app.mapView.getPrecinctElement(b.id);
  const assertRevealed = (number, label) => {
    assertEqual(app.mapView.getRevealed(), number, `${label} revealed district`);
    for (const precinct of app.state.precincts) {
      const path = app.mapView.getPrecinctElement(precinct.id);
      const inside = number !== null && app.state.assignments[precinct.id] === number;
      assertEqual(path.dataset.revealed, String(inside), `${label} ${precinct.id} revealed flag`);
    }
    assertPainted(app, MATCHUPS[0], label);
  };

  let t0 = performance.now();
  hover(pathA, 'pointerover');
  const elapsed = performance.now() - t0;
  assert(elapsed < 200, `reveal took ${elapsed} ms`);
  assertRevealed(district.number, 'hover');
  for (const precinct of precinctsOf(app, district.number)) {
    assertEqual(app.mapView.getPrecinctElement(precinct.id).getAttribute('fill'), ownColor(precinct), 'revealed precinct shows own color');
  }
  const tip = q(root, 'tooltip').textContent;
  assert(tip.includes(a.name) && tip.includes(`District ${district.number}`), 'tooltip shows precinct and district');

  hover(pathA, 'pointerout', pathB);
  assertEqual(app.mapView.getRevealed(), district.number, 'still revealed while moving inside the district');
  hover(pathB, 'pointerover', pathA);
  assertRevealed(district.number, 'moved within district');
  hover(pathB, 'pointerout', q(root, 'map'));
  assertRevealed(null, 'left the map');

  const other = app.state.districts.find((d) => d.number !== district.number && d.precinctIds.length);
  hover(pathA, 'pointerover');
  const otherPath = app.mapView.getPrecinctElement(other.precinctIds[0]);
  hover(pathA, 'pointerout', otherPath);
  hover(otherPath, 'pointerover', pathA);
  assertRevealed(other.number, 'moved to another district');
  hover(otherPath, 'pointerout', null);
  assertRevealed(null, 'left');

  focusEl(pathA);
  assertRevealed(district.number, 'focus');
  blurEl(pathA);
  assertRevealed(null, 'blur');

  const row = app.districtList.getRow(district.number);
  t0 = performance.now();
  hover(row, 'pointerover');
  assert(performance.now() - t0 < 200, 'row reveal is fast');
  assertRevealed(district.number, 'row hover');
  hover(row, 'pointerout', document.body);
  assertRevealed(null, 'row leave');
  focusEl(row);
  assertRevealed(district.number, 'row focus');
  blurEl(row);
  assertRevealed(null, 'row blur');

  app.assignPrecinct(a.id, null);
  const lone = app.mapView.getPrecinctElement(a.id);
  hover(lone, 'pointerover');
  assertRevealed(null, 'unassigned precinct reveals nothing');
  hover(lone, 'pointerout', null);
  cleanup();
});

test('touch taps reveal a district until the next tap; editing and new maps clear the reveal', async () => {
  const { root, app, cleanup } = await mount();
  loadPlan(app);
  const district = app.state.districts[0];
  const path = app.mapView.getPrecinctElement(district.precinctIds[0]);
  const tap = (target) => {
    hover(target, 'pointerover', null, 'touch');
    hover(target, 'pointerdown', null, 'touch');
    hover(target, 'pointerup', null, 'touch');
    target.dispatchEvent(new PointerEvent('click', { bubbles: true, pointerType: 'touch' }));
    hover(target, 'pointerout', null, 'touch');
  };
  tap(path);
  assertEqual(app.mapView.getRevealed(), district.number, 'tap reveals');
  assertEqual(app.mapView.getPrecinctElement(district.precinctIds[0]).dataset.revealed, 'true');
  const other = app.state.districts[1];
  tap(app.mapView.getPrecinctElement(other.precinctIds[0]));
  assertEqual(app.mapView.getRevealed(), other.number, 'tapping another district switches');
  tap(q(root, 'map'));
  assertEqual(app.mapView.getRevealed(), null, 'tap outside clears');

  hover(path, 'pointerover');
  assertEqual(app.mapView.getRevealed(), district.number);
  app.setEditing(3);
  assertEqual(app.mapView.getRevealed(), district.number, 'the district under the pointer stays revealed while editing');
  hover(path, 'pointerout', null);
  assertEqual(app.mapView.getRevealed(), null, 'leaving clears');
  app.setEditing(null);
  app.mapView.setRevealed(2, { sticky: true });
  app.setEditing(3);
  assertEqual(app.mapView.getRevealed(), null, 'start editing clears a sticky reveal');
  assertPainted(app, MATCHUPS[0], 'editing');
  app.mapView.setRevealed(2);
  app.setEditing(null);
  assertEqual(app.mapView.getRevealed(), null, 'stop editing clears');
  app.mapView.setRevealed(2);
  app.load('another-map');
  assertEqual(app.mapView.getRevealed(), null, 'load clears');
  cleanup();
});

test('legend explains solid districts and the hover reveal (FR-009)', async () => {
  const { root, cleanup } = await mount();
  const note = root.querySelector('.legend-note').textContent;
  assert(note.includes('Districts are shaded by their overall result'), note);
  assert(note.includes("Hover a district (or its row) to see its precincts' own colors"), note);
  assert(note.includes('Precincts without a district show their own color with dots'), note);
  cleanup();
});

test('map shows district borders and a colored number badge per district', async () => {
  const { root, app, cleanup } = await mount();
  assertEqual(root.querySelectorAll('.badge').length, 0, 'no badges while districts are empty');
  assertEqual(q(root, 'district-borders').getAttribute('d'), '', 'no borders while districts are empty');
  loadPlan(app);
  assert(q(root, 'district-borders').getAttribute('d').length > 20, 'district borders drawn');
  const badges = [...root.querySelectorAll('.badge')];
  assertEqual(badges.map((b) => b.textContent).sort((a, b) => a - b), app.state.districts.map((d) => String(d.number)));
  for (const badge of badges) {
    const district = app.state.districts[Number(badge.dataset.district) - 1];
    assertEqual(badge.querySelector('circle').getAttribute('fill'), getResultColor(district.status, district.marginPercent, MATCHUPS[0]));
  }
  cleanup();
});

test('district list renders every district in order with swatch, status, and pen', async () => {
  const { root, app, cleanup } = await mount();
  for (const row of root.querySelectorAll('.district-row')) {
    assertEqual(row.querySelector('.district-status').textContent, 'Empty', 'starts empty');
    assertEqual(row.querySelector('.district-balance').textContent, '○ Empty', 'balance label empty');
  }
  loadPlan(app);
  const rows = [...root.querySelectorAll('.district-row')];
  assertEqual(rows.length, app.state.districtCount);
  rows.forEach((row, i) => {
    const district = app.state.districts[i];
    assertEqual(row.querySelector('.district-name').textContent, `District ${i + 1}`);
    assertEqual(row.querySelector('.swatch').style.background, rgb(getResultColor(district.status, district.marginPercent, MATCHUPS[0])));
    const side = district.status === 'sideA' ? 'Dem' : district.status === 'sideB' ? 'Rep' : 'Tied';
    assert(row.querySelector('.district-status').textContent.startsWith(side), 'leading side text');
    const pen = row.querySelector('button.pen');
    assertEqual(pen.getAttribute('aria-label'), `Edit district ${i + 1}`);
    assertEqual(pen.getAttribute('aria-pressed'), 'false');
    assertEqual(row.querySelector('.district-balance').textContent, '● Within range', 'reference plan balanced');
  });
  cleanup();
});

// --- Single-screen editing (011): the district detail and the tiles ---------------------------------------------------

// A plan where district 1 has also taken all of district 2 (too large, empty district 2, maybe in two pieces) and district 3
// holds a single precinct (too small).
function lopsidedPlan(app) {
  const plan = { ...app.state.referencePlan };
  let kept = false;
  for (const id of Object.keys(plan)) {
    if (plan[id] === 2) plan[id] = 1;
    else if (plan[id] === 3) {
      if (kept) plan[id] = null;
      kept = true;
    }
  }
  return plan;
}

test('the selected district\'s detail shows its status, range, distance, precincts, and connection, and follows every edit (011 FR-011, FR-013, FR-014)', async () => {
  const { root, app, cleanup } = await mount();
  const detail = q(root, 'district-detail');
  const key = (name) => detail.querySelector(`[data-key="${name}"]`)?.textContent;
  assert(detail.textContent.includes("Pick a district's pen to edit it and see its status here."), 'a prompt before any district is picked');
  loadPlan(app);
  app.setEditing(1);
  let plan = getPlanStatus(app.state);
  const first = app.state.districts[0];
  assertEqual(detail.querySelector('h3').textContent.startsWith('District 1'), true, 'the heading names the district');
  assertEqual(key('status'), '● Within range');
  assertEqual(key('distance'), 'within range');
  assertEqual(key('range'), `${formatCount(plan.balance.lower)} to ${formatCount(plan.balance.upper)} voters`, 'the allowed range');
  assertEqual(key('voters'), `${formatCount(first.totalVoters)} voters`);
  assertEqual(key('precincts'), String(first.precinctIds.length));
  assertEqual(key('connected'), 'Yes');
  assert(/Democrats|Republicans/.test(key('leader')) && /\+\d/.test(key('leader')), `leader and margin: ${key('leader')}`);
  assert(detail.contains(q(root, 'editing-status')) && q(root, 'editing-status').textContent.startsWith('Editing District 1'), 'the editing line lives in the detail');

  // An edit changes the numbers at once.
  const leaving = first.precinctIds[first.precinctIds.length - 1];
  app.assignPrecinct(leaving, null);
  assertEqual(key('precincts'), String(first.precinctIds.length - 1), 'the precinct count follows the edit');
  assertEqual(key('voters'), `${formatCount(app.state.districts[0].totalVoters)} voters`, 'the voters follow the edit');

  // Too large, and an empty district beside it.
  app.setAssignments(lopsidedPlan(app));
  plan = getPlanStatus(app.state);
  const over = plan.balance.districts[0];
  assertEqual(over.balance, 'over');
  assertEqual(key('status'), '▲ Too large');
  assertEqual(key('distance'), `${formatCount(over.offset)} over`);
  app.setEditing(2);
  assertEqual(key('status'), '○ Empty');
  assertEqual(key('leader'), 'Empty');
  assertEqual(key('distance'), '');
  assertEqual(key('precincts'), '0');
  // Too small.
  app.setEditing(3);
  const under = getPlanStatus(app.state).balance.districts[2];
  assertEqual(under.balance, 'under');
  assertEqual(key('status'), '▼ Too small');
  assertEqual(key('distance'), `${formatCount(-under.offset)} under`);
  assertEqual(key('connected'), 'Yes');
  // A district in two pieces says so.
  const pieces = app.state.districts.find((d) => d.components.length > 1);
  if (pieces) {
    app.setEditing(pieces.number);
    assertEqual(key('connected'), `No, in ${pieces.components.length} pieces`);
  }
  // Escape stops editing and the prompt returns.
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert(detail.textContent.includes("Pick a district's pen to edit it and see its status here."), 'the prompt returns');
  assert(q(root, 'editing-status').hidden, 'the editing line is hidden again');
  cleanup();
});

test('the district detail, its picker tile, and the plan status agree (011 FR-011, FR-012)', async () => {
  const { root, app, cleanup } = await mount();
  loadPlan(app);
  app.setAssignments(lopsidedPlan(app));
  const plan = getPlanStatus(app.state);
  for (const number of [1, 2, 3, 4]) {
    app.setEditing(number);
    const detail = q(root, 'district-detail');
    const tile = app.districtList.getRow(number);
    assertEqual(detail.querySelector('[data-key="status"]').textContent, tile.querySelector('.district-balance').textContent, `district ${number} status`);
    const info = plan.balance.districts[number - 1];
    const amount = info.offset > 0 ? `+${formatCount(info.offset)}` : info.offset < 0 ? `−${formatCount(-info.offset)}` : '';
    assertEqual(tile.querySelector('.district-amount').textContent, amount, `district ${number} amount`);
  }
  assert(q(root, 'plan-status').textContent.includes(formatCount(plan.balance.largest)), 'the plan status shows the largest district');
  cleanup();
});

test('each picker tile shows its leader, a status in words and a symbol, and the amount over or under (011 FR-007, FR-008)', async () => {
  const { root, app, cleanup } = await mount();
  loadPlan(app);
  app.setAssignments(lopsidedPlan(app));
  const balance = getPlanStatus(app.state).balance;
  for (const info of balance.districts) {
    const tile = app.districtList.getRow(info.number);
    const words = { empty: '○ Empty', under: '▼ Too small', ok: '● Within range', over: '▲ Too large' }[info.balance];
    assertEqual(tile.querySelector('.district-balance').textContent, words, `district ${info.number} status in words`);
    const district = app.state.districts[info.number - 1];
    const leader = district.status === 'sideA' ? 'Dem' : district.status === 'sideB' ? 'Rep' : district.status === 'tie' ? 'Tied' : 'Empty';
    assert(tile.querySelector('.district-status').textContent.startsWith(leader), `district ${info.number} leader`);
    assertEqual(tile.querySelector('.swatch').textContent, String(info.number), 'the swatch carries the number');
  }
  const over = app.districtList.getRow(1);
  assertEqual(over.querySelector('.district-amount').textContent.startsWith('+'), true, 'an over amount has a plus');
  assertEqual(app.districtList.getRow(3).querySelector('.district-amount').textContent.startsWith('−'), true, 'an under amount has a minus');
  assertEqual(app.districtList.getRow(4).querySelector('.district-amount').textContent, '', 'no amount inside the range');
  click(q(root, 'matchup-toggle'));
  assert(/^Soc|^Lib|^Tied|^Empty/.test(app.districtList.getRow(4).querySelector('.district-status').textContent), 'the leader follows the matchup with its short name');
  // The pen picks a district, as before; the tile shows it is selected.
  const pen = app.districtList.getPen(4);
  click(pen);
  assertEqual(app.editingDistrict, 4);
  assert(app.districtList.getRow(4).classList.contains('selected') && pen.getAttribute('aria-pressed') === 'true', 'the tile is marked');
  // A tile's update follows an edit.
  const before = app.districtList.getRow(4).querySelector('.district-balance').textContent;
  app.assignPrecinct(app.state.districts[3].precinctIds[0], null);
  assert(app.districtList.getRow(4).querySelector('.district-status').textContent.length > 0 && before.length > 0, 'the tile still reads after an edit');
  cleanup();
});

test('district hover and focus show district details that match assigned precincts', async () => {
  const { root, app, cleanup } = await mount();
  const row = app.districtList.getRow(2);
  pointer(row, 'pointerover', 200, 300);
  assert(q(root, 'tooltip').textContent.includes('No precincts assigned'), 'empty district details');
  pointer(row, 'pointerout', 200, 300);
  loadPlan(app);
  pointer(row, 'pointerover', 200, 300);
  const tooltip = q(root, 'tooltip');
  assert(!tooltip.hidden, 'tooltip visible on hover');
  const district = app.state.districts[1];
  const text = tooltip.textContent;
  assert(text.includes('District 2'), 'number');
  assert(text.includes(`${district.precinctIds.length} ${district.precinctIds.length === 1 ? 'precinct' : 'precincts'}`), 'precinct count');
  const listedNames = [...district.precinctIds.map((id) => app.state.precinctsById.get(id).name)].sort((a, b) => a.localeCompare(b)).slice(0, 8);
  for (const name of listedNames) assert(text.includes(name), 'the first listed precinct names');
  if (district.precinctIds.length > 8) assert(text.includes(`and ${district.precinctIds.length - 8} more`), 'the rest are counted');
  assert(text.includes(district.totalVoters.toLocaleString('en-US')), 'total voters');
  assert(text.includes('Democrats') && text.includes('Republicans'), 'side names');
  assert(/Margin/.test(text), 'margin');
  pointer(row, 'pointerout', 200, 300);
  assert(tooltip.hidden, 'hidden on leave');
  focusEl(row);
  assert(!tooltip.hidden && tooltip.textContent.includes('District 2'), 'focus shows details');
  blurEl(row);
  assert(tooltip.hidden, 'hidden on blur');
  cleanup();
});

test('precinct hover shows precinct and district details; matchup relabels without changing numbers', async () => {
  const { root, app, cleanup } = await mount();
  const precinct = app.state.precincts[5];
  const path = app.mapView.getPrecinctElement(precinct.id);
  pointer(path, 'pointerover', 300, 300);
  const tooltip = q(root, 'tooltip');
  assert(tooltip.textContent.includes('No district'), 'unassigned precinct says no district');
  const typeLabel = { urban: 'Urban', suburban: 'Suburban', rural: 'Rural' }[precinct.type];
  assert(tooltip.textContent.includes(typeLabel) && tooltip.textContent.includes('voters/sq mi'), 'type and density');
  pointer(path, 'pointerout', 300, 300);
  loadPlan(app);
  pointer(path, 'pointerover', 300, 300);
  const before = tooltip.textContent;
  assert(before.includes(precinct.name), 'precinct name');
  assert(before.includes(`District ${app.state.assignments[precinct.id]}`), 'district details included');
  assert(before.includes(precinct.totalVoters.toLocaleString('en-US')), 'precinct voters');
  q(root, 'matchup-toggle').click();
  assertEqual(app.matchup.id, 'soc-lib');
  const after = tooltip.textContent;
  assert(after.includes('Socialists') && !after.includes('Democrats'), 'relabelled');
  const numbers = (s) => s.match(/[\d,]+(?:\.\d)?%?/g).join('|');
  assertEqual(numbers(after), numbers(before), 'numbers unchanged');
  pointer(path, 'pointerout', 300, 300);
  assert(tooltip.hidden, 'hidden after leave');
  cleanup();
});

test('tooltip stays inside the viewport near edges', async () => {
  const { root, app, cleanup } = await mount();
  const path = app.mapView.getPrecinctElement(app.state.precincts[0].id);
  for (const [x, y] of [[window.innerWidth - 2, window.innerHeight - 2], [1, 1], [window.innerWidth - 2, 1]]) {
    pointer(path, 'pointerout', x, y);
    pointer(path, 'pointerover', x, y);
    const box = q(root, 'tooltip').getBoundingClientRect();
    assert(box.left >= 0 && box.top >= 0, 'top-left inside');
    assert(box.right <= document.documentElement.clientWidth && box.bottom <= window.innerHeight, 'bottom-right inside');
  }
  cleanup();
});

test('pen buttons select, switch, toggle off, and Escape exits editing', async () => {
  const { root, app, cleanup } = await mount();
  loadPlan(app);
  const pen1 = app.districtList.getPen(1);
  const pen2 = app.districtList.getPen(2);
  pen1.click();
  assertEqual(app.editingDistrict, 1);
  assertEqual(pen1.getAttribute('aria-pressed'), 'true');
  assert(!q(root, 'editing-status').hidden && q(root, 'editing-status').textContent.startsWith('Editing District 1: click precincts to add or remove them.'), 'status message');
  assert(app.districtList.getRow(1).classList.contains('selected'), 'row selected');
  assert(q(root, 'selected-district').getAttribute('d').length > 0, 'map highlights selected district');
  pen2.click();
  assertEqual(app.editingDistrict, 2);
  assertEqual(root.querySelectorAll('.pen[aria-pressed="true"]').length, 1, 'only one pressed');
  pen2.click();
  assertEqual(app.editingDistrict, null, 'toggle off');
  assert(q(root, 'editing-status').hidden, 'status hidden');
  pen1.click();
  key(document.body, 'Escape');
  assertEqual(app.editingDistrict, null, 'Escape exits');
  assertEqual(root.querySelectorAll('.pen[aria-pressed="true"]').length, 0);
  cleanup();
});

test('Enter and Space assign precincts while editing; clicks do nothing when editing is off', async () => {
  const { app, cleanup } = await mount();
  const order = connectedOrder(app.state, app.state.precincts[0].id, 6);
  const before = { ...app.state.assignments };
  click(app.mapView.getPrecinctElement(order[0]));
  assertEqual(app.state.assignments, before, 'no change when editing is off');
  app.districtList.getPen(1).click();
  key(app.mapView.getPrecinctElement(order[0]), 'Enter');
  key(app.mapView.getPrecinctElement(order[1]), ' ');
  assertEqual(app.state.assignments[order[0]], 1, 'Enter assigns');
  assertEqual(app.state.assignments[order[1]], 1, 'Space assigns');
  for (const id of order.slice(2)) click(app.mapView.getPrecinctElement(id));
  for (const id of order) assertEqual(app.state.assignments[id], 1, 'rapid clicks each applied');
  assert(app.districtList.getRow(1).getAttribute('aria-label').includes(`${app.state.districts[0].precinctIds.length} precincts`), 'list updated');
  cleanup();
});

test('control total shows side names, counts, tied and empty, and updates', async () => {
  const { root, app, cleanup } = await mount();
  const control = q(root, 'control-total');
  const read = () => Object.fromEntries([...control.querySelectorAll('dd')].map((dd) => [dd.dataset.key, Number(dd.textContent)]));
  assertEqual(read(), getControlTotal(app.state.districts, app.state));
  assertEqual(read().unassigned, app.state.precincts.length, 'every precinct unassigned at start');
  assert(control.textContent.includes('Unassigned precincts'), 'unassigned row');
  assert(control.textContent.includes('Democrats') && control.textContent.includes('Republicans'), 'side names');
  assert(control.textContent.includes('Tied') && control.textContent.includes('Empty'), 'tied and empty');
  loadPlan(app);
  assertEqual([read().empty, read().unassigned], [0, 0], 'full plan');
  const removed = [...app.state.districts[0].precinctIds];
  for (const id of removed) app.assignPrecinct(id, null);
  assertEqual(read().empty, 1, 'empty district counted after removal');
  assertEqual(read().unassigned, removed.length, 'removed precincts counted as unassigned');
  assertEqual(read(), getControlTotal(app.state.districts, app.state));
  q(root, 'matchup-toggle').click();
  q(root, 'matchup-toggle').click();
  assert(control.textContent.includes('Purple') && control.textContent.includes('Orange'), 'matchup update');
  const swatch = control.querySelector('.swatch');
  assertEqual(swatch.style.background, rgb(MATCHUPS[2].sideA.shades[3]));
  q(root, 'matchup-toggle').click();
  assertEqual(q(root, 'matchup-toggle').textContent, 'Democrats vs Republicans', 'cycle wraps');
  cleanup();
});

test('control total is visible beside the map on wide screens and does not cover it', async () => {
  const { root, cleanup } = await mount();
  const fixture = document.getElementById('fixture');
  for (const width of [1200, 320]) {
    fixture.style.width = `${width}px`;
    const map = q(root, 'map-frame').getBoundingClientRect();
    const control = q(root, 'control-total').getBoundingClientRect();
    assert(control.width > 0 && control.height > 0, `control visible at ${width}`);
    const overlaps = !(control.right <= map.left || control.left >= map.right || control.bottom <= map.top || control.top >= map.bottom);
    assert(!overlaps, `control does not cover map at ${width}`);
    if (width === 1200) assert(control.left >= map.right - 1 || control.top >= map.bottom - 1, 'beside the map in its column, or below it');
    else assert(control.top >= map.bottom - 1, 'below map on narrow screens');
  }
  fixture.style.width = '';
  cleanup();
});

test('accessibility: names, pressed states, focus order, keyboard tooltips', async () => {
  const { root, app, cleanup } = await mount();
  const stops = app.state.precincts.filter((precinct) => app.mapView.getPrecinctElement(precinct.id).getAttribute('tabindex') === '0');
  assertEqual(stops.length, 1, 'exactly one precinct is a tab stop');
  for (const precinct of app.state.precincts) {
    const path = app.mapView.getPrecinctElement(precinct.id);
    assertEqual(path.getAttribute('aria-label'), `${precinct.name}, No district`);
  }
  const smallest = [...app.state.precincts].sort((a, b) => a.area - b.area)[0];
  const small = app.mapView.getPrecinctElement(smallest.id);
  focusEl(small);
  assertEqual(document.activeElement, small, 'smallest precinct focusable');
  assert(!q(root, 'tooltip').hidden && q(root, 'tooltip').textContent.includes(smallest.name), 'keyboard tooltip');
  app.setEditing(1);
  key(small, 'Enter');
  assertEqual(app.state.assignments[smallest.id], 1, 'smallest precinct assignable by keyboard');
  const focusables = [...root.querySelectorAll('button, [tabindex="0"]')].filter((el) => !el.closest('[hidden]'));
  const toggleIndex = focusables.indexOf(q(root, 'matchup-toggle'));
  const firstPrecinct = focusables.findIndex((el) => el.classList.contains('precinct'));
  const firstPen = focusables.findIndex((el) => el.classList.contains('pen'));
  assert(toggleIndex < firstPen && firstPen < firstPrecinct, 'toggle, then the district list, then the map');
  assertEqual(q(root, 'matchup-toggle').tagName, 'BUTTON');
  assertEqual(app.districtList.getPen(1).getAttribute('aria-pressed'), 'true');
  cleanup();
});

test('unassigned precincts are marked on the map and clicking a precinct in the selected district removes it', async () => {
  const { root, app, cleanup } = await mount();
  const overlay = q(root, 'unassigned');
  assertEqual(root.querySelectorAll('.precinct.unassigned').length, app.state.precincts.length, 'all marked');
  const fullOverlay = overlay.getAttribute('d').length;
  assert(fullOverlay > 0, 'overlay drawn');
  const id = app.state.precincts[0].id;
  const path = app.mapView.getPrecinctElement(id);
  app.setEditing(3);
  click(path);
  assertEqual(app.state.assignments[id], 3, 'added');
  assert(!path.classList.contains('unassigned'), 'no longer marked');
  assert(overlay.getAttribute('d').length < fullOverlay, 'overlay shrinks');
  assertEqual(path.getAttribute('aria-label'), `${app.state.precinctsById.get(id).name}, District 3`);
  assertEqual(root.querySelectorAll('.badge').length, 1, 'badge for the one non-empty district');
  click(path);
  assertEqual(app.state.assignments[id], null, 'clicking again removes it');
  assert(path.classList.contains('unassigned'), 'marked again');
  assertEqual(app.state.districts[2].status, 'empty', 'district empty again');
  assertEqual(root.querySelectorAll('.badge').length, 0, 'badge removed');
  cleanup();
});

test('blocked edits keep districts connected and explain why', async () => {
  const { root, app, cleanup } = await mount();
  const message = q(root, 'edit-message');
  const start = app.state.precincts[0];
  const far = app.state.precincts.find((c) => c.id !== start.id && !c.neighbors.includes(start.id));
  app.setEditing(1);
  click(app.mapView.getPrecinctElement(start.id));
  click(app.mapView.getPrecinctElement(far.id));
  assertEqual(app.state.assignments[far.id], null, 'non-touching precinct not added');
  assert(!message.hidden && message.textContent.includes('District 1 must stay connected'), 'explains not-adjacent');
  click(app.mapView.getPrecinctElement(start.neighbors[0]));
  assertEqual(app.state.assignments[start.neighbors[0]], 1, 'touching precinct added');
  assert(message.hidden, 'message cleared after a valid edit');

  loadPlan(app);
  const plan = app.state.referencePlan;
  let middle = null;
  for (const c of app.state.precincts) {
    const same = c.neighbors.filter((n) => plan[n] === plan[c.id]);
    const test = { ...plan, [c.id]: null };
    const members = app.state.precincts.filter((x) => test[x.id] === plan[c.id]).map((x) => x.id);
    const seen = new Set([members[0]]);
    const stack = [members[0]];
    while (stack.length) for (const n of app.state.precinctsById.get(stack.pop()).neighbors) if (test[n] === plan[c.id] && !seen.has(n)) { seen.add(n); stack.push(n); }
    if (same.length >= 2 && seen.size < members.length) { middle = c; break; }
  }
  assert(middle, 'found a precinct whose removal splits its district');
  const home = plan[middle.id];
  app.setEditing(home);
  click(app.mapView.getPrecinctElement(middle.id));
  assertEqual(app.state.assignments[middle.id], home, 'removal blocked');
  assert(message.textContent.includes(`Can't remove ${middle.name}`), 'explains split-selected');
  app.setEditing(null);
  assert(message.hidden, 'message cleared when editing stops');
  cleanup();
});

test('plan check shows balance numbers, per-district labels, and becomes valid for a complete balanced plan', async () => {
  const { root, app, cleanup } = await mount();
  const panel = q(root, 'plan-status');
  const value = (key) => panel.querySelector(`[data-key="${key}"]`).textContent;
  assert(panel.textContent.includes('Not valid yet'), 'starts invalid');
  assertEqual(panel.querySelector('.balance-result').dataset.pass, 'false', 'balance fails at start');
  assertEqual(value('limit'), '10%');
  assert(panel.querySelector('.balance-result').textContent.includes('within 10%'), 'rule described as a percentage');
  assertEqual(value('ideal'), app.state.idealDistrictVoters.toLocaleString('en-US'), 'ideal size');
  assertEqual(value('unassigned'), String(app.state.precincts.length));
  loadPlan(app);
  assertEqual(panel.querySelector('.plan-overall').textContent, 'Valid plan');
  assertEqual(panel.querySelector('.balance-result').dataset.pass, 'true');
  const sizes = app.state.districts.map((d) => d.totalVoters);
  assertEqual(value('largest'), Math.max(...sizes).toLocaleString('en-US'));
  assertEqual(value('smallest'), Math.min(...sizes).toLocaleString('en-US'));
  const pct = Math.round(((Math.max(...sizes) - Math.min(...sizes)) / Math.min(...sizes)) * 1000) / 10;
  assertEqual(value('difference'), `${(Math.max(...sizes) - Math.min(...sizes)).toLocaleString('en-US')} voters (${pct}%)`);
  const big = app.state.districts[0];
  const edge = big.precinctIds.find((id) => app.state.precinctsById.get(id).neighbors.some((n) => app.state.assignments[n] !== 1));
  app.assignPrecinct(edge, null);
  assert(panel.textContent.includes('1 precinct has no district'), 'reports unassigned precinct');
  cleanup();
});

test('New map button replaces the state, keeps the matchup, updates the link, and confirms before losing districts', async () => {
  const originalUrl = window.location.href;
  let answer = false;
  let asked = 0;
  const { root, app, cleanup } = await mount('demo-1', { confirm: () => { asked += 1; return answer; } });
  const button = q(root, 'new-map');
  assertEqual(button.tagName, 'BUTTON');
  assertEqual(button.textContent, 'New map');
  const toggle = q(root, 'matchup-toggle');
  assert(toggle.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING, 'button beside toggle');
  click(toggle);
  const matchup = app.matchup;
  click(button);
  assertEqual(asked, 0, 'no confirmation without districts');
  assert(app.state.seed !== 'demo-1', 'new seed');
  assertEqual(new URL(window.location.href).searchParams.get('seed'), app.state.seed, 'link updated');
  assertEqual(q(root, 'state-caption').querySelector('a').getAttribute('href'), `?seed=${encodeURIComponent(app.state.seed)}`);
  assertEqual(app.matchup, matchup, 'matchup kept');
  assertEqual(toggle.textContent, matchup.label, 'toggle text kept');
  const firstSeed = app.state.seed;
  app.setEditing(1);
  app.editPrecinct(app.state.precincts[0].id);
  assertEqual(app.newMap(), false, 'cancel returns false');
  assertEqual(asked, 1, 'asked once');
  assertEqual(app.state.seed, firstSeed, 'cancel keeps map');
  assertEqual(app.state.assignments[app.state.precincts[0].id], 1, 'cancel keeps districts');
  answer = true;
  assertEqual(app.newMap(), true, 'confirm returns true');
  assert(app.state.seed !== firstSeed, 'confirmed new map');
  assertEqual(app.editingDistrict, null, 'editing off');
  assert(Object.values(app.state.assignments).every((d) => d === null), 'districts empty');
  assert(q(root, 'edit-message').hidden, 'edit message hidden');
  window.history.replaceState(null, '', originalUrl);
  cleanup();
});

test('performance: load within 2 s and edits within 1 s on the largest maps', async () => {
  const fixture = document.getElementById('fixture');
  const t0 = performance.now();
  const { app, cleanup } = await mount('perf-check');
  const loadMs = performance.now() - t0;
  assert(loadMs < 2000, `load ${loadMs.toFixed(0)} ms`);
  const order = connectedOrder(app.state, app.state.precincts[0].id, 10);
  app.setEditing(1);
  let slowest = 0;
  for (const id of order) {
    const t = performance.now();
    click(app.mapView.getPrecinctElement(id));
    slowest = Math.max(slowest, performance.now() - t);
  }
  assert(slowest < 1000, `slowest edit ${slowest.toFixed(0)} ms`);
  console.info(`Load ${loadMs.toFixed(0)} ms for ${app.state.precincts.length} precincts; slowest edit ${slowest.toFixed(1)} ms`);
  fixture.style.width = '';
  cleanup();
});

const totalVoters = (state) => state.precincts.reduce((sum, c) => sum + c.totalVoters, 0);

test('statewide stat block shows the total, each side, a proportional bar, and the leader (US1)', async () => {
  const { root, app, cleanup } = await mount();
  const block = q(root, 'state-totals');
  assert(block.compareDocumentPosition(q(root, 'control-total')) & Node.DOCUMENT_POSITION_FOLLOWING, 'before the district control block');
  const statBox = block.getBoundingClientRect();
  const mapBox = q(root, 'map').getBoundingClientRect();
  assert(statBox.top >= mapBox.bottom - 1 || statBox.left >= mapBox.right - 1, 'below the map, or beside it in the column (012)');
  const heading = block.querySelector('h2');
  assertEqual(heading.textContent, 'Statewide voters');
  assertEqual(block.getAttribute('aria-labelledby'), heading.id, 'labelled by its heading');
  assertEqual(block.getAttribute('aria-live'), 'polite');

  const makeup = formatStatewideMakeup(app.state.precincts, MATCHUPS[0]);
  assertEqual(block.querySelector('[data-key="total"]').textContent, formatCount(totalVoters(app.state)), 'total is the sum over all precincts');
  assertEqual(block.querySelector('[data-key="total"]').textContent, formatCount(app.state.totalVoters), 'total matches the state');
  const bar = block.querySelector('.makeup-bar');
  assertEqual(bar.getAttribute('role'), 'img');
  assertEqual(bar.getAttribute('aria-label'), makeup.ariaLabel);
  const segments = [...bar.querySelectorAll('.makeup-segment')];
  assertEqual(segments.map((s) => s.dataset.side), ['sideA', 'sideB'], 'side A first');
  makeup.sides.forEach((side, i) => {
    const row = block.querySelector(`.totals-side[data-side="${side.key}"]`);
    assert(row.querySelector('dt').textContent.includes(side.name), `${side.key} name`);
    assertEqual(row.querySelector(`[data-key="${side.key}Percent"]`).textContent, side.percent, `${side.key} percent`);
    assertEqual(row.querySelector(`[data-key="${side.key}Voters"]`).textContent, `${side.voters} voters`, `${side.key} voters`);
    assertEqual(row.querySelector('.swatch').getAttribute('aria-hidden'), 'true', `${side.key} swatch hidden from assistive tech`);
    assert(Math.abs(parseFloat(segments[i].style.width) - side.share) < 0.01, `${side.key} bar width follows the share`);
    assertEqual(segments[i].style.backgroundColor, rgb(side.color), `${side.key} bar color`);
  });
  const percents = makeup.sides.map((s) => Math.round(parseFloat(block.querySelector(`[data-key="${s.key}Percent"]`).textContent) * 10));
  assertEqual(percents[0] + percents[1], 1000, 'percentages add up to 100.0%');
  const summary = block.querySelector('.totals-summary');
  assertEqual(summary.textContent, makeup.summary);
  assertEqual(summary.dataset.status, makeup.status);
  assert(/lead statewide/.test(summary.textContent), 'names the statewide leader');
  cleanup();
});

test('statewide stat block says the state is tied when the voters are exactly even', () => {
  const container = document.createElement('section');
  renderStateTotals(container, { precincts: [{ sideAVoters: 5, sideBVoters: 5 }, { sideAVoters: 7, sideBVoters: 7 }] }, MATCHUPS[0]);
  assertEqual(container.querySelector('.totals-summary').textContent, 'Tied statewide');
  assertEqual(container.querySelector('.totals-summary').dataset.status, 'tie');
  assertEqual([...container.querySelectorAll('.totals-percent')].map((n) => n.textContent), ['50.0%', '50.0%']);
  assertEqual(container.querySelector('[data-key="total"]').textContent, '24');
});

const stripNames = (text) => text.replace(/[A-Za-z]+/g, '').trim();

test('stat block follows the matchup without changing any number, and ignores district edits (US2)', async () => {
  const { root, app, cleanup } = await mount();
  const block = q(root, 'state-totals');
  const figures = () => [...block.querySelectorAll('[data-key]')].map((n) => [n.dataset.key, n.textContent]);
  const summaryNumbers = () => block.querySelector('.totals-summary').textContent.match(/[\d.]+/g);
  const barWidths = () => [...block.querySelectorAll('.makeup-segment')].map((s) => s.style.width);
  const original = { figures: figures(), summary: summaryNumbers(), widths: barWidths() };
  const toggle = q(root, 'matchup-toggle');
  for (let step = 1; step <= MATCHUPS.length; step += 1) {
    click(toggle);
    const matchup = MATCHUPS[step % MATCHUPS.length];
    assertEqual([...block.querySelectorAll('.totals-name')].map((n) => n.textContent), [matchup.sideA.name, matchup.sideB.name], `names follow ${matchup.id}`);
    assertEqual([...block.querySelectorAll('.makeup-segment')].map((s) => s.style.backgroundColor), [rgb(matchup.sideA.shades[3]), rgb(matchup.sideB.shades[3])], `colors follow ${matchup.id}`);
    assertEqual(figures(), original.figures, `figures unchanged for ${matchup.id}`);
    assertEqual(summaryNumbers(), original.summary, `leader margin unchanged for ${matchup.id}`);
    assertEqual(barWidths(), original.widths, `bar unchanged for ${matchup.id}`);
    assert(block.querySelector('.totals-summary').textContent.includes(matchup.sideA.name) || block.querySelector('.totals-summary').textContent.includes(matchup.sideB.name), 'summary uses the new names');
  }

  loadPlan(app);
  const before = block.innerHTML;
  app.setEditing(2);
  for (const id of connectedOrder(app.state, app.state.precincts[0].id, 6)) {
    app.editPrecinct(id);
    assertEqual(block.innerHTML, before, 'editing leaves the block unchanged (SC-004)');
  }
  app.assignPrecinct(app.state.precincts[1].id, 3);
  app.assignPrecinct(app.state.precincts[1].id, null);
  app.setAssignments({});
  assertEqual(block.innerHTML, before, 'assigning, unassigning, and clearing leave the block unchanged');
  cleanup();
});

test('stat block updates for a new map and returns for a reloaded seed (US2)', async () => {
  const originalUrl = window.location.href;
  const { root, app, cleanup } = await mount('demo-1');
  const block = q(root, 'state-totals');
  const total = () => block.querySelector('[data-key="total"]').textContent;
  const firstHtml = block.innerHTML;
  assertEqual(total(), formatCount(totalVoters(app.state)));

  app.load('demo-2');
  assertEqual(total(), formatCount(totalVoters(app.state)), 'seed demo-2 totals');
  assert(block.innerHTML !== firstHtml, 'a different state shows different numbers');
  app.load('demo-1');
  assertEqual(block.innerHTML, firstHtml, 'the same seed shows the same block');

  const t0 = performance.now();
  assertEqual(app.newMap(), true);
  const ms = performance.now() - t0;
  assert(ms < 1000, `new map and block took ${ms.toFixed(0)} ms (SC-005)`);
  assertEqual(total(), formatCount(totalVoters(app.state)), 'new map totals');
  assert(block.innerHTML !== firstHtml, 'new map shows new numbers');

  for (let i = 0; i < 20; i += 1) {
    app.load(`totals-${i}`);
    const makeup = formatStatewideMakeup(app.state.precincts, MATCHUPS[0]);
    assertEqual(total(), formatCount(totalVoters(app.state)), `seed totals-${i} total`);
    assertEqual(total(), formatCount(app.state.totalVoters), `seed totals-${i} equals the state total`);
    assertEqual(block.querySelector('[data-key="sideAVoters"]').textContent, `${makeup.sides[0].voters} voters`, `seed totals-${i} side A`);
  }
  window.history.replaceState(null, '', originalUrl);
  cleanup();
});

test('stat block and district control show the same sides and colors, side by side, and fit small screens (US3)', async () => {
  const { root, app, cleanup } = await mount();
  const fixture = document.getElementById('fixture');
  const block = q(root, 'state-totals');
  const control = q(root, 'control-total');
  const toggle = q(root, 'matchup-toggle');
  for (let step = 0; step < MATCHUPS.length; step += 1) {
    const names = [...block.querySelectorAll('.totals-name')].map((n) => n.textContent);
    const controlNames = [...control.querySelectorAll('.control-label')].slice(0, 2).map((n) => n.textContent);
    assertEqual(names, controlNames, 'same side names in both blocks');
    const colors = [...block.querySelectorAll('.makeup-segment')].map((s) => s.style.backgroundColor);
    const controlColors = [...control.querySelectorAll('.swatch')].slice(0, 2).map((s) => s.style.backgroundColor);
    assertEqual(colors, controlColors, 'same side colors in both blocks');
    click(toggle);
  }

  for (const width of [1200, 320]) {
    fixture.style.width = `${width}px`;
    await new Promise((resolve) => setTimeout(resolve, 80));
    const stat = block.getBoundingClientRect();
    const district = control.getBoundingClientRect();
    assert(stat.width > 0 && stat.height > 0 && district.height > 0, `both blocks visible at ${width}`);
    // Side by side on a wide page, one above the other on a phone.
    if (width >= 760) {
      const beside = district.left >= stat.right - 1 && Math.abs(district.top - stat.top) <= 2;
      const stacked = district.top >= stat.bottom - 1;
      assert(beside || stacked, `the control block sits beside the stat block or below it at ${width}`);
    } else assert(district.top - stat.bottom >= 0 && district.top - stat.bottom <= 40, `the control block sits directly below the stat block at ${width}`);
    const rootBox = root.getBoundingClientRect();
    assert(root.scrollWidth <= root.clientWidth, `no horizontal scrolling at ${width}`);
    assert(stat.left >= rootBox.left - 1 && stat.right <= rootBox.right + 1, `stat block inside the page at ${width}`);
  }

  // Seven-digit voter counts must still fit the narrow side column (about 260 px) and a phone.
  const big = { precincts: [{ sideAVoters: 1234567, sideBVoters: 7654321 }] };
  for (const width of [260, 320]) {
    fixture.style.width = '1200px';
    block.style.width = `${width}px`;
    renderStateTotals(block, big, MATCHUPS[0]);
    for (const row of block.querySelectorAll('.totals-side')) assert(row.scrollWidth <= row.clientWidth, `${row.dataset.side} row fits ${width}px`);
    assert(block.scrollWidth <= block.clientWidth, `block fits ${width}px`);
  }
  block.style.width = '';
  fixture.style.width = '';
  cleanup();
});

// --- Feature 008: custom state builder ---------------------------------------------------------------------

const mapClientPoint = (svg, x, y) => {
  const box = svg.getBoundingClientRect();
  return { clientX: box.left + (x / 800) * box.width, clientY: box.top + (y / 600) * box.height };
};
const clickMap = (svg, x, y) => svg.dispatchEvent(new MouseEvent('click', { bubbles: true, ...mapClientPoint(svg, x, y) }));
const arrow = (svg, name, shiftKey = false) => svg.dispatchEvent(new KeyboardEvent('keydown', { key: name, shiftKey, bubbles: true }));

// Spots where more cities may go, found by scanning the map (each one is valid for the plan so far). Spots meant for
// real clicks keep a margin from the 90 px spacing and the outline, so pixel rounding cannot tip them over a rule.
function citySpots(plan, count, startX = 60, startY = 60, margin = 10) {
  const bare = createPlan({ outlineSeed: plan.outlineSeed });
  const wiggles = margin ? [[-2, -2], [2, -2], [-2, 2], [2, 2]] : [];
  const scan = (fromX, fromY) => {
    let probe = plan;
    const spots = [];
    for (let y = fromY; y < 590 && spots.length < count; y += 10) {
      for (let x = fromX; x < 790 && spots.length < count; x += 10) {
        if (!checkCityPlacement(probe, { x, y }).ok) continue;
        if (probe.cities.some((c) => Math.hypot(c.x - x, c.y - y) < MIN_CITY_DISTANCE + margin)) continue;
        if (!wiggles.every(([dx, dy]) => checkCityPlacement(bare, { x: x + dx, y: y + dy }).ok)) continue;
        spots.push({ x, y });
        probe = addCity(probe, { x, y });
      }
    }
    return spots;
  };
  // Outlines differ, so a start point may have no room left past it; scanning from the corner finds the room.
  const spots = scan(startX, startY);
  return spots.length === count ? spots : scan(60, 60);
}

const cityMarkers = (root) => [...q(root, 'map').querySelectorAll('.city-marker')];
const cityCount = (root) => q(root, 'city-count').textContent;

test('Build a state opens the builder, hides the district sections, and starts with no cities (US1)', async () => {
  const { root, app, cleanup } = await mount();
  assertEqual(app.mode, 'view');
  assert(q(root, 'builder').hidden, 'builder is hidden at first');
  click(q(root, 'build-state'));
  assertEqual(app.mode, 'build');
  assert(root.classList.contains('is-building'), 'page is in build mode');
  assert(!q(root, 'builder').hidden, 'builder panel shown');
  assertEqual(cityCount(root), 'Cities: 0 of 12');
  assertEqual(app.builder.plan.cities, [], 'no cities yet');
  assert(app.builder.result.ok, 'an empty plan builds');
  assertEqual(app.state.custom, true, 'the map shows the draft state');
  for (const role of ['control-total', 'plan-status']) assertEqual(getComputedStyle(q(root, role)).display, 'none', `${role} hidden while building`);
  assertEqual(getComputedStyle(root.querySelector('.districts')).display, 'none', 'district list hidden while building');
  assert(q(root, 'state-totals').textContent.includes('Statewide voters'), 'the statewide stat block stays');
  assert(!q(root, 'matchup-toggle').hidden, 'matchup toggle stays');
  assertEqual(cityMarkers(root).length, 0);
  cleanup();
});

test('clicking inside the state adds a city and clicking a city selects it (US1)', async () => {
  const { root, app, cleanup } = await mount();
  click(q(root, 'build-state'));
  const svg = q(root, 'map');
  const spots = citySpots(app.builder.plan, 3, 60, 120);
  assertEqual(spots.length, 3, 'three spots found');
  const times = [];
  for (const [i, spot] of spots.entries()) {
    const t0 = performance.now();
    clickMap(svg, spot.x, spot.y);
    times.push(performance.now() - t0);
    assertEqual(cityMarkers(root).length, i + 1, `${i + 1} markers`);
    assertEqual(cityCount(root), `Cities: ${i + 1} of 12`);
  }
  assert(times.every((ms) => ms < 1000), `each click redrew the map in under 1 s (${times.map((t) => t.toFixed(0)).join(', ')} ms)`);
  const sameSpots = (found, expected) => found.length === expected.length && found.every((c, i) => Math.hypot(c.x - expected[i].x, c.y - expected[i].y) <= 1.5);
  assert(sameSpots(app.builder.plan.cities, spots), 'the plan holds the clicked spots (to within a pixel)');
  assertEqual(app.state.precincts.length, 575, 'three cities give 575 precincts');

  const average = app.state.precincts.reduce((sum, c) => sum + c.area, 0) / app.state.precincts.length;
  const near = app.state.precincts.filter((c) => spots.some((s) => Math.hypot(c.seedPoint[0] - s.x, c.seedPoint[1] - s.y) <= 55));
  assert(near.length > 0 && near.reduce((sum, c) => sum + c.area, 0) / near.length < average, 'precincts near the cities are smaller than average (FR-004)');
  assertEqual(cityMarkers(root)[0].getAttribute('data-city'), '0');

  click(cityMarkers(root)[1]);
  assertEqual(cityMarkers(root).length, 3, 'clicking a city never removes it');
  assertEqual(app.builder.selected, 1, 'clicking a city selects it');
  assert(sameSpots(app.builder.plan.cities, spots), 'the plan is unchanged by the click');
  click(q(root, 'build-remove'));
  assertEqual(cityMarkers(root).length, 2, 'Remove city removes the selected city');
  assertEqual(cityCount(root), 'Cities: 2 of 12');
  assert(sameSpots(app.builder.plan.cities, [spots[0], spots[2]]), 'the right city was removed');
  assert(q(root, 'city-list').textContent.includes('City 1 at x'), 'cities are also listed as text');
  cleanup();
});

// One real build of 12 cities of 300,000 voters, made once. Tests about placing and resizing many cities hand it to the app in place
// of building every intermediate plan, which keeps them about the page (the build itself is tested in custom-state.test.js).
let bigState = null;
function bigBuilt() {
  if (!bigState) {
    let plan = createPlan({ outlineSeed: 'big0' });
    for (const spot of citySpots(plan, MAX_CITIES, 60, 60, 0)) plan = addCity(plan, spot, 300000);
    bigState = buildCustomState(plan);
  }
  return bigState;
}
const buildManyCities = (plan) => (plan.cities.length > 2 ? bigBuilt() : buildCustomState(plan));

test('clicks outside the state, too close to a city, or past the limit add nothing and say why (US1)', async () => {
  const { root, app, cleanup } = await mount('demo-1', { buildState: buildManyCities });
  click(q(root, 'build-state'));
  const svg = q(root, 'map');
  const message = () => q(root, 'build-message').textContent;
  clickMap(svg, 4, 4);
  assertEqual(message(), 'Cities must be inside the state.');
  assertEqual(app.builder.plan.cities.length, 0, 'nothing added outside');

  const [spot] = citySpots(app.builder.plan, 1, 200, 200);
  clickMap(svg, spot.x, spot.y);
  assertEqual(app.builder.plan.cities.length, 1);
  // A point 85 px away that is still inside the state, so only the spacing rule can refuse it.
  const bare = createPlan({ outlineSeed: app.builder.plan.outlineSeed });
  const tooClose = [[85, 0], [-85, 0], [0, 85], [0, -85]].map(([dx, dy]) => ({ x: spot.x + dx, y: spot.y + dy }))
    .find((p) => [[-2, -2], [2, -2], [-2, 2], [2, 2]].every(([dx, dy]) => checkCityPlacement(bare, { x: p.x + dx, y: p.y + dy }).ok));
  assert(tooClose, 'a nearby point inside the state was found');
  clickMap(svg, tooClose.x, tooClose.y);
  assertEqual(app.builder.plan.cities.length, 1, 'too close adds nothing');
  assertEqual(message(), 'Cities must be at least 90 pixels apart.');

  const before = app.state;
  for (const next of citySpots(app.builder.plan, MAX_CITIES - 1, 60, 60, 0)) app.placeCity(next);
  assertEqual(app.builder.plan.cities.length, MAX_CITIES, 'twelve cities placed');
  assertEqual(cityCount(root), 'Cities: 12 of 12');
  const count = app.builder.plan.cities.length;
  clickMap(svg, 400, 300);
  assertEqual(app.builder.plan.cities.length, count, 'the limit holds');
  assertEqual(message(), 'You can place up to 12 cities.');
  assert(app.state !== before, 'the map was redrawn for the placed cities');
  cleanup();
});

test('keyboard users place and select cities with the arrow keys and Enter, and remove them with Delete (US1)', async () => {
  const { root, app, cleanup } = await mount();
  click(q(root, 'build-state'));
  const svg = q(root, 'map');
  assertEqual(svg.getAttribute('tabindex'), '0', 'the map takes focus in build mode');
  assert(/City placement map/.test(svg.getAttribute('aria-label')), 'the map is labelled for placement');
  assert(app.state.precincts.every((c) => app.mapView.getPrecinctElement(c.id).getAttribute('tabindex') === '-1'), 'precincts are out of the tab order');
  const cursor = () => svg.querySelector('[data-role="build-cursor"]').getAttribute('data-cursor');
  assertEqual(cursor(), '400,300', 'the cursor starts in the middle');
  arrow(svg, 'ArrowRight');
  assertEqual(cursor(), '410,300', 'arrows move 10 px');
  arrow(svg, 'ArrowDown', true);
  assertEqual(cursor(), '410,340', 'Shift moves 40 px');
  arrow(svg, 'ArrowLeft', true);
  arrow(svg, 'ArrowUp');
  assertEqual(cursor(), '370,330');
  for (let i = 0; i < 90; i += 1) arrow(svg, 'ArrowLeft');
  assertEqual(cursor(), '0,330', 'the cursor stops at the left edge');
  for (let i = 0; i < 90; i += 1) arrow(svg, 'ArrowRight', true);
  assertEqual(cursor(), '800,330', 'and at the right edge');
  for (let i = 0; i < 30; i += 1) arrow(svg, 'ArrowUp', true);
  assertEqual(cursor(), '800,0', 'and at the top edge');
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assertEqual(app.builder.plan.cities.length, 0, 'Enter outside the state adds nothing');
  assertEqual(q(root, 'build-message').textContent, 'Cities must be inside the state.');

  // Walk the cursor to a spot on the 10 px grid that is inside the state: back to the top-left corner, then count presses.
  const [spot] = citySpots(app.builder.plan, 1, 200, 200);
  for (let i = 0; i < 30; i += 1) arrow(svg, 'ArrowLeft', true);
  for (let i = 0; i < 30; i += 1) arrow(svg, 'ArrowUp', true);
  assertEqual(cursor(), '0,0');
  for (let i = 0; i < spot.x / 10; i += 1) arrow(svg, 'ArrowRight');
  for (let i = 0; i < spot.y / 10; i += 1) arrow(svg, 'ArrowDown');
  assertEqual(cursor(), `${spot.x},${spot.y}`, 'cursor on the chosen spot');
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assertEqual(app.builder.plan.cities, [{ ...spot, pop: 100000 }], 'Enter adds a city at the cursor');
  assertEqual(cityMarkers(root).length, 1);
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assertEqual(app.builder.plan.cities.length, 1, 'Enter on a city selects it and does not remove it');
  assertEqual(app.builder.selected, 0);
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  assertEqual(app.builder.plan.cities.length, 0, 'Delete removes the selected city');
  cleanup();
});

test('a tap adds a city like a click, and precinct clicks place cities instead of editing districts (US1)', async () => {
  const { root, app, cleanup } = await mount();
  click(q(root, 'build-state'));
  const svg = q(root, 'map');
  const [spot] = citySpots(app.builder.plan, 1, 300, 240);
  const at = mapClientPoint(svg, spot.x, spot.y);
  svg.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', ...at }));
  svg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'touch', ...at }));
  svg.dispatchEvent(new MouseEvent('click', { bubbles: true, ...at }));
  assertEqual(app.builder.plan.cities.length, 1, 'a tap adds a city');
  // The point comes from screen coordinates, so it can land a pixel off the spot the test aimed at.
  assert(Math.abs(app.builder.plan.cities[0].x - spot.x) <= 1 && Math.abs(app.builder.plan.cities[0].y - spot.y) <= 1 && app.builder.plan.cities[0].pop === 100000, 'at the tapped spot');

  const [second] = citySpots(app.builder.plan, 1, 520, 360);
  const precinct = app.state.precincts.find((c) => Math.hypot(c.seedPoint[0] - second.x, c.seedPoint[1] - second.y) < 25) ?? app.state.precincts[0];
  const path = app.mapView.getPrecinctElement(precinct.id);
  path.dispatchEvent(new MouseEvent('click', { bubbles: true, ...mapClientPoint(svg, second.x, second.y) }));
  assertEqual(app.builder.plan.cities.length, 2, 'a click on a precinct places a city where it landed');
  assert(Object.values(app.state.assignments).every((d) => d === null), 'no precinct was assigned to a district');
  assertEqual(app.editingDistrict, null);
  cleanup();
});

const settle = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
const popSlider = (root) => q(root, 'pop-slider');
const popOutput = (root) => q(root, 'pop-output').textContent;
const changeSlider = (slider, value) => {
  slider.value = String(value);
  slider.dispatchEvent(new Event('change', { bubbles: true }));
};

test('placing, selecting, and removing cities keeps the selection and the population controls in step (US1)', async () => {
  const { root, app, cleanup } = await mount();
  click(q(root, 'build-state'));
  const svg = q(root, 'map');
  assert(popSlider(root).disabled, 'the slider is disabled with no cities');
  assertEqual(popOutput(root), 'Place or select a city to set its population.');
  assert(q(root, 'build-remove').disabled, 'Remove city is disabled with no selection');

  const spots = citySpots(app.builder.plan, 3, 60, 120);
  clickMap(svg, spots[0].x, spots[0].y);
  let markers = cityMarkers(root);
  assert(markers[0].classList.contains('selected'), 'the new city is selected');
  assertEqual(markers[0].getAttribute('data-selected'), 'true');
  assert(markers[0].querySelector('circle.city-ring'), 'the selected city has a ring');
  assert(!popSlider(root).disabled && !q(root, 'build-remove').disabled, 'controls are enabled');
  assertEqual(popOutput(root), 'City 1: 100,000 voters');

  clickMap(svg, spots[1].x, spots[1].y);
  clickMap(svg, spots[2].x, spots[2].y);
  markers = cityMarkers(root);
  assertEqual(markers.map((m) => m.classList.contains('selected')), [false, false, true], 'only the newest city is selected');
  assertEqual(popOutput(root), 'City 3: 100,000 voters');

  click(markers[0]);
  assertEqual(app.builder.selected, 0);
  assertEqual(cityMarkers(root).length, 3, 'clicking a city does not remove it');
  assertEqual(popOutput(root), 'City 1: 100,000 voters');
  assertEqual(q(root, 'build-message').textContent, 'City 1 selected. 100,000 voters.');

  click(cityMarkers(root)[2]);
  assertEqual(app.builder.selected, 2);
  const third = app.builder.plan.cities[2];
  app.removeCity(0);
  assertEqual(app.builder.selected, 1, 'removing an earlier city keeps the same city selected');
  assertEqual(app.builder.plan.cities[1], third);
  assertEqual(popOutput(root), 'City 2: 100,000 voters');

  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
  assertEqual(app.builder.plan.cities.length, 1, 'Backspace removes the selected city');
  assertEqual(app.builder.selected, null, 'the selection clears');
  assert(popSlider(root).disabled && q(root, 'build-remove').disabled, 'controls are disabled again');
  assertEqual(q(root, 'build-message').textContent, 'City 2 removed. 1 of 12 cities.');
  svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
  assertEqual(app.builder.plan.cities.length, 1, 'Delete with nothing selected does nothing');

  click(cityMarkers(root)[0]);
  click(q(root, 'build-remove'));
  assertEqual(app.builder.plan.cities.length, 0);
  assertEqual(cityMarkers(root).length, 0);
  cleanup();
});

test('New outline and Clear cities clear the selection (US1)', async () => {
  const { root, app, cleanup } = await builtApp({ confirm: () => true }, 2);
  assertEqual(app.builder.selected, 1, 'the last placed city is selected');
  click(q(root, 'build-outline'));
  assertEqual(app.builder.selected, null);
  assert(popSlider(root).disabled);
  app.placeCity(citySpots(app.builder.plan, 1, 200, 200)[0]);
  assertEqual(app.builder.selected, app.builder.plan.cities.length - 1);
  click(q(root, 'build-clear'));
  assertEqual(app.builder.selected, null);
  assertEqual(popOutput(root), 'Place or select a city to set its population.');
  cleanup();
});

test('the population slider sets the selected city, and each city keeps its own value (US1)', async () => {
  const { root, app, cleanup } = await mount();
  click(q(root, 'build-state'));
  const slider = popSlider(root);
  assertEqual([slider.min, slider.max, slider.step], ['10', '300', '10'], 'slider runs 10 to 300 thousand in steps of 10');
  assertEqual(q(root, 'pop-label').textContent, 'City population');
  assertEqual(root.querySelector('label[for="pop-slider"]')?.textContent, 'City population');

  const spots = citySpots(app.builder.plan, 2, 60, 120);
  app.placeCity(spots[0]);
  assertEqual(slider.getAttribute('aria-valuetext'), popOutput(root), 'aria-valuetext follows the output');
  const total0 = app.state.precincts.reduce((s, c) => s + c.totalVoters, 0);
  const t0 = performance.now();
  changeSlider(slider, 300);
  assert(performance.now() - t0 < 1500, 'a committed change redraws within 1.5 seconds');
  assertEqual(app.builder.plan.cities[0].pop, 300000, 'the plan holds the new population');
  assertEqual(popOutput(root), 'City 1: 300,000 voters');
  assertEqual(q(root, 'build-message').textContent, 'City 1 set to 300,000 voters. 1 of 12 cities.');
  const total1 = app.state.precincts.reduce((s, c) => s + c.totalVoters, 0);
  assert(Math.abs(total1 - total0 - 200000) < 200, `the state grew by 200,000 (${total1 - total0})`);
  assert(q(root, 'state-totals').textContent.length > 0, 'the stat block shows the new total');

  app.placeCity(spots[1]);
  assertEqual(app.builder.plan.cities[1].pop, 300000, 'a new city starts at the last chosen population');
  changeSlider(slider, 10);
  assertEqual(app.builder.plan.cities.map((c) => c.pop), [300000, 10000], 'each city keeps its own value');
  click(cityMarkers(root)[0]);
  assertEqual(slider.value, '300', 'selecting a city moves the slider to its value');
  assertEqual(popOutput(root), 'City 1: 300,000 voters');
  assertEqual(q(root, 'build-message').textContent, 'City 1 selected. 300,000 voters.');

  const around = (city, state) => state.precincts.filter((c) => Math.hypot(c.seedPoint[0] - city.x, c.seedPoint[1] - city.y) <= 55);
  const mean = (list) => list.reduce((s, c) => s + c.totalVoters, 0) / Math.max(1, list.length);
  const big = mean(around(app.builder.plan.cities[0], app.state));
  changeSlider(slider, 10);
  const small = mean(around(app.builder.plan.cities[0], app.state));
  assert(big > small, `precincts around a 300,000 city hold more voters than around the same city at 10,000 (${big.toFixed(0)} vs ${small.toFixed(0)})`);
  cleanup();
});

test('dragging the population slider redraws once it pauses (US1)', async () => {
  const { root, app, cleanup } = await mount();
  click(q(root, 'build-state'));
  app.placeCity(citySpots(app.builder.plan, 1, 200, 200)[0]);
  const slider = popSlider(root);
  setSlider(slider, 200);
  assertEqual(popOutput(root), 'City 1: 200,000 voters', 'the label follows at once');
  assertEqual(app.builder.plan.cities[0].pop, 100000, 'the plan waits for a pause');
  setSlider(slider, 250);
  await settle(300);
  assertEqual(app.builder.plan.cities[0].pop, 250000, 'the plan catches up after the pause');
  cleanup();
});

test('the population controls fit a 320 px page and 12 large cities fit the stat block (US1)', async () => {
  const built = bigBuilt();
  assert(built.ok, 'the large plan builds');
  const { root, app, cleanup } = await mount('demo-1', { buildState: () => built });
  click(q(root, 'build-state'));
  const fixture = document.getElementById('fixture');
  fixture.style.width = '320px';
  for (const spot of citySpots(app.builder.plan, MAX_CITIES, 60, 60, 0)) app.placeCity(spot);
  for (let i = 0; i < app.builder.plan.cities.length; i += 1) {
    app.selectCity(i);
    app.setCityPopulation(i, 300000);
  }
  assert(app.builder.result.ok, 'the large plan builds');
  const total = app.state.precincts.reduce((s, c) => s + c.totalVoters, 0);
  assert(total > 3000000, `the total is about 4 million (${total})`);
  assert(root.scrollWidth <= root.clientWidth, 'no horizontal scrolling at 320 px');
  const block = q(root, 'state-totals');
  assert(block.scrollWidth <= block.clientWidth, 'the stat block fits');
  fixture.style.width = '';
  cleanup();
});

test('entering the builder asks before districts are lost (FR-015)', async () => {
  let asked = [];
  let answer = false;
  const { root, app, cleanup } = await mount('demo-1', { confirm: (text) => { asked.push(text); return answer; } });
  click(q(root, 'build-state'));
  assertEqual(asked, [], 'no prompt when nothing is drawn');
  assertEqual(app.mode, 'build');
  app.load('demo-1');
  assertEqual(app.mode, 'view', 'loading a map leaves the builder');
  loadPlan(app);
  const state = app.state;
  click(q(root, 'build-state'));
  assertEqual(asked, ['Build a state? Your districts will be lost.']);
  assertEqual(app.mode, 'view', 'declining keeps the page as it was');
  assertEqual(app.state, state, 'and keeps the state');
  assert(q(root, 'builder').hidden, 'builder stays hidden');
  answer = true;
  click(q(root, 'build-state'));
  assertEqual(asked.length, 2);
  assertEqual(app.mode, 'build', 'accepting opens the builder');
  cleanup();
});

const setSlider = (slider, value) => {
  slider.value = String(value);
  slider.dispatchEvent(new Event('input', { bubbles: true }));
};
const typeShareOf = (state, type) => {
  const precincts = state.precincts.filter((c) => c.type === type);
  const total = precincts.reduce((sum, c) => sum + c.totalVoters, 0);
  return total ? precincts.reduce((sum, c) => sum + c.sideAVoters, 0) / total : null;
};

test('the voter sliders have the right ranges, labels, and words, and follow the matchup (US2)', async () => {
  const { root, cleanup } = await mount();
  click(q(root, 'build-state'));
  const share = q(root, 'share-slider');
  const lean = q(root, 'lean-slider');
  assertEqual([share.min, share.max, share.step], ['30', '70', '0.5'], 'share range');
  assertEqual([lean.min, lean.max, lean.step], ['-100', '100', '10'], 'lean range');
  const label = (slider) => root.querySelector(`label[for="${slider.id}"]`).textContent;
  const output = (slider) => root.querySelector(`output[for="${slider.id}"]`).textContent;
  assertEqual(label(share), 'Democrats share of all voters');
  assertEqual(label(lean), 'City lean');
  assertEqual(output(share), 'Democrats 50.0%');
  assertEqual(output(lean), 'Cities lean Democrats +50');
  assertEqual(share.getAttribute('aria-valuetext'), output(share), 'screen readers hear the words');
  assertEqual(lean.getAttribute('aria-valuetext'), output(lean));
  setSlider(lean, -30);
  assertEqual(output(lean), 'Cities lean Republicans +30');
  setSlider(lean, 0);
  assertEqual(output(lean), 'Cities lean neither side');
  setSlider(share, 42.5);
  assertEqual(output(share), 'Democrats 42.5%');

  click(q(root, 'matchup-toggle'));
  assertEqual(label(share), 'Socialists share of all voters', 'labels use the new names');
  assertEqual(output(share), 'Socialists 42.5%', 'the same value, with the new name');
  setSlider(lean, 50);
  assertEqual(output(lean), 'Cities lean Socialists +50');
  cleanup();
});

test('moving the sliders recolors the map and the stat block at once without rebuilding the precincts (US2)', async () => {
  const { root, app, cleanup } = await mount();
  click(q(root, 'build-state'));
  for (const spot of citySpots(app.builder.plan, 3, 60, 100, 0)) app.placeCity(spot);
  assertEqual(app.builder.plan.cities.length, 3);
  const share = q(root, 'share-slider');
  const lean = q(root, 'lean-slider');
  const ids = app.state.precincts.map((c) => c.id);
  const path = app.mapView.getPrecinctElement(ids[0]);
  path.focus();
  const layoutKey = app.state.layoutKey;
  const fills = () => ids.map((id) => app.mapView.getPrecinctElement(id).getAttribute('fill'));
  const before = fills();

  const t0 = performance.now();
  setSlider(share, 40);
  const ms = performance.now() - t0;
  assert(ms < 1000, `the slider took ${ms.toFixed(0)} ms (FR-010)`);
  assertEqual(app.builder.plan.shareA, 400);
  assert(Math.abs(app.state.statewideShareA - 0.4) <= 0.005, 'statewide split follows the slider');
  const percentA = parseFloat(q(root, 'state-totals').querySelector('[data-key="sideAPercent"]').textContent);
  assert(Math.abs(percentA - 40) <= 0.5, `the stat block shows ${percentA}%`);
  assert(fills().some((f, i) => f !== before[i]), 'precinct colors changed');
  assertEqual(app.state.layoutKey, layoutKey, 'same layout');
  assert(app.mapView.getPrecinctElement(ids[0]) === path, 'precinct shapes were reused');
  assert(document.activeElement === path, 'focus stays on the precinct');
  for (const precinct of app.state.precincts) {
    const result = getResult(precinct.sideAVoters, precinct.sideBVoters);
    assertEqual(app.mapView.getPrecinctElement(precinct.id).dataset.ownFill, getResultColor(result.status, result.marginPercent, MATCHUPS[0]), `${precinct.id} repainted`);
  }

  setSlider(share, 70);
  assertEqual(app.builder.plan.shareA, 700);
  assert(Math.abs(app.state.statewideShareA - 0.7) <= 0.005);
  setSlider(share, 50);
  setSlider(lean, 100);
  const gapAtPlus = typeShareOf(app.state, 'urban') - typeShareOf(app.state, 'rural');
  setSlider(lean, -100);
  const gapAtMinus = typeShareOf(app.state, 'urban') - typeShareOf(app.state, 'rural');
  assert(gapAtPlus > gapAtMinus, `cities lean side A at +100 (${gapAtPlus.toFixed(2)}) and side B at -100 (${gapAtMinus.toFixed(2)})`);
  assert(Math.abs(app.state.statewideShareA - 0.5) <= 0.005, 'the split holds while the lean moves');
  assertEqual(app.builder.plan.cityLean, -100);
  cleanup();
});

test('switching the matchup in the builder changes names and colors but no voter numbers (US2)', async () => {
  const { root, app, cleanup } = await mount();
  click(q(root, 'build-state'));
  for (const spot of citySpots(app.builder.plan, 2, 80, 120, 0)) app.placeCity(spot);
  setSlider(q(root, 'share-slider'), 45);
  const figures = () => [...q(root, 'state-totals').querySelectorAll('[data-key]')].map((n) => n.textContent);
  const before = figures();
  const voters = app.state.precincts.map((c) => [c.sideAVoters, c.sideBVoters]);
  click(q(root, 'matchup-toggle'));
  assertEqual(figures(), before, 'stat block numbers unchanged');
  assertEqual(app.state.precincts.map((c) => [c.sideAVoters, c.sideBVoters]), voters, 'precinct voters unchanged');
  assertEqual(app.builder.plan.shareA, 450, 'the setting keeps its meaning');
  assert(q(root, 'state-totals').textContent.includes('Socialists'), 'the stat block uses the new names');
  cleanup();
});

const builtApp = async (options = {}, cityTotal = 3) => {
  const mounted = await mount('demo-1', options);
  click(q(mounted.root, 'build-state'));
  for (const spot of citySpots(mounted.app.builder.plan, cityTotal, 60, 100, 0)) mounted.app.placeCity(spot);
  return mounted;
};

test('Use this state leaves the builder with an empty, fully working custom map (US3)', async () => {
  const { root, app, cleanup } = await builtApp();
  const draftTotals = q(root, 'state-totals').innerHTML;
  const draftState = app.state;
  assert(!q(root, 'build-use').disabled, 'Use is available for a good build');
  click(q(root, 'build-use'));
  assertEqual(app.mode, 'view');
  assert(!root.classList.contains('is-building'), 'page is out of build mode');
  assert(q(root, 'builder').hidden, 'builder hidden');
  assertEqual(app.builder, null, 'no draft is kept');
  assertEqual(app.state, draftState, 'the built state is the one in use');
  assertEqual(app.state.custom, true);
  assertEqual(q(root, 'state-totals').innerHTML, draftTotals, 'the statewide numbers match the builder');
  assertEqual(q(root, 'state-caption').textContent, `A custom state · ${app.state.precincts.length} precincts · ${app.state.districtCount} districts · custom map link`);
  assertEqual(getComputedStyle(root.querySelector('.districts')).display !== 'none', true, 'district list is back');
  const rows = [...q(root, 'district-list').querySelectorAll('.district-row')];
  assertEqual(rows.length, app.state.districtCount, 'a row for every district');
  assert(rows.every((row) => row.dataset.status === 'empty'), 'every district starts empty');
  assert(Object.values(app.state.assignments).every((d) => d === null), 'no precinct is in a district');
  assertEqual(app.state.precincts.filter((c) => app.mapView.getPrecinctElement(c.id).getAttribute('tabindex') === '0').length, 1, 'precincts are focusable again (one tab stop)');
  assertEqual(q(root, 'map').getAttribute('tabindex'), null, 'the map itself is no longer a focus stop');
  assert(/Map of/.test(q(root, 'map').getAttribute('aria-label')), 'the map has its normal label back');
  cleanup();
});

test('a custom map uses the same editing, balance, tooltip, and matchup features as a random one (US3)', async () => {
  const { root, app, cleanup } = await builtApp({}, 4);
  click(q(root, 'build-use'));
  const state = app.state;
  app.setEditing(1);
  const order = connectedOrder(state, state.precincts[0].id, 4);
  for (const id of order) assertEqual(app.editPrecinct(id).allowed, true, `${id} can join district 1`);
  assertEqual(precinctsOf(app, 1).length, 4);
  const far = state.precincts.find((c) => c.id !== order[0] && !state.precinctsById.get(order[0]).neighbors.includes(c.id) && !order.some((id) => state.precinctsById.get(id).neighbors.includes(c.id)));
  const refused = app.editPrecinct(far.id);
  assertEqual(refused.allowed, false, 'a precinct that would split the district is refused');
  assert(/stay connected/.test(q(root, 'edit-message').textContent), 'and the reason is shown');
  app.setEditing(null);

  hover(app.mapView.getPrecinctElement(order[0]), 'pointerover');
  assert(!q(root, 'tooltip').hidden && q(root, 'tooltip').textContent.includes(state.precinctsById.get(order[0]).name), 'hover shows precinct details');
  hover(app.mapView.getPrecinctElement(order[0]), 'pointerout');
  assertPainted(app, MATCHUPS[0], 'custom map');

  loadPlan(app);
  const status = getPlanStatus(app.state);
  assert(status.valid, 'the reference plan is a valid, balanced plan on the custom map (SC-006)');
  assert(/Valid plan/.test(q(root, 'plan-status').textContent), 'plan check reports it');
  click(q(root, 'matchup-toggle'));
  assertPainted(app, MATCHUPS[1], 'custom map, second matchup');
  assertEqual(app.state.custom, true);
  cleanup();
});

test('New map after a custom map gives a random state, after the usual confirmation (US3)', async () => {
  const originalUrl = window.location.href;
  const asked = [];
  const { root, app, cleanup } = await builtApp({ confirm: (text) => { asked.push(text); return true; } });
  click(q(root, 'build-use'));
  loadPlan(app);
  assertEqual(app.newMap(), true);
  assertEqual(asked, ['Start a new map? Your districts will be lost.'], 'asked because districts were drawn');
  assert(!app.state.custom, 'a random state');
  assertEqual(app.mode, 'view');
  assert(/seed /.test(q(root, 'state-caption').textContent), 'the caption shows a seed again');
  window.history.replaceState(null, '', originalUrl);
  cleanup();
});

test('Cancel returns to the previous map with its districts and asks nothing (US3)', async () => {
  const asked = [];
  const { root, app, cleanup } = await mount('demo-1', { confirm: (text) => { asked.push(text); return true; } });
  const url = window.location.href;
  loadPlan(app);
  const original = app.state;
  const assignments = { ...original.assignments };
  click(q(root, 'build-state'));
  assertEqual(asked.length, 1, 'asked once, on entering');
  app.placeCity(citySpots(app.builder.plan, 1, 200, 200, 0)[0]);
  assert(app.state !== original, 'the builder shows its own map');
  click(q(root, 'build-cancel'));
  assertEqual(asked.length, 1, 'Cancel asks nothing');
  assertEqual(app.mode, 'view');
  assert(app.state === original, 'the same state object is back');
  assertEqual(app.state.assignments, assignments, 'districts are unchanged');
  assert(q(root, 'builder').hidden && !root.classList.contains('is-building'), 'builder closed');
  assertEqual(window.location.href, url, 'the address is unchanged');
  assert(/seed demo-1/.test(q(root, 'state-caption').textContent), 'the caption is back');
  assertPainted(app, MATCHUPS[0], 'after cancel');
  assertEqual(app.state.precincts.filter((c) => app.mapView.getPrecinctElement(c.id).getAttribute('tabindex') === '0').length, 1, 'precincts are focusable again (one tab stop)');
  cleanup();
});

test('a build that fails disables Use, explains why, and keeps the last good map (FR-012, US3)', async () => {
  const failing = (plan) => (plan.cities.length === 1 ? { ok: false, reason: 'layout' } : buildCustomState(plan));
  const { root, app, cleanup } = await mount('demo-1', { buildState: failing });
  click(q(root, 'build-state'));
  const goodState = app.state;
  assert(!q(root, 'build-use').disabled, 'Use works before the failure');
  const [spot, next] = citySpots(app.builder.plan, 2, 60, 100, 0);
  app.placeCity(spot);
  assertEqual(app.builder.result.ok, false);
  assert(q(root, 'build-use').disabled, 'Use is disabled');
  assertEqual(q(root, 'build-message').textContent, "These cities can't make a map that splits into fair districts. Try moving cities further apart or removing one.");
  assert(app.state === goodState, 'the map keeps the last good layout');
  assertEqual(cityMarkers(root).length, 1, 'the new city is still shown so it can be removed');
  click(q(root, 'build-use'));
  assertEqual(app.mode, 'build', 'a disabled Use does nothing');
  assertEqual(app.useBuiltState(), false, 'and neither does calling it directly');
  app.placeCity(next);
  assertEqual(app.builder.result.ok, true, 'two cities build again');
  assert(!q(root, 'build-use').disabled, 'Use is back');
  cleanup();
});

const searchOf = () => new URL(window.location.href).searchParams;
const INVALID_LINK_MESSAGE = "That custom map link isn't valid, so here is a new random map.";

test('a used custom state is in the address and reloads identically from it (US4)', async () => {
  const originalUrl = window.location.href;
  const first = await builtApp({}, 3);
  first.app.setBuilderSettings({ shareA: 380, cityLean: -20 });
  [30000, 120000, 300000].forEach((pop, i) => first.app.setCityPopulation(i, pop));
  click(q(first.root, 'build-use'));
  const code = first.app.state.seed;
  assert(/^v2\./.test(code), `state carries its code (${code})`);
  assertEqual(code.split('.')[4].split('-').map((city) => city.split('_')[2]), ['3', '12', '30'], 'the code carries each city\'s population');
  assertEqual(searchOf().get('custom'), code, 'the address carries the code');
  assertEqual(searchOf().get('seed'), null, 'and no seed');
  const link = q(first.root, 'state-caption').querySelector('a');
  assertEqual(link.textContent, 'custom map link');
  assertEqual(link.getAttribute('href'), `?custom=${encodeURIComponent(code)}`);
  assert(/^A custom state · \d+ precincts · \d+ districts · /.test(q(first.root, 'state-caption').textContent));
  const keep = (app, root) => ({
    precincts: app.state.precincts.map((c) => [c.name, c.sideAVoters, c.sideBVoters, c.area, c.type]),
    plan: app.state.plan,
    totals: q(root, 'state-totals').innerHTML,
    reference: app.state.referencePlan,
  });
  const original = keep(first.app, first.root);
  first.cleanup();

  const again = await mount('demo-1', { custom: code });
  assertEqual(again.app.state.custom, true, 'the custom state wins over a seed');
  assertEqual(again.app.mode, 'view');
  assertEqual(keep(again.app, again.root), original, 'the same cities, sizes, precincts, voters, and statewide numbers');
  assertEqual(again.app.state.plan.cities.map((c) => c.pop), [30000, 120000, 300000], 'each city keeps its size');
  assert(q(again.root, 'edit-message').hidden, 'no message for a good link');
  again.cleanup();
  window.history.replaceState(null, '', originalUrl);
});

test('an invalid or unbuildable custom link shows a friendly message and a random map (US4)', async () => {
  for (const bad of ['v1.nope', 'v1.x.999.0.0', 'garbage', 'v1.abc.500.50.0_0', 'v2.abc.500.50.0_0_10', 'v2.abc.500.50.200_200_0', 'v2.abc.500.50.200_200_31', 'v2.abc.500.50.200_200']) {
    const { root, app, cleanup } = await mount('demo-1', { custom: bad });
    assert(!app.state.custom, `"${bad}" falls back to a random state`);
    assertEqual(app.state.seed, 'demo-1', 'the seed in the address is used when there is one');
    assertEqual(q(root, 'edit-message').textContent, INVALID_LINK_MESSAGE, `message for "${bad}"`);
    assert(!q(root, 'edit-message').hidden, 'the message is visible');
    cleanup();
  }
  const good = encodeCustomCode(createPlan({ outlineSeed: 'abc12' }));
  const { root, app, cleanup } = await mount(undefined, { custom: good, buildState: () => ({ ok: false, reason: 'layout' }) });
  assert(!app.state.custom, 'a link that cannot be built also falls back');
  assertEqual(q(root, 'edit-message').textContent, INVALID_LINK_MESSAGE);
  cleanup();
});

test('an old version 1 link opens with every city at 100,000 voters, and a version 1 link that does not fit shows the message (US5)', async () => {
  const originalUrl = window.location.href;
  let code = null;
  for (const outlineSeed of ['abc12', 'abc13', 'abc14', 'abc15', 'abc16']) {
    const plan = createPlan({ outlineSeed });
    const [first, second] = citySpots(plan, 2, 80, 120);
    if (first && second && buildCustomState(addCity(addCity(plan, first), second)).ok) {
      code = `v1.${outlineSeed}.500.50.${first.x}_${first.y}-${second.x}_${second.y}`;
      break;
    }
  }
  assert(code, 'a buildable version 1 link was found');
  const { app, cleanup } = await mount('demo-1', { custom: code });
  assertEqual(app.state.custom, true, 'the old link opens');
  assertEqual(app.state.plan.cities.map((c) => c.pop), [100000, 100000], 'every city has 100,000 voters');
  assert(app.state.seed.startsWith('v2.'), 'it is now shown as a version 2 code');
  cleanup();
  const bad = await mount('demo-1', { custom: 'v1.abc12.500.50.0_0' });
  assert(!bad.app.state.custom, 'a city outside the outline falls back to a random state');
  assertEqual(q(bad.root, 'edit-message').textContent, INVALID_LINK_MESSAGE);
  bad.cleanup();
  window.history.replaceState(null, '', originalUrl);
});

test('New map after a custom link puts a seed back in the address (US4)', async () => {
  const originalUrl = window.location.href;
  const { app, cleanup } = await builtApp({}, 2);
  app.useBuiltState();
  assert(searchOf().get('custom'), 'custom is in the address');
  app.newMap();
  assertEqual(searchOf().get('custom'), null, 'the custom code is gone');
  assertEqual(searchOf().get('seed'), app.state.seed, 'the seed is in the address');
  cleanup();
  window.history.replaceState(null, '', originalUrl);
});

test('Clear cities removes every city and resets both settings, after a confirmation (US4)', async () => {
  const asked = [];
  let answer = true;
  const { root, app, cleanup } = await builtApp({ confirm: (text) => { asked.push(text); return answer; } }, 3);
  app.setBuilderSettings({ shareA: 420, cityLean: -30 });
  answer = false;
  click(q(root, 'build-clear'));
  assertEqual(asked, ['Clear all cities and reset the voter settings?']);
  assertEqual(app.builder.plan.cities.length, 3, 'declining keeps the cities');
  assertEqual([app.builder.plan.shareA, app.builder.plan.cityLean], [420, -30], 'and the settings');
  answer = true;
  const outlineSeed = app.builder.plan.outlineSeed;
  click(q(root, 'build-clear'));
  assertEqual(asked.length, 2);
  assertEqual(app.builder.plan.cities, [], 'all cities gone');
  assertEqual([app.builder.plan.shareA, app.builder.plan.cityLean], [500, 50], 'settings are back to their defaults');
  assertEqual(app.builder.plan.outlineSeed, outlineSeed, 'the outline stays');
  assertEqual(cityMarkers(root).length, 0);
  assertEqual(q(root, 'city-count').textContent, 'Cities: 0 of 12');
  assertEqual(q(root, 'share-slider').value, '50');
  assertEqual(q(root, 'lean-slider').value, '50');
  assert(app.builder.result.ok, 'an empty plan builds');
  click(q(root, 'build-clear'));
  assertEqual(asked.length, 2, 'nothing to confirm when there are no cities');
  cleanup();
});

test('New outline replaces the outline and removes cities that fall outside it, saying how many (US4)', async () => {
  const buildable = (seed) => buildCustomState(createPlan({ outlineSeed: seed })).ok;
  const seeds = ['osa', 'osb', 'osc', 'osd', 'ose', 'osf', 'osg', 'osh'].filter(buildable);
  assert(seeds.length >= 3, 'enough outlines build');
  const [first, second, third] = seeds;
  // A spot inside the first outline but outside the second, and one inside both.
  const inside = (seed, x, y) => checkCityPlacement(createPlan({ outlineSeed: seed }), { x, y }).ok;
  let outsideSecond = null;
  let insideBoth = null;
  for (let y = 40; y < 580; y += 10) {
    for (let x = 40; x < 780; x += 10) {
      if (!outsideSecond && inside(first, x, y) && !inside(second, x, y)) outsideSecond = { x, y };
      if (!insideBoth && inside(first, x, y) && inside(second, x, y) && inside(third, x, y)) insideBoth = { x, y };
    }
  }
  assert(outsideSecond && insideBoth, 'the outlines differ enough to test');
  const queue = [first, second, third];
  const { root, app, cleanup } = await mount('demo-1', { makeOutlineSeed: () => queue.shift() });
  click(q(root, 'build-state'));
  assertEqual(app.builder.plan.outlineSeed, first);
  app.setBuilderSettings({ shareA: 440, cityLean: 20 });
  app.placeCity(insideBoth);
  const farAway = (p) => Math.hypot(p.x - insideBoth.x, p.y - insideBoth.y) >= 100;
  if (farAway(outsideSecond)) app.placeCity(outsideSecond);
  const placed = app.builder.plan.cities.length;
  const expectedRemoved = placed - app.builder.plan.cities.filter((c) => inside(second, c.x, c.y)).length;
  click(q(root, 'build-outline'));
  assertEqual(app.builder.plan.outlineSeed, second, 'a new outline');
  assertEqual([app.builder.plan.shareA, app.builder.plan.cityLean], [440, 20], 'the voter settings are kept');
  assert(app.builder.plan.cities.every((c) => inside(second, c.x, c.y)), 'every kept city fits the new outline');
  assertEqual(app.builder.plan.cities.length, placed - expectedRemoved);
  assert(app.builder.result.ok, 'the new outline builds');
  const message = q(root, 'build-message').textContent;
  assertEqual(message, expectedRemoved ? `New outline. ${expectedRemoved} ${expectedRemoved === 1 ? 'city' : 'cities'} outside it ${expectedRemoved === 1 ? 'was' : 'were'} removed.` : 'New outline.');
  if (farAway(outsideSecond)) assertEqual(expectedRemoved, 1, 'the city outside the new outline was removed');
  assertEqual(cityMarkers(root).length, app.builder.plan.cities.length, 'markers match the plan');

  click(q(root, 'build-outline'));
  assertEqual(app.builder.plan.outlineSeed, third);
  assert(app.builder.plan.cities.length <= placed, 'cities are never added');
  cleanup();
});

// --- Precincts instead of counties (010, US1) ---------------------------------------------------------------------

// Every visible text and accessible name on the page.
function pageWords(root) {
  const words = [root.textContent];
  for (const el of root.querySelectorAll('[aria-label], [title], [placeholder]')) words.push(el.getAttribute('aria-label') ?? '', el.getAttribute('title') ?? '', el.getAttribute('placeholder') ?? '');
  return words.join(' ');
}

test('a state is drawn in 500-800 precincts and the page never mentions counties (010 FR-001, FR-002, SC-001)', async () => {
  const { root, app, cleanup } = await mount();
  const total = app.state.precincts.length;
  assert(total >= 500 && total <= 800, `${total} precincts`);
  assertEqual(root.querySelectorAll('.precinct').length, total, 'one path per precinct');
  assert(new RegExp(`${total} precincts · ${app.state.districtCount} districts`).test(q(root, 'state-caption').textContent), 'the caption counts precincts');
  assert(!/count(y|ies)/i.test(pageWords(root)), 'no county on the page');
  app.setEditing(1);
  assert(!/count(y|ies)/i.test(pageWords(root)), 'no county while editing');
  click(q(root, 'build-state'));
  assert(!/count(y|ies)/i.test(pageWords(root)), 'no county while building');
  cleanup();
});

test('a district with many precincts lists only a few names and counts the rest (010 spec assumption)', async () => {
  const { root, app, cleanup } = await mount();
  const ids = connectedOrder(app.state, app.state.precincts[0].id, 20);
  app.setEditing(2);
  for (const id of ids) click(app.mapView.getPrecinctElement(id));
  const row = app.districtList.getRow(2);
  focusEl(row);
  const list = q(root, 'tooltip').querySelector('.tt-precincts').textContent;
  assertEqual(list.split(', ').length, 9, 'eight names plus the "and N more" part');
  assert(/, and 12 more$/.test(list), `the list ends "and 12 more": ${list}`);
  const few = connectedOrder(app.state, app.state.precincts[0].id, 3);
  app.setAssignments(Object.fromEntries(app.state.precincts.map((p) => [p.id, few.includes(p.id) ? 2 : null])));
  focusEl(row);
  assert(!/more$/.test(q(root, 'tooltip').querySelector('.tt-precincts').textContent), 'a small district lists every name');
  cleanup();
});

test('arrow keys move focus between neighboring precincts, and one precinct is the tab stop (010 FR-008, SC-009)', async () => {
  const { app, cleanup } = await mount();
  const tabStops = () => app.state.precincts.filter((p) => app.mapView.getPrecinctElement(p.id).getAttribute('tabindex') === '0');
  const center = (p) => p.center ?? p.seedPoint;
  // Start at the leftmost precinct so there is a long way to walk to the right.
  const start = [...app.state.precincts].sort((a, b) => center(a)[0] - center(b)[0])[0];
  const startPath = app.mapView.getPrecinctElement(start.id);
  focusEl(startPath);
  let current = start;
  let movedRight = 0;
  for (let i = 0; i < 400; i += 1) {
    const before = document.activeElement;
    key(before, 'ArrowRight');
    const after = document.activeElement;
    if (after === before) break;
    const next = app.state.precinctsById.get(after.dataset.precinctId);
    assert(current.neighbors.includes(next.id), 'each arrow moves to a neighbor');
    assert(center(next)[0] > center(current)[0], 'ArrowRight moves rightward');
    current = next;
    movedRight += 1;
  }
  assert(movedRight >= 12, `ArrowRight walked across ${movedRight} precincts`);
  assertEqual(tabStops().map((p) => p.id), [current.id], 'the tab stop follows focus');
  const down = document.activeElement;
  key(down, 'ArrowDown');
  assert(document.activeElement === down || center(app.state.precinctsById.get(document.activeElement.dataset.precinctId))[1] > center(current)[1], 'ArrowDown moves downward');
  cleanup();
});

test('every border between precincts of different districts is drawn (010 R14)', async () => {
  const { app, cleanup } = await mount();
  loadPlan(app);
  let different = 0;
  for (const precinct of app.state.precincts) {
    for (const n of precinct.neighbors) {
      if (n > precinct.id && app.state.assignments[n] !== app.state.assignments[precinct.id]) different += 1;
    }
  }
  const root = document.getElementById('fixture');
  const drawn = root.querySelector('[data-role="district-borders"]').getAttribute('d').split('M').length - 1;
  assert(different > 0, 'the plan has district borders');
  assertEqual(drawn, different, 'one drawn segment for every border between districts');
  cleanup();
});

// --- The brush (010, US2 and US3) ---------------------------------------------------------------------------------

const clientOf = (svg, [x, y]) => {
  const p = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM());
  return { clientX: p.x, clientY: p.y };
};
const svgPointer = (svg, type, point, { shiftKey = false, pointerType = 'mouse', pointerId = 1 } = {}) => {
  svg.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, pointerType, button: 0, shiftKey, ...clientOf(svg, point) }));
};
// A press, some moves, and a release at map coordinates.
function drag(svg, points, options = {}) {
  svgPointer(svg, 'pointerdown', points[0], options);
  for (const point of points.slice(1)) svgPointer(svg, 'pointermove', point, options);
  svgPointer(svg, 'pointerup', points[points.length - 1], options);
}
const centerOf = (precinct) => precinct.center ?? precinct.seedPoint;
const membersOf = (app, district) => app.state.precincts.filter((p) => app.state.assignments[p.id] === district).map((p) => p.id);
const brushOn = (root, app, district = 1) => {
  app.setEditing(district);
  click(q(root, 'brush-toggle'));
};
const circleOf = (root) => q(root, 'brush-circle');

test('the Brush section is disabled with a hint until a district is selected, and hidden while building (010 FR-012, FR-013, FR-014, FR-015)', async () => {
  const { root, app, cleanup } = await mount();
  const toggle = q(root, 'brush-toggle');
  const size = q(root, 'brush-size');
  assert(toggle.disabled && size.disabled, 'the controls are disabled');
  assert([...root.querySelectorAll('input[name="brush-mode"]')].every((r) => r.disabled), 'the mode choice is disabled');
  assert(q(root, 'brush-hint').textContent.includes("Pick a district's pen"), 'the hint says to pick a pen');
  app.setEditing(1);
  assert(!toggle.disabled && !size.disabled, 'selecting a district enables them');
  assertEqual(toggle.getAttribute('aria-pressed'), 'false', 'the brush starts off');
  assertEqual([size.min, size.max, size.step, size.value], ['10', '150', '5', '50']);
  assertEqual(q(root, 'brush-size-output').textContent, '50');
  assertEqual(root.querySelector('input[name="brush-mode"]:checked').value, 'add', 'Add is the default');
  assert(root.querySelector('label[for="brush-size"]').textContent.includes('Brush size'), 'the slider has a label');
  assert(root.querySelector('[data-role="brush-mode"] legend').textContent.includes('Brush mode'), 'the mode choice has a legend');
  click(q(root, 'build-state'));
  assert(getComputedStyle(q(root, 'brush-tool')).display === 'none', 'hidden while building');
  cleanup();
});

test('the brush circle follows the pointer, resizes with the slider, and shows Add or Erase (010 FR-016, FR-019)', async () => {
  const { root, app, cleanup } = await mount();
  const svg = q(root, 'map');
  brushOn(root, app);
  assertEqual(q(root, 'brush-toggle').getAttribute('aria-pressed'), 'true');
  const circle = circleOf(root);
  svgPointer(svg, 'pointermove', [300, 250]);
  assert(circle.style.display !== 'none', 'the circle shows over the map');
  assert(Math.abs(Number(circle.getAttribute('cx')) - 300) < 1 && Math.abs(Number(circle.getAttribute('cy')) - 250) < 1, 'it sits at the pointer');
  assertEqual(Number(circle.getAttribute('r')), 50, 'default size');
  svgPointer(svg, 'pointermove', [420, 300]);
  assert(Math.abs(Number(circle.getAttribute('cx')) - 420) < 1, 'it follows');
  const size = q(root, 'brush-size');
  size.value = '100';
  size.dispatchEvent(new Event('input', { bubbles: true }));
  assertEqual(Number(circle.getAttribute('r')), 100, 'the circle resizes at once');
  assertEqual(q(root, 'brush-size-output').textContent, '100');
  assertEqual(circle.dataset.mode, 'add');
  const erase = root.querySelector('input[name="brush-mode"][value="erase"]');
  erase.checked = true;
  erase.dispatchEvent(new Event('change', { bubbles: true }));
  assertEqual(circle.dataset.mode, 'erase');
  svgPointer(svg, 'pointermove', [420, 300], { shiftKey: true });
  assertEqual(circle.dataset.mode, 'add', 'Shift shows the other mode');
  svg.dispatchEvent(new PointerEvent('pointerleave', { bubbles: false }));
  assertEqual(circle.style.display, 'none', 'the circle hides when the pointer leaves');
  cleanup();
});

test('a click with the brush paints every covered precinct and updates the page (010 FR-017, FR-026)', async () => {
  const { root, app, cleanup } = await mount();
  const svg = q(root, 'map');
  brushOn(root, app);
  const middle = app.state.precincts[Math.floor(app.state.precincts.length / 2)];
  const point = centerOf(middle);
  const covered = precinctsInCapsule(app.state, point, point, 50);
  drag(svg, [point]);
  const members = membersOf(app, 1);
  assert(members.length >= 2 && members.every((id) => covered.includes(id)), `${members.length} precincts painted from ${covered.length} covered`);
  assert(members.includes(covered[0]), 'the nearest precinct is in');
  assertEqual(app.state.districts[0].components.length, 1, 'one connected piece');
  assert(app.districtList.getRow(1).dataset.status !== 'empty', 'the district list updates');
  assert(root.querySelectorAll('.badge').length === 1, 'the badge appears');
  assert(/^Added \d+ precincts?/.test(q(root, 'brush-message').textContent), q(root, 'brush-message').textContent);
  assertEqual(root.querySelectorAll('.precinct:not(.unassigned)').length, members.length, 'the map marks the painted precincts');
  cleanup();
});

test('dragging paints a strip with no gaps even when the pointer jumps (010 FR-018)', async () => {
  const { root, app, cleanup } = await mount();
  const svg = q(root, 'map');
  brushOn(root, app, 2);
  q(root, 'brush-size').value = '35';
  q(root, 'brush-size').dispatchEvent(new Event('input', { bubbles: true }));
  const a = centerOf(app.state.precincts[120]);
  const b = [a[0] + 260, a[1] + 40];
  drag(svg, [a, b]);
  const covered = precinctsInCapsule(app.state, a, b, 35);
  const members = new Set(membersOf(app, 2));
  const inStrip = covered.filter((id) => members.has(id)).length;
  assert(inStrip >= 0.9 * covered.length, `${inStrip} of ${covered.length} precincts in the strip were painted`);
  assertEqual(app.state.districts[1].components.length, 1, 'the strip is one piece');
  cleanup();
});

test('Shift and the Erase choice take precincts out of the selected district (010 FR-019)', async () => {
  const { root, app, cleanup } = await mount();
  const svg = q(root, 'map');
  brushOn(root, app);
  const point = centerOf(app.state.precincts[200]);
  drag(svg, [point]);
  const painted = membersOf(app, 1).length;
  assert(painted > 2, 'a district to trim');
  drag(svg, [point], { shiftKey: true });
  assert(membersOf(app, 1).length < painted, 'Shift erased');
  assert(/^Removed/.test(q(root, 'brush-message').textContent), q(root, 'brush-message').textContent);
  drag(svg, [point]);
  const again = membersOf(app, 1).length;
  const erase = root.querySelector('input[name="brush-mode"][value="erase"]');
  erase.checked = true;
  erase.dispatchEvent(new Event('change', { bubbles: true }));
  drag(svg, [point]);
  assert(membersOf(app, 1).length < again, 'the Erase choice erased');
  assert(app.state.districts[0].components.length <= 1, 'the district stays in one piece');
  cleanup();
});

test('Escape turns the brush off first and then stops editing; the circle goes away (010 FR-027)', async () => {
  const { root, app, cleanup } = await mount();
  const svg = q(root, 'map');
  brushOn(root, app);
  svgPointer(svg, 'pointermove', [300, 250]);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assertEqual(app.brush.on, false, 'the brush is off');
  assertEqual(q(root, 'brush-toggle').getAttribute('aria-pressed'), 'false');
  assertEqual(circleOf(root).style.display, 'none', 'the circle is gone');
  assertEqual(app.editingDistrict, 1, 'still editing the district');
  const id = app.state.precincts[5].id;
  click(app.mapView.getPrecinctElement(id));
  assertEqual(app.state.assignments[id], 1, 'clicks add one precinct at a time again');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assertEqual(app.editingDistrict, null, 'the second Escape stops editing');
  assert(q(root, 'brush-toggle').disabled, 'the brush is unavailable again');
  cleanup();
});

test('a stroke reports one message when it ends, not one per step (010 FR-025)', async () => {
  const { root, app, cleanup } = await mount();
  const svg = q(root, 'map');
  brushOn(root, app);
  const message = q(root, 'brush-message');
  const observer = new MutationObserver(() => {});
  observer.observe(message, { childList: true, characterData: true, subtree: true });
  const a = centerOf(app.state.precincts[150]);
  const path = Array.from({ length: 20 }, (_, i) => [a[0] + i * 8, a[1] + i * 3]);
  svgPointer(svg, 'pointerdown', path[0]);
  for (const point of path.slice(1)) svgPointer(svg, 'pointermove', point);
  assertEqual(observer.takeRecords().length, 0, 'no message while dragging');
  svgPointer(svg, 'pointerup', path[path.length - 1]);
  assertEqual(observer.takeRecords().length, 1, 'one message at release');
  assert(/^Added/.test(message.textContent), message.textContent);
  observer.disconnect();
  cleanup();
});

test('a stroke that cannot change anything says so, and one outside the state finds no precincts (010 FR-025)', async () => {
  const { root, app, cleanup } = await mount();
  const svg = q(root, 'map');
  brushOn(root, app);
  const point = centerOf(app.state.precincts[150]);
  drag(svg, [point]);
  drag(svg, [point]);
  assert(/^No precincts were changed: .*already in District 1\.$/.test(q(root, 'brush-message').textContent), q(root, 'brush-message').textContent);
  drag(svg, [[2, 2]]);
  assertEqual(q(root, 'brush-message').textContent, 'No precincts under the brush.');
  cleanup();
});

test('no details pop-up appears while a drag is in progress (010 FR-028)', async () => {
  const { root, app, cleanup } = await mount();
  const svg = q(root, 'map');
  brushOn(root, app);
  const target = app.mapView.getPrecinctElement(app.state.precincts[60].id);
  pointer(target, 'pointerover');
  assert(!q(root, 'tooltip').hidden, 'hovering shows details before the stroke');
  svgPointer(svg, 'pointerdown', centerOf(app.state.precincts[60]));
  assert(q(root, 'tooltip').hidden, 'the pop-up is hidden when the stroke starts');
  pointer(app.mapView.getPrecinctElement(app.state.precincts[61].id), 'pointerover');
  assert(q(root, 'tooltip').hidden, 'and stays hidden while dragging');
  assert(!root.querySelector('[data-role="precinct-highlight"]').getAttribute('d'), 'no highlight');
  svgPointer(svg, 'pointerup', centerOf(app.state.precincts[60]));
  pointer(app.mapView.getPrecinctElement(app.state.precincts[62].id), 'pointerover');
  assert(!q(root, 'tooltip').hidden, 'details come back after the stroke');
  cleanup();
});

test('Enter on a focused precinct paints at it with the brush on, and Shift flips the mode (010 FR-017, R12)', async () => {
  const { root, app, cleanup } = await mount();
  brushOn(root, app, 3);
  const precinct = app.state.precincts[250];
  const path = app.mapView.getPrecinctElement(precinct.id);
  focusEl(path);
  key(path, 'Enter');
  assertEqual(app.state.assignments[precinct.id], 3, 'the focused precinct was painted');
  const painted = membersOf(app, 3).length;
  assert(painted >= 2, 'the brush painted around it');
  assert(/^Added/.test(q(root, 'brush-message').textContent));
  path.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
  assert(membersOf(app, 3).length < painted, 'Shift+Enter erased');
  cleanup();
});

test('a stroke ends cleanly on Escape, and the brush resets with a new map but not when switching districts (010 FR-027, FR-030)', async () => {
  const { root, app, cleanup } = await mount('demo-1', { confirm: () => true });
  const svg = q(root, 'map');
  brushOn(root, app);
  svgPointer(svg, 'pointerdown', centerOf(app.state.precincts[90]));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assertEqual(app.brush.on, false, 'Escape during a stroke turns the brush off');
  assert(q(root, 'brush-message').textContent.length > 0, 'the stroke was summarized');
  svgPointer(svg, 'pointermove', centerOf(app.state.precincts[91]));
  assertEqual(circleOf(root).style.display, 'none', 'no circle after it');
  click(q(root, 'brush-toggle'));
  app.setBrush({ on: true, size: 80, mode: 'erase' });
  app.setEditing(4);
  assertEqual([app.brush.on, app.brush.size, app.brush.mode], [true, 80, 'erase'], 'switching districts keeps the brush');
  app.setEditing(null);
  assertEqual(app.brush.on, false, 'deselecting turns it off');
  assertEqual([app.brush.size, app.brush.mode], [80, 'erase'], 'the size and mode are remembered');
  app.newMap();
  assertEqual([app.brush.on, app.brush.size, app.brush.mode], [false, 50, 'add'], 'a new map resets the brush');
  assertEqual(q(root, 'brush-size').value, '50');
  cleanup();
});

test('the brush works with touch and does not scroll the page while it is on (010 FR-029)', async () => {
  const { root, app, cleanup } = await mount();
  const svg = q(root, 'map');
  assertEqual(svg.style.touchAction, '', 'normal scrolling with the brush off');
  brushOn(root, app);
  assertEqual(svg.style.touchAction, 'none', 'no scrolling while the brush is on');
  const a = centerOf(app.state.precincts[100]);
  drag(svg, [a, [a[0] + 40, a[1]]], { pointerType: 'touch', pointerId: 7 });
  assert(membersOf(app, 1).length > 1, 'a touch drag painted');
  click(q(root, 'brush-toggle'));
  assertEqual(svg.style.touchAction, '', 'scrolling is back when the brush is off');
  cleanup();
});

test('automation hooks run a click or a drag the same way as the pointer (010 contract)', async () => {
  const { root, app, cleanup } = await mount();
  brushOn(root, app, 5);
  const a = centerOf(app.state.precincts[300]);
  const tap = app.strokeAt(a);
  assert(tap.added > 0 && /^Added/.test(q(root, 'brush-message').textContent), 'strokeAt paints');
  const drawn = app.dragBrush([a, [a[0] + 50, a[1]], [a[0] + 100, a[1] + 20]]);
  assertEqual(drawn.covered > 0, true, 'dragBrush reports its summary');
  assertEqual(app.state.districts[4].components.length, 1);
  cleanup();
});

// ---- Feature 013: "Only unclaimed precincts" -----------------------------------------------------------------------------

// District 1 painted around one precinct (option off), district 2 holding one unclaimed precinct next to it, district 2 selected.
function neighborDistricts(app) {
  app.setEditing(1);
  app.setBrush({ on: true, size: 50, mode: 'add', unclaimedOnly: false });
  app.strokeAt(centerOf(app.state.precincts[100]));
  const owned = membersOf(app, 1);
  const touching = owned.flatMap((id) => app.state.precinctsById.get(id).neighbors).find((id) => app.state.assignments[id] === null);
  app.setEditing(2);
  app.setBrush({ on: false });
  app.editPrecinct(touching);
  app.setBrush({ on: true });
  return { owned, touching, center: centerOf(app.state.precincts[100]) };
}

const unclaimedBox = (root) => q(root, 'brush-unclaimed');
const pickMode = (root, mode) => click(root.querySelector(`input[name="brush-mode"][value="${mode}"]`));

test('the "Only unclaimed precincts" box is labelled, off by default, and available only while adding (013 FR-001, FR-006, FR-007)', async () => {
  const { root, app, cleanup } = await mount();
  const box = unclaimedBox(root);
  assertEqual(box.type, 'checkbox', 'a native checkbox, so Space and touch work');
  assertEqual(box.labels[0].textContent.trim(), 'Only unclaimed precincts');
  assertEqual(box.checked, false, 'off by default');
  assert(box.disabled, 'unavailable until a district is selected');
  app.setEditing(1);
  assert(!box.disabled && box.tabIndex >= 0, 'available and in the tab order once a district is selected');
  click(box);
  assertEqual([box.checked, app.brush.unclaimedOnly], [true, true], 'a click turns it on');
  click(box);
  assertEqual([box.checked, app.brush.unclaimedOnly], [false, false], 'and off');
  click(box);
  const before = box.getBoundingClientRect();
  pickMode(root, 'erase');
  assert(box.disabled, 'unavailable in erase mode');
  assertEqual(box.checked, true, 'but it keeps its setting');
  assertEqual(box.title, 'Applies when adding');
  assertEqual(document.getElementById(box.getAttribute('aria-describedby')).textContent.trim(), 'Applies to Add only', 'described for screen readers');
  const during = box.getBoundingClientRect();
  assertEqual([during.left, during.top, during.width, during.height], [before.left, before.top, before.width, before.height], 'it stays in the same place');
  pickMode(root, 'add');
  assert(!box.disabled && box.checked && !box.hasAttribute('title') && !box.hasAttribute('aria-describedby'), 'back in add mode it is available again, with its old state and no erase note');
  cleanup();
});

test('with the box ticked a drag leaves every other district alone, and with it off the same drag takes precincts (013 FR-002, FR-004, FR-005, FR-012)', async () => {
  const { root, app, cleanup } = await mount('demo-1');
  const { owned, center, touching } = neighborDistricts(app);
  const edge = centerOf(app.state.precinctsById.get(touching));
  const path = [center, edge, [edge[0] + (edge[0] - center[0]) * 0.6, edge[1] + (edge[1] - center[1]) * 0.6]];
  const statusBefore = q(root, 'plan-status').textContent;
  click(unclaimedBox(root));
  app.dragBrush(path);
  assertEqual(membersOf(app, 1), owned, 'district 1 kept every precinct');
  assert(membersOf(app, 2).length > 1, 'district 2 grew into unclaimed land');
  assert(q(root, 'plan-status').textContent !== statusBefore, 'the plan check changed');
  assert(/already in another district/.test(q(root, 'brush-message').textContent), q(root, 'brush-message').textContent);
  click(unclaimedBox(root));
  app.dragBrush(path);
  assert(membersOf(app, 1).length < owned.length, 'with the box off the brush takes precincts from district 1');
  cleanup();
});

test('Enter on a focused precinct and the Shift key follow the box exactly like a click (013 FR-005, FR-006)', async () => {
  const { root, app, cleanup } = await mount('demo-1');
  const { owned } = neighborDistricts(app);
  click(unclaimedBox(root));
  const claimed = owned[0];
  const path = app.mapView.getPrecinctElement(claimed);
  focusEl(path);
  key(path, 'Enter');
  assertEqual(membersOf(app, 1), owned, 'Enter on a claimed precinct leaves district 1 alone');
  const mineBefore = membersOf(app, 2);
  app.dragBrush([centerOf(app.state.precinctsById.get(claimed))], { shiftKey: true });
  assert(membersOf(app, 2).length <= mineBefore.length, 'with Add chosen, Shift makes the stroke erase, and the box has no effect on it');
  assertEqual(membersOf(app, 1), owned, 'district 1 is still untouched');
  app.setBrush({ mode: 'erase' });
  app.dragBrush([centerOf(app.state.precinctsById.get(claimed))], { shiftKey: true });
  assertEqual(membersOf(app, 1), owned, 'with Erase chosen, Shift makes the stroke add, and the stored box still protects district 1');
  cleanup();
});

test('single clicks with the brush off still take a precinct from another district, whatever the box says (013 FR-010)', async () => {
  const { root, app, cleanup } = await mount('demo-1');
  const { owned, touching } = neighborDistricts(app);
  click(unclaimedBox(root));
  app.setBrush({ on: false });
  const movable = owned.filter((id) => app.state.precinctsById.get(id).neighbors.includes(touching));
  let moved = false;
  for (const id of movable) {
    app.editPrecinct(id);
    if (app.state.assignments[id] === 2) {
      moved = true;
      break;
    }
  }
  assert(moved, 'a click moved a precinct from district 1 to district 2 with the box ticked');
  cleanup();
});

test('the box is remembered across selections, brush and matchup changes, and reset by a new map or a loaded state (013 FR-008, SC-007)', async () => {
  const { root, app, cleanup } = await mount('demo-1', { confirm: () => true });
  const box = unclaimedBox(root);
  app.setEditing(1);
  click(box);
  for (let i = 0; i < 10; i += 1) {
    app.setEditing((i % 4) + 1);
    assertEqual([box.checked, app.brush.unclaimedOnly], [true, true], `still on after selecting district ${(i % 4) + 1}`);
  }
  click(q(root, 'brush-toggle'));
  click(q(root, 'brush-toggle'));
  app.setBrush({ size: 90 });
  click(q(root, 'matchup-toggle'));
  app.setEditing(null);
  app.setEditing(2);
  assertEqual([box.checked, app.brush.unclaimedOnly], [true, true], 'on after brush off and on, a size change, a matchup change and a deselect');
  app.newMap();
  assertEqual([box.checked, app.brush.unclaimedOnly], [false, false], 'a new map resets it');
  app.setEditing(1);
  click(box);
  app.load('demo-2');
  assertEqual([box.checked, app.brush.unclaimedOnly], [false, false], 'loading a state resets it');
  cleanup();
});

test('a stroke message replaces the hint in the notes cell and the hint returns when it is cleared (013 FR-009, FR-013)', async () => {
  const { root, app, cleanup } = await mount('demo-1');
  const hint = q(root, 'brush-hint');
  const message = q(root, 'brush-message');
  assert(!hint.hidden, 'the hint shows before any stroke');
  const { center } = neighborDistricts(app);
  assertEqual(hint.textContent, 'Click or drag on the map. Hold Shift to swap Add and Erase.');
  click(unclaimedBox(root));
  app.strokeAt(center);
  assert(message.textContent.length > 0 && hint.hidden, 'the message is shown and the hint steps aside');
  assert(/^No precincts were changed: .*already in another district\.$|^Added .*already in another district/.test(message.textContent), message.textContent);
  app.setBrush({ on: false });
  assertEqual(message.textContent, '', 'turning the brush off clears the message');
  assert(!hint.hidden, 'and the hint returns');
  cleanup();
});
