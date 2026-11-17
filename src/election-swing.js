import { summarizeDistricts } from './districts.js';

// Negative points favor side A; positive points favor side B.
export function normalizeSwing(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(Math.max(-6, Math.min(6, number)) * 10) / 10 : 0;
}

// Always start from the original voters, so dragging back to zero is exact.
export function applyElectionSwing(state, baseline, value) {
  const points = normalizeSwing(value);
  const byId = new Map(baseline.map((precinct) => [precinct.id, precinct]));
  const precincts = state.precincts.map((precinct) => {
    const original = byId.get(precinct.id);
    if (!original) throw new Error('Swing baseline does not match this map.');
    const sideAVoters = points === 0 ? original.sideAVoters
      : Math.round(Math.max(0, Math.min(precinct.totalVoters, original.sideAVoters - precinct.totalVoters * points / 100)));
    return { ...precinct, sideAVoters, sideBVoters: precinct.totalVoters - sideAVoters };
  });
  const total = precincts.reduce((sum, p) => sum + p.totalVoters, 0);
  const sideA = precincts.reduce((sum, p) => sum + p.sideAVoters, 0);
  const next = { ...state, precincts, precinctsById: new Map(precincts.map((p) => [p.id, p])), statewideShareA: total ? sideA / total : 0 };
  next.districts = summarizeDistricts(next);
  return next;
}
