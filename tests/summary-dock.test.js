import { test, assert, assertEqual } from './test-runner.js';
import { chooseDockCount } from '../src/ui/summary-dock.js';

test('chooseDockCount takes every block when they all fit (012 FR-001)', () => {
  assertEqual(chooseDockCount(3, () => true), 3);
});

test('chooseDockCount takes none when nothing fits (012 FR-003)', () => {
  assertEqual(chooseDockCount(3, () => false), 0);
});

test('chooseDockCount takes only the first block when only one fits', () => {
  assertEqual(chooseDockCount(3, (count) => count <= 1), 1);
});

test('chooseDockCount tries the largest count first and stops at the first that fits, even if the predicate is not monotonic', () => {
  const tried = [];
  const result = chooseDockCount(3, (count) => {
    tried.push(count);
    return count === 2 || count === 1;
  });
  assertEqual(result, 2);
  assertEqual(tried, [3, 2]);
});

test('chooseDockCount with no blocks returns 0 and never asks', () => {
  let asked = false;
  assertEqual(chooseDockCount(0, () => {
    asked = true;
    return true;
  }), 0);
  assert(!asked, 'the predicate was not called');
});
