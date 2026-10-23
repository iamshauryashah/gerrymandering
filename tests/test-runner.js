const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(condition, message = 'Assertion failed') {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message = 'Values differ') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: expected ${e}, got ${a}`);
}

export function assertThrows(fn, pattern, message = 'Expected function to throw') {
  try {
    fn();
  } catch (error) {
    if (pattern && !pattern.test(error.message)) {
      throw new Error(`${message}: error "${error.message}" did not match ${pattern}`);
    }
    return error;
  }
  throw new Error(message);
}

export const testNames = () => tests.map((t) => t.name);

// A small stable hash of a test's name (FNV-1a), so the page and scripts/test.py agree on which slice a test belongs to.
export function nameHash(name) {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// Runs the registered tests. `shard` is [index, count]: this run takes the tests whose name hashes into slice `index` of
// `count`, except that `assign` (a Map of name hash to slice) can place a known slow test in a particular slice. Every test
// lands in exactly one slice whatever `assign` holds, so a stale assignment can never skip a test.
export async function run(output = typeof document === 'undefined' ? null : document.getElementById('results'), { shard = null, assign = new Map() } = {}) {
  const results = { passed: 0, failed: 0, failures: [], timings: [], done: false };
  if (typeof window !== 'undefined') window.__testResults = results;
  const list = output ? document.createElement('ol') : null;
  output?.replaceChildren(list);
  const started = performance.now();
  for (const { name, fn } of tests) {
    if (shard) {
      const hash = nameHash(name);
      if ((assign.get(hash) ?? hash % shard[1]) !== shard[0]) continue;
    }
    const item = list ? document.createElement('li') : null;
    const t0 = performance.now();
    try {
      await fn();
      results.passed += 1;
      if (item) {
        item.className = 'pass';
        item.textContent = `PASS ${name}`;
      }
    } catch (error) {
      results.failed += 1;
      results.failures.push({ name, message: error.message });
      if (item) {
        item.className = 'fail';
        item.textContent = `FAIL ${name}: ${error.message}`;
      }
      console.error(name, error);
    }
    results.timings.push({ name, ms: Math.round(performance.now() - t0) });
    list?.append(item);
  }
  results.ms = Math.round(performance.now() - started);
  results.done = true;
  if (output) {
    const summary = document.createElement('p');
    summary.id = 'summary';
    summary.textContent = `${results.passed} passed, ${results.failed} failed`;
    summary.className = results.failed ? 'fail' : 'pass';
    output.prepend(summary);
    document.title = `${results.failed ? 'FAIL' : 'PASS'}: ${summary.textContent}`;
  }
  return results;
}
