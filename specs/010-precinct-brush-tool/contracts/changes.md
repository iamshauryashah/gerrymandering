# Contract Changes: Feature 010

Everything here is a rename or an addition to the 009 contract unless it says "behavior". Names that are not listed keep their 009 meaning.

## Renames (all modules, tests, HTML, CSS)

| Before | After |
|--------|-------|
| `state.counties`, `state.countiesById` | `state.precincts`, `state.precinctsById` |
| `county` objects, id `c001` | `precinct` objects, id `p001` |
| `district.countyIds` | `district.precinctIds` |
| `COUNTY_RANGE` `{ min: 90, max: 120 }` | `PRECINCT_RANGE` `{ min: 500, max: 800 }` |
| `MAX_COUNTY_SHARE`, `CITY_COUNTY_CAP` | `MAX_PRECINCT_SHARE`, `CITY_PRECINCT_CAP` |
| `generateState({ countyCount })`, `buildLayout({ countyCount })` | `precinctCount` |
| `assembleCounties` | `assemblePrecincts` |
| `countyCountFor`, `districtCountFor(countyCount)` | `precinctCountFor`, `districtCountFor(precinctCount)` |
| `reassignCounty`, `applyCountyEdit`, `getEditAction(state, countyId, ...)` | `reassignPrecinct`, `applyPrecinctEdit`, `getEditAction(state, precinctId, ...)` |
| `formatCountyDetails`, `formatDistrictDetails(district, countiesById, ...)` | `formatPrecinctDetails`, `formatDistrictDetails(district, precinctsById, ...)` |
| `getStatewideResult(counties)`, `formatStatewideMakeup(counties, ...)` | `(precincts)` |
| map view callbacks `onCountyEnter`, `onCountyMove`, `onCountyLeave`, `onCountyActivate` | `onPrecinctEnter`, `onPrecinctMove`, `onPrecinctLeave`, `onPrecinctActivate` |
| `app.editCounty`, `app.assignCounty` | `app.editPrecinct`, `app.assignPrecinct` |
| map DOM: class `county`, `data-county-id`, layer `data-role="counties"`, `county-highlight` | `precinct`, `data-precinct-id`, `precincts`, `precinct-highlight` |
| inspected type `'county'` | `'precinct'` |

User-visible words change the same way: "county" and "counties" become "precinct" and "precincts" in the map's labels, details pop-up ("Precinct voters", "This precinct is not in any district yet."), the district list's labels, the plan status ("Precincts with no district"), the control total ("Unassigned precincts"), the caption, the legend note, the help text and the page notice. The rename is complete when a search of `src/`, `tests/`, `index.html` and `styles.css` for `count(y|ies)` finds nothing outside historical comments naming earlier features.

## Geometry (`src/geometry.js`)

- `sampleGrid(outline, points, cellSize, width, height)`: same result as before, found through a nearest-seed bucket lookup (research R1).
- `voronoiCells(points, width, height)`: same result as before, found by clipping against nearby seeds first.
- `pieceCounts(grid, count)`: returns an `Int32Array` of the number of connected pieces per precinct (0 when a precinct has no cell). `countGridComponents` stays exported for the tests that compare the two.
- `gridStats(grid, count)`: also returns `centers` (the existing `centroids`, kept under both names during the rename, then `centers` only).

## State Generator (`src/state-generator.js`)

- `PRECINCT_RANGE`; `LAYOUT_CELL_SIZE = 2`; `GRID_CELL_SIZE = 4` is the badge grid; `MIN_CLICKABLE_AREA` is lowered (final value in research); other constants re-tuned (research R4).
- `generateNames(random, count)`: unique names for up to 800 precincts (research R11), no trailing "County".
- Each precinct has `center`.
- `generateState({ seed, precinctCount, districtCount })`: `precinctCount` 500 to 800, default a random value in that range; the same seed still gives the same state.
- Behavior: every state has 500–800 precincts; all other 009 guarantees hold (totals, density types, size gate, lean rule, balanced plan possible, one-piece precincts).

## Custom State Module (`src/custom-state.js`)

- `precinctCountFor(cityTotal)` is `min(800, 500 + 25 × cityTotal)`; `districtCountFor(precinctCount)` is `round(precinctCount / 50)`.
- `encodeCustomCode`, `decodeCustomCode`, `getCustomCodeFromUrl`: unchanged; `v1` and `v2` links still open (spec FR-011) and now build a precinct layout.
- `buildCustomState(plan)` and `applyVoterSettings(state, settings)`: renamed fields only.

## Districts (`src/districts.js`)

- Renamed functions as in the table above; behavior is unchanged.
- `reassignPrecincts(state, changes, { labels = true } = {})`: **new**; `changes` is an object of precinct id to district number or `null`; applies them all and summarizes once. With `labels: false` badge placement is skipped (a drag in progress, research R9).
- `summarizeDistricts(state, { labels = true } = {})`: the option is new.

## Brush Module (`src/brush.js`, new, pure)

- `BRUSH_SIZE = { min: 10, max: 150, step: 5, default: 50 }`, `BRUSH_MODES = ['add', 'erase']`.
- `precinctsInCapsule(state, a, b, radius)`: ids of precincts whose `center` is within `radius` of the segment from `a` to `b`, ordered along the segment, then by distance, then by id.
- `startStroke(state, { district, mode, radius })` returns a stroke.
- `applySegment(state, stroke, a, b)` returns `{ state, stroke }`: applies the stroke rules for one segment (research R7) and returns the next state and the updated stroke. It never leaves a district disconnected.
- `finishStroke(state, stroke)` returns `{ added, moved, removed, unchanged, skipped, covered, reasons, changed, message }` (research R8).
- `strokeAt(state, { district, mode, radius }, point)` is a convenience for a click or key press: `startStroke`, one `applySegment` with `a = b`, `finishStroke`.

## Formatters (`src/formatters.js`)

- `formatDistrictDetails` returns `precinctCount`, `precinctNames` (full sorted list) and `precinctList` (at most 8 names followed by "and N more"); the subtitle reads "N precincts" or "1 precinct", and an empty district "No precincts assigned".

## Map View (`src/ui/map-view.js`)

- Options: the renamed precinct callbacks plus `onStroke(event)`, called with `{ type: 'start' | 'move' | 'end' | 'cancel' | 'tap', point, shiftKey }` (`tap` is a keyboard Enter on a focused precinct, with `point` its center).
- Methods: `setBrush({ active, radius, mode })` shows or hides the circle, sets its size and its add/erase look; the circle follows the pointer over the map and is hidden when the pointer leaves it.
- DOM: the circle is `<circle class="brush-circle" data-role="brush-circle" aria-hidden="true">` in its own layer above the district borders; `data-mode` is `add` or `erase`.
- Behavior: with the brush active, a click on the map does nothing by itself (the stroke already handled the press); pointer capture is taken on press; `touch-action: none` is set on the map; hover details, highlight and district reveal are off during a drag.
- Roving tab stop: exactly one precinct has `tabindex="0"`; arrow keys move focus (research R12).

## Brush Panel (`src/ui/brush-panel.js`, new)

`createBrushPanel(root, { onToggle, onMode, onSize })` and `render({ available, on, mode, size })`. Markup under `[data-role="brush-tool"]`:

- `[data-role="brush-toggle"]`: button with `aria-pressed`; disabled when `available` is false.
- `[data-role="brush-mode"]`: two radio inputs named `brush-mode` with values `add` and `erase`.
- `[data-role="brush-size"]`: range input 10–150, step 5, with `<output data-role="brush-size-output">`.
- `[data-role="brush-hint"]`: "Pick a district's pen to use the brush." when unavailable, otherwise a short usage line.
- `[data-role="brush-message"]`: `role="status"` area for stroke summaries.

## Main (`src/main.js`)

- `app.brush` as in the data model; `app.stroke` while a stroke is running.
- Escape: the brush turns off first; a second Escape stops editing the district (as before). Deselecting a district turns the brush off.
- A stroke's message appears in `[data-role="brush-message"]`; blocked single clicks keep using `[data-role="edit-message"]`.
- Window test hooks (`window.gerryApp`) add `setBrush`, `strokeAt`, and `dragBrush(points)` so tests can drive strokes without a real pointer.
- Opening a new state or a link resets `size` and `mode` to their defaults and turns the brush off.

## Page (`index.html`, `styles.css`)

- New section `[data-role="brush-tool"]` in the side panel above the control total; hidden while building a state.
- Updated help text: "Click a pen, then click precincts on the map, or turn on the brush and paint many at once. Districts must stay connected, and the largest district may have at most 10% more voters than the smallest."
- Styles for the brush panel, the circle (solid outline for add, dashed for erase), a visible focus ring on precincts, and `touch-action` while the brush is active.
