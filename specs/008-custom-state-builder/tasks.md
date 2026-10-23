---
description: "Tasks for feature 008"
---

# Tasks: Custom State Builder

**Input**: Design documents from `/specs/008-custom-state-builder/`

**Prerequisites**:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/changes.md](./contracts/changes.md)
- [quickstart.md](./quickstart.md)

**Tests**: Included, on the browser test page `tests/index.html`. Pure logic is tested in `tests/custom-state.test.js` (new); the page flow is tested in `tests/ui.test.js`.

**Order**: Implement after 007. The builder renders the statewide stat block through the same call every state uses, so the stat block assertions need 007 to be done. Both features edit `src/main.js` and `tests/ui.test.js`.

**Terms**: "Layout phase" and "voter phase" are defined in [research.md R1](./research.md). Element names, messages, and function signatures come from [contracts/changes.md](./contracts/changes.md).

## Phase 1: Setup

- [X] T001 Run `tests/index.html` with the cache disabled after 007 is done and record the baseline pass count.
- [X] T002 Create `tests/custom-state.test.js` and add `await import('./custom-state.test.js');` after the `state-generator.test.js` line in `tests/index.html`. In the new file add a random-state regression test, **before any change to `src/state-generator.js`**:
  - Define `fingerprint(state)`: a 32-bit FNV-1a hash over, for every county in order, `` `${name}|${sideAVoters}|${sideBVoters}|${type}|${polygon.length}|${seedPoint}` `` joined by `\n`, plus `state.name`, `state.districtCount`, and `JSON.stringify(state.referencePlan)`.
  - Run `generateState({ seed })` on the unmodified generator for the seeds `demo-1`, `demo-2`, `regress-3`, `regress-4`, `regress-5`, and hard-code the five resulting fingerprints as the expected values.
  - Assert that each seed still produces its recorded fingerprint (R1, FR-018).

---

## Phase 2: Foundational

**Purpose**: The generator split and the custom-state core that every story builds on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 In `src/state-generator.js`, split `tryGenerate` into two functions and export the pieces the custom module needs. Random output MUST NOT change (R1):
  - **Layout phase** (`buildLayout`): takes `random`, an `outline` and `shapeFeatures`, `countyCount`, `districtCount`, and a `weightAt` density function. Runs seed placement, relaxation, the clickable-size and connectivity checks, skewed voter totals, the reference plan, `densityIndex`, `type`, and `density`. Returns `null` when any check fails.
  - **Voter phase** (`splitVoters`): takes the layout result and `{ target, cityScale, random }`. It draws the regional `angle`, then each county's lean (noise draws), in that order. If `target` is undefined it then draws `sideAAhead` and the target exactly as today (random states); otherwise it uses the given `target` and draws nothing more. County lean is `cityScale × (0.26 where curve > 0, else 0.17) × curve + regional + noise`. It solves the offset with `solveStatewideOffset` and returns the per-county side A voters and the statewide share. Random states pass `cityScale` 1.
  - `tryGenerate` calls `generateOutline`, `createDensityField`, `buildLayout`, `splitVoters`, then `generateNames`, in the same order as before.
  - Export `generateOutline`, `buildLayout`, `splitVoters`, `placeSeeds`, `relaxSeeds`, `solveStatewideOffset`, `classifyDensity`, `generateNames`, `boundingBox`, and the constants they use.
- [X] T004 Run `tests/index.html`. The T002 regression test and every earlier test MUST pass unchanged. If a fingerprint differs, fix the refactor (not the expected values).
- [X] T005 [P] Create `src/custom-state.js` with the constants, plan helpers, and placement rules from the [data model](./data-model.md):
  - Constants: `MAX_CITIES` 12, `MIN_CITY_DISTANCE` 90, `SHARE_RANGE` 300–700, `LEAN_RANGE` −100 to 100, `CITY_SIGMA` 55, `CUSTOM_MAX_ATTEMPTS` 20, `SHARE_TOLERANCE` 0.005.
  - `createPlan({ outlineSeed })`: no cities, `shareA` 500, `cityLean` 50.
  - `outlineForSeed(outlineSeed)`: calls `generateOutline` with `createRandom(outlineSeed + '|outline|' + k)` for `k = 0 … 9` and returns the first non-null outline.
  - `validatePlan(plan)`: returns the list of violations. A plan is valid only if `outlineSeed` matches `^[0-9a-z]{1,16}$`, `shareA` is an integer from 300 to 700, `cityLean` is an integer from −100 to 100, and there are at most 12 cities, each inside the outline and at least 90 px from every other. Each city has `x` an integer from 0 to 800 and `y` an integer from 0 to 600.
  - `checkCityPlacement(plan, point)`: `{ ok: true }` or `{ ok: false, reason }` with `reason` one of `'limit'`, `'outside'`, `'too-close'`, checked in that order.
  - `addCity`, `removeCity(plan, index)`, `toggleCityAt(plan, point)` (removes the city within 12 px of the point, otherwise adds one), and `withSettings(plan, { shareA, cityLean })` (clamps to the ranges and rounds to integers). All return new plans.
- [X] T006 In `src/custom-state.js`, add `buildCustomState(plan)` (R3, R4, R5):
  - Return `{ ok: false, reason: 'plan' }` when `validatePlan` reports violations.
  - `countyCount = min(120, 90 + 3 × cities.length)`; `districtCount = round(countyCount / 8)`.
  - Density weight is `1 + 8 × max over cities of exp(−d² / (2 × 55²))`, and 1 everywhere with no cities.
  - For attempt `k` from 0 to `CUSTOM_MAX_ATTEMPTS − 1` (20), run `buildLayout` on `createRandom(outlineSeed + '|layout|' + k)`; use the first that passes. If none does, return `{ ok: false, reason: 'layout' }`.
  - Run `splitVoters` with `target = shareA / 1000`, `cityScale = cityLean / 100`, and `random = createRandom(outlineSeed + '|voters')`. Reject the voter phase unless `|actual share − target| ≤ 0.005`.
  - Names come from `generateNames` on `createRandom(outlineSeed + '|names')`.
  - Return `{ ok: true, state }` with the same fields as a random state plus `custom: true`, `plan`, `layoutKey` (outline seed + cities + attempt), `seed: 'custom'`, `districts` from `summarizeDistricts`, all assignments `null`, `idealDistrictVoters`, and `balanceRatio`.
- [X] T007 Add foundational logic tests in `tests/custom-state.test.js`:
  - The same plan builds an identical state twice (counties, voters, names, reference plan).
  - Over 100 plans with 0–12 cities (random positions, accepted by `checkCityPlacement`), every `ok: true` state has connected counties of at least 160 px², a connected county graph, a reference plan that passes `getBalance` at the 10% rule, 90–120 counties, and 11–15 districts. Report the number of `ok: false` results.
  - With cities, counties within 55 px of a city are smaller on average than the state's average county size (SC-002); with no cities the build succeeds and every county's area is within 0.25× to 4× the average.
  - Placement: outside the outline → `'outside'`; within 89 px of a city → `'too-close'`; the 13th city → `'limit'`; exactly 90 px apart → `ok`.
  - `validatePlan` rejects a bad `outlineSeed`, `shareA` 299 and 701, `cityLean` −101 and 101, 13 cities, a city outside the outline, and two cities 89 px apart.
- [X] T008 Tune the starting values against 200 plans of 0–12 random valid cities, reporting the share that build `ok: true`, the slowest build, and the average build time. Target at least 98% success and an average under 100 ms. Adjust `CITY_SIGMA`, `MIN_CITY_DISTANCE`, and the county formula in `src/custom-state.js` (and the numbers in `data-model.md`) if needed. Record the final values in a "Final tuned values" table in `specs/008-custom-state-builder/research.md`.
- [X] T009 [P] In `src/ui/map-view.js`, change `setState` so that a state whose `layoutKey` equals the current state's `layoutKey` keeps the existing county paths, edges, and layers (it only replaces `state` and rebuilds nothing). Without a `layoutKey`, keep the current rule (`state.counties !== nextState.counties`). `render()` then recolors from the new voters (R6).

**Checkpoint**: A plan builds into a valid state in code; random states are unchanged.

---

## Phase 3: User Story 1 - Place Cities by Clicking (Priority: P1) 🎯 MVP

**Goal**: A visitor enters the builder, clicks inside the outline to add cities and clicks a marker to remove one, and sees the counties redraw around them.

**Independent Test**:
1. Click **Build a state**: the builder panel shows "Cities: 0 of 12" and an empty outline of even-sized counties.
2. Click three spots inside the outline: three markers appear and counties near them are smaller.
3. Click a marker: that city is removed.
4. Click outside the outline, next to a city, and past 12 cities: each shows its message and adds nothing.
5. Do the same with the keyboard and by tap.

### Tests

- [X] T010 [P] [US1] Add builder tests in `tests/ui.test.js` (extend the app fixture with the new markup from T011):
  - **Build a state** hides `.districts`, the plan status, and the district-control block (`.is-building`), shows `[data-role="builder"]`, and `app.mode === 'build'`.
  - A click at a point inside the outline adds a `g.city-marker` and "Cities: 1 of 12"; clicking that marker removes it.
  - Clicks outside the outline, within 89 px of a city, and past the 12th city add nothing and show "Cities must be inside the state.", "Cities must be at least 90 pixels apart.", and "You can place up to 12 cities." in `[data-role="build-message"]`.
  - The map redraw after a city is added takes under 1 s (`performance.now()`), and counties near the city are smaller than the average county.
  - Keyboard: focus the svg, press arrow keys and Shift + arrows (cursor moves 10 px and 40 px, clamped to 0–800 and 0–600), Enter adds a city at the cursor, Enter on a city removes it; counties are not in the tab order.
  - A `pointerup` with `pointerType` `'touch'` followed by `click` adds a city like a click does.
  - With districts drawn, **Build a state** calls the injected `confirm('Build a state? Your districts will be lost.')`; declining leaves everything unchanged.
  - County clicks do nothing in build mode.

### Implementation

- [X] T011 [P] [US1] In `index.html`, add `button[data-role="build-state"]` labeled "Build a state" beside "New map", and a `section[data-role="builder"]` (hidden by default, `aria-labelledby` a heading "Build your own state") in `.map-side` with: `[data-role="city-count"]`, `[data-role="build-message"]` (`role="status"`, `aria-live="polite"`), and the buttons `build-use`, `build-cancel`, `build-clear`, `build-outline` (names in the contract).
- [X] T012 [P] [US1] Create `src/ui/builder-panel.js` with `createBuilderPanel(root, { onUse, onCancel, onClear, onNewOutline })`, `panel.render({ plan, result, matchup })` (writes "Cities: N of 12", enables or disables the buttons) and `panel.say(text)` (writes the message and live region). Add a visually hidden list of the cities as text ("City 1 at x 210, y 180").
- [X] T013 [P] [US1] In `src/ui/map-view.js`, add build mode (R8): `setMode('build' | 'view')`, `setCities(points)`, and the `onBuildPoint(point)` / `onCityToggle(index)` options. Add a `g[data-role="cities"]` layer above the counties with one `g.city-marker[data-city]` per city (a visible dot plus a larger transparent hit circle of about 24 px on screen). Convert click and tap positions with `svg.getScreenCTM().inverse()` and round to integers. In build mode county clicks do nothing, counties get `tabindex="-1"`, and the svg becomes focusable with the label "City placement map. Arrow keys move the cursor, Enter adds or removes a city." and a `g[data-role="build-cursor"]` that starts at the center and moves 10 px per arrow (40 px with Shift), clamped to 0–800 and 0–600; Enter calls `onBuildPoint(cursor)` or `onCityToggle(i)` for a city within 12 px. Restore the normal behavior in view mode.
- [X] T014 [P] [US1] In `styles.css`, style the builder panel, `.city-marker` (filled dot with a visible outline), the keyboard cursor, and the focus outline of the svg in build mode; add `.is-building` rules that hide `.districts`, `[data-role="plan-status"]`, and `[data-role="control-total"]`. Check that the panel fits at 320 px without horizontal scrolling.
- [X] T015 [US1] In `src/main.js`, add the builder flow (R9):
  - `app.mode`, `app.draft = { plan, result, snapshot }`, and a `startBuilder()` that calls `confirm('Build a state? Your districts will be lost.')` when any county is assigned (stop if declined), takes a snapshot of `{ state, address }`, creates a plan from the first of up to 8 fresh outline seeds that builds, and switches to build mode (`root.classList.add('is-building')`, `mapView.setMode('build')`).
  - `placeCity(point)` and `removeCity(index)`: call `checkCityPlacement` first and, on a refusal, show the message from the contract and change nothing. Otherwise update the plan, run `buildCustomState`, call `mapView.setState`, `mapView.setCities`, `mapView.render`, `renderStateTotalsView()` (from 007), and `builderPanel.render`.
  - Wire `onBuildPoint` to `toggleCityAt`-style placement, `onCityToggle` to removal, and the "Build a state" button to `startBuilder()`.
  - On `{ ok: false }` show the layout-failure message and keep the previous map.
  - Expose `mode`, `startBuilder`, `builder`, `placeCity`, and `removeCity` on the returned app object.

**Checkpoint**: The visitor can build a state's cities by click, tap, and keyboard. MVP.

---

## Phase 4: User Story 2 - Change the Voter Makeup (Priority: P1)

**Goal**: Two sliders (statewide split and city lean) recolor the map and the statewide stat block immediately.

**Independent Test**:
1. In the builder, set the statewide split to 40%: county colors shift and the stat block shows about 40%.
2. Move city lean to +100 and −100: city counties and the countryside swap colors while the split stays about 40%.
3. Switch the matchup: names and colors change; numbers do not.

### Tests

- [X] T016 [P] [US2] Add voter tests in `tests/custom-state.test.js`:
  - For `shareA` 300, 500, and 700 on 20 plans, the statewide share is within 0.005 of `shareA / 1000` (SC-003).
  - With `cityLean` 100 the side A share among urban counties is higher than among rural counties; with `cityLean` 0 the gap is smaller than half of the gap at 100; with −100 the gap reverses (SC-004), measured on plans with at least 3 cities.
  - `applyVoterSettings` keeps `layoutKey`, polygons, neighbors, areas, and types, changes only the voters, and gives the same voters for the same settings (applied twice, and compared with `buildCustomState` of the same plan with those settings).
  - Moving `shareA` and back restores the exact original voters (stable noise).
  - Out-of-range settings passed to `withSettings` are clamped (`shareA` to 300–700, `cityLean` to −100–100).
- [X] T017 [P] [US2] Add slider tests in `tests/ui.test.js`:
  - The share slider has min 30, max 70, step 0.5; the lean slider has min −100, max 100, step 10; each has a `<label>` and an `<output>`.
  - Setting a slider value and dispatching `input` changes the county fills and the stat block (007) within 1 s, with the statewide total within 0.5 points of the chosen split.
  - The county path elements are the same objects before and after a slider change (the layout is reused) and a focused county keeps focus.
  - Toggling the matchup changes names and colors but not voters, and the slider labels use the new side names.

### Implementation

- [X] T018 [P] [US2] In `src/custom-state.js`, add `applyVoterSettings(state, { shareA, cityLean })`: runs only the voter phase on the state's stored layout data (`splitVoters` with the plan's `|voters` stream) and returns a new state with new county objects, new `statewideShareA`, the same `layoutKey`, and an updated `plan` (R5, R6). Keep the per-county layout data it needs on the state (`densityIndex`, `seedPoint`, `totalVoters`).
- [X] T019 [P] [US2] In `src/ui/builder-panel.js`, add the two sliders and their `onShare(permille)` / `onLean(value)` callbacks, and render the labels and `<output>` text in words ("<side A name> share of all voters: 52.0%", "Cities lean <side A name> +50") with `aria-valuetext`, updating them when the matchup changes (R11).
- [X] T020 [P] [US2] In `index.html`, add `input[data-role="share-slider"]` (min 30, max 70, step 0.5) and `input[data-role="lean-slider"]` (min −100, max 100, step 10) with their labels and outputs inside the builder section.
- [X] T021 [P] [US2] In `styles.css`, style the two sliders and their outputs so they fit and stay readable from 320 px to 1920 px.
- [X] T022 [US2] In `src/main.js`, add `setBuilderSettings({ shareA, cityLean })`: update the draft plan with `withSettings`, call `applyVoterSettings` (not `buildCustomState`), then `mapView.setState`, `mapView.render`, `renderStateTotalsView()` (from 007), and `builderPanel.render`; wire the panel callbacks to it, and make a matchup change re-render the panel labels. Expose it on the app object.

**Checkpoint**: Cities and voter makeup can both be shaped, with live feedback.

---

## Phase 5: User Story 3 - Start Drawing Districts on the Custom State (Priority: P1)

**Goal**: "Use this state" leaves the builder and shows the custom state with empty districts and every normal feature; Cancel returns to the previous state.

**Independent Test**:
1. Build a state with a few cities, click **Use this state**: the builder closes, the district list is back and empty, and the statewide numbers match the builder.
2. Edit a district: balance, connected-district rules, and plan status behave as for a random state.
3. Click **Build a state** then **Cancel**: the previous map and its districts are back.

### Tests

- [X] T023 [US3] Add tests in `tests/ui.test.js`:
  - **Use this state** sets `app.mode` to `'view'`, removes `.is-building`, shows the district list with every district empty, and `app.state.custom === true`.
  - After use, `editCounty` follows the 10% balance and connected-district rules, `getPlanStatus` works, hover and focus tooltips work, and the matchup toggle works.
  - **New map** from a custom state creates a random state (`custom` falsy) after the usual confirmation if districts were drawn.
  - **Cancel** restores the same state object, its district assignments, the matchup, and the address; no confirmation is shown.
  - When the build fails (`{ ok: false, reason: 'layout' }`, injected for the test), **Use this state** is disabled, the contract's failure message is shown, and the map keeps the previous layout.

### Implementation

- [X] T024 [US3] In `src/ui/builder-panel.js`, disable the **Use this state** button when `result.ok` is false and show the failure message from the contract in `[data-role="build-message"]`; keep Cancel always enabled.
- [X] T025 [US3] In `src/main.js`, add `useBuiltState()` and `cancelBuilder()` and wire the buttons:
  - `useBuiltState()`: does nothing unless `draft.result.ok`; sets `app.state` to `draft.result.state`, clears `app.draft`, sets `app.mode = 'view'`, removes `.is-building`, calls `mapView.setMode('view')`, `mapView.setState`, `renderAll`, and sets the caption to "A custom state · N counties · M districts".
  - `cancelBuilder()`: restores `snapshot.state` and the address (the matchup stays as the visitor left it); sets the mode back; no confirmation.
  - Make sure `newMap()` and `load()` still work from a custom state and clear `app.draft`.
  - Expose `useBuiltState` and `cancelBuilder`.

**Checkpoint**: A custom state is fully usable for drawing districts.

---

## Phase 6: User Story 4 - Keep and Share the Custom State (Priority: P2)

**Goal**: A custom state reloads from its address, and the visitor can clear cities or ask for a new outline.

**Independent Test**:
1. Use a custom state, copy the address, open it in a new tab: the same cities, counties, and statewide numbers appear.
2. **Clear cities** removes all cities and resets the settings; **New outline** replaces the outline and reports removed cities.
3. An invalid `?custom=` shows a message and a random map.

### Tests

- [X] T026 [P] [US4] Add codec tests in `tests/custom-state.test.js`:
  - `decodeCustomCode(encodeCustomCode(plan))` equals the plan for 50 random valid plans, and rebuilding gives an identical state.
  - Encoding `outlineSeed` `k3x9a`, `shareA` 520, `cityLean` 50, and cities (210, 180) and (400, 300) gives `v1.k3x9a.520.50.210_180-400_300`; no cities encodes as `0`; `cityLean` −30 encodes as `-30`.
  - `decodeCustomCode` returns `null` for: a wrong version, an `outlineSeed` that does not match `^[0-9a-z]{1,16}$`, `shareA` 299 or 701, `cityLean` 101, a non-integer part, 13 cities, a city outside the outline, two cities 89 px apart, a missing part, and extra parts.
  - `getCustomCodeFromUrl('?custom=v1.a.500.0.0')` returns the code and `getCustomCodeFromUrl('?seed=x')` returns `null`.
- [X] T027 [US4] Add tests in `tests/ui.test.js`:
  - After **Use this state**, the address is `?custom=<code>` (via `history.replaceState`), and `createApp` with that code in the address shows identical cities, counties, and statewide numbers.
  - An invalid code shows "That custom map link isn't valid, so here is a new random map." and loads a random state; when both `custom` and `seed` are present and `custom` is valid, `custom` wins.
  - **Clear cities** asks `confirm('Clear all cities and reset the voter settings?')` when cities exist (no prompt when none), then removes all cities and resets `shareA` to 500 and `cityLean` to 50.
  - **New outline** changes the outline, removes cities that fall outside it, and shows "New outline. N cit(y/ies) outside it were removed." with the right count; with none removed the message has no count.
  - After **New map** the address is `?seed=<seed>` again.
  - The caption of a custom state contains a link `?custom=<code>` with the text "custom map link".

### Implementation

- [X] T028 [P] [US4] In `src/custom-state.js`, add `encodeCustomCode(plan)`, `decodeCustomCode(text)` (returns a plan or `null`, using `validatePlan` for every rule), and `getCustomCodeFromUrl(search)` in the format of [contracts/changes.md](./contracts/changes.md#address-code) (R7). Set `state.seed` to the code in `buildCustomState`.
- [X] T029 [US4] In `src/main.js`, add address handling:
  - At startup, if `getCustomCodeFromUrl` returns a valid plan, build it and use it (`custom` wins over `seed`); if it is invalid or the build fails, show the invalid-address message and load a random state.
  - After `useBuiltState()`, call `history.replaceState` with `?custom=<code>`; after `newMap()` keep setting `?seed=`.
  - Change the custom caption to "A custom state · N counties · M districts · " followed by a link `?custom=<code>` labeled "custom map link".
- [X] T030 [US4] In `src/main.js`, add `clearCities()` (confirm only when cities exist, then reset the plan's cities and settings and rebuild) and `newOutline()` (a new `outlineSeed` from `createSeed()`, drop the cities that fail `checkCityPlacement` against the new outline, rebuild, and say how many were removed using the contract text). Wire `build-clear` and `build-outline`, and keep the draft and panel in sync. Expose both on the app object.

**Checkpoint**: Custom states are shareable and resettable.

---

## Phase 7: Polish & Cross-Cutting

- [X] T031 Run the full `tests/index.html` with the cache disabled. Get the title to `PASS: N passed, 0 failed` (SC-009), including the regression test from T002.
- [X] T032 [P] Visual and accessibility check at 1920 px, 1366 px, and 320 px following [quickstart.md](./quickstart.md):
  - Place cities by click, by tap emulation, and by keyboard.
  - Check that there is no horizontal scrolling at 320 px (SC-008).
  - Check the sliders by keyboard, and that the live region announces city changes and messages.
  - Check that colors are not the only cue.
  - Record the results in `specs/008-custom-state-builder/quickstart.md`.
- [X] T033 [P] Measure and record in `specs/008-custom-state-builder/quickstart.md`: the time from a city click to the redrawn map (target under 1 s), the time from a slider change to recolored map (under 1 s), and the load time from a `?custom=` address (under 2 s), on a plan with 12 cities.
- [X] T034 [P] Update the page notice and the districts hint in `index.html` so they also mention custom states ("This state … is randomly generated, or built by you …"), and check the notice still reads correctly in both modes.

---

## Dependencies & Execution Order

- **Overall**: 007 complete → Setup → Foundational → US1 → US2 → US3 → US4 → Polish.
- **Setup**: T002 must run before T003 so the regression values come from the unmodified generator; T004 follows T003.
- **Foundational**: T005 can start once T003 is done; T006 needs T003 and T005; T007 and T008 need T006; T009 is independent of the other foundational tasks.
- **US1**: needs T006 and T009. T015 needs T011, T012, and T013.
- **US2**: needs US1's builder flow and T003's voter phase. T022 needs T018 and T019.
- **US3**: needs US1; independent of US2 except that the stat block and sliders are already in the builder.
- **US4**: needs US3 (the address is set when a state is used); T028 can start earlier.
- Within each story, write the tests before the implementation.

## Parallel Opportunities

- After T006: T007, and T009 (different files from T005/T006 work) can proceed together.
- US1 tests T010 can be written while T011, T012, T013, and T014 are built (four different files).
- US2: T016 and T017 (two test files), then T018, T019, T020, and T021 (four different files).
- US4: T026 (tests) and T028 (code) touch different files and can run together.
- Polish: T032, T033, and T034 are independent.

## Implementation Strategy

1. **MVP**: Phases 1–3 deliver cities by click, tap, and keyboard on a valid generated map, with the random-state regression guard in place.
2. Add US2 for live voter makeup, then US3 so a custom state can be used and canceled. Together these three P1 stories are the full request.
3. Add US4 (shareable address, clear, new outline) last, then polish.
4. After each story, run the full test page; stop and fix any regression before continuing.
