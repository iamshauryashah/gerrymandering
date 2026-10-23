# Contract Changes: Feature 011

Layout and presentation changes. Behavior, data, rules and links are unchanged (spec FR-021). Anything not listed keeps its 010 meaning.

## Markup (`index.html`)

The page content element keeps its container role and holds one layout element whose direct children are, in this order (each has a `data-role` and a grid area of the same name):

| Order | Element | Area | Notes |
|-------|---------|------|-------|
| 1 | Top bar: `h1`, state caption, toolbar (matchup toggle, New map, Build a state) | `top` | `h1` text unchanged; `data-role="state-caption"`, `matchup-toggle`, `new-map`, `build-state` unchanged |
| 2 | Panels column `[data-role="panels"]` | `panels` | Wraps the next five items |
| 2a | Builder `[data-role="builder"]` | (in panels) | Unchanged, hidden unless building |
| 2b | District picker `section.districts` with `[data-role="district-list"]` | (in panels) | The list is now a tile grid; the heading is visually hidden (still present); the old hint paragraph moves to the secondary area |
| 2c | District detail `[data-role="district-detail"]` | (in panels) | NEW; contains `[data-role="editing-status"]` (moved here, same attributes) |
| 2d | Plan status `[data-role="plan-status"]` | (in panels) | Unchanged element and content, compact rows |
| 2e | Message slot `.message-slot` around `[data-role="edit-message"]` | (in panels) | Fixed height; the element still toggles `hidden` |
| 3 | Brush bar `[data-role="brush-tool"]` | `brush` | A one-row bar; all inner `data-role`s unchanged (`brush-toggle`, `brush-mode`, `brush-size`, `brush-size-output`, `brush-hint`, `brush-message`) |
| 4 | Map `figure.map-frame` with `[data-role="map"]` and the error block | `map` | Unchanged |
| 5 | State totals `[data-role="state-totals"]` | `totals` | Secondary |
| 6 | Control total `[data-role="control-total"]` | `control` | Secondary |
| 7 | Legend `[data-role="legend"]` | `legend` | Secondary |
| 8 | Hint paragraph (moved out of the picker) | `hint` | Same text |
| 9 | Notice `[data-role="notice"]` | `notice` | Same text |

All existing `data-role` names keep working. `.map-side` and the old nested wrappers are removed.

## Layout (`styles.css`)

- Container: the page content element keeps `container-type: inline-size`; the layout element is its child.
- Workbench: `@media (min-height: 720px) { @container (min-width: 1240px) { … } }` on the layout element when the page is not in build mode. The layout element is one window tall (`100vh`, then `100dvh`) for the first three rows; the panels column is 400 px (440 px from 1600 px); the map frame fills its cell and the SVG keeps its 4:3 shape (`width: 100%; height: 100%`).
- Two columns: `@container (min-width: 760px)`, and also in build mode at any larger width.
- One column: the default.
- The brush bar and panels have fixed heights in the workbench; no rule changes a box's size when a message appears.
- `.is-building` turns the workbench off; its existing rules hiding the picker, plan status, brush bar and control total stay.
- Tiles: `.district-list` is a grid (4 columns in the workbench panel column, 5 from 1600 px, 3 elsewhere); `.district-row` keeps its class, `data-district`, `data-status`, `.selected`, `tabindex`, and its children `.swatch`, `.district-name`, `.district-status`, `.district-balance`, `.pen`.
- The old `.districts`, `.map-side` and `@container (min-width: 760px)` two-column rule are replaced by the layouts above.

## District list (`src/ui/district-list.js`)

- Rendering: `.swatch` shows the number on the district color; `.district-name` still holds "District N" (visually hidden in tiles, so text search and accessible names are unchanged); `.district-status` shows the leader with margin using the side short names; `.district-balance` shows the status symbol and words plus the amount on its own line, as `balanceLabel` builds it ("Too large +4,210", "Too small −1,860", "Within range", "Empty") with a leading symbol.
- Unchanged: events (`onPenToggle`, `onDistrictEnter`, `onDistrictMove`, `onDistrictLeave`), `getRow`, `getPen`, `aria-label`, `aria-pressed`.
- `balanceLabel` is exported as before; a new exported `balanceSymbol(balance)` returns `○`, `▼`, `●` or `▲`.

## District detail (`src/ui/district-detail.js`, new)

`renderDistrictDetail(container, { district, balanceInfo, balance, matchup, editing })`:
- `district` is `state.districts[n - 1]` or null when none is selected; `balanceInfo` is the matching entry of `getBalance(state).districts`; `balance` is the whole balance result (`lower`, `upper`, `ideal`).
- Renders into `container` (keeping the `editing-status` element it already contains): a heading with the district number and status; rows for leading side and margin, voters, allowed range and distance from it, precincts, and connected.
- With `district` null: renders the prompt "Pick a district's pen to edit it and see its status here."
- Exports `describeDistrict(district, balanceInfo, balance, matchup)` returning the row text so tests can compare without reading the DOM.

## Plan status (`src/ui/plan-status.js`)

Same content and same `data-key` values; the rows are laid out in two columns by CSS. `describePlan` unchanged.

## Matchups (`src/matchups.js`)

Each side gets `shortName` (`Dem`, `Rep`, `Soc`, `Lib`, `Pur`, `Org`). Existing fields are unchanged.

## Main (`src/main.js`)

- Calls `renderDistrictDetail` with the other district views (in `renderDistrictViews`), and renders the prompt when no district is selected.
- `renderEditingStatus` writes into the detail's `editing-status` element (same text, hidden when not editing, same live-region behavior).
- No other behavior changes.

## Map view (`src/ui/map-view.js`)

Programmatic focus from arrow keys uses `focus({ preventScroll: true })`; no other change.

## Tests

- `tests/layout.test.js` (new, group `layout`): loads `../index.html?seed=…` in same-origin iframes of exact sizes; helpers: `openPage(width, height, seed)`, `rect(frame, selector)`, `insideWindow(rect, frame)`, `seedWithDistricts(count)`.
- `tests/groups.json`: new group `layout` with `files: ["layout.test.js"]`, `covers: ["src", "index.html", "styles.css"]`.
- `tests/ui.test.js`: updated where it read old positions (the side column, the stat block above the control block, the district list rows' text, the editing status line's place); new tests for the district detail and the tile content.
