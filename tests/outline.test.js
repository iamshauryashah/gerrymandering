import { test, assert, assertEqual } from './test-runner.js';
import { createRandom } from '../src/random.js';
import { generateOutline, checkOutline, outlineCoverage, MAX_OUTLINE_COVERAGE, OUTLINE_TEMPLATES, NATURAL_KINDS } from '../src/outline.js';
import { interiorDistances, polygonArea, sampleGrid } from '../src/geometry.js';

// Everything here measures an outline from its points alone, so these tests do not trust the generator's own checks.

const SEEDS = Array.from({ length: 100 }, (_, i) => `outline-${i}`);
const outlines = SEEDS.map((seed) => ({ seed, ...generateOutline(createRandom(seed)) }));

const segment = (outline, i) => {
  const a = outline[i];
  const b = outline[(i + 1) % outline.length];
  return [b[0] - a[0], b[1] - a[1]];
};
const norm = (v) => Math.hypot(v[0], v[1]);
const angleBetween = (u, v) => (Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (norm(u) * norm(v))))) * 180) / Math.PI;
const perimeterOf = (outline) => outline.reduce((sum, _, i) => sum + norm(segment(outline, i)), 0);
const turnAtVertex = (outline, i) => angleBetween(segment(outline, (i + outline.length - 1) % outline.length), segment(outline, i));

// A straight run: segments turning under 3 degrees one to the next, all within 2 px of the chord of the run.
// Returns runs as { first, count, chord, vector } going around from the first sharp corner.
function runsOf(outline) {
  const n = outline.length;
  let first = outline.findIndex((_, i) => turnAtVertex(outline, i) >= 3);
  if (first < 0) first = 0;
  const runs = [];
  let consumed = 0;
  while (consumed < n) {
    const start = (first + consumed) % n;
    let count = 1;
    for (;;) {
      if (consumed + count >= n) break;
      const end = (start + count + 1) % n;
      const chordStart = outline[start];
      const chordEnd = outline[end];
      const chord = [chordEnd[0] - chordStart[0], chordEnd[1] - chordStart[1]];
      let straight = turnAtVertex(outline, (start + count) % n) < 3;
      for (let k = 1; k <= count && straight; k += 1) {
        const p = outline[(start + k) % n];
        const offset = Math.abs(chord[0] * (p[1] - chordStart[1]) - chord[1] * (p[0] - chordStart[0])) / norm(chord);
        if (offset > 2) straight = false;
      }
      if (!straight) break;
      count += 1;
    }
    const end = outline[(start + count) % n];
    const vector = [end[0] - outline[start][0], end[1] - outline[start][1]];
    let length = 0;
    for (let k = 0; k < count; k += 1) length += norm(segment(outline, (start + k) % n));
    runs.push({ first: start, count, chord: norm(vector), length, vector });
    consumed += count;
  }
  return runs;
}

function hasStraightPair(outline) {
  const runs = runsOf(outline);
  return runs.some((run, i) => {
    const next = runs[(i + 1) % runs.length];
    if (run === next || run.chord < 150 || next.chord < 150) return false;
    const turn = angleBetween(run.vector, next.vector);
    return turn >= 60 && turn <= 120;
  });
}

// The longest stretch of the border with no straight run longer than 60 px, as a share of the perimeter.
function naturalShare(outline) {
  const runs = runsOf(outline);
  const perimeter = perimeterOf(outline);
  let best = 0;
  let current = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    for (const run of runs) {
      if (run.chord > 60) current = 0;
      else {
        current += run.length;
        best = Math.max(best, current);
      }
    }
  }
  return Math.min(best, perimeter) / perimeter;
}

function crosses(outline) {
  const n = outline.length;
  const orient = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue;
      const a = outline[i];
      const b = outline[(i + 1) % n];
      const c = outline[j];
      const d = outline[(j + 1) % n];
      if (orient(c, d, a) * orient(c, d, b) < 0 && orient(a, b, c) * orient(a, b, d) < 0) return true;
    }
  }
  return false;
}

// The share of the area lost when the shape is opened by a 25 px disk: eroded by 6 grid steps of 4 px, then grown back.
function openingLoss(outline) {
  const grid = sampleGrid(outline, [[0, 0]], 4);
  const inside = (i) => (grid.owner[i] >= 0 ? 0 : null);
  const depth = interiorDistances(grid, inside);
  const kept = new Uint8Array(grid.owner.length);
  const steps = 6;
  for (let i = 0; i < depth.length; i += 1) {
    if (depth[i] <= steps) continue;
    const c = i % grid.cols;
    const r = Math.floor(i / grid.cols);
    for (let dr = -steps; dr <= steps; dr += 1) {
      for (let dc = -steps; dc <= steps; dc += 1) {
        if (dr * dr + dc * dc > steps * steps) continue;
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < grid.rows && cc >= 0 && cc < grid.cols) kept[rr * grid.cols + cc] = 1;
      }
    }
  }
  let area = 0;
  let lost = 0;
  for (let i = 0; i < kept.length; i += 1) {
    if (grid.owner[i] < 0) continue;
    area += 1;
    if (!kept[i]) lost += 1;
  }
  return lost / area;
}

test('100 outlines: straight surveyed borders meeting at a corner, plus a natural border (FR-013, FR-014, FR-015, SC-007)', () => {
  let weakestNatural = 1;
  for (const { seed, outline } of outlines) {
    assert(hasStraightPair(outline), `${seed}: no two straight sides of at least 150 px meeting at 60-120 degrees`);
    const share = naturalShare(outline);
    weakestNatural = Math.min(weakestNatural, share);
    assert(share >= 0.2, `${seed}: the longest natural stretch is ${(share * 100).toFixed(0)}% of the border`);
  }
  console.info(`Outlines: every one has a straight pair; smallest natural stretch ${(weakestNatural * 100).toFixed(0)}% of the border`);
});

test('100 outlines: simple, not too boxy, cornered, inside the map, and no thin arms (FR-016, SC-007)', () => {
  let worstFill = 0;
  let worstLoss = 0;
  for (const { seed, outline } of outlines) {
    assert(!crosses(outline), `${seed}: the outline crosses itself`);
    const box = outline.reduce((b, [x, y]) => ({ minX: Math.min(b.minX, x), maxX: Math.max(b.maxX, x), minY: Math.min(b.minY, y), maxY: Math.max(b.maxY, y) }), { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 });
    const fill = polygonArea(outline) / ((box.maxX - box.minX) * (box.maxY - box.minY));
    worstFill = Math.max(worstFill, fill);
    assert(fill <= 0.8, `${seed}: fills ${fill.toFixed(2)} of its bounding box`);
    assert(outline.filter((_, i) => turnAtVertex(outline, i) >= 35).length >= 4, `${seed}: fewer than four corners`);
    assert(box.minX >= 16 && box.maxX <= 784 && box.minY >= 16 && box.maxY <= 584, `${seed}: leaves the 16 px margin`);
    assert(polygonArea(outline) > 50000, `${seed}: too small`);
    const loss = openingLoss(outline);
    worstLoss = Math.max(worstLoss, loss);
    assert(loss <= 0.02, `${seed}: opening by 25 px loses ${(loss * 100).toFixed(1)}% of the area`);
  }
  console.info(`Outlines: fill at most ${worstFill.toFixed(2)}; opening loses at most ${(worstLoss * 100).toFixed(1)}%`);
});

test('100 outlines are all different and come in at least three classes of shape (SC-008)', () => {
  const seen = new Set(outlines.map(({ outline }) => JSON.stringify(outline.map(([x, y]) => [Math.round(x), Math.round(y)]))));
  assertEqual(seen.size, outlines.length, 'no two outlines are the same');
  const classes = new Set();
  for (const { outline } of outlines) {
    const corners = outline.filter((_, i) => turnAtVertex(outline, i) >= 35).length;
    const box = outline.reduce((b, [x, y]) => ({ minX: Math.min(b.minX, x), maxX: Math.max(b.maxX, x), minY: Math.min(b.minY, y), maxY: Math.max(b.maxY, y) }), { minX: 1e9, maxX: -1e9, minY: 1e9, maxY: -1e9 });
    const fill = polygonArea(outline) / ((box.maxX - box.minX) * (box.maxY - box.minY));
    let longest = [1, 0];
    let longestLength = 0;
    for (const run of runsOf(outline)) {
      if (run.chord > longestLength) {
        longestLength = run.chord;
        longest = run.vector;
      }
    }
    const tilt = Math.abs((Math.atan2(longest[1], longest[0]) * 180) / Math.PI) % 90;
    classes.add(`${corners >= 7 ? 'many' : 'few'}|${fill < 0.65 ? 'loose' : 'tight'}|${tilt < 5 || tilt > 85 ? 'level' : 'tilted'}`);
  }
  assert(classes.size >= 3, `only ${classes.size} classes of shape: ${[...classes]}`);
});

test('outlines are deterministic, never null, labelled, fast, and agree with the generator gate', () => {
  const again = generateOutline(createRandom(SEEDS[7]));
  assertEqual(again.outline, outlines[7].outline, 'the same seed gives the same outline');
  assertEqual(again.shapeFeatures, outlines[7].shapeFeatures);
  for (const { seed, outline, shapeFeatures } of outlines) {
    assert(OUTLINE_TEMPLATES.includes(shapeFeatures[0]), `${seed}: unknown template ${shapeFeatures[0]}`);
    const kinds = shapeFeatures.slice(1);
    assert(kinds.length >= 1 && kinds.length <= 2 && kinds.every((k) => NATURAL_KINDS.includes(k)), `${seed}: natural kinds ${kinds}`);
    assert(checkOutline(outline).ok, `${seed}: ${checkOutline(outline).problems}`);
    assert(outlineCoverage(outline) <= MAX_OUTLINE_COVERAGE, `${seed}: coverage`);
  }
  const t0 = performance.now();
  for (let i = 0; i < 50; i += 1) assert(generateOutline(createRandom(`speed-${i}`)).outline.length > 8);
  const average = (performance.now() - t0) / 50;
  assert(average < 20, `an outline takes ${average.toFixed(1)} ms on average`);
  console.info(`Outlines: ${average.toFixed(1)} ms each`);
});
