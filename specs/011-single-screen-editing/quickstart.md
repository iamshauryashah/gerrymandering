# Quickstart: Single-Screen District Editing

How to run the feature and check that it works. Shapes and areas are in [data-model.md](./data-model.md); markup and module changes are in [contracts/changes.md](./contracts/changes.md).

## Prerequisites

- Serve the project folder: `python3 -m http.server 8000` from the repository root. Open `http://localhost:8000/?seed=demo-1`.
- The automated checks need Python 3 and Google Chrome.

## 1. Run the automated checks

```text
python3 scripts/test.py layout          the new layout checks only
python3 scripts/test.py --affected      everything the change could touch
python3 scripts/test.py                 the full suite, before deploying
```

Expect `0 failed`. The layout group opens the real page at 1280 × 720, 1366 × 768, 1440 × 900, 1536 × 864 and 1920 × 1080 for states with 8, 14 and 20 districts.

## 2. See it on a laptop-sized window (User Story 1)

1. Make the browser window about 1280 × 720 (or use the browser's device toolbar), at 100% zoom, and open the page.
2. Without scrolling you should see: the title and the matchup, New map and Build a state buttons across the top; the whole map taking most of the left side; a column on the right with the district tiles, a "pick a district" prompt (or the selected district's detail) and the plan check; and a one-line brush bar under the map.
3. Click a district's pen. The detail shows that district's status; the map and the page do not move.
4. Turn on the brush and paint a few strokes, then click a few precincts. After each, the district's tile, the detail and the plan check show the new numbers at once, and the page stays put.
5. Cause a blocked edit (click a precinct that does not touch the district): the message appears in its reserved spot and nothing shifts.
6. Pick another district: the detail changes in place.

## 3. Read every district at a glance (User Story 2)

1. Open a state with many districts (try `?seed=demo-1` and a few others). All the district tiles are visible at once, with no inner scrolling.
2. Each tile shows its number and color, the leader and margin (or Tied or Empty), a symbol and a status in words ("▲ Too large", "▼ Too small", "● Within range", "○ Empty"), and the voters over or under.
3. Edit a district: its tile and its neighbors' tiles update immediately.
4. Press Enter on a tile's pen (keyboard) to select it.

## 4. Everything else is still there, and smaller windows work (User Story 3)

1. Scroll down once from the editing screen: the statewide voter block, the district control totals, the legend, the help text and the notice are all there.
2. Narrow the window to about 1000 px, then 700 px, then 320 px: the layout stacks, the map stays whole, the tiles wrap, and there is never sideways scrolling.
3. Resize the window while a district is selected and a plan is partly drawn: nothing is lost.
4. Open "Build a state": it looks and works as before (scrolling is fine there).

## Results

All five laptop and desktop windows (1280 × 720 to 1920 × 1080) with 8, 14 and 20 districts pass the fit, walkthrough and picker tests: nothing needs page scrolling, nothing moves while editing, and the drawn map covers 46% to 55% of the window (see the table in research.md, "Final measured values"). Narrower and shorter windows, resizing, build mode and keyboard order pass in `tests/layout.test.js`. Layout was verified by measurement; it was not inspected by eye in a browser.
