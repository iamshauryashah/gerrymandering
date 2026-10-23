# Contract Changes: Feature 006

## Map View

- `mapView.setRevealed(n | null, { sticky = false })`: reveals district *n*, or clears the reveal; `sticky` preserves a touch reveal until another map action clears or changes it.
- `mapView.getRevealed()`: returns the current revealed district number or `null`.
- `mapView.isRevealSticky()`: returns whether the current reveal came from a touch tap.
- `path.county` attributes:
  - `fill`: district color unless the district is revealed or the county is unassigned
  - `data-revealed`: `"true"` on counties in the revealed district; `"false"` otherwise
  - `data-own-fill`: the county's own result color

## District List

- `createDistrictList(root, { …, onDistrictEnter, onDistrictMove, onDistrictLeave })`:
  - `onDistrictEnter(n, at)` runs on pointer entry and focus entry.
  - `onDistrictMove(n, at)` runs as the pointer moves within the row.
  - `onDistrictLeave(n)` runs when the pointer or focus leaves the row.

## Legend

- `.legend-note` explains that district colors show their combined result, hovering reveals counties' own colors, and unassigned counties show their own result.

## Superseded Test

- 002: "counties are filled by their own result and never recolor on reassignment" is replaced by:
  - Counties in a district share the district badge color.
  - Unassigned counties keep their own color.
  - Revealing a district restores its counties' own colors.
