# Quickstart: Precinct Building Blocks and Brush Selection Tool

How to run the feature and check that it works. Details of each shape are in [data-model.md](./data-model.md) and [contracts/changes.md](./contracts/changes.md).

## Prerequisites

- The app is static: serve the project folder, for example `python3 -m http.server 8000` from the repository root.
- Open `http://localhost:8000/` for the app. The tests run from the command line (below) and need Python 3 and Google Chrome.

## 1. Run the automated checks

The tests are split into groups (`tests/groups.json`); the command runs the groups, and slices of the big ones, at the same time in headless Chrome.

```text
python3 scripts/test.py                 the full suite (about 30 s); run this before deploying
python3 scripts/test.py --affected      only the groups whose code or tests changed since they last passed
python3 scripts/test.py brush geometry  only the named groups
python3 scripts/test.py --list          the groups and the source each one covers
```

Expect `0 failed` and exit status 0. To debug one group in a normal tab, open `http://localhost:8000/tests/index.html?group=brush` (any group name from `--list`). If a timing check (random state under 2 s) fails while the machine is busy, rerun when it is quiet rather than loosening it.

## 2. Precincts instead of counties (User Story 1)

1. Open `http://localhost:8000/?seed=demo-1`.
2. The caption reads "… N precincts · M districts" with N between 500 and 800. Hover and tab to several precincts: the pop-up shows a name, "Precinct voters", the voters per side, a type and a density, and a district or "No district".
3. Search the page: no "county" or "counties" appears in the map, the list, the pop-up, the help text, or the notice.
4. Click a district's pen, then click one precinct to add it, click another in a different district to move it, and click it again to remove it. Clicking a precinct that is not connected to the district shows the "must stay connected" message, as before.
5. Open "Build a state", place a few cities, and check that it builds with 500 to 800 precincts and that dense areas have smaller precincts.
6. Open `?custom=v1.…` and `?custom=v2.…` links from earlier versions: neither shows an error; they open a precinct state with the same cities.

## 3. Brush (User Story 2)

1. Click a pen to select a district. The Brush section comes alive: a toggle, Add/Erase, a size slider with its value.
2. Before choosing any district, confirm the Brush controls are disabled and say to pick a pen first.
3. Press the Brush toggle. A circle follows the pointer over the map. Drag the size slider: the circle resizes at once; at 10 it covers one to three precincts, at 150 it is about 300 px across on the 800 px map.
4. Click once: every precinct whose center is inside the circle joins the district; the district list, totals, balance and plan status update at once.
5. Press and drag across the map: a continuous strip is painted. Drag quickly: no gaps appear along the path.
6. Choose Erase (or hold Shift): the circle turns dashed, and brushing takes precincts out of the district.
7. Press Escape: the circle disappears and the brush is off. Press Escape again: editing stops.
8. Try Tab: only one precinct is a tab stop; arrow keys move between precincts; with the brush on, Enter paints at the focused precinct.

## 4. Rules and feedback (User Story 3)

1. With a district that already has precincts, brush over an area that includes precincts that do not touch it. Only connected precincts are added; the message says how many were skipped and why.
2. Brush across the border of another district at a point where taking one precinct would split that district: that precinct is skipped and every district is still one piece.
3. On an empty district, brush anywhere: the district starts as one connected piece.
4. Drag a long stroke and release: one summary appears for the whole drag, with added, moved, removed, unchanged and skipped adding up to the precincts the brush covered.
5. Brush over water or outside the state: the message says no precincts were under the brush.

## 5. Performance spot checks

- Press "New map" ten times: each map appears in under 2 s.
- Drag the largest brush across a dense area for several seconds: the page stays responsive and the circle keeps up.
- In the browser console, `performance.now()` around `window.gerryApp.strokeAt(...)` shows the stroke cost; the target is under 250 ms for the largest circle including the redraw.

## 6. Narrow screens and touch

- Resize to 320 px wide: the brush panel stays inside the page and the slider is usable.
- On a touch device (or touch emulation), turn the brush on and drag on the map: it paints and the page does not scroll; with the brush off, the page scrolls as usual.

## Results

Measured on the finished code (details in [research.md](./research.md), "Final tuned values").

- New maps: ten in a row took 110–305 ms each in the app; the slowest of 100 random seeds generated in 1.1 s.
- Custom builds: median 143 ms, slowest 878 ms over 99 plans; adding a city in the builder took 124–188 ms. One plan of 100 (12 cities on a hard outline) cannot be built and shows the existing "can't make a map" message.
- Brush: a click with the largest circle (301 precincts) 19 ms; one drag step with the whole redraw 32–64 ms; release redraw 12 ms.
- Layout (numeric checks of element boxes): at 320, 1366 and 1920 px wide the page has no horizontal overflow, the Brush panel sits inside the viewport (300, 260 and 260 px wide), the slider is 272, 232 and 232 px wide, and the toggle button is 40 px high.
- Tests: 152 passed, 0 failed on the browser test page, in two full runs in a row on the final code (the five-run check was cut to two at the owner's request).
