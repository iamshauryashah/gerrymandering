import { test, assert, assertEqual, assertThrows } from './test-runner.js';
import { MATCHUPS, TIE_COLOR, getNextMatchup } from '../src/matchups.js';
import { formatDistrictDetails, formatStatewideMakeup, formatVoterDetails, getResultColor, getStatewideResult } from '../src/formatters.js';
import { generateState } from './fixtures.js';

test('every side has a short name of at most 6 characters for the district tiles (011 R10)', () => {
  for (const matchup of MATCHUPS) {
    for (const side of [matchup.sideA, matchup.sideB]) {
      assert(typeof side.shortName === 'string' && side.shortName.length > 0 && side.shortName.length <= 6, `${side.name} has a short name`);
    }
    assert(matchup.sideA.shortName !== matchup.sideB.shortName, `${matchup.label} short names differ`);
  }
});

test('matchups are in the required order and wrap around', () => {
  assertEqual(MATCHUPS.map((m) => m.id), ['dem-rep', 'soc-lib', 'purple-orange']);
  assertEqual(MATCHUPS.map((m) => m.label), ['Democrats vs Republicans', 'Socialists vs Libertarians', 'Purple vs Orange']);
  assertEqual(getNextMatchup('dem-rep').id, 'soc-lib');
  assertEqual(getNextMatchup('soc-lib').id, 'purple-orange');
  assertEqual(getNextMatchup('purple-orange').id, 'dem-rep');
  assertThrows(() => getNextMatchup('green-blue'), /Unknown matchup/);
});

test('side colors match the matchup themes', () => {
  const [dr, sl, po] = MATCHUPS;
  assertEqual([dr.sideA.name, dr.sideB.name], ['Democrats', 'Republicans']);
  assertEqual([sl.sideA.name, sl.sideB.name], ['Socialists', 'Libertarians']);
  assertEqual([po.sideA.name, po.sideB.name], ['Purple', 'Orange']);
  assertEqual(getResultColor('sideA', 50, dr), dr.sideA.shades[4]);
  assertEqual(getResultColor('sideB', 1, dr), dr.sideB.shades[0]);
});

test('stronger margins get darker shades; ties are gray; empty uses the empty style', () => {
  const m = MATCHUPS[0];
  const shades = [1, 6, 12, 25, 40].map((margin) => getResultColor('sideA', margin, m));
  assertEqual(shades, m.sideA.shades);
  assertEqual(getResultColor('tie', 0, m), TIE_COLOR);
  assertEqual(getResultColor('empty', 0, m), 'empty');
  assertThrows(() => getResultColor('bogus', 0, m), /Unknown result status/);
});

test('voter details round percentages to one decimal and format counts', () => {
  const d = formatVoterDetails({ sideAVoters: 12345, sideBVoters: 6789 }, MATCHUPS[0]);
  assertEqual(d.totalVoters, '19,134');
  assertEqual(d.sides[0].voters, '12,345');
  assertEqual(d.sides[0].percent, '64.5%');
  assertEqual(d.sides[1].percent, '35.5%');
  assertEqual(d.leader, 'Democrats');
  assertEqual(d.statusText, 'Democrats lead');
  assertEqual(d.margin, 'Democrats +29.0 pts');
  const tie = formatVoterDetails({ sideAVoters: 5, sideBVoters: 5 }, MATCHUPS[1]);
  assertEqual(tie.statusText, 'Tied');
  assertEqual(tie.margin, 'None');
  const empty = formatVoterDetails({ sideAVoters: 0, sideBVoters: 0 }, MATCHUPS[2]);
  assertEqual(empty.status, 'empty');
  assertEqual(empty.sides[0].percent, '0.0%');
});

test('switching matchups relabels without changing numbers', () => {
  const result = { sideAVoters: 300, sideBVoters: 700 };
  const a = formatVoterDetails(result, MATCHUPS[0]);
  const b = formatVoterDetails(result, MATCHUPS[2]);
  assertEqual(a.sides.map((s) => s.voters), b.sides.map((s) => s.voters));
  assertEqual(b.statusText, 'Orange lead');
});

test('district details list number, precincts, totals, and margin', () => {
  const precincts = new Map([
    ['p01', { id: 'p01', name: 'Zed Precinct' }],
    ['p02', { id: 'p02', name: 'Amber Precinct' }],
  ]);
  const details = formatDistrictDetails({ number: 4, precinctIds: ['p01', 'p02'], sideAVoters: 40, sideBVoters: 60, totalVoters: 100, status: 'sideB', marginPercent: 20 }, precincts, MATCHUPS[0]);
  assertEqual(details.title, 'District 4');
  assertEqual(details.precinctCount, 2);
  assertEqual(details.precinctList, 'Amber Precinct, Zed Precinct');
  assertEqual(details.margin, 'Republicans +20.0 pts');
  const empty = formatDistrictDetails({ number: 2, precinctIds: [], sideAVoters: 0, sideBVoters: 0, totalVoters: 0, status: 'empty', marginPercent: 0 }, precincts, MATCHUPS[0]);
  assertEqual(empty.precinctList, 'No precincts assigned');
  assertEqual(empty.statusText, 'Empty (no precincts)');
});

const tenths = (percentText) => Math.round(parseFloat(percentText) * 10);
const precinctsOf = (a, b) => [{ sideAVoters: a, sideBVoters: b }];

test('statewide result sums every precinct, assigned or not (FR-002, FR-007)', () => {
  const state = generateState({ seed: 'demo-1' });
  const sumA = state.precincts.reduce((s, c) => s + c.sideAVoters, 0);
  const sumB = state.precincts.reduce((s, c) => s + c.sideBVoters, 0);
  const result = getStatewideResult(state.precincts);
  assertEqual(result.sideAVoters, sumA, 'side A sum');
  assertEqual(result.sideBVoters, sumB, 'side B sum');
  assertEqual(result.totalVoters, state.totalVoters, 'matches the state total');
  assertEqual(result.totalVoters, sumA + sumB, 'sides add up to the total');
  // Districts do not enter into it: a plan with every precinct assigned gives the same sums.
  const planned = { ...state, assignments: { ...state.referencePlan } };
  assertEqual(getStatewideResult(planned.precincts), result, 'same with or without districts');
});

test('statewide percentages always add up to exactly 100.0% (FR-004)', () => {
  for (const [a, b] of [[5004, 4996], [3335, 6665], [5000, 5000], [9995, 5], [1, 2], [7, 3], [123457, 654321]]) {
    const makeup = formatStatewideMakeup(precinctsOf(a, b), MATCHUPS[0]);
    assertEqual(tenths(makeup.sides[0].percent) + tenths(makeup.sides[1].percent), 1000, `${a}/${b} adds up`);
    assert(makeup.sides.every((s) => /^\d{1,3}\.\d%$/.test(s.percent)), `${a}/${b} one decimal`);
  }
  const state = generateState({ seed: 'demo-2' });
  const makeup = formatStatewideMakeup(state.precincts, MATCHUPS[0]);
  assertEqual(tenths(makeup.sides[0].percent) + tenths(makeup.sides[1].percent), 1000, 'generated state adds up');
});

test('statewide makeup names the leader, the margin, a tie, and the bar label', () => {
  const lead = formatStatewideMakeup(precinctsOf(6000, 4000), MATCHUPS[0]);
  assertEqual(lead.totalVoters, '10,000');
  assertEqual(lead.sides[0].key, 'sideA');
  assertEqual(lead.sides[0].name, 'Democrats');
  assertEqual(lead.sides[0].voters, '6,000');
  assertEqual(lead.sides[0].percent, '60.0%');
  assertEqual(lead.sides[1].percent, '40.0%');
  assertEqual(lead.sides[0].share, 60);
  assertEqual(lead.status, 'sideA');
  assertEqual(lead.summary, 'Democrats lead statewide · Democrats +20.0 pts');
  assertEqual(lead.ariaLabel, 'Democrats 60.0%, Republicans 40.0%');
  const behind = formatStatewideMakeup(precinctsOf(4000, 6000), MATCHUPS[0]);
  assertEqual(behind.summary, 'Republicans lead statewide · Republicans +20.0 pts');
  const tie = formatStatewideMakeup(precinctsOf(5000, 5000), MATCHUPS[0]);
  assertEqual(tie.status, 'tie');
  assertEqual(tie.summary, 'Tied statewide');
  assertEqual(tie.sides.map((s) => s.percent), ['50.0%', '50.0%']);
  const none = formatStatewideMakeup([], MATCHUPS[0]);
  assertEqual(none.sides.map((s) => s.percent), ['0.0%', '0.0%']);
});

test('statewide makeup uses each side color and relabels without changing numbers', () => {
  const precincts = precinctsOf(300, 700);
  const base = formatStatewideMakeup(precincts, MATCHUPS[0]);
  assertEqual(base.sides[0].color, MATCHUPS[0].sideA.shades[3]);
  assertEqual(base.sides[1].color, MATCHUPS[0].sideB.shades[3]);
  for (const matchup of MATCHUPS) {
    const other = formatStatewideMakeup(precincts, matchup);
    assertEqual(other.sides.map((s) => s.name), [matchup.sideA.name, matchup.sideB.name], 'names follow the matchup');
    assertEqual(other.sides.map((s) => s.color), [matchup.sideA.shades[3], matchup.sideB.shades[3]], 'colors follow the matchup');
    assertEqual(other.sides.map((s) => [s.voters, s.percent, s.share]), base.sides.map((s) => [s.voters, s.percent, s.share]), 'numbers stay the same');
    assertEqual(other.totalVoters, base.totalVoters);
    assertEqual(other.status, base.status);
  }
});
