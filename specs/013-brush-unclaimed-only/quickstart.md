# Quickstart: Brush Only Takes Unclaimed Precincts

Validation guide for feature 013.

## Prerequisites

- Python 3 and Google Chrome (see `scripts/test.py`)
- From the project root: `python3 -m http.server 8000`, then open `http://localhost:8000/`
- No install step

## 1. Run the tests

```sh
python3 scripts/test.py brush ui layout     # the groups this feature touches
python3 scripts/test.py                     # the full suite once at the end
```

Expected: all pass, including the 100-stroke guarantee test in the brush group and the bar-fit test in the layout group. Result on completion: see section 6.

## 2. Paint next to a finished district

1. Open a state, select District 1, turn the brush on, and paint a blob of precincts.
2. Select District 2 and paint a blob next to it so the two touch.
3. With District 2 selected and the box "Only unclaimed precincts" **off**, paint across the shared border: some of District 1's precincts move to District 2 (as before).
4. Undo your way back by repainting, or reload. Now tick "Only unclaimed precincts" and paint across the same border: only unclaimed precincts join District 2; District 1 is unchanged. The message reads like "Added 6 precincts, … skipped 9 (already in another district)".
5. Paint only over District 1's land: nothing changes and the message says so.

## 3. The control

1. The box is unchecked at first, labelled "Only unclaimed precincts", and unavailable until a district is selected.
2. Tab to it and press Space: it toggles; a screen reader announces checked or not checked.
3. Switch the brush to Erase: the box stays in the same place, dimmed and unavailable. Switch back: it returns with its old state.
4. Hold Shift while painting with Add chosen and the box ticked: the stroke erases and the box makes no difference. With Erase chosen (box dimmed) and Shift held, the stroke adds and the ticked box still applies. Release Shift and the chosen mode applies again.

## 4. Remembering and resetting

1. Tick the box, then select another district, turn the brush off and on, change the size and the matchup: it stays ticked.
2. Click "New map", use "Build a state", or open a shared link: the box is unticked.

## 5. The screen still fits

1. At 1280 × 720 with 20 districts, brush on, a stroke message showing: the whole brush bar (controls and message text) is inside the window, the map has not changed size, and nothing needs page scrolling.
2. At 1000 × 800 and 390 × 800 the controls wrap normally; there is no sideways scrolling.

## 6. Results

On 2026-10-22, `python3 scripts/test.py --jobs 2 --timeout 120` completed with **189 passed, 0 failed**. The focused `brush`, `ui`, and `layout` groups also passed. Coverage includes the 100-stroke guarantee (no assigned precinct changes district in an add stroke with the option on; every district stays connected; replays match), the 100-stroke snapshot of old behavior (the option off or missing produces identical results), keyboard and Shift interactions, custom-state reset, and brush-bar fit at the five laptop and desktop sizes. A browser smoke check confirmed the checkbox starts off, is unavailable in Erase mode with its Add-only description, resets after a new map, and produces no console errors during those interactions. The bar stays 52 px tall and holds the full message; measured widths are in research.md ("Final measured values"). Layout was verified by measurement and one screenshot; hard-reload the browser to see the change (cached CSS and modules).
