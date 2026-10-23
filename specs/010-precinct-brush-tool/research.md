# Research: Precinct Building Blocks and Brush Selection Tool

All unknowns from the plan are settled below. Measurements come from short probes in the browser test page against the current 009 code, with 2 cities and a 600,000-voter baseline, on a busy development machine (timings are relative, not targets).

## R1. Making the grid sampler fast enough for 800 seeds

**Decision**: `sampleGrid` and `voronoiCells` find the nearest seed(s) through a coarse bucket lookup instead of scanning every seed for every cell. `sampleGrid` buckets the seeds into square buckets about the average seed spacing wide, then, for each cell, searches the cell's bucket ring outward until the best distance found is no larger than the distance to the ring's edge. `voronoiCells` clips each cell against seeds in order of distance and stops once the next seed is farther than twice the cell's farthest vertex.

**Rationale**: Today every cell checks every seed (cells × seeds). With 100 seeds this was cheap; with 650–800 seeds a 2 px grid layout took 1.3–2.9 s per attempt in the probe, and a random state may need several attempts. The lookup makes the cost close to the number of cells, independent of the seed count. The result is identical to the full scan (the nearest seed is the nearest seed), so the lookup is verified by comparing it against the old scan in a test.

**Alternatives considered**:
- Keep the full scan and accept 2 s or more per attempt: fails SC-010.
- A Delaunay or Fortune sweep: more code and a new algorithm to get right; the bucket lookup is about 30 lines.

## R2. A finer grid for layout checks, the existing grid for badge placement

**Decision**: Layout statistics (areas, neighbors, piece check, centroids) are measured on a 2 px grid (`LAYOUT_CELL_SIZE = 2`). The `state.grid` that the badge-placement code reads stays at 4 px, produced by one extra sampling pass after the layout is accepted. Relaxation keeps its coarse 8 px grid.

**Rationale**: At 650 units the 4 px grid rejected 11 of 12 layouts in the probe; the cause was precincts whose cells split into more than one piece along the state border. With a 2 px grid only 0 to 2 precincts per layout failed the check and 7 of 12 layouts passed every gate (size gate included). The 4 px badge grid is used on every district edit (`attachLabelPoints`), and a 2 px grid would make it four times slower for no visible gain, so the two grids are kept separate.

**Alternatives considered**:
- Use 2 px everywhere: slows every edit and every brush step.
- Keep 4 px and discard layouts that fail: pass rate near zero at 650+ units.

## R3. Piece check in one pass, with a seed nudge as the fallback

**Decision**: `countGridComponents` is replaced by `pieceCounts(grid, count)`, which labels connected cells for every precinct in one scan and returns the number of pieces per precinct (0 for a precinct with no cell). A layout is rejected if any precinct has other than one piece. If the first measurements still show too many rejections, a repair step moves a failing seed a few pixels toward the largest piece of its cell and re-samples (at most three times) before the layout is dropped.

**Rationale**: The current check rescans the whole grid for each precinct: 650 precincts × 30,000 cells. One scan over the grid does it. A precinct split by a narrow part of the outline is rare at 2 px; the repair step is held back until the probe numbers say it is needed, so it is recorded as a task with a measured trigger (fewer than 60% of layouts passing the piece check).

**Alternatives considered**: Allowing a precinct to be two pieces: breaks the single-polygon drawing and the "one hover target" rule.

## R4. Gates and constants that must be re-tuned

**Decision**: Re-tune, in this order, against the 100-seed and 100-plan batches already used in 009: 
- `MIN_CLICKABLE_AREA`: from 160 px² down to about 30 px² (a precinct at least about 5 × 6 px on the 800 × 600 map). The probe's smallest precincts were at the grid limit, so the starting point is 30 and the final value is recorded in the results. Every precinct stays reachable by keyboard whatever its size (FR-008).
- `RELAX_PASSES`, `RELAX_EXPONENT`, `MAX_FIELD_WEIGHT`, seed spacing in `placeSeeds`: so crowded places get small precincts without any dropping below the limit, and the gate pass rate stays high.
- Size gate (`SIZE_RATIO_LIMIT`, rank correlation, type ordering): with ten times more samples the rank correlation is steadier, so the limits may be tightened.
- `skewedVoterWeights` caps and the spread gate (`topShare`, `medianToMean`, `MAX_COUNTY_SHARE` renamed `MAX_PRECINCT_SHARE`): these measure shares of the whole state, so they should transfer, and the floor, the cap and the lognormal width are only touched if the batches fail.
- City voter spreading (`CITY_CORE`, `CITY_COUNTY_CAP` renamed `CITY_PRECINCT_CAP`): re-checked so no precinct takes more than a share of an ideal district.

**Rationale**: These constants were fitted to about 100 counties; the spec's rules are unchanged (denser precincts are smaller, type thresholds, 80% lean rule, balanced plan possible, total = baseline + city populations), so the gates stay and only the numbers move. Rejecting and redrawing stays the mechanism.

**Acceptance for tuning** (measured, recorded in this file under "Final tuned values" when done): all 100 random seeds and 100 custom plans build; the slowest random state under 2 s; the density-to-area rank correlation and decile ratio at least as strict as in 009; at least 80% of urban precincts lean to the urban side and 80% of rural to the other under Democrats vs Republicans.

## R5. Precinct and district counts

**Decision**: Random states draw a precinct count from 500 to 800 and keep today's 8–20 districts. Custom states use `precinctCountFor(cities) = min(800, 500 + 25 × cities)` and `districtCountFor(count) = round(count / 50)`, which gives 10 to 16 districts, as the old rule (`count / 8` on 90–120 counties) gave 11 to 15.

**Rationale**: It keeps custom builds at the cheaper end when there are few cities, and keeps district sizes at 25 to 100 precincts, which a visitor can draw with the brush in a few strokes. The 10,000-voter balance limit is kept: districts average about 50,000 voters, so the limit stays a meaningful 20%-of-average-wide band, and precincts of 1,000 to 5,000 voters make it reachable.

**Alternatives considered**: Scaling the balance limit with precinct size: the spec keeps the limit unchanged.

## R6. What the brush covers

**Decision**: A precinct is covered when its **center** lies inside the circle (spec assumption). The center is the centroid of the precinct's grid cells, stored as `precinct.center`, rounded to one decimal. A drag segment from `a` to `b` covers precincts whose center is within the radius of the segment (a capsule); a click, tap or Enter is a segment with `a = b`.

**Rationale**: The seed point is not used because relaxation leaves it close to, but not at, the center. Using capsules rather than stepping circles along the path means a fast drag cannot skip a precinct between two pointer events, and it makes the result independent of the pointer event rate.

## R7. Stroke algorithm

**Decision**: `applyBrushSegment(state, plan, selected, mode, segment, radius, ctx)` works on a copy of the assignments and returns the new assignments plus the covered ids; the caller builds the next state once. For each segment:
1. `covered` = ids with centers inside the capsule, ordered by distance along the segment (start to end), then by distance to the segment, then by id.
2. **Add mode**. If the selected district is empty (no member yet), the first candidate is the covered precinct nearest the segment start; it is added. Then repeat passes over the remaining covered precincts in order until a pass changes nothing. In each pass a precinct is applied when (a) it is not already in the selected district, (b) it touches a precinct currently in the selected district, and (c) if it belongs to another district, that district stays contiguous (or empty) without it.
3. **Erase mode**. Repeat passes over covered precincts that belong to the selected district; a precinct is removed when the selected district stays contiguous (or becomes empty) without it. Passes repeat until nothing changes, so a precinct that would have split the district at first can go once its neighbors were removed.
4. The plan checks reuse `isContiguous`-style tests on the working copy (adjacency from `precinct.neighbors`).

**Rationale**: This is the single-click rule applied precinct by precinct, so a stroke can never do what a click could not. Multiple passes matter because adding one precinct makes its neighbors reachable. The order is fixed, so the same stroke on the same plan always gives the same plan (FR-024). The cost per pass is the covered count times a connectivity test on at most one district, which is a few thousand operations.

**Alternatives considered**:
- One pass only: a stroke across a gap would leave arbitrary holes depending on order.
- Applying everything then repairing: could end in an invalid plan midway and needs an undo path.

## R8. The stroke summary

**Decision**: A stroke keeps the plan at press, the union of covered ids, the selected district and the mode in effect when it started (Shift flips it for that stroke). At release, outcomes are decided by comparing before and after: **added** (no district → selected), **moved** (another district → selected), **removed** (selected → none), **unchanged** (already in the target state: in the selected district in add mode, or not in it in erase mode), and **skipped** for every other covered precinct. Skipped ones get a reason by the last check they failed: `not-adjacent`, `splits-source` (another district) or `splits-selected`. The message names the counts and the most common reason, for example "Added 42 precincts, moved 3, skipped 5 that would split a district." If nothing changed it says so ("No precincts were changed: none of the 12 under the brush can be added without splitting a district."), and if the capsule had no precinct center it says "No precincts under the brush."

**Rationale**: The diff makes added + moved + removed + unchanged + skipped equal to the number of covered precincts by construction (SC-008), regardless of how many segments the drag had or whether a precinct was skipped early and applied later.

## R9. When strokes are committed and drawn

**Decision**: Pointer moves are queued and processed once per animation frame: the queued positions become one capsule chain (each capsule from the previous processed point), the assignments are updated in one batch (`reassignPrecincts`), and the state, map and panels are redrawn once. While a drag is in progress, tooltips, the hover reveal and the precinct highlight are off. If the measured step cost is above 50 ms at 800 precincts, `summarizeDistricts` gets an option to skip badge placement during a drag, with badges placed once at release.

**Rationale**: Redrawing per pointer event is wasteful on high-rate mice. One redraw per frame keeps the drag smooth, and the release redraw is the one the 250 ms requirement is about. Badge placement is the most expensive part of a summary, and nothing else needs it mid-drag.

## R10. Renaming county to precinct

**Decision**: Rename everywhere, in this order: generator and custom-state; districts and formatters; main and UI modules; HTML and CSS; tests. Identifiers follow the pattern `county` → `precinct`, `counties` → `precincts`, `countyIds` → `precinctIds`, `countiesById` → `precinctsById`, `data-county-id` → `data-precinct-id`, `.county` → `.precinct`, ids `c001` → `p001`, `COUNTY_RANGE` → `PRECINCT_RANGE`. A final grep over `src`, `tests`, `index.html` and `styles.css` for `count(y|ies)` must find only the historical notes that name earlier features.

**Rationale**: Code that calls precincts "counties" invites mistakes (the counts, sizes and rules are different now), and the spec requires the words to be gone from everything visible. A grep gate makes completeness checkable. The cost is wide but mechanical, and the existing tests catch a missed rename as a failure.

**Alternatives considered**: Rename only the visible text: smaller diff, but the code would contradict the product for good.

## R11. Names, and what a district's details list

**Decision**: Precinct names are unique and fictional, built from the existing 64 base words and 11 suffixes (704 combinations), then with the cardinal words North, South, East, West appended to extend beyond them (more than 2,800). The `County` word is dropped; the details subtitle says "Precinct voters". District details list at most 8 names (alphabetical) followed by "and N more", and `formatDistrictDetails` still returns the full sorted list for tests and for assistive text.

**Rationale**: 500–800 unique names are needed; plain numbering would be unreadable in a pop-up. A district can hold 100 precincts, which would produce a pop-up taller than the screen.

## R12. Keyboard: one tab stop and arrow navigation

**Decision**: Only one precinct has `tabindex="0"` at a time (a roving tab stop; the others are `-1`). Arrow keys move focus to the neighboring precinct whose center lies best in that direction (smallest angle to the arrow, then the smallest distance). Enter or Space applies the click or the brush at the focused precinct, as today. With the brush on, Enter applies a one-position stroke centered on the focused precinct's center, with Shift flipping add/erase. Escape turns the brush off first, and a second Escape stops editing the district.

**Rationale**: 800 tab stops would make the keyboard path unusable (SC-009, SC-011). The roving pattern is standard and keeps every precinct reachable.

## R13. Where the brush controls go, and what the size means

**Decision**: A "Brush" section sits in the side panel above the control total. It is shown in view mode (hidden while building a state); when no district is selected its controls are disabled and a line says to pick a district's pen first. Controls: a toggle button (`aria-pressed`), an Add/Erase pair of radio buttons, and a size range slider (10 to 150, step 5, default 50) with a live value. The size is the circle's radius in map pixels; the circle is drawn in map coordinates so it scales with the map. At default, the circle is about 100 px across, and the largest radius gives a circle 300 px across (the spec asks for a quarter of the state's width, about 150 px, at least).

**Rationale**: Always visible but disabled matches FR-013; being near the map and the district list keeps the tool where the work is. A radius of 10 px covers about 1 to 3 precincts at typical sizes (the average precinct is about 25 px across in the probe).

## R14. District borders between very small precincts

**Decision**: `precomputeEdges` keeps using shared Voronoi edges, but the bisector tolerance is reduced and a test checks that for every pair of neighboring precincts in different districts a border segment exists. If the check finds gaps, shared edges are found by matching polygon vertices instead of by the bisector test.

**Rationale**: The 1 px tolerance was written for counties dozens of pixels across; on precincts about 25 px across (and as small as 5 to 6 px) it could pick a wrong short edge. The test catches it either way.

## R15. Touch

**Decision**: While the brush is on and a district is selected, the map gets `touch-action: none`; pointer capture is taken on press so a drag keeps reporting if the pointer leaves the map; `pointercancel` ends the stroke like release. The page scrolls normally with the brush off.

**Rationale**: Without `touch-action: none` the browser takes the drag for scrolling and cancels the stroke.

## R16. Test strategy

**Decision**: Unit tests of `brush.js` on generated states (coverage, add, move, erase, empty-district seeding, determinism, the summary adds up, no district ever split, randomized strokes for 200 random seeds). UI tests drive the real map: circle follows the pointer and resizes with the slider, click and drag apply, Shift flips mode, Escape order, keyboard Enter, a disabled panel when no district, no "county" text anywhere in the page (a text walk), and a touch-style pointer sequence. Generation tests re-run the 100-seed and 100-plan batches. Timing assertions keep the 2 s limit but are re-run when the machine is quiet if they flake under load.

## Rename inventory

Lines matching `count(y|ies)` (case-insensitive) before the rename, 671 in total:

| File | Lines |
|------|-------|
| `src/state-generator.js` | 63 |
| `src/ui/map-view.js` | 81 |
| `src/districts.js` | 40 |
| `src/main.js` | 32 |
| `src/formatters.js` | 22 |
| `src/custom-state.js` | 17 |
| `src/ui/` (control-total, district-list, legend, plan-status, state-totals, tooltip) | 8 |
| `index.html`, `styles.css` | 3, 8 |
| `tests/ui.test.js` | 174 |
| `tests/custom-state.test.js` | 70 |
| `tests/districts.test.js` | 58 |
| `tests/state-generator.test.js` | 58 |
| `tests/matchups.test.js` | 25 |
| `tests/size-helpers.js` | 12 |

## Final tuned values

Measured on the finished code, in the browser test page and the app, on a busy development machine.

**Geometry (700 seeds, 2 px layout grid)**: `sampleGrid` 5 ms (was about 2 s with the full scan), `voronoiCells` 9 ms, `pieceCounts` 3 ms, `gridStats` 2 ms. Outputs are identical to the plain scans (tests in `tests/geometry.test.js`).

**Constants**:
- `PRECINCT_RANGE` 500–800; `LAYOUT_CELL_SIZE` 2 (areas, neighbors, pieces) and `GRID_CELL_SIZE` 4 (badge grid, sampled once after a layout is accepted).
- `MIN_CLICKABLE_AREA` 30 px² (the smallest precinct measured over 100 seeds was 32 px²).
- The seed nudge of R3 **was needed**: without it 71 of 89 rejected layouts failed the piece check. `PIECE_REPAIRS` is 4 rounds, each pulling a split precinct's seed halfway to its main body. Eight rounds did not help the hardest plan and cost time.
- Seeds are kept to one decimal, so `seedPoint` equals the seed the layout was measured with.
- Neighbors are now precincts whose drawn cells share an edge of at least 0.5 px, not whatever the grid says; ten grid-adjacent pairs per state touched only at a corner.
- `LEAN_AMPLITUDE_RURAL` 0.10 → 0.09: the smallest voter tier's side B share was 0.802 (limit 0.8) and is now about 0.79. The urban 80% rule is unaffected (83.6% of urban precincts vote for side A).
- Unchanged from 009: `RELAX_PASSES` 10, `RELAX_EXPONENT` 2.5, `MAX_FIELD_WEIGHT` 19, `SIZE_RATIO_LIMIT` 0.32, the rank-correlation limit −0.84, the spread gates and caps.
- Speed work in the generator: seed spacing checks use buckets and the cheap weight test runs before the outline test; the outline test is a raster lookup (`createInsideTest`); the balance step checks connectivity locally.

**Random states (100 seeds)**: all build; median 167 ms, p95 528 ms, slowest 1.1 s (the in-test slowest was 671 ms); 1.3 attempts per state on average; weakest density-to-area correlation −0.92 and worst decile ratio 0.30 (limits −0.84 and 0.32); every precinct one piece when re-measured from its reported seed.

**Custom plans (100 plans of 0–12 cities)**: 99 build. Plan 38 (12 cities on an awkward outline) fails after 20 attempts: its layouts keep failing the piece and area checks. The test allows up to 2 failures, as the 008 and 009 tests did; the builder shows its existing "can't make a map that splits into fair districts" message for such a plan. Build time: median 143 ms, p95 599 ms, slowest 878 ms (so a city change redraws well under the 1.5 s limit).

**Brush (768 precincts)**: a click with the largest circle (301 precincts covered) 19 ms including the summary; one drag step with the full redraw (plan, list, totals, badges) 32–64 ms, typically 37 ms, under the 50 ms budget, so the badge-skipping option of R9 was not needed (the drag code still builds all queued segments with badges off and places the badges once per frame); a drag of 40 samples applied in one frame 93 ms; the release redraw 12 ms.

**New map (10 in a row, in the app)**: 110–305 ms each.
