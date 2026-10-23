# Quickstart: Flowing Summary Panels

Validation guide for feature 012. Layout is checked by measurement in the test suite and by eye in a browser.

## Prerequisites

- Python 3 and Google Chrome (see `scripts/test.py`)
- From the project root: `python3 -m http.server 8000`, then open `http://localhost:8000/?seed=layout-24` (20 districts)
- No install step

## 1. Run the tests

```sh
python3 scripts/test.py layout ui districts      # the groups this feature touches
python3 scripts/test.py                          # the full suite once, at the end
```

Expected: all pass; the layout group includes the new fit, order, once-only, resize, other-layout and build-mode tests.

## 2. A tall window (the main case)

1. Open the page at 1920 × 1080 (browser device toolbar is fine) with a 14-district state.
2. Select a district and turn the brush on.
3. Expected: under the Plan check and the message area the Statewide Voters, District Control and Legend blocks are visible, in that order, beside the map. The page has little or nothing left to scroll except the help text and notice.
4. Paint a few strokes: the blocks' numbers change, nothing moves, no scrolling.

## 3. A short window

1. At 1280 × 720 with 20 districts, the three blocks are below the screen as in feature 011 (no room under the Plan check).
2. Take the window from 1280 × 720 up to 1920 × 1080 in steps: blocks appear one at a time in the order totals, control, legend, and none is ever cut off.
3. Shrink it back: they leave from the end.

## 4. Other states of the page

1. 1000 × 800: the blocks that fit appear in the narrower column; the rest are below the map; no sideways scroll.
2. 390 × 800: one column, blocks below as before.
3. "Build a state": the builder shows in the column and the blocks are below, as before. "Use this state" or Cancel returns to the editor and the blocks re-flow.
4. Zoom the page in and out (Ctrl and + / −): the number of docked blocks follows the room.
5. Press Tab through the page: picker, brush controls, map, then the rest; the order is the same with the blocks docked or not.

## 5. Results

Measured by `tests/layout.test.js` (see "Final measured values" in research.md): blocks docked at the five laptop and desktop sizes with 8, 14 and 20 districts are 1/0/0, 1/0/0, 3/2/1, 2/1/1 and 3/3/3 for 1280 × 720, 1366 × 768, 1440 × 900, 1536 × 864 and 1920 × 1080. At 1920 × 1080 only the help text and notice are below the screen (49 px of scrolling, was 442). The resize walk, state-change, build-mode, two-column and phone tests pass. Layout was verified by measurement and by one screenshot of the page; hard-reload the browser to see the change (cached CSS and modules).
