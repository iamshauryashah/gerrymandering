# Feature Specification: Statewide Voter Makeup Stat Block

> **Superseded by [011](../011-single-screen-editing/spec.md) for layout**: the page is now arranged so that picking a district, editing the map and reading the district's status need no scrolling on a laptop or desktop window. The stat block now sits below the map instead of beside it; its content is unchanged.

**Feature Branch**: `007-state-voter-makeup`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "make a stat block showing the total state voter makeup of the hypothetical state."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the Statewide Voter Split (Priority: P1)

A visitor looking at the generated state sees a stat block that shows the whole state's voter makeup: how many voters the state has in total, how many belong to each side, and each side's share. This gives the visitor the baseline to judge a gerrymander against: how many districts a side wins compared with the share of voters it actually has.

**Why this priority**: It is the whole request. Without the statewide split, the visitor cannot tell whether a district plan is fair or skewed.

**Independent Test**: Load any map and confirm the stat block shows the total voters, each side's voter count and percentage, and the overall leader, and that the numbers equal the sums over all counties.

**Acceptance Scenarios**:

1. **Given** a map is displayed, **When** the visitor looks at the stat block, **Then** it shows the state's total voters.
2. **Given** a map is displayed, **When** the visitor looks at the stat block, **Then** it shows each side's name, voter count, and percentage of all voters.
3. **Given** the statewide totals favor one side, **When** the stat block is displayed, **Then** it states which side leads statewide and by what margin in percentage points, using the same wording style as county and district details.
4. **Given** the statewide totals are exactly tied, **When** the stat block is displayed, **Then** it says the state is tied.
5. **Given** the stat block, **When** the visitor reads it, **Then** the side percentages add up to 100%, and the side voter counts add up to the total voters.
6. **Given** a map is displayed, **When** the visitor looks at the stat block, **Then** a proportional bar or similar visual shows the two sides' shares at a glance, using each side's colors.

---

### User Story 2 - Stat Block Follows the Matchup and the Map (Priority: P1)

The stat block always agrees with what the rest of the page shows. Switching the matchup renames and recolors the sides; starting a new map replaces the numbers.

**Why this priority**: A stat block that shows stale or mismatched names and colors would be misleading.

**Independent Test**: Toggle the matchup and confirm the side names and colors change while the numbers stay the same. Click "New map" and confirm the numbers change to the new state's totals.

**Acceptance Scenarios**:

1. **Given** the stat block is displayed, **When** the visitor switches the matchup, **Then** the side names and colors change to the new matchup and the voter counts, percentages, and margin stay exactly the same.
2. **Given** the stat block is displayed, **When** the visitor starts a new map, **Then** the block shows the new state's totals.
3. **Given** the visitor adds, moves, or removes counties in districts, **When** the districts change, **Then** the stat block does not change, because it describes the whole state and not any district.
4. **Given** a page load with a seed in the address, **When** the same seed is loaded again, **Then** the stat block shows the same numbers.

---

### User Story 3 - Compare Against the District Result (Priority: P2)

A visitor can read the statewide split next to the district control summary and see how the two compare, for example a side with 49% of voters that controls 8 of 10 districts.

**Why this priority**: It is the purpose of the data, but the comparison is made by reading two blocks side by side, so it needs no extra behavior beyond good placement.

**Independent Test**: Load a map, view the stat block and the district control summary on the same screen without scrolling between them, and confirm both use the same side names and colors.

**Acceptance Scenarios**:

1. **Given** the page is displayed on a desktop-width screen, **When** the visitor looks at the side panel, **Then** the stat block and the district control summary are both visible together.
2. **Given** a phone-width screen, **When** the visitor scrolls the page, **Then** the stat block stays readable and appears next to or right above the district control summary.
3. **Given** the stat block and the district control summary, **When** the visitor compares them, **Then** they use the same side names and the same side colors.

### Edge Cases

- A new map has no districts drawn: the stat block still shows the full statewide totals, because it does not depend on districts.
- Voters in counties that are not in any district are still counted, so the statewide totals always cover every county.
- An exactly even split shows a tie with no margin and no leader.
- Very large totals use thousands separators so the numbers stay readable.
- Percentages are rounded to one decimal place, so the shown percentages must still add up to 100.0% (the second side is shown as the remainder if rounding would give 99.9% or 100.1%).
- The block must fit on a 320 px wide screen without horizontal scrolling.
- The block must be readable by screen readers: the totals and the leader are available as text, not only in the visual bar.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The page MUST show a stat block titled to make clear it describes the whole state's voters (for example, "Statewide voters").
- **FR-002**: The stat block MUST show the total number of voters in the state, equal to the sum of the voters in every county.
- **FR-003**: The stat block MUST show, for each side of the current matchup, the side's name, its number of voters, and its percentage of all voters rounded to one decimal place.
- **FR-004**: The side percentages shown MUST add up to exactly 100.0%.
- **FR-005**: The stat block MUST state the statewide leader and margin in percentage points using the same style as the existing county and district details, or state that the state is tied.
- **FR-006**: The stat block MUST include a visual bar whose two segments are proportional to the sides' voter shares and use each side's matchup colors.
- **FR-007**: The stat block MUST count every county, whether or not it is in a district.
- **FR-008**: Changing the matchup MUST change only the side names and colors in the stat block, not the numbers.
- **FR-009**: Starting a new map or loading a different seed MUST update the stat block to the new state's totals.
- **FR-010**: Editing district assignments MUST NOT change the stat block.
- **FR-011**: The stat block MUST be placed in the map's side panel together with the district control summary so both can be read together.
- **FR-012**: The stat block MUST be accessible: the figures and the leader are available as text to assistive technology, and the colors are not the only way to tell the sides apart.
- **FR-013**: Existing behavior (hover, focus, editing, matchup toggle, new map, district colors, and plan status) MUST keep working as before.

### Key Entities

- **Statewide Voter Makeup**: The sum of all counties' side A voters and side B voters. It yields the total voters, each side's share, the leading side, and the margin. It is a view of the existing county data, not new stored data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of checks, the stat block's total and each side's voter count equal the sums over all counties of the displayed map.
- **SC-002**: In 100% of checks, the displayed percentages add up to 100.0% and match the voter counts to within rounding.
- **SC-003**: In 100% of checks, switching the matchup changes the stat block's names and colors without changing any number.
- **SC-004**: In 100% of checks, drawing or erasing districts leaves the stat block unchanged.
- **SC-005**: After a new map is generated, the stat block shows the new totals within 1 second.
- **SC-006**: A visitor can state which side has more voters in the state, and the size of the lead, within 5 seconds of seeing the page.
- **SC-007**: On 320 px wide and 1920 px wide screens, the block is fully visible and has no horizontal scrolling.
- **SC-008**: All existing hover, editing, matchup, and accessibility tests keep passing.

## Assumptions

- "Total state voter makeup" means the statewide count and share of voters for each side of the current matchup, including the combined total. It does not include any breakdown by county type (urban, suburban, rural) or by county.
- The stat block is always visible, with no way to hide it.
- It uses the same side names, colors, rounding, and margin wording as the rest of the page.
- It is shown for the whole state regardless of how many districts exist or how many counties are assigned.
- The data already exists for every county, so no new voter data is needed.
- This feature is independent of features 005 and 006; it only adds a new read-only view.
