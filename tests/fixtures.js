// Shared test helpers: memoized state builders (most tests ask for the same seeds and plans again and again). A state is never
// changed by the app or by a test (edits build new objects), so sharing is safe. Tests that check reproducibility or speed use
// the fresh versions.
import { generateState as generate } from '../src/state-generator.js';
import { buildCustomState as buildCustom } from '../src/custom-state.js';

const states = new Map();
export function generateState(options) {
  const key = JSON.stringify(options);
  if (!states.has(key)) states.set(key, generate(options));
  return states.get(key);
}

const builds = new Map();
export function buildCustomState(plan) {
  const key = JSON.stringify(plan);
  if (!builds.has(key)) builds.set(key, buildCustom(plan));
  return builds.get(key);
}

export const freshGenerateState = generate;
export const freshBuildCustomState = buildCustom;
