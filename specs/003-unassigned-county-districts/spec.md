# Feature Specification: Unassigned Counties and Blank Districts

> **Superseded by [010](../010-precinct-brush-tool/spec.md) for the building block**: counties are now precincts, and a state has 500 to 800 of them. Blank starting districts and unassigned areas work the same way.

**Feature Branch**: `003-unassigned-county-districts`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Now, make the congresional districts not included with the random generation and make it possible for counties to not have a distrct. Also if you click on a county while selecting a district, if that county is part of that distrct it should un-select."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start With a Blank District Map (Priority: P1)

A visitor loads the website and sees the generated state and its counties with no district boundaries drawn. Every county starts without a district, and every district in the list starts empty, so the visitor draws all districts themselves.

**Why this priority**: Drawing districts from scratch is the core change. The generated map must no longer decide district lines for the visitor.

**Independent Test**: Load the website several times and confirm that no county belongs to a district, every district is listed as empty, and the map shows no district boundaries or number badges.

**Acceptance Scenarios**:

1. **Given** a newly generated state, **When** the page finishes loading, **Then** no county belongs to any district.
2. **Given** a newly generated state, **When** the visitor views the district list below the map, **Then** it lists 8 to 20 districts, numbered consecutively from 1, and each is shown as empty.
3. **Given** a newly generated state, **When** the visitor views the map, **Then** counties are shown in their own voter-makeup colors with no district boundaries and no district number badges.
4. **Given** a newly generated state, **When** the visitor views the control total, **Then** it shows zero districts won by each side, zero tied, all districts empty, and every county unassigned.

---

### User Story 2 - Add and Remove Counties While Editing (Priority: P2)

A visitor selects a district with its pen icon and clicks counties to add them. Clicking a county that is already in the selected district removes it from that district, leaving it without a district.

**Why this priority**: Visitors need to correct mistakes and reshape districts. Without removal, counties could only move between districts.

**Independent Test**: Select a district, click an unassigned county to add it, click that same county again, and confirm it no longer belongs to any district and all results update.

**Acceptance Scenarios**:

1. **Given** a district is selected for editing, **When** the visitor clicks a county with no district, **Then** the county is added to the selected district.
2. **Given** a district is selected for editing, **When** the visitor clicks a county in a different district, **Then** the county leaves its previous district and joins the selected district.
3. **Given** a district is selected for editing, **When** the visitor clicks a county already in the selected district, **Then** the county is removed from that district and has no district.
4. **Given** a county was just removed, **When** the visitor clicks it again while the same district is still selected, **Then** it is added back to that district.
5. **Given** any add or removal, **When** the change is applied, **Then** the county keeps its own color, and the affected districts' boundaries, number badges, list colors, details, and the control total update.
6. **Given** a keyboard user is editing, **When** they press Enter or Space on a focused county, **Then** it is added or removed using the same rules as a click.

---

### User Story 3 - Understand Unassigned Counties (Priority: P3)

A visitor can tell which counties do not belong to any district and how many remain unassigned.

**Why this priority**: When counties can lack a district, visitors need to see what is left to assign. The map works without this, so it has lower priority.

**Independent Test**: Assign some counties, leave others unassigned, and confirm unassigned counties are visibly marked, say "No district" in their details, and are counted in the control total.

**Acceptance Scenarios**:

1. **Given** some counties have no district, **When** the visitor views the map, **Then** those counties are visibly marked as unassigned while still showing their own voter-makeup colors.
2. **Given** editing mode is off, **When** the visitor hovers over or focuses on an unassigned county, **Then** its details show the county's voters and state that it has no district.
3. **Given** counties are assigned or removed, **When** the control total updates, **Then** it shows the current number of unassigned counties.
4. **Given** every county is assigned to a district, **When** the visitor views the map and control total, **Then** no county is marked unassigned and the unassigned count is zero.

### Edge Cases

- Removing the only county from a district makes that district empty: it stays in the list, loses its map boundary and badge, and counts as empty.
- When a district is selected, clicking a county does exactly one thing: it adds the county if the county has no district, moves it if it is in another district, or removes it if it is already in the selected district.
- Rapid clicks on the same county alternate between adding and removing it, and each click is applied once, in order.
- Unassigned counties do not count toward any district's voter totals or the number of districts won by either side.
- A district with tied voter totals still uses the tie color and counts as tied.
- The unassigned-county marking stays visible and distinct under all three matchups and does not hide county colors.
- Reloading the website generates a new state with no districts drawn and discards all previous edits.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Generating a new state MUST NOT assign any county to a district.
- **FR-002**: The website MUST still show between 8 and 20 districts, inclusive, numbered consecutively starting at 1, and each district MUST start with no counties.
- **FR-003**: A county MUST belong to at most one district at any time; belonging to no district is allowed.
- **FR-004**: While a district is selected for editing, clicking or keyboard-activating a county with no district MUST add it to the selected district.
- **FR-005**: While a district is selected for editing, clicking or keyboard-activating a county in another district MUST move it into the selected district.
- **FR-006**: While a district is selected for editing, clicking or keyboard-activating a county that is already in the selected district MUST remove it from that district, leaving it with no district.
- **FR-007**: Each district's voter totals MUST equal the sum of its counties' voter totals; unassigned counties MUST NOT count toward any district.
- **FR-008**: The map MUST draw boundaries and number badges only for districts that contain at least one county.
- **FR-009**: Unassigned counties MUST be visibly marked on the map while keeping their own voter-makeup fill colors.
- **FR-010**: When editing mode is off, the details for an unassigned county MUST show its voter makeup and state that it has no district.
- **FR-011**: The control total MUST show districts won by each side, tied districts, empty districts, and the number of unassigned counties.
- **FR-012**: Every add, move, or removal MUST immediately update affected district boundaries, badges, list entries, details, unassigned markings, and the control total without changing any county's fill color.
- **FR-013**: Clicking a county when editing mode is off MUST NOT change its district.
- **FR-014**: All existing behaviors from `002-congressional-district-editor` remain unchanged except where this specification replaces them: the generated state, matchup toggle, legend, district list, pen selection, Escape behavior, district details, and accessibility.

### Key Entities

- **District Assignment**: The optional link between a county and one district. A county has either no district or exactly one district.
- **Unassigned County**: A county with no district. Its voters are not counted toward any district.
- **Congressional District**: A numbered group of zero or more counties, with combined voter totals, leading side or status, lead margin, number badge, and result color.
- **Control Total**: A summary of districts won by each side, tied districts, empty districts, and unassigned counties.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across 100 page loads, 100% of generated states start with zero counties assigned, 8 to 20 empty districts, and no district boundaries or badges on the map.
- **SC-002**: In testing, 100% of clicks on a county already in the selected district leave that county with no district, and 100% of clicks on other counties add them to the selected district.
- **SC-003**: In testing, district voter totals, the control total, and the unassigned-county count match the current assignments 100% of the time.
- **SC-004**: After each add, move, or removal, all map, list, details, and total updates appear within 1 second.
- **SC-005**: 90% of first-time visitors can build one district, remove a county from it, and identify how many counties remain unassigned within 2 minutes without instructions.

## Assumptions

- This feature changes `002-congressional-district-editor`. Its rules that every county always belongs to exactly one district and every district starts with at least one county are replaced by this specification.
- The number of districts is still randomly chosen between 8 and 20 for each generated state; only the county-to-district assignments are no longer generated.
- County shapes, names, and voter makeups are still randomly generated as before, and the 400-square-pixel minimum county size still applies.
- Removing a county from a district never moves it into another district; it becomes unassigned.
- Visitors are not required to assign every county; there is no completion check, warning, or required finish step.
- There is no undo, reset, save, auto-assign, or sharing feature in this feature.
- All district and voter data remains fictional.
