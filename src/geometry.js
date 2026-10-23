export const MAP_WIDTH = 800;
export const MAP_HEIGHT = 600;

export function polygonArea(polygon) {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const [x1, y1] = polygon[i];
    const [x2, y2] = polygon[(i + 1) % polygon.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export function pointInPolygon([x, y], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function distanceSquared([ax, ay], [bx, by]) {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

// Keeps the part of a convex polygon where dot(normal, p) <= offset.
export function clipByHalfPlane(polygon, nx, ny, offset) {
  const result = [];
  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const dc = nx * current[0] + ny * current[1] - offset;
    const dn = nx * next[0] + ny * next[1] - offset;
    if (dc <= 0) result.push(current);
    if ((dc < 0 && dn > 0) || (dc > 0 && dn < 0)) {
      const t = dc / (dc - dn);
      result.push([current[0] + t * (next[0] - current[0]), current[1] + t * (next[1] - current[1])]);
    }
  }
  return result;
}

// Buckets seeds into squares about one seed spacing wide, so the nearest seed to a point is found without scanning every seed.
function createSeedIndex(points, width, height) {
  const size = Math.max(8, Math.sqrt((width * height) / Math.max(1, points.length)));
  const cols = Math.ceil(width / size);
  const rows = Math.ceil(height / size);
  const buckets = Array.from({ length: cols * rows }, () => []);
  const bucketOf = (value, limit) => Math.min(limit - 1, Math.max(0, Math.floor(value / size)));
  points.forEach((p, i) => {
    buckets[bucketOf(p[1], rows) * cols + bucketOf(p[0], cols)].push(i);
  });
  return { size, cols, rows, buckets, bucketOf };
}

// The nearest seed to (x, y); ties go to the lower index, exactly as a scan from the first seed would.
function nearestSeed(index, points, x, y) {
  const { size, cols, rows, buckets, bucketOf } = index;
  const cx = bucketOf(x, cols);
  const cy = bucketOf(y, rows);
  let best = -1;
  let bestDistance = Infinity;
  const limit = Math.max(cols, rows);
  for (let ring = 0; ring <= limit; ring += 1) {
    for (let r = Math.max(0, cy - ring); r <= Math.min(rows - 1, cy + ring); r += 1) {
      const edgeRow = r === cy - ring || r === cy + ring;
      const step = edgeRow || ring === 0 ? 1 : 2 * ring;
      for (let c = cx - ring; c <= cx + ring; c += step) {
        if (c < 0 || c >= cols) continue;
        for (const i of buckets[r * cols + c]) {
          const dx = points[i][0] - x;
          const dy = points[i][1] - y;
          const d = dx * dx + dy * dy;
          if (d < bestDistance || (d === bestDistance && i < best)) {
            bestDistance = d;
            best = i;
          }
        }
      }
    }
    // Anything in a farther ring is at least `ring` bucket widths away.
    if (best >= 0 && bestDistance <= (ring * size) ** 2) break;
  }
  return best;
}

// Seed indexes farther than sqrt(innerSquared) and within `radius` of a point, nearest first.
function seedsInAnnulus(index, points, p, innerSquared, radius) {
  const { cols, rows, buckets, bucketOf } = index;
  const found = [];
  const outerSquared = radius * radius;
  for (let r = bucketOf(p[1] - radius, rows); r <= bucketOf(p[1] + radius, rows); r += 1) {
    for (let c = bucketOf(p[0] - radius, cols); c <= bucketOf(p[0] + radius, cols); c += 1) {
      for (const i of buckets[r * cols + c]) {
        const d = distanceSquared(points[i], p);
        if (d > innerSquared && d <= outerSquared) found.push([d, i]);
      }
    }
  }
  return found.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

export function voronoiCells(points, width = MAP_WIDTH, height = MAP_HEIGHT) {
  const index = createSeedIndex(points, width, height);
  const spacing = index.size;
  return points.map((p, i) => {
    let cell = [[0, 0], [width, 0], [width, height], [0, height]];
    let innerSquared = -1;
    let radius = 3 * spacing;
    for (;;) {
      for (const [, j] of seedsInAnnulus(index, points, p, innerSquared, radius)) {
        if (j === i) continue;
        const q = points[j];
        const nx = q[0] - p[0];
        const ny = q[1] - p[1];
        const offset = (nx * (p[0] + q[0])) / 2 + (ny * (p[1] + q[1])) / 2;
        cell = clipByHalfPlane(cell, nx, ny, offset);
        if (!cell.length) break;
      }
      // A seed farther than twice the cell's farthest corner cannot cut the cell.
      const reach = Math.sqrt(Math.max(0, ...cell.map((v) => distanceSquared(v, p))));
      if (!cell.length || 2 * reach <= radius || radius > 2 * Math.hypot(width, height)) break;
      innerSquared = radius * radius;
      radius *= 2;
    }
    return cell.map(([x, y]) => [round2(x), round2(y)]);
  });
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

export function sharedVoronoiEdge(cell, p, q, tolerance = 0.5) {
  const onBisector = (point) =>
    Math.abs(Math.sqrt(distanceSquared(point, p)) - Math.sqrt(distanceSquared(point, q))) < tolerance;
  for (let i = 0; i < cell.length; i += 1) {
    const a = cell[i];
    const b = cell[(i + 1) % cell.length];
    if (distanceSquared(a, b) < 0.01) continue;
    if (onBisector(a) && onBisector(b)) return [a, b];
  }
  return null;
}

// Rasterizes the state into grid cells, each owned by the nearest seed point or -1 outside the state.
export function sampleGrid(outline, points, cellSize, width = MAP_WIDTH, height = MAP_HEIGHT) {
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const owner = new Int16Array(cols * rows).fill(-1);
  const index = createSeedIndex(points, width, height);
  for (let r = 0; r < rows; r += 1) {
    const y = (r + 0.5) * cellSize;
    const crossings = scanlineCrossings(outline, y);
    for (let c = 0; c < cols; c += 1) {
      const x = (c + 0.5) * cellSize;
      if (!insideFromCrossings(crossings, x)) continue;
      owner[r * cols + c] = nearestSeed(index, points, x, y);
    }
  }
  return { cellSize, cols, rows, owner };
}

function scanlineCrossings(polygon, y) {
  const xs = [];
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if ((yi > y) !== (yj > y)) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
  }
  return xs.sort((a, b) => a - b);
}

function insideFromCrossings(xs, x) {
  let count = 0;
  for (const value of xs) {
    if (value < x) count += 1;
    else break;
  }
  return count % 2 === 1;
}

export function gridCellCenter(grid, index) {
  const c = index % grid.cols;
  const r = Math.floor(index / grid.cols);
  return [(c + 0.5) * grid.cellSize, (r + 0.5) * grid.cellSize];
}

export function forEachGridNeighbor(grid, index, callback) {
  const c = index % grid.cols;
  const r = Math.floor(index / grid.cols);
  if (c > 0) callback(index - 1);
  if (c < grid.cols - 1) callback(index + 1);
  if (r > 0) callback(index - grid.cols);
  if (r < grid.rows - 1) callback(index + grid.cols);
}

export function gridStats(grid, count) {
  const { cols, rows, owner, cellSize } = grid;
  const cellArea = cellSize * cellSize;
  const cells = new Float64Array(count);
  const sumX = new Float64Array(count);
  const sumY = new Float64Array(count);
  const neighborSets = Array.from({ length: count }, () => new Set());
  const link = (o, other) => {
    if (other >= 0 && other !== o) neighborSets[o].add(other);
  };
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const i = r * cols + c;
      const o = owner[i];
      if (o < 0) continue;
      cells[o] += 1;
      sumX[o] += (c + 0.5) * cellSize;
      sumY[o] += (r + 0.5) * cellSize;
      if (c > 0) link(o, owner[i - 1]);
      if (c < cols - 1) link(o, owner[i + 1]);
      if (r > 0) link(o, owner[i - cols]);
      if (r < rows - 1) link(o, owner[i + cols]);
    }
  }
  return {
    areas: Array.from(cells, (n) => n * cellArea),
    centers: Array.from(cells, (n, i) => (n ? [sumX[i] / n, sumY[i] / n] : null)),
    neighbors: neighborSets.map((set) => [...set].sort((a, b) => a - b)),
  };
}

// The number of connected pieces each seed's cells form: 1 for a normal precinct, 0 when it has no cell. One scan of the grid.
export function pieceCounts(grid, count) {
  const { cols, rows, owner } = grid;
  const pieces = new Int32Array(count);
  const seen = new Uint8Array(owner.length);
  const stack = new Int32Array(owner.length);
  for (let start = 0; start < owner.length; start += 1) {
    const o = owner[start];
    if (o < 0 || seen[start]) continue;
    pieces[o] += 1;
    seen[start] = 1;
    let top = 0;
    stack[top++] = start;
    while (top) {
      const current = stack[--top];
      const c = current % cols;
      const r = (current - c) / cols;
      if (c > 0 && !seen[current - 1] && owner[current - 1] === o) { seen[current - 1] = 1; stack[top++] = current - 1; }
      if (c < cols - 1 && !seen[current + 1] && owner[current + 1] === o) { seen[current + 1] = 1; stack[top++] = current + 1; }
      if (r > 0 && !seen[current - cols] && owner[current - cols] === o) { seen[current - cols] = 1; stack[top++] = current - cols; }
      if (r < rows - 1 && !seen[current + cols] && owner[current + cols] === o) { seen[current + cols] = 1; stack[top++] = current + cols; }
    }
  }
  return pieces;
}

// A fast inside-the-outline test from a raster of cell centers (accurate to about half a cell).
export function createInsideTest(outline, cellSize = 2, width = MAP_WIDTH, height = MAP_HEIGHT) {
  const cols = Math.ceil(width / cellSize);
  const rows = Math.ceil(height / cellSize);
  const mask = new Uint8Array(cols * rows);
  for (let r = 0; r < rows; r += 1) {
    const crossings = scanlineCrossings(outline, (r + 0.5) * cellSize);
    for (let c = 0; c < cols; c += 1) if (insideFromCrossings(crossings, (c + 0.5) * cellSize)) mask[r * cols + c] = 1;
  }
  return ([x, y]) => {
    const c = Math.floor(x / cellSize);
    const r = Math.floor(y / cellSize);
    return c >= 0 && r >= 0 && c < cols && r < rows && mask[r * cols + c] === 1;
  };
}

// The center of the largest connected piece of one seed's cells (used to pull a split precinct's seed toward its main body).
export function largestPieceCenter(grid, index) {
  const { cols, rows, owner, cellSize } = grid;
  const seen = new Uint8Array(owner.length);
  const stack = [];
  let best = null;
  for (let start = 0; start < owner.length; start += 1) {
    if (owner[start] !== index || seen[start]) continue;
    let count = 0;
    let sumX = 0;
    let sumY = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length) {
      const current = stack.pop();
      const c = current % cols;
      const r = (current - c) / cols;
      count += 1;
      sumX += (c + 0.5) * cellSize;
      sumY += (r + 0.5) * cellSize;
      for (const next of [c > 0 ? current - 1 : -1, c < cols - 1 ? current + 1 : -1, r > 0 ? current - cols : -1, r < rows - 1 ? current + cols : -1]) {
        if (next >= 0 && !seen[next] && owner[next] === index) {
          seen[next] = 1;
          stack.push(next);
        }
      }
    }
    if (!best || count > best.count) best = { count, center: [sumX / count, sumY / count] };
  }
  return best ? best.center : null;
}

export function countGridComponents(grid, index) {
  const seen = new Uint8Array(grid.owner.length);
  let components = 0;
  for (let i = 0; i < grid.owner.length; i += 1) {
    if (grid.owner[i] !== index || seen[i]) continue;
    components += 1;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const current = stack.pop();
      forEachGridNeighbor(grid, current, (n) => {
        if (!seen[n] && grid.owner[n] === index) {
          seen[n] = 1;
          stack.push(n);
        }
      });
    }
  }
  return components;
}

// Splits a set of node ids into connected groups using an adjacency lookup.
export function connectedComponents(ids, getNeighbors) {
  const remaining = new Set(ids);
  const groups = [];
  for (const start of ids) {
    if (!remaining.has(start)) continue;
    remaining.delete(start);
    const group = [start];
    for (let k = 0; k < group.length; k += 1) {
      for (const n of getNeighbors(group[k])) {
        if (remaining.has(n)) {
          remaining.delete(n);
          group.push(n);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

// Distance (in grid steps) from each in-state cell to the nearest cell with a different group or outside the state.
export function interiorDistances(grid, groupOfCell) {
  const distance = new Int32Array(grid.owner.length).fill(-1);
  const queue = new Int32Array(grid.owner.length);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < grid.owner.length; i += 1) {
    const g = groupOfCell(i);
    if (g === null) continue;
    let edge = false;
    const c = i % grid.cols;
    const r = Math.floor(i / grid.cols);
    if (c === 0 || r === 0 || c === grid.cols - 1 || r === grid.rows - 1) edge = true;
    else {
      forEachGridNeighbor(grid, i, (n) => {
        if (groupOfCell(n) !== g) edge = true;
      });
    }
    if (edge) {
      distance[i] = 1;
      queue[tail] = i;
      tail += 1;
    }
  }
  while (head < tail) {
    const current = queue[head];
    head += 1;
    const g = groupOfCell(current);
    forEachGridNeighbor(grid, current, (n) => {
      if (distance[n] === -1 && groupOfCell(n) === g) {
        distance[n] = distance[current] + 1;
        queue[tail] = n;
        tail += 1;
      }
    });
  }
  return distance;
}

export function pathFromPolygon(polygon) {
  return `M${polygon.map(([x, y]) => `${x},${y}`).join('L')}Z`;
}
