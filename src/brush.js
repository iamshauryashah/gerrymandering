import { connectedComponents } from './geometry.js';
import { reassignPrecincts } from './districts.js';

export const BRUSH_SIZE = Object.freeze({ min: 10, max: 150, step: 5, default: 50 });
export const BRUSH_MODES = Object.freeze(['add', 'erase']);

const centerOf = (precinct) => precinct.center ?? precinct.seedPoint;

// Where along the segment a point lands (0 at `a`, 1 at `b`) and how far it is from the segment.
function projectOnSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
  return { t, distance: Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)) };
}

// Ids of the precincts whose center is within `radius` of the segment from a to b (a click is a segment with a = b),
// ordered along the segment, then by distance from it, then by id.
export function precinctsInCapsule(state, a, b, radius) {
  const hits = [];
  for (const precinct of state.precincts) {
    const { t, distance } = projectOnSegment(centerOf(precinct), a, b);
    if (distance <= radius) hits.push({ id: precinct.id, t, distance });
  }
  hits.sort((x, y) => x.t - y.t || x.distance - y.distance || (x.id < y.id ? -1 : 1));
  return hits.map((hit) => hit.id);
}

export function startStroke(state, { district, mode = 'add', radius = BRUSH_SIZE.default, unclaimedOnly = false }) {
  return { district, mode, radius, unclaimedOnly: Boolean(unclaimedOnly) && mode === 'add', before: state.assignments, covered: new Set(), reasons: new Map() };
}

function membersByDistrict(state) {
  const members = new Map();
  for (const precinct of state.precincts) {
    const district = state.assignments[precinct.id] ?? null;
    if (district === null) continue;
    if (!members.has(district)) members.set(district, new Set());
    members.get(district).add(precinct.id);
  }
  return members;
}

// Applies one segment of a stroke by the same rules as a single click, precinct by precinct in a fixed order, repeating
// passes until nothing more changes. It never leaves a district in two pieces, and the same segment on the same plan
// always gives the same plan.
export function applySegment(state, stroke, a, b, { labels = true } = {}) {
  const { district: selected, mode } = stroke;
  const ids = precinctsInCapsule(state, a, b, stroke.radius);
  for (const id of ids) stroke.covered.add(id);
  if (!ids.length) return { state, stroke, changed: 0 };

  const byId = state.precinctsById;
  const working = { ...state.assignments };
  const members = membersByDistrict(state);
  const setOf = (district) => {
    if (!members.has(district)) members.set(district, new Set());
    return members.get(district);
  };
  const changes = {};
  const assign = (id, to) => {
    const from = working[id] ?? null;
    if (from !== null) setOf(from).delete(id);
    if (to !== null) setOf(to).add(id);
    working[id] = to;
    changes[id] = to;
  };
  // A district stays one piece without this precinct (a district with no or one precinct left always does).
  const staysConnectedWithout = (district, id) => {
    const rest = [...setOf(district)].filter((m) => m !== id);
    if (rest.length <= 1) return true;
    const inside = new Set(rest);
    return connectedComponents(rest, (m) => byId.get(m).neighbors.filter((n) => inside.has(n))).length === 1;
  };

  if (mode === 'erase') {
    for (let progress = true; progress;) {
      progress = false;
      for (const id of ids) {
        if (working[id] !== selected) continue;
        if (staysConnectedWithout(selected, id)) {
          assign(id, null);
          stroke.reasons.delete(id);
          progress = true;
        } else {
          stroke.reasons.set(id, 'splits-selected');
        }
      }
    }
  } else {
    // An empty district starts with the covered precinct nearest the start of the segment.
    const order = setOf(selected).size
      ? ids
      : [...ids].sort((p, q) => Math.hypot(...centerOf(byId.get(p)).map((v, k) => v - a[k])) - Math.hypot(...centerOf(byId.get(q)).map((v, k) => v - a[k])) || (p < q ? -1 : 1));
    for (let progress = true; progress;) {
      progress = false;
      for (const id of order) {
        if (working[id] === selected) continue;
        const from = working[id] ?? null;
        if (stroke.unclaimedOnly && from !== null) {
          stroke.reasons.set(id, 'claimed');
          continue;
        }
        const target = setOf(selected);
        if (target.size && !byId.get(id).neighbors.some((n) => target.has(n))) {
          stroke.reasons.set(id, 'not-adjacent');
          continue;
        }
        if (from !== null && !staysConnectedWithout(from, id)) {
          stroke.reasons.set(id, 'splits-source');
          continue;
        }
        assign(id, selected);
        stroke.reasons.delete(id);
        progress = true;
      }
    }
  }

  const changed = Object.keys(changes).length;
  if (!changed) return { state, stroke, changed };
  return { state: reassignPrecincts(state, changes, { labels }), stroke, changed };
}

// One click, tap, or key press: a stroke of a single segment with a = b.
export function strokeAt(state, { district, mode = 'add', radius = BRUSH_SIZE.default, unclaimedOnly = false }, point) {
  const stroke = startStroke(state, { district, mode, radius, unclaimedOnly });
  const applied = applySegment(state, stroke, point, point);
  return { state: applied.state, ...finishStroke(applied.state, stroke) };
}

const plural = (n, word) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

function reasonText(reason, district) {
  if (reason === 'not-adjacent') return `not touching District ${district}`;
  if (reason === 'splits-source') return 'would split another district';
  if (reason === 'claimed') return 'already in another district';
  return `would split District ${district}`;
}

// Compares the plan before the stroke with the plan now: every precinct the brush touched is exactly one of added, moved,
// removed, unchanged (already as wanted), or skipped, so the five always add up to `covered`.
export function finishStroke(state, stroke) {
  const { district, mode } = stroke;
  const result = { added: 0, moved: 0, removed: 0, unchanged: 0, skipped: 0, covered: stroke.covered.size, reasons: {}, changed: [] };
  for (const id of stroke.covered) {
    const before = stroke.before[id] ?? null;
    const after = state.assignments[id] ?? null;
    if (mode === 'erase') {
      if (before !== district) result.unchanged += 1;
      else if (after !== district) {
        result.removed += 1;
        result.changed.push(id);
      } else {
        result.skipped += 1;
        result.reasons['splits-selected'] = (result.reasons['splits-selected'] ?? 0) + 1;
      }
    } else if (after === district) {
      if (before === district) result.unchanged += 1;
      else {
        if (before === null) result.added += 1;
        else result.moved += 1;
        result.changed.push(id);
      }
    } else {
      const reason = stroke.reasons.get(id) ?? 'not-adjacent';
      result.skipped += 1;
      result.reasons[reason] = (result.reasons[reason] ?? 0) + 1;
    }
  }
  result.message = describeStroke(result, district, mode);
  return result;
}

function describeStroke(result, district, mode) {
  const { covered, added, moved, removed, unchanged, skipped, reasons } = result;
  if (!covered) return 'No precincts under the brush.';
  const skippedText = Object.keys(reasons).map((reason) => reasonText(reason, district)).join(' or ');
  if (added + moved + removed === 0) {
    if (skipped === 0) {
      return mode === 'erase'
        ? `No precincts were changed: none of the ${plural(covered, 'precinct')} under the brush are in District ${district}.`
        : `No precincts were changed: all ${plural(covered, 'precinct')} under the brush are already in District ${district}.`;
    }
    return `No precincts were changed: ${plural(skipped, 'precinct')} under the brush ${skippedText}.`;
  }
  const parts = [];
  if (added) parts.push(`added ${plural(added, 'precinct')}`);
  if (moved) parts.push(`moved ${plural(moved, 'precinct')}`);
  if (removed) parts.push(`removed ${plural(removed, 'precinct')}`);
  if (unchanged) parts.push(mode === 'erase' ? `${unchanged.toLocaleString('en-US')} not in District ${district}` : `${unchanged.toLocaleString('en-US')} already in District ${district}`);
  if (skipped) parts.push(`skipped ${skipped.toLocaleString('en-US')} (${skippedText})`);
  const text = parts.join(', ');
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}
