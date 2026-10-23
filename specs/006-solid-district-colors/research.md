# Research: Solid District Colors With Hover Reveal

## R1: Painting a district as one solid area

- **Decision**:
  - For each county, `fill = revealed || !district ? ownColor : districtColor`.
  - `districtColor = getResultColor(district.status, district.marginPercent, matchup)`, the same function used for the badge and swatch.
  - For solid counties, set the inline `style.stroke` to the fill color, which hides the seams.
  - District border lines, the selected-district hatch, and the unassigned dot pattern are drawn on top as before.
- **Rationale**: No geometry merging is needed. Inline style overrides the CSS `.county { stroke: #fff }` rule.
- **Alternatives**: Build a merged district polygon. Rejected: the county shapes are still needed for clicks and for the reveal.

## R2: When to repaint

- **Decision**: `renderDistricts` calls `paintCounties()`, so every commit, matchup change, and load repaints.
- **Rationale**: District results change whenever a county is added or removed. The cost is about 120 attribute writes, which is negligible.

## R3: Reveal state machine

- **Decision**: The map view stores `revealedDistrict` (`null` or a district number).
  - **Pointer enters a county**: if the county is in district *n* and the pointer is not touch, call `setRevealed(n)`.
  - **Pointer leaves a county**: if the `relatedTarget` county is in the same district, keep the reveal. Otherwise call `setRevealed(null)`; the next enter handler reveals again as needed.
  - **Focus moving in and out**: same rules, using the newly focused element.
  - **List row hover or focus**: `onDistrictEnter(n)` calls `mapView.setRevealed(n)`. `onDistrictMove` keeps the tooltip positioned; `onDistrictLeave` clears the reveal unless it is sticky.
  - **Touch**: ignore pointer-leave for touch. A tap on a county while not editing toggles a sticky reveal of its district. A tap on the background or on a county outside any district clears it.
  - **Editing**: the reveal is cleared when editing starts or stops, and when a map loads.
- `setRevealed` repaints only the counties of the old and new revealed districts and sets `data-revealed` on them.
- **Rationale**:
  - Meets the 0.2 s target (SC-005a).
  - The related-target check prevents flicker.
  - Tooltips keep working as before.

## R4: Revealed district while editing

- **Decision**: Reveal works the same while editing. After a click changes the district, the next repaint uses the new membership. If the hovered county left the revealed district, the reveal follows the county's current district (or clears).
- **Rationale**: Matches the spec's edge cases. The user always sees current colors.

## R5: Legend

- **Decision**: Change the note to: "Districts are shaded by their overall result. Hover a district (or its row) to see its counties' own colors. Counties without a district show their own color with dots."
