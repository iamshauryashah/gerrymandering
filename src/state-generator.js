import { createRandom, pick, randomBetween, randomInt, shuffle } from './random.js';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  connectedComponents,
  createInsideTest,
  pieceCounts,
  distanceSquared,
  gridCellCenter,
  gridStats,
  largestPieceCenter,
  pointInPolygon,
  polygonArea,
  sampleGrid,
  sharedVoronoiEdge,
  voronoiCells,
} from './geometry.js';
import { summarizeDistricts } from './districts.js';
import { MAX_OUTLINE_COVERAGE, generateOutline, outlineCoverage } from './outline.js';

export { MAX_OUTLINE_COVERAGE, generateOutline, outlineCoverage };

export const PRECINCT_RANGE = Object.freeze({ min: 500, max: 800 });
export const DISTRICT_RANGE = Object.freeze({ min: 8, max: 20 });
export const GRID_CELL_SIZE = 4;
// Layout checks (areas, neighbors, pieces) use a finer grid than the badge grid, so small precincts are measured well.
export const LAYOUT_CELL_SIZE = 2;
// Small precincts are allowed (every one stays reachable by keyboard), but each must be a visible patch.
export const MIN_CLICKABLE_AREA = 30;
// Rounds of pulling split precincts' seeds toward their main body before a layout is thrown away.
const PIECE_REPAIRS = 4;
// Largest district may have at most 10% more voters than the smallest.
export const BALANCE_RATIO = 0.1;
export const SQ_MILES_PER_PX = 0.25;
// Precinct type thresholds, as multiples of the state's median precinct density.
export const URBAN_THRESHOLD = 15;
export const RURAL_THRESHOLD = 1.6;
// No precinct may exceed this share of an ideal district, so a balanced plan stays possible.
export const MAX_PRECINCT_SHARE = 0.75;
// City populations are voters who live in and around a city; the state's baseline is its all-rural voters.
export const POPULATION_RANGE = Object.freeze({ min: 10000, max: 300000 });
export const POPULATION_STEP = 10000;
export const DEFAULT_POPULATION = 100000;
export const BASELINE_RANGE = Object.freeze({ min: 450000, max: 720000 });
export const RANDOM_CITY_RANGE = Object.freeze({
  count: Object.freeze({ min: 2, max: 4 }),
  population: Object.freeze({ min: 50000, max: 150000 }),
});
// Lean by density: a bounded S-curve around the midpoint between the rural and urban thresholds.
// Cities lean harder than the countryside, so rural margins stay realistic once the statewide race is balanced.
const LEAN_AMPLITUDE_URBAN = 0.32;
const LEAN_AMPLITUDE_RURAL = 0.09;
const LEAN_STEEPNESS = 0.6;
const LEAN_PIVOT = Math.sqrt(URBAN_THRESHOLD * RURAL_THRESHOLD);
const MAX_ATTEMPTS = 40;
// Lloyd passes pull precincts toward the weighted centers of their cells; the weight is raised to a power first,
// so crowded places end up with much smaller precincts than open country.
const RELAX_PASSES = 10;
const RELAX_EXPONENT = 2.5;
// The highest the weight field can reach (1 plus the largest city peak); seeds are thinned against it so bigger cities draw more seeds.
const MAX_FIELD_WEIGHT = 19;
const REFERENCE_TRIES = 6;
const SCALE_LIMITS = [0.75, 1.33];

const PRECINCT_BASES = [
  'Salamander', 'Gerry', 'Willow', 'Copper', 'Marsh', 'Pine', 'Granite', 'Heron', 'Juniper', 'Maple',
  'Thistle', 'Amber', 'Briar', 'Cedar', 'Foxglove', 'Lark', 'Otter', 'Quail', 'Raven', 'Sable',
  'Tamarack', 'Wren', 'Ashby', 'Birch', 'Clover', 'Elkhorn', 'Fern', 'Hazel', 'Iris', 'Kestrel',
  'Linden', 'Mossy', 'Newt', 'Oakmont', 'Pebble', 'Reed', 'Sorrel', 'Teal', 'Umber', 'Vale',
  'Wolfe', 'Yarrow', 'Basil', 'Comet', 'Drummond', 'Ember', 'Flint', 'Garnet', 'Harbor', 'Indigo',
  'Jasper', 'Kettle', 'Lantern', 'Meadow', 'Nettle', 'Orchard', 'Pollard', 'Quarry', 'Rookery', 'Saffron',
  'Tinder', 'Upton', 'Vesper', 'Whitcomb',
];
const PRECINCT_SUFFIXES = ['', '', '', ' Creek', ' Valley', ' Ridge', ' Falls', ' Springs', 'wood', 'field', 'ton', ' Plains'];
const STATE_PREFIXES = ['New', 'North', 'South', 'East', 'West', 'Upper', 'Lower', 'Greater'];
const STATE_ROOTS = ['Salamandria', 'Gerrylana', 'Newtonia', 'Axolotla', 'Hellbendia', 'Tritonia', 'Amphibia', 'Caudata', 'Eftland', 'Mudpuppia'];

function validateCount(value, range, label) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value < range.min || value > range.max) {
    throw new Error(`${label} must be an integer from ${range.min} to ${range.max}; received ${value}`);
  }
  return value;
}

const TAU = Math.PI * 2;

export function boundingBox(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

// How far a city's influence reaches, in map pixels: bigger cities spread over more precincts.
export function citySigma(pop) {
  return 40 + 35 * Math.sqrt(pop / POPULATION_RANGE.max);
}

// Small background towns, so a state with no cities still has some denser spots.
export function createTowns(random, outline) {
  const box = boundingBox(outline);
  const target = randomInt(random, 4, 6);
  const towns = [];
  for (let guard = 0; towns.length < target && guard < 500; guard += 1) {
    const x = Math.round(randomBetween(random, box.minX + 30, box.maxX - 30));
    const y = Math.round(randomBetween(random, box.minY + 30, box.maxY - 30));
    if (!pointInPolygon([x, y], outline)) continue;
    towns.push({ x, y, peak: randomBetween(random, 2, 4.5), sigma: randomBetween(random, 35, 70) });
  }
  return towns;
}

// The weight at a point: 1 in open country, rising toward each city (more for bigger cities) and, less, toward each town.
// Precincts are drawn smaller where the weight is higher, so crowded places get smaller precincts.
export function createCityField(cities, towns = []) {
  const bumps = [
    ...towns.map((t) => ({ x: t.x, y: t.y, peak: t.peak, twoSigmaSquared: 2 * t.sigma ** 2 })),
    ...cities.map((c) => ({
      x: c.x,
      y: c.y,
      peak: (MAX_FIELD_WEIGHT - 1) * (c.pop / POPULATION_RANGE.max) ** 0.6,
      twoSigmaSquared: 2 * (25 + 30 * Math.sqrt(c.pop / POPULATION_RANGE.max)) ** 2,
    })),
  ];
  return (p) => {
    let height = 0;
    for (const bump of bumps) height = Math.max(height, bump.peak * Math.exp(-distanceSquared(p, [bump.x, bump.y]) / bump.twoSigmaSquared));
    return 1 + height;
  };
}

// The share of that reach inside which a city's voters actually live.
const CITY_CORE = 0.3;
// No precinct takes more than this share of an ideal district from the baseline and the cities together.
const CITY_PRECINCT_CAP = 0.6;

// The state's all-rural voters, from a stream named after the seed so it never depends on the cities or a retry.
export function baselineFor(seed) {
  const random = createRandom(`${seed}|baseline`);
  return Math.round(randomBetween(random, BASELINE_RANGE.min, BASELINE_RANGE.max));
}

// Random states get two to four cities of random size, at least 150 px apart.
function drawCities(random, outline) {
  const box = boundingBox(outline);
  const { count, population } = RANDOM_CITY_RANGE;
  const target = randomInt(random, count.min, count.max);
  const cities = [];
  for (let guard = 0; cities.length < target && guard < 2000; guard += 1) {
    const x = Math.round(randomBetween(random, box.minX + 40, box.maxX - 40));
    const y = Math.round(randomBetween(random, box.minY + 40, box.maxY - 40));
    if (!pointInPolygon([x, y], outline)) continue;
    if (cities.some((c) => distanceSquared([c.x, c.y], [x, y]) < 150 ** 2)) continue;
    cities.push({ x, y, pop: randomInt(random, population.min / POPULATION_STEP, population.max / POPULATION_STEP) * POPULATION_STEP });
  }
  return cities;
}

function placeSeeds(random, outline, count, weightAt, inside) {
  const box = boundingBox(outline);
  let base = 0.75 * Math.sqrt(polygonArea(outline) / count);
  // Seeds go into square buckets as wide as the largest allowed spacing, so a new seed only checks its neighbors.
  const bucketSize = base;
  const buckets = new Map();
  const bucketKey = (x, y) => Math.floor(x / bucketSize) * 4096 + Math.floor(y / bucketSize);
  const placed = [];
  let failures = 0;
  while (placed.length < count) {
    const p = [randomBetween(random, box.minX, box.maxX), randomBetween(random, box.minY, box.maxY)];
    const w = weightAt(p);
    if (random() * Math.sqrt(MAX_FIELD_WEIGHT) > Math.sqrt(w)) continue;
    if (!inside(p)) continue;
    const radius = base * w ** -0.5;
    let fits = true;
    const cx = Math.floor(p[0] / bucketSize);
    const cy = Math.floor(p[1] / bucketSize);
    for (let dx = -1; dx <= 1 && fits; dx += 1) {
      for (let dy = -1; dy <= 1 && fits; dy += 1) {
        for (const q of buckets.get((cx + dx) * 4096 + cy + dy) ?? []) {
          const d = Math.min(radius, q.radius);
          if (distanceSquared(p, q.point) < d * d) {
            fits = false;
            break;
          }
        }
      }
    }
    if (fits) {
      const seed = { point: p, radius };
      placed.push(seed);
      const key = bucketKey(p[0], p[1]);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(seed);
      failures = 0;
    } else if (++failures > 2000) {
      base *= 0.9;
      failures = 0;
    }
  }
  return placed.map((q) => q.point);
}

// Density-weighted Lloyd relaxation: seeds drift toward cities, so urban precincts end up smaller.
function relaxSeeds(outline, points, iterations, weightAt, inside) {
  let current = points;
  let weights = null;
  for (let i = 0; i < iterations; i += 1) {
    const grid = sampleGrid(outline, current, GRID_CELL_SIZE * 2);
    if (!weights) {
      weights = new Float32Array(grid.owner.length);
      for (let k = 0; k < grid.owner.length; k += 1) {
        if (grid.owner[k] >= 0) weights[k] = weightAt(gridCellCenter(grid, k)) ** RELAX_EXPONENT;
      }
    }
    const sums = current.map(() => [0, 0, 0]);
    for (let k = 0; k < grid.owner.length; k += 1) {
      const o = grid.owner[k];
      if (o < 0) continue;
      const [x, y] = gridCellCenter(grid, k);
      const w = weights[k];
      sums[o][0] += x * w;
      sums[o][1] += y * w;
      sums[o][2] += w;
    }
    current = current.map((p, index) => {
      const [sx, sy, sw] = sums[index];
      if (!sw) return p;
      const c = [sx / sw, sy / sw];
      return inside(c) ? c : p;
    });
  }
  return current;
}

function isGraphConnected(neighbors) {
  if (!neighbors.length) return false;
  return connectedComponents([...neighbors.keys()], (i) => neighbors[i]).length === 1;
}

function farthestStarts(random, points, count) {
  const starts = [Math.floor(random() * points.length)];
  while (starts.length < count) {
    let best = -1;
    let bestDistance = -1;
    for (let i = 0; i < points.length; i += 1) {
      if (starts.includes(i)) continue;
      const d = Math.min(...starts.map((s) => distanceSquared(points[s], points[i])));
      if (d > bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    starts.push(best);
  }
  return starts;
}

// Whether a district stays in one piece without `removed`: it only has to reach every same-district neighbor of `removed` from one of them.
function staysConnectedWithout(plan, neighbors, district, removed, size) {
  if (size <= 1) return false;
  const targets = neighbors[removed].filter((n) => plan[n] === district);
  if (targets.length <= 1) return true;
  const wanted = new Set(targets.slice(1));
  const seen = new Set([removed, targets[0]]);
  const stack = [targets[0]];
  while (stack.length && wanted.size) {
    const current = stack.pop();
    for (const n of neighbors[current]) {
      if (plan[n] !== district || seen.has(n)) continue;
      seen.add(n);
      wanted.delete(n);
      stack.push(n);
    }
  }
  return wanted.size === 0;
}

// Moves border precincts from heavier to lighter neighboring districts while every district stays connected.
function improveBalance(plan, neighbors, raw, totals) {
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  const sizes = totals.map(() => 0);
  for (const d of plan) sizes[d] += 1;
  for (let step = 0; step < 600; step += 1) {
    const candidates = [];
    for (let c = 0; c < plan.length; c += 1) {
      const from = plan[c];
      const seen = new Set();
      for (const n of neighbors[c]) {
        const to = plan[n];
        if (to === from || seen.has(to)) continue;
        seen.add(to);
        const before = (totals[from] - mean) ** 2 + (totals[to] - mean) ** 2;
        const after = (totals[from] - raw[c] - mean) ** 2 + (totals[to] + raw[c] - mean) ** 2;
        if (after < before - 1e-9) candidates.push({ c, from, to, gain: before - after });
      }
    }
    if (!candidates.length) return;
    candidates.sort((a, b) => b.gain - a.gain);
    const move = candidates.find((m) => staysConnectedWithout(plan, neighbors, m.from, m.c, sizes[m.from]));
    if (!move) return;
    plan[move.c] = move.to;
    sizes[move.from] -= 1;
    sizes[move.to] += 1;
    totals[move.from] -= raw[move.c];
    totals[move.to] += raw[move.c];
  }
}

// A hidden plan that proves this map can be split into connected, balanced districts.
function buildReferencePlan(random, points, neighbors, raw, districtCount) {
  const plan = new Int16Array(points.length).fill(-1);
  const starts = farthestStarts(random, points, districtCount);
  const totals = Array.from({ length: districtCount }, () => 0);
  starts.forEach((c, d) => {
    plan[c] = d;
    totals[d] += raw[c];
  });
  let remaining = points.length - districtCount;
  while (remaining > 0) {
    const order = totals.map((_, d) => d).sort((a, b) => totals[a] - totals[b] || a - b);
    let placed = false;
    for (const d of order) {
      let best = -1;
      let bestScore = Infinity;
      for (let c = 0; c < plan.length; c += 1) {
        if (plan[c] !== d) continue;
        for (const m of neighbors[c]) {
          if (plan[m] !== -1) continue;
          const score = distanceSquared(points[starts[d]], points[m]) * randomBetween(random, 0.85, 1.15);
          if (score < bestScore) {
            bestScore = score;
            best = m;
          }
        }
      }
      if (best >= 0) {
        plan[best] = d;
        totals[d] += raw[best];
        remaining -= 1;
        placed = true;
        break;
      }
    }
    if (!placed) return null;
  }
  improveBalance(plan, neighbors, raw, totals);
  const mean = totals.reduce((a, b) => a + b, 0) / districtCount;
  const factors = totals.map((t) => mean / t);
  if (factors.some((f) => f < SCALE_LIMITS[0] || f > SCALE_LIMITS[1])) return null;
  return { plan, factors };
}

const DIRECTIONS = ['North', 'South', 'East', 'West'];

// Unique fictional names: every base word with and without each suffix, then, beyond those (over 640), the same names with a direction in front.
export function generateNames(random, count) {
  const suffixed = PRECINCT_SUFFIXES.filter(Boolean);
  const plain = [];
  for (const base of PRECINCT_BASES) {
    plain.push(base);
    for (const suffix of suffixed) plain.push(`${base}${suffix}`);
  }
  const directional = plain.flatMap((name) => DIRECTIONS.map((direction) => `${direction} ${name}`));
  return [...shuffle(random, plain), ...shuffle(random, directional)].slice(0, count);
}

export function classifyDensity(relativeDensity) {
  if (relativeDensity >= URBAN_THRESHOLD) return 'urban';
  if (relativeDensity < RURAL_THRESHOLD) return 'rural';
  return 'suburban';
}

function precinctId(index) {
  return `p${String(index + 1).padStart(3, '0')}`;
}

function gaussian(random) {
  const u = Math.max(random(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * random());
}

// Highly uneven precinct sizes: sorted lognormal draws go to precincts in order of density, capped so no precinct
// is too large for a balanced district.
function skewedVoterWeights(random, densityKey, districtCount) {
  const n = densityKey.length;
  const sigma = randomBetween(random, 1.15, 1.4);
  const draws = Array.from({ length: n }, () => Math.exp(sigma * gaussian(random))).sort((a, b) => b - a);
  const order = densityKey.map((_, i) => i).sort((a, b) => densityKey[b] - densityKey[a] || a - b);
  const weights = new Array(n);
  order.forEach((precinct, rank) => {
    weights[precinct] = draws[rank];
  });
  const total = weights.reduce((a, b) => a + b, 0);
  // Leaves headroom for the reference plan's per-district rescaling.
  const cap = (0.62 * total) / districtCount;
  let current = weights;
  for (let pass = 0; pass < 10; pass += 1) {
    current = capWeights(current, total, cap);
    const spread = voterSpread(current, districtCount);
    if (spread.medianToMean <= 0.42 && spread.topShare >= 0.28) break;
    // Capping flattens the distribution; a power above 1 restores the long tail without reordering precincts.
    const sum = current.reduce((acc, w) => acc + w ** 1.3, 0);
    current = current.map((w) => (w ** 1.3 * total) / sum);
  }
  return current;
}

function capWeights(input, total, cap) {
  const n = input.length;
  // Even the emptiest precinct keeps a few percent of an average precinct's voters.
  const floor = (0.03 * total) / n;
  const weights = input.map((w) => Math.max(w, floor));
  for (let round = 0; round < 20; round += 1) {
    let over = false;
    for (let i = 0; i < n; i += 1) {
      if (weights[i] > cap) {
        weights[i] = cap;
        over = true;
      }
    }
    if (!over) break;
    const free = weights.filter((w) => w < cap).reduce((a, b) => a + b, 0);
    const capped = weights.filter((w) => w >= cap).length * cap;
    const grow = (total - capped) / free;
    for (let i = 0; i < n; i += 1) if (weights[i] < cap) weights[i] *= grow;
  }
  return weights;
}

export function voterSpread(totals, districtCount) {
  const sorted = [...totals].sort((a, b) => b - a);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const top = sorted.slice(0, Math.max(1, Math.round(sorted.length / 10))).reduce((a, b) => a + b, 0);
  const n = sorted.length;
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  return {
    topShare: top / sum,
    medianToMean: median / (sum / n),
    maxToIdeal: sorted[0] / (sum / districtCount),
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  return n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

// Finds the statewide offset that makes side A's share of all voters equal the target (share is monotone in it).
function solveStatewideOffset(totals, baseLean, target) {
  const shareFor = (offset) => {
    let a = 0;
    let all = 0;
    for (let i = 0; i < totals.length; i += 1) {
      a += totals[i] * Math.min(0.92, Math.max(0.08, 0.5 + offset + baseLean[i]));
      all += totals[i];
    }
    return a / all;
  };
  let lo = -1;
  let hi = 1;
  for (let i = 0; i < 50; i += 1) {
    const mid = (lo + hi) / 2;
    if (shareFor(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Layout phase: precinct shapes, precinct voter totals, and a reference plan that proves the map can be split fairly.
// A precinct's voters are its share of the state's baseline plus its share of each nearby city's population,
// so the state's total is the baseline plus the cities. Returns null when any check fails, so callers can try again.
export function buildLayout(random, { outline, weightAt, cities = [], baseline, precinctCount, districtCount }) {
  const inside = createInsideTest(outline);
  // Seeds are kept to one decimal, exactly as each precinct reports its seed point, so anyone can re-measure the layout.
  const tenth = (v) => Math.round(v * 10) / 10;
  const points = relaxSeeds(outline, placeSeeds(random, outline, precinctCount, weightAt, inside), RELAX_PASSES, weightAt, inside).map(([x, y]) => [tenth(x), tenth(y)]);
  let layoutGrid = sampleGrid(outline, points, LAYOUT_CELL_SIZE);
  let stats = gridStats(layoutGrid, points.length);
  // A precinct split in two by a narrow part of the outline gets its seed pulled toward its main body, which lets its neighbors
  // take the stray part; a few rounds fix almost every layout.
  for (let round = 0; round < PIECE_REPAIRS; round += 1) {
    const pieces = pieceCounts(layoutGrid, points.length);
    const split = [];
    pieces.forEach((n, i) => {
      if (n > 1) split.push(i);
    });
    if (!split.length) break;
    for (const i of split) {
      const target = largestPieceCenter(layoutGrid, i);
      const moved = [tenth((points[i][0] + target[0]) / 2), tenth((points[i][1] + target[1]) / 2)];
      if (inside(moved)) points[i] = moved;
    }
    layoutGrid = sampleGrid(outline, points, LAYOUT_CELL_SIZE);
    stats = gridStats(layoutGrid, points.length);
  }
  if (stats.areas.some((area) => area < MIN_CLICKABLE_AREA)) return null;
  if (pieceCounts(layoutGrid, points.length).some((pieces) => pieces !== 1)) return null;
  // Precincts are neighbors only when their drawn cells share a border (not just a corner), whatever the grid says.
  const cells = voronoiCells(points);
  const bordering = stats.neighbors.map(() => []);
  stats.neighbors.forEach((list, i) => {
    for (const j of list) {
      if (j < i) continue;
      const edge = sharedVoronoiEdge(cells[i], points[i], points[j], 0.05);
      if (edge && Math.hypot(edge[0][0] - edge[1][0], edge[0][1] - edge[1][1]) >= 0.5) {
        bordering[i].push(j);
        bordering[j].push(i);
      }
    }
  });
  stats.neighbors = bordering.map((list) => list.sort((a, b) => a - b));
  if (!isGraphConnected(stats.neighbors)) return null;

  // Smaller precincts hold more voters: the baseline shares are ranked by 1 / area, with a little noise.
  const densityKey = stats.areas.map((area) => Math.exp(randomBetween(random, Math.log(0.92), Math.log(1.08))) / area);
  const shares = skewedVoterWeights(random, densityKey, districtCount);
  const shareTotal = shares.reduce((a, b) => a + b, 0);
  const raw = shares.map((w) => (baseline * w) / shareTotal);
  // Each city's voters go to the precincts around it, in proportion to how close each precinct is, how large it is, and how
  // many baseline voters it already has, so cities thicken the precincts that are already big and the median precinct stays small.
  // No precinct may take more than a share of an ideal district: its excess flows on to the next-nearest precincts.
  const totalVoters = baseline + cities.reduce((sum, c) => sum + c.pop, 0);
  const cap = (CITY_PRECINCT_CAP * totalVoters) / districtCount;
  // Uneven caps keep precinct sizes from stacking in neat multiples, which would stall the district balancer.
  const caps = points.map(() => cap * randomBetween(random, 0.55, 1));
  for (const city of cities) {
    const twoSigmaSquared = 2 * (CITY_CORE * citySigma(city.pop)) ** 2;
    const kernel = points.map((p, i) => Math.exp(-distanceSquared(p, [city.x, city.y]) / twoSigmaSquared) * stats.areas[i] * (raw[i] + 0.1 * baseline / points.length));
    let remaining = city.pop;
    const open = new Set(kernel.map((_, i) => i));
    for (let round = 0; round < 12 && remaining > 0.5 && open.size; round += 1) {
      const openTotal = [...open].reduce((sum, i) => sum + kernel[i], 0);
      if (!(openTotal > 0)) break;
      let given = 0;
      for (const i of [...open]) {
        const want = (remaining * kernel[i]) / openTotal;
        const room = Math.max(0, caps[i] - raw[i]);
        const take = Math.min(want, room);
        raw[i] += take;
        given += take;
        if (take < want) open.delete(i);
      }
      remaining -= given;
    }
    // Anything still left (every nearby precinct full) goes to the largest-kernel precinct, so the city's total is exact.
    if (remaining > 0.5) {
      let best = 0;
      kernel.forEach((k, i) => { if (k > kernel[best]) best = i; });
      raw[best] += remaining;
    }
  }
  let reference = null;
  for (let t = 0; t < REFERENCE_TRIES && !reference; t += 1) {
    reference = buildReferencePlan(random, points, stats.neighbors, raw, districtCount);
  }
  if (!reference) return null;

  const totals = raw.map((w, i) => Math.max(1, Math.round(w * reference.factors[reference.plan[i]])));
  const spread = voterSpread(totals, districtCount);
  if (spread.topShare < 0.25 || spread.medianToMean > 0.5 || spread.maxToIdeal > MAX_PRECINCT_SHARE) return null;

  const density = totals.map((t, i) => t / (stats.areas[i] * SQ_MILES_PER_PX));
  const medianDensity = median(density);
  const densityIndex = density.map((d) => Math.round((d / medianDensity) * 100) / 100);
  // Precincts report their density as a whole number, so the size check ranks the same rounded values the rest of the app sees.
  const shownDensity = density.map((d) => Math.max(1, Math.round(d)));
  if (!sizesFollowDensity(stats.areas, shownDensity, densityIndex, cities.length === 0)) return null;
  // The badge grid is coarser than the layout grid and is only built once the layout is accepted.
  const grid = sampleGrid(outline, points, GRID_CELL_SIZE);
  return { outline, points, cells, grid, stats, totals, density, densityIndex, reference, cities, baseline };
}

function rankOf(values) {
  const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(values.length);
  order.forEach(([, i], rank) => {
    ranks[i] = rank;
  });
  return ranks;
}

// Dense precincts must be small: rank correlation of density and area of at most -0.8, the densest tenth averaging at most a
// third of the sparsest tenth's area (with a margin), and urban < suburban < rural by average area. With no cities every
// precinct must also stay within a quarter to four times the average area. Layouts that miss are drawn again.
const SIZE_RATIO_LIMIT = 0.32;
function sizesFollowDensity(areas, density, densityIndex, noCities) {
  const n = areas.length;
  const average = areas.reduce((a, b) => a + b, 0) / n;
  if (noCities && areas.some((a) => a < 0.27 * average || a > 3.9 * average)) return false;
  const byDensity = rankOf(density);
  const byArea = rankOf(areas);
  const mid = (n - 1) / 2;
  let both = 0;
  let spread = 0;
  for (let i = 0; i < n; i += 1) {
    both += (byDensity[i] - mid) * (byArea[i] - mid);
    spread += (byDensity[i] - mid) ** 2;
  }
  if (both / spread > -0.84) return false;
  const order = areas.map((_, i) => i).sort((a, b) => density[b] - density[a]);
  const tenth = Math.max(1, Math.round(n / 10));
  const mean = (list) => list.reduce((sum, i) => sum + areas[i], 0) / list.length;
  if (mean(order.slice(0, tenth)) / mean(order.slice(-tenth)) > SIZE_RATIO_LIMIT) return false;
  const typeAreas = { urban: [], suburban: [], rural: [] };
  densityIndex.forEach((value, i) => typeAreas[classifyDensity(value)].push(areas[i]));
  const average_ = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;
  const present = ['urban', 'suburban', 'rural'].filter((type) => typeAreas[type].length).map((type) => average_(typeAreas[type]));
  return present.every((value, i) => i === 0 || present[i - 1] < value);
}

// Voter phase: how many of each precinct's voters are side A. It never changes the layout.
// `target` fixes side A's statewide share; without it a close race is drawn, as for random states.
// `cityScale` scales how strongly dense precincts lean side A (1 is the random-state pattern, negative flips it).
export function splitVoters(layout, random, { target, cityScale = 1 } = {}) {
  const { outline, points, totals, densityIndex } = layout;
  const box = boundingBox(outline);
  const center = [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
  const halfSpan = Math.max(box.maxX - box.minX, box.maxY - box.minY) / 2;
  const angle = randomBetween(random, 0, TAU);
  const baseLean = points.map((point, i) => {
    const along = ((point[0] - center[0]) * Math.cos(angle) + (point[1] - center[1]) * Math.sin(angle)) / halfSpan;
    const regional = 0.04 * Math.max(-1, Math.min(1, along));
    const curve = Math.tanh(LEAN_STEEPNESS * Math.log(Math.max(densityIndex[i], 0.01) / LEAN_PIVOT));
    return cityScale * (curve > 0 ? LEAN_AMPLITUDE_URBAN : LEAN_AMPLITUDE_RURAL) * curve + regional + randomBetween(random, -0.04, 0.04);
  });
  // Close statewide race: 48.5–51.5% for side A, with each side ahead about half the time.
  let sideAAhead = null;
  let goal = target;
  if (goal === undefined) {
    sideAAhead = random() < 0.5;
    goal = 0.5 + (sideAAhead ? 1 : -1) * randomBetween(random, 0.003, 0.015);
  }
  const offset = solveStatewideOffset(totals, baseLean, goal);
  const sideA = totals.map((t, i) => Math.round(t * Math.min(0.92, Math.max(0.08, 0.5 + offset + baseLean[i]))));
  const allVoters = totals.reduce((a, b) => a + b, 0);
  const statewideShareA = sideA.reduce((a, b) => a + b, 0) / allVoters;
  return { sideA, statewideShareA, sideAAhead, target: goal };
}

export function assemblePrecincts(layout, sideA, names) {
  const { points, stats, totals, density, densityIndex, reference } = layout;
  const cells = layout.cells ?? voronoiCells(points);
  const precincts = points.map((point, i) => ({
    id: precinctId(i),
    index: i,
    name: names[i],
    polygon: cells[i],
    seedPoint: [Math.round(point[0] * 10) / 10, Math.round(point[1] * 10) / 10],
    center: stats.centers[i].map((v) => Math.round(v * 10) / 10),
    area: stats.areas[i],
    neighbors: stats.neighbors[i].map(precinctId),
    sideAVoters: sideA[i],
    sideBVoters: totals[i] - sideA[i],
    totalVoters: totals[i],
    densityIndex: densityIndex[i],
    type: classifyDensity(densityIndex[i]),
    density: Math.max(1, Math.round(density[i])),
  }));
  const referencePlan = Object.fromEntries(precincts.map((c, i) => [c.id, reference.plan[i] + 1]));
  return { precincts, referencePlan };
}

export function generateStateName(random) {
  return `${pick(random, STATE_PREFIXES)} ${pick(random, STATE_ROOTS)}`;
}

function tryGenerate(random, precinctCount, districtCount, baseline) {
  const shape = generateOutline(random);
  const { outline, shapeFeatures } = shape;
  const cities = drawCities(random, outline);
  const towns = createTowns(random, outline);
  const layout = buildLayout(random, { outline, weightAt: createCityField(cities, towns), cities, baseline, precinctCount, districtCount });
  if (!layout) return null;

  const voters = splitVoters(layout, random);
  const { statewideShareA, sideAAhead } = voters;
  if (statewideShareA < 0.48 || statewideShareA > 0.52 || (statewideShareA > 0.5) !== sideAAhead) return null;

  const names = generateNames(random, layout.points.length);
  const { precincts, referencePlan } = assemblePrecincts(layout, voters.sideA, names);
  const name = generateStateName(random);
  return { outline, shapeFeatures, grid: layout.grid, precincts, referencePlan, name, statewideShareA, cities, baseline };
}

// The state object every part of the app reads; districts start empty.
export function assembleState({ seed, name, outline, shapeFeatures, statewideShareA, grid, precincts, referencePlan, districtCount, attempts, cities = [], baseline = 0 }) {
  const totalVoters = precincts.reduce((sum, c) => sum + c.totalVoters, 0);
  const state = {
    seed: String(seed),
    name,
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    outline,
    shapeFeatures,
    statewideShareA,
    grid,
    precincts,
    precinctsById: new Map(precincts.map((c) => [c.id, c])),
    districtCount,
    // Districts start empty: no precinct belongs to any district until the user adds it.
    assignments: Object.fromEntries(precincts.map((c) => [c.id, null])),
    referencePlan,
    cities,
    baseline,
    totalVoters,
    idealDistrictVoters: Math.round(totalVoters / districtCount),
    balanceRatio: BALANCE_RATIO,
    generationAttempts: attempts,
  };
  state.districts = summarizeDistricts(state);
  return state;
}

export function generateState({ seed, precinctCount, districtCount } = {}) {
  if (seed === undefined || seed === null || String(seed) === '') throw new Error('A seed is required to generate a state');
  const fixedPrecincts = validateCount(precinctCount, PRECINCT_RANGE, 'precinctCount');
  const fixedDistricts = validateCount(districtCount, DISTRICT_RANGE, 'districtCount');
  const random = createRandom(seed);
  const precincts = fixedPrecincts ?? randomInt(random, PRECINCT_RANGE.min, PRECINCT_RANGE.max);
  const districts = fixedDistricts ?? randomInt(random, DISTRICT_RANGE.min, DISTRICT_RANGE.max);
  const baseline = baselineFor(seed);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const result = tryGenerate(random, precincts, districts, baseline);
    if (!result) continue;
    return assembleState({ seed, ...result, districtCount: districts, attempts: attempt + 1 });
  }
  throw new Error(`Could not generate a valid state for seed "${seed}"`);
}
