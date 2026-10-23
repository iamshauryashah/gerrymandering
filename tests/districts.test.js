import { test, assert, assertEqual, assertThrows } from './test-runner.js';
import { generateState } from './fixtures.js';
import {
  applyPrecinctEdit,
  countUnassigned,
  getBalance,
  getControlTotal,
  getEditAction,
  getPlanStatus,
  isContiguous,
  reassignPrecinct,
  summarizeDistrict,
  summarizeDistricts,
} from '../src/districts.js';
import { pointInPolygon } from '../src/geometry.js';

const base = () => generateState({ seed: 'demo-1' });

function withPlan(state, plan = state.referencePlan) {
  const next = { ...state, assignments: { ...plan } };
  next.districts = summarizeDistricts(next);
  return next;
}

// Finds three precincts a-b-c where b touches both a and c but a and c do not touch.
function findPath(state) {
  for (const b of state.precincts) {
    for (const a of b.neighbors) {
      for (const c of b.neighbors) {
        if (a < c && !state.precinctsById.get(a).neighbors.includes(c)) return [a, b.id, c];
      }
    }
  }
  throw new Error('no path');
}

test('initial districts are consecutive, empty, and every precinct is unassigned', () => {
  const state = base();
  assertEqual(state.districts.map((d) => d.number), Array.from({ length: state.districtCount }, (_, i) => i + 1), 'numbers');
  for (const d of state.districts) assertEqual(d.precinctIds.length, 0, `district ${d.number} empty`);
  assertEqual(countUnassigned(state), state.precincts.length, 'all unassigned');
  const total = getControlTotal(state.districts, state);
  assertEqual(total, { sideA: 0, sideB: 0, tied: 0, empty: state.districtCount, unassigned: state.precincts.length });
});

test('district summaries sum voters and compute status, margin, components, and label points', () => {
  const state = withPlan(base());
  for (const d of state.districts) {
    const precincts = d.precinctIds.map((id) => state.precinctsById.get(id));
    const a = precincts.reduce((s, c) => s + c.sideAVoters, 0);
    const b = precincts.reduce((s, c) => s + c.sideBVoters, 0);
    assertEqual([d.sideAVoters, d.sideBVoters, d.totalVoters], [a, b, a + b], `district ${d.number} sums`);
    const expected = a > b ? 'sideA' : b > a ? 'sideB' : 'tie';
    assertEqual(d.status, expected, 'status');
    assert(Math.abs(d.marginPercent - (Math.abs(a - b) / (a + b)) * 100) < 1e-9, 'margin');
    assertEqual(d.components.length, 1, `reference district ${d.number} contiguous`);
    assert(d.labelPoint && pointInPolygon(d.labelPoint, state.outline), 'label point inside state');
    const ownerIndex = state.grid.owner[Math.floor(d.labelPoint[1] / 4) * state.grid.cols + Math.floor(d.labelPoint[0] / 4)];
    assertEqual(state.assignments[state.precincts[ownerIndex].id], d.number, 'label point inside district');
  }
  assertEqual(summarizeDistrict(state, 1).precinctIds, state.districts[0].precinctIds, 'single summary');
  assertThrows(() => summarizeDistrict(state, 0), /Invalid district number/);
});

test('reassignPrecinct adds and clears precincts immutably', () => {
  const state = base();
  const precinct = state.precincts[0];
  const next = reassignPrecinct(state, precinct.id, 2);
  assert(next !== state, 'new state object');
  assertEqual(state.assignments[precinct.id], null, 'original unchanged');
  assertEqual(next.districts[1].precinctIds, [precinct.id], 'added');
  assertEqual(countUnassigned(next), state.precincts.length - 1, 'one fewer unassigned');
  const cleared = reassignPrecinct(next, precinct.id, null);
  assertEqual(cleared.assignments[precinct.id], null, 'cleared');
  assertEqual(cleared.districts[1].status, 'empty', 'district empty again');
  assert(reassignPrecinct(cleared, precinct.id, null) === cleared, 'no-op returns same state');
  assertEqual(next.precincts, state.precincts, 'precincts shared');
});

test('reassignPrecinct rejects invalid precincts and districts', () => {
  const state = base();
  assertThrows(() => reassignPrecinct(state, 'nope', 1), /Invalid precinct ID/);
  assertThrows(() => reassignPrecinct(state, state.precincts[0].id, 0), /Invalid district number/);
  assertThrows(() => reassignPrecinct(state, state.precincts[0].id, state.districtCount + 1), /Invalid district number/);
  assertThrows(() => reassignPrecinct(state, state.precincts[0].id, '2'), /Invalid district number/);
});

test('edits add, move, and remove precincts while keeping districts connected', () => {
  let state = base();
  const [a, b, c] = findPath(state);
  const far = state.precincts.find((x) => x.id !== a && !x.neighbors.includes(a)).id;

  let edit = getEditAction(state, a, 1);
  assertEqual([edit.action, edit.allowed], ['add', true], 'first precinct can go anywhere');
  ({ state } = applyPrecinctEdit(state, a, 1));
  ({ state, edit } = applyPrecinctEdit(state, far, 1));
  assertEqual([edit.action, edit.allowed, edit.reason], ['add', false, 'not-adjacent'], 'non-touching precinct blocked');
  assertEqual(state.assignments[far], null, 'blocked precinct unchanged');
  ({ state } = applyPrecinctEdit(state, b, 1));
  ({ state } = applyPrecinctEdit(state, c, 1));
  assertEqual(state.districts[0].precinctIds.length, 3, 'three precincts added');

  ({ state, edit } = applyPrecinctEdit(state, b, 1));
  assertEqual([edit.action, edit.allowed, edit.reason], ['remove', false, 'split-selected'], 'removing the middle precinct is blocked');
  edit = getEditAction(state, b, 2);
  assertEqual([edit.action, edit.allowed, edit.reason], ['move', false, 'split-source'], 'taking the middle precinct is blocked');

  ({ state, edit } = applyPrecinctEdit(state, c, 2));
  assertEqual([edit.action, edit.from, edit.to, edit.allowed], ['move', 1, 2, true], 'end precinct can move');
  ({ state, edit } = applyPrecinctEdit(state, c, 2));
  assertEqual([edit.action, edit.allowed], ['remove', true], 'clicking again removes');
  assertEqual(state.assignments[c], null, 'precinct now has no district');
  assertEqual(state.districts[1].status, 'empty', 'district 2 empty');
  ({ state } = applyPrecinctEdit(state, a, 1));
  ({ state } = applyPrecinctEdit(state, b, 1));
  assertEqual(state.districts[0].status, 'empty', 'removing the last precincts empties the district');
  assert(state.districts.every((d) => d.components.length <= 1), 'never split');
});

test('isContiguous handles empty, single, and split sets', () => {
  const state = base();
  const [a, b, c] = findPath(state);
  assert(isContiguous(state, []), 'empty');
  assert(isContiguous(state, [a]), 'single');
  assert(isContiguous(state, [a, b, c]), 'path');
  assert(!isContiguous(state, [a, c]), 'split');
});

test('tie districts report tie with zero margin', () => {
  const state = base();
  const synthetic = {
    ...state,
    precincts: state.precincts.map((c, i) => (i < 2 ? { ...c, sideAVoters: i === 0 ? 100 : 50, sideBVoters: i === 0 ? 50 : 100, totalVoters: 150 } : c)),
  };
  synthetic.precinctsById = new Map(synthetic.precincts.map((c) => [c.id, c]));
  const assignments = Object.fromEntries(synthetic.precincts.map((c, i) => [c.id, i < 2 ? 1 : null]));
  const tied = summarizeDistricts({ ...synthetic, assignments })[0];
  assertEqual(tied.status, 'tie');
  assertEqual(tied.marginPercent, 0);
});

test('balance passes for the reference plan and fails when districts are empty or far apart', () => {
  const planned = withPlan(base());
  const balance = getBalance(planned);
  assert(balance.pass, `reference plan balanced (difference ${balance.difference})`);
  assertEqual(balance.ratio, 0.1);
  assertEqual(balance.ideal, Math.round(planned.totalVoters / planned.districtCount), 'ideal size');
  assert(balance.largest <= balance.smallest * 1.1, 'reference plan within 10%');
  const status = getPlanStatus(planned);
  assertEqual([status.valid, status.complete, status.contiguous, status.balanced, status.unassigned], [true, true, true, true, 0]);

  const empty = getBalance(base());
  assertEqual([empty.pass, empty.empty, empty.differencePercent], [false, base().districtCount, 0], 'empty districts fail');

  const synthetic = { districtCount: 4, totalVoters: 400000, balanceRatio: 0.1, precincts: [] };
  const make = (sizes) => sizes.map((v, i) => ({ number: i + 1, precinctIds: v ? ['x'] : [], totalVoters: v, components: v ? [['x']] : [] }));
  const exact = getBalance(synthetic, make([100000, 110000, 105000, 100000]));
  assertEqual([exact.pass, exact.difference, exact.differencePercent], [true, 10000, 10], 'exactly 10% passes');
  const over = getBalance(synthetic, make([100000, 111000, 105000, 100000]));
  assertEqual([over.pass, over.differencePercent], [false, 11], '11% fails');
  assertEqual(getBalance(synthetic, make([100000, 103333, 101000, 100500])).differencePercent, 3.3, 'one decimal');
  const withEmpty = getBalance(synthetic, make([100000, 100000, 100000, 0]));
  assertEqual([withEmpty.pass, withEmpty.empty], [false, 1], 'an empty district fails');

  const labels = getBalance(synthetic, make([110000, 90000, 100000, 0]));
  assertEqual(labels.districts.map((d) => d.balance), ['over', 'under', 'ok', 'empty'], 'labels');
  assertEqual(labels.districts[0].offset, 110000 - labels.upper, 'over offset measured from range edge');
  assertEqual(labels.districts[1].offset, 90000 - labels.lower, 'under offset measured from range edge');

  const edges = getBalance(synthetic, make([exact.upper, exact.lower, exact.upper, exact.lower]));
  assert(edges.districts.every((d) => d.balance === 'ok'), 'range edges are within range');
  assert(edges.pass, 'every district within range implies a pass');
});

test('plan status reports unassigned precincts and split districts', () => {
  const state = base();
  const plan = { ...state.referencePlan };
  const someone = state.precincts[0].id;
  plan[someone] = null;
  const partial = getPlanStatus(withPlan(state, plan));
  assertEqual([partial.valid, partial.complete, partial.unassigned], [false, false, 1]);
  const [a, , c] = findPath(state);
  const split = withPlan(state, Object.fromEntries(state.precincts.map((x) => [x.id, x.id === a || x.id === c ? 1 : null])));
  assertEqual(getPlanStatus(split).contiguous, false, 'split district detected');
});

test('getControlTotal counts each status and unassigned precincts', () => {
  const total = getControlTotal([
    { status: 'sideA' }, { status: 'sideA' }, { status: 'sideB' }, { status: 'tie' }, { status: 'empty' },
  ]);
  assertEqual(total, { sideA: 2, sideB: 1, tied: 1, empty: 1 });
  const planned = withPlan(base());
  const t = getControlTotal(planned.districts, planned);
  assertEqual(t.sideA + t.sideB + t.tied + t.empty, planned.districtCount, 'sum');
  assertEqual(t.unassigned, 0, 'none unassigned');
});
