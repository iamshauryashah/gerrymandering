# Feature Specification: Gerrymandering Map Explorer

**Feature Branch**: `001-gerrymandering-map-explorer`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "Create a webste called \"Gerrymandering like Gerry the Salamander\". Below the title, make a randomly generated region resebling a US state. Above the map create a toggle that starts at \"Democrats vs Repulicans\", when clicked goes to \"Socialist vs Libaritarians\" and \"Purple vs Orange\". The state should be divided into counties and each county should be a color depending on its voter makup. Whenever you hover over a county, the details should pop up."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Explore a Generated State Map (Priority: P1)

A visitor opens the website, sees the title "Gerrymandering like Gerry the Salamander", and sees a randomly generated, state-like region divided into colored counties representing each county's voter makeup.

**Why this priority**: The generated state map is the core experience and is valuable even without matchup switching or detailed county pop-ups.

**Independent Test**: Open the website and confirm that the title appears above a complete, state-like map whose counties are colored according to voter makeup.

**Acceptance Scenarios**:

1. **Given** a visitor opens the website, **When** the page finishes loading, **Then** the title "Gerrymandering like Gerry the Salamander" is visible above the map.
2. **Given** the map is displayed, **When** the visitor views it, **Then** it appears as one connected state-like region divided into 20 to 60 non-overlapping counties.
3. **Given** the map is displayed, **When** the visitor compares counties, **Then** each county's color reflects which side leads and how large its lead is.
4. **Given** the visitor opens the website again, **When** a new map is generated, **Then** its state shape, county boundaries, or voter makeup differ from the previous visit.

---

### User Story 2 - Inspect County Details (Priority: P2)

A visitor hovers over a county to see that county's voting details without leaving the map.

**Why this priority**: County details explain the colors and make the map informative, but the colored map remains viewable without them.

**Independent Test**: Hover over several counties and verify that each pop-up shows details matching the county under the pointer.

**Acceptance Scenarios**:

1. **Given** the map is displayed, **When** the visitor hovers over a county, **Then** a pop-up shows the county name, total voters, each side's voter count and percentage, the leading side, and the lead margin.
2. **Given** a county pop-up is displayed, **When** the visitor moves to another county, **Then** the pop-up updates to show the newly hovered county's details.
3. **Given** a county pop-up is displayed, **When** the visitor moves the pointer off the map, **Then** the pop-up disappears.
4. **Given** a keyboard user is viewing the map, **When** they move focus to a county, **Then** the same county details are shown as for hover.

---

### User Story 3 - Switch Political Matchups (Priority: P3)

A visitor uses the toggle above the map to view the same counties under different two-sided matchup labels and color schemes.

**Why this priority**: Matchup switching adds playful variety after the core map and county information are available.

**Independent Test**: Click the toggle repeatedly and verify the matchup, map colors, legend, and county pop-up labels change in the required order.

**Acceptance Scenarios**:

1. **Given** the website first loads, **When** the visitor views the toggle, **Then** it displays "Democrats vs Republicans".
2. **Given** the toggle displays "Democrats vs Republicans", **When** the visitor activates it, **Then** it displays "Socialists vs Libertarians" and the map uses that matchup's colors.
3. **Given** the toggle displays "Socialists vs Libertarians", **When** the visitor activates it, **Then** it displays "Purple vs Orange" and the map uses purple and orange.
4. **Given** the toggle displays "Purple vs Orange", **When** the visitor activates it, **Then** it returns to "Democrats vs Republicans".
5. **Given** the visitor switches matchups, **When** they inspect a county, **Then** its boundaries, voter totals, and percentages remain the same while side names and colors match the selected matchup.

### Edge Cases

- If a county is an exact tie, it uses a clearly identifiable neutral color and its pop-up states that the county is tied.
- Very small counties remain hoverable and their details can be accessed by keyboard.
- Pop-ups near the edges of the screen remain fully visible.
- The map, toggle, legend, and pop-ups remain usable on screens from 320 pixels to 1920 pixels wide.
- Rapid repeated toggle activation always ends on the correct matchup in the defined sequence.
- If the map cannot be generated, the visitor sees a friendly message and an option to try again.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The website MUST display the title "Gerrymandering like Gerry the Salamander" as its main heading.
- **FR-002**: The website MUST place a matchup toggle above the map and below the title.
- **FR-003**: The toggle MUST start on "Democrats vs Republicans" and cycle in this order: "Socialists vs Libertarians", "Purple vs Orange", then back to "Democrats vs Republicans".
- **FR-004**: The website MUST generate a fictional, connected, state-like region each time the website is loaded.
- **FR-005**: The generated state MUST be divided into 20 to 60 non-overlapping counties that together cover the whole state.
- **FR-006**: Each county MUST have a fictional name, a total voter count, and voter counts for two sides that add up to the total.
- **FR-007**: Each county's color MUST identify its leading side, use a stronger shade for a larger lead, and use a neutral color for a tie.
- **FR-008**: The map MUST include a legend explaining the active matchup's side colors, tie color, and margin shading.
- **FR-009**: Changing the matchup MUST update side labels, county colors, the legend, and pop-up labels without changing the generated geography or voter numbers.
- **FR-010**: Hovering over a county MUST show its name, total voters, each side's count and percentage, the leading side or tie status, and the lead margin.
- **FR-011**: County details MUST also be available through keyboard focus.
- **FR-012**: The website MUST visibly identify the county currently being inspected.
- **FR-013**: The website MUST state that the map and voter data are randomly generated and fictional.
- **FR-014**: Displayed percentages MUST be rounded consistently and labeled clearly, and voter counts MUST be shown as whole numbers.

### Key Entities

- **Generated State**: A fictional state-like region with an outline and a set of counties; it remains unchanged until the website is reloaded.
- **County**: A distinct area within the generated state with a name, boundary, total voter count, voter count for each side, leading side, and lead margin.
- **Matchup**: A named pair of opposing sides with display labels and colors; the three matchups are Democrats vs Republicans, Socialists vs Libertarians, and Purple vs Orange.
- **County Details**: The information shown in a pop-up for the currently inspected county.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Visitors see the title, toggle, map, and legend within 3 seconds of opening the website.
- **SC-002**: Across 100 page loads, every generated map is a connected region with 20 to 60 counties and no gaps or overlaps.
- **SC-003**: Across 20 consecutive page loads, at least 18 maps have visibly different state shapes or county layouts.
- **SC-004**: County details appear within 0.5 seconds of hovering over or focusing on a county.
- **SC-005**: In testing, 100% of inspected county pop-ups match the county being highlighted.
- **SC-006**: 90% of first-time visitors can identify the leading side of a chosen county and switch to all three matchups within 1 minute without instructions.
- **SC-007**: Each matchup change updates every county color and legend label within 1 second.

## Assumptions

- The website is a standalone, publicly viewable experience with no sign-in, saved maps, or user-entered data.
- The generated state is a fictional state-like shape, not a copy of a real US state.
- Each county is modeled as a two-way vote between the active matchup's two sides; third parties and non-voters are excluded.
- Changing the matchup relabels and recolors the same generated vote distribution instead of generating new voter numbers.
- The requested labels are corrected to "Republicans", "Socialists", and "Libertarians".
- A new random map is generated on each page load; a separate regenerate button is out of scope.
- The website is for educational entertainment and does not use real election, census, or geographic data.
- Default colors are blue and red for Democrats vs Republicans, rose and gold for Socialists vs Libertarians, and purple and orange for Purple vs Orange.
