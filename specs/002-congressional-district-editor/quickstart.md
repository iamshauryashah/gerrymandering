# Quickstart: Congressional District Editor

## Prerequisites

- Python 3 for the local static server
- A current desktop browser; use browser device emulation or a mobile browser for small-screen checks

## Run the app

From the repository root:

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000/>. For a reproducible map, open <http://localhost:8000/?seed=demo-1>.

## Run automated browser tests

With the server running, open <http://localhost:8000/tests/>. Expected outcome: the summary and page title read `PASS: 32 passed, 0 failed`. The tests cover reproducible generation, 100-seed validation (including every county's area being over 400 px²), valid county and district counts, unique assignments, voter totals, reassignment, control totals, matchup cycling, and UI behavior. The 100-seed test takes a few seconds.

`python3 -m http.server` lets the browser cache files. After editing source files, hard-reload (Shift+Reload) or disable the cache in developer tools so the tests run the latest code.

The page exposes `window.gerryApp` (app state and helpers) and `window.gerryLoadMs` (time to generate and render on first load) for manual timing checks. Measured on `?seed=demo-1` in a desktop browser: about 28 ms to load, under 2 ms to show a tooltip or switch matchup, and under 4 ms to reassign a county.

## Validation scenarios

1. **Districts appear**: Open the app. Confirm the title, toggle, map, legend, control total, district list, and fictional-data notice are visible. Confirm there are 8–20 consecutive district numbers.
2. **District details**: Hover or tab to a district list entry. Confirm the details match [ui-contract.md](./contracts/ui-contract.md) and the district's map number badge and list swatch use the district result color while counties keep their own colors.
3. **County details**: With editing off, hover a county. Confirm county and district details are both shown.
4. **Move counties**: Click the pen for a district, then click a county from another district. Confirm the county keeps its own fill color, moves into the selected district, and both districts, the list, details, and control total update.
5. **Editing controls**: Click another pen to switch districts, then press Escape. Confirm clicking a county no longer reassigns it.
6. **Ties and empty districts**: In the browser tests, verify tie and empty district results follow [data-model.md](./data-model.md).
7. **Matchups**: Click the toggle three times. Confirm the order and that colors and labels change while vote numbers and assignments stay the same.
8. **Keyboard and responsive layout**: Use only Tab, Enter, Space, and Escape to inspect and edit districts. Repeat at 320 px and 1920 px widths and confirm tooltips and the control total remain visible.
