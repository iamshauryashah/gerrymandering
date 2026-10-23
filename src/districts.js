import { connectedComponents, gridCellCenter, interiorDistances } from './geometry.js';
import { getResult } from './formatters.js';

function validateDistrictNumber(state, districtNumber) {
  if (!Number.isInteger(districtNumber) || districtNumber < 1 || districtNumber > state.districtCount) {
    throw new Error(`Invalid district number: ${districtNumber}. Expected 1 to ${state.districtCount}`);
  }
}

function precinctLookup(state) {
  return state.precinctsById ?? new Map(state.precincts.map((c) => [c.id, c]));
}

function aggregate(state, districtNumber, byId) {
  const precinctIds = state.precincts.filter((c) => state.assignments[c.id] === districtNumber).map((c) => c.id);
  let sideAVoters = 0;
  let sideBVoters = 0;
  for (const id of precinctIds) {
    sideAVoters += byId.get(id).sideAVoters;
    sideBVoters += byId.get(id).sideBVoters;
  }
  const result = getResult(sideAVoters, sideBVoters);
  const inDistrict = new Set(precinctIds);
  const components = connectedComponents(precinctIds, (id) => byId.get(id).neighbors.filter((n) => inDistrict.has(n)))
    .sort((a, b) => b.length - a.length || componentArea(b, byId) - componentArea(a, byId));
  return { number: districtNumber, precinctIds, ...result, components };
}

function componentArea(ids, byId) {
  return ids.reduce((sum, id) => sum + byId.get(id).area, 0);
}

function largestComponent(district, byId) {
  return [...district.components].sort((a, b) => componentArea(b, byId) - componentArea(a, byId))[0];
}

// Picks the most interior sampled point of each district's largest connected part for its number badge.
function attachLabelPoints(state, districts, byId) {
  const { grid } = state;
  if (!grid) return districts;
  const districtOfIndex = state.precincts.map((c) => state.assignments[c.id] ?? null);
  const groupOfCell = (cell) => {
    const owner = grid.owner[cell];
    return owner < 0 ? null : districtOfIndex[owner];
  };
  const distance = interiorDistances(grid, groupOfCell);
  const targets = new Map();
  for (const district of districts) {
    if (!district.precinctIds.length) continue;
    const allowed = new Set(largestComponent(district, byId).map((id) => byId.get(id).index));
    targets.set(district.number, { allowed, best: -1, bestDistance: -1 });
  }
  for (let i = 0; i < grid.owner.length; i += 1) {
    const owner = grid.owner[i];
    if (owner < 0) continue;
    const target = targets.get(districtOfIndex[owner]);
    if (!target || !target.allowed.has(owner)) continue;
    if (distance[i] > target.bestDistance) {
      target.bestDistance = distance[i];
      target.best = i;
    }
  }
  return districts.map((district) => {
    const target = targets.get(district.number);
    if (!target || target.best < 0) return district;
    const [x, y] = gridCellCenter(grid, target.best);
    return { ...district, labelPoint: [x, y], labelRoom: target.bestDistance * grid.cellSize };
  });
}

export function summarizeDistrict(state, districtNumber) {
  validateDistrictNumber(state, districtNumber);
  const byId = precinctLookup(state);
  return attachLabelPoints(state, [aggregate(state, districtNumber, byId)], byId)[0];
}

export function summarizeDistricts(state, { labels = true } = {}) {
  const byId = precinctLookup(state);
  const districts = Array.from({ length: state.districtCount }, (_, i) => aggregate(state, i + 1, byId));
  // Badge placement is the costly part, so a drag in progress can skip it and place the badges once at the end.
  return labels ? attachLabelPoints(state, districts, byId) : districts;
}

export function reassignPrecinct(state, precinctId, districtNumber) {
  const byId = precinctLookup(state);
  if (!byId.has(precinctId)) throw new Error(`Invalid precinct ID: ${precinctId}`);
  if (districtNumber !== null) validateDistrictNumber(state, districtNumber);
  if ((state.assignments[precinctId] ?? null) === districtNumber) return state;
  const next = { ...state, assignments: { ...state.assignments, [precinctId]: districtNumber } };
  next.districts = summarizeDistricts(next);
  return next;
}

// Applies many changes at once ({ precinctId: districtNumber | null }) and summarizes the districts once.
export function reassignPrecincts(state, changes, { labels = true } = {}) {
  const byId = precinctLookup(state);
  const assignments = { ...state.assignments };
  let changed = false;
  for (const [id, districtNumber] of Object.entries(changes)) {
    if (!byId.has(id)) throw new Error(`Invalid precinct ID: ${id}`);
    if (districtNumber !== null) validateDistrictNumber(state, districtNumber);
    if ((assignments[id] ?? null) === districtNumber) continue;
    assignments[id] = districtNumber;
    changed = true;
  }
  if (!changed) return state;
  const next = { ...state, assignments };
  next.districts = summarizeDistricts(next, { labels });
  return next;
}

function membersOf(state, districtNumber) {
  return state.precincts.filter((c) => state.assignments[c.id] === districtNumber).map((c) => c.id);
}

export function isContiguous(state, precinctIds) {
  if (precinctIds.length <= 1) return true;
  const byId = precinctLookup(state);
  const inside = new Set(precinctIds);
  return connectedComponents(precinctIds, (id) => byId.get(id).neighbors.filter((n) => inside.has(n))).length === 1;
}

function splitsWithout(state, districtNumber, precinctId) {
  return !isContiguous(state, membersOf(state, districtNumber).filter((id) => id !== precinctId));
}

// Decides what clicking a precinct does while a district is selected, and whether it would break a district apart.
export function getEditAction(state, precinctId, selected) {
  const byId = precinctLookup(state);
  const precinct = byId.get(precinctId);
  if (!precinct) throw new Error(`Invalid precinct ID: ${precinctId}`);
  validateDistrictNumber(state, selected);
  const from = state.assignments[precinctId] ?? null;
  if (from === selected) {
    const allowed = !splitsWithout(state, selected, precinctId);
    return { action: 'remove', from, to: null, allowed, reason: allowed ? null : 'split-selected' };
  }
  const action = from === null ? 'add' : 'move';
  const target = membersOf(state, selected);
  if (target.length && !precinct.neighbors.some((n) => state.assignments[n] === selected)) {
    return { action, from, to: selected, allowed: false, reason: 'not-adjacent' };
  }
  if (from !== null && splitsWithout(state, from, precinctId)) {
    return { action, from, to: selected, allowed: false, reason: 'split-source' };
  }
  return { action, from, to: selected, allowed: true, reason: null };
}

export function applyPrecinctEdit(state, precinctId, selected) {
  const edit = getEditAction(state, precinctId, selected);
  if (!edit.allowed) return { state, edit };
  return { state: reassignPrecinct(state, precinctId, edit.to), edit };
}

export function countUnassigned(state) {
  return state.precincts.filter((c) => (state.assignments[c.id] ?? null) === null).length;
}

export const DEFAULT_BALANCE_RATIO = 0.1;

// Passes when no district is empty and the largest district has at most `ratio` more voters than the smallest.
export function getBalance(state, districts = state.districts ?? summarizeDistricts(state)) {
  const ratio = state.balanceRatio ?? DEFAULT_BALANCE_RATIO;
  const totalVoters = state.totalVoters ?? state.precincts.reduce((sum, c) => sum + c.totalVoters, 0);
  const ideal = Math.round(totalVoters / state.districtCount);
  const filled = districts.filter((d) => d.precinctIds.length);
  const totals = filled.map((d) => d.totalVoters);
  const largest = totals.length ? Math.max(...totals) : 0;
  const smallest = totals.length ? Math.min(...totals) : 0;
  const empty = districts.length - filled.length;
  // If every district is inside ideal × (1 ± r), then largest / smallest ≤ (1 + r) / (1 − r) = 1 + ratio.
  const r = ratio / (2 + ratio);
  const upper = Math.floor(ideal * (1 + r));
  const lower = Math.ceil(ideal * (1 - r));
  return {
    pass: empty === 0 && largest <= smallest * (1 + ratio),
    ratio,
    ideal,
    upper,
    lower,
    largest,
    smallest,
    difference: largest - smallest,
    differencePercent: smallest > 0 ? Math.round(((largest - smallest) / smallest) * 1000) / 10 : 0,
    empty,
    districts: districts.map((d) => {
      let balance = 'ok';
      let offset = 0;
      if (!d.precinctIds.length) balance = 'empty';
      else if (d.totalVoters > upper) {
        balance = 'over';
        offset = d.totalVoters - upper;
      } else if (d.totalVoters < lower) {
        balance = 'under';
        offset = d.totalVoters - lower;
      }
      return { number: d.number, balance, offset };
    }),
  };
}

export function getPlanStatus(state, districts = state.districts ?? summarizeDistricts(state)) {
  const unassigned = countUnassigned(state);
  const contiguous = districts.every((d) => d.components.length <= 1);
  const balance = getBalance(state, districts);
  return {
    valid: unassigned === 0 && contiguous && balance.pass,
    complete: unassigned === 0,
    unassigned,
    contiguous,
    balanced: balance.pass,
    balance,
  };
}

export function getControlTotal(districts, state = null) {
  const total = { sideA: 0, sideB: 0, tied: 0, empty: 0 };
  for (const district of districts) {
    if (district.status === 'sideA') total.sideA += 1;
    else if (district.status === 'sideB') total.sideB += 1;
    else if (district.status === 'tie') total.tied += 1;
    else total.empty += 1;
  }
  if (state) total.unassigned = countUnassigned(state);
  return total;
}
