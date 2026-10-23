# Research: Flowing Summary Panels

Baseline measured at 1280 × 720 with 20 districts (from 011): column 476 × 636 and full; Statewide Voters 206 px tall at 772 wide, District Control 206 px at 476 wide, Legend 171 px at 1256 wide; picker 280 to 295, detail 122, Plan check 136, message area 46, gaps 8.

## R1. How to decide "fits"

**Decision**: Use the browser's own layout. Dock all three blocks, test whether the column overflows, and remove blocks from the end until it does not.

**Rationale**: Block heights depend on the column width, the font, the zoom, the number of sides and the picker's rows. Measuring the real result needs no formulas and cannot drift from what the user sees. The test is exact: the column's content either fits its box or it does not.

**Alternatives considered**:
- Pure CSS: cannot move a block to another place when it does not fit. Wrapping columns or hidden duplicates either break the page shape or show a block twice (FR-004).
- Estimating heights from constants: breaks on zoom, fonts and any later content change.
- Container height queries on each block: still cannot place the same block in two places.

## R2. The fit test per layout

**Decision**:
- `column` (workbench): the column has a fixed height and scrolls on overflow, so a set of blocks fits when `scrollHeight <= clientHeight` (1 px tolerance). Fitting the column also means fitting the window, since the column is inside it.
- `beside` (two columns): the column is as tall as its content, so a set of blocks fits when the column is no taller than the map plus the brush bar beside it, so the page never gets longer because of the dock.
- `none` (phones): nothing is docked.

**Rationale**: Each test is the literal meaning of "open space after the Plan check" in that layout, and neither needs the blocks' own sizes.

**Alternatives considered**: Compare each block's bottom to the window height. In `beside` the window is not the limit (the page scrolls anyway), so the map's height is the right limit.

## R3. Who knows which layout is active

**Decision**: Each layout sets a custom property on the layout element, `--dock: column`, `--dock: beside` or `--dock: none` (default). The script reads it with `getComputedStyle`.

**Rationale**: The breakpoints (760 px, 1240 px, 720 px, build mode) already live in the CSS. Duplicating them in script would let the two drift. Build mode and the error state also get `--dock: none` in CSS.

**Alternatives considered**: Re-checking `matchMedia` and container widths in script (duplicates the rules); reading the grid's column count (indirect, and cannot tell the workbench from the two-column layout).

## R4. Moving versus copying the blocks

**Decision**: Move the three existing sections. Docked: append them, in order, to the end of the column. Not docked: insert them, in order, before the help text in the layout.

**Rationale**: Exactly one copy exists (FR-004). The code that fills the blocks keeps working because it holds references to the same elements. Moving a node keeps its listeners and its state.

**Alternatives considered**: Rendering twice and hiding one (two copies, doubled work, screen readers could read both); a second set of markup (drifts from the first).

## R5. Order, focus and reading

**Decision**: Docked blocks go after the message area, which is after the Plan check, so the column order is picker, detail, Plan check, message area, Statewide Voters, District Control, Legend. The message area stays right under the Plan check because its space is reserved and must not move (011 FR-004). Below the map the blocks keep their old order, so the reading order among the three never changes. None of the three contains a focusable control, so the Tab order is unaffected; the test asserts it.

**Rationale**: Spec FR-011 asks that Plan check comes before the blocks and that the blocks stay in order; the message area is part of the Plan check group. The spec wording "directly under the Plan check" is read as "under the Plan check and its message area" (spec updated).

**Alternatives considered**: Putting blocks between Plan check and the message area (moves the reserved message area when blocks come and go, which breaks 011's "nothing moves").

## R6. Closing the gaps below

**Decision**: The script sets `data-docked` (0 to 3) on the layout. The grid areas below the map are chosen by it, in the two-column and workbench layouts:
- 0: `totals control` / `legend legend` (as now)
- 1: `control legend` (side by side)
- 2: `legend legend`
- 3: no row for them

**Rationale**: An empty named area leaves a zero-height row and an extra 8 to 12 px gap; removing the row removes the gap, so docking everything makes the page end sooner (spec SC-005).

**Alternatives considered**: Hiding empty rows with `display: none` on the blocks (they are not hidden, they are moved).

## R7. Compact style when docked

**Decision**: Docked blocks get tighter padding (8 × 10 px), smaller gaps and a smaller type size in rows, with the same content. The Legend's swatch rows pack into fewer lines where the column is wide enough. A docked block does not stretch (`flex: none`).

**Rationale**: At 476 px the existing styles give about 580 px for the three blocks. The open room is about 380 to 440 px at 1920 × 1080 and about 740 px at 2560 × 1440, so without compaction only one or two would fit at 1080. Compaction targets about 140 px, 140 px and 100 px (to be measured, final values recorded in "Final measured values" below at implementation).

**Alternatives considered**: Leaving sizes alone (fewer blocks fit, less benefit); collapsing or tabbing the blocks (changes content visibility, out of scope per the spec).

**Risk**: If the compact blocks still do not reach SC-001 (all three at 1920 × 1080 with up to 14 districts), SC-001 is changed to what was measured and the spec is updated, not the test loosened silently.

## R8. When the fit is re-run

**Decision**: A `ResizeObserver` watches the layout, the column, the picker, the detail, the Plan check, the message area and the three blocks. A `MutationObserver` watches the three blocks' contents (they re-render on every edit) and the app's class (build mode). Each callback runs one fit pass synchronously, guarded against re-entry. The pass starts from the same state it ends in whenever nothing changed, so it settles after one run.

**Rationale**: Running in the callback happens before paint, so there is no flicker. Watching content as well as size catches a block that grows while its place gives it the same height (for example at a different width).

**Alternatives considered**: `requestAnimationFrame` (one frame of wrong layout); polling (wasteful); listening only to `window.resize` (misses district count and text changes).

## R9. Interruptions

**Decision**: A fit pass only moves block elements, which contain nothing editable and no focus. Pointer capture and brush strokes live on the map, which is not touched. A block that holds focus is not moved (none can today; the pass skips moving if one ever does and retries on the next callback).

**Rationale**: Satisfies the spec's "edit in progress is not lost" rule (FR-006, scenario 2.4) by construction.

## R10. Previous-spec impact

**Decision**: 011's measured layout is untouched when no block docks (same boxes). A note is added to the 011 spec that the three blocks may now sit in the column. 011's tests that read "the blocks are below the screen" are changed to read "the blocks are not in the way": they pass in both places.

**Rationale**: The 011 spec said these blocks move below; this feature refines that.

## Final measured values

**Baseline before 012 (T001)**: full suite 158 passed, 0 failed. With 14 districts and no district selected:

| Window | Page scroll distance | Blocks start at | Column | Picker | Detail (no selection) | Plan check | Message area |
|---|---|---|---|---|---|---|---|
| 1920 × 1080 | 442 px | 1076 px | 1000 px | 223 px | 32 px | 136 px | 46 px |
| 1440 × 900 | 459 px | 896 px | 820 px | 223 px | 32 px | 136 px | 46 px |

The detail panel is 32 px tall with no selection and 122 px with one, so selecting a first district shifts the Plan check down by 90 px. 012 reserves the selected height up front (see T011) so the docked blocks do not jump when a district is picked.

**After 012** (brush on, district 1 selected; the detail panel is now 123 px with or without a selection):

Docked heights of the compact blocks at 476 px wide: Statewide Voters 119 px, District Control 102 px, Legend 113 px (before: 206, 200 and 201 when docked uncompacted, 206, 206 and 171 below the map).

| Window | 8 districts | 14 districts | 20 districts | Page scroll distance (14 districts) |
|---|---|---|---|---|
| 1280 × 720 | 1 | 0 | 0 | 475 px (unchanged) |
| 1366 × 768 | 1 | 0 | 0 | 459 px (unchanged) |
| 1440 × 900 | 3 | 2 | 1 | 245 px (was 459) |
| 1536 × 864 | 2 | 1 | 1 | 275 px (was 459) |
| 1920 × 1080 | 3 | 3 | 3 | 49 px (was 442), only the help text and notice are left below |

SC-001 is met without revision: at 1920 × 1080 all three blocks are beside the map for 8, 14 and even 20 districts. Choices that differ from the plan: the module watches the plan check, picker, detail and message area with a mutation observer as well (content changes re-flow at once, before the next paint), while resize notifications are handled on the next frame; and the unselected detail keeps the selected height so the blocks do not jump when the first district is picked. Browsers cache `styles.css` and the modules, so a normal reload may show old behavior until a hard reload.
