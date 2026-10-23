# Feature Specification: Solid District Colors With Hover Reveal

**Feature Branch**: `006-solid-district-colors`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "districts should be one solid color, the color of thier total party makeup. Only when you are hovering over them should they show the counties and the counties' colors in that district."

**Supersedes**: The rule from features 002 and 003 that counties always keep their own color after joining a district (002 FR-015, 002 User Story 1 scenario 3, 003 User Story 1 scenario 5). Counties that are not in any district keep their own color.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See Each District as One Solid Color (Priority: P1)

A visitor drawing districts sees each district filled with one solid color that shows who wins the district overall, based on the combined voters of all its counties. This makes it easy to see at a glance which side controls each district.

**Why this priority**: It is the whole request and makes the result of a gerrymander immediately visible.

**Independent Test**: Put several counties with mixed results into one district and confirm every county in that district shows the same color, matching the district's combined result, its list swatch, and its number badge.

**Acceptance Scenarios**:

1. **Given** a district contains one or more counties, **When** the map is displayed, **Then** every county in that district is filled with the same solid color.
2. **Given** a district's combined voters favor side A, **When** it is displayed, **Then** its color is a side A color whose shade reflects the size of its combined margin, using the same shade scale as before.
3. **Given** a district's combined voters are exactly tied, **When** it is displayed, **Then** it is filled with the tie gray.
4. **Given** a district, **When** the visitor compares its map fill with its list swatch and number badge, **Then** all three show the same color.
5. **Given** the visitor switches the matchup, **When** the colors change, **Then** each district takes the matching color of the new matchup and its shade stays the same.

---

### User Story 2 - Colors Update as Districts Change (Priority: P1)

A visitor adds, moves, or removes a county, and the affected districts immediately recolor to show their new combined result.

**Why this priority**: Seeing a district flip color is the core feedback when gerrymandering.

**Independent Test**: Add a strongly side A county to a narrowly side B district and confirm the whole district changes color at once; remove it and confirm the color goes back.

**Acceptance Scenarios**:

1. **Given** a county is added to a district, **When** the change is applied, **Then** the county takes the district's color and the whole district recolors if its combined result changed.
2. **Given** a county is moved between districts, **When** the change is applied, **Then** both districts recolor to their new combined results.
3. **Given** a county is removed from a district and has no district, **When** the change is applied, **Then** it shows its own voter color again with the no-district dot pattern, and the district it left recolors.
4. **Given** a district loses its last county, **When** the change is applied, **Then** it no longer has any color on the map, and its list entry shows it as empty.

---

### User Story 3 - Reveal a District's Counties on Hover (Priority: P1)

A visitor hovers over a solid-colored district and, only while hovering, the district opens up to show its individual counties, each in its own voter color with county lines. When the pointer leaves, the district goes back to one solid color.

**Why this priority**: It is explicitly requested, and it lets visitors see what is inside a district without losing the clean solid-color view.

**Independent Test**: Hover any county in a solid district and confirm all counties of that district (and only that district) switch to their own colors with county lines; move the pointer away and confirm the district is solid again.

**Acceptance Scenarios**:

1. **Given** a solid-colored district, **When** the visitor is not hovering it, **Then** it shows one solid color with no lines between its counties, only its outer district border.
2. **Given** a solid-colored district, **When** the visitor hovers over any part of it, **Then** every county in that district shows its own voter color and the lines between those counties appear.
3. **Given** one district is revealed, **When** the visitor looks at other districts, **Then** they stay solid.
4. **Given** a revealed district, **When** the pointer moves from one of its counties to another county in the same district, **Then** the district stays revealed without flickering.
5. **Given** a revealed district, **When** the pointer leaves the district, **Then** the district returns to its solid color.
6. **Given** a visitor hovers or focuses a district's row in the district list, **When** the details appear, **Then** that district is revealed on the map too.
7. **Given** a keyboard visitor, **When** they move focus onto a county in a district, **Then** that district is revealed until focus leaves it.
8. **Given** a touch visitor, **When** they tap a county in a district while not editing, **Then** that district is revealed and its details appear, and tapping elsewhere returns it to solid.
9. **Given** a revealed district, **When** the visitor hovers a single county, **Then** that county is highlighted and its details show the county's own voters along with its district's details, as before.

### Edge Cases

- A district with a single county shows the same color that county would have had on its own.
- A district can be colored side B even though most of its counties lean side A, or the reverse, because the color follows combined voters, not the number of counties won.
- An exact tie in combined voters shows the tie gray.
- When no county is in any district (a new map), the map looks the same as before: every county shows its own color, its county lines, and the no-district pattern.
- Counties with no district are never hidden inside a solid area; they always show their own color and lines.
- While a district is being edited, the visitor clicks counties in the edited district and its neighbors; the district under the pointer is revealed as usual, so the visitor can always see which county they are about to click.
- A district split into pieces by an older plan or a bug would still be one color; hovering any piece reveals all of its pieces.
- The color legend must explain that districts show their combined result and counties with no district show their own result.
- Number badges and borders must remain readable on the darkest and lightest district shades.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every county that belongs to a district MUST be filled with that district's color, so each district appears as one solid color.
- **FR-002**: A district's color MUST be based on the combined voters of all its counties: the leading side's color, shaded by the combined margin using the same shade scale as county and district colors today; an exact tie MUST use the tie gray.
- **FR-003**: Counties with no district MUST keep their own voter color and the no-district pattern.
- **FR-004**: A district's map fill, list swatch, and number badge MUST always match.
- **FR-005**: Any add, move, or remove MUST immediately recolor every affected county and district.
- **FR-006**: Changing the matchup MUST recolor districts and unassigned counties without changing assignments, numbers, or shades.
- **FR-007**: While not revealed, a district MUST show no boundaries between its counties, only its outer district border.
- **FR-007a**: Hovering any county of a district, focusing a county of a district, or hovering or focusing the district's row in the list MUST reveal that district: all its counties show their own voter colors and county lines. Only one district is revealed at a time.
- **FR-007b**: The district MUST return to its solid color as soon as the pointer or focus leaves it and its list row.
- **FR-007c**: On touch devices, tapping a county in a district while not editing MUST reveal that district until the visitor taps elsewhere.
- **FR-008**: County hover and focus details MUST still show the county's own voters and result plus its district's details.
- **FR-009**: The legend MUST state that district colors show each district's combined result, that hovering a district shows its counties' own results, and that counties with no district show their own result.
- **FR-010**: Hover, focus, editing, selected-district highlighting, and keyboard behavior MUST work as before.

### Key Entities

- **District Color**: The leading side's color shaded by the district's combined margin, or tie gray; shown on all of its counties, its list swatch, and its number badge.
- **County Display Color**: The district color if the county is in a district that is not revealed; the county's own voter color if its district is revealed; otherwise the county's own voter color with the no-district pattern.
- **Revealed District**: The single district, if any, currently under the pointer, focus, or tap, whose counties are shown individually.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of checks, every county in a district has exactly the same fill as the district's list swatch and number badge.
- **SC-002**: In 100% of checks, a district made of mixed counties shows the color of its combined result, not of any individual county.
- **SC-003**: After any edit, affected districts show their new color within 1 second.
- **SC-004**: In 100% of checks, removing a county from its district restores that county's own color and no-district pattern.
- **SC-005**: Visitors can identify which side wins each district from the map alone, without hovering, in every test map.
- **SC-005a**: In 100% of checks, hovering a district reveals exactly that district's counties in their own colors within 0.2 seconds, and leaving it restores the solid color within 0.2 seconds.
- **SC-006**: All existing hover, editing, matchup, and accessibility behavior keeps passing its tests.

## Assumptions

- "Total party makeup" means the combined voters of all counties in the district; the color follows whichever side has more voters in total.
- The shade scale is the same one already used for counties and district swatches, so a narrow district is lighter and a lopsided district is darker.
- County lines inside a district are hidden until the district is revealed; because the district under the pointer is always revealed, visitors can still see and click individual counties.
- Counties not in any district keep their own colors, so visitors can still see the voter pattern while drawing.
- This feature is independent of feature 005 and can be built before or after it.
