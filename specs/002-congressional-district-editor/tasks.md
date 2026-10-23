---

description: "Task list for Congressional District Editor implementation"
---

# Tasks: Congressional District Editor

**Input**: Design documents from `/specs/002-congressional-district-editor/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included because [plan.md](./plan.md) and [quickstart.md](./quickstart.md) define a browser-run automated test page as the validation approach.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated incrementally.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story from [spec.md](./spec.md)
- Paths are relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the static, dependency-free browser app and test harness.

- [X] T001 Create `index.html`, `styles.css`, `src/main.js`, `src/ui/`, and `tests/` per the structure in specs/002-congressional-district-editor/plan.md
- [X] T002 [P] Create the page shell in `index.html` with the heading "Gerrymandering like Gerry the Salamander", matchup toggle container, map/control-total layout, legend container, district list section below the map, tooltip region, editing status message, fictional-data notice, and module script loading `src/main.js`
- [X] T003 [P] Add base responsive layout, focus styles, map region styles, tooltip positioning styles, and 320–1920 px breakpoints in `styles.css`
- [X] T004 [P] Create a dependency-free browser test runner with `test`, `assert`, `assertEqual`, `assertThrows`, async test support, and pass/fail summary in `tests/test-runner.js`
- [X] T005 [P] Create `tests/index.html` that loads `tests/test-runner.js`, `tests/state-generator.test.js`, `tests/districts.test.js`, `tests/matchups.test.js`, and `tests/ui.test.js`, and displays the test summary

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implement the generated state, county map, voter data, matchup cycle, legend, and county details required before district features can work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 [P] Implement `createRandom(seed) -> () => number` returning deterministic values in `[0, 1)`, plus seed creation and `?seed=<value>` parsing helpers, in `src/random.js`
- [X] T007 [P] Implement polygon/point helpers, Voronoi county cell construction within map bounds, state-outline point tests, grid sampling for county area, symmetric neighbor detection excluding self, connected-component detection, and label-point selection in `src/geometry.js`
- [X] T008 [P] Define `MATCHUPS` in this exact order: `dem-rep` "Democrats vs Republicans", `soc-lib` "Socialists vs Libertarians", `purple-orange` "Purple vs Orange"; implement `getNextMatchup(currentId)` cycling back to `dem-rep`, invalid ID errors, side names, and blue/red, rose/gold, purple/orange colors in `src/matchups.js`
- [X] T009 [P] Implement `getResultColor(status, marginPercent, matchup)` with stronger shades for larger margins, gray for `tie`, and an empty-style key for `empty`, plus `formatVoterDetails(result, matchup)` with whole-number voter counts, percentages rounded to one decimal place, leading side or status, and margin in `src/formatters.js`
- [X] T010 Implement `generateState({ seed, countyCount?, districtCount? })` in `src/state-generator.js` to create one connected state outline, 20–60 counties with unique IDs and fictional names, each county's visible area within the state greater than 400 square pixels in the 800 × 600 px full-size map coordinate space (reject and regenerate otherwise), symmetric `neighbors`, non-negative integer `sideAVoters` and `sideBVoters`, `totalVoters` equal to `sideAVoters + sideBVoters` and greater than 0, regionally clustered voter leans, and a fictional state name
- [X] T011 Add seed-reproducibility, county count, unique ID/name, neighbor symmetry, voter total, and invalid test-count tests in `tests/state-generator.test.js`
- [X] T012 [P] Add matchup order, wraparound, invalid ID, color, tie/empty style, rounding, and voter-detail formatting tests in `tests/matchups.test.js`
- [X] T013 [P] Implement a viewport-safe tooltip that supports pointer and keyboard anchoring, updates content, hides on leave/blur, and stays fully visible in `src/ui/tooltip.js`
- [X] T014 [P] Implement the matchup toggle starting at "Democrats vs Republicans" and emitting matchup changes in the defined cycle in `src/ui/matchup-toggle.js`
- [X] T015 [P] Implement the legend for active side colors, tie color, empty-district style, and lead-strength shading in `src/ui/legend.js`
- [X] T016 Implement an SVG map using an 800 × 600 px full-size coordinate space that scales proportionally on smaller screens, with state outline and focusable county rendering, county fill by each county's generated voter result, county hover/focus details, inspected-county highlighting, and accessible county names in `src/ui/map-view.js`
- [X] T017 Wire state generation, page-load seed handling, map rendering, matchup changes, legend updates, county tooltip details, and a friendly retry message for generation failure in `src/main.js`

**Checkpoint**: The 001 map foundation works and `tests/index.html` foundational tests pass.

---

## Phase 3: User Story 1 - View Congressional Districts (Priority: P1) 🎯 MVP

**Goal**: Divide each generated state into 8–20 numbered districts shown on the map and in a district list below it.

**Independent Test**: Load `http://localhost:8000/?seed=demo-1` and confirm 8–20 consecutive districts appear on the map and in the list, every county belongs to exactly one district, counties keep their own vote colors, and district badges and list swatches reflect combined district votes.

### Tests for User Story 1

- [X] T018 [P] [US1] Add initial district tests in `tests/districts.test.js` for 8–20 consecutive districts, every county appearing exactly once in `assignments`, every initial district containing at least one county, voter sums, statuses, margins, connected components, and label points
- [X] T019 [P] [US1] Add DOM tests for district borders, map number labels, list order, swatches, leading-side text, and pen button presence in `tests/ui.test.js`

### Implementation for User Story 1

- [X] T020 [US1] Extend `generateState` in `src/state-generator.js` to randomly choose 8–20 districts, choose spread-out starting counties, and grow contiguous districts through county neighbors until all counties are assigned
- [X] T021 [US1] Implement `summarizeDistrict` and `summarizeDistricts` in `src/districts.js` with `number` consecutive from 1, assigned `countyIds`, combined voter sums, `status` of `sideA`, `sideB`, `tie`, or `empty`, `marginPercent` of 0 for tie or empty, `components`, and `labelPoint` inside the largest component or absent if empty
- [X] T022 [US1] Extend `src/ui/map-view.js` to draw clear neutral district borders without changing county fills, and place readable number badges colored by combined district results for every non-empty district on its largest component
- [X] T023 [US1] Create `src/ui/district-list.js` to render every district in number order with color swatch, number, leading side or status, and a pen button labeled "Edit district N"
- [X] T024 [US1] Wire district summaries, district rendering, district list rendering, and matchup recoloring into `src/main.js`
- [X] T025 [US1] Style district borders, colored number badges, empty-district hatching, district list rows, swatches, and pen buttons in `styles.css`

**Checkpoint**: District viewing is complete and testable without hover details, editing, or control totals.

---

## Phase 4: User Story 2 - Inspect District Voter Details (Priority: P2)

**Goal**: Show district voter specifications from the district list, and county plus district details from the map.

**Independent Test**: Hover or focus several district list entries and counties; verify each tooltip's district totals match its assigned counties.

### Tests for User Story 2

- [X] T026 [P] [US2] Add district details tests in `tests/ui.test.js` for number, county count, county names, total voters, side counts and percentages, status, margin, focus behavior, and matchup relabeling

### Implementation for User Story 2

- [X] T027 [US2] Add district details formatting for number, county count, county names, total voters, each side's count and percentage, leading side or tie/empty status, and margin in `src/formatters.js`
- [X] T028 [US2] Add district list hover, focus, leave, and blur handlers that show and hide district details in `src/ui/district-list.js`
- [X] T029 [US2] Update county hover/focus in `src/ui/map-view.js` so editing-off tooltips show both county details and the county's district details
- [X] T030 [US2] Wire district details through `src/main.js` so matchup changes update tooltip labels and colors without changing voter numbers

**Checkpoint**: District details work on the map and in the district list.

---

## Phase 5: User Story 3 - Reassign Counties to a District (Priority: P3)

**Goal**: Let visitors select a district with its pen icon, then click counties to move them into that district.

**Independent Test**: Use `?seed=demo-1`, activate a pen icon, click counties in other districts, and verify county assignments plus all district displays update immediately.

### Tests for User Story 3

- [X] T031 [P] [US3] Add `reassignCounty` tests in `tests/districts.test.js` for moving counties, no-op same-district clicks, invalid county or district errors, empty districts, ties, and unchanged county voter values
- [X] T032 [P] [US3] Add editing interaction tests in `tests/ui.test.js` for pen selection, switching pens, pen toggle-off, Escape exit, Enter/Space county assignment, and no reassignment when editing is off

### Implementation for User Story 3

- [X] T033 [US3] Implement immutable `reassignCounty(state, countyId, districtNumber)` in `src/districts.js`, returning an equivalent state for same-district moves and throwing clear errors for invalid county IDs or district numbers
- [X] T034 [US3] Add `EditingSelection` state with `districtNumber` set to a district or `null` in `src/main.js`, implementing transitions: off → district N, district N → district M, district N → off by repeated pen activation or Escape
- [X] T035 [US3] Update `src/ui/district-list.js` to set pen pressed state, allow only one pressed pen, and emit pen selection events
- [X] T036 [US3] Update `src/ui/map-view.js` to highlight the selected district and pointer/focus county while editing, and emit county assignment on click, Enter, or Space
- [X] T037 [US3] Wire county clicks into `reassignCounty` in `src/main.js`, applying rapid clicks once each in click order and immediately rerendering boundaries, district badges and list colors while preserving county fills, list entries, details, and editing status
- [X] T038 [US3] Style selected district, editing message, pressed pens, editing-county highlights, and empty districts in `styles.css`

**Checkpoint**: Visitors can redraw districts and see every affected district update.

---

## Phase 6: User Story 4 - Track District Control Totals (Priority: P4)

**Goal**: Show how many districts each active side controls, plus tied and empty districts.

**Independent Test**: Compare the control total to district statuses, move counties until a district changes status, and confirm the totals update.

### Tests for User Story 4

- [X] T039 [P] [US4] Add `getControlTotal` tests in `tests/districts.test.js` verifying `sideA`, `sideB`, `tied`, and `empty` counts and that the four values always sum to the number of districts
- [X] T040 [P] [US4] Add control total UI tests in `tests/ui.test.js` for labels, colors, counts, reassignment updates, matchup updates, and responsive visibility

### Implementation for User Story 4

- [X] T041 [US4] Implement `getControlTotal(districts)` returning `sideA`, `sideB`, `tied`, and `empty`, whose four values always sum to the number of districts, in `src/districts.js`
- [X] T042 [US4] Create `src/ui/control-total.js` to render active side names, colors, district counts, tied count, and empty count beside the map
- [X] T043 [US4] Wire control total rendering into initial load, county reassignment, and matchup changes in `src/main.js`
- [X] T044 [US4] Style the control total beside the map on wide screens and directly beside or below the map without covering it on narrow screens in `styles.css`

**Checkpoint**: All user stories are independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate accessibility, responsiveness, performance, and quickstart scenarios across all stories.

- [X] T045 [P] Add accessibility tests in `tests/ui.test.js` for accessible names, pressed states, focus order, keyboard tooltips, and small-county keyboard access
- [X] T046 [P] Add 100-seed validation tests in `tests/state-generator.test.js` for connected states, 20–60 counties, 8–20 districts, unique assignments, initially non-empty districts, and every county's visible area greater than 400 square pixels at the 800 × 600 px full map size
- [X] T047 Verify every scenario in specs/002-congressional-district-editor/quickstart.md, including 320 px and 1920 px layouts, and fix any issues in `index.html`, `styles.css`, or `src/`
- [X] T048 Measure initial load, tooltip display, matchup update, and county reassignment against plan targets using `?seed=demo-1`, and optimize rendering in `src/ui/map-view.js` if any target is missed
- [X] T049 Update specs/002-congressional-district-editor/quickstart.md with any verified changes to run or validation steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup and blocks all user stories.
- **US1 (Phase 3)**: Depends on Foundational and is the MVP.
- **US2 (Phase 4)**: Depends on US1 district summaries and list rendering.
- **US3 (Phase 5)**: Depends on US1 district summaries, district rendering, and pen buttons. It can be built alongside US2 after US1, but both modify `src/main.js`, `src/ui/map-view.js`, and `src/ui/district-list.js`.
- **US4 (Phase 6)**: Depends on US1 district summaries; reassignment update validation also depends on US3.
- **Polish (Phase 7)**: Depends on all desired stories.

### Story Completion Order

```text
Setup → Foundational → US1 → US2 → US3 → US4 → Polish
```

## Parallel Execution Examples

### Setup

```text
T002 index.html | T003 styles.css | T004 tests/test-runner.js | T005 tests/index.html
```

### Foundational

```text
T006 src/random.js | T007 src/geometry.js | T008 src/matchups.js | T009 src/formatters.js
T013 src/ui/tooltip.js | T014 src/ui/matchup-toggle.js | T015 src/ui/legend.js
```

### User Story 1

```text
T018 tests/districts.test.js | T019 tests/ui.test.js
```

### User Story 2

```text
T026 tests/ui.test.js can be written before T027–T030
```

### User Story 3

```text
T031 tests/districts.test.js | T032 tests/ui.test.js
```

### User Story 4

```text
T039 tests/districts.test.js | T040 tests/ui.test.js
```

### Polish

```text
T045 tests/ui.test.js | T046 tests/state-generator.test.js
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational phases.
2. Complete US1.
3. Validate quickstart scenario 1 and US1 tests before continuing.

### Incremental Delivery

1. Add US2 for district details.
2. Add US3 for county reassignment.
3. Add US4 for control totals.
4. Complete Polish and full quickstart validation.

### Notes

- Keep pure model logic in `src/random.js`, `src/geometry.js`, `src/state-generator.js`, `src/districts.js`, `src/matchups.js`, and `src/formatters.js`.
- Keep DOM and SVG behavior in `src/ui/`.
- Do not add external dependencies, persistence, or real election data.
