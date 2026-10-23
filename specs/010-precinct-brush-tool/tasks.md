---
description: "Tasks for feature 010"
---

# Tasks: Precinct Building Blocks and Brush Selection Tool

**Input**: Design documents from `/specs/010-precinct-brush-tool/`

**Prerequisites**:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/changes.md](./contracts/changes.md)
- [quickstart.md](./quickstart.md)

**Tests**: Included, on the browser test page `tests/index.html` (no Node is installed; the page is driven with Playwright against `python3 -m http.server 8000`, cache disabled).
- Pure logic and statistics: the new `tests/geometry.test.js` and `tests/brush.test.js`, plus `tests/state-generator.test.js`, `tests/custom-state.test.js` and `tests/districts.test.js`.
- Page flow: `tests/ui.test.js`.

**Order**: The phases follow dependencies, not only story numbers.
- Foundational work first: fast geometry (research R1–R3), then the county → precinct rename with no behavior change, so the whole suite is green on renamed code before anything is re-tuned.
- US1 (precincts) next, then US2 (brush core with the plan rules enforced), then US3 (feedback, lifecycle, keyboard and touch details).
- US3 depends on US2, and US2 depends on US1; the stories are otherwise independent.

**Terms**: Names, ranges and element ids come from [data-model.md](./data-model.md) and [contracts/changes.md](./contracts/changes.md). "Rename table" means the table in the contracts file. Decisions R1–R16 are in [research.md](./research.md).

**Tuning and timing tasks** (T026, T040, T050) measure over 100 seeds and 100 plans and record final values in [research.md](./research.md) and [quickstart.md](./quickstart.md), as 005, 008 and 009 did. If a timing assert flakes under machine load, rerun when the machine is quiet; do not weaken the assert.

**Playwright notes**: the tests page sets `window.__testResults`; poll `__testResults.done`. `page.click` can time out on the app page, so drive the app with `page.evaluate`, `window.gerryApp`, or dispatched pointer events. Use cache-busted URLs for dynamic `import()`.

## Phase 1: Setup

- [X] T001 Run `tests/index.html` with the cache disabled and record the baseline pass count (114 passed after 009).
- [X] T002 In `specs/010-precinct-brush-tool/research.md`, add a "Rename inventory" section with the per-file counts of `count(y|ies)` (case-insensitive) in `src/`, `tests/`, `index.html` and `styles.css` (measured with grep), as the baseline for the rename gate in T019.

---

## Phase 2: Foundational — fast geometry, then the rename

**Purpose**: Make 800-precinct generation affordable and rename the unit everywhere. After this phase the app still draws 90–120 areas, now called precincts, and every earlier behavior still passes.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Fast geometry (research R1–R3)

- [X] T003 [P] Create `tests/geometry.test.js` and load it from `tests/index.html` (before `state-generator.test.js`):
  - `sampleGrid` with the nearest-seed lookup gives exactly the same `owner` array as a brute-force scan kept inside the test, for 5 outlines × seed counts of 100 and 700 (and a seed count of 1);
  - `voronoiCells` equals a brute-force clip for 60 seeds and 300 seeds;
  - `pieceCounts` equals `countGridComponents` for every precinct, including a precinct with no cell (0) and one split into two pieces;
  - `sampleGrid` at 700 seeds on a 2 px grid takes under 150 ms (generous bound).
- [X] T004 In `src/geometry.js`, give `sampleGrid` a bucket lookup for the nearest seed (research R1): square buckets about the average seed spacing wide, a ring search that stops when the best distance is within the ring edge; the output stays identical to the old scan.
- [X] T005 In `src/geometry.js`, make `voronoiCells` clip against seeds nearest-first and stop once the next seed is farther than twice the cell's farthest vertex; the output stays identical.
- [X] T006 In `src/geometry.js`, add `pieceCounts(grid, count)` (one scan, `Int32Array`, 0 for no cell), keep `countGridComponents`, and make `gridStats` also return `centers` (same values as `centroids`; keep both names until T016 finishes the rename).
- [X] T007 Run `tests/index.html`: the geometry tests pass and the earlier 114 still pass. Record the `sampleGrid` time at 700 seeds in `research.md` under "Final tuned values".

### Rename county → precinct, no behavior change (research R10)

Follow the rename table in [contracts/changes.md](./contracts/changes.md) exactly. Keep today's numbers (90–120 areas, "County" naming) until US1; change only identifiers, attributes, class names and the words shown to the visitor.

- [X] T008 [P] Rename in `src/state-generator.js`: `COUNTY_RANGE` → `PRECINCT_RANGE` (still `{ min: 90, max: 120 }` for now), `MAX_COUNTY_SHARE` → `MAX_PRECINCT_SHARE`, `CITY_COUNTY_CAP` → `CITY_PRECINCT_CAP`, `countyCount` → `precinctCount` (in `generateState` and `buildLayout`), `assembleCounties` → `assemblePrecincts`, `countyId` → `precinctId` with ids `p001…`, `counties` → `precincts` and `countiesById` → `precinctsById` in the state, and every comment.
- [X] T009 [P] Rename in `src/custom-state.js`: `countyCountFor` → `precinctCountFor`, the parameter of `districtCountFor`, `counties` → `precincts` in `buildCustomState` and `applyVoterSettings`, and comments.
- [X] T010 [P] Rename in `src/districts.js`: `reassignCounty` → `reassignPrecinct`, `applyCountyEdit` → `applyPrecinctEdit`, `countyLookup`, `countyIds` → `precinctIds`, `getEditAction(state, precinctId, selected)`, `state.counties` → `state.precincts`, and comments.
- [X] T011 [P] Rename in `src/formatters.js`: `formatCountyDetails` → `formatPrecinctDetails` (subtitle "Precinct voters"), `getStatewideResult`/`formatStatewideMakeup` parameters, `formatNoDistrictDetails` ("This precinct is not in any district yet."), `formatDistrictDetails(district, precinctsById, matchup)` with `precinctCount`, `precinctNames`, `precinctList` and the subtitle "N precincts" / "1 precinct" / "No precincts assigned", and the empty-status text "Empty (no precincts)".
- [X] T012 [P] Rename in `src/main.js`: imports of the renamed functions, `districtFor(precinctId)`, inspected type `'precinct'`, `editCounty` → `editPrecinct`, `assignCounty` → `assignPrecinct`, the caption text, the editing status text, blocked-click messages ("Pick a precinct that touches it."), and the `window.gerryApp` hooks.
- [X] T013 [P] Rename in `src/ui/map-view.js`: callbacks `onPrecinctEnter/Move/Leave/Activate`, class `precinct`, `data-precinct-id`, layer `data-role="precincts"`, `precinct-highlight`, `precinctPaths`, `paintPrecinct`/`paintPrecincts`/`renderPrecincts`, and the build-mode comments.
- [X] T014 [P] Rename wording and identifiers in `src/ui/district-list.js` (aria-label "N precincts"), `src/ui/plan-status.js` ("N precinct has / precincts have no district", "Precincts with no district"), `src/ui/control-total.js` ("Unassigned precincts"), `src/ui/tooltip.js` (`precinctList`, class names), `src/ui/state-totals.js`, `src/ui/legend.js` (legend note), and `src/ui/builder-panel.js`.
- [X] T015 [P] Rename in `index.html` and `styles.css`: the builder help text ("Cities pull in smaller, denser precincts"), the districts hint, the notice ("This state, its precincts, and every voter in it are fictional…"), and the CSS selectors `.county*` → `.precinct*`, `[data-role="counties"]` → `[data-role="precincts"]`.
- [X] T016 [P] Rename in the tests that exercise logic: `tests/custom-state.test.js`, `tests/districts.test.js`, `tests/matchups.test.js`, `tests/outline.test.js`, `tests/size-helpers.js` (including `precinctsNear`), test titles, and ids such as `c001` → `p001`; then remove the old `centroids` name from `gridStats` and its uses.
- [X] T017 [P] Rename in `tests/state-generator.test.js` and `tests/ui.test.js`: selectors (`.precinct`, `data-precinct-id`, `[data-role="precincts"]`), ids, expected strings ("Precinct voters", "Unassigned precincts", …), helper names, and test titles.
- [X] T018 Run `tests/index.html`: everything passes with the same count as T007 (the rename changes no behavior). Fix any failure by finishing the rename, not by editing assertions.
- [X] T019 Rename gate: search `src/`, `tests/`, `index.html` and `styles.css` for `count(y|ies)` (case-insensitive); the only allowed matches are comments that name earlier features by their folder name (for example `008-custom-state-builder`). Compare with the T002 inventory and fix leftovers.

**Checkpoint**: The renamed app passes the whole suite with no behavior change.

---

## Phase 3: User Story 1 — Draw Districts From Small Precincts (Priority: P1) 🎯 MVP

**Goal**: Every state, random or custom, has 500–800 small precincts; all earlier district editing works on them.

**Independent Test**: Generate states, check the count, the names, the single-piece rule and the sizes; select a district and click precincts to add, move and remove; open old links; confirm the page has no mention of counties.

### Tests for User Story 1

- [X] T020 [P] [US1] In `tests/state-generator.test.js`, replace the 90–120 expectations and add, over 100 random seeds:
  - precinct count 500–800 (FR-001, SC-001); the precincts cover the state without overlap and each is one piece (FR-001);
  - unique non-empty names and ids `p001…` (FR-003); each precinct has `center` inside the outline and `neighbors` that are symmetric (data-model);
  - the sum of `totalVoters` equals `state.totalVoters`, equal to baseline plus city populations (FR-006);
  - the 009 size gate (rank correlation ≤ −0.84, decile ratio ≤ 0.32, urban < suburban < rural by average area) and the 80% lean rule under Democrats vs Republicans (FR-005, FR-007);
  - a complete balanced, connected plan exists from `referencePlan` (FR-009);
  - the slowest random state is under 2 s (SC-010) and the same seed gives the same state.
- [X] T021 [P] [US1] In `tests/custom-state.test.js`, add: `precinctCountFor(n)` is `min(800, 500 + 25 × n)` for n = 0…12 and `districtCountFor(count)` is `round(count / 50)` (10–16); 100 custom plans build with 500–800 precincts; `v1` and `v2` codes from 008 and 009 decode and build without error, with the same cities (FR-011, SC-012). Leave fingerprints to T031.
- [X] T022 [P] [US1] In `tests/ui.test.js`, add:
  - the caption shows "N precincts · M districts" with N from 500 to 800;
  - a text walk over the whole page (all elements and `aria-label`s) finds no "county" or "counties" in a random state and in build mode (FR-002);
  - a precinct's details show name, "Precinct voters", counts, margin, type, density and district or "No district" (FR-008);
  - a district with more than 8 precincts shows 8 names then "and N more" (spec assumption), and one with few shows all;
  - click add, move and remove, the blocked-click message, and the plan status all behave as before on precincts (FR-010);
  - exactly one precinct has `tabindex="0"`, arrow keys move focus to a neighbor, and walking with the arrows can reach a given far precinct (SC-009, research R12);
  - every neighbor pair in different districts has a drawn border segment (research R14).

### Implementation for User Story 1

- [X] T023 [US1] In `src/state-generator.js`, implement the layout changes of research R2/R3:
  - set `PRECINCT_RANGE` to `{ min: 500, max: 800 }`;
  - add `LAYOUT_CELL_SIZE = 2` for areas, neighbors, centers and the piece check, and keep `GRID_CELL_SIZE = 4` only for `state.grid`, which is sampled once after the layout is accepted;
  - use `pieceCounts` for the piece check, add `center` to each precinct in `assemblePrecincts`, and lower `MIN_CLICKABLE_AREA` to the starting value 30 (final value set in T026);
  - draw `precinctCount` from `PRECINCT_RANGE` for random states.
- [X] T024 [US1] In `src/state-generator.js`, rewrite `generateNames` (research R11): unique names for up to 800 precincts from the existing bases and suffixes, extended with North/South/East/West, no trailing "County"; keep generation deterministic for the same stream.
- [X] T025 [US1] In `src/custom-state.js`, set `precinctCountFor(cityTotal)` to `min(800, 500 + 25 × cityTotal)` and `districtCountFor(precinctCount)` to `round(precinctCount / 50)`; keep the `v1`/`v2` codec unchanged.
- [X] T026 [US1] Tune against the batches (research R4), using the density-size probe saved in the session `files/size-probe.js` as a guide:
  - measure rejection reasons over 100 random seeds and 100 custom plans (12 cities included) and adjust `MIN_CLICKABLE_AREA`, `RELAX_PASSES`, `RELAX_EXPONENT`, `MAX_FIELD_WEIGHT`, seed spacing, the size-gate limits, the voter spread and cap constants as needed;
  - acceptance: all 100 seeds and 100 plans build; the slowest random state is under 2 s; the custom build after a city change is under 1.5 s; rank correlation and decile ratio at least as strict as in 009; 80% lean rule holds;
  - if fewer than 60% of layouts pass the piece check, add the seed nudge of R3 (move a failing seed up to three times toward the largest piece of its cell);
  - record the final values, pass rates and timings under "Final tuned values" in `research.md`.
- [X] T027 [US1] In `src/formatters.js` and `src/ui/tooltip.js`, make `formatDistrictDetails` return `precinctList` with at most 8 names (alphabetical) followed by "and N more", keep `precinctNames` as the full sorted list, and render `precinctList` in the pop-up.
- [X] T028 [US1] In `src/ui/map-view.js`, fix the district border edges for small precincts (research R14): reduce the bisector tolerance in `precomputeEdges` and, if T022's border test still finds gaps, match shared polygon vertices instead.
- [X] T029 [US1] In `src/ui/map-view.js` and `styles.css`, implement the roving tab stop (research R12): only the last-focused precinct (initially the first) has `tabindex="0"`, the others `-1`; arrow keys move focus to the best neighbor in that direction (smallest angle, then distance) and Enter/Space keep activating; give focused precincts a clear focus outline. Keep build mode's map-level focus working.
- [X] T030 [US1] In `tests/custom-state.test.js` and any other test with hard-coded 90–120 or old fingerprints, update the expectations and re-record the fingerprints (demo-1, demo-2, regress-3, regress-4, regress-5) on the tuned code.
- [X] T031 [US1] Run `tests/index.html` and the quickstart section 2 by hand on `?seed=demo-1`; all tests pass.

**Checkpoint**: User Story 1 is complete and shippable: the app uses 500–800 precincts everywhere.

---

## Phase 4: User Story 2 — Select Many Precincts With a Brush (Priority: P2)

**Goal**: A circular brush with a size slider assigns every covered precinct in one click or drag, with the plan rules enforced.

**Independent Test**: Select a district, turn on the brush, set a size, click once, drag a strip, erase part of it, and see the circle, the plan and the panels update.

### Tests for User Story 2

- [X] T032 [P] [US2] Create `tests/brush.test.js` and load it from `tests/index.html` (after `districts.test.js`), covering, on generated states:
  - `precinctsInCapsule`: a precinct is covered exactly when its `center` is within the radius of the segment; order is along the segment, then distance, then id; `a = b` is a circle (FR-017, FR-018);
  - add on an empty district starts with the covered precinct nearest the segment start and adds only precincts connected to it (FR-021);
  - add on a non-empty district adds only precincts connected to it, directly or through precincts added in the same segment (FR-020);
  - a covered precinct of another district moves only when that district stays connected (FR-022);
  - erase removes only precincts that leave the selected district connected, and passes repeat so it can empty the district (FR-023);
  - the same segment on the same plan gives the same plan (FR-024);
  - after 300 random segments (random districts, modes, radii) on each of 30 seeds, every district has at most one connected part and no precinct is in two districts (SC-004);
  - radius 10 covers about 1–3 precincts on average and radius 150 at least 10% of all precincts near the state's middle (SC-007).
- [X] T033 [P] [US2] In `tests/ui.test.js`, add brush interface tests (drive the real map with dispatched pointer events and the `window.gerryApp` hooks):
  - the Brush section is visible with controls disabled and the hint "Pick a district's pen to use the brush." when no district is selected (FR-013); it is hidden while building a state;
  - selecting a district enables it; the toggle has `aria-pressed`; the size slider is 10–150, step 5, default 50, with a live value; Add is the default mode (FR-012, FR-014, FR-015);
  - with the brush on, the circle (`[data-role="brush-circle"]`) follows the pointer, has the radius of the slider and resizes at once; `data-mode` is `add` or `erase` (FR-016, FR-019);
  - a click paints the covered precincts and the district list, totals, plan status and control total update (FR-017, FR-026);
  - a drag with a large jump between samples leaves no gap along the path (FR-018);
  - Shift flips the mode for that stroke; the Erase radio erases (FR-019);
  - the first Escape turns the brush off and hides the circle, the second stops editing (research R12).

### Implementation for User Story 2

- [X] T034 [US2] In `src/districts.js`, add `reassignPrecincts(state, changes, { labels = true } = {})` (applies an object of id → district number or `null` and summarizes once) and give `summarizeDistricts` a `labels` option that skips badge placement.
- [X] T035 [US2] Create `src/brush.js` (pure; contracts and research R6–R7): `BRUSH_SIZE`, `BRUSH_MODES`, `precinctsInCapsule`, `startStroke`, `applySegment` (fixed-order multi-pass add/move/erase with the adjacency and contiguity checks on a working copy, empty-district seeding), and `strokeAt`. Use `reassignPrecincts` once per segment. Do not leave any district disconnected.
- [X] T036 [P] [US2] Create `src/ui/brush-panel.js` (`createBrushPanel(root, { onToggle, onMode, onSize })`, `render({ available, on, mode, size })`) and add the `[data-role="brush-tool"]` section to `index.html` above the control total with the toggle, the Add/Erase radios, the size range (10–150, step 5) with `<output>`, the hint and the status area; style it in `styles.css` for widths from 320 to 1920 px; update the districts hint in `index.html` to mention the brush.
- [X] T037 [US2] In `src/ui/map-view.js`, add the brush circle layer (`<circle class="brush-circle" data-role="brush-circle" aria-hidden="true">`, solid for add, dashed for erase) and `setBrush({ active, radius, mode })`; follow the pointer in map coordinates and hide on leave; add stroke pointer handling (`onStroke` with `start`/`move`/`end`/`cancel`, pointer capture on press, ignore `click` while the brush is active); set `touch-action: none` on the map while the brush is active (research R15).
- [X] T038 [US2] In `src/main.js`, wire the brush: `app.brush` `{ on, size, mode }`, the panel callbacks, stroke start and move (queue positions and process once per animation frame, apply `applySegment` per capsule, commit through `reassignPrecincts` with `labels: false` while dragging and a full summary at release), Shift flips the mode at press, the brush is available only while a district is selected and turns off when none is, Escape turns the brush off first, the section is hidden in build mode, and `window.gerryApp` gets `setBrush`, `strokeAt` and `dragBrush(points)`.
- [X] T039 [US2] Run `tests/index.html`; then measure a brush step at 800 precincts (largest circle, dense area) and a release redraw; if a step is over 50 ms, optimize (the `labels` option first) and record the numbers under "Final tuned values" in `research.md`.

**Checkpoint**: User Stories 1 and 2 work: a district can be painted with the brush and trimmed with erase.

---

## Phase 5: User Story 3 — Brush Respects Plan Rules and Gives Clear Feedback (Priority: P3)

**Goal**: Every stroke ends with one clear summary, never leaves an invalid plan, and works by keyboard and touch.

**Independent Test**: Brush over a mixed area (unconnected precincts, a split-prone border) and read the message; do a long drag and get exactly one message; press Enter on a focused precinct with the brush on.

### Tests for User Story 3

- [X] T040 [P] [US3] In `tests/brush.test.js`, add:
  - `finishStroke` arithmetic: `added + moved + removed + unchanged + skipped = covered` over 200 random strokes of 1–15 segments on 20 seeds (SC-008), and the counts match a before/after diff of the assignments;
  - a precinct skipped early in a drag and applied later is counted as applied, not skipped;
  - reasons `not-adjacent`, `splits-source` and `splits-selected` are reported for constructed cases;
  - the messages: a normal one ("Added 42 precincts, …"), "No precincts were changed: …", and "No precincts under the brush."; singular and plural wording;
  - a drag replayed from the same plan gives the same plan and the same summary (FR-024).
- [X] T041 [P] [US3] In `tests/ui.test.js`, add:
  - after a click, the status area `[data-role="brush-message"]` shows the summary; after a 20-step drag it is updated only once at release (FR-025);
  - no precinct details pop-up appears during a drag (FR-028);
  - Enter on a focused precinct with the brush on paints centered on it; Shift+Enter flips the mode (research R12, FR-017);
  - Escape during a drag ends the stroke and hides the circle; deselecting the district, choosing a new map or opening a link ends it too (FR-027);
  - size and mode persist while the visitor keeps working on the same state (including switching districts) and reset after "New map" (FR-030);
  - a touch-type pointer sequence paints, `touch-action` is `none` on the map only while the brush is active, and the panel's controls have accessible names (FR-029).

### Implementation for User Story 3

- [X] T042 [US3] In `src/brush.js`, make a stroke record the covered set and the last failed check per precinct, and add `finishStroke(state, stroke)` returning `{ added, moved, removed, unchanged, skipped, covered, reasons, changed, message }` by comparing the plan at press with the plan now (research R8), with the three message forms and correct plurals.
- [X] T043 [US3] In `src/main.js`, show the `finishStroke` message once per stroke in `[data-role="brush-message"]` (a polite status region, not the alert used for blocked clicks), end the running stroke on Escape, district deselection, matchup change, new state and link open, and keep size and mode across districts but reset them with a new state or link (FR-027, FR-030).
- [X] T044 [US3] In `src/ui/map-view.js`, turn off hover details, the precinct highlight and the district reveal while a drag is in progress, support the keyboard `tap` stroke (`onStroke({ type: 'tap', point: center, shiftKey })`) from Enter or Space on a focused precinct when the brush is active, and keep the roving tab stop and focus details working.
- [X] T045 [US3] Run `tests/index.html` and quickstart section 4 by hand; all tests pass and the message arithmetic holds.

**Checkpoint**: All three stories work independently and together.

---

## Phase 6: Polish and cross-cutting

- [X] T046 Layout checks at 320, 1366 and 1920 px wide (numeric checks of element boxes, as in 009; the screenshot tool is unreliable): the brush panel sits inside the page with no horizontal overflow, the slider is usable, and the map and district list are unchanged.
- [X] T047 Measure and record in `quickstart.md` "Results": ten new maps (each under 2 s), a custom build after a city change, a brush click and a 3-second drag at the largest size (no freeze, release redraw under 250 ms), and the step cost at 800 precincts.
- [X] T048 [P] Add "Superseded by 010" notes to `specs/002-congressional-district-editor/spec.md`, `specs/003-unassigned-county-districts/spec.md`, `specs/004-balanced-contiguous-districts/spec.md`, `specs/005-new-map-realistic-state/spec.md` and `specs/009-city-population-outlines/spec.md` (counties are precincts and the 90–120 count is now 500–800), without rewriting their requirements.
- [X] T049 [P] Fill in the "Final tuned values" section of `specs/010-precinct-brush-tool/research.md` (area limit, relaxation and gate constants, pass rates, slowest random state, brush step cost, whether the seed nudge was needed) and the "Results" section of `quickstart.md`.
- [X] T050 Run `tests/index.html` twice in a row on the final code (reduced from five at the owner's request); both must pass with no failures.
- [X] T051 Final checks: the rename gate of T019 is still clean; no debug instrumentation remains in `src/` (for example `__rej`, `__sz`, `__debugSpread`); remove temporary files under `/tmp`; make sure the session `files/` folder holds nothing the repository needs.

---

## Dependencies and Execution Order

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: needs Setup. T003 can run alongside T008–T017 (geometry tests and the rename touch different files); T004–T006 are sequential (same file); T007 after T003–T006; T018 after T008–T017 and T007; T019 last.
- **US1 (Phase 3)**: needs Phase 2. Tests T020–T022 can be written in parallel with each other; T023 and T024 touch the same file and run in order; T025 is independent of them; T026 needs T023–T025; T027, T028, T029 touch different concerns (T028 and T029 share `map-view.js`, so run them in order); T030 needs T026; T031 last.
- **US2 (Phase 4)**: needs US1. T032 and T033 in parallel; T034 before T035; T036 and T037 touch different files and can run beside T035; T038 needs T034–T037; T039 last.
- **US3 (Phase 5)**: needs US2. T040 and T041 in parallel; T042 before T043; T044 beside T042; T045 last.
- **Polish (Phase 6)**: needs all stories. T048 and T049 run in parallel; T050 after T046–T049; T051 last.

### Parallel examples

```text
Phase 2 rename:  T008  T009  T010  T011  T012  T013  T014  T015  T016  T017   (ten different files or file groups)
US1 tests:       T020  T021  T022
US2:             T032 + T033, then T035 + T036 + T037
US3 tests:       T040 + T041
Polish:          T048 + T049
```

## Implementation Strategy

- **MVP**: Phases 1–3 (through T031). That delivers User Story 1: states built of 500–800 precincts, with all earlier editing working, and it is shippable on its own.
- **Incremental**: add the brush core (US2) and check it by hand with quickstart section 3, then the feedback and keyboard/touch work (US3).
- **Risk first**: generation speed and gate tuning (T004–T006, T023, T026) carry the main risk. If the T026 acceptance cannot be met, use the levers in research R3/R4 (seed nudge, spacing, relaxation) before relaxing any spec rule, and stop to ask if a spec rule must change.
- Keep the old 114 tests passing at every checkpoint; the tests that change their expectations (counts, fingerprints, wording) are listed in T020–T022 and T030.
