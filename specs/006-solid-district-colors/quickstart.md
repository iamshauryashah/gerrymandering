# Quickstart: Feature 006

## Automated

Open `http://localhost:8000/tests/` with the cache disabled. Expect the title `PASS: N passed, 0 failed`.

## Manual

1. Open `http://localhost:8000/?seed=demo-1`. Load the reference plan from the console: `gerryApp.setAssignments(gerryApp.state.referencePlan)`.
2. Check the solid colors. Each district appears as one solid color with no county lines inside, and the color matches its badge in the list.
3. Check the hover reveal:
   - Hover a district. Its counties show their own colors and outlines.
   - Move between counties of the same district. There should be no flicker.
   - Move the pointer out. The district returns to its solid color.
4. Hover a district row in the list. The same district is revealed on the map.
5. Tab through the counties with the keyboard. Focus reveals the district just like hover does.
6. Check editing:
   - Turn on editing for District 2 and add a county.
   - The district color updates immediately.
   - A county with no district shows its own color with dots.
7. Check touch: with phone emulation, tap a district. It stays revealed until you tap elsewhere.

## Results

- Full browser suite: **49 passed, 0 failed**. The 006 tests replace the old 002 test "counties are filled by their own result".
- Solid districts: every district county's fill equals its badge and swatch color, and its stroke matches its fill, so there are no seams. Unassigned counties keep their own color and dots.
- Recoloring: adding, moving or removing a county, and switching the matchup, recolor districts immediately.
- Reveal: hovering, focusing, or hovering/focusing a list row reveals exactly that district's counties. Moving between counties of the same district does not flicker. Leaving restores the solid color. Each reveal takes well under 200 ms.
- Touch: a tap reveals the district and it stays revealed until the next tap. Starting or stopping editing clears a sticky reveal, and loading a map clears any reveal. As the spec's edge case says, the district under the pointer stays revealed while editing.
- Visual check:
  - At 1366 px the reference plan shows 10 seamless solid districts. Hovering district 5 shows its 7 counties' own colors with white seams, and the tooltip is correct.
  - At 320 px there is no horizontal overflow.
- Deviation: T010 reuses the existing `onDistrictEnter`/`onDistrictLeave` callbacks (already debounced within a row) instead of adding a new `onReveal` callback.
