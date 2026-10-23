import { test, assert, assertEqual, assertThrows } from './test-runner.js';
import { LAYOUT_CELL_SIZE, MIN_CLICKABLE_AREA, PRECINCT_RANGE, URBAN_THRESHOLD, RURAL_THRESHOLD, BALANCE_RATIO, voterSpread, BASELINE_RANGE, RANDOM_CITY_RANGE, POPULATION_STEP } from '../src/state-generator.js';
import { generateState, freshGenerateState } from './fixtures.js';
import { getPlanStatus, getBalance, summarizeDistricts } from '../src/districts.js';
import { createRandom } from '../src/random.js';
import { decileAreaRatio, densityAreaCorrelation, typesAreOrdered } from './size-helpers.js';
import { pieceCounts, pointInPolygon, polygonArea, sampleGrid } from '../src/geometry.js';

test('createRandom is deterministic and in [0, 1)', () => {
  const a = createRandom('demo-1');
  const b = createRandom('demo-1');
  for (let i = 0; i < 200; i += 1) {
    const value = a();
    assertEqual(value, b(), 'same seed values');
    assert(value >= 0 && value < 1, `value ${value} out of range`);
  }
  assert(createRandom('demo-2')() !== createRandom('demo-1')(), 'different seeds differ');
});

test('generateState is reproducible from a seed', () => {
  const a = freshGenerateState({ seed: 'demo-1' });
  const b = freshGenerateState({ seed: 'demo-1' });
  assertEqual(a.name, b.name, 'state names');
  assertEqual(a.assignments, b.assignments, 'assignments');
  assertEqual(a.referencePlan, b.referencePlan, 'reference plan');
  assertEqual(a.precincts.map((c) => [c.name, c.sideAVoters, c.sideBVoters, c.type]), b.precincts.map((c) => [c.name, c.sideAVoters, c.sideBVoters, c.type]), 'precincts');
});

test('districts start empty and no precinct has a district', () => {
  const state = generateState({ seed: 'demo-1' });
  assertEqual(Object.keys(state.assignments).sort(), state.precincts.map((c) => c.id).sort(), 'every precinct listed');
  assert(Object.values(state.assignments).every((v) => v === null), 'all unassigned');
  assertEqual(state.districts.length, state.districtCount, 'district count');
  for (const d of state.districts) {
    assertEqual(d.precinctIds.length, 0, `district ${d.number} empty`);
    assertEqual(d.status, 'empty');
    assertEqual(d.labelPoint, undefined, 'no badge position');
  }
});

test('precincts have unique IDs and names, valid voters, type, density, symmetric neighbors', () => {
  const state = generateState({ seed: 'demo-1' });
  assert(state.precincts.length >= PRECINCT_RANGE.min && state.precincts.length <= PRECINCT_RANGE.max, 'precinct count in range');
  assertEqual(new Set(state.precincts.map((c) => c.id)).size, state.precincts.length, 'unique ids');
  assertEqual(new Set(state.precincts.map((c) => c.name)).size, state.precincts.length, 'unique names');
  assert(state.precincts.every((c, i) => c.id === `p${String(i + 1).padStart(3, '0')}` && c.name.length > 0), 'ids run p001… and names are not empty');
  assert(state.precincts.every((c) => !/county/i.test(c.name)), 'names never say county');
  for (const precinct of state.precincts) {
    assert(Number.isInteger(precinct.sideAVoters) && precinct.sideAVoters >= 0, 'side A integer');
    assert(Number.isInteger(precinct.sideBVoters) && precinct.sideBVoters >= 0, 'side B integer');
    assertEqual(precinct.totalVoters, precinct.sideAVoters + precinct.sideBVoters, 'total');
    assert(precinct.totalVoters > 0, 'positive total');
    assert(['urban', 'suburban', 'rural'].includes(precinct.type), `type ${precinct.type}`);
    assert(precinct.density > 0, 'density');
    assert(!precinct.neighbors.includes(precinct.id), 'no self neighbor');
    for (const n of precinct.neighbors) assert(state.precinctsById.get(n).neighbors.includes(precinct.id), `asymmetric ${precinct.id}-${n}`);
    assert(Array.isArray(precinct.center) && pointInPolygon(precinct.center, state.outline), `${precinct.name} center is inside the state`);
  }
});

test('explicit precinct and district counts are honored', () => {
  const small = generateState({ seed: 'counts', precinctCount: 500, districtCount: 8 });
  assertEqual(small.precincts.length, 500);
  assertEqual(small.districtCount, 8);
  const large = generateState({ seed: 'counts', precinctCount: 800, districtCount: 20 });
  assertEqual(large.precincts.length, 800);
  assertEqual(large.districts.length, 20);
  assertEqual(new Set(large.precincts.map((c) => c.name)).size, 800, 'unique names at 800 precincts');
});

test('invalid test counts throw clear errors', () => {
  assertThrows(() => generateState({ seed: 'x', precinctCount: 499 }), /precinctCount/);
  assertThrows(() => generateState({ seed: 'x', precinctCount: 801 }), /precinctCount/);
  assertThrows(() => generateState({ seed: 'x', districtCount: 7 }), /districtCount/);
  assertThrows(() => generateState({ seed: 'x', districtCount: 21 }), /districtCount/);
  assertThrows(() => generateState({ seed: 'x', districtCount: 9.5 }), /districtCount/);
});

function isConnected(state) {
  const seen = new Set([state.precincts[0].id]);
  const queue = [state.precincts[0].id];
  while (queue.length) {
    for (const n of state.precinctsById.get(queue.pop()).neighbors) {
      if (!seen.has(n)) {
        seen.add(n);
        queue.push(n);
      }
    }
  }
  return seen.size === state.precincts.length;
}

test('100 seeds: valid maps, a valid plan always exists, urban precincts vote side A and rural precincts side B', () => {
  let smallest = Infinity;
  let urban = 0;
  let urbanA = 0;
  let rural = 0;
  let ruralB = 0;
  for (let i = 0; i < 100; i += 1) {
    const state = generateState({ seed: `validation-${i}` });
    const label = `seed validation-${i}`;
    assertEqual(state.width, 800, `${label} width`);
    assert(polygonArea(state.outline) > 50000, `${label} outline too small`);
    assert(state.precincts.length >= PRECINCT_RANGE.min && state.precincts.length <= PRECINCT_RANGE.max, `${label} precinct count`);
    assert(state.districtCount >= 8 && state.districtCount <= 20, `${label} district count`);
    assert(isConnected(state), `${label} state not connected`);
    // Re-measure the layout independently from the reported seed points: every precinct is exactly one piece.
    const pieces = pieceCounts(sampleGrid(state.outline, state.precincts.map((c) => c.seedPoint), LAYOUT_CELL_SIZE), state.precincts.length);
    for (const precinct of state.precincts) {
      smallest = Math.min(smallest, precinct.area);
      assert(precinct.area >= MIN_CLICKABLE_AREA, `${label} ${precinct.name} area ${precinct.area}`);
      assertEqual(pieces[precinct.index], 1, `${label} ${precinct.name} visible parts`);
      if (precinct.type === 'urban') {
        urban += 1;
        if (precinct.sideAVoters > precinct.sideBVoters) urbanA += 1;
        assert(precinct.densityIndex >= URBAN_THRESHOLD, 'urban threshold');
      } else if (precinct.type === 'rural') {
        rural += 1;
        if (precinct.sideBVoters > precinct.sideAVoters) ruralB += 1;
        assert(precinct.densityIndex < RURAL_THRESHOLD, 'rural threshold');
      }
    }
    const planned = { ...state, assignments: { ...state.referencePlan } };
    planned.districts = summarizeDistricts(planned);
    const status = getPlanStatus(planned);
    assert(status.valid, `${label} reference plan invalid: ${JSON.stringify({ ...status, balance: undefined, difference: status.balance.difference })}`);
  }
  assert(urban > 0 && rural > 0, 'both urban and rural precincts exist');
  assert(urbanA / urban >= 0.8, `urban side A share ${urbanA}/${urban}`);
  assert(ruralB / rural >= 0.8, `rural side B share ${ruralB}/${rural}`);
  console.info(`Smallest precinct ${smallest} px²; urban side A ${urbanA}/${urban}; rural side B ${ruralB}/${rural}`);
});

test('a new random state is generated in under 2 seconds (SC-010)', () => {
  let slowest = 0;
  for (let i = 0; i < 12; i += 1) {
    const t0 = performance.now();
    freshGenerateState({ seed: `speed-${i}` });
    slowest = Math.max(slowest, performance.now() - t0);
  }
  assert(slowest < 2000, `slowest generation ${slowest.toFixed(0)} ms`);
});

const SEEDS = Array.from({ length: 100 }, (_, i) => `validation-${i}`);
const range = (values, digits = 3) => `${Math.min(...values).toFixed(digits)}–${Math.max(...values).toFixed(digits)}`;

test('100 seeds: precinct voters are highly uneven and the statewide race is close (FR-006, FR-007, FR-011, FR-012)', () => {
  let sideAAhead = 0;
  const aWins = [];
  const shares = [];
  const ruralLeanA = [];
  const tiers = [[0, 0], [0, 0], [0, 0], [0, 0]];
  const topShares = [];
  const medians = [];
  for (const seed of SEEDS) {
    const state = generateState({ seed });
    const totals = state.precincts.map((c) => c.totalVoters);
    const spread = voterSpread(totals, state.districtCount);
    topShares.push(spread.topShare);
    medians.push(spread.medianToMean);
    assert(spread.topShare >= 0.25, `${seed} top 10% share ${spread.topShare}`);
    assert(spread.medianToMean <= 0.5, `${seed} median/mean ${spread.medianToMean}`);
    assert(spread.maxToIdeal <= 0.75, `${seed} largest precinct ${spread.maxToIdeal} of ideal`);

    const all = totals.reduce((a, b) => a + b, 0);
    const summed = state.precincts.reduce((a, c) => a + c.sideAVoters, 0) / all;
    assert(Math.abs(summed - state.statewideShareA) < 1e-9, `${seed} statewideShareA matches precincts`);
    assert(summed >= 0.48 && summed <= 0.52, `${seed} statewide share ${summed}`);
    shares.push(summed);
    if (summed > 0.5) sideAAhead += 1;
    aWins.push(state.precincts.filter((c) => c.sideAVoters > c.sideBVoters).length / state.precincts.length);

    const rural = state.precincts.filter((c) => c.type === 'rural');
    ruralLeanA.push(rural.filter((c) => c.sideAVoters >= c.sideBVoters).length / Math.max(1, rural.length));

    const sorted = [...state.precincts].sort((a, b) => b.totalVoters - a.totalVoters);
    const size = Math.ceil(sorted.length / 4);
    sorted.forEach((c, i) => {
      const tier = tiers[Math.min(3, Math.floor(i / size))];
      tier[0] += c.sideBVoters;
      tier[1] += c.totalVoters;
    });
  }
  const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
  const tierB = tiers.map(([b, t]) => b / t);
  assert(sideAAhead >= 35 && sideAAhead <= 65, `side A ahead in ${sideAAhead}/100 maps`);
  assert(mean(aWins) >= 0.1 && mean(aWins) <= 0.3, `side A wins ${mean(aWins)} of precincts on average`);
  assert(mean(ruralLeanA) <= 0.05, `rural precincts leaning A ${mean(ruralLeanA)}`);
  for (let i = 1; i < 4; i += 1) assert(tierB[i] > tierB[i - 1], `side B share should rise as precincts get smaller: ${tierB}`);
  assert(tierB[3] >= 0.65 && tierB[3] <= 0.8, `smallest tier side B share ${tierB[3]}`);
  console.info(`Statewide side A ${range(shares, 4)}; A ahead ${sideAAhead}/100; A precinct wins ${mean(aWins).toFixed(3)}; top-10% share ${range(topShares)}; median/mean ${range(medians)}; size-tier side B ${tierB.map((v) => v.toFixed(3)).join(' > ')}`);
});

test('100 seeds: the reference plan is complete, contiguous, and within 10% (SC-006)', () => {
  const gaps = [];
  for (const seed of SEEDS) {
    const state = generateState({ seed });
    assertEqual(state.balanceRatio, BALANCE_RATIO, `${seed} balance ratio`);
    assertEqual(BALANCE_RATIO, 0.1);
    const planned = { ...state, assignments: { ...state.referencePlan } };
    assert(Object.values(planned.assignments).every((d) => Number.isInteger(d)), `${seed} reference plan complete`);
    planned.districts = summarizeDistricts(planned);
    const status = getPlanStatus(planned);
    assert(status.valid, `${seed} reference plan invalid`);
    const balance = getBalance(planned);
    assert(balance.pass && balance.largest <= balance.smallest * 1.1, `${seed} balance ${balance.differencePercent}%`);
    gaps.push(balance.differencePercent);
  }
  console.info(`Reference plan size gaps ${range(gaps, 1)}%`);
});

// Generated states are reused by the feature 009 tests below, since each one takes about 100 ms.
const stateCache = new Map();
export const cachedState = (seed) => {
  if (!stateCache.has(seed)) stateCache.set(seed, generateState({ seed }));
  return stateCache.get(seed);
};

test('100 seeds: random states are built from 2-4 cities, and the total is the baseline plus their populations (FR-010, FR-023)', () => {
  for (const seed of SEEDS) {
    const state = cachedState(seed);
    const label = `seed ${seed}`;
    const { count, population } = RANDOM_CITY_RANGE;
    assert(state.cities.length >= count.min && state.cities.length <= count.max, `${label} has ${state.cities.length} cities`);
    for (const [i, city] of state.cities.entries()) {
      assert(Number.isInteger(city.pop) && city.pop % POPULATION_STEP === 0, `${label} city ${i} population ${city.pop} is a multiple of 10,000`);
      assert(city.pop >= population.min && city.pop <= population.max, `${label} city ${i} population ${city.pop} is 50,000-150,000`);
      assert(pointInPolygon([city.x, city.y], state.outline), `${label} city ${i} is inside the outline`);
      for (let j = 0; j < i; j += 1) assert(Math.hypot(city.x - state.cities[j].x, city.y - state.cities[j].y) >= 150, `${label} cities ${j} and ${i} are at least 150 px apart`);
    }
    assert(Number.isInteger(state.baseline) && state.baseline >= BASELINE_RANGE.min && state.baseline <= BASELINE_RANGE.max, `${label} baseline ${state.baseline}`);
    const expected = state.baseline + state.cities.reduce((sum, c) => sum + c.pop, 0);
    assert(Math.abs(state.totalVoters - expected) <= state.precincts.length, `${label} total ${state.totalVoters} is the baseline plus the cities (${expected})`);
  }
  const again = generateState({ seed: SEEDS[3] });
  assertEqual(again.cities, cachedState(SEEDS[3]).cities, 'the same seed gives the same cities');
  assertEqual(again.baseline, cachedState(SEEDS[3]).baseline, 'and the same baseline');
  assertEqual(again.precincts.map((c) => [c.name, c.sideAVoters, c.area]), cachedState(SEEDS[3]).precincts.map((c) => [c.name, c.sideAVoters, c.area]), 'and the same precincts');
});

test('100 seeds: precinct size follows density, so dense precincts are small (FR-020, FR-021, SC-012)', () => {
  let weakest = -1;
  let worstRatio = 0;
  for (const seed of SEEDS) {
    const state = generateState({ seed });
    const correlation = densityAreaCorrelation(state);
    const ratio = decileAreaRatio(state);
    weakest = Math.max(weakest, correlation);
    worstRatio = Math.max(worstRatio, ratio);
    assert(correlation <= -0.8, `${seed}: rank correlation ${correlation.toFixed(2)}`);
    assert(ratio <= 1 / 3, `${seed}: densest tenth is ${ratio.toFixed(2)} of the sparsest tenth's area`);
    assert(typesAreOrdered(state), `${seed}: urban < suburban < rural average area`);
  }
  console.info(`Random states: weakest density-size correlation ${weakest.toFixed(2)}, worst decile ratio ${worstRatio.toFixed(2)}`);
});
