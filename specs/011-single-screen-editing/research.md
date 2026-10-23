# Research: Single-Screen District Editing

Measurements come from the current page at 1440 × 800 in headless Chrome (before this feature): the page is 2,025 px tall; the map spans 237–924 px, the plan status starts at 1,013 px, and the district list starts at 1,684 px. The side column alone is 1,350 px tall (brush 294, state totals 223, control total 219, plan status 304, legend 246).

## R1. Three layouts chosen by window size, in CSS only

**Decision**: Three layouts of the same markup, chosen with CSS conditions and no script:
- **Workbench** (one screen): page content at least 1240 px wide **and** window at least 720 px tall, and not while building a state. Written as `@media (min-height: 720px) { @container (min-width: 1240px) { … } }`, where the container is the existing page-content element.
- **Two columns** (scrolling allowed): content from 760 px wide, and the workbench's size is not met (short windows, laptops under 1240 px, tablets, and the builder). This is today's arrangement, kept for those windows.
- **One column** (scrolling allowed): narrower than 760 px, including phones.

**Rationale**: The spec's boundary is a window at least 1280 × 720. A 1280 px window leaves about 1248 px of content after the page's side padding and a scrollbar, so the container threshold is 1240 px. The existing tests mount the app in a 1200 px box inside a larger window; a container query keys off that box, so those tests keep seeing the two-column layout and stay meaningful, while the viewport-height half of the condition is a media query because container queries cannot see the window's height. No script measures anything, so resizing and zooming re-flow by themselves (FR-019).

**Alternatives considered**:
- A script that reads the window size and sets a class: extra code, flashes on load, and the tests would need the same script.
- Viewport media queries only: the test box would be treated as a full-size window.

## R2. One flat set of sections arranged with named grid areas

**Decision**: The page's sections become direct children of one grid element (inside the existing container): `top` (title, caption, toolbar), `panels` (a column holding the builder, picker, detail, plan status and message slot), `brush` (the brush bar), `map`, then the secondary sections `totals`, `control`, `legend`, `hint` and `notice`. Each layout is a `grid-template-areas` map over those names. DOM order is `top`, `panels`, `brush`, `map`, then the secondary sections, so keyboard focus runs picker, brush, map, rest (FR-020) in every layout.

**Rationale**: The same markup then serves all three layouts, there is nothing to keep in sync, and screen readers and tests find the same elements everywhere. The panels share one wrapper so the right column can be sized and scrolled as a unit.

**Alternatives considered**:
- Duplicating sections per layout: doubles ids and event code.
- Moving elements with script on resize: fragile, loses focus and scroll state.
- `display: contents` on the old nested wrappers: works, but leaves the old nesting that no longer matches the layout.

## R3. The map takes what is left, with its shape kept

**Decision**: In the workbench the page is exactly one window tall (`100dvh`, with `100vh` first for older browsers). Rows are: top bar (about 52 px), the map row (all remaining height), and the brush bar (about 56 px). The map's frame fills its cell, and the SVG scales to fit inside it keeping its 4:3 shape. The right column is a fixed 400 px (440 px from 1600 px wide) and spans the map and brush rows.

**Rationale and numbers** (1280 × 720): page padding 12 px; top bar 52; brush bar 56; two 8 px gaps. The map cell is 572 px tall and 848 px wide, so the map frame is 757 × 572 (433,000 px², 47% of the window) and the map itself 741 × 556 (45%). At 1366 × 768 it is about 51%, at 1920 × 1080 about 58% (the frame is 1,263 × 948 with a 440 px column), and the share keeps rising above that. These clear the spec's 40% floor, the 560 × 420 minimum, and 800 px wide at 1920. The map is also the largest item by area at every size, because the right column's three panels split a 636 × 400 box.

**Alternatives considered**:
- A narrower right column (320 px) for a bigger map: the picker tiles would not hold the status words (R4).
- Letting the map keep its full 800 × 600 and scrolling: the thing being removed.

## R4. A compact tile picker and the right column's space budget

**Decision**: The district list renders as a grid of tiles: 4 across in the workbench's 400 px column (5 across at 440 px), 3 across in the two- and one-column layouts. Each tile has three lines: the district number in its color swatch with the leader and margin (for example "Dem +5.2", "Tied", "Empty"), the balance status with a symbol and words ("▲ Too large", "▼ Too small", "● Within range", "○ Empty"), and the voters over or under ("+4,210", "−1,860", blank when within range or empty). The pen stays in the tile's corner. The `li` rows keep their class, data attributes, ids, events and full accessible label, so hover, focus reveal and tooltips work unchanged.

Space budget in the right column at 1280 × 720 with 20 districts (column height 636 px):

| Part | Height |
|------|--------|
| Picker: 5 rows of 54 px and four 6 px gaps | 294 |
| District detail | 132 |
| Plan status | 130 |
| Message slot (blocked edits) | 44 |
| Three 8 px gaps | 24 |
| Total | 624 |

That leaves about 12 px spare at the worst case (20 districts, smallest window); a state with 8 to 14 districts has 50 to 150 px more. If measurement shows it does not fit, the levers are, in order: tile padding, a two-line tile when there are more than 16 districts, then the column scrolling inside itself (the page still does not scroll). The layout test at 1280 × 720 with 20 districts is the gate.

**Rationale**: The spec requires every district's status in the picker without hovering and all of it on one screen. A one-column list needs at least 28 px per district, 560 px for 20, with no room for anything else.

**Alternatives considered**:
- A list beside the map in a 270 px left rail: the map falls to about 34% of the window at 1280 × 720.
- A horizontal strip of tiles under the map: costs about 150 px of map height.
- Status by color only: not allowed (FR-008).

## R5. The selected district's detail

**Decision**: `district-detail.js` renders from the district summary and the balance numbers the page already computes (`getBalance`: `ideal`, `lower`, `upper`, per-district `balance` and `offset`). Content: "District N" with the status symbol and words; leading side and margin (or "Tied" or "Empty"); voters; allowed range ("49,100 to 53,900") and the distance from it ("4,210 over" or "1,860 under" or "within range"); precincts; connected ("Yes" or "No, in N pieces"). The existing "Editing District N: …" line (`editing-status`) moves into the detail's header, with the same text, role and live-region behavior. With no district selected it says "Pick a district's pen to edit it and see its status here."

**Rationale**: Everything shown already exists elsewhere (hover details, tooltips, plan status); the detail gathers it for the district being edited. Merging the editing line into it saves a full row above the map.

**Alternatives considered**: Showing the detail only in a tooltip: it would hide while the pointer is on the map, which is where the visitor's attention is.

## R6. Nothing moves when messages come and go

**Decision**:
- The blocked-edit message (`edit-message`) sits in a fixed-height slot (two lines) in the right column; the element still toggles `hidden`, the slot never collapses.
- The brush bar has a message cell sized for two lines of text (the hint when unavailable and the stroke summary share it).
- The editing line lives in the detail with reserved height.
- The right column and the brush bar have fixed heights in the workbench; the secondary sections are below the first screen, so their changes cannot move anything above them.
- The tooltip is already `position: fixed`.

**Rationale**: Today the editing line and the error message are inserted above the map, which pushes it down (a visible layout shift). A layout test records the map's and the panels' boxes before and after messages and requires them to be identical (SC-006).

## R7. Hover and the tooltip

**Decision**: No change to behavior. Tooltip placement already clamps to the window, and it has no pointer events, so it cannot take hover from the picker. Hovering a tile still reveals the district's precincts on the map.

## R8. Keeping the page still: focus, selection, edits

**Decision**: Programmatic focus (arrow keys moving between precincts) uses `focus({ preventScroll: true })`; nothing calls `scrollIntoView`. In the workbench the page cannot scroll while the secondary sections are below the first screen unless the visitor scrolls on purpose. Pressing a pen, picking a tile, and every edit change only text and colors inside fixed boxes.

**Rationale**: Browsers scroll a focused element into view; without `preventScroll` an arrow-key walk near an edge could move the page.

## R9. Build mode keeps today's layout

**Decision**: While building a state (`is-building`) the workbench layout is off; the two-column layout (or one column on narrow windows) is used, as now. The district picker, detail, plan status and brush bar are hidden there exactly as they are today, and the builder fills the right column.

**Rationale**: The spec puts the builder out of scope; its long form needs scrolling room, and its stat block feedback stays near the map.

## R10. Short side names for the tiles

**Decision**: Each side in `src/matchups.js` gets a `shortName` (Dem, Rep, Soc, Lib, Purple, Orange). Tiles use it ("Dem +5.2"); the detail, tooltips, legend and labels keep the full names.

**Rationale**: A tile is about 95 px wide; "Republicans +12.3" would not fit on one line.

## R11. Tests

**Decision**:
- A new `layout` test group (`tests/layout.test.js`) loads the real page in same-origin iframes of exact sizes (the iframe's size is its window, so the media and container queries apply as in a real window). Sizes: 1280 × 720, 1366 × 768, 1440 × 900, 1536 × 864, 1920 × 1080, for states with 8, 14 and 20 districts (seeds found by searching, as 010's tests do). For each: select a district, turn the brush on, and require the picker, the whole map, the detail, the plan status, the brush bar, the matchup toggle and the editing line to be fully inside the window, the map to be the largest item and at least 40% of the window, and the picker to show every district.
- A walkthrough test makes 10 edits (5 clicks and 5 brush strokes), switches district, makes 10 more, and requires the page's scroll position to stay 0 and the map's and panels' boxes to stay identical.
- Overflow tests at 320, 480, 768, 1024, 1279 × 720, 1280 × 719, 1920 and 2560: no horizontal scrolling and every earlier section present.
- Existing UI tests that read the old list rows, side column positions or the stat block's place are updated to the new places.
- The `layout` group covers `index.html`, `styles.css`, `src/main.js` and `src/ui/`, so `--affected` runs it when those change.

## R12. Phones and tablets

**Decision**: Below 760 px the single column order is: top bar, map (full width), brush bar, picker (3 tiles across), detail, plan status, message slot, then the secondary sections. Between 760 and 1239 px, or in short windows, the two-column layout keeps the map and the panel column side by side (the picker at 3 tiles across), with the brush bar under the map; scrolling is allowed. Touch targets stay at least 34 px (the pen is 34 px).

## R13. Cost of the change

**Decision**: No change to data, rules, or generation. The detail renders from numbers already computed for the plan status and the list on every edit, so the per-edit cost is a few text updates.

## Final measured values

Measured by `tests/layout.test.js` (brush on, district 1 selected). The right column is 476 px wide (`minmax(430px, 476px)`), the brush bar is 52 px, the detail is 122 px and the plan status is 136 px at every size; the plan status keeps a constant height because its verdict and balance lines reserve two lines each, its rows do not wrap, and its heading is visually hidden. The column never scrolls inside itself, but at 1280 × 720 with 20 districts it is nearly full (about 3 px spare), so that case is the first to check when anything in the column grows.

| Window | Drawn map | Map share | Picker (8 / 14 / 20 districts) | Column height |
|---|---|---|---|---|
| 1280 × 720 | 752 × 564 | 46% | 108 / 223 / 280 px | 640 px |
| 1366 × 768 | 816 × 612 | 48% | same | 688 px |
| 1440 × 900 | 916 × 687 | 49% | same | 820 px |
| 1536 × 864 | 944 × 708 | 50% | same | 784 px |
| 1920 × 1080 | 1232 × 924 | 55% | same | 1000 px |

Choices that differ from the plan: the tile pen is 26 px (not 34), the swatch is 15 px, tiles are 46 px tall, short names are `Pur` and `Org` (not Purple and Orange), `renderDistrictDetail` takes no `editing` argument (the editing line is plain text above the detail), and the top bar and brush bar rows are 48 px and 52 px. A window 1279 px wide still gets the one-screen layout because a classic scrollbar leaves a 1240 px container; the tests use 1200 × 720 and 1280 × 719 as the non-workbench cases.
