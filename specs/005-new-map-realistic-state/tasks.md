---
description: "Tasks for feature 005"
---

# Tasks: New Map Button, Close Elections With Realistic Voter Patterns, 10% Balance, and Irregular State Shapes

**Input**: Design documents from `/specs/005-new-map-realistic-state/`

**Prerequisites**:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/changes.md](./contracts/changes.md)
- [quickstart.md](./quickstart.md)

**Tests**: Included. The success criteria (SC-001 to SC-008) are checked on the browser test page `tests/index.html`.

## Phase 1: Setup

- [X] T001 Run `tests/index.html` with the cache disabled and record the baseline (39 passed) before any change, using `python3 -m http.server 8000` from the project root.

---

## Phase 2: Foundational

- [X] T002 In `src/state-generator.js`, split `tryGenerate` into separately callable steps:
  - outline
  - density field
  - county partition
  - voter assignment
  - lean assignment
  - reference plan

  Keep the output identical for now, so the voter-model and outline changes in later phases can replace single steps.

**Checkpoint**: The test page still shows 39 passed.

---

## Phase 3: User Story 1 - Generate a New Map (Priority: P1) 🎯 MVP

**Goal**: A "New map" button replaces the state with a new random one, asking first when any work would be lost.

**Independent Test**:
1. Click **New map**.
2. Check that the map, district list, and `?seed=` change, and that reloading the page reproduces the new map.
3. Assign a county, click again, and cancel. Nothing should change.

### Tests

- [X] T003 [P] [US1] Add UI tests in `tests/ui.test.js`:
  1. The `button[data-role="new-map"]` exists, is a `<button>`, and has the text "New map".
  2. Clicking it with no assignments loads a different seed. Districts are empty, editing is off, the matchup is kept, the caption link matches, and `location.search` contains the new seed.
  3. With an assignment and an injected `confirm` that returns `false`, nothing changes. With one that returns `true`, the map is replaced.
  4. `app.newMap()` returns `true` or `false` to match.

### Implementation

- [X] T004 [US1] Add `<button type="button" class="new-map-button" data-role="new-map">New map</button>` to `index.html`, beside the matchup toggle in the toolbar.
- [X] T005 [P] [US1] Style `.new-map-button` in `styles.css` to match the toggle: focus ring, at least a 44 px touch target, and wrapping on a 320 px wide screen.
- [X] T006 [US1] Update `src/main.js`:
  - Accept `confirm` in `createApp(root, { seed, confirm })`, defaulting to `window.confirm`.
  - Add `newMap()`. When any county is assigned, it calls `confirm('Start a new map? Your districts will be lost.')` and returns `false` if canceled. Otherwise it runs `load(createSeed())`, updates the address with `history.replaceState(null, '', '?seed=' + encodeURIComponent(seed))` (keeping other query parameters), and returns `true`.
  - Wire the button click to `newMap()`.
  - Expose `newMap` on the app object.

**Checkpoint**: US1 works with the existing generator.

---

## Phase 4: User Story 2 - Realistic Voter Patterns in a Close State (Priority: P1)

**Goal**: Uneven county sizes, with cities leaning to side A and rural counties to side B, and a statewide result of 48–52% with a random winner.

**Independent Test**: The 100-seed tests for SC-003, SC-004, and SC-005 pass.

### Tests

- [X] T007 [P] [US2] Add 100-seed tests in `tests/state-generator.test.js`:
  - In every map, the top 10% of counties by voters hold ≥ 25% of voters, median ≤ 0.5 × mean, and max county ≤ 0.75 × ideal district (FR-006, FR-007).
  - `statewideShareA` and the summed side-A share are both in [0.48, 0.52] (FR-012).
  - Side A leads in 35–65% of maps.
  - On average, side A wins 10–30% of counties (FR-011).
  - Grouping counties into 4 size tiers, side B's pooled share rises from the largest tier to the smallest, and the smallest tier is 65–80% side B (SC-005).
  - Urban counties are ≥ 80% side-A wins; rural counties are ≥ 80% side-B wins. At most 5% of rural counties lean A per map, averaged.
  - Log the ranges with `console.info`.

### Implementation

- [X] T008 [US2] Implement skewed voter totals in `src/state-generator.js`:
  1. Rank counties by density weight × ±15% noise.
  2. Assign sorted lognormal quantiles with σ ∈ [1.0, 1.3] from the seeded random generator, largest to densest.
  3. Clamp to `0.75 × ideal` with renormalization, up to 10 rounds.
  4. Keep the total voter range used by the current model.
- [X] T009 [US2] Re-check after the reference-plan rescale in `src/state-generator.js`. The three rules are:
  - max ≤ 0.75 × ideal
  - top 10% share ≥ 0.25
  - median ≤ 0.5 × mean

  Reject the attempt (retry the loop) if any fails.
- [X] T010 [US2] Compute `densityIndex` = density ÷ median county density, rounded, before classifying. Classify urban if ≥ 6, rural if < 1.6, otherwise suburban, in `src/state-generator.js`.
- [X] T011 [US2] Implement the lean in `src/state-generator.js`:
  - `shareA = clamp(0.5 + δ + a·ln(densityIndex/pivot) + regional + noise, 0.08, 0.92)`, with a ≈ 0.13, regional ±0.04, and noise ±0.05.
  - Target `t = 0.5 ± U(0.003, 0.015)`, with the sign chosen 50/50 by the seeded random generator.
  - Solve δ by bisection over [−0.3, 0.3] (40 iterations) so that the side-A total ÷ voters = t.
  - Round the voter counts, store `state.statewideShareA`, and reject the attempt if the result is outside [0.48, 0.52] or the leading side does not match the sign.
- [X] T012 [US2] Tune σ, a, pivot, and the urban/rural thresholds until T007 and the existing 004 urban/rural tests pass. Record the final values in `specs/005-new-map-realistic-state/research.md`.

**Checkpoint**: US2 tests pass, and all earlier tests still pass.

---

## Phase 5: User Story 3 - Balance Districts Within 10% (Priority: P2)

**Goal**: The balance rule is "largest ≤ 1.10 × smallest", shown as a percentage.

**Independent Test**:
1. Load the reference plan. The plan check passes and shows "10%".
2. Move counties until the gap exceeds 10%. The plan check fails with "must be within 10%".

### Tests

- [X] T013 [P] [US3] Update `tests/districts.test.js` (around lines 146 and 166) to cover the ratio rule:
  - Largest = 1.10 × smallest passes; 1.11 × fails.
  - An empty district fails.
  - `differencePercent` is rounded to one decimal.
  - Every district inside ideal × (1 ± 0.1/2.1) implies a pass.
- [X] T014 [P] [US3] Update `tests/ui.test.js` (around line 361):
  - The limit row shows "10%".
  - The difference row shows "N voters (P%)".
  - The failure text contains "within 10%".
- [X] T015 [P] [US3] In `tests/state-generator.test.js`, check that across 100 seeds every `referencePlan` is complete, contiguous, and passes `getBalance` with ratio 0.10 (SC-006).

### Implementation

- [X] T016 [US3] In `src/state-generator.js`, replace `BALANCE_LIMIT` with `export const BALANCE_RATIO = 0.10` and set `state.balanceRatio`. Make `improveBalance` and the reference-plan acceptance target `largest ≤ 1.10 × smallest`.
- [X] T017 [US3] Rewrite `getBalance` in `src/districts.js`:
  - Use `ratio = state.balanceRatio ?? 0.10`.
  - `pass` = no empty district and `largest ≤ smallest × (1 + ratio)`.
  - Add `differencePercent` = `(largest − smallest) / smallest × 100`, rounded to one decimal (0 when there are no filled districts).
  - Per-district window: ideal × (1 ± ratio/(2+ratio)).
- [X] T018 [P] [US3] Update `src/ui/plan-status.js`:
  - Difference row: "N voters (P%)".
  - Limit row: "10%".
  - Failure text: "District sizes must be within 10% of each other".
- [X] T019 [P] [US3] Update `src/ui/district-list.js` to use the ratio window for the "Within range" / "Too large +N" / "Too small −N" labels.
- [X] T020 [P] [US3] Update the hint text about the balance rule in `index.html` to the 10% wording.

**Checkpoint**: US3 tests pass.

---

## Phase 6: User Story 4 - Irregular State Shape (Priority: P3)

**Goal**: Outlines are clearly not rectangles and include at least one distinctive feature.

**Independent Test**: The 100-seed outline tests pass, and a visual check of 10 maps shows irregular outlines.

### Tests

- [X] T021 [P] [US4] Add 100-seed tests in `tests/state-generator.test.js`:
  - Outline area ÷ bounding-box area ≤ 0.75.
  - `shapeFeatures` has 1–2 entries from `'panhandle'`, `'river'`, `'coast'`, and `'notch'`.
  - The outline does not cross itself.
  - Every county is ≥ 160 px² and one piece.
  - Same seed → identical outline.
  - Across all seeds, at least 3 different feature kinds appear.
  - Log the coverage range.

### Implementation

- [X] T022 [US4] Rewrite `generateOutline` in `src/state-generator.js` as a radial function r(θ) with 360 vertices:
  - Lumpy ellipse base.
  - 0–2 polar straight borders: `r = min(r, d / cos(θ−φ))` within ±80°.
  - 1–2 features, as described in research.md R6:
    - **Panhandle**: arm 50–90 px wide, length 1.4–1.8 × the base radius, `r = max(r, min(h/|sin(θ−θ0)|, L))` where `cos(θ−θ0) > 0`.
    - **River**: 60–100° range, ±4–8% meander.
    - **Coast**: 70–120° range, ±3–6% multi-octave noise.
    - **Notch**: 25–40% smooth dip over 15–30°.
  - Fit into `[16, W−16] × [16, H−16]` keeping the aspect ratio.
  - Retry up to 20 times until coverage ≤ 0.75, then force a panhandle.
  - Return `{ outline, shapeFeatures }`.
- [X] T023 [US4] Store `state.shapeFeatures` in `generateState` in `src/state-generator.js`. If `pointInPolygon` over the density grid is too slow with 360 vertices, precompute an inside-mask once per attempt and use it in `createDensityField` and the county partition.
- [X] T024 [US4] Make sure the county partition keeps arms and panhandles connected and meets the ≥ 160 px² rule. Adjust seed placement in `src/state-generator.js` so each arm gets at least one county seed. Run T021.

**Checkpoint**: All user stories are complete.

---

## Phase 7: Polish & Cross-Cutting

- [X] T025 Run the full `tests/index.html` with the cache disabled. Fix regressions so the title shows `PASS: N passed, 0 failed` (SC-008).
- [X] T026 [P] Check that average generation time stays under 100 ms and New map finishes under 2 s (SC-001). Add the timings to `specs/005-new-map-realistic-state/quickstart.md`.
- [X] T027 [P] Visual check at 1366 px and 320 px for 10 New map clicks: irregular outlines, no horizontal overflow, and the toolbar wraps cleanly. Note the results in `specs/005-new-map-realistic-state/quickstart.md`.

---

## Dependencies & Execution Order

- **Setup → Foundational → stories.**
- **US1** depends only on Phase 2.
- **US2** depends on T002.
- **US3** depends on T002. Its generator changes (T016) touch the same file as US2, so do them after US2.
- **US4** depends on T002. It touches the same generator file, so do it after US3.
- **Polish** comes last.
- Within each story, write the tests before the implementation.

## Parallel Opportunities

- **US1**: T003 and T005 run alongside T004.
- **US2**: T007 runs alongside T008.
- **US3**: T013, T014, T015, T018, T019, and T020 are all in different files.
- **US4**: T021 runs alongside T022.
- **Polish**: T026 and T027.

## Implementation Strategy

1. **MVP**: Phases 1–3 deliver the New map button.
2. Add US2 for realistic, close states, then US3 for the 10% rule, then US4 for irregular shapes. Run the test page after each one.
