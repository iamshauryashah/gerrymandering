---
description: "Tasks for feature 006"
---

# Tasks: Solid District Colors With Hover Reveal

**Input**: Design documents from `/specs/006-solid-district-colors/`

**Prerequisites**:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/changes.md](./contracts/changes.md)
- [quickstart.md](./quickstart.md)

**Tests**: Included, on the browser test page `tests/index.html`.

**Order**: Implement after 005. Both features edit `src/main.js` and `tests/ui.test.js`.

## Phase 1: Setup

- [X] T001 Run `tests/index.html` with the cache disabled after 005 is done and record the baseline pass count.

---

## Phase 2: Foundational

- [X] T002 In `src/ui/map-view.js`, move the county fill logic out of `render()` into a `paintCounties()` function, called from `render()` and at the end of `renderDistricts()`. Set `data-own-fill` on each `path.county` to its own result color.

**Checkpoint**: Behavior is unchanged and all tests pass.

---

## Phase 3: User Story 1 - See Each District as One Solid Color (Priority: P1) 🎯 MVP

**Goal**: Every county in a district shows the district's result color, with no seams inside the district.

**Independent Test**:
1. Load the reference plan.
2. Every county in district *n* has `fill` equal to the color of district *n*'s badge and swatch.
3. Unassigned counties keep `data-own-fill`.

### Tests

- [X] T003 [P] [US1] Replace the 002 test "counties are filled by their own result and never recolor on reassignment" in `tests/ui.test.js` with three tests:
  1. Counties in a district have `fill` equal to the district badge and swatch color, and their stroke equals their fill (SC-001).
  2. In a district with mixed county results, the fill equals the combined-result color (SC-002).
  3. Unassigned counties have `fill === data-own-fill` and keep the no-district pattern (FR-003).

### Implementation

- [X] T004 [US1] In `paintCounties()` in `src/ui/map-view.js`:
  - For a county in district *n* that is not revealed, set `fill = getResultColor(d.status, d.marginPercent, matchup)` (the same call as the badge and swatch) and `style.stroke` = that fill.
  - Otherwise, set `fill` = own color and clear `style.stroke`.
  - Leave the district borders, selected hatch, and unassigned dot overlay unchanged.

**Checkpoint**: Districts appear as solid areas.

---

## Phase 4: User Story 2 - Colors Update as Districts Change (Priority: P1)

**Goal**: Adding, moving, or removing a county, or changing the matchup, recolors everything immediately.

**Independent Test**: Edit a county, then toggle the matchup. The fills always match the badges.

### Tests

- [X] T005 [P] [US2] Add tests in `tests/ui.test.js`:
  - After `editCounty` adds, moves, and removes a county, every affected county's fill matches its district badge, or its own color once removed (SC-003, SC-004).
  - After a matchup toggle, the district fills equal the new badge colors and the assignments are unchanged (FR-006).

### Implementation

- [X] T006 [US2] Make sure every commit path calls `paintCounties()` through `renderDistricts`: edits, `setAssignments`, `load`, and the matchup change in `src/main.js` and `src/ui/map-view.js`. Add calls where any path is missing.

---

## Phase 5: User Story 3 - Reveal a District's Counties on Hover (Priority: P1)

**Goal**: Hovering or focusing a district (on the map or in the list) shows its counties' own colors within 0.2 s. On touch, a tap reveals the district until the next tap elsewhere.

**Independent Test**:
- Hover a county in district *n*. Exactly *n*'s counties have `data-revealed="true"` and their own fills.
- Move to another county in *n*: no change.
- Leave: solid again.

### Tests

- [X] T007 [P] [US3] Add reveal tests in `tests/ui.test.js`, using dispatched `pointerover`/`pointerout` with `relatedTarget` and `focusin`/`focusout`:
  - Exactly the counties of district *n* are revealed, with fills equal to `data-own-fill` (SC-005a). Other districts stay solid.
  - Moving between two counties of the same district keeps the reveal (no flicker).
  - Leaving restores the solid color.
  - Hovering or focusing a district list row reveals the district; leaving it clears the reveal.
  - Hovering an unassigned county reveals nothing.
  - A touch `pointerup`/`click` on a county while not editing reveals it sticky. A `pointerout` with touch does not clear it. A tap elsewhere clears it.
  - Starting or stopping editing and `load` clear the reveal.
  - The county tooltip still shows the county's own voters plus the district details (FR-008).
  - Time each reveal with `performance.now()` and assert < 200 ms.

### Implementation

- [X] T008 [US3] In `src/ui/map-view.js`:
  - Add `revealedDistrict` and `stickyReveal` state.
  - Add `setRevealed(n | null)`. It repaints only the counties of the old and new districts, toggling `data-revealed` and fill/stroke through the shared paint helper.
  - Add `getRevealed()`.
  - Make `paintCounties()` respect the reveal.
- [X] T009 [US3] Wire the map events in `src/ui/map-view.js`:
  - **Pointer over a county** (not touch): reveal its district, or clear if it has none.
  - **Pointer out**: keep the reveal if `relatedTarget` is a county in the same district; otherwise clear (ignored for touch while sticky).
  - **Focus moving in/out**: same rules.
  - **Touch tap while not editing**: toggle a sticky reveal of the county's district. A tap on the background or an unassigned county clears it.
  - After an edit, if the revealed district no longer contains the hovered county, follow the county's current district.
- [X] T010 [P] [US3] Add an `onReveal(n | null)` callback in `src/ui/district-list.js`, fired on row `pointerenter`/`pointerleave` and `focusin`/`focusout`. When focus moves to another element inside the same row, do not fire. *(Done by reusing the existing `onDistrictEnter`/`onDistrictLeave` callbacks, which already skip moves within a row; see quickstart Results.)*
- [X] T011 [US3] In `src/main.js`, connect the list's `onDistrictEnter`/`onDistrictLeave` callbacks to `mapView.setRevealed`. Clear the reveal in `load()` and when editing starts or stops.
- [X] T012 [P] [US3] Add a `.county[data-revealed="true"]` style in `styles.css` (white seam stroke, 1 px) so the counties of a revealed district are visible.
- [X] T013 [P] [US3] Update the note text in `src/ui/legend.js` to: "Districts are shaded by their overall result. Hover a district (or its row) to see its counties' own colors. Counties without a district show their own color with dots." Update any legend test in `tests/ui.test.js` that checks the old text (FR-009).

**Checkpoint**: All 006 stories are complete.

---

## Phase 6: Polish & Cross-Cutting

- [X] T014 Run the full `tests/index.html` with the cache disabled. Get the title to `PASS: N passed, 0 failed` (SC-006).
- [X] T015 [P] Visual check at 1366 px and 320 px, following `specs/006-solid-district-colors/quickstart.md`:
  - solid districts
  - hover reveal without flicker
  - list-row reveal
  - keyboard focus reveal

  Record the results in that file.

---

## Dependencies & Execution Order

- **Overall**: Feature 005 complete → Setup → Foundational (T002) → US1 → US2 → US3 → Polish.
- **US2** builds on US1's painting.
- **US3** builds on US1's paint helper.
- Within each story, write the tests before the implementation.

## Parallel Opportunities

- The test tasks T003, T005, and T007 can be written together.
- In US3, these touch separate files and can run in parallel: T010 (list), T012 (CSS), and T013 (legend).

## Implementation Strategy

1. **MVP**: Phases 1–3 deliver solid districts.
2. Add US2 for live recolor, then US3 for the reveal.
