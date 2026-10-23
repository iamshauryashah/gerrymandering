// A snapshot of what the brush engine did before feature 013 (the "only unclaimed precincts" option): 100 seeded strokes
// applied one after another to one plan, with the stroke message and a hash of the whole plan after each. With the option off
// or missing, the engine must still produce exactly this (013 FR-004, SC-002).
import { generateState } from './fixtures.js';
import { createRandom, randomBetween, randomInt } from '../src/random.js';
import { BRUSH_SIZE, applySegment, finishStroke, startStroke } from '../src/brush.js';

function planHash(state) {
  let h = 2166136261;
  for (const precinct of state.precincts) {
    const text = `${precinct.id}:${state.assignments[precinct.id] ?? 0};`;
    for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  }
  return h.toString(16);
}

// `extra` is added to every stroke's options (for example `{ unclaimedOnly: false }`).
export function playStrokes(extra = {}) {
  let state = generateState({ seed: 'brush-baseline' });
  const random = createRandom('baseline-strokes');
  const results = [];
  for (let i = 0; i < 100; i += 1) {
    const district = randomInt(random, 1, 8);
    const mode = random() < 0.25 ? 'erase' : 'add';
    const radius = randomInt(random, BRUSH_SIZE.min / BRUSH_SIZE.step, BRUSH_SIZE.max / BRUSH_SIZE.step) * BRUSH_SIZE.step;
    const stroke = startStroke(state, { district, mode, radius, ...extra });
    let a = [randomBetween(random, 40, 760), randomBetween(random, 40, 560)];
    const segments = random() < 0.4 ? 0 : randomInt(random, 1, 11);
    if (segments === 0) state = applySegment(state, stroke, a, a, { labels: false }).state;
    for (let k = 0; k < segments; k += 1) {
      const b = [a[0] + randomBetween(random, -80, 80), a[1] + randomBetween(random, -80, 80)];
      state = applySegment(state, stroke, a, b, { labels: false }).state;
      a = b;
    }
    results.push([finishStroke(state, stroke).message, planHash(state)]);
  }
  return results;
}

export const EXPECTED = [
  ["Added 25 precincts.", "3e60f789"],
  ["Added 87 precincts.", "1ac95f21"],
  ["Added 100 precincts, moved 1 precinct.", "91bc0f0b"],
  ["No precincts were changed: none of the 20 precincts under the brush are in District 4.", "91bc0f0b"],
  ["No precincts were changed: none of the 14 precincts under the brush are in District 7.", "91bc0f0b"],
  ["No precincts were changed: 72 precincts under the brush not touching District 4.", "91bc0f0b"],
  ["Added 134 precincts, moved 74 precincts, 4 already in District 2, skipped 15 (not touching District 2).", "9359196b"],
  ["No precincts were changed: none of the 46 precincts under the brush are in District 7.", "9359196b"],
  ["No precincts were changed: none of the 5 precincts under the brush are in District 1.", "9359196b"],
  ["No precincts under the brush.", "9359196b"],
  ["No precincts under the brush.", "9359196b"],
  ["No precincts were changed: none of the 6 precincts under the brush are in District 6.", "9359196b"],
  ["Added 76 precincts, moved 9 precincts, skipped 1 (not touching District 5).", "1b472022"],
  ["No precincts under the brush.", "1b472022"],
  ["No precincts under the brush.", "1b472022"],
  ["Added 7 precincts, moved 137 precincts.", "4d3ca160"],
  ["No precincts under the brush.", "4d3ca160"],
  ["Added 17 precincts, moved 56 precincts, skipped 1 (would split another district).", "219c6f57"],
  ["No precincts were changed: 172 precincts under the brush not touching District 5.", "219c6f57"],
  ["Removed 65 precincts, 178 not in District 7, skipped 4 (would split District 7).", "202bc584"],
  ["Moved 4 precincts.", "ba43970"],
  ["No precincts were changed: 7 precincts under the brush not touching District 1.", "ba43970"],
  ["No precincts were changed: 4 precincts under the brush not touching District 8.", "ba43970"],
  ["No precincts were changed: 131 precincts under the brush not touching District 4.", "ba43970"],
  ["Added 76 precincts, moved 57 precincts, 88 already in District 4, skipped 23 (would split another district or not touching District 4).", "bf9896dd"],
  ["No precincts were changed: 14 precincts under the brush not touching District 3.", "bf9896dd"],
  ["No precincts were changed: 28 precincts under the brush not touching District 7.", "bf9896dd"],
  ["No precincts under the brush.", "bf9896dd"],
  ["No precincts under the brush.", "bf9896dd"],
  ["No precincts under the brush.", "bf9896dd"],
  ["No precincts were changed: none of the 89 precincts under the brush are in District 6.", "bf9896dd"],
  ["Added 7 precincts, moved 120 precincts.", "cccada18"],
  ["No precincts under the brush.", "cccada18"],
  ["No precincts were changed: 1 precinct under the brush not touching District 7.", "cccada18"],
  ["Added 13 precincts, moved 143 precincts, 5 already in District 4.", "34fb1316"],
  ["No precincts under the brush.", "34fb1316"],
  ["No precincts under the brush.", "34fb1316"],
  ["No precincts under the brush.", "34fb1316"],
  ["Removed 7 precincts, 36 not in District 4.", "49078a32"],
  ["Added 45 precincts, moved 81 precincts.", "c1b4190a"],
  ["No precincts were changed: none of the 66 precincts under the brush are in District 2.", "c1b4190a"],
  ["Moved 116 precincts, 40 already in District 6.", "598a5816"],
  ["No precincts were changed: none of the 34 precincts under the brush are in District 7.", "598a5816"],
  ["No precincts were changed: 73 precincts under the brush not touching District 1.", "598a5816"],
  ["No precincts were changed: none of the 19 precincts under the brush are in District 6.", "598a5816"],
  ["No precincts were changed: none of the 19 precincts under the brush are in District 4.", "598a5816"],
  ["No precincts were changed: 163 precincts under the brush not touching District 1.", "598a5816"],
  ["No precincts were changed: 68 precincts under the brush not touching District 1.", "598a5816"],
  ["Moved 156 precincts, 96 already in District 4, skipped 1 (would split another district).", "6e14b78a"],
  ["No precincts under the brush.", "6e14b78a"],
  ["Added 4 precincts.", "8d18a6ca"],
  ["No precincts under the brush.", "8d18a6ca"],
  ["Added 44 precincts, moved 222 precincts, 85 already in District 6, skipped 12 (not touching District 6 or would split another district).", "ebc7e90c"],
  ["No precincts were changed: 154 precincts under the brush not touching District 4.", "ebc7e90c"],
  ["Moved 134 precincts.", "acbf90b4"],
  ["No precincts under the brush.", "acbf90b4"],
  ["Moved 49 precincts, skipped 1 (would split another district).", "d87982f8"],
  ["No precincts were changed: 2 precincts under the brush not touching District 8.", "d87982f8"],
  ["No precincts under the brush.", "d87982f8"],
  ["Moved 16 precincts, skipped 12 (would split another district or not touching District 3).", "25a5f49e"],
  ["No precincts were changed: 39 precincts under the brush not touching District 8.", "25a5f49e"],
  ["No precincts under the brush.", "25a5f49e"],
  ["No precincts were changed: 2 precincts under the brush not touching District 3.", "25a5f49e"],
  ["Moved 12 precincts.", "4cbacbf8"],
  ["No precincts were changed: 28 precincts under the brush not touching District 1.", "4cbacbf8"],
  ["No precincts were changed: 38 precincts under the brush not touching District 5.", "4cbacbf8"],
  ["Moved 3 precincts, 8 already in District 5.", "f5a1526f"],
  ["No precincts under the brush.", "f5a1526f"],
  ["Moved 2 precincts, 4 already in District 5, skipped 21 (not touching District 5 or would split another district).", "8ea93fab"],
  ["No precincts under the brush.", "8ea93fab"],
  ["Removed 4 precincts, 112 not in District 7.", "9aea7537"],
  ["No precincts under the brush.", "9aea7537"],
  ["Moved 37 precincts, 1 already in District 2, skipped 220 (not touching District 2 or would split another district).", "e7a2ff94"],
  ["No precincts under the brush.", "e7a2ff94"],
  ["Added 9 precincts, moved 139 precincts, 238 already in District 6, skipped 30 (would split another district or not touching District 6).", "1918e086"],
  ["Removed 12 precincts, 4 not in District 6.", "1cb26992"],
  ["Removed 46 precincts, 81 not in District 2.", "8d763e6e"],
  ["No precincts were changed: 237 precincts under the brush not touching District 8.", "8d763e6e"],
  ["Added 3 precincts, moved 60 precincts.", "162f850"],
  ["No precincts under the brush.", "162f850"],
  ["Moved 22 precincts, skipped 21 (would split another district or not touching District 7).", "d2063dfc"],
  ["No precincts under the brush.", "d2063dfc"],
  ["No precincts were changed: 68 precincts under the brush not touching District 4 or would split another district.", "d2063dfc"],
  ["No precincts under the brush.", "d2063dfc"],
  ["No precincts were changed: 11 precincts under the brush not touching District 5.", "d2063dfc"],
  ["No precincts were changed: 71 precincts under the brush not touching District 8 or would split another district.", "d2063dfc"],
  ["Added 22 precincts, moved 49 precincts.", "fff33092"],
  ["No precincts were changed: 4 precincts under the brush not touching District 4.", "fff33092"],
  ["No precincts were changed: none of the 12 precincts under the brush are in District 2.", "fff33092"],
  ["Added 9 precincts, moved 109 precincts, 6 already in District 1, skipped 6 (would split another district).", "1f92f6a0"],
  ["No precincts were changed: none of the 74 precincts under the brush are in District 1.", "1f92f6a0"],
  ["No precincts were changed: 12 precincts under the brush not touching District 4.", "1f92f6a0"],
  ["Moved 106 precincts, 7 already in District 1.", "89260b8c"],
  ["No precincts under the brush.", "89260b8c"],
  ["No precincts were changed: none of the 2 precincts under the brush are in District 6.", "89260b8c"],
  ["No precincts under the brush.", "89260b8c"],
  ["No precincts under the brush.", "89260b8c"],
  ["Moved 13 precincts.", "c45662c5"],
  ["No precincts under the brush.", "c45662c5"],
  ["Added 6 precincts, moved 99 precincts, 203 already in District 6, skipped 9 (would split another district or not touching District 6).", "89f4bfba"],
];
