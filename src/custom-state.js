import { createRandom } from './random.js';
import { MAP_HEIGHT, MAP_WIDTH, distanceSquared, pointInPolygon } from './geometry.js';
import {
  assemblePrecincts, assembleState, baselineFor, buildLayout, createCityField, createTowns, generateNames, generateOutline, generateStateName, splitVoters, PRECINCT_RANGE,
  DEFAULT_POPULATION, POPULATION_RANGE, POPULATION_STEP,
} from './state-generator.js';
import { summarizeDistricts } from './districts.js';

export { DEFAULT_POPULATION, POPULATION_RANGE, POPULATION_STEP };

export const MAX_CITIES = 12;
// Cities closer than this would merge into one blob and squeeze precincts below a clickable size.
export const MIN_CITY_DISTANCE = 90;
export const CITY_REMOVE_RADIUS = 12;
// Side A's share of all voters, in permille.
export const SHARE_RANGE = Object.freeze({ min: 300, max: 700 });
export const LEAN_RANGE = Object.freeze({ min: -100, max: 100 });
export const DEFAULT_SHARE = 500;
export const DEFAULT_LEAN = 50;
export const CITY_SIGMA = 55;
export const CUSTOM_MAX_ATTEMPTS = 20;
export const SHARE_TOLERANCE = 0.005;
const OUTLINE_SEED_PATTERN = /^[0-9a-z]{1,16}$/;

const outlineCache = new Map();

// The outline depends on the outline seed alone, so it never moves when cities change or a layout is retried.
function shapeForSeed(outlineSeed) {
  if (outlineCache.has(outlineSeed)) return outlineCache.get(outlineSeed);
  const shape = generateOutline(createRandom(`${outlineSeed}|outline|0`));
  if (outlineCache.size >= 40) outlineCache.delete(outlineCache.keys().next().value);
  outlineCache.set(outlineSeed, shape);
  return shape;
}

export function outlineForSeed(outlineSeed) {
  return shapeForSeed(outlineSeed).outline;
}

export function createPlan({ outlineSeed }) {
  return { outlineSeed, cities: [], shareA: DEFAULT_SHARE, cityLean: DEFAULT_LEAN };
}

const inRange = (value, range) => Number.isInteger(value) && value >= range.min && value <= range.max;

// Lists every rule the plan breaks; an empty list means the plan is valid.
export function validatePlan(plan) {
  const problems = [];
  if (!plan || typeof plan.outlineSeed !== 'string' || !OUTLINE_SEED_PATTERN.test(plan.outlineSeed)) problems.push('outlineSeed');
  if (!plan || !inRange(plan.shareA, SHARE_RANGE)) problems.push('shareA');
  if (!plan || !inRange(plan.cityLean, LEAN_RANGE)) problems.push('cityLean');
  if (!plan || !Array.isArray(plan.cities)) {
    problems.push('cities');
    return problems;
  }
  if (plan.cities.length > MAX_CITIES) problems.push('city-limit');
  const outline = problems.includes('outlineSeed') ? null : outlineForSeed(plan.outlineSeed);
  plan.cities.forEach((city, i) => {
    const okCoordinates = city && Number.isInteger(city.x) && Number.isInteger(city.y) && city.x >= 0 && city.x <= MAP_WIDTH && city.y >= 0 && city.y <= MAP_HEIGHT;
    if (!okCoordinates) {
      problems.push(`city-${i}-coordinates`);
      return;
    }
    if (!Number.isInteger(city.pop) || city.pop < POPULATION_RANGE.min || city.pop > POPULATION_RANGE.max || city.pop % POPULATION_STEP !== 0) problems.push(`city-${i}-population`);
    if (!outline || !pointInPolygon([city.x, city.y], outline)) problems.push(`city-${i}-outside`);
    for (let j = 0; j < i; j += 1) {
      const other = plan.cities[j];
      if (other && distanceSquared([city.x, city.y], [other.x, other.y]) < MIN_CITY_DISTANCE ** 2) problems.push(`city-${i}-too-close-${j}`);
    }
  });
  return problems;
}

// Why a new city cannot go at this point, checked in this order: limit, outside, too-close.
export function checkCityPlacement(plan, point) {
  if (plan.cities.length >= MAX_CITIES) return { ok: false, reason: 'limit' };
  const outline = outlineForSeed(plan.outlineSeed);
  const inside = Number.isInteger(point.x) && Number.isInteger(point.y) && point.x >= 0 && point.x <= MAP_WIDTH && point.y >= 0 && point.y <= MAP_HEIGHT
    && outline && pointInPolygon([point.x, point.y], outline);
  if (!inside) return { ok: false, reason: 'outside' };
  if (plan.cities.some((c) => distanceSquared([point.x, point.y], [c.x, c.y]) < MIN_CITY_DISTANCE ** 2)) return { ok: false, reason: 'too-close' };
  return { ok: true };
}

// The index of the nearest city within the remove radius of a point, or -1.
export function findCityAt(plan, point) {
  let best = -1;
  let bestDistance = CITY_REMOVE_RADIUS ** 2;
  plan.cities.forEach((city, i) => {
    const d = distanceSquared([point.x, point.y], [city.x, city.y]);
    if (d <= bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return best;
}

// A population clamped to 10,000-300,000 and rounded to a multiple of 10,000.
export function normalizePopulation(value) {
  if (!Number.isFinite(value)) return DEFAULT_POPULATION;
  const stepped = Math.round(value / POPULATION_STEP) * POPULATION_STEP;
  return Math.min(POPULATION_RANGE.max, Math.max(POPULATION_RANGE.min, stepped));
}

export function addCity(plan, point, pop = DEFAULT_POPULATION) {
  return { ...plan, cities: [...plan.cities, { x: point.x, y: point.y, pop: normalizePopulation(pop) }] };
}

export function removeCity(plan, index) {
  return { ...plan, cities: plan.cities.filter((_, i) => i !== index) };
}

export function setCityPopulation(plan, index, pop) {
  return { ...plan, cities: plan.cities.map((city, i) => (i === index ? { ...city, pop: normalizePopulation(pop) } : city)) };
}

const clamp = (value, range) => Math.min(range.max, Math.max(range.min, Math.round(value)));

export function withSettings(plan, { shareA = plan.shareA, cityLean = plan.cityLean } = {}) {
  return { ...plan, shareA: clamp(shareA, SHARE_RANGE), cityLean: clamp(cityLean, LEAN_RANGE) };
}

export function precinctCountFor(cityTotal) {
  return Math.min(PRECINCT_RANGE.max, PRECINCT_RANGE.min + 25 * cityTotal);
}

export function districtCountFor(precinctCount) {
  return Math.round(precinctCount / 50);
}

// Side A's voters in each precinct. The stream depends on the outline seed only, so moving a slider never reshuffles the noise.
function voterPhase(layoutData, plan) {
  return splitVoters(layoutData, createRandom(`${plan.outlineSeed}|voters`), { target: plan.shareA / 1000, cityScale: plan.cityLean / 100 });
}

const sharesMatch = (voters, plan) => Math.abs(voters.statewideShareA - plan.shareA / 1000) <= SHARE_TOLERANCE;

// --- The address code ------------------------------------------------------------------------------------------
// ?custom=v2.<outlineSeed>.<shareA>.<cityLean>.<cities>, with cities as x_y_p triples joined by "-" (p is the population in
// units of 10,000, from 1 to 30), or 0 for none. Version 1 codes (x_y pairs, no sizes) still open, with every city at 100,000.

const CODE_VERSION = 'v2';
const LEGACY_VERSION = 'v1';
const CODE_MAX_LENGTH = 300;
const WHOLE_NUMBER = /^(0|[1-9]\d*)$/;
const SIGNED_NUMBER = /^(0|-?[1-9]\d*)$/;
const CITY_TEXT = /^(0|[1-9]\d*)_(0|[1-9]\d*)_([1-9]\d?)$/;
const LEGACY_CITY_TEXT = /^(0|[1-9]\d*)_(0|[1-9]\d*)$/;

export function encodeCustomCode(plan) {
  const cities = plan.cities.length ? plan.cities.map((c) => `${c.x}_${c.y}_${c.pop / POPULATION_STEP}`).join('-') : '0';
  return [CODE_VERSION, plan.outlineSeed, plan.shareA, plan.cityLean, cities].join('.');
}

// A valid plan, or null for anything damaged, out of range, or not in this format.
export function decodeCustomCode(text) {
  if (typeof text !== 'string') return null;
  const parts = text.split('.');
  if (parts.length !== 5 || (parts[0] !== CODE_VERSION && parts[0] !== LEGACY_VERSION)) return null;
  const legacy = parts[0] === LEGACY_VERSION;
  const [, outlineSeed, shareText, leanText, cityText] = parts;
  if (!WHOLE_NUMBER.test(shareText) || !SIGNED_NUMBER.test(leanText)) return null;
  let cities = [];
  if (cityText !== '0') {
    const entries = cityText.split('-');
    if (!entries.every((entry) => (legacy ? LEGACY_CITY_TEXT : CITY_TEXT).test(entry))) return null;
    cities = entries.map((entry) => {
      const [x, y, units] = entry.split('_').map(Number);
      return { x, y, pop: legacy ? DEFAULT_POPULATION : units * POPULATION_STEP };
    });
  }
  const plan = { outlineSeed, cities, shareA: Number(shareText), cityLean: Number(leanText) };
  return validatePlan(plan).length ? null : plan;
}

export function getCustomCodeFromUrl(search = globalThis.location?.search ?? '') {
  const value = new URLSearchParams(search).get('custom')?.trim();
  return value ? value.slice(0, CODE_MAX_LENGTH) : null;
}

export function buildCustomState(plan) {
  if (validatePlan(plan).length) return { ok: false, reason: 'plan' };
  const shape = shapeForSeed(plan.outlineSeed);
  const precinctCount = precinctCountFor(plan.cities.length);
  const districtCount = districtCountFor(precinctCount);
  const weightAt = createCityField(plan.cities, createTowns(createRandom(`${plan.outlineSeed}|towns`), shape.outline));
  // The baseline comes from the outline seed alone, so it never depends on the cities or on which layout attempt succeeds.
  const baseline = baselineFor(plan.outlineSeed);
  for (let attempt = 0; attempt < CUSTOM_MAX_ATTEMPTS; attempt += 1) {
    const random = createRandom(`${plan.outlineSeed}|layout|${attempt}`);
    const layout = buildLayout(random, { outline: shape.outline, weightAt, cities: plan.cities, baseline, precinctCount, districtCount });
    if (!layout) continue;
    const voters = voterPhase(layout, plan);
    if (!sharesMatch(voters, plan)) continue;
    const names = generateNames(createRandom(`${plan.outlineSeed}|names`), layout.points.length);
    const { precincts, referencePlan } = assemblePrecincts(layout, voters.sideA, names);
    const state = assembleState({
      seed: encodeCustomCode(plan),
      name: generateStateName(createRandom(`${plan.outlineSeed}|name`)),
      outline: shape.outline,
      shapeFeatures: shape.shapeFeatures,
      statewideShareA: voters.statewideShareA,
      grid: layout.grid,
      precincts,
      referencePlan,
      districtCount,
      attempts: attempt + 1,
      cities: plan.cities,
      baseline,
    });
    state.custom = true;
    state.plan = plan;
    state.cities = plan.cities;
    state.layoutKey = `${plan.outlineSeed}|${plan.cities.map((c) => `${c.x}_${c.y}_${c.pop / POPULATION_STEP}`).join('-')}|${attempt}`;
    state.layoutData = { outline: layout.outline, points: layout.points, totals: layout.totals, densityIndex: layout.densityIndex };
    return { ok: true, state };
  }
  return { ok: false, reason: 'layout' };
}

// A new state with new voters on the same layout: the precincts keep their shapes, neighbors, and reference plan.
export function applyVoterSettings(state, settings) {
  const plan = withSettings(state.plan, settings);
  const voters = voterPhase(state.layoutData, plan);
  const precincts = state.precincts.map((precinct, i) => ({
    ...precinct,
    sideAVoters: voters.sideA[i],
    sideBVoters: precinct.totalVoters - voters.sideA[i],
  }));
  const next = { ...state, seed: encodeCustomCode(plan), plan, precincts, precinctsById: new Map(precincts.map((c) => [c.id, c])), statewideShareA: voters.statewideShareA };
  next.districts = summarizeDistricts(next);
  return next;
}
