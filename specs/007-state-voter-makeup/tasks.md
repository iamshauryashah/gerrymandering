---
description: "Tasks for feature 007"
---

# Tasks: Statewide Voter Makeup Stat Block

**Input**: Design documents from `/specs/007-state-voter-makeup/`

**Prerequisites**:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/changes.md](./contracts/changes.md)
- [quickstart.md](./quickstart.md)

**Tests**: Included, on the browser test page `tests/index.html`. Formatter unit tests go in `tests/matchups.test.js` (it already covers the formatters); block and page tests go in `tests/ui.test.js`.

**Order**: Independent of 005 and 006 (both are done). Implement this before 008, which calls the `renderStateTotalsView()` function added here.

**Terms**: Markup, element names, and function signatures come from [contracts/changes.md](./contracts/changes.md). The rounding and display rules come from [data-model.md](./data-model.md).

## Phase 1: Setup

- [X] T001 Run `tests/index.html` with the cache disabled and record the baseline pass count.

---

## Phase 2: Foundational

**Purpose**: The figures every story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 In `src/formatters.js`, add the two functions from the contract:
  - `getStatewideResult(counties)`: sum `sideAVoters` and `sideBVoters` over every county in the list, assigned or not, and return `getResult(sumA, sumB)`.
  - `formatStatewideMakeup(counties, matchup)`: returns `{ totalVoters, sides, status, statusText, margin, summary, ariaLabel }`. `totalVoters` is `formatCount(total)`. `sides` is `[side A, side B]`, each `{ key, name, color, voters, share, percent }`, with `name` the matchup's side name, `color` the matchup's `shades[3]`, `voters` `formatCount(voters)`, `share` the exact share of all voters (0–100), and `percent` rounded to one decimal as a string ending in `%`. Round in integer tenths: `tenthsA = round(sideA / total × 1000)` and `tenthsB = 1000 − tenthsA`, so "the two percentages MUST add up to exactly 100.0%"; with a total of 0 both are `0.0%`. `statusText` and `margin` come from `formatVoterDetails` on the statewide result. `summary` is `"<leader> lead statewide · <leader> +<margin> pts"` (built from `statusText` and `margin`), or `"Tied statewide"` for a tie with no margin. `ariaLabel` is `"<A name> <A percent>, <B name> <B percent>"`.

**Checkpoint**: The numbers and wording exist as pure functions.

---

## Phase 3: User Story 1 - See the Statewide Voter Split (Priority: P1) 🎯 MVP

**Goal**: A "Statewide voters" block shows the total, each side's voters and percentage, a proportional bar, and the leader and margin.

**Independent Test**:
1. Load any map.
2. The block shows the total, both sides' voter counts and percentages, the bar, and the leader.
3. The two voter counts add up to the total and the two percentages add up to 100.0%.
4. All figures equal the sums over every county.

### Tests

- [X] T003 [P] [US1] Add formatter unit tests in `tests/matchups.test.js`:
  - `getStatewideResult` on a generated state equals the sums over `state.counties` and `state.totalVoters`.
  - Counties with no district are counted (use a fresh state with all assignments `null`, and a state after `setAssignments`).
  - `formatStatewideMakeup` percentages add up to exactly 100.0% for the splits 50.04/49.96, 33.35/66.65, 50/50, and 99.95/0.05, built from synthetic counties.
  - A lead gives `summary` `"Democrats lead statewide · Democrats +<margin> pts"` and a tie gives `"Tied statewide"` with no margin.
  - `sides[i].color` equals the matchup's `shades[3]`, `sides[0]` is side A, and `ariaLabel` has the form `"Democrats 50.2%, Republicans 49.8%"`.
- [X] T004 [P] [US1] Add block tests in `tests/ui.test.js` (the app fixture reads `index.html`, so T006 provides the markup):
  - `[data-role="state-totals"]` exists and is the first child of `.map-side`, before `[data-role="control-total"]`.
  - It has an `h2` "Statewide voters", `aria-labelledby` pointing at that heading, and `aria-live="polite"`.
  - `[data-key="total"]` equals `formatCount` of the sum over all counties, and equals `state.totalVoters`.
  - For each side: the name, `[data-key="sideAPercent"]` / `sideBPercent` and `[data-key="sideAVoters"]` / `sideBVoters` (text `"<count> voters"`) match `formatStatewideMakeup`; the two percentages add up to 100.0.
  - The bar has `role="img"` and the `ariaLabel` text; the segment widths equal the exact shares to within 0.01 percentage points; each segment's background is the matchup's `shades[3]` (compare with the `rgb()` helper).
  - The summary text shows the leader and margin; a synthetic tied state rendered through `renderStateTotals` shows "Tied statewide".
  - The swatches are `aria-hidden`.

### Implementation

- [X] T005 [P] [US1] Create `src/ui/state-totals.js` with `renderStateTotals(container, state, matchup)` that replaces the container's children with the markup in the contract: the `h2`, the total line with a `span[data-key="total"]`, `p.totals-summary[data-status]`, `div.makeup-bar[role="img"][aria-label]` with two `span.makeup-segment[data-side]` (width = `share`%, background = side color), and `dl.totals-rows` with one `div.totals-side[data-side]` per side holding a `dt` (aria-hidden swatch plus the name), `dd.totals-percent[data-key]`, and `dd.totals-voters[data-key]` (text `"<count> voters"`). Side A comes first. Use the figures from `formatStatewideMakeup(state.counties, matchup)`.
- [X] T006 [P] [US1] In `index.html`, add `section.state-totals[data-role="state-totals"]` (with `aria-labelledby` and `aria-live="polite"`; the `h2` gets an id and is written by T005) as the first child of `.map-side`, above `[data-role="control-total"]`.
- [X] T007 [P] [US1] In `styles.css`:
  - Add `.state-totals` to the shared card rule with `.control-total`, `.plan-status`, and `.legend`, and to the shared `padding: 12px 14px` rule.
  - `.makeup-bar`: flex row, 16 px tall, rounded corners, `overflow: hidden`, with a 50% marker line (a pseudo-element).
  - `.makeup-segment`: `flex: none`, no minimum width.
  - `.totals-side`: a two-line group (swatch, name, and percentage on the first line; the voter count on the second) so it fits the 260 px side column (about 232 px of content) with a 7-digit count.
  - Use `font-variant-numeric: tabular-nums` for the figures.
- [X] T008 [US1] In `src/main.js`: import `renderStateTotals`, add `stateTotals: $('state-totals')` to `elements`, add `renderStateTotalsView()` that calls `renderStateTotals(elements.stateTotals, app.state, app.matchup)`, and call it from `renderAll()` (after `renderLegend`).

**Checkpoint**: The block shows the statewide split. MVP.

---

## Phase 4: User Story 2 - Stat Block Follows the Matchup and the Map (Priority: P1)

**Goal**: Matchup changes rename and recolor the sides without changing numbers; a new map replaces the numbers; district edits leave the block alone.

**Independent Test**:
1. Toggle the matchup: names and colors change, every number stays the same.
2. Add, move, and remove counties in districts: the block is unchanged.
3. Start a new map: the block shows the new totals; reloading the first seed shows the original numbers again.

### Tests

- [X] T009 [US2] Add tests in `tests/ui.test.js`:
  - Toggling through all three matchups changes only the side names and colors; every `[data-key]` number and the percentages are identical, and the summary uses the new names.
  - After `setAssignments(referencePlan)` and `editCounty` add, move, and remove steps, the block's `innerHTML` is identical to before (SC-004).
  - `app.load('demo-2')` shows that state's totals (equal to its county sums) and `app.load('demo-1')` again restores exactly the original block HTML (FR-009 and reproducibility).
  - `app.newMap()` updates the block to the new state's totals, within 1 s measured with `performance.now()`.
  - Over 20 seeds, the displayed totals equal the county sums (SC-001).

### Implementation

- [X] T010 [US2] In `src/main.js`, confirm that `renderStateTotalsView()` is called from `renderAll()` only (which runs on `load` and on every matchup change) and not from `renderDistrictViews()`, `commit()`, `setAssignments()`, or `editCounty()`. Fix any path that makes the block stale after a new map or matchup change, or redraws it after a district edit.

**Checkpoint**: The block always agrees with the page and ignores districts.

---

## Phase 5: User Story 3 - Compare Against the District Result (Priority: P2)

**Goal**: The stat block and the district control summary are readable together, with the same side names and colors.

**Independent Test**:
1. At 1200 px and wider, both blocks are visible together in the side panel.
2. At 320 px they stack with the stat block directly above the control block, with no horizontal scrolling.
3. The block and the control rows use the same names and colors.

### Tests

- [X] T011 [US3] Add tests in `tests/ui.test.js`:
  - The side names in the block equal those in the control block's `.control-label` elements, and each segment's color equals the control block's matching swatch color (both use `shades[3]`), for every matchup.
  - At the fixture's width (1200 px) both blocks have a nonzero height and the gap between the bottom of the stat block and the top of the control block is at most 40 px.
  - With the fixture width set to 320 px, `root.scrollWidth <= root.clientWidth`, the stat block lies fully inside the root horizontally, and it is directly above the control block.
  - With a state whose voter counts have 7 digits, no `.totals-side` overflows its section (`scrollWidth <= clientWidth`) at 320 px and at the 260 px side-column width.

### Implementation

- [X] T012 [US3] In `styles.css`, adjust the block's spacing and wrapping until the T011 layout checks pass at the 260 px side column (container ≥ 760 px) and at 320 px; confirm `.map-side` keeps the stat block directly above the control block in both layouts.

**Checkpoint**: Both blocks read together on every screen size.

---

## Phase 6: Polish & Cross-Cutting

- [X] T013 Run the full `tests/index.html` with the cache disabled. Get the title to `PASS: N passed, 0 failed` (SC-008).
- [X] T014 [P] Visual and accessibility check at 1920 px, 1366 px, and 320 px, following [quickstart.md](./quickstart.md):
  - Check the block content, the bar and its halfway mark, the matchup change, and a new map.
  - Check that there is no horizontal scrolling at 320 px (SC-007).
  - Check in the accessibility tree that the total, voter counts, percentages, and summary are text, and the bar has a label.
  - Record the results in a "Results" section in `specs/007-state-voter-makeup/quickstart.md`.

---

## Dependencies & Execution Order

- **Overall**: Setup → Foundational (T002) → US1 → US2 → US3 → Polish.
- **US1**: T003 and T004 need T002 and T006 (the fixture reads `index.html`). T008 needs T005 and T006.
- **US2**: Builds on US1's wiring; T010 reviews the `main.js` calls from T008.
- **US3**: Builds on US1's markup and styles; T012 tunes the styles from T007.
- Within each story, write the tests before the implementation.
- Feature 008 depends on this feature: its builder calls `renderStateTotalsView()`.

## Parallel Opportunities

- US1: T003 and T004 (two test files), and T005, T006, T007 (three separate files) can be done together.
- Polish: T014 is independent of T013's run once the code is final.

## Implementation Strategy

1. **MVP**: Phases 1–3 deliver the statewide stat block.
2. Add US2 to lock in the matchup, edit, and new-map behavior with tests, then US3 for the side-by-side layout checks.
3. After each story run the full test page; stop and fix any regression before continuing.
4. When done, 008 can be implemented next.
