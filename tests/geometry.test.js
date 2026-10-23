import { test, assert, assertEqual } from './test-runner.js';
import { createRandom, randomBetween } from '../src/random.js';
import { generateOutline } from '../src/outline.js';
import { MAP_HEIGHT, MAP_WIDTH, clipByHalfPlane, countGridComponents, distanceSquared, gridStats, pieceCounts, sampleGrid, voronoiCells } from '../src/geometry.js';

// The reference versions below are the plain scans the lookups replace.

function scanOwners(grid, points) {
  const owner = new Int16Array(grid.cols * grid.rows).fill(-1);
  for (let k = 0; k < owner.length; k += 1) {
    if (grid.owner[k] < 0) continue;
    const x = ((k % grid.cols) + 0.5) * grid.cellSize;
    const y = (Math.floor(k / grid.cols) + 0.5) * grid.cellSize;
    let best = -1;
    let bestDistance = Infinity;
    for (let i = 0; i < points.length; i += 1) {
      const d = distanceSquared(points[i], [x, y]);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    owner[k] = best;
  }
  return owner;
}

function scanCell(points, i) {
  let cell = [[0, 0], [MAP_WIDTH, 0], [MAP_WIDTH, MAP_HEIGHT], [0, MAP_HEIGHT]];
  const p = points[i];
  for (let j = 0; j < points.length && cell.length; j += 1) {
    if (j === i) continue;
    const q = points[j];
    const nx = q[0] - p[0];
    const ny = q[1] - p[1];
    cell = clipByHalfPlane(cell, nx, ny, (nx * (p[0] + q[0])) / 2 + (ny * (p[1] + q[1])) / 2);
  }
  return cell;
}

function scatter(random, outline, count) {
  const points = [];
  while (points.length < count) points.push([randomBetween(random, 40, MAP_WIDTH - 40), randomBetween(random, 40, MAP_HEIGHT - 40)]);
  return points;
}

test('sampleGrid with the nearest-seed lookup matches a scan of every seed', () => {
  for (const count of [1, 100, 700]) {
    for (let s = 0; s < 5; s += 1) {
      const random = createRandom(`grid-${count}-${s}`);
      const { outline } = generateOutline(random);
      const points = scatter(random, outline, count);
      const grid = sampleGrid(outline, points, 8);
      assertEqual(Array.from(grid.owner), Array.from(scanOwners(grid, points)), `owners for ${count} seeds, outline ${s}`);
    }
  }
});

test('sampleGrid at 700 seeds on a 2 px grid is fast', () => {
  const random = createRandom('grid-speed');
  const { outline } = generateOutline(random);
  const points = scatter(random, outline, 700);
  const start = performance.now();
  sampleGrid(outline, points, 2);
  const elapsed = performance.now() - start;
  assert(elapsed < 150, `sampleGrid took ${Math.round(elapsed)} ms`);
});

test('voronoiCells with nearby-first clipping matches clipping against every seed', () => {
  for (const count of [60, 300]) {
    const random = createRandom(`cells-${count}`);
    const { outline } = generateOutline(random);
    const points = scatter(random, outline, count);
    const cells = voronoiCells(points);
    const sorted = (cell) => [...cell].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    points.forEach((_, i) => {
      const expected = sorted(scanCell(points, i));
      const actual = sorted(cells[i]);
      assertEqual(actual.length, expected.length, `vertex count of cell ${i} of ${count}`);
      actual.forEach(([x, y], k) => {
        assert(Math.abs(x - expected[k][0]) < 0.02 && Math.abs(y - expected[k][1]) < 0.02, `vertex ${k} of cell ${i} of ${count}`);
      });
    });
  }
});

test('pieceCounts matches countGridComponents, including empty and split cells', () => {
  const grid = { cellSize: 1, cols: 5, rows: 1, owner: Int16Array.from([0, 1, 0, -1, 1]) };
  assertEqual(Array.from(pieceCounts(grid, 3)), [2, 2, 0]);
  for (let i = 0; i < 3; i += 1) assertEqual(pieceCounts(grid, 3)[i], countGridComponents(grid, i), `seed ${i}`);
  const random = createRandom('pieces');
  const { outline } = generateOutline(random);
  const points = scatter(random, outline, 150);
  const real = sampleGrid(outline, points, 4);
  const counts = pieceCounts(real, points.length);
  points.forEach((_, i) => assertEqual(counts[i], countGridComponents(real, i), `precinct ${i}`));
});

test('gridStats reports centers for every seed that has cells', () => {
  const random = createRandom('centers');
  const { outline } = generateOutline(random);
  const points = scatter(random, outline, 80);
  const stats = gridStats(sampleGrid(outline, points, 4), points.length);
  assertEqual(stats.centers.length, points.length);
  assert(stats.centers.every((c, i) => c === null || (stats.areas[i] > 0 && c[0] > 0 && c[1] > 0)), 'centers match areas');
});
