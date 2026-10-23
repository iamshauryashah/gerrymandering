# Feature Specification: Dense County Map With Contiguous, Balanced Districts

> **Superseded by [010](../010-precinct-brush-tool/spec.md) for the count**: the 90 to 120 counties (FR-001) are now 500 to 800 precincts, and the 400-square-pixel and 160-square-pixel minimums no longer apply (every precinct stays reachable by keyboard). Contiguity, the balance check and the plan status are unchanged.

**Feature Branch**: `004-balanced-contiguous-districts`

**Created**: 2026-10-18

**Status**: Draft

**Clarification**: 2026-10-18: Clicks that would make a district non-contiguous are blocked. The 10,000-voter balance rule is shown as a pass/fail check rather than blocking clicks, because districts are built one county at a time.

**Input**: User description: "make the counties in the map 90-120. It is okay if they are small. Also make it so that every congressional district should have to be contagios and has to be within 10,000 voters of every other county. Aditionally, democrats should be fucused in urban areas with big dense populations, and republicans should be in rural counties."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explore a Map With Many Small Counties (Priority: P1)

A visitor loads the website and sees a state divided into 90 to 120 counties. Dense urban counties are mostly won by Democrats and spread-out rural counties are mostly won by Republicans, so the map looks like a realistic urban–rural divide.

**Why this priority**: More counties and a realistic voter pattern give visitors enough detail to draw meaningful and gerrymandered districts.

**Independent Test**: Load the website many times and confirm each state has 90 to 120 counties, every county can be hovered and clicked, and urban counties lean Democratic while rural counties lean Republican.

**Acceptance Scenarios**:

1. **Given** a newly generated state, **When** the page finishes loading, **Then** it contains between 90 and 120 counties, inclusive.
2. **Given** the map is shown, **When** the visitor hovers over, focuses on, or clicks the smallest county, **Then** it responds the same way as any other county.
3. **Given** the Democrats vs Republicans matchup, **When** the visitor inspects urban counties, **Then** most of them are won by Democrats.
4. **Given** the Democrats vs Republicans matchup, **When** the visitor inspects rural counties, **Then** most of them are won by Republicans.
5. **Given** the visitor inspects a county, **When** its details appear, **Then** they include its type (urban, suburban, or rural) and its population density.

---

### User Story 2 - Draw Only Contiguous Districts (Priority: P2)

While editing a district, a visitor can only make changes that keep every district in one connected piece. Clicks that would break a district apart are blocked with a short explanation.

**Why this priority**: Contiguity is a basic rule of real redistricting, and it must hold for every edit.

**Independent Test**: Select a district, then try to add a county that does not touch it, remove a county that connects two parts of it, and take a county that connects two parts of another district. Confirm each click is blocked and explained, while valid clicks still work.

**Acceptance Scenarios**:

1. **Given** the selected district is empty, **When** the visitor clicks any county, **Then** the county is added (or moved from its current district, if allowed by rule 4).
2. **Given** the selected district has counties, **When** the visitor clicks a county that shares a border with the district, **Then** the county is added to the district.
3. **Given** the selected district has counties, **When** the visitor clicks a county that does not share a border with the district, **Then** nothing changes and a message explains that districts must be connected.
4. **Given** a county belongs to another district, **When** taking it would split that other district into separate pieces, **Then** nothing changes and a message explains why.
5. **Given** a county belongs to the selected district, **When** removing it would split the selected district into separate pieces, **Then** nothing changes and a message explains why.
6. **Given** a click is blocked, **When** the visitor makes a valid click afterward, **Then** it is applied normally and the message goes away.

---

### User Story 3 - Check Population Balance (Priority: P3)

A visitor sees whether every district is within 10,000 voters of every other district, and which districts are too big or too small.

**Why this priority**: Equal population is a core redistricting rule. Visitors need to see if their plan meets it, but it can only be judged as a whole plan.

**Independent Test**: Build districts with different sizes and confirm the balance check fails with a clear explanation. Then adjust until the largest and smallest districts differ by 10,000 voters or less and confirm the check passes.

**Acceptance Scenarios**:

1. **Given** any plan, **When** the visitor views the control total area, **Then** a balance check shows pass or fail, the largest district voter count, the smallest district voter count, the difference between them, and the 10,000-voter limit.
2. **Given** any district is empty, **When** the balance check runs, **Then** it fails and explains that every district needs counties.
3. **Given** every district has counties, **When** the largest and smallest district voter counts differ by 10,000 or less, **Then** the balance check passes.
4. **Given** every district has counties, **When** the difference is more than 10,000, **Then** the check fails and the district list marks which districts are above or below the allowed range.
5. **Given** counties are unassigned, **When** the visitor views the plan status, **Then** it shows that the plan is not complete, how many counties are unassigned, and whether the balance check passes.
6. **Given** every county is assigned, every district is contiguous, and the balance check passes, **When** the visitor views the plan status, **Then** it says the plan is valid.

### Edge Cases

- A district's first county can be any county, including one far from all other districts.
- The visitor can remove the last county from a district, making it empty; an empty district is never split.
- A county that touches the selected district at only one point (a corner) does not count as sharing a border.
- Moving a county from another district is allowed only when the remaining counties of that district stay connected; moving the only county out of a district leaves it empty and is allowed.
- Rapid clicks are checked one at a time, in order, against the latest district shapes.
- Very small counties may be hard to click with a mouse or finger; they must still be reachable with the keyboard and show details on focus.
- The balance check uses each district's total voters, which are the same under every matchup, so changing the matchup never changes balance results.
- Because voter makeup is fixed when a state is generated, the same counties are urban and rural under every matchup. In the other matchups, the side listed first (Socialists, Purple) takes the urban role and the side listed second (Libertarians, Orange) takes the rural role.
- Every generated state must allow at least one complete plan where every county is assigned, every district is contiguous, and every district is within 10,000 voters of every other district.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each generated state MUST contain between 90 and 120 counties, inclusive.
- **FR-002**: Every county MUST remain hoverable, clickable, and keyboard-focusable regardless of its size; the 400-square-pixel minimum from earlier features no longer applies.
- **FR-003**: Each county MUST be classified as urban, suburban, or rural based on its population density, and its details MUST show its type and density.
- **FR-004**: Urban counties MUST have the highest population densities and the largest voter counts per unit of area; rural counties MUST have the lowest.
- **FR-005**: Under the Democrats vs Republicans matchup, at least 80% of urban counties MUST be won by Democrats and at least 80% of rural counties MUST be won by Republicans.
- **FR-006**: Each generated state MUST allow at least one complete plan in which every county is assigned, every district is contiguous, and all district voter counts are within 10,000 of each other.
- **FR-007**: A district is contiguous when all its counties are connected through shared borders, not single-point corners.
- **FR-008**: While a district is selected, a click that adds or moves a county MUST be blocked if the selected district is non-empty and the county does not share a border with it.
- **FR-009**: A click that moves a county out of another district MUST be blocked if the remaining counties of that district would not be contiguous.
- **FR-010**: A click that removes a county from the selected district MUST be blocked if the remaining counties of that district would not be contiguous.
- **FR-011**: A blocked click MUST leave all assignments unchanged and show a short message explaining which rule blocked it.
- **FR-012**: The website MUST show a balance check that passes only when every district has counties and the largest and smallest district voter counts differ by 10,000 voters or less.
- **FR-013**: The balance check MUST show the largest and smallest district voter counts, their difference, and the 10,000-voter limit.
- **FR-014**: When the balance check fails, each district list entry MUST indicate whether that district is empty, too large, too small, or within range relative to the rest of the plan.
- **FR-015**: The website MUST show an overall plan status that is valid only when every county is assigned, every district is contiguous, and the balance check passes.
- **FR-016**: The balance check and plan status MUST update immediately after every applied change.
- **FR-017**: All behaviors from `003-unassigned-county-districts` remain unchanged except where this specification replaces them, including blank starting districts, unassigned counties, and click-to-remove.

### Key Entities

- **County**: A generated area with a name, shape, voter makeup, population density, and type (urban, suburban, or rural).
- **Congressional District**: A numbered, contiguous group of zero or more counties with combined voter totals and a balance status (empty, too large, too small, or within range).
- **Balance Check**: The comparison of the largest and smallest district voter counts against the 10,000-voter limit.
- **Plan Status**: Whether the current plan is complete, contiguous, and balanced, plus the number of unassigned counties.
- **Blocked Edit Message**: A short explanation shown when a click would break a district's contiguity.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Across 100 page loads, 100% of generated states have 90 to 120 counties and allow at least one complete, contiguous plan within the 10,000-voter limit.
- **SC-002**: Across 100 generated states, at least 80% of urban counties are won by Democrats and at least 80% of rural counties are won by Republicans.
- **SC-003**: In testing, 100% of edits that would break a district's contiguity are blocked with an explanation, and 100% of contiguous edits are applied.
- **SC-004**: In testing, the balance check and plan status match the current assignments 100% of the time.
- **SC-005**: Every county, including the smallest, can be inspected and assigned by mouse or keyboard on screens from 320 to 1920 pixels wide.
- **SC-006**: The page still finishes loading within 2 seconds, and each edit updates the map, list, and status within 1 second.

## Assumptions

- "Within 10,000 voters of every other county" means every congressional district must be within 10,000 voters of every other district.
- The 10,000-voter limit is fixed and the same for every generated state and matchup.
- The number of districts is still randomly chosen between 8 and 20, and all districts still start empty.
- Plans that break the balance rule are allowed while editing so visitors can build districts step by step; the plan is only marked valid when every rule is met.
- Suburban counties have densities between urban and rural counties and may be won by either side.
- Small counties may be harder to see, but small size alone is acceptable; they may be shown smaller than before.
- There is no automatic balancing, auto-assign, undo, reset, save, or sharing in this feature.
- All county, voter, and district data remains fictional.
