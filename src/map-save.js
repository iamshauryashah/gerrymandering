import { summarizeDistricts } from './districts.js';
import { MATCHUPS } from './matchups.js';

export const MAX_SAVE_BYTES = 2 * 1024 * 1024;
const fail = () => { throw new Error('This saved map is invalid or uses an unsupported format.'); };
const integer = (n, min, max) => Number.isSafeInteger(n) && n >= min && n <= max;
const record = (v) => v && typeof v === 'object' && !Array.isArray(v);
const point = (v) => Array.isArray(v) && v.length === 2 && v.every(n => Number.isFinite(n) && Math.abs(n) <= 10000);
const polygon = (v, max = 1000) => Array.isArray(v) && v.length >= 3 && v.length <= max && v.every(point);

// Store the original voters and complete geometry, not just a regeneratable seed.
// Derived lookup tables and district results are rebuilt when the save opens.
export function captureMap(state, baseline, swing, matchup) {
  const { precinctsById, districts, layoutKey, ...map } = state;
  const snapshot = JSON.parse(JSON.stringify({
    version: 1,
    map: { ...map, precincts: baseline, grid: { ...state.grid, owner: Array.from(state.grid.owner) } },
    swing,
    matchup,
  }));
  validateMap(snapshot);
  return snapshot;
}

export function validateMap(snapshot) {
  if (!record(snapshot) || snapshot.version !== 1 || !record(snapshot.map)) fail();
  if (!MATCHUPS.some(m => m.id === snapshot.matchup) || !Number.isFinite(snapshot.swing) || Math.abs(snapshot.swing) > 6) fail();
  const m = snapshot.map;
  if (typeof m.seed !== 'string' || !m.seed || m.seed.length > 300 || typeof m.name !== 'string' || m.name.length > 100) fail();
  if (m.width !== 800 || m.height !== 600 || !integer(m.districtCount, 1, 50) || !polygon(m.outline)) fail();
  if (!Array.isArray(m.precincts) || !integer(m.precincts.length, 1, 1500) || !record(m.assignments)) fail();
  const ids = new Set(m.precincts.map(p => p.id));
  if (ids.size !== m.precincts.length) fail();
  let total = 0;
  for (const [i, p] of m.precincts.entries()) {
    if (typeof p.id !== 'string' || !/^[a-zA-Z0-9_-]{1,50}$/.test(p.id) || p.index !== i) fail();
    if (typeof p.name !== 'string' || p.name.length > 100 || !polygon(p.polygon, 100) || !point(p.center) || !point(p.seedPoint)) fail();
    if (!Number.isFinite(p.area) || p.area <= 0 || !Number.isFinite(p.density) || !Number.isFinite(p.densityIndex)) fail();
    if (!['urban', 'suburban', 'rural'].includes(p.type)) fail();
    if (!integer(p.totalVoters, 1, 1000000000) || !integer(p.sideAVoters, 0, p.totalVoters) || p.sideBVoters !== p.totalVoters - p.sideAVoters) fail();
    if (!Array.isArray(p.neighbors) || p.neighbors.length > 100 || !p.neighbors.every(id => ids.has(id))) fail();
    if (!Object.hasOwn(m.assignments, p.id) || (m.assignments[p.id] !== null && !integer(m.assignments[p.id], 1, m.districtCount))) fail();
    total += p.totalVoters;
  }
  if (Object.keys(m.assignments).length !== ids.size || m.totalVoters !== total || !integer(total, 1, Number.MAX_SAFE_INTEGER)) fail();
  const g = m.grid;
  if (!record(g) || !integer(g.cols, 1, 800) || !integer(g.rows, 1, 600) || !Number.isFinite(g.cellSize) || g.cellSize <= 0) fail();
  if (g.cols !== Math.ceil(800 / g.cellSize) || g.rows !== Math.ceil(600 / g.cellSize)) fail();
  if (!Array.isArray(g.owner) || g.owner.length > 200000 || g.owner.length !== g.cols * g.rows || !g.owner.every(n => integer(n, -1, ids.size - 1))) fail();
  return snapshot;
}

export function restoreMap(snapshot) {
  validateMap(snapshot);
  const state = structuredClone(snapshot.map);
  state.grid.owner = Int16Array.from(state.grid.owner);
  state.precinctsById = new Map(state.precincts.map(p => [p.id, p]));
  // Each open gets a new layout identity, even for two saves of the same seed.
  state.layoutKey = state.precincts;
  state.districts = summarizeDistricts(state);
  return { state, swing: snapshot.swing, matchup: snapshot.matchup };
}
