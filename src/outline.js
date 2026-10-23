import { randomBetween, randomInt, shuffle } from './random.js';
import { MAP_HEIGHT, MAP_WIDTH, polygonArea, sampleGrid } from './geometry.js';

export const MAX_OUTLINE_COVERAGE = 0.8;
export const OUTLINE_TEMPLATES = Object.freeze(['stepped', 'slanted', 'wedge']);
export const NATURAL_KINDS = Object.freeze(['river', 'coast']);

// 16 px of map margin plus 20 px for the largest meander, so a wiggle never leaves the map.
const MARGIN = 36;
const SAMPLE_STEP = 6;
const MIN_PAIR_SIDE = 150;
const MIN_NATURAL_SIDE = 120;
const NATURAL_SHARE_BUILT = 0.26;
const NATURAL_SHARE_REQUIRED = 0.2;
const STRAIGHT_RUN = 60;
const OPENING_RADIUS = 24;
const OPENING_CELL = 8;
const MAX_CANDIDATES = 20;
const DEG = Math.PI / 180;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const length = (v) => Math.hypot(v[0], v[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function boxOf(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

function rotate(points, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return points.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}

// Cuts a corner off a polygon: the corner is replaced by two points a fraction of the way along its two sides.
function clipCorner(points, index, fraction) {
  const n = points.length;
  const corner = points[index];
  const before = lerp(corner, points[(index + n - 1) % n], fraction);
  const after = lerp(corner, points[(index + 1) % n], fraction);
  return [...points.slice(0, index), before, after, ...points.slice(index + 1)];
}

// --- Templates: corner lists in arbitrary units, scaled into the map afterwards -----------------------------

// A boxy state: an upright rectangle with a rectangular bite out of one corner (and sometimes a clipped opposite corner).
function steppedCorners(random, { fixed = false } = {}) {
  const width = 1000;
  const height = width * (fixed ? 0.7 : randomBetween(random, 0.6, 0.85));
  const across = fixed ? 0.5 : randomBetween(random, 0.42, 0.55);
  const down = fixed ? 0.5 : randomBetween(random, 0.42, 0.55);
  let points = [[0, 0], [width * (1 - across), 0], [width * (1 - across), height * down], [width, height * down], [width, height], [0, height]];
  if (!fixed && random() < 0.3) points = clipCorner(points, 5, randomBetween(random, 0.12, 0.2));
  const tilt = fixed ? 0 : randomBetween(random, -3, 3) * DEG;
  return rotate(points, tilt);
}

// A tilted state: a slightly sheared quadrilateral with long sides turned 10 to 35 degrees, sometimes with a corner cut off.
function slantedCorners(random) {
  const width = 1000;
  const height = width * randomBetween(random, 0.55, 0.8);
  const shear = randomBetween(random, -0.18, 0.18) * height;
  let points = [[0, 0], [width, 0], [width + shear, height], [shear, height]];
  if (random() < 0.5) points = clipCorner(points, randomInt(random, 0, 3), randomBetween(random, 0.15, 0.25));
  const turn = randomBetween(random, 10, 35) * DEG * (random() < 0.5 ? -1 : 1);
  return rotate(points, turn);
}

// An irregular state: five or six corners around a center, with an occasional inward step.
function wedgeCorners(random) {
  const count = randomInt(random, 5, 6);
  let gaps = null;
  for (let tries = 0; tries < 60 && !gaps; tries += 1) {
    const raw = Array.from({ length: count }, () => randomBetween(random, 40, 110));
    const scale = 360 / raw.reduce((a, b) => a + b, 0);
    const scaled = raw.map((g) => g * scale);
    if (scaled.every((g) => g >= 40 && g <= 110)) gaps = scaled;
  }
  gaps ??= Array.from({ length: count }, () => 360 / count);
  let angle = randomBetween(random, 0, 360);
  const points = [];
  gaps.forEach((gap) => {
    const radius = 500 * randomBetween(random, 0.7, 1);
    points.push([radius * Math.cos(angle * DEG), radius * Math.sin(angle * DEG)]);
    angle += gap;
  });
  if (random() < 0.5) {
    const at = randomInt(random, 0, count - 1);
    const a = points[at];
    const b = points[(at + 1) % count];
    const middle = lerp(a, b, 0.5);
    points.splice(at + 1, 0, lerp([0, 0], middle, randomBetween(random, 0.5, 0.7)));
  }
  return points;
}

const TEMPLATE_BUILDERS = { stepped: steppedCorners, slanted: slantedCorners, wedge: wedgeCorners };

// Scales the corners to fit the map inside the margin (a little smaller now and then) and places them off-center a little.
function fitToMap(random, corners, { fixed = false } = {}) {
  const box = boxOf(corners);
  const fitWidth = MAP_WIDTH - 2 * MARGIN;
  const fitHeight = MAP_HEIGHT - 2 * MARGIN;
  const shrink = fixed ? 1 : randomBetween(random, 0.88, 1);
  const scale = shrink * Math.min(fitWidth / (box.maxX - box.minX), fitHeight / (box.maxY - box.minY));
  const width = (box.maxX - box.minX) * scale;
  const height = (box.maxY - box.minY) * scale;
  const left = MARGIN + (fitWidth - width) * (fixed ? 0.5 : random());
  const top = MARGIN + (fitHeight - height) * (fixed ? 0.5 : random());
  return corners.map(([x, y]) => [left + (x - box.minX) * scale, top + (y - box.minY) * scale]);
}

// --- Sides ----------------------------------------------------------------------------------------------------

function sidesOf(corners) {
  return corners.map((start, i) => {
    const end = corners[(i + 1) % corners.length];
    return { index: i, start, end, length: length(sub(end, start)) };
  });
}

// The turn (in degrees) from one side's direction to the next, always 0 to 180.
function turnBetween(a, b) {
  const va = sub(a.end, a.start);
  const vb = sub(b.end, b.start);
  const cos = (va[0] * vb[0] + va[1] * vb[1]) / (length(va) * length(vb));
  return Math.acos(Math.max(-1, Math.min(1, cos))) / DEG;
}

// Two adjacent sides, each long and meeting at 60 to 120 degrees, are kept perfectly straight.
function pickStraightPair(random, sides) {
  const pairs = [];
  sides.forEach((side, i) => {
    const next = sides[(i + 1) % sides.length];
    const turn = turnBetween(side, next);
    if (side.length >= MIN_PAIR_SIDE && next.length >= MIN_PAIR_SIDE && turn >= 60 && turn <= 120) pairs.push([side.index, next.index]);
  });
  return pairs.length ? shuffle(random, pairs)[0] : null;
}

// One or two adjacent sides (longest first) become natural borders covering at least a quarter of the perimeter.
function pickNaturalSides(random, sides, pair, perimeter) {
  const eligible = sides.filter((s) => !pair.includes(s.index) && s.length >= MIN_NATURAL_SIDE);
  if (!eligible.length) return null;
  const ordered = shuffle(random, eligible).sort((a, b) => b.length - a.length);
  const first = ordered[0];
  const chosen = [first];
  const neighbors = eligible.filter((s) => s !== first && (s.index === (first.index + 1) % sides.length || (s.index + 1) % sides.length === first.index));
  const needsMore = first.length < NATURAL_SHARE_BUILT * perimeter;
  if (neighbors.length && (needsMore || random() < 0.4)) chosen.push(neighbors.sort((a, b) => b.length - a.length)[0]);
  const total = chosen.reduce((sum, s) => sum + s.length, 0);
  return total >= NATURAL_SHARE_BUILT * perimeter ? chosen.map((s) => s.index) : null;
}

// --- Natural borders ------------------------------------------------------------------------------------------

function smoothNoise(random, knotCount) {
  const knots = Array.from({ length: knotCount + 1 }, () => randomBetween(random, -1, 1));
  return (t) => {
    const x = t * knotCount;
    const i = Math.min(knotCount - 1, Math.floor(x));
    const f = x - i;
    const s = f * f * (3 - 2 * f);
    return knots[i] * (1 - s) + knots[i + 1] * s;
  };
}

// The points of one natural side, from its start up to (not including) its end.
function meander(random, start, end, kind) {
  const side = length(sub(end, start));
  const amplitude = Math.min(20, Math.max(8, 0.05 * side));
  const steps = Math.max(4, Math.round(side / SAMPLE_STEP));
  const normal = [-(end[1] - start[1]) / side, (end[0] - start[0]) / side];
  const first = { k: randomInt(random, 2, 4), phase: randomBetween(random, 0, 2 * Math.PI) };
  const second = { k: randomInt(random, 5, 9), phase: randomBetween(random, 0, 2 * Math.PI) };
  const fine = { k: randomInt(random, 10, 16), phase: randomBetween(random, 0, 2 * Math.PI) };
  const noise = smoothNoise(random, Math.max(3, Math.round(side / 25)));
  const direction = random() < 0.5 ? -1 : 1;
  const points = [];
  for (let i = 0; i < steps; i += 1) {
    const t = i / steps;
    const taper = Math.sin(Math.PI * t) ** 2;
    let wiggle = 0.6 * Math.sin(2 * Math.PI * first.k * t + first.phase) + 0.3 * Math.sin(2 * Math.PI * second.k * t + second.phase) + 0.1 * noise(t);
    if (kind === 'coast') wiggle += 0.4 * Math.sin(2 * Math.PI * fine.k * t + fine.phase);
    const offset = direction * amplitude * taper * wiggle;
    const base = lerp(start, end, t);
    points.push([base[0] + normal[0] * offset, base[1] + normal[1] * offset]);
  }
  return points;
}

function assemble(random, corners, naturalIndexes, kinds) {
  const outline = [];
  sidesOf(corners).forEach((side) => {
    const at = naturalIndexes.indexOf(side.index);
    if (at < 0) outline.push(side.start);
    else outline.push(...meander(random, side.start, side.end, kinds[at]));
  });
  return outline.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
}

// --- Checks ---------------------------------------------------------------------------------------------------

function segmentsCross(a, b, c, d) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  return cross(c, d, a) * cross(c, d, b) < 0 && cross(a, b, c) * cross(a, b, d) < 0;
}

function selfCrosses(outline) {
  const n = outline.length;
  for (let i = 0; i < n; i += 1) {
    const a = outline[i];
    const b = outline[(i + 1) % n];
    for (let j = i + 2; j < n; j += 1) {
      if (i === 0 && j === n - 1) continue;
      if (segmentsCross(a, b, outline[j], outline[(j + 1) % n])) return true;
    }
  }
  return false;
}

export function outlineCoverage(outline) {
  const box = boxOf(outline);
  return polygonArea(outline) / ((box.maxX - box.minX) * (box.maxY - box.minY));
}

function turnAt(outline, i) {
  const n = outline.length;
  const a = sub(outline[i], outline[(i + n - 1) % n]);
  const b = sub(outline[(i + 1) % n], outline[i]);
  const cos = (a[0] * b[0] + a[1] * b[1]) / (length(a) * length(b) || 1);
  return Math.acos(Math.max(-1, Math.min(1, cos))) / DEG;
}

// Maximal straight runs: consecutive segments that turn less than 3 degrees and stay within 2 px of their chord.
// Each run is { from, to } as vertex indexes (going around), with its chord length.
function straightRuns(outline) {
  const n = outline.length;
  const start = Array.from({ length: n }, (_, i) => i).find((i) => turnAt(outline, i) >= 3) ?? 0;
  const runs = [];
  let from = start;
  let steps = 0;
  while (steps < n) {
    let to = from;
    let count = 0;
    while (steps + count < n) {
      const next = (to + 1) % n;
      const a = outline[from];
      const b = outline[next];
      const chord = length(sub(b, a)) || 1;
      let straight = true;
      for (let k = from; k !== next && straight; k = (k + 1) % n) {
        const p = outline[k];
        const deviation = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / chord;
        if (deviation > 2) straight = false;
      }
      if (to !== from && turnAt(outline, to) >= 3) straight = false;
      if (!straight) break;
      to = next;
      count += 1;
    }
    if (count === 0) {
      to = (from + 1) % n;
      count = 1;
    }
    runs.push({ from, to, count, chord: length(sub(outline[to], outline[from])) });
    steps += count;
    from = to;
  }
  return runs;
}

// The longest stretch (in px) with no straight run longer than 60 px, and whether two adjacent runs form a straight pair.
function measureOutline(outline) {
  const n = outline.length;
  const runs = straightRuns(outline);
  const perimeter = outline.reduce((sum, p, i) => sum + length(sub(outline[(i + 1) % n], p)), 0);
  const long = runs.map((run) => run.chord > STRAIGHT_RUN);
  let stretch = 0;
  let best = 0;
  const lengthOf = (run) => {
    let total = 0;
    for (let k = run.from, c = 0; c < run.count; k = (k + 1) % n, c += 1) total += length(sub(outline[(k + 1) % n], outline[k]));
    return total;
  };
  const doubled = [...runs, ...runs];
  const doubledLong = [...long, ...long];
  for (let i = 0; i < doubled.length; i += 1) {
    if (doubledLong[i]) {
      stretch = 0;
    } else {
      stretch += lengthOf(doubled[i]);
      best = Math.max(best, stretch);
    }
  }
  best = Math.min(best, perimeter);
  let pair = false;
  runs.forEach((run, i) => {
    const next = runs[(i + 1) % runs.length];
    if (run.chord < MIN_PAIR_SIDE || next.chord < MIN_PAIR_SIDE || run === next) return;
    const a = sub(outline[run.to], outline[run.from]);
    const b = sub(outline[next.to], outline[next.from]);
    const turn = Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (length(a) * length(b))))) / DEG;
    if (turn >= 60 && turn <= 120) pair = true;
  });
  return { perimeter, naturalStretch: best, pair };
}

// Squared distance (in cells) from every grid cell to the nearest source cell: the exact two-pass transform of
// Felzenszwalb and Huttenlocher, run down the columns and then along the rows.
function squaredDistances(cols, rows, isSource) {
  const far = 1e20;
  const field = new Float64Array(cols * rows);
  for (let i = 0; i < field.length; i += 1) field[i] = isSource(i) ? 0 : far;
  const size = Math.max(cols, rows);
  const line = new Float64Array(size);
  const out = new Float64Array(size);
  const parabola = new Int32Array(size);
  const bound = new Float64Array(size + 1);
  const transform = (count) => {
    let k = 0;
    parabola[0] = 0;
    bound[0] = -Infinity;
    bound[1] = Infinity;
    for (let q = 1; q < count; q += 1) {
      const meet = (p) => ((line[q] + q * q) - (line[p] + p * p)) / (2 * q - 2 * p);
      let s = meet(parabola[k]);
      while (s <= bound[k]) {
        k -= 1;
        s = meet(parabola[k]);
      }
      k += 1;
      parabola[k] = q;
      bound[k] = s;
      bound[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < count; q += 1) {
      while (bound[k + 1] < q) k += 1;
      out[q] = (q - parabola[k]) ** 2 + line[parabola[k]];
    }
  };
  for (let c = 0; c < cols; c += 1) {
    for (let r = 0; r < rows; r += 1) line[r] = field[r * cols + c];
    transform(rows);
    for (let r = 0; r < rows; r += 1) field[r * cols + c] = out[r];
  }
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) line[c] = field[r * cols + c];
    transform(cols);
    for (let c = 0; c < cols; c += 1) field[r * cols + c] = out[c];
  }
  return field;
}

// The share of the outline lost when it is opened by a 25 px disk: arms, necks, and notches thinner than 50 px vanish.
function openingLoss(outline) {
  const { cols, rows, owner } = sampleGrid(outline, [[0, 0]], OPENING_CELL);
  const radiusSquared = (OPENING_RADIUS / OPENING_CELL) ** 2;
  const toOutside = squaredDistances(cols, rows, (i) => owner[i] < 0);
  const toEroded = squaredDistances(cols, rows, (i) => owner[i] >= 0 && toOutside[i] >= radiusSquared);
  let area = 0;
  let lost = 0;
  for (let i = 0; i < owner.length; i += 1) {
    if (owner[i] < 0) continue;
    area += 1;
    if (toEroded[i] > radiusSquared) lost += 1;
  }
  return area ? lost / area : 1;
}

// The generator's own gate: lists every rule the outline breaks (an empty list means it is fine).
export function checkOutline(outline) {
  const problems = [];
  if (selfCrosses(outline)) problems.push('crossing');
  if (outlineCoverage(outline) > MAX_OUTLINE_COVERAGE) problems.push('fill');
  if (outline.filter((_, i) => turnAt(outline, i) >= 35).length < 4) problems.push('corners');
  const measured = measureOutline(outline);
  if (!measured.pair) problems.push('straight-pair');
  if (measured.naturalStretch < NATURAL_SHARE_REQUIRED * measured.perimeter) problems.push('natural');
  if (!problems.includes('crossing') && openingLoss(outline) > 0.01) problems.push('arm-width');
  return { ok: problems.length === 0, problems };
}

// --- Generation ------------------------------------------------------------------------------------------------

function buildCandidate(random, template, { fixed = false } = {}) {
  const corners = fitToMap(random, TEMPLATE_BUILDERS[template](random, { fixed }), { fixed });
  const sides = sidesOf(corners);
  const perimeter = sides.reduce((sum, s) => sum + s.length, 0);
  // The fallback box keeps its left and top sides straight and makes the long bottom side the river.
  const pair = fixed ? [5, 0] : pickStraightPair(random, sides);
  if (!pair) return null;
  const naturalIndexes = fixed ? [4] : pickNaturalSides(random, sides, pair, perimeter);
  if (!naturalIndexes) return null;
  const kinds = naturalIndexes.map(() => (fixed ? 'river' : NATURAL_KINDS[random() < 0.5 ? 0 : 1]));
  return { outline: assemble(random, corners, naturalIndexes, kinds), shapeFeatures: [template, ...kinds] };
}

// A realistic outline: straight surveyed borders meeting at corners and one or two natural borders. Never null:
// after 20 rejected candidates it returns a stepped box with a river side, which passes every check.
export function generateOutline(random) {
  for (let attempt = 0; attempt < MAX_CANDIDATES; attempt += 1) {
    const template = OUTLINE_TEMPLATES[randomInt(random, 0, OUTLINE_TEMPLATES.length - 1)];
    const candidate = buildCandidate(random, template);
    if (candidate && checkOutline(candidate.outline).ok) return candidate;
  }
  return buildCandidate(random, 'stepped', { fixed: true });
}
