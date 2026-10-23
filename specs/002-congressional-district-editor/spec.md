# Feature Specification: Congressional District Editor

> **Superseded by [011](../011-single-screen-editing/spec.md) for layout**: the page is now arranged so that picking a district, editing the map and reading the district's status need no scrolling on a laptop or desktop window. Where this spec places the district list below the map and the control total beside it, read the 011 layout instead.

> **Superseded by [010](../010-precinct-brush-tool/spec.md) for the building block**: what this feature calls counties are now precincts (500 to 800 per state), and the editor also has a brush that assigns many precincts at once. The editing rules themselves are unchanged.

**Feature Branch**: `002-congressional-district-editor`

**Created**: 2026-10-18

**Status**: Draft

**Clarification**: 2026-10-18: Counties are always colored by their own voter makeup, which is generated with the map. The app treats every voter's choice as known, so district results come from exact county vote counts.

**Clarification**: 2026-10-18: Every county's visible area within the state must be greater than 400 square pixels when the map is shown at full size.

**Input**: User description: "Below the map, add a view for 8-20 congresional districts and, when a you hover over a congressional district it shold give the voter spesifications. When a pen icon is clicked next to the congresional district, it should enable the feature, that any counties clciked while that congressional district is selcted, those counties will be added to that congressional district. Also, the districts should show the number on thier number on the map and color based on voter makeup. A total should pop up on the side of the map showing what party controls the how many districts."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Congressional Districts (Priority: P1)

A visitor sees the generated state split into numbered congressional districts. Counties keep the colors of their own voter makeup, while each district's number badge and list entry are colored by the district's combined voter makeup.

**Why this priority**: Visitors must be able to see districts and their results before redrawing them has any meaning.

**Independent Test**: Load the website and confirm that 8 to 20 numbered districts appear on the map and in the district list below it, with every county assigned to exactly one district.

**Acceptance Scenarios**:

1. **Given** a newly generated state, **When** the page finishes loading, **Then** the state is divided into 8 to 20 congressional districts numbered consecutively starting at 1.
2. **Given** districts are shown, **When** the visitor views the map, **Then** each district with counties shows its number on the map and has a clearly visible boundary.
3. **Given** districts are shown, **When** the visitor views the map, **Then** every county remains colored by its own generated voter makeup.
4. **Given** districts are shown, **When** the visitor views each district's number badge and list entry, **Then** its color shows the district's leading side and lead size using the active matchup's colors.
5. **Given** districts are shown, **When** the visitor views the area below the map, **Then** a district list shows each district's number, color, leading side, and pen icon.

---

### User Story 2 - Inspect District Voter Details (Priority: P2)

A visitor hovers over a district on the map or in the district list to see that district's voter specifications.

**Why this priority**: District details explain district results and help visitors understand the effect of redrawing districts.

**Independent Test**: Hover over several districts on the map and in the list and verify each pop-up matches the combined voter totals of that district's counties.

**Acceptance Scenarios**:

1. **Given** districts are shown, **When** the visitor hovers over a district in the district list, **Then** a pop-up shows its number, county count, county names, total voters, each side's voter count and percentage, leading side or tie status, and lead margin.
2. **Given** editing mode is off, **When** the visitor hovers over a county on the map, **Then** the pop-up shows both that county's details and its district's details.
3. **Given** a keyboard user is viewing the district list, **When** they move focus to a district, **Then** the same district details are shown as for hover.
4. **Given** the visitor changes the matchup, **When** they inspect a district, **Then** its voter numbers remain unchanged while its side labels and colors match the selected matchup.

---

### User Story 3 - Reassign Counties to a District (Priority: P3)

A visitor clicks the pen icon beside a district to begin editing it, then clicks counties on the map to move them into that district.

**Why this priority**: Redrawing districts demonstrates gerrymandering, but depends on districts and their results already being visible.

**Independent Test**: Activate a district's pen icon, click counties from other districts, and confirm those counties join the selected district and all affected results update.

**Acceptance Scenarios**:

1. **Given** editing mode is off, **When** the visitor clicks a district's pen icon, **Then** that district becomes the selected district and the website clearly indicates that editing mode is active.
2. **Given** a district is selected for editing, **When** the visitor clicks a county assigned to a different district, **Then** the county is removed from its previous district and added to the selected district.
3. **Given** a county is moved, **When** the change is applied, **Then** the moved county keeps its own color, while both affected districts' boundaries, number badges, list colors, details, and the control total update.
4. **Given** a district is selected for editing, **When** the visitor clicks a county already in that district, **Then** its assignment does not change.
5. **Given** a district is selected for editing, **When** the visitor clicks another district's pen icon, **Then** the newly clicked district becomes the selected district.
6. **Given** a district is selected for editing, **When** the visitor clicks the same pen icon again or presses Escape, **Then** editing mode turns off and clicking counties no longer reassigns them.

---

### User Story 4 - Track District Control Totals (Priority: P4)

A visitor sees a summary beside the map showing how many districts each side controls.

**Why this priority**: The total turns individual district changes into a clear statewide outcome.

**Independent Test**: Compare the control total with every district's leading side, then move counties and verify the total updates accordingly.

**Acceptance Scenarios**:

1. **Given** districts are shown, **When** the visitor views the side of the map, **Then** a control total shows the number of districts won by each side, tied districts, and empty districts.
2. **Given** the visitor reassigns a county, **When** a district's leading side changes, **Then** the control total updates to match.
3. **Given** the visitor changes the matchup, **When** the control total updates, **Then** its side labels and colors match the selected matchup and its counts stay the same.

### Edge Cases

- A district with no counties remains in the district list, has no map label, shows zero voters, and counts as empty rather than won or tied.
- A district with tied voter totals uses the tie color and counts as tied in the control total.
- A district may contain counties that are not connected to each other; each separate part is enclosed by the same district boundary style, and its number badge appears on its largest part.
- The smallest counties, which are just over 400 square pixels at full map size, remain clickable for reassignment and have accessible details, including on narrow screens where the map is shown smaller.
- Labels for small districts remain readable or are placed so they do not cover other district labels.
- Pop-ups and the control total remain fully visible on screens from 320 pixels to 1920 pixels wide; on narrow screens, the control total may appear directly next to or below the map without covering it.
- Rapid county clicks are applied once each, in the order clicked.
- Reloading the website generates a new state and discards previous district edits.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The website MUST create between 8 and 20 congressional districts for each generated state, inclusive.
- **FR-002**: Districts MUST be numbered consecutively starting at 1.
- **FR-003**: Every county MUST belong to exactly one district at all times.
- **FR-003a**: Every generated county's visible area within the state MUST be greater than 400 square pixels when the map is shown at its full size of 800 by 600 pixels.
- **FR-004**: Each newly generated state MUST start with every district containing at least one county.
- **FR-005**: The map MUST show each non-empty district's boundary and number.
- **FR-006**: Each district's voter totals MUST equal the sum of its counties' voter totals.
- **FR-007**: Each county's map fill MUST always reflect that county's generated voter makeup and MUST NOT change when the county is assigned to a different district.
- **FR-007a**: Each district's number badge and list color MUST identify its leading side, use a stronger shade for a larger lead, use the tie color for ties, and use a distinct empty-district style when it contains no counties.
- **FR-008**: The website MUST show a district list below the map containing each district's number, color, leading side or status, and pen icon.
- **FR-009**: Hovering over or focusing on a district in the list MUST show its number, county count, county names, total voters, each side's voter count and percentage, leading side or tie status, and lead margin.
- **FR-010**: When editing mode is off, county map details MUST also identify the county's district and show that district's voter details.
- **FR-011**: Clicking a district's pen icon MUST select that district for editing; only one district can be selected at a time.
- **FR-012**: The selected district and active editing mode MUST be visibly indicated on the map and in the district list.
- **FR-013**: While a district is selected for editing, clicking a county MUST assign that county to the selected district.
- **FR-014**: Editing mode MUST turn off when the visitor clicks the selected district's pen icon again or presses Escape.
- **FR-015**: Any county reassignment MUST immediately update affected district boundaries, number badges, district colors, list entries, details, and control totals without changing county colors.
- **FR-016**: The website MUST show a control total beside the map with counts of districts won by each active side, tied districts, and empty districts.
- **FR-017**: Changing the matchup MUST update county colors, district labels, district colors, details, and control totals without changing county assignments or voter numbers.
- **FR-018**: Pen icons and district details MUST be usable with a keyboard and have clear accessible labels.

### Key Entities

- **Congressional District**: A numbered group of counties with combined voter totals, leading side or status, lead margin, number badge, and result color.
- **District Assignment**: The relationship placing each county in exactly one district.
- **Editing Selection**: The district currently selected by its pen icon, if any, which receives counties clicked on the map.
- **Control Total**: A summary of districts won by each side, tied districts, and empty districts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across 100 page loads, every generated state has 8 to 20 districts, every county is larger than 400 square pixels at full map size, every county belongs to exactly one district, and every district initially has at least one county.
- **SC-002**: In testing, 100% of district voter totals and control totals match the counties assigned to each district.
- **SC-003**: District details appear within 0.5 seconds of hovering over or focusing on a district.
- **SC-004**: After a county is clicked during editing, all affected map, list, details, and total updates appear within 1 second.
- **SC-005**: 90% of first-time visitors can select a district, move one county into it, and identify the resulting district control total within 2 minutes without instructions.
- **SC-006**: In testing, 100% of non-empty districts show a readable district number on the map.

## Assumptions

- This feature extends the generated state, county details, legend, and matchup toggle defined in `001-gerrymandering-map-explorer`.
- The number of districts is randomly chosen between 8 and 20 each time a new state is generated; the visitor cannot change the count.
- Because generated states contain 20 to 60 counties, every initial district can contain at least one county.
- Initial districts are generated from groups of neighboring counties; districts are not required to have equal populations.
- Edited districts are not required to be connected, compact, or population-balanced, allowing visitors to create gerrymandered shapes.
- The map's full size is 800 by 600 pixels. On smaller screens the whole map scales down proportionally, so the 400-square-pixel minimum is measured at full size.
- Each county's voter makeup is generated with the map and stays fixed until reload.
- The app knows how every voter will vote: every voter in a county votes for one of the active matchup's two sides, so county and district results are exact outcomes rather than predictions or probabilities.
- There are no undecided voters, turnout changes, third-party votes, or polling uncertainty.
- Clicking a county outside editing mode has no reassignment effect.
- "Party" in the control total means the two sides in the active matchup.
- There is no undo, reset, save, sharing, or validation against real redistricting rules in this feature.
- All district and voter data remains fictional.
