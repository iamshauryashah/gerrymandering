import { test, assert, assertEqual } from './test-runner.js';
import { generateState } from './fixtures.js';
import { createRandom, randomBetween, randomInt } from '../src/random.js';
import { reassignPrecincts, summarizeDistricts } from '../src/districts.js';
import { BRUSH_SIZE, applySegment, finishStroke, precinctsInCapsule, startStroke, strokeAt } from '../src/brush.js';
import { pointInPolygon } from '../src/geometry.js';
import { EXPECTED, playStrokes } from './brush-baseline.js';

const states = new Map();
const stateFor = (seed) => {
  if (!states.has(seed)) states.set(seed, generateState({ seed }));
  return states.get(seed);
};

const centerOf = (p) => p.center ?? p.seedPoint;
const assign = (state, entries) => reassignPrecincts(state, Object.fromEntries(entries), { labels: false });
const membersOf = (state, district) => state.precincts.filter((p) => state.assignments[p.id] === district).map((p) => p.id);
const pieces = (state, district) => summarizeDistricts(state, { labels: false })[district - 1].components.length;
const allContiguous = (state) => summarizeDistricts(state, { labels: false }).every((d) => d.components.length <= 1);

function distanceToSegment(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

// A precinct with two neighbors that do not touch each other, as the middle of a chain of three: A - B - C.
function findChain(state) {
  for (const middle of state.precincts) {
    const near = middle.neighbors;
    for (const a of near) {
      for (const c of near) {
        if (a < c && !state.precinctsById.get(a).neighbors.includes(c) && near.length >= 3) {
          const outsider = near.find((n) => n !== a && n !== c);
          return { a, b: middle.id, c, outsider };
        }
      }
    }
  }
  return null;
}

const run = (state, stroke, a, b, options = {}) => applySegment(state, stroke, a, b, { labels: false, ...options });

test('the brush covers exactly the precincts whose centers are within the radius of the segment, ordered along it (FR-017, FR-018)', () => {
  const state = stateFor('brush-1');
  const random = createRandom('capsule');
  for (let i = 0; i < 40; i += 1) {
    const a = [randomBetween(random, 50, 750), randomBetween(random, 50, 550)];
    const b = i % 4 === 0 ? a : [a[0] + randomBetween(random, -200, 200), a[1] + randomBetween(random, -200, 200)];
    const radius = randomInt(random, BRUSH_SIZE.min, BRUSH_SIZE.max);
    const ids = precinctsInCapsule(state, a, b, radius);
    const expected = state.precincts.filter((p) => distanceToSegment(centerOf(p), a, b) <= radius).map((p) => p.id);
    assertEqual([...ids].sort(), [...expected].sort(), `capsule ${i}`);
    const along = ids.map((id) => {
      const c = centerOf(state.precinctsById.get(id));
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = dx * dx + dy * dy;
      return len === 0 ? 0 : Math.min(1, Math.max(0, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / len));
    });
    assert(along.every((t, k) => k === 0 || t >= along[k - 1] - 1e-9), 'ordered along the segment');
  }
});

test('the brush size range matches the spec: about 1-3 precincts at the smallest, a quarter of the state or more at the largest (FR-015, SC-007)', () => {
  const state = stateFor('brush-2');
  assertEqual([BRUSH_SIZE.min, BRUSH_SIZE.max, BRUSH_SIZE.step, BRUSH_SIZE.default], [10, 150, 5, 50]);
  const random = createRandom('sizes');
  let smallTotal = 0;
  let samples = 0;
  let largeShare = 1;
  while (samples < 60) {
    const p = [randomBetween(random, 80, 720), randomBetween(random, 80, 520)];
    if (!pointInPolygon(p, state.outline)) continue;
    smallTotal += precinctsInCapsule(state, p, p, BRUSH_SIZE.min).length;
    samples += 1;
  }
  assert(smallTotal / samples >= 0.5 && smallTotal / samples <= 4, `the smallest brush covers ${(smallTotal / samples).toFixed(1)} precincts on average`);
  const xs = state.outline.map((q) => q[0]);
  const ys = state.outline.map((q) => q[1]);
  const middle = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  const near = state.precincts.reduce((best, p) => (Math.hypot(centerOf(p)[0] - middle[0], centerOf(p)[1] - middle[1]) < Math.hypot(centerOf(best)[0] - middle[0], centerOf(best)[1] - middle[1]) ? p : best));
  largeShare = precinctsInCapsule(state, centerOf(near), centerOf(near), BRUSH_SIZE.max).length / state.precincts.length;
  assert(largeShare >= 0.1, `the largest brush near the middle covers ${(largeShare * 100).toFixed(0)}% of the precincts`);
  assert(2 * BRUSH_SIZE.max >= (Math.max(...xs) - Math.min(...xs)) / 4, 'the largest circle is at least a quarter of the state wide');
});

test('add on an empty district starts at the precinct nearest the start and adds only connected precincts (FR-021)', () => {
  const state = stateFor('brush-3');
  const start = centerOf(state.precincts[100]);
  const stroke = startStroke(state, { district: 3, mode: 'add', radius: 45 });
  const { state: next } = run(state, stroke, start, start);
  const members = membersOf(next, 3);
  assert(members.length > 3, `${members.length} precincts added`);
  assertEqual(pieces(next, 3), 1, 'one connected piece');
  const nearest = precinctsInCapsule(state, start, start, 45)[0];
  assert(members.includes(nearest), 'the precinct nearest the start is in');
  assert(members.every((id) => Math.hypot(centerOf(next.precinctsById.get(id))[0] - start[0], centerOf(next.precinctsById.get(id))[1] - start[1]) <= 45), 'only covered precincts');
});

test('add on a non-empty district takes only precincts connected to it (FR-020)', () => {
  const state = stateFor('brush-3');
  const first = centerOf(state.precincts[100]);
  let current = run(state, startStroke(state, { district: 3, mode: 'add', radius: 30 }), first, first).state;
  const before = membersOf(current, 3);
  const far = centerOf(state.precincts.reduce((best, p) => (Math.hypot(centerOf(p)[0] - first[0], centerOf(p)[1] - first[1]) > Math.hypot(centerOf(best)[0] - first[0], centerOf(best)[1] - first[1]) ? p : best)));
  const stroke = startStroke(current, { district: 3, mode: 'add', radius: 30 });
  const applied = run(current, stroke, far, far);
  assertEqual(membersOf(applied.state, 3), before, 'a stroke far from the district changes nothing');
  assert([...stroke.reasons.values()].every((reason) => reason === 'not-adjacent'), 'the covered precincts were skipped as not touching');
  assertEqual(finishStroke(applied.state, stroke).skipped, stroke.covered.size, 'all skipped');
  // A stroke that starts inside the district and reaches out adds a connected extension.
  const reach = run(current, startStroke(current, { district: 3, mode: 'add', radius: 30 }), first, [first[0] + 60, first[1]]);
  assert(membersOf(reach.state, 3).length > before.length, 'a stroke from the district grows it');
  assertEqual(pieces(reach.state, 3), 1, 'still one piece');
  current = reach.state;
});

test('moving a precinct out of another district is refused when that district would split (FR-022)', () => {
  const state = stateFor('brush-4');
  const chain = findChain(state);
  assert(chain, 'the state has a chain of three precincts');
  const base = assign(state, [[chain.a, 2], [chain.b, 2], [chain.c, 2], [chain.outsider, 1]]);
  assertEqual(pieces(base, 2), 1, 'district 2 starts as one piece');
  const point = centerOf(state.precinctsById.get(chain.b));
  const stroke = startStroke(base, { district: 1, mode: 'add', radius: 3 });
  const result = run(base, stroke, point, point);
  assertEqual(result.state.assignments[chain.b], 2, 'the middle precinct stays');
  assertEqual(stroke.reasons.get(chain.b), 'splits-source');
  // An end precinct can move.
  const end = centerOf(state.precinctsById.get(chain.a));
  const base2 = assign(base, [[chain.outsider, 1]]);
  const touching = state.precinctsById.get(chain.a).neighbors.includes(chain.outsider);
  const moved = run(base2, startStroke(base2, { district: 1, mode: 'add', radius: 3 }), end, end);
  if (touching) assertEqual(moved.state.assignments[chain.a], 1, 'an end precinct moves when it touches the district');
  assert(allContiguous(moved.state), 'every district is still connected');
});

test('erase removes only precincts that keep the district connected, and repeats until it can remove no more (FR-023)', () => {
  const state = stateFor('brush-4');
  const chain = findChain(state);
  const base = assign(state, [[chain.a, 2], [chain.b, 2], [chain.c, 2]]);
  const middle = centerOf(state.precinctsById.get(chain.b));
  const guarded = startStroke(base, { district: 2, mode: 'erase', radius: 3 });
  const kept = run(base, guarded, middle, middle);
  assertEqual(kept.state.assignments[chain.b], 2, 'the middle precinct is kept');
  assertEqual(guarded.reasons.get(chain.b), 'splits-selected');
  const all = startStroke(base, { district: 2, mode: 'erase', radius: 150 });
  const cleared = run(base, all, middle, middle);
  assertEqual(membersOf(cleared.state, 2), [], 'passes repeat until the district is empty');
});

test('the same segment on the same plan always gives the same plan (FR-024)', () => {
  const state = stateFor('brush-5');
  const a = centerOf(state.precincts[200]);
  const b = [a[0] + 90, a[1] + 40];
  const seed = run(state, startStroke(state, { district: 4, mode: 'add', radius: 40 }), a, a).state;
  const one = run(seed, startStroke(seed, { district: 5, mode: 'add', radius: 35 }), a, b).state;
  const two = run(seed, startStroke(seed, { district: 5, mode: 'add', radius: 35 }), a, b).state;
  assertEqual(one.assignments, two.assignments);
});

test('random strokes never split a district or put a precinct in two (FR-024, SC-004)', () => {
  for (let s = 0; s < 12; s += 1) {
    let state = stateFor(`brush-prop-${s}`);
    const random = createRandom(`strokes-${s}`);
    for (let i = 0; i < 80; i += 1) {
      const district = randomInt(random, 1, state.districtCount);
      const mode = random() < 0.25 ? 'erase' : 'add';
      const radius = randomInt(random, BRUSH_SIZE.min / BRUSH_SIZE.step, BRUSH_SIZE.max / BRUSH_SIZE.step) * BRUSH_SIZE.step;
      const stroke = startStroke(state, { district, mode, radius });
      let a = [randomBetween(random, 40, 760), randomBetween(random, 40, 560)];
      for (let k = 0; k < randomInt(random, 1, 3); k += 1) {
        const b = random() < 0.3 ? a : [a[0] + randomBetween(random, -150, 150), a[1] + randomBetween(random, -150, 150)];
        state = run(state, stroke, a, b).state;
        a = b;
      }
      assert(allContiguous(state), `seed ${s} stroke ${i}: a district was split`);
    }
    const counted = summarizeDistricts(state, { labels: false }).reduce((sum, d) => sum + d.precinctIds.length, 0);
    assertEqual(counted + state.precincts.filter((p) => state.assignments[p.id] === null).length, state.precincts.length, `seed ${s}: every precinct is in at most one district`);
  }
});

test('a stroke summary adds up: added + moved + removed + unchanged + skipped = covered (SC-008)', () => {
  for (let s = 0; s < 10; s += 1) {
    let state = stateFor(`brush-sum-${s}`);
    const random = createRandom(`sum-${s}`);
    for (let i = 0; i < 25; i += 1) {
      const district = randomInt(random, 1, state.districtCount);
      const mode = random() < 0.3 ? 'erase' : 'add';
      const radius = randomInt(random, 2, 30) * 5;
      const before = state.assignments;
      const stroke = startStroke(state, { district, mode, radius });
      let a = [randomBetween(random, 40, 760), randomBetween(random, 40, 560)];
      for (let k = 0; k < randomInt(random, 1, 15); k += 1) {
        const b = [a[0] + randomBetween(random, -60, 60), a[1] + randomBetween(random, -60, 60)];
        state = run(state, stroke, a, b).state;
        a = b;
      }
      const summary = finishStroke(state, stroke);
      assertEqual(summary.added + summary.moved + summary.removed + summary.unchanged + summary.skipped, summary.covered, `seed ${s} stroke ${i}`);
      assertEqual(summary.covered, stroke.covered.size);
      const changed = state.precincts.filter((p) => (before[p.id] ?? null) !== (state.assignments[p.id] ?? null)).map((p) => p.id);
      assertEqual([...summary.changed].sort(), changed.sort(), 'the summary lists exactly the precincts that changed');
      assertEqual(summary.added + summary.moved + summary.removed, changed.length, 'the changes add up');
    }
  }
});

test('a precinct skipped early in a drag and applied later counts as applied (R8)', () => {
  const state = stateFor('brush-6');
  const first = centerOf(state.precincts[150]);
  const seeded = run(state, startStroke(state, { district: 2, mode: 'add', radius: 25 }), first, first).state;
  const members = membersOf(seeded, 2);
  assert(members.length >= 1, 'a district to grow');
  // The first segment is away from the district (skipped), the second goes back to it and on (applied).
  const away = [first[0] + 140, first[1]];
  const stroke = startStroke(seeded, { district: 2, mode: 'add', radius: 30 });
  let now = run(seeded, stroke, away, away).state;
  const skippedBefore = [...stroke.covered].filter((id) => !membersOf(now, 2).includes(id));
  assert(skippedBefore.length > 0, 'the first segment skipped precincts');
  now = run(now, stroke, away, first).state;
  const summary = finishStroke(now, stroke);
  assertEqual(summary.added + summary.moved + summary.removed + summary.unchanged + summary.skipped, summary.covered);
  const nowMembers = new Set(membersOf(now, 2));
  const appliedLater = skippedBefore.filter((id) => nowMembers.has(id));
  assert(summary.changed.length >= appliedLater.length, 'precincts applied later are counted as changes');
  assert(summary.skipped === [...stroke.covered].filter((id) => !nowMembers.has(id)).length, 'skipped counts only the ones that did not end up applied');
});

test('the skip reasons are reported for each kind of refusal, and the messages read well (FR-025)', () => {
  const state = stateFor('brush-4');
  const chain = findChain(state);
  const base = assign(state, [[chain.a, 2], [chain.b, 2], [chain.c, 2], [chain.outsider, 1]]);
  const middle = centerOf(state.precinctsById.get(chain.b));
  const splitSource = strokeAt(base, { district: 1, mode: 'add', radius: 3 }, middle);
  assertEqual(splitSource.reasons, { 'splits-source': 1 });
  assert(/^No precincts were changed: 1 precinct under the brush would split another district\.$/.test(splitSource.message), splitSource.message);
  const splitSelected = strokeAt(base, { district: 2, mode: 'erase', radius: 3 }, middle);
  assertEqual(splitSelected.reasons, { 'splits-selected': 1 });
  assert(/would split District 2\.$/.test(splitSelected.message), splitSelected.message);
  const alreadyIn = strokeAt(base, { district: 2, mode: 'add', radius: 3 }, middle);
  assert(/^No precincts were changed: all 1 precinct under the brush are already in District 2\.$/.test(alreadyIn.message), alreadyIn.message);
  const notIn = strokeAt(base, { district: 3, mode: 'erase', radius: 3 }, middle);
  assert(/^No precincts were changed: none of the 1 precinct under the brush are in District 3\.$/.test(notIn.message), notIn.message);
  const nothing = strokeAt(base, { district: 1, mode: 'add', radius: 10 }, [5, 5]);
  assertEqual(nothing.message, 'No precincts under the brush.');
  assertEqual(nothing.covered, 0);
  const grow = strokeAt(state, { district: 7, mode: 'add', radius: 60 }, centerOf(state.precincts[300]));
  assert(/^Added \d[\d,]* precincts?\.$/.test(grow.message), grow.message);
  assertEqual(grow.added, grow.covered, 'every covered precinct was added to an empty district');
  assertEqual(grow.state.precincts.filter((p) => grow.state.assignments[p.id] === 7).length, grow.added);
});

test('a drag replayed from the same plan gives the same plan and the same summary (FR-024)', () => {
  const state = stateFor('brush-7');
  const path = [[200, 200], [260, 230], [330, 260], [400, 270], [470, 300]];
  const play = () => {
    const stroke = startStroke(state, { district: 6, mode: 'add', radius: 35 });
    let now = state;
    for (let i = 1; i < path.length; i += 1) now = run(now, stroke, path[i - 1], path[i]).state;
    return { assignments: now.assignments, summary: finishStroke(now, stroke) };
  };
  const one = play();
  const two = play();
  assertEqual(one.assignments, two.assignments);
  assertEqual(one.summary, two.summary);
});

// ---- Feature 013: "only unclaimed precincts" ------------------------------------------------------------------------------

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

// District 1 painted around one precinct, and district 2 holding one unclaimed precinct next to it.
function neighborsPlan(seed = 'brush-3') {
  const state = stateFor(seed);
  const center = centerOf(state.precincts[100]);
  const one = run(state, startStroke(state, { district: 1, mode: 'add', radius: 50 }), center, center).state;
  const owned = membersOf(one, 1);
  const touching = owned.flatMap((id) => state.precinctsById.get(id).neighbors).find((id) => one.assignments[id] === null);
  const plan = assign(one, [[touching, 2]]);
  return { state, plan, center, owned, touching };
}

test('with the option on, the brush adds only unclaimed precincts and leaves every other district alone (013 FR-002, FR-003)', () => {
  const { plan, center, owned } = neighborsPlan();
  const options = { district: 2, mode: 'add', radius: 120, unclaimedOnly: true };
  const stroke = startStroke(plan, options);
  const next = run(plan, stroke, center, center).state;
  assertEqual(membersOf(next, 1), owned, 'district 1 keeps every precinct');
  const summary = finishStroke(next, stroke);
  assertEqual(summary.moved, 0);
  assertEqual(summary.removed, 0);
  assert(summary.added > 0, 'unclaimed precincts were added');
  assert(summary.reasons.claimed > 0, 'the claimed ones under the brush were skipped as claimed');
  for (const id of membersOf(next, 2)) assert(id === membersOf(plan, 2)[0] || plan.assignments[id] === null, 'every added precinct was unclaimed before');
  assert(allContiguous(next), 'every district is connected');
  const off = run(plan, startStroke(plan, { ...options, unclaimedOnly: false }), center, center).state;
  assert(membersOf(off, 1).length < owned.length, 'with the option off the same stroke does take precincts from district 1');
});

test('with the option on, a stroke over claimed precincts only changes nothing and says why (013 Story 1.2)', () => {
  const { plan, center } = neighborsPlan();
  const result = strokeAt(plan, { district: 2, mode: 'add', radius: 8, unclaimedOnly: true }, center);
  assertEqual(result.changed.length, 0);
  assertEqual(result.skipped, result.covered);
  assertEqual(result.reasons, { claimed: result.covered });
  assertEqual(result.message, `No precincts were changed: ${result.covered} ${result.covered === 1 ? 'precinct' : 'precincts'} under the brush already in another district.`);
  assertEqual(result.state.assignments, plan.assignments);
});

test('with the option on, an unclaimed precinct reachable only through a claimed one is skipped as not touching (013 edge case)', () => {
  const state = stateFor('brush-4');
  const chain = findChain(state);
  const base = assign(state, [[chain.a, 2], [chain.b, 1]]);
  const from = centerOf(state.precinctsById.get(chain.b));
  const to = centerOf(state.precinctsById.get(chain.c));
  const stroke = startStroke(base, { district: 2, mode: 'add', radius: 3, unclaimedOnly: true });
  const next = run(base, stroke, from, to).state;
  assertEqual(next.assignments[chain.b], 1, 'the claimed middle precinct stays in district 1');
  assertEqual(next.assignments[chain.c] ?? null, null, 'the far precinct is not taken');
  assertEqual(stroke.reasons.get(chain.b), 'claimed');
  assertEqual(stroke.reasons.get(chain.c), 'not-adjacent');
});

test('with the option on, an empty district starts at the unclaimed covered precinct nearest the stroke start, even when a claimed one is nearer (013 Story 1.4)', () => {
  const { state, center, owned } = neighborsPlan();
  const plan = assign(state, owned.map((id) => [id, 1]));
  const start = centerOf(state.precinctsById.get(owned[0]));
  const stroke = startStroke(plan, { district: 3, mode: 'add', radius: 70, unclaimedOnly: true });
  const next = run(plan, stroke, start, start).state;
  const members = membersOf(next, 3);
  assert(members.length > 0, 'the district started');
  assertEqual(membersOf(next, 1), owned, 'district 1 is untouched');
  const unclaimed = precinctsInCapsule(plan, start, start, 70).filter((id) => plan.assignments[id] === null);
  const nearest = [...unclaimed].sort((p, q) => dist(centerOf(plan.precinctsById.get(p)), start) - dist(centerOf(plan.precinctsById.get(q)), start))[0];
  assert(members.includes(nearest), 'the nearest unclaimed covered precinct is in');
  assertEqual(pieces(next, 3), 1, 'one connected piece');
  assert(center, 'plan built');
});

test('with the option on, precincts already in the selected district count as unchanged, and erase ignores the option (013 FR-003, FR-006)', () => {
  const { plan, center, owned } = neighborsPlan();
  const again = strokeAt(plan, { district: 1, mode: 'add', radius: 20, unclaimedOnly: true }, center);
  assert(again.unchanged > 0, 'precincts already in district 1 are unchanged');
  assertEqual(again.moved, 0);
  const withOption = strokeAt(plan, { district: 1, mode: 'erase', radius: 60, unclaimedOnly: true }, center);
  const without = strokeAt(plan, { district: 1, mode: 'erase', radius: 60 }, center);
  assertEqual(withOption.state.assignments, without.state.assignments, 'erase gives the same plan with or without the option');
  assertEqual(withOption.message, without.message);
  assert(startStroke(plan, { district: 1, mode: 'erase', unclaimedOnly: true }).unclaimedOnly === false, 'an erase stroke never carries the option');
  assert(owned.length > 0);
});

test('the same stroke with the option on gives the same plan and summary (013 FR-005)', () => {
  const { plan, center } = neighborsPlan('brush-7');
  const play = () => strokeAt(plan, { district: 2, mode: 'add', radius: 90, unclaimedOnly: true }, center);
  const one = play();
  const two = play();
  assertEqual(one.state.assignments, two.state.assignments);
  const { state: _a, ...first } = one;
  const { state: _b, ...second } = two;
  assertEqual(first, second);
});

test('mixed strokes report claimed skips apart from the other reasons (013 FR-009, SC-006)', () => {
  const { plan, center } = neighborsPlan();
  const result = strokeAt(plan, { district: 2, mode: 'add', radius: 110, unclaimedOnly: true }, center);
  assert(result.added > 0 && result.reasons.claimed > 0, 'a mix of added and claimed');
  assertEqual(result.added + result.moved + result.removed + result.unchanged + result.skipped, result.covered, 'the five buckets add up to covered');
  assert(/^Added \d[\d,]* precincts?, .*skipped \d[\d,]* \(.*already in another district.*\)\.$/.test(result.message), result.message);
});

test('100 random strokes with the option on never take a precinct from another district and never split one (013 SC-001, research R8)', () => {
  const run100 = () => {
    let state = stateFor('brush-unclaimed-prop');
    const random = createRandom('unclaimed-strokes');
    const log = [];
    // Eight districts are started with the option off, then every stroke below uses it.
    for (let d = 1; d <= 8; d += 1) {
      const p = [randomBetween(random, 80, 720), randomBetween(random, 80, 520)];
      state = run(state, startStroke(state, { district: d, mode: 'add', radius: 35 }), p, p).state;
    }
    for (let i = 0; i < 100; i += 1) {
      const district = randomInt(random, 1, 8);
      const mode = random() < 0.2 ? 'erase' : 'add';
      const radius = randomInt(random, BRUSH_SIZE.min / BRUSH_SIZE.step, BRUSH_SIZE.max / BRUSH_SIZE.step) * BRUSH_SIZE.step;
      const before = state.assignments;
      const stroke = startStroke(state, { district, mode, radius, unclaimedOnly: true });
      let a = [randomBetween(random, 40, 760), randomBetween(random, 40, 560)];
      for (let k = 0; k < randomInt(random, 1, 4); k += 1) {
        const b = random() < 0.3 ? a : [a[0] + randomBetween(random, -120, 120), a[1] + randomBetween(random, -120, 120)];
        state = run(state, stroke, a, b).state;
        a = b;
      }
      for (const precinct of state.precincts) {
        const was = before[precinct.id] ?? null;
        const now = state.assignments[precinct.id] ?? null;
        if (was === now) continue;
        if (mode === 'add') assert(was === null && now === district, `stroke ${i}: a precinct changed from ${was} to ${now} in an add stroke for district ${district}`);
        else assert(was === district && now === null, `stroke ${i}: an erase stroke changed a precinct from ${was} to ${now}`);
      }
      assert(allContiguous(state), `stroke ${i}: a district was split`);
      log.push(Object.values(state.assignments).join(','));
    }
    return log.join('|');
  };
  assertEqual(run100(), run100(), 'replaying the same strokes gives the same plans');
});

test('with the option off or missing, 100 strokes give exactly the results recorded before the option existed (013 FR-004, SC-002)', () => {
  assertEqual(EXPECTED.length, 100);
  assertEqual(playStrokes(), EXPECTED, 'option missing');
  assertEqual(playStrokes({ unclaimedOnly: false }), EXPECTED, 'option off');
});
