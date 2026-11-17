import { test, assert, assertEqual } from './test-runner.js';
import { generateState } from './fixtures.js';
import { applyElectionSwing, normalizeSwing } from '../src/election-swing.js';
import { reassignPrecinct } from '../src/districts.js';

test('Swing favors either side by six percentage points without changing voter totals', () => {
  const state = generateState({ seed: 'swing-test' });
  for (const points of [-6, -2.3, 0, 1.7, 6]) {
    const next = applyElectionSwing(state, state.precincts, points);
    for (const [i, p] of next.precincts.entries()) {
      const original = state.precincts[i];
      const expected = Math.round(Math.max(0, Math.min(p.totalVoters, original.sideAVoters - p.totalVoters * points / 100)));
      assertEqual(p.sideAVoters, expected);
      assertEqual(p.sideAVoters + p.sideBVoters, original.totalVoters);
      assert(Number.isInteger(p.sideAVoters));
      assert(p.sideAVoters >= 0 && p.sideBVoters >= 0);
      assert(next.precinctsById.get(p.id) === p);
    }
  }
});

test('Returning to zero restores every original vote after repeated slider moves', () => {
  const state = generateState({ seed: 'swing-test' });
  let next = state;
  for (const value of [6, -6, 2.1, -0.7, 0]) next = applyElectionSwing(next, state.precincts, value);
  assertEqual(next.precincts.map((p) => [p.sideAVoters, p.sideBVoters]), state.precincts.map((p) => [p.sideAVoters, p.sideBVoters]));
  assertEqual(state.precinctsById.get(state.precincts[0].id).sideAVoters, state.precincts[0].sideAVoters);
});

test('Swing preserves district edits and geography and recomputes district results', () => {
  const original = generateState({ seed: 'swing-test' });
  let state = reassignPrecinct(original, original.precincts[0].id, 1);
  state = reassignPrecinct(state, state.precincts[1].id, 1);
  const next = applyElectionSwing(state, original.precincts, -6);
  assert(next.assignments === state.assignments);
  assert(next.outline === state.outline && next.grid === state.grid);
  assertEqual(next.districts[0].sideAVoters, next.precincts[0].sideAVoters + next.precincts[1].sideAVoters);
  assertEqual(next.districts[0].sideBVoters, next.precincts[0].sideBVoters + next.precincts[1].sideBVoters);
  assertEqual(next.districts[0].totalVoters, state.districts[0].totalVoters);
  next.precincts.forEach((p, i) => assert(p.polygon === state.precincts[i].polygon && p.neighbors === state.precincts[i].neighbors));
});

test('Swing clamps unanimous precincts to valid shares and zero is exact', () => {
  const source = generateState({ seed: 'swing-test' });
  const precincts = source.precincts.map((p, i) => ({ ...p, sideAVoters: i % 2 ? p.totalVoters : 0, sideBVoters: i % 2 ? 0 : p.totalVoters }));
  const state = { ...source, precincts, precinctsById: new Map(precincts.map((p) => [p.id, p])) };
  for (const value of [-6, 6]) {
    const next = applyElectionSwing(state, precincts, value);
    assert(next.precincts.every((p) => p.sideAVoters >= 0 && p.sideBVoters >= 0 && p.sideAVoters + p.sideBVoters === p.totalVoters));
    assertEqual(applyElectionSwing(next, precincts, 0).precincts, precincts);
  }
});

test('Slider values are bounded and snapped to tenths', () => {
  assertEqual([normalizeSwing(-20), normalizeSwing(20), normalizeSwing('1.24'), normalizeSwing(NaN), normalizeSwing(Infinity)], [-6, 6, 1.2, 0, 0]);
});
