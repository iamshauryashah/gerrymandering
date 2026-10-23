---
description: "Tasks for feature 011"
---

# Tasks: Single-Screen District Editing

**Input**: Design documents from `/specs/011-single-screen-editing/`

**Prerequisites**:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/changes.md](./contracts/changes.md)
- [quickstart.md](./quickstart.md)

**Tests**: Included, in the parallel suite.
- Run a group with `python3 scripts/test.py layout` (or `ui`, `districts`), everything the change could touch with `python3 scripts/test.py --affected`, and the full suite once at the end with `python3 scripts/test.py`.
- The new `layout` group (`tests/layout.test.js`) loads the real page in same-origin iframes of exact sizes, so the media and container queries behave as in a real window.

**Order**: The phases follow dependencies, not only story numbers.
- Foundational work restructures the markup and the three layouts with the existing panels moved but unchanged, and updates the tests that read old positions, so the suite is green on the new structure first.
- US1 (the single screen and the new detail) comes next, then US2 (the compact picker), then US3 (other window sizes, build mode, keyboard and resize).
- US2 and US3 build on the structure from the foundational phase and are otherwise independent of each other.

**Terms**: Names, thresholds and areas come from [data-model.md](./data-model.md) and [contracts/changes.md](./contracts/changes.md). "Workbench" is the one-screen layout (content at least 1240 px wide, window at least 720 px tall, not while building a state). Decisions R1–R13 are in [research.md](./research.md).

**Measuring tasks** (T017, T033) record the real box sizes in [research.md](./research.md) ("Final measured values") and [quickstart.md](./quickstart.md) ("Results"). If the right column does not fit at 1280 × 720 with 20 districts, use the fallbacks in research R4 in order (tile padding, two-line tiles above 16 districts, the column scrolling inside itself) rather than shrinking the map below the spec's floors.

## Phase 1: Setup

- [x] T001 Run `python3 scripts/test.py` and record the baseline (148 passed, 0 failed) and the old layout numbers at 1440 × 800 (page 2,025 px tall, plan status at 1,013 px, district list at 1,684 px) under "Final measured values" in `specs/011-single-screen-editing/research.md`.

---

## Phase 2: Foundational — flat markup, three layouts, nothing else changes

**Purpose**: Give the page the structure every story builds on. After this phase the page already shows the workbench arrangement, but the panels hold exactly the content they do today.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Create `tests/layout-helpers.js` with: `openPage(width, height, seed)` (adds a same-origin iframe of exactly that size to the test page, loads `../index.html?seed=…`, resolves when `window.gerryApp` has a state), `closePage(frame)`, `rect(frame, selector)` (a `getBoundingClientRect` of the first match), `insideWindow(r, frame)` (true when the box lies fully within `[0, innerWidth] × [0, innerHeight]`), and `seedWithDistricts(count)` (searches seeds `layout-0`, `layout-1`, … with `generateState` until `districtCount` equals `count`, memoized). Add `tests/layout-helpers.js` to `shared` and add the group `"layout": { "files": ["layout.test.js"], "covers": ["src", "index.html", "styles.css"], "shards": 1 }` to `tests/groups.json`; create `tests/layout.test.js` with a first test that opens the page at 1280 × 720 and checks the map exists.
- [x] T003 Restructure `index.html` per [contracts/changes.md](./contracts/changes.md): inside the page content element put one layout element whose direct children are, in this order, the top bar (`h1`, `state-caption`, toolbar), the panels column `[data-role="panels"]` (builder, the district picker section with `district-list`, a new empty `[data-role="district-detail"]` containing the existing `editing-status` element, `plan-status`, and a `.message-slot` around `edit-message`), the brush bar (`brush-tool`), the map `figure.map-frame` with the error block, then the secondary sections `state-totals`, `control-total`, `legend`, the hint paragraph (moved out of the picker section), and `notice`. Keep every existing `data-role` and id; remove `.map-side` and the old `.districts` nesting; keep the picker heading but mark it visually hidden.
- [x] T004 Rewrite the page layout in `styles.css` (replacing the old `.map-layout`, `.map-side` and `.districts` rules): the three layouts as named-area grids over the children from T003. Workbench: `@media (min-height: 720px) { @container (min-width: 1240px) { … } }` on the layout element when the page is not in build mode; the layout element is one window tall (`100vh`, then `100dvh`) for the top bar (52 px), the map row (`1fr`) and the brush bar (56 px); padding 12 px and 8 px gaps; panels column 400 px (440 px from 1600 px); the map frame fills its cell and the SVG keeps its 4:3 shape (`width: 100%; height: 100%`); secondary sections below in a grid. Two columns: container 760 px and wider whenever the workbench does not apply (including build mode). One column: the default, in the order top, map, brush, panels, totals, control, legend, hint, notice. Keep the build-mode hiding rules and add the new elements to them. Make the brush bar a single row at fixed height.
- [x] T005 In `src/main.js`, keep the page working with the new structure: the error handling that toggles `elements.layout.hidden` must hide the map and the panels (not the title and toolbar) and show the error block, as it does today; `elements.layout` keeps pointing at an element for which this is true; nothing else changes. Check `tests/ui.test.js` for the roles it queries and make sure each still exists exactly once.
- [x] T006 Update `tests/ui.test.js` for the moved sections only: the tests that read the side column, the stat block sitting directly above the control block, the control total being beside the map, and the list rows' place now describe the new places (stat block and control total in the secondary area below the map; picker and plan status in the panels column); keep every assertion about content and behavior as it is.
- [x] T007 Run `python3 scripts/test.py --affected`; fix anything that fails by finishing the restructure, not by loosening assertions.

**Checkpoint**: The suite passes on the new structure; at 1280 × 720 the page is already one window tall for its first screen.

---

## Phase 3: User Story 1 — Pick a District, Edit the Map, and Read Its Status Without Scrolling (Priority: P1) 🎯 MVP

**Goal**: With a district selected, the picker, the whole map, the selected district's detail, the plan status, the brush bar and the matchup toggle are all on the screen at once, and nothing moves while editing.

**Independent Test**: At 1280 × 720 and the other listed sizes, select a district, turn the brush on, make edits by click and by brush, and see the new status without scrolling; the page's scroll position and every box stay put.

### Tests for User Story 1

- [x] T008 [P] [US1] In `tests/layout.test.js`, add the fit test (FR-001, FR-002, FR-002a, SC-001, SC-004): for each size in 1280 × 720, 1366 × 768, 1440 × 900, 1536 × 864 and 1920 × 1080 and each district count in 8, 14 and 20 (`seedWithDistricts`), open the page, select a district (`gerryApp.setEditing(1)`) and turn the brush on; require each of the picker (the district list and all its rows), the whole map (`[data-role="map"]`), the district detail, the plan status, the brush bar, the matchup toggle and the editing status line to be fully inside the window (`insideWindow`); require the map frame to be the largest of those boxes by area and to cover at least 40% of the window; require its size to be at least 560 × 420 at 1280 × 720 and at least 800 wide at 1920 × 1080; require `document.scrollingElement.scrollTop` to be 0.
- [x] T009 [US1] In `tests/layout.test.js`, add the walkthrough (FR-003, FR-004, SC-002, SC-006) at 1280 × 720 with 20 districts and at 1440 × 900 with 14: select district 1, then make 5 single-precinct clicks (`editPrecinct`) and 5 brush strokes (`strokeAt`), switch to district 2 and do 10 more, including at least one blocked edit (a precinct that does not touch the district) so the message appears; after every step require the window's scroll position to be 0 and the boxes of the map, the panels column and the brush bar to be identical to their boxes before the step (0 px of layout shift).
- [x] T010 [P] [US1] In `tests/ui.test.js`, add tests for the district detail (data-model "District Detail"): with a district selected it shows the number, a status that is one of `empty`, `under`, `ok`, `over` rendered as "○ Empty", "▼ Too small", "● Within range" or "▲ Too large", the leader and margin ("Tied" or "Empty" when so), the voter total, the allowed range (`lower` to `upper`) and the distance from it ("N over", "N under" or "within range"; `offset` is positive over `upper`, negative under `lower`, 0 when within or empty), the precinct count, and "Yes" or "No, in N pieces" for connected; it updates immediately after an add, a move, a remove and a brush stroke; it shows "Pick a district's pen to edit it and see its status here." when none is selected and after Escape; the `editing-status` element lives inside it and keeps its text, role and hidden behavior; and its numbers agree with the plan status and the picker tile for the same district.

### Implementation for User Story 1

- [x] T011 [US1] Create `src/ui/district-detail.js` per [contracts/changes.md](./contracts/changes.md): `describeDistrict(district, balanceInfo, balance, matchup)` returning the row texts above, and `renderDistrictDetail(container, { district, balanceInfo, balance, matchup, editing })` that fills the detail (keeping the existing `editing-status` element inside) or renders the prompt when `district` is null. Add `balanceSymbol(balance)` (`○`, `▼`, `●`, `▲`) to `src/ui/district-list.js` and use it for the status text.
- [x] T012 [US1] In `src/main.js`, call `renderDistrictDetail` from `renderDistrictViews` with `state.districts[n - 1]`, the matching entry of `getBalance(state).districts` and the whole balance result (from `getPlanStatus(state).balance`, already computed there), or null when no district is selected; make `renderEditingStatus` write into the detail's `editing-status` element without changing its text, role or hidden behavior.
- [x] T013 [US1] In `styles.css`, make the right column fit (research R4 budget): the detail panel's compact layout and reserved height (heading, a status line, four rows of 18 px); the plan status as two-column rows of 18 px with its existing content; the message slot at two lines (44 px) that never collapses; the brush bar as one row (toggle and Add/Erase and the size slider with its value on the left, the two-line message cell on the right) at 56 px; the panels column as a flex column that fills its cell and scrolls inside itself only as a last resort. Tune until T008 passes at 1280 × 720 with 20 districts.
- [x] T014 [P] [US1] In `src/ui/map-view.js`, make programmatic focus use `focus({ preventScroll: true })` (the arrow-key move between precincts and any other `.focus()` call), and make sure nothing calls `scrollIntoView`.
- [x] T015 [US1] Run `python3 scripts/test.py layout ui districts`; all pass.
- [x] T016 [US1] Check by hand with quickstart section 2 at 1280 × 720 (the browser's device toolbar is fine); fix any layout shift or clipping found.
- [x] T017 [US1] Record the measured boxes (map frame, map, picker, detail, plan status, brush bar, panels column, spare height) at the five window sizes and the map's share of the window under "Final measured values" in `research.md`, and note whether the column had to scroll inside itself.

**Checkpoint**: User Story 1 is complete: the editing loop fits one screen with a district detail, and nothing moves.

---

## Phase 4: User Story 2 — See Every District's Status at a Glance in the Picker (Priority: P2)

**Goal**: The picker shows all 8–20 districts at once as compact tiles, each with its number, color, leader, a status in words and a symbol, and the amount over or under.

**Independent Test**: Draw part of a plan, check that every district tile is visible without scrolling, that each tile's status and amount are readable and update as edits are made, and that a district can be picked in one click or by keyboard.

### Tests for User Story 2

- [x] T018 [P] [US2] In `tests/ui.test.js`, add tile tests: each district's row shows its number, the leader and margin with the side's short name ("Dem +5.2", "Tied" or "Empty"), the status symbol and words ("▲ Too large", "▼ Too small", "● Within range", "○ Empty") and the amount ("+4,210", "−1,860", blank when within range or empty); statuses are text, so they survive without color (the text is present in each row); the tiles update for every district an edit changed; the pen still selects (click, Enter and Space) with `aria-pressed` and the `selected` class; hovering or focusing a tile still reveals the district and shows its details; the row's `aria-label` is unchanged.
- [x] T019 [P] [US2] In `tests/layout.test.js`, add the picker test (FR-006, SC-005): at 1280 × 720, 1366 × 768 and 1920 × 1080 with 8, 14 and 20 districts, every row of the district list is fully inside the window and the list has no inner scrolling (`scrollHeight <= clientHeight`); a tile is at least 90 px wide and 34 px of its pen is clickable (the pen is at least 34 × 34); at 1280 × 720 with 20 districts the tiles use 4 columns in the 400 px panels column.

### Implementation for User Story 2

- [x] T020 [P] [US2] In `src/matchups.js`, add `shortName` to each side: `Dem`, `Rep`, `Soc`, `Lib`, `Pur`, `Org`; leave every other field alone; add a test line in `tests/matchups.test.js` that every side has a non-empty `shortName` of at most 6 characters.
- [x] T021 [US2] In `src/ui/district-list.js`, render the tile content: `.swatch` shows the district number on its result color (the empty pattern when empty); `.district-name` still holds "District N" but is visually hidden in tiles; `.district-status` shows the leader with margin using `shortName`; `.district-balance` shows `balanceSymbol` plus the words and the amount as `balanceLabel` builds them ("Too large +4,210", "Too small −1,860", "Within range", "Empty"); keep the events, `getRow`, `getPen`, `aria-label`, `aria-pressed` and the `selected` class exactly as they are.
- [x] T022 [US2] In `styles.css`, style the tiles: `.district-list` as a grid of 4 columns in the workbench panels column (5 columns from 1600 px) and 3 columns in the two- and one-column layouts; tile height about 54 px with three lines (number and leader, status with symbol, amount), the pen in a corner at 34 px, a clear selected state that does not rely on color alone (a thick border and the pressed pen), and a visible focus ring. Re-check T008 at 20 districts.
- [x] T023 [US2] Run `python3 scripts/test.py layout ui districts`; all pass.

**Checkpoint**: User Stories 1 and 2 work: every district's status is readable at a glance from the picker.

---

## Phase 5: User Story 3 — Everything Else Stays Available, and Other Screen Sizes Still Work (Priority: P3)

**Goal**: Nothing was lost, smaller windows and phones stack sensibly with no sideways scrolling, resizing keeps the work, build mode is unchanged, and keyboard focus moves picker → brush → map without scrolling.

**Independent Test**: At several window sizes check that every earlier section and control is present, that there is no horizontal scrolling anywhere from 320 to 2560 px, that resizing loses nothing, and that build mode works.

### Tests for User Story 3

- [x] T024 [P] [US3] In `tests/layout.test.js`, add the overflow and presence test (FR-015, FR-017, FR-018, SC-007): for widths 320 × 700, 480 × 800, 768 × 1024, 1024 × 768, 1279 × 720, 1280 × 719, 1920 × 1080 and 2560 × 1440, require no horizontal scrolling (`scrollWidth <= innerWidth` on the page), and that the toolbar controls, the map, the picker, the detail, the plan status, the brush bar, the statewide voter block, the control total, the legend, the hint and the notice all exist and (after scrolling the frame) can be reached; at 1279 × 720 and 1280 × 719 require the non-workbench layout (the page is taller than the window), and at 1280 × 720 the workbench.
- [x] T025 [P] [US3] In `tests/layout.test.js`, add the resize test (FR-019): open the page at 1440 × 900, select district 2, turn the brush on with size 80 and mode Erase, paint a stroke, then resize the frame to 1000 × 700, then 700 × 900, then 320 × 700, and back to 1440 × 900; after each resize require the state, the assignments, the selected district, the brush settings and the picker's contents to be the same as before.
- [x] T026 [P] [US3] In `tests/layout.test.js`, add the build-mode and keyboard tests: with "Build a state" open at 1440 × 900 the builder is shown in the panels column, the picker, detail, plan status and brush bar are hidden, the workbench is off (the page may scroll), and placing a city works; and (FR-020) the DOM order of focusable parts is the matchup toggle, then the picker's pens and rows, then the brush controls, then the map precincts, then the rest, and pressing arrow keys on a focused precinct moves focus without changing the window's scroll position.

### Implementation for User Story 3

- [x] T027 [US3] In `styles.css`, finish the other layouts: the two-column layout (container 760 px and wider whenever the workbench does not apply: the map left, the panels column on the right at about 300 px with 3-column tiles, the brush bar under the map, the secondary sections in a grid below); the one-column layout (top, map at full width, brush bar, panels, then the secondary sections, with 3-column tiles and controls at least 34 px); the small-screen rules for 480 px and below; and no horizontal overflow anywhere from 320 to 2560 px (`min-width: 0` on grid children, wrapping text, `overflow-wrap`). Use the fallbacks in research R12 for phones.
- [x] T028 [US3] In `index.html` and `src/ui/brush-panel.js`, fix whatever T026 finds in the focus order or in elements that were left out of the new structure (nothing from the old page may be missing); in `styles.css` make sure the builder panel is usable in the two-column and one-column layouts (scrolling allowed).
- [x] T029 [US3] Run `python3 scripts/test.py layout ui`; all pass; check quickstart section 4 by hand at 1000, 700 and 320 px wide.

**Checkpoint**: All three stories work independently and together.

---

## Phase 6: Polish and cross-cutting

- [x] T030 [P] Add "Superseded by 011 for layout" notes to `specs/002-congressional-district-editor/spec.md` (the district list below the map and the control total beside the map, FR-008 and FR-016), `specs/007-state-voter-makeup/spec.md` (where the statewide voter block sits) and `specs/010-precinct-brush-tool/spec.md` (the Brush section's place), without rewriting their requirements.
- [x] T031 [P] Remove styles and markup that nothing uses any more (the old `.map-side`, `.districts` and two-column rules, unused hint placement) in `styles.css` and `index.html`, then re-run `python3 scripts/test.py --affected`.
- [x] T032 Check the app by hand in a browser at 1280 × 720, 1366 × 768 and 1920 × 1080 (quickstart sections 2 and 3), including the hover pop-up near the right edge and with 20 districts; fix anything that overlaps, clips or shifts.
- [x] T033 [P] Fill in "Final measured values" in `specs/011-single-screen-editing/research.md` and "Results" in `specs/011-single-screen-editing/quickstart.md` (the sizes at the five windows, the map's share, the spare height in the panels column, the layout test run time).
- [x] T034 Run the full suite once with `python3 scripts/test.py`; it must pass with 0 failures.
- [x] T035 Final checks: no unused ids or `data-role`s were dropped (every role the tests and `src/main.js` query exists exactly once in `index.html`); no debug code or temporary files remain; the session `files/` folder holds nothing the repository needs.

---

## Dependencies and Execution Order

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: needs Setup. T002 can run beside T003; T004 needs T003 (same names); T005 needs T003; T006 needs T004 and T005; T007 last.
- **US1 (Phase 3)**: needs Phase 2. T008 and T010 (different files) are written in parallel; T009 follows T008 (same file); T011 before T012; T013 needs T008 and T012; T014 is independent; T015 needs T011–T014; T016 and T017 last.
- **US2 (Phase 4)**: needs Phase 2 and the layout from US1's styles (T013), because the tiles live in that column. T018 and T019 in parallel (different files); T020 is independent; T021 needs T020; T022 needs T021; T023 last.
- **US3 (Phase 5)**: needs Phase 2. T024, T025 and T026 are all in `tests/layout.test.js`, so write them one after the other even though they are independent; T027 and T028 touch `styles.css`, `index.html` and the brush panel and run in order; T029 last.
- **Polish (Phase 6)**: needs all stories. T030, T031 and T033 run in parallel; T034 after T030–T033; T035 last.

### Parallel examples

```text
Foundational:  T002 + T003, then T004 + T005, then T006
US1 tests:     T008 + T010 (then T009)
US1 impl:      T011 → T012; T014 beside both
US2:           T018 + T019 + T020, then T021 → T022
US3 tests:     T024, T025, T026 (same file: one after another)
Polish:        T030 + T031 + T033
```

## Implementation Strategy

- **MVP**: Phases 1–3 (through T017). That delivers User Story 1 on its own: the single editing screen with the new district detail. It is shippable even before the compact picker, because the existing list can sit in the right column (it is longer, so fit may need the column to scroll inside itself until US2 lands).
- **Incremental**: add the compact picker (US2) and check it by hand with quickstart section 3, then the other window sizes, resize and keyboard work (US3).
- **Risk first**: the right column's fit at 1280 × 720 with 20 districts is the main risk. T008 is the gate, and T013 and T022 are where the space is won; if it still does not fit, use the fallbacks in research R4 before touching the map's size.
- Run only the groups a task touches while working, and the full suite once at the end.
