---
description: "Tasks for feature 012"
---

# Tasks: Flowing Summary Panels

**Input**: Design documents from `/specs/012-flowing-summary-panels/`

**Prerequisites**:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/changes.md](./contracts/changes.md)
- [quickstart.md](./quickstart.md)

**Tests**: Included, in the parallel suite.
- Run a group with `python3 scripts/test.py layout` (or `ui`, `districts`), everything the change could touch with `python3 scripts/test.py --affected`, and the full suite once at the end with `python3 scripts/test.py`.
- The `layout` group (`tests/layout.test.js`, helpers in `tests/layout-helpers.js`) loads the real page in same-origin iframes of exact sizes, so the media and container queries behave as in a real window.

**Order**: The phases follow dependencies, not only story numbers.
- Foundational work builds the placement module, wires it into the page and adds the CSS hooks, so the page runs with the new behavior in place but with no compact styling yet.
- US1 (the one-screen workbench: the blocks fill the room, compactly) comes next, then US2 (re-flow on resize, district count, build mode), then US3 (the two-column and phone layouts).
- US2 and US3 build on the foundational work and are otherwise independent of each other.

**Terms**: Names come from [data-model.md](./data-model.md) and [contracts/changes.md](./contracts/changes.md). "Docked" means a block is inside the right-hand column under the message area. "Workbench" is the 011 one-screen layout (`--dock: column`), "beside" is the two-column layout (`--dock: beside`), "none" is the one-column layout (`--dock: none`).

**Measuring tasks** (T012, T028) record real numbers in [research.md](./research.md) ("Final measured values") and [quickstart.md](./quickstart.md) ("Results"). If the compact blocks do not reach SC-001 (all three at 1920 × 1080 with up to 14 districts), revise SC-001 in the spec to the measured result and say so in the completion report; do not loosen a test silently.

**Do not**: change any block's renderer (`state-totals.js`, `control-total.js`, `legend.js`), any editing, brush or builder behavior, or the boxes of the map, picker, detail, Plan check, message area and brush bar.

## Phase 1: Setup

- [x] T001 Run `python3 scripts/test.py` and record the baseline (158 passed, 0 failed). At 1920 × 1080 and 1440 × 900 with 14 districts, record in `specs/012-flowing-summary-panels/research.md` ("Final measured values") the page's scroll distance and where the three blocks start (before any change).

---

## Phase 2: Foundational — the placement module, wired in, with CSS hooks

**Purpose**: Give every story the same engine. After this phase blocks already dock and undock correctly by measurement; spacing is still the uncompacted 011 style.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 [P] Create `tests/summary-dock.test.js` with the pure `chooseDockCount` tests from [contracts/changes.md](./contracts/changes.md): all fit, none fit, only the first fits, a predicate that is not monotonic (the largest passing count wins), and a total of 0. Add the file to the `layout` group's `files` in `tests/groups.json` (covers `src/ui/summary-dock.js`).
- [x] T003 Create `src/ui/summary-dock.js` per [contracts/changes.md](./contracts/changes.md): export `chooseDockCount(total, fits)` (tries `total` down to 0, returns the first count for which `fits(count)` is true, 0 if none) and `createSummaryDock({ layout, column, map, brush, blocks, hint, app })` returning `{ update, destroy, docked }`. A pass reads `--dock` from the layout's computed style (`column`, `beside`, anything else is none); returns 0 and places every block below when the mode is none, `app` has `is-building`, or the column has no box; otherwise places all blocks in the column (appended after the last child, in order), uses `chooseDockCount` with the fit test from [data-model.md](./data-model.md) ("Open Room Test": `column`: `scrollHeight <= clientHeight + 1`; `beside`: column `offsetHeight <=` map `offsetHeight` + gap + brush `offsetHeight`), puts the rest back before `hint` in order, sets `data-docked` on the layout and `is-docked` on the docked blocks. Guard against re-entry and skip moving a block that holds focus. A repeated pass with nothing changed must move no node.
- [x] T004 In `src/ui/summary-dock.js`, add the observers from research R8 inside `createSummaryDock`: a `ResizeObserver` on the layout, the column, the picker, the detail, the Plan check, the message area and each block; a `MutationObserver` on each block (child list, character data, subtree) and on `app` (class attribute); each callback calls `update()` synchronously. `destroy()` disconnects them and puts the blocks back below.
- [x] T005 In `styles.css`, add the hooks: `--dock: none` on `.layout`; `--dock: beside` in the `@container app (min-width: 760px)` rule; `--dock: column` in the workbench rule; `--dock: none` again under `.is-building`. In the two-column rule add the grid-area variants for `[data-docked="1"]` (`control legend` row), `[data-docked="2"]` (`legend legend` row) and `[data-docked="3"]` (no row for the three blocks), keeping the `hint` and `notice` rows. Add a minimal `.panels > .is-docked { flex: none; }`.
- [x] T006 In `src/main.js`, after the first render, create the dock once (`layout` = the `map-layout`'s parent `.layout`, `column` = `panels`, `map` = `.map-cell`, `brush` = `brush-tool`, `blocks` = `state-totals`, `control-total`, `legend` elements in order, `hint` = `.layout > .hint`, `app` = the `main.app` element), call `update()` once, keep it on the app object, expose it on `window.gerryApp` as `dock`, and call `dock.destroy()` from `app.destroy()`.
- [x] T007 Run `python3 scripts/test.py layout ui districts`; fix anything that fails by correcting the module or the CSS hooks, not by loosening tests. The 011 layout tests must still pass with blocks docked or not (adjust only a test that assumed the three blocks are always below the screen, to accept either place).

**Checkpoint**: The page docks blocks by real measurement; every earlier test still passes.

---

## Phase 3: User Story 1 — The summary blocks fill the open room beside the map (Priority: P1) 🎯 MVP

**Goal**: On the one-screen layout, as many blocks as fit complete sit under the Plan check, compactly, and nothing else moves.

**Independent Test**: Open the page at five laptop and desktop sizes with 8, 14 and 20 districts; the blocks docked are exactly the ones that fit, in order, and every other box is where it was.

### Tests for User Story 1

- [x] T008 [P] [US1] In `tests/layout.test.js`, add the dock fit test (FR-001 to FR-005, SC-002, SC-003, SC-004): for each of the five laptop and desktop sizes (1280 × 720, 1366 × 768, 1440 × 900, 1536 × 864, 1920 × 1080) and 8, 14 and 20 districts, with a district selected and the brush on: (a) every block exists exactly once; the order of the three in the page is totals, control, legend, and docked ones come before undocked ones; (b) the column does not scroll and every docked block is fully inside the column and the window, none overlaps another and none has an inner scroll bar; (c) no more blocks could be docked: temporarily docking one more block (move it into the column in the test) makes the column overflow; (d) the boxes of the map frame, picker, detail, Plan check, message area and brush bar equal their boxes with nothing docked (compare against the same page with the blocks moved below in the test); (e) at 1280 × 720 with 20 districts `docked` is 0.
- [x] T009 [US1] In `tests/layout.test.js`, add the walkthrough with docked blocks (FR-005, FR-007): at 1920 × 1080 with 14 districts (and 1440 × 900 with 8), do ten edits (click and brush strokes in two districts); after each, nothing in the base box list from the 011 walkthrough moved, the page did not scroll, and the numbers in the docked blocks changed to match the plan (read the Statewide Voters total and the District Control counts).
- [x] T010 [P] [US1] In `tests/layout.test.js`, add the scroll-distance test (SC-005): at 1920 × 1080 and 1440 × 900 with 14 districts, the page's scroll distance (document height minus window height) is smaller than with the blocks moved below by at least the height of the docked blocks, and at 1920 × 1080 the three blocks are on the first screen if `docked` is 3.

### Implementation for User Story 1

- [x] T011 [US1] In `styles.css`, add the compact docked style from research R7 for `.panels > .is-docked` (and `.panels > .is-docked` children where needed): 8 × 10 px padding, tighter row gaps, smaller type in rows, legend swatch rows packed into fewer lines, same colors, borders and content. Work from the measured heights (target about 140, 140 and 100 px) and the actual room (about 380 to 440 px at 1920 × 1080).
- [x] T012 [US1] Measure and record in `specs/012-flowing-summary-panels/research.md` ("Final measured values") the docked heights of the three blocks, the number docked at each of the five sizes and three district counts, and the page's scroll distance before (T001) and after. If SC-001 is not met, revise SC-001 in `spec.md` to the measured result and add a one-line note under its text.
- [x] T013 [US1] Run `python3 scripts/test.py layout ui districts`; all pass.
- [x] T014 [US1] Check by hand with quickstart section 2 at 1920 × 1080 (browser device toolbar is fine); fix any clipping, overlap or shift found.

**Checkpoint**: User Story 1 works on its own: blocks fill the room in the workbench. This is the MVP.

---

## Phase 4: User Story 2 — The panels re-flow when the window or the state changes (Priority: P2)

**Goal**: The docked set is recomputed whenever the room changes, with no reload, no lost edit and no clipped block.

**Independent Test**: Resize through six sizes up and down, load states with different district counts, open and close "Build a state"; at each step the docked blocks are exactly the ones that fit.

### Tests for User Story 2

- [x] T015 [P] [US2] In `tests/layout.test.js`, add the resize test (FR-006, SC-006): open at 1920 × 1080 with 14 districts, select district 2, turn the brush on and paint one stroke; then resize the frame through six sizes (1920 × 1080, 1600 × 900, 1440 × 800, 1366 × 700, 1280 × 720, 1536 × 864) and back; after each resize the fit properties of T008 (a) to (d) hold, `docked` is never more than the room allows, never fewer than the room allows, and moves only in the order described (blocks leave from the end, join from the front of the remaining ones); the painted stroke still stands and one more click and stroke still work.
- [x] T016 [P] [US2] In `tests/layout.test.js`, add the state-change test (FR-006): at 1920 × 1080 call the app's new-map entry point with seeds of 8, 14 and 20 districts (use `seedWithDistricts`); after each, T008 (a) to (d) hold and `docked` is smaller or equal for the larger district counts; and a plan-text change (a not-valid plan becoming valid, or the reverse) leaves the docked set matching the fit.
- [x] T017 [P] [US2] In `tests/layout.test.js`, add the build-mode and error tests (FR-012): with "Build a state" open at 1920 × 1080, `docked` is 0, the three blocks are below, the builder is shown in the column and the page has no clipped block; after Cancel the blocks re-flow to the same `docked` as before; with an error shown instead of the map (use the existing way tests trigger the error state), `docked` is 0 and nothing throws.
- [x] T018 [P] [US2] In `tests/layout.test.js`, add the idempotence and focus tests (research R8, R9): calling `dock.update()` twice in a row moves no node (record the three blocks' parents and next siblings before and after) and gives the same count; pressing Tab through the page at 1920 × 1080 with blocks docked and with blocks below visits the same elements in the same order (picker pens, brush controls, map precincts, then the rest).

### Implementation for User Story 2

- [x] T019 [US2] In `src/ui/summary-dock.js`, fix whatever T015 to T018 find (observer coverage, re-entry, a block that is moved while the app is rendering, the error state), keeping the module's contract in [contracts/changes.md](./contracts/changes.md). If the contract changes, update it.
- [x] T020 [US2] Run `python3 scripts/test.py layout ui districts`; all pass.
- [x] T021 [US2] Check by hand with quickstart section 3 (step the window from 1280 × 720 up to 1920 × 1080 and back, and zoom the page in and out); fix any flicker, lag or cut-off found.

**Checkpoint**: User Stories 1 and 2 both work: the dock follows every change.

---

## Phase 5: User Story 3 — Other layouts use their open space too (Priority: P3)

**Goal**: The same rule applies in the two-column layout; phones are unchanged.

**Independent Test**: At 1000 × 800, 768 × 1024 and 390 × 800 the blocks are where the rule says, nothing overlaps or runs off the side, and there is no sideways scrolling.

### Tests for User Story 3

- [x] T022 [P] [US3] In `tests/layout.test.js`, add the two-column test (FR-008, SC-003): at 1000 × 800, 1100 × 900, 1200 × 720 and 1280 × 719, with 8, 14 and 20 districts, every block exists once in order; the column is no taller than the map cell plus the gap plus the brush bar when blocks are docked (and the same page with nothing docked has a column of the same height or taller than the left side, if docking was skipped because it did not fit); one more block docked would make the column taller than the left side; the map, picker, detail, Plan check and brush bar boxes equal their boxes with nothing docked.
- [x] T023 [P] [US3] In `tests/layout.test.js`, add the phone and no-overflow test (FR-009, FR-010): at 320 × 700, 390 × 800, 480 × 800 and 768 × 1024, `docked` is 0 where there is one column; the blocks follow the map and controls in the order totals, control, legend; `document.documentElement.scrollWidth` does not exceed the window width at any of these sizes nor at any of the laptop sizes.

### Implementation for User Story 3

- [x] T024 [US3] In `styles.css`, finish the two-column behavior: make sure the compact docked style from T011 also applies in the 300 px column (rows must not wrap badly; legend and totals stay readable), the `data-docked` grid-area variants from T005 close the gaps, and the one-column layout is unchanged.
- [x] T025 [US3] In `src/ui/summary-dock.js` or `styles.css`, fix whatever T022 and T023 find (for example the `beside` fit test when the panels column spans two grid rows, or a one-column layout that reports two tracks).
- [x] T026 [US3] Run `python3 scripts/test.py layout ui`; all pass. Check quickstart section 4 by hand at 1000, 768 and 390 px wide.

**Checkpoint**: All three stories work.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T027 [P] Add a note to `specs/011-single-screen-editing/spec.md` (under the title, like the earlier "Superseded" notes): "**Refined by [012](../012-flowing-summary-panels/spec.md)**: the Statewide Voters, District Control and Legend blocks now move up into open space under the Plan check when it exists."
- [x] T028 [P] Fill in "Final measured values" in `specs/012-flowing-summary-panels/research.md` (if not done in T012, plus the two-column results) and "Results" in `specs/012-flowing-summary-panels/quickstart.md` (docked counts per size, scroll distances, the test run).
- [x] T029 [P] Remove anything unused: dead CSS from the old fixed rows for the three blocks if nothing uses it, and debug code. Run `python3 scripts/test.py --affected`.
- [x] T030 Run the full suite once with `python3 scripts/test.py`; it must pass with 0 failures.
- [x] T031 Final checks: every `data-role` the tests and `src/main.js` query exists exactly once in `index.html`; each block exists once at every tested size; no console errors on load, resize or edit; the 011 layout tests still pass unchanged apart from T007.

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: T001 first.
- **Foundational (Phase 2)**: needs Setup. T002 can run beside T003; T004 follows T003 (same file); T005 can run beside T003 and T004 (different file); T006 needs T003 and T004; T007 last.
- **US1 (Phase 3)**: needs Phase 2. T008 and T010 are written first (same file, one after the other; T009 follows T008); T011 follows the tests; T012 needs T011; T013 after T012; T014 last.
- **US2 (Phase 4)**: needs Phase 2 and can run beside US1 after T011 exists. T015 to T018 are in one test file, so write them one after the other; T019 follows them; T020 then T021.
- **US3 (Phase 5)**: needs Phase 2 and T011. T022 and T023 in one file, one after the other; T024 and T025 follow; T026 last.
- **Polish (Phase 6)**: needs all stories. T027, T028 and T029 in parallel; T030 after them; T031 last.

## Parallel Opportunities

```text
Foundational:  T002 + T003, then T004 + T005, then T006, then T007
US1 tests:     T008 → T009, T010 (same file: one after another)
US2 tests:     T015 → T016 → T017 → T018 (same file)
US3 tests:     T022 → T023 (same file)
Polish:        T027 + T028 + T029
```

## Implementation Strategy

- **MVP**: Phases 1 to 3 (through T014). That delivers User Story 1 on its own: on a tall laptop or desktop window the blocks fill the open room under the Plan check, compactly, and the page scrolls less.
- **Incremental**: US2 hardens the same behavior against resize and state changes; US3 extends it to the two-column layout. Each is shippable on its own after the foundation.
- **Risk first**: whether the compact blocks fit three at 1920 × 1080 is the main unknown. T011 and T012 measure it early; the spec's SC-001 is revised to the measured result if needed.
- **Speed**: while working, run only the `layout` group (about 15 s); run the full suite once at T030.
