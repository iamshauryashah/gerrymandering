import { test, assert, assertEqual } from './test-runner.js';
import { MIN_CLICKABLE_AREA, PRECINCT_RANGE, voterSpread } from '../src/state-generator.js';
import { generateState, buildCustomState, freshBuildCustomState } from './fixtures.js';
import { createRandom } from '../src/random.js';
import { precinctsNear, decileAreaRatio, densityAreaCorrelation, meanArea, typesAreOrdered } from './size-helpers.js';
import { getBalance, summarizeDistricts } from '../src/districts.js';
import {
  CITY_SIGMA, MAX_CITIES, MIN_CITY_DISTANCE, addCity, applyVoterSettings, checkCityPlacement, precinctCountFor, createPlan,
  decodeCustomCode, districtCountFor, encodeCustomCode, getCustomCodeFromUrl, outlineForSeed, validatePlan, withSettings,
  DEFAULT_POPULATION, POPULATION_RANGE, normalizePopulation, setCityPopulation,
} from '../src/custom-state.js';

// A stable hash of everything a random state is made of, so the generator refactor can be proven not to change any map.
function fingerprint(state) {
  const lines = [state.name, state.districtCount, JSON.stringify(state.referencePlan)];
  for (const c of state.precincts) lines.push(`${c.name}|${c.sideAVoters}|${c.sideBVoters}|${c.type}|${c.polygon.length}|${c.seedPoint}`);
  let h = 0x811c9dc5;
  for (const ch of lines.join('\n')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

// Recorded from the finished generator of feature 010. They change only when a later feature changes random maps on purpose.
const RANDOM_STATE_FINGERPRINTS = {
  'demo-1': 'aebca4e1',
  'demo-2': '35c22298',
  'regress-3': 'be899643',
  'regress-4': '38ac57ad',
  'regress-5': 'cfee892a',
};

test('random states from known seeds keep their fingerprints, which guards against later changes (FR-018)', () => {
  for (const [seed, expected] of Object.entries(RANDOM_STATE_FINGERPRINTS)) {
    assertEqual(fingerprint(generateState({ seed })), expected, `seed ${seed}`);
  }
});

// Places cities at random spots, then fills any shortfall by scanning the map, so a plan reaches the count it asks for.
function plannedCities(index, total) {
  const random = createRandom(`plan-${index}`);
  let plan = createPlan({ outlineSeed: `t${index.toString(36)}` });
  for (let tries = 0; plan.cities.length < total && tries < 400; tries += 1) {
    const point = { x: Math.round(random() * 800), y: Math.round(random() * 600) };
    if (checkCityPlacement(plan, point).ok) plan = addCity(plan, point);
  }
  for (let y = 20; y < 600 && plan.cities.length < total; y += 10) {
    for (let x = 20; x < 800 && plan.cities.length < total; x += 10) {
      if (checkCityPlacement(plan, { x, y }).ok) plan = addCity(plan, { x, y });
    }
  }
  return plan;
}

const precinctAverageArea = (state) => state.precincts.reduce((sum, c) => sum + c.area, 0) / state.precincts.length;

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

test('the same plan always builds the same state, and settings move only the voters', () => {
  const plan = plannedCities(7, 5);
  assertEqual(plan.cities.length, 5, 'five cities placed');
  const a = buildCustomState(plan);
  const b = buildCustomState(plan);
  assert(a.ok && b.ok, 'plan builds');
  assertEqual(a.state.layoutKey, b.state.layoutKey, 'same layout');
  assertEqual(a.state.precincts.map((c) => [c.name, c.sideAVoters, c.sideBVoters, c.area, c.polygon.length, c.neighbors]), b.state.precincts.map((c) => [c.name, c.sideAVoters, c.sideBVoters, c.area, c.polygon.length, c.neighbors]), 'same precincts');
  assertEqual(a.state.referencePlan, b.state.referencePlan, 'same reference plan');
  assertEqual(a.state.name, b.state.name, 'same name');
  assertEqual(a.state.custom, true);
  assertEqual(a.state.precincts.length, precinctCountFor(5), 'precinct count follows the cities');
  assertEqual(a.state.districtCount, districtCountFor(precinctCountFor(5)), 'district count follows the precinct count');
  assert(Object.values(a.state.assignments).every((d) => d === null), 'districts start empty');
});

// A point that is inside the outline together with the point `dx` pixels to its right.
function pairInside(outlineSeed, dx) {
  const plan = createPlan({ outlineSeed });
  for (let y = 40; y < 580; y += 7) {
    for (let x = 40; x < 700; x += 7) {
      const first = { x, y };
      const second = { x: x + dx, y };
      if (checkCityPlacement(plan, first).ok && checkCityPlacement(plan, second).ok) return [first, second];
    }
  }
  throw new Error('no pair of points found inside the outline');
}

test('city placement is refused outside the outline, too close, and past the limit; exactly 90 px apart is fine', () => {
  const seed = 'alpha1';
  const plan = createPlan({ outlineSeed: seed });
  assertEqual(checkCityPlacement(plan, { x: 0, y: 0 }), { ok: false, reason: 'outside' });
  assertEqual(checkCityPlacement(plan, { x: 800, y: 600 }), { ok: false, reason: 'outside' });
  assertEqual(checkCityPlacement(plan, { x: -5, y: 100 }), { ok: false, reason: 'outside' });
  assert(outlineForSeed(seed).length >= 100, 'the outline is a polygon');

  const [first] = pairInside(seed, MIN_CITY_DISTANCE - 1);
  const withFirst = addCity(plan, first);
  assertEqual(checkCityPlacement(withFirst, { x: first.x + MIN_CITY_DISTANCE - 1, y: first.y }), { ok: false, reason: 'too-close' }, '89 px is too close');
  assertEqual(checkCityPlacement(withFirst, { x: first.x, y: first.y }), { ok: false, reason: 'too-close' }, 'the same spot is too close');
  const [a] = pairInside(seed, MIN_CITY_DISTANCE);
  assertEqual(checkCityPlacement(addCity(plan, a), { x: a.x + MIN_CITY_DISTANCE, y: a.y }), { ok: true }, 'exactly 90 px apart is allowed');

  const full = plannedCities(11, MAX_CITIES);
  assertEqual(full.cities.length, MAX_CITIES, 'twelve cities fit');
  assertEqual(checkCityPlacement(full, { x: 400, y: 300 }), { ok: false, reason: 'limit' }, 'the 13th city is refused first');
});

test('validatePlan rejects every rule a plan can break', () => {
  const base = plannedCities(5, 2);
  assertEqual(validatePlan(base), [], 'a good plan has no problems');
  const has = (plan, text) => validatePlan(plan).some((p) => p === text || p.startsWith(text));
  for (const bad of ['', 'ABC', 'a-b', 'a'.repeat(17), 'a b']) assert(has({ ...base, outlineSeed: bad }, 'outlineSeed'), `outline seed "${bad}" rejected`);
  assert(!has({ ...base, outlineSeed: 'a'.repeat(16) }, 'outlineSeed'), '16 characters is fine');
  for (const bad of [299, 701, 500.5, '500', NaN]) assert(has({ ...base, shareA: bad }, 'shareA'), `shareA ${bad} rejected`);
  for (const ok of [300, 700]) assert(!has({ ...base, shareA: ok }, 'shareA'), `shareA ${ok} accepted`);
  for (const bad of [-101, 101, 3.5]) assert(has({ ...base, cityLean: bad }, 'cityLean'), `cityLean ${bad} rejected`);
  for (const ok of [-100, 100, 0]) assert(!has({ ...base, cityLean: ok }, 'cityLean'), `cityLean ${ok} accepted`);
  const thirteen = { ...base, cities: Array.from({ length: 13 }, (_, i) => ({ x: 50 + i * 55, y: 300 })) };
  assert(has(thirteen, 'city-limit'), '13 cities rejected');
  assert(has({ ...base, cities: [{ x: 0, y: 0 }] }, 'city-0-outside'), 'a city outside the outline is rejected');
  assert(has({ ...base, cities: [{ x: 10.5, y: 20 }] }, 'city-0-coordinates'), 'a fractional coordinate is rejected');
  assert(has({ ...base, cities: [{ x: 801, y: 20 }] }, 'city-0-coordinates'), 'x above 800 is rejected');
  assert(has({ ...base, cities: [{ x: 20, y: 601 }] }, 'city-0-coordinates'), 'y above 600 is rejected');
  const [p, q] = pairInside(base.outlineSeed, MIN_CITY_DISTANCE - 1);
  assert(has({ ...base, cities: [p, q] }, 'city-1-too-close'), 'two cities 89 px apart are rejected');
  assertEqual(buildCustomState({ ...base, shareA: 299 }), { ok: false, reason: 'plan' }, 'building an invalid plan is refused');
});

// The share of side A's voters among precincts of one type, over a whole state.
function typeShare(state, type) {
  const precincts = state.precincts.filter((c) => c.type === type);
  const total = precincts.reduce((sum, c) => sum + c.totalVoters, 0);
  return total ? precincts.reduce((sum, c) => sum + c.sideAVoters, 0) / total : null;
}

test('the statewide split matches the chosen share at 30%, 50%, and 70% (SC-003)', () => {
  for (let i = 0; i < 20; i += 1) {
    const built = buildCustomState(plannedCities(400 + i, i % 7));
    assert(built.ok, `plan ${i} builds`);
    for (const shareA of [300, 500, 700]) {
      const next = applyVoterSettings(built.state, { shareA });
      assert(Math.abs(next.statewideShareA - shareA / 1000) <= 0.005, `plan ${i}: ${shareA} gave ${(next.statewideShareA * 1000).toFixed(1)}`);
      const sideA = next.precincts.reduce((sum, c) => sum + c.sideAVoters, 0);
      assertEqual(sideA / next.totalVoters, next.statewideShareA, 'the reported share is the real share');
    }
  }
  for (let i = 0; i < 5; i += 1) {
    for (const shareA of [300, 700]) {
      const built = buildCustomState(withSettings(plannedCities(500 + i, 3), { shareA }));
      assert(built.ok, `plan ${i} builds at ${shareA}`);
      assert(Math.abs(built.state.statewideShareA - shareA / 1000) <= 0.005, `built at ${shareA}`);
    }
  }
});

test('city lean sets how differently cities and the countryside vote, without moving the statewide split (SC-004)', () => {
  const gaps = { 100: [], 0: [], '-100': [] };
  for (let i = 0; i < 10; i += 1) {
    const built = buildCustomState(plannedCities(600 + i, 4));
    assert(built.ok, `plan ${i} builds`);
    for (const lean of [100, 0, -100]) {
      const next = applyVoterSettings(built.state, { shareA: 500, cityLean: lean });
      assert(Math.abs(next.statewideShareA - 0.5) <= 0.005, `statewide split holds at lean ${lean}`);
      const urban = typeShare(next, 'urban');
      const rural = typeShare(next, 'rural');
      if (urban !== null && rural !== null) gaps[lean].push(urban - rural);
    }
  }
  const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
  assert(gaps[100].length >= 6, 'most plans have both urban and rural precincts');
  assert(mean(gaps[100]) > 0.1, `cities lean side A at +100 (gap ${mean(gaps[100]).toFixed(3)})`);
  assert(mean(gaps[-100]) < -0.1, `cities lean side B at -100 (gap ${mean(gaps[-100]).toFixed(3)})`);
  assert(Math.abs(mean(gaps[0])) < 0.5 * mean(gaps[100]), `neutral lean leaves a small gap (${mean(gaps[0]).toFixed(3)} vs ${mean(gaps[100]).toFixed(3)})`);
});

test('changing the voter settings keeps the layout and matches a fresh build (R6)', () => {
  const plan = plannedCities(33, 4);
  const built = buildCustomState(plan);
  assert(built.ok);
  const settings = { shareA: 620, cityLean: -40 };
  const next = applyVoterSettings(built.state, settings);
  assertEqual(next.layoutKey, built.state.layoutKey, 'same layout key');
  assert(next.precincts !== built.state.precincts, 'a new precinct list');
  next.precincts.forEach((c, i) => {
    const old = built.state.precincts[i];
    assert(c.polygon === old.polygon, 'polygon shared');
    assertEqual([c.id, c.name, c.area, c.neighbors, c.type, c.totalVoters, c.densityIndex], [old.id, old.name, old.area, old.neighbors, old.type, old.totalVoters, old.densityIndex], `precinct ${c.id} layout unchanged`);
    assertEqual(c.sideAVoters + c.sideBVoters, c.totalVoters, 'voters add up');
  });
  assert(next.precincts.some((c, i) => c.sideAVoters !== built.state.precincts[i].sideAVoters), 'voters changed');
  assertEqual(next.referencePlan, built.state.referencePlan, 'reference plan kept');
  assertEqual(next.plan, { ...plan, ...settings }, 'the plan records the new settings');
  assertEqual(next.precinctsById.get(next.precincts[0].id), next.precincts[0], 'lookup follows the new precincts');

  const fresh = buildCustomState({ ...plan, ...settings });
  assert(fresh.ok);
  assertEqual(next.precincts.map((c) => c.sideAVoters), fresh.state.precincts.map((c) => c.sideAVoters), 'same voters as a fresh build');
  assertEqual(next.statewideShareA, fresh.state.statewideShareA);

  const again = applyVoterSettings(built.state, settings);
  assertEqual(again.precincts.map((c) => c.sideAVoters), next.precincts.map((c) => c.sideAVoters), 'applying the same settings twice gives the same voters');
  const back = applyVoterSettings(next, { shareA: plan.shareA, cityLean: plan.cityLean });
  assertEqual(back.precincts.map((c) => c.sideAVoters), built.state.precincts.map((c) => c.sideAVoters), 'moving a slider and back restores the exact voters');
});

test('populations are clamped and rounded to a multiple of 10,000, and a city defaults to 100,000 (FR-001)', () => {
  assertEqual(DEFAULT_POPULATION, 100000);
  assertEqual([POPULATION_RANGE.min, POPULATION_RANGE.max], [10000, 300000]);
  assertEqual([normalizePopulation(0), normalizePopulation(9999), normalizePopulation(4000)], [10000, 10000, 10000], 'below the range');
  assertEqual([normalizePopulation(300001), normalizePopulation(900000)], [300000, 300000], 'above the range');
  assertEqual([normalizePopulation(104999), normalizePopulation(105000), normalizePopulation(15000)], [100000, 110000, 20000], 'rounded to the nearest step');
  assertEqual([normalizePopulation(NaN), normalizePopulation(undefined)], [100000, 100000], 'not a number gives the default');

  const plan = plannedCities(21, 3);
  assertEqual(plan.cities.map((c) => c.pop), [100000, 100000, 100000], 'new cities start at the default');
  const bigger = setCityPopulation(plan, 1, 250000);
  assertEqual(bigger.cities.map((c) => c.pop), [100000, 250000, 100000], 'only that city changes');
  assertEqual(plan.cities[1].pop, 100000, 'the old plan is untouched');
  assertEqual(bigger.cities.map((c) => [c.x, c.y]), plan.cities.map((c) => [c.x, c.y]), 'positions are kept');
  assertEqual(setCityPopulation(plan, 0, 1).cities[0].pop, 10000, 'clamped');
  assertEqual(addCity(createPlan({ outlineSeed: 'abc' }), { x: 1, y: 2 }, 55000).cities[0], { x: 1, y: 2, pop: 60000 }, 'a given population is rounded');
});

test('validatePlan rejects populations outside 10,000-300,000 or not a multiple of 10,000 (FR-001)', () => {
  const base = plannedCities(22, 2);
  assertEqual(validatePlan(base), [], 'a good plan has no problems');
  const problemsWith = (pop) => validatePlan({ ...base, cities: [{ ...base.cities[0], pop }, base.cities[1]] });
  for (const bad of [0, 9999, 10500, 300001, 310000, -10000, 100000.5, '100000', undefined, NaN]) {
    assert(problemsWith(bad).includes('city-0-population'), `population ${String(bad)} is rejected`);
  }
  for (const good of [10000, 20000, 100000, 300000]) assertEqual(problemsWith(good), [], `population ${good} is accepted`);
  assertEqual(buildCustomState({ ...base, cities: [{ ...base.cities[0], pop: 5 }, base.cities[1]] }), { ok: false, reason: 'plan' }, 'building a bad population is refused');
});

test('withSettings clamps to the allowed ranges and keeps what is not given', () => {
  const plan = createPlan({ outlineSeed: 'abc' });
  assertEqual([withSettings(plan, { shareA: 100 }).shareA, withSettings(plan, { shareA: 900 }).shareA], [300, 700]);
  assertEqual([withSettings(plan, { cityLean: -500 }).cityLean, withSettings(plan, { cityLean: 500 }).cityLean], [-100, 100]);
  assertEqual(withSettings(plan, { shareA: 512.6 }).shareA, 513, 'rounded to a whole permille');
  assertEqual(withSettings(plan, { cityLean: 3.4 }).cityLean, 3);
  const kept = withSettings({ ...plan, shareA: 420, cityLean: -20 }, {});
  assertEqual([kept.shareA, kept.cityLean], [420, -20]);
  assertEqual(validatePlan(withSettings(plan, { shareA: 12345, cityLean: -12345 })), [], 'clamped settings are always valid');
});

test('a plan survives the address code, and the same code rebuilds the same state (US4)', () => {
  for (let i = 0; i < 50; i += 1) {
    const random = createRandom(`codec-${i}`);
    const sized = plannedCities(700 + i, i % 13);
    const plan = withSettings(withPopulations(sized, sized.cities.map(() => 10000 * (1 + Math.floor(random() * 30)))), { shareA: 300 + Math.floor(random() * 401), cityLean: Math.floor(random() * 201) - 100 });
    const code = encodeCustomCode(plan);
    assert(/^v2\.[0-9a-z]+\.\d+\.-?\d+\.(0|\d+_\d+_\d+(-\d+_\d+_\d+)*)$/.test(code), `code ${code} has the documented shape`);
    assert(code.length <= 200, `code is short (${code.length} characters)`);
    assertEqual(decodeCustomCode(code), plan, `plan ${i} round-trips`);
  }
  for (let i = 0; i < 4; i += 1) {
    const plan = withSettings(plannedCities(800 + i, 2 + i), { shareA: 430 + i * 25, cityLean: -60 + i * 40 });
    const a = buildCustomState(plan);
    const b = buildCustomState(decodeCustomCode(encodeCustomCode(plan)));
    assert(a.ok && b.ok);
    assertEqual(b.state.precincts.map((c) => [c.name, c.sideAVoters, c.sideBVoters, c.area]), a.state.precincts.map((c) => [c.name, c.sideAVoters, c.sideBVoters, c.area]), 'the code rebuilds the same precincts and voters');
    assertEqual(b.state.seed, encodeCustomCode(plan), 'the state carries its code');
  }
});

test('the address code has the documented format (US4)', () => {
  const plan = { outlineSeed: 'k3x9a', cities: [{ x: 210, y: 180, pop: 100000 }, { x: 400, y: 300, pop: 250000 }], shareA: 520, cityLean: 50 };
  assertEqual(encodeCustomCode(plan), 'v2.k3x9a.520.50.210_180_10-400_300_25');
  assertEqual(encodeCustomCode({ ...plan, cities: [] }), 'v2.k3x9a.520.50.0', 'no cities is a 0');
  assertEqual(encodeCustomCode({ ...plan, cities: [], cityLean: -30 }), 'v2.k3x9a.520.-30.0', 'a negative lean keeps its sign');
  assertEqual(encodeCustomCode({ ...plan, cities: [{ x: 0, y: 600, pop: 10000 }] }), 'v2.k3x9a.520.50.0_600_1', 'zero coordinates are written');
  assertEqual(encodeCustomCode({ ...plan, cities: [{ x: 5, y: 6, pop: 300000 }] }), 'v2.k3x9a.520.50.5_6_30', 'the largest city is 30');
  assertEqual(getCustomCodeFromUrl('?custom=v2.a.500.0.0'), 'v2.a.500.0.0');
  assertEqual(getCustomCodeFromUrl('?seed=x&custom=v2.b.500.0.0'), 'v2.b.500.0.0');
  assertEqual(getCustomCodeFromUrl('?seed=x'), null);
  assertEqual(getCustomCodeFromUrl(''), null);
  assertEqual(getCustomCodeFromUrl('?custom='), null);
  assertEqual(getCustomCodeFromUrl(`?custom=${'a'.repeat(400)}`).length, 300, 'an enormous value is cut short');
});

test('damaged or out-of-range address codes are rejected, never half-accepted (US4)', () => {
  const base = plannedCities(5, 2);
  const good = encodeCustomCode(base);
  assertEqual(decodeCustomCode(good), base, 'the good code decodes');
  const [version, seed, share, lean, cities] = good.split('.');
  const rebuild = (parts) => parts.join('.');
  const bad = {
    'wrong version': rebuild(['v3', seed, share, lean, cities]),
    'version 1 city with a size': rebuild(['v1', seed, share, lean, cities]),
    'version 2 city without a size': rebuild([version, seed, share, lean, '120_130']),
    'size 0': rebuild([version, seed, share, lean, '120_130_0']),
    'size 31': rebuild([version, seed, share, lean, '120_130_31']),
    'size with a leading zero': rebuild([version, seed, share, lean, '120_130_05']),
    'negative size': rebuild([version, seed, share, lean, '120_130_-5']),
    'fractional size': rebuild([version, seed, share, lean, '120_130_2.5']),
    'size not a number': rebuild([version, seed, share, lean, '120_130_x']),
    'upper-case seed': rebuild([version, seed.toUpperCase() + 'X', share, lean, cities]),
    'seed too long': rebuild([version, 'a'.repeat(17), share, lean, cities]),
    'empty seed': rebuild([version, '', share, lean, cities]),
    'share too low': rebuild([version, seed, '299', lean, cities]),
    'share too high': rebuild([version, seed, '701', lean, cities]),
    'share not a number': rebuild([version, seed, 'abc', lean, cities]),
    'fractional share': rebuild([version, seed, '500.5', lean, cities]),
    'lean too high': rebuild([version, seed, share, '101', cities]),
    'lean too low': rebuild([version, seed, share, '-101', cities]),
    'negative zero': rebuild([version, seed, share, '-0', cities]),
    'leading zero': rebuild([version, seed, share, '050', cities]),
    'missing part': rebuild([version, seed, share, lean]),
    'extra part': `${good}.0`,
    'empty text': '',
    'bad city text': rebuild([version, seed, share, lean, '12_x']),
    'city with one number': rebuild([version, seed, share, lean, '120']),
    'city with four numbers': rebuild([version, seed, share, lean, '120_130_10_5']),
    'trailing dash': rebuild([version, seed, share, lean, `${cities}-`]),
  };
  for (const [reason, code] of Object.entries(bad)) assertEqual(decodeCustomCode(code), null, reason);
  assertEqual(decodeCustomCode(null), null, 'null');
  assertEqual(decodeCustomCode(undefined), null, 'undefined');
  assertEqual(decodeCustomCode(42), null, 'a number');

  const thirteen = encodeCustomCode({ ...base, cities: Array.from({ length: 13 }, (_, i) => ({ x: 60 + i * 55, y: 300, pop: DEFAULT_POPULATION })) });
  assertEqual(decodeCustomCode(thirteen), null, '13 cities');
  assertEqual(decodeCustomCode(encodeCustomCode({ ...base, cities: [{ x: 0, y: 0, pop: DEFAULT_POPULATION }] })), null, 'a city outside the outline');
  assertEqual(decodeCustomCode(encodeCustomCode({ ...base, cities: [{ x: 801, y: 300, pop: DEFAULT_POPULATION }] })), null, 'x above 800');
  const [p, q] = pairInside(base.outlineSeed, MIN_CITY_DISTANCE - 1);
  assertEqual(decodeCustomCode(encodeCustomCode({ ...base, cities: [p, q].map((c) => ({ ...c, pop: DEFAULT_POPULATION })) })), null, 'two cities 89 px apart');
  const [far1, far2] = pairInside(base.outlineSeed, MIN_CITY_DISTANCE);
  assertEqual(decodeCustomCode(encodeCustomCode({ ...base, cities: [far1, far2].map((c) => ({ ...c, pop: DEFAULT_POPULATION })) })).cities, [far1, far2].map((c) => ({ ...c, pop: DEFAULT_POPULATION })), 'exactly 90 px apart is accepted');
});

// --- Feature 009: city populations and the state's total ------------------------------------------------------

const withPopulations = (plan, pops) => pops.reduce((current, pop, i) => setCityPopulation(current, i, pop), plan);
const precinctAverage = (precincts, pick) => (precincts.length ? precincts.reduce((sum, c) => sum + pick(c), 0) / precincts.length : null);
const nearCity = (state, city, radius) => state.precincts.filter((c) => Math.hypot(c.seedPoint[0] - city.x, c.seedPoint[1] - city.y) <= radius);

test('adding, removing, and resizing a city changes the total by its population (FR-010, SC-002)', () => {
  let worst = 0;
  for (let i = 0; i < 15; i += 1) {
    const withExtra = plannedCities(900 + i, 3 + (i % 3));
    const base = { ...withExtra, cities: withExtra.cities.slice(0, -1) };
    const builtBase = buildCustomState(base);
    assert(builtBase.ok, `plan ${i} builds without its last city`);
    for (const pop of [30000, 100000, 250000]) {
      const grown = setCityPopulation(withExtra, withExtra.cities.length - 1, pop);
      const builtGrown = buildCustomState(grown);
      assert(builtGrown.ok, `plan ${i} builds with a city of ${pop}`);
      const rise = builtGrown.state.totalVoters - builtBase.state.totalVoters;
      worst = Math.max(worst, Math.abs(rise - pop) / pop);
      assert(rise >= 0.75 * pop && rise <= 1.25 * pop, `plan ${i}: adding ${pop} raised the total by ${rise}`);
      // Removing the city again is the same step backwards.
      const removed = buildCustomState({ ...grown, cities: grown.cities.slice(0, -1) });
      assertEqual(removed.state.totalVoters, builtBase.state.totalVoters, `plan ${i}: removing the city restores the total`);
    }
    const small = buildCustomState(setCityPopulation(withExtra, withExtra.cities.length - 1, 100000));
    const big = buildCustomState(setCityPopulation(withExtra, withExtra.cities.length - 1, 300000));
    const resized = big.state.totalVoters - small.state.totalVoters;
    assert(resized >= 0.75 * 200000 && resized <= 1.25 * 200000, `plan ${i}: resizing by 200,000 changed the total by ${resized}`);
  }
  console.info(`Largest deviation of a city's effect on the total from its population: ${(worst * 100).toFixed(2)}%`);
});

test('the baseline does not depend on the cities, and the total is the baseline plus the cities (R7)', () => {
  for (let i = 0; i < 15; i += 1) {
    const plan = plannedCities(950 + i, i % 7);
    const built = buildCustomState(withPopulations(plan, plan.cities.map((_, k) => 10000 + 20000 * ((i + k) % 15))));
    assert(built.ok, `plan ${i} builds`);
    const { state } = built;
    assert(Number.isInteger(state.baseline) && state.baseline >= 450000 && state.baseline <= 720000, `plan ${i} baseline ${state.baseline} is 450,000-720,000`);
    const empty = buildCustomState(createPlan({ outlineSeed: plan.outlineSeed }));
    assert(empty.ok, `the empty plan ${i} builds`);
    assertEqual(state.baseline, empty.state.baseline, `plan ${i}: the baseline is the same with and without cities`);
    const expected = state.baseline + state.cities.reduce((sum, c) => sum + c.pop, 0);
    assert(Math.abs(state.totalVoters - expected) <= state.precincts.length, `plan ${i}: total ${state.totalVoters} is baseline plus cities (${expected})`);
    assertEqual(empty.state.cities, [], 'an empty plan has no cities');
  }
});

test('a bigger city makes a bigger state, and the precincts around it hold more voters (FR-009, SC-003)', () => {
  for (let i = 0; i < 20; i += 1) {
    const plan = plannedCities(1000 + i, 1);
    const small = buildCustomState(setCityPopulation(plan, 0, 30000));
    const big = buildCustomState(setCityPopulation(plan, 0, 300000));
    assert(small.ok && big.ok, `plan ${i} builds at both sizes`);
    assert(big.state.totalVoters > small.state.totalVoters, `plan ${i}: the bigger city gives the bigger state`);
    const around = (state) => precinctAverage(nearCity(state, plan.cities[0], 55), (c) => c.totalVoters);
    assert(around(big.state) !== null && around(small.state) !== null, `plan ${i}: there are precincts near the city`);
    assert(around(big.state) > around(small.state), `plan ${i}: precincts near the 300,000 city (${around(big.state)?.toFixed(0)}) hold more than near the 30,000 city (${around(small.state)?.toFixed(0)})`);
  }
  for (let i = 0; i < 10; i += 1) {
    const totals = [10000, 100000, 300000].map((pop) => buildCustomState(setCityPopulation(plannedCities(1050 + i, 1), 0, pop)).state.totalVoters);
    assert(totals[0] < totals[1] && totals[1] < totals[2], `plan ${i}: totals ${totals} rise with the population`);
  }
});

test('the statewide split matches its slider with cities of any size (FR-011, SC-005)', () => {
  for (let i = 0; i < 10; i += 1) {
    for (const pop of [10000, 300000]) {
      const plan = plannedCities(1100 + i, 3);
      const built = buildCustomState(withPopulations(plan, [pop, pop, pop]));
      assert(built.ok, `plan ${i} builds with three cities of ${pop}`);
      for (const shareA of [300, 500, 700]) {
        const next = applyVoterSettings(built.state, { shareA });
        assert(Math.abs(next.statewideShareA - shareA / 1000) <= 0.005, `plan ${i}, ${pop} voters each: ${shareA} gave ${(next.statewideShareA * 1000).toFixed(1)}`);
      }
    }
  }
});

test('100 plans of 0-12 cities with random city sizes build valid states that keep the older voter rules (FR-012, SC-006)', () => {
  let failures = 0;
  let worstTop = 1;
  let worstMedian = 0;
  let worstLargest = 0;
  for (let i = 0; i < 100; i += 1) {
    const random = createRandom(`sizes-${i}`);
    const plan = plannedCities(1200 + i, i % 13);
    assert(plan.cities.length <= MAX_CITIES, 'at most 12 cities');
    assertEqual(validatePlan(plan), [], `plan ${i} is valid`);
    const sized = withPopulations(plan, plan.cities.map(() => 10000 * (1 + Math.floor(random() * 30))));
    const result = buildCustomState(sized);
    if (!result.ok) {
      failures += 1;
      continue;
    }
    const { state } = result;
    assertEqual(state.precincts.length, precinctCountFor(plan.cities.length), `plan ${i} precinct count follows the cities`);
    assert(state.precincts.length >= PRECINCT_RANGE.min && state.precincts.length <= PRECINCT_RANGE.max, `plan ${i} precinct count`);
    assert(state.districtCount >= 8 && state.districtCount <= 20, `plan ${i} district count in range`);
    assert(state.precincts.every((c) => c.area >= MIN_CLICKABLE_AREA), `plan ${i} precincts are clickable`);
    assert(state.precincts.every((c) => c.totalVoters > 0 && c.totalVoters === c.sideAVoters + c.sideBVoters), `plan ${i} every precinct has voters that add up`);
    assert(isConnected(state), `plan ${i} precinct graph is connected`);
    const planned = { ...state, assignments: { ...state.referencePlan } };
    planned.districts = summarizeDistricts(planned);
    assert(getBalance(planned).pass, `plan ${i} reference plan is within the 10% rule`);
    const spread = voterSpread(state.precincts.map((c) => c.totalVoters), state.districtCount);
    worstTop = Math.min(worstTop, spread.topShare);
    worstMedian = Math.max(worstMedian, spread.medianToMean);
    worstLargest = Math.max(worstLargest, spread.maxToIdeal);
    assert(spread.maxToIdeal <= 0.75, `plan ${i}: the largest precinct is ${spread.maxToIdeal.toFixed(2)} of an ideal district`);
    assert(spread.topShare >= 0.25, `plan ${i}: the top 10% of precincts hold ${spread.topShare.toFixed(2)}`);
    assert(spread.medianToMean <= 0.5, `plan ${i}: median to mean ${spread.medianToMean.toFixed(2)}`);
  }
  console.info(`Random-size plans: ${failures} of 100 failed to build; weakest top-10% share ${worstTop.toFixed(2)}, highest median/mean ${worstMedian.toFixed(2)}, largest precinct ${worstLargest.toFixed(2)} of ideal`);
  assert(failures <= 2, `${failures} of 100 plans failed to build`);
});

// --- Feature 009: dense precincts are smaller ---------------------------------------------------------------

test('100 custom plans: precinct size follows density, and urban precincts are smaller than rural ones (FR-020, FR-021, SC-012)', () => {
  let failures = 0;
  let weakest = -1;
  let worstRatio = 0;
  for (let i = 0; i < 100; i += 1) {
    const random = createRandom(`dense-${i}`);
    const plan = plannedCities(1400 + i, i % 13);
    const sized = withPopulations(plan, plan.cities.map(() => 10000 * (1 + Math.floor(random() * 30))));
    const result = buildCustomState(sized);
    if (!result.ok) {
      failures += 1;
      continue;
    }
    const { state } = result;
    const correlation = densityAreaCorrelation(state);
    const ratio = decileAreaRatio(state);
    weakest = Math.max(weakest, correlation);
    worstRatio = Math.max(worstRatio, ratio);
    assert(correlation <= -0.8, `plan ${i} (${plan.cities.length} cities): rank correlation ${correlation.toFixed(2)}`);
    assert(ratio <= 1 / 3, `plan ${i} (${plan.cities.length} cities): densest tenth is ${ratio.toFixed(2)} of the sparsest tenth's area`);
    assert(typesAreOrdered(state), `plan ${i}: urban < suburban < rural average area`);
  }
  console.info(`Dense precincts are smaller: ${failures} failed to build; weakest correlation ${weakest.toFixed(2)}, worst decile ratio ${worstRatio.toFixed(2)}`);
  assert(failures <= 2, `${failures} of 100 plans failed to build`);
});

test('with no cities every precinct is within 0.25x to 4x of the average, and the size rules still hold (FR-023)', () => {
  for (let i = 0; i < 12; i += 1) {
    const result = buildCustomState(createPlan({ outlineSeed: `nocity${i}` }));
    assert(result.ok, `plan ${i} builds`);
    const { state } = result;
    const average = meanArea(state.precincts);
    for (const precinct of state.precincts) {
      assert(precinct.area >= 0.25 * average && precinct.area <= 4 * average, `plan ${i}: ${precinct.name} is ${(precinct.area / average).toFixed(2)}x the average`);
    }
    assert(densityAreaCorrelation(state) <= -0.8, `plan ${i}: correlation ${densityAreaCorrelation(state).toFixed(2)}`);
    assert(decileAreaRatio(state) <= 1 / 3, `plan ${i}: decile ratio ${decileAreaRatio(state).toFixed(2)}`);
    assert(typesAreOrdered(state), `plan ${i}: urban < suburban < rural average area`);
  }
});

test('around each city, the nearest precincts are smaller than the farthest within 150 px (FR-022)', () => {
  for (let i = 0; i < 12; i += 1) {
    const plan = withPopulations(plannedCities(1600 + i, 2 + (i % 3)), [120000, 120000, 120000, 120000].slice(0, 2 + (i % 3)));
    const result = buildCustomState(plan);
    assert(result.ok, `plan ${i} builds`);
    for (const city of plan.cities) {
      const ring = precinctsNear(result.state, city, 150).sort((a, b) => Math.hypot(a.seedPoint[0] - city.x, a.seedPoint[1] - city.y) - Math.hypot(b.seedPoint[0] - city.x, b.seedPoint[1] - city.y));
      const third = Math.floor(ring.length / 3);
      if (third < 2) continue;
      assert(meanArea(ring.slice(0, third)) < meanArea(ring.slice(-third)), `plan ${i}: precincts nearest a city are smaller than the farthest`);
    }
  }
});

test('a bigger city shrinks the precincts around it (FR-022, SC-013)', () => {
  let smaller = 0;
  for (let i = 0; i < 20; i += 1) {
    const plan = plannedCities(1800 + i, 1);
    const [city] = plan.cities;
    const small = buildCustomState(withPopulations(plan, [30000]));
    const big = buildCustomState(withPopulations(plan, [300000]));
    assert(small.ok && big.ok, `pair ${i} builds`);
    if (meanArea(precinctsNear(big.state, city, 60)) < meanArea(precinctsNear(small.state, city, 60))) smaller += 1;
  }
  assert(smaller >= 18, `precincts around the bigger city were smaller in ${smaller} of 20 pairs`);
});

test('version 1 address codes still open, with every city at 100,000 voters (US5)', () => {
  const [a, b] = pairInside('k3x9a', MIN_CITY_DISTANCE + 20);
  const code = `v1.k3x9a.520.50.${a.x}_${a.y}-${b.x}_${b.y}`;
  const plan = decodeCustomCode(code);
  assertEqual(plan.cities, [{ ...a, pop: 100000 }, { ...b, pop: 100000 }]);
  assertEqual(decodeCustomCode('v1.k3x9a.520.50.0').cities, [], 'no cities');
  assertEqual(encodeCustomCode(plan), `v2.k3x9a.520.50.${a.x}_${a.y}_10-${b.x}_${b.y}_10`, 'it is written back as version 2');
  assertEqual(decodeCustomCode(`v1.k3x9a.520.50.${a.x}_${a.y}_10`), null, 'a version 1 code with a size is damaged');
  assertEqual(decodeCustomCode('v1.k3x9a.520.50.0_0'), null, 'a version 1 city outside its outline is refused');
  assert(buildCustomState(plan).ok || buildCustomState(plan).reason === 'layout', 'a version 1 plan is a valid plan');
});

test('the precinct and district counts follow the number of cities (FR-001)', () => {
  for (let n = 0; n <= MAX_CITIES; n += 1) {
    assertEqual(precinctCountFor(n), Math.min(800, 500 + 25 * n), `precincts for ${n} cities`);
    assertEqual(districtCountFor(precinctCountFor(n)), Math.round(precinctCountFor(n) / 50), `districts for ${n} cities`);
    assert(districtCountFor(precinctCountFor(n)) >= 8 && districtCountFor(precinctCountFor(n)) <= 20, `${n} cities give 8-20 districts`);
  }
  assertEqual(precinctCountFor(0), PRECINCT_RANGE.min);
  assertEqual(precinctCountFor(MAX_CITIES), PRECINCT_RANGE.max);
});

test('older version 1 and version 2 links open as precinct states with the same cities (FR-011, SC-012)', () => {
  const [a, b] = pairInside('k3x9a', MIN_CITY_DISTANCE + 20);
  for (const code of [`v1.k3x9a.520.50.${a.x}_${a.y}-${b.x}_${b.y}`, `v2.k3x9a.520.50.${a.x}_${a.y}_20-${b.x}_${b.y}_5`]) {
    const plan = decodeCustomCode(code);
    assert(plan, `${code} decodes`);
    const result = buildCustomState(plan);
    assert(result.ok, `${code} builds`);
    assert(result.state.precincts.length >= PRECINCT_RANGE.min && result.state.precincts.length <= PRECINCT_RANGE.max, 'precinct count');
    assertEqual(result.state.cities.map(({ x, y }) => ({ x, y })), [a, b].map(({ x, y }) => ({ x, y })), 'same cities');
  }
});
