---
description: "Tasks for feature 009"
---

# Tasks: City Population, Growing States, Realistic Outlines, and Smaller Dense Counties

**Input**: Design documents from `/specs/009-city-population-outlines/`

**Prerequisites**:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/changes.md](./contracts/changes.md)
- [quickstart.md](./quickstart.md)

**Tests**: Included, on the browser test page `tests/index.html`.
- Pure logic and statistics: `tests/custom-state.test.js`, `tests/state-generator.test.js`, and the new `tests/outline.test.js`.
- Page flow: `tests/ui.test.js`.

**Order**: Implement after 008. The phases follow dependencies, not story numbers: the state's total and voters (US2) come before the slider that drives them (US1), then county sizes (US4), outlines (US3), and links (US5).

**Terms**: Formulas, ranges, and element names come from [data-model.md](./data-model.md) and [contracts/changes.md](./contracts/changes.md). "Baseline" is the all-rural voters; "city share" is a city's population spread over the counties around it.

**Tuning tasks** (T010, T022, T026) measure over 100 seeds and 100 plans and record final values in [research.md](./research.md), as 005 and 008 did. If a target cannot be met, use the levers listed in research R13, and record any threshold that had to be relaxed and why.

## Phase 1: Setup

- [X] T001 Run `tests/index.html` with the cache disabled and record the baseline pass count (90 passed after 008).

---

## Phase 2: Foundational — cities carry a population

**Purpose**: The city data model that every story uses. After this phase the generator still ignores populations, so behavior does not change yet.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 [P] In `src/state-generator.js`, export the population constants from the data model: `POPULATION_RANGE` = `{ min: 10000, max: 300000 }`, `POPULATION_STEP` = 10,000, `DEFAULT_POPULATION` = 100,000, `BASELINE_RANGE` = `{ min: 450000, max: 720000 }`, and `RANDOM_CITY_RANGE` = 2 to 4 cities of 50,000 to 150,000 voters.
- [X] T003 In `src/custom-state.js`, give every city a population:
  - A city is `{ x, y, pop }` with `x` "Integer from 0 to 800", `y` "Integer from 0 to 600", and `pop` "Integer from 10000 to 300000 and a multiple of 10000".
  - Re-export `POPULATION_RANGE`, `POPULATION_STEP`, and `DEFAULT_POPULATION`.
  - Add `normalizePopulation(value)` (clamp to 10,000–300,000, round to a multiple of 10,000), `setCityPopulation(plan, index, pop)`, and `addCity(plan, point, pop = DEFAULT_POPULATION)`. Remove `toggleCityAt`.
  - `validatePlan` also reports `city-<i>-population` for a bad population.
  - `buildCustomState` keeps the plan's cities (with `pop`) on `state.cities` and writes each city as `x_y_p` (`p` = pop ÷ 10,000) in `state.layoutKey`. The generator still ignores `pop`.
  - `decodeCustomCode` (the `v1` format, until US5) gives every decoded city `pop: DEFAULT_POPULATION`; `encodeCustomCode` still writes `v1`.
- [X] T004 Update the existing tests for cities with a population, and add tests for the new helpers:
  - In `tests/custom-state.test.js`, give literal cities a `pop` where a plan must stay valid, and make plan comparisons include `pop: 100000`. Add tests: `normalizePopulation` clamps and rounds; `setCityPopulation` returns a new plan and changes only that city; `validatePlan` rejects `pop` 0, 9999, 10500, 300001, and a non-integer, and accepts 10000 and 300000; `addCity` defaults to 100,000.
  - In `tests/ui.test.js`, change assertions that compare `plan.cities` with `{ x, y }` objects to compare positions only (or include `pop: 100000`).
  - The whole suite passes (90 plus the new tests).

**Checkpoint**: Plans and cities carry populations; nothing visible has changed.

---

## Phase 3: User Story 2 - The State Grows With Its Cities (Priority: P1)

**Goal**: A state's voters are a baseline plus each city's population, shared out over the counties around the city. Random states are built from random cities through the same pipeline.

**Independent Test**:
1. Build a plan with no cities and note the total voters.
2. Add a city of 100,000: the total rises by about 100,000.
3. Resize the city to 300,000, then remove it: the total follows.
4. The statewide split still matches its slider.

### Tests

- [X] T005 [P] [US2] Add total and voter tests in `tests/custom-state.test.js`:
  - Over 20 plans, adding a city of population P changes `totalVoters` by between 0.75 P and 1.25 P, and removing it brings the total back the same way (SC-002).
  - The total equals `state.baseline` plus the cities' populations, to within the number of counties (rounding).
  - `state.baseline` is within 450,000–720,000 and is the same for plans with the same outline seed whatever the cities (R7).
  - Resizing one city to 10,000, 100,000, and 300,000 gives strictly increasing totals (SC-003).
  - For 20 pairs of plans differing only in one city's population (30,000 versus 300,000), the counties within 55 px of the bigger city hold more voters on average (FR-009).
  - The statewide split stays within 0.005 of the split setting at 300, 500, and 700 permille with cities of 10,000 and of 300,000.
  - 100 plans of 0–12 cities with random populations: at least 98% build, and every built state keeps the existing rules (counties at least 160 px² and one piece, a connected county graph, a reference plan within the 10% rule, no county above 0.75 of an ideal district, top 10% of counties at least 25% of voters, median at most half the mean).
- [X] T006 [P] [US2] Add random-state tests in `tests/state-generator.test.js`: for 100 seeds, `state.cities` has 2 to 4 entries, each `pop` is a multiple of 10,000 from 50,000 to 150,000, cities are at least 150 px apart and inside the outline, `state.baseline` is within 450,000–720,000, `totalVoters` equals the baseline plus the populations to within the county count, and the same seed gives the same state.

### Implementation

- [X] T007 [US2] In `src/state-generator.js`, change `buildLayout` to the new voter rule (R6), with the signature `buildLayout(random, { outline, weightAt, cities, baseline, countyCount, districtCount })`:
  - Add `citySigma(pop)` = `40 + 35 × √(pop / 300000)` px.
  - Baseline shares: the existing `skewedVoterWeights(random, densityKey, districtCount)` output, normalized to sum to 1.
  - City shares: county `i` holds the fraction `K_c(i) · A_i ÷ Σ_j K_c(j) · A_j` of city `c`'s population, where `K_c` is a Gaussian of the county's seed distance to the city with `citySigma(pop)`.
  - Raw voters = `baseline × baseline share + Σ_c pop_c × city share`; drop the random `scale` factor. The reference-plan factors and rounding (at least 1 voter) stay.
  - The result carries `cities` and `baseline`; `assembleState` adds both to the state; `totalVoters` is the baseline plus the populations.
- [X] T008 [US2] In `src/state-generator.js`, build random states from random cities:
  - Move `createCityField(cities)` (weight `1 + 8 × max over cities of exp(−d² / (2 × 55²))`, 1 with no cities) from `src/custom-state.js` into this file and export it.
  - `generateState` draws the baseline from a stream named `seed|baseline` (a whole number in `BASELINE_RANGE`) and 2 to 4 cities (populations 50,000–150,000 in steps of 10,000, at least 150 px apart and 40 px inside the outline), uses `createCityField(cities)` in place of `createDensityField`, and runs the same `buildLayout` and `splitVoters` as a custom state (no `target`, `cityScale` 1, so the close statewide race is unchanged).
  - Remove `createDensityField`.
- [X] T009 [US2] In `src/custom-state.js`, use the shared pipeline: import `createCityField` from the generator, draw the baseline from the stream `outlineSeed|baseline` (a whole number in `BASELINE_RANGE`, so it never depends on the cities or the layout attempt), and pass `cities` and `baseline` to `buildLayout`. `state.baseline` is set; `applyVoterSettings` is unchanged.
- [X] T010 [US2] Run the suite, then tune and record. Over 100 random states and 100 custom plans measure: the share of plans that build (target at least 98%), top-10% share, median ÷ mean, and the largest county as a share of an ideal district. Keep the 005 thresholds if they hold; otherwise adjust the tail-restore power or baseline shares first, and relax a threshold only as a last resort. Update affected 100-seed assertions in `tests/state-generator.test.js`, and record the numbers in a "Final tuned values" table in `specs/009-city-population-outlines/research.md`.

**Checkpoint**: The state grows by its cities' populations, random and custom alike.

---

## Phase 4: User Story 1 - Choose How Big Each City Is (Priority: P1) 🎯 MVP

**Goal**: A "City population" slider sets the selected city's population. Clicking a city selects it; a Remove button or Delete removes it.

**Independent Test**:
1. Place two cities, select the first, set its slider to the maximum, select the second, set its slider to the minimum.
2. Each city keeps its own value, and the counties around the big city hold many more voters.
3. Remove the selected city with the button and with Delete.

### Tests

- [X] T011 [P] [US1] Replace the click-to-remove tests in `tests/ui.test.js` with selection tests (use `setSlider`-style helpers and `citySpots`):
  - Placing a city selects it: the marker has the class `selected`, `data-selected="true"`, and a `circle.city-ring`; the slider is enabled and `[data-role="pop-output"]` reads "City 1: 100,000 voters".
  - With nothing selected (no cities, or after Remove) the slider is disabled, the output reads "Place or select a city to set its population.", and `[data-role="build-remove"]` is disabled.
  - Clicking or tapping another city, or pressing Enter with the keyboard cursor on it, selects it and shows its own value; clicking never removes a city.
  - The Remove city button and Delete and Backspace on the focused map remove the selected city, clear the selection, and redraw; removing a city placed before the selected one keeps the same city selected.
  - New outline and Clear cities clear the selection.
- [X] T012 [P] [US1] Add slider tests in `tests/ui.test.js`:
  - `[data-role="pop-slider"]` has min 10, max 300, step 10 (thousands), a label "City population", and `aria-valuetext` equal to its output.
  - A slider `change` sets the selected city's population at once (plan, voters in the counties around it, map colors, and the Statewide voters total update within 1 s); an `input` event updates the label immediately and the plan about 120 ms later.
  - A new city starts at the population last chosen with the slider, 100,000 before any choice; each city keeps its own value.
  - The counties around a 300,000 city hold more voters on average than those around a 10,000 city.
  - Announcements go to the message area: "City 2 selected. 150,000 voters.", "City 2 set to 150,000 voters.", "City 2 removed. 2 of 12 cities."
  - At 320 px wide the slider, hint, and Remove button cause no horizontal scrolling; a state with 12 cities of 300,000 shows a total of about 4 million that fits the stat block.

### Implementation

- [X] T013 [P] [US1] In `index.html`, add inside the builder section: `label[for="pop-slider"]` "City population", `input[type="range"][data-role="pop-slider"]` (id `pop-slider`, min 10, max 300, step 10, value 100), `output[data-role="pop-output"]` (for `pop-slider`), and `button[data-role="build-remove"]` "Remove city". Update the builder help text to say a click selects a city and Remove city or Delete removes it.
- [X] T014 [P] [US1] In `src/ui/builder-panel.js`, extend `createBuilderPanel` per the contract: callbacks `onPopulation(thousands)` (slider `input`), `onPopulationCommit(thousands)` (slider `change`), `onRemove`; `render({ plan, result, matchup, selected })` sets the slider to the selected city's population and enables it, or disables it with the hint "Place or select a city to set its population."; the output reads "City N: 150,000 voters"; `aria-valuetext` follows the output; the Remove button is enabled only with a selected city.
- [X] T015 [P] [US1] In `src/ui/map-view.js`, replace `onCityToggle` with selection: `setCities(points, selectedIndex = null)` draws the selected marker with the class `selected`, `data-selected="true"`, and a dashed `circle.city-ring` larger than the dot (so selection is not color alone); a click or tap on a marker calls `onCitySelect(index)`; Delete and Backspace on the focused map in build mode call `onCityDelete()`. Enter still calls `onBuildPoint`.
- [X] T016 [P] [US1] In `styles.css`, style the selected ring (`.city-marker.selected .city-ring`), the population slider and its output, the Remove city button, and the hint; keep the builder panel free of horizontal scrolling from 320 px to 1920 px.
- [X] T017 [US1] In `src/main.js`, add selection and population:
  - The draft keeps `selected` (an index or `null`) and `lastPopulation` (100,000 until the slider is used); `app.builder` returns `{ plan, result, selected }`.
  - `placeCity(point)`: a point on a city (within 12 px) selects it and never removes it; elsewhere it places a city at `lastPopulation` after the usual rules and selects it.
  - `selectCity(index)`, `setCityPopulation(index, pop)` (immediate; normalizes, rebuilds, sets `lastPopulation`, announces), `removeSelectedCity()` (clears the selection; a removed lower index shifts `selected` down); `removeCity(index)` stays.
  - Wire the panel callbacks: `onPopulation` updates the label at once and schedules `setCityPopulation` 120 ms after the last movement; `onPopulationCommit` applies it at once; `onRemove` removes the selected city; wire the map's `onCitySelect` and `onCityDelete`.
  - New outline and Clear cities clear the selection. Expose the new functions on the app object.

**Checkpoint**: Cities can be sized, selected, and removed. MVP.

---

## Phase 5: User Story 4 - Crowded Counties Are Drawn Smaller (Priority: P1)

**Goal**: County size follows density for every state; bigger cities get smaller counties around them.

**Independent Test**:
1. Generate a state; rank its counties by density and by size.
2. The ranks agree strongly (rank correlation of at least 0.8 in strength, denser meaning smaller), and the densest tenth are at most a third the size of the sparsest tenth.
3. Raise a city's population: its counties shrink.

### Tests

- [X] T018 [P] [US4] Add size tests in `tests/state-generator.test.js` and `tests/custom-state.test.js`, with small helpers for rank correlation and decile averages:
  - Over 100 random states and 100 custom plans (0–12 cities, random populations) the rank correlation between `county.density` and `county.area` is at most −0.8 (strength at least 0.8), and the densest tenth of counties average at most one third the area of the sparsest tenth (FR-020, SC-012).
  - The average urban county is smaller than the average suburban county, which is smaller than the average rural county, wherever the types exist (FR-021, SC-013).
  - With no cities every county is within 0.25× to 4× the average area, and the two rules above still hold (FR-023).
  - Around each city, the mean area of the counties in the nearest third (by distance within 150 px) is below that of the farthest third (FR-022).
  - For 20 pairs of plans differing only in one city's population (30,000 versus 300,000), the mean area of counties within 60 px of the bigger city is smaller in at least 90% of pairs (FR-022, SC-013).
  - Every earlier rule still holds (counties 90–120 and at least 160 px², connected, a balanced plan possible) and the same input gives the same counties.

### Implementation

- [X] T019 [US4] In `src/state-generator.js`, change `createCityField(cities, towns)` to the weight field from the data model: city peak weight `1 + 15 × (0.35 + 0.65 √(pop / 300000))`, city spread `citySigma(pop)` (`40 + 35 √(pop / 300000)` px), towns as "3 to 6 bumps, peak 0.5 to 3.5 above 1, spread 35 to 70 px", and weight at a point `1 + max(towns, cities)`. Add `createTowns(random, outline)`. Random states draw towns from the main stream (after the cities); `src/custom-state.js` draws them from the stream `outlineSeed|towns`.
- [X] T020 [US4] In `src/state-generator.js`, make voters follow size: `RELAX_PASSES` = 8 (was 4) in `relaxSeeds`; baseline shares are ranked by `1 / area` times a noise of about ±8% (replace `weightAt(p) × noise`); keep the sorted lognormal draws, the cap, and the tail restore. `buildLayout` still rejects counties below `MIN_CLICKABLE_AREA`.
- [X] T021 [US4] In `src/custom-state.js`, create the towns for a plan with `createTowns` and pass them with the cities to `createCityField`, so the same outline seed and cities always give the same weights (and therefore the same counties).
- [X] T022 [US4] Tune and record: run the T018 measurements and the T005 and T010 checks. Levers, in order: relaxation passes, city peak weights and spreads, town strength, noise on the size ranking. Targets: correlation at most −0.8, decile ratio at most one third (including no cities), counties 0.25×–4× with no cities, at least 98% of plans build, smallest county at least 160 px². Record the final values in `specs/009-city-population-outlines/research.md`.

**Checkpoint**: Dense counties are small, and bigger cities have smaller counties around them.

---

## Phase 6: User Story 3 - More Realistic State Outlines (Priority: P1)

**Goal**: Outlines mix straight surveyed borders meeting at corners with irregular natural borders, for random states, builder states, and every new outline.

**Independent Test**:
1. Generate 100 outlines.
2. Each has two straight borders of at least 150 px meeting at a corner of 60°–120°, one natural border over at least a fifth of the perimeter, one piece, fill of at most 80%, at least four corners, and no arm thinner than 50 px.
3. No two outlines are the same.

### Tests

- [X] T023 [P] [US3] Create `tests/outline.test.js` and add `await import('./outline.test.js');` to `tests/index.html`. Measure each of 100 outlines from `generateOutline` using the test file's own helpers (R4), not the generator's `checkOutline`:
  - **straight pair**: a straight run is a stretch whose segments turn less than 3° from one to the next and stay within 2 px of the chord; two adjacent runs of at least 150 px whose corner turns 60° to 120°.
  - **natural border**: a stretch of at least 20% of the perimeter with no straight run above 60 px.
  - no crossing sides; fill (area ÷ bounding box) at most 0.80; at least four vertices turning 35° or more; every point inside the 16 px map margin.
  - **arm width**: opening the shape by a 25 px radius (using `sampleGrid` and `interiorDistances`) loses at most 2% of its area.
  - **variety**: no two outlines identical (compare rounded vertices) and at least three classes of shape appear (class by corner count, fill, and tilt of the longest side).
  - **determinism**: the same seed gives the same outline; `shapeFeatures` is `[template, ...naturalKinds]` with the template one of `'stepped' | 'slanted' | 'wedge'` and kinds `'river' | 'coast'`; `generateOutline` never returns `null`; generation takes under 20 ms on average.

### Implementation

- [X] T024 [P] [US3] Create `src/outline.js` per R1 to R3 and the contract:
  - Export `generateOutline(random)`, `outlineCoverage(outline)`, `checkOutline(outline)`, `MAX_OUTLINE_COVERAGE` = 0.80, `OUTLINE_TEMPLATES`, `NATURAL_KINDS`.
  - Templates: **stepped** (axis-aligned rectangle, tilt at most 3°, height 0.6–0.85 of the width, a corner notch of 35–55% by 35–55%, and 30% of the time a 12–20% clip or notch at the opposite corner), **slanted** (quadrilateral or pentagon, long sides rotated 10°–35°, corners 65°–115°), **wedge** (five or six corners at random angles with gaps 40°–110°, radii 0.7–1.0, optionally one concave step).
  - Fit into the map with a 36 px margin. Replace one or two sides (never the straight pair) with a natural polyline sampled every 6 px: offset `A · taper(t) · (0.6 sin(2π k₁ t + φ₁) + 0.3 sin(2π k₂ t + φ₂) + 0.1 n(t))`, `k₁` 2–4, `k₂` 5–9, taper 0 at both ends, `A = 0.05 × side length` kept between 8 and 20 px; a coast adds a second pass with `k` up to 16 at 40% of `A`. Choose sides, longest first with random tie-breaks, until natural sides total at least 20% of the perimeter, each at least 120 px.
  - `checkOutline` reports `crossing`, `fill`, `corners`, `straight-pair`, `natural`, and `arm-width` as in the data model; draw up to 20 candidates, then return the guaranteed stepped box with one river side.
- [X] T025 [US3] In `src/state-generator.js`, remove the old radial outline code (`buildOutline`, the old `generateOutline`, `SHAPE_FEATURES`, `pickFeatureAngles`, and the helpers only they use), import from `src/outline.js`, and re-export `generateOutline`, `outlineCoverage`, and `MAX_OUTLINE_COVERAGE`; the random-state path uses the new `generateOutline`. In `src/custom-state.js`, keep `shapeForSeed` (salts 0–9, same streams); a `null` outline can no longer occur. In `tests/state-generator.test.js`, delete the 005-era outline test ("state outlines are irregular, simple, and have a distinctive feature") and its unused imports; its job is now done by `tests/outline.test.js`.
- [X] T026 [US3] Re-tune for the new outlines: re-run every 100-seed and 100-plan check (T005, T010, T018, T023). Look at the share of plans that build (at least 98%), the smallest county (at least 160 px²), how many outline candidates are rejected, and how often the fallback is used (it should be rare). Adjust city spacing, template parameters, or weights as needed, and record the final values in `specs/009-city-population-outlines/research.md`.

**Checkpoint**: Every state has a realistic outline, and everything above still passes.

---

## Phase 7: User Story 5 - Sizes Are Saved and Shared (Priority: P2)

**Goal**: Custom links carry each city's population and reproduce the state exactly.

**Independent Test**:
1. Build a state with three different-sized cities and use it.
2. Open its address in a new tab: the same cities, sizes, counties, and statewide numbers appear.
3. A damaged link shows the friendly message.

### Tests

- [X] T027 [P] [US5] Add codec tests in `tests/custom-state.test.js` (replace the `v1` expectations):
  - `encodeCustomCode` writes `v2.<outlineSeed>.<shareA>.<cityLean>.<cities>` with cities as `x_y_p` joined by `-`, `p` = pop ÷ 10,000, and `0` for none; for example a plan with seed `k3x9a`, share 520, lean 50, and cities (210, 180, 100,000) and (400, 300, 250,000) gives `v2.k3x9a.520.50.210_180_10-400_300_25`.
  - 50 random plans with random populations round-trip through `decodeCustomCode(encodeCustomCode(plan))`, and the same code rebuilds the same state (counties, voters, outline).
  - `decodeCustomCode` still reads `v1` (`x_y`) and gives every city 100,000 voters.
  - It returns `null` for a `p` of 0, 31, `05`, a negative, a non-integer, or a missing `p` in `v2`; for a wrong version; and for every damaged case the 008 tests already covered (adapted to `v2`).
- [X] T028 [US5] Update `tests/ui.test.js` for links: a used state's address carries `v2` with each city's population and reloads to the same cities, sizes, counties, and statewide numbers; an old `v1` link whose cities fit its outline opens with every city at 100,000 voters, and one that does not shows the invalid-link message and a random map; Clear cities removes cities and their populations; Cancel returns the previous map; adapt any 008 test that builds a `v1` code or compares `state.seed`.

### Implementation

- [X] T029 [US5] In `src/custom-state.js`, finish the link format: `encodeCustomCode` always writes `v2` (cities `x_y_p` with `p` an integer from 1 to 30 in units of 10,000, `0` for none); `decodeCustomCode` reads `v2` and `v1` (every city 100,000), rejects any damaged, out-of-range, or not-fitting code with `null`; `state.seed` is the `v2` code. No change to `src/main.js` is needed beyond what T017 added; confirm that loading, the caption link, and the address all use the new code.

**Checkpoint**: Links reproduce states with their city sizes.

---

## Phase 8: Polish & Cross-Cutting

- [X] T030 Re-record the random-state fingerprints in `tests/custom-state.test.js` (`RANDOM_STATE_FINGERPRINTS`, for the seeds `demo-1`, `demo-2`, `regress-3`, `regress-4`, `regress-5`) from the finished generator, and rename the test to say it guards against later changes (it no longer guards the pre-009 maps).
- [X] T031 Run the full `tests/index.html` with the cache disabled at least five times. Get the title to `PASS: N passed, 0 failed` every time (SC-011); the builder tests use random outlines, so any flaky test must be fixed, not skipped.
- [X] T032 [P] Visual and accessibility check at 1920 px, 1366 px, and 320 px, following [quickstart.md](./quickstart.md):
  - Look at a gallery of 20 seeds for realistic outlines and dense counties that read as cities.
  - Place cities of different sizes by pointer and keyboard; check the selected ring, the slider and its spoken value, the hint, Remove city, and Delete.
  - Check there is no horizontal scrolling at 320 px.
  - Record the results in `specs/009-city-population-outlines/quickstart.md`.
- [X] T033 [P] Measure and record in `specs/009-city-population-outlines/quickstart.md`: outline generation time (target under 20 ms), the time for a city add and a population change on a plan with 12 large cities (under 1 s), the slider's redraw after the last movement, and the load time from a `?custom=` address (under 2 s).
- [X] T034 [P] Update the earlier specs' notes so nothing contradicts the code: in `specs/008-custom-state-builder/spec.md`, `specs/005-new-map-realistic-state/spec.md`, and the 008 quickstart, add a short "Superseded by 009" note for click-to-remove, unchanged seeds, and the 005 outline feature list.

---

## Dependencies & Execution Order

- **Overall**: Setup → Foundational (T002–T004) → US2 → US1 → US4 → US3 → US5 → Polish.
- **US2** needs the Foundational city model; T007 before T008 and T009; T010 after them.
- **US1** needs US2 (the slider's effect on totals and counties) and T003 (`setCityPopulation`); T017 needs T013, T014, and T015.
- **US4** needs US2 (it extends `buildLayout` and `createCityField`); T019 and T020 before T022.
- **US3** is independent of the other stories in code (a new module), but T026 re-tunes everything, so it comes after US4.
- **US5** needs Foundational and can run any time after it; it comes last because the older tests it adapts are touched by earlier phases.
- Within each story, write the tests before the implementation.

## Parallel Opportunities

- Foundational: T002 alone first, then T003, then T004.
- US2: T005 and T006 (two test files) can be written together.
- US1: T011 and T012 are in one file, so write them together; T013, T014, T015, and T016 touch four different files and can run together before T017.
- US3: T023 (tests) and T024 (the new module) are in different files and can run together.
- US4 and US3 can be developed side by side by two people, but T026 needs both finished.
- Polish: T032, T033, and T034 are independent.

## Implementation Strategy

1. **MVP**: Phases 1–4 (setup, city populations, the growing state, and the slider with selection and removal). The visitor can already size cities and watch the state grow.
2. Add US4 (smaller dense counties), then US3 (realistic outlines), then US5 (links), tuning after each as the tuning tasks describe.
3. After each story run the full test page; fix any regression before moving on. Expect the 100-seed statistical tests to need re-tuning whenever the generator changes.
4. Finish with the re-recorded fingerprints, repeated full runs, the visual and performance checks, and the notes on superseded behavior.
