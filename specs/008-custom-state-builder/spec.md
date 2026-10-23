# Feature Specification: Custom State Builder

**Feature Branch**: `008-custom-state-builder`

**Created**: 2026-10-19

**Status**: Draft

> **Superseded by [009](../009-city-population-outlines/spec.md)**: clicking a city now selects it (a **Remove city** button, or Delete and Backspace on the map, removes it); the "random states from existing seeds are unchanged" rule (FR-018) no longer applies, because random states now have cities, a population baseline, and new outlines; and links are `v2` with each city's population (`v1` links still open with 100,000 voters per city).

**Input**: User description: "make an option to make your own hpothetical state by just clicking where cities should be and changing voter makeup."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Place Cities by Clicking (Priority: P1)

A visitor chooses to build their own state instead of getting a random one. They see the empty state outline and click anywhere inside it to drop a city. Each city pulls the surrounding counties into smaller, denser counties with more voters, the way real cities do, and the map redraws so the visitor can see the effect of every click. Clicking an existing city removes it.

**Why this priority**: Placing cities is the core of the request and the main way the visitor shapes the state.

**Independent Test**: Open the builder, click three spots inside the outline, and confirm three city markers appear, the counties redraw around them with smaller counties near the cities, and clicking a marker removes that city.

**Acceptance Scenarios**:

1. **Given** the visitor is in the builder, **When** they click a spot inside the state outline, **Then** a city marker appears there and the counties redraw so that counties near the city are smaller and hold more voters than counties far from any city.
2. **Given** a city exists, **When** the visitor clicks that city's marker, **Then** the city is removed and the counties redraw.
3. **Given** the visitor clicks outside the state outline, **When** the click is handled, **Then** no city is added and a short message explains that cities must be inside the state.
4. **Given** the visitor clicks too close to an existing city, **When** the click is handled, **Then** no city is added and a short message explains that cities must be further apart.
5. **Given** the maximum number of cities has been placed, **When** the visitor clicks another spot, **Then** no city is added and a message explains the limit.
6. **Given** a keyboard visitor, **When** they use the builder, **Then** they can move a placement cursor over the map with the arrow keys and add or remove a city with Enter, with the same results as clicking.
7. **Given** a touch visitor, **When** they tap inside the outline, **Then** a city is added exactly as a click would.
8. **Given** no cities are placed, **When** the visitor looks at the map, **Then** the state is made of fairly even, similar-sized counties, as an all-rural state.

---

### User Story 2 - Change the Voter Makeup (Priority: P1)

A visitor adjusts the voter makeup of their state with simple controls: the overall split between the two sides of the current matchup, and how strongly the cities lean compared with the countryside. As the visitor changes a control, the county colors and the statewide stat block update at once.

**Why this priority**: The voter makeup is the second half of the request, and it decides how the state can be gerrymandered.

**Independent Test**: Move the statewide split control and confirm the county colors and the statewide stat block change to match. Move the city-lean control and confirm that cities and the countryside show different colors than before.

**Acceptance Scenarios**:

1. **Given** the visitor is in the builder, **When** they set the statewide split to a chosen value (for example, 45% for side A), **Then** the state's total voters come out at that split to within 0.5 percentage points and the county colors update.
2. **Given** a state with cities, **When** the visitor raises the city lean toward side A, **Then** county colors near cities shift toward side A and the countryside shifts toward side B, while the statewide split stays at its chosen value.
3. **Given** the city lean is set to neutral, **When** the map is displayed, **Then** cities and countryside lean about the same way, with only small random differences between counties.
4. **Given** the visitor changes either voter control, **When** the change is applied, **Then** the statewide stat block (feature 007) shows the new totals within 1 second.
5. **Given** the visitor switches the matchup, **When** the colors change, **Then** the side names and colors change, and the split and lean settings keep their meaning for each side as labeled.
6. **Given** the visitor drags a control to its extremes, **When** the value is applied, **Then** the state stays valid and drawable; the controls only allow values within a limited range.
7. **Given** the same cities and the same voter settings, **When** the state is rebuilt, **Then** it comes out identical every time.

---

### User Story 3 - Start Drawing Districts on the Custom State (Priority: P1)

When the visitor is happy with their state, they click a button to start using it. The page leaves the builder and shows the normal map with empty districts so the visitor can draw districts on their own hypothetical state. All the usual features work on it.

**Why this priority**: The custom state is only useful if it can be used for the district-drawing experience that the app is built for.

**Independent Test**: Build a state with a few cities, finish the builder, and confirm the district list is empty, editing works, the balance and contiguity rules apply, and the statewide stat block matches the builder's setting.

**Acceptance Scenarios**:

1. **Given** the visitor has built a state, **When** they choose to use it, **Then** the builder closes and the map shows the custom state with all districts empty.
2. **Given** the custom state is in use, **When** the visitor edits districts, **Then** the same editing, balance (10%) and connected-district rules apply as for a random state.
3. **Given** the custom state is in use, **When** the visitor checks the plan status, **Then** it behaves as for a random state.
4. **Given** the custom state is in use, **When** the visitor chooses "New map", **Then** they get a new random state as before, after the usual confirmation if districts were drawn.
5. **Given** the visitor is in the builder, **When** they choose to cancel, **Then** they return to the state they were viewing before, with their districts unchanged.
6. **Given** the visitor's chosen cities and settings could not produce a state that can be split into the required balanced districts, **When** they choose to use it, **Then** the page does not use it and explains in plain words what to change.

---

### User Story 4 - Keep and Share the Custom State (Priority: P2)

A visitor can copy the page address and open it later, or send it to someone else, and see the same custom state with its cities and voter makeup. A visitor can also clear everything in the builder and start over, or ask for a different state outline.

**Why this priority**: It makes custom states shareable and repeatable, but the builder works without it.

**Independent Test**: Build a state, copy the address, open it in a new tab, and confirm the same cities, county layout, and statewide numbers appear.

**Acceptance Scenarios**:

1. **Given** a custom state is in use, **When** the visitor reloads the page or opens the same address in another tab, **Then** the same state appears with identical cities, counties, and voter numbers.
2. **Given** the visitor is in the builder, **When** they choose "Clear cities", **Then** all cities are removed and the voter settings return to their defaults, after a confirmation if any cities exist.
3. **Given** the visitor is in the builder, **When** they choose "New outline", **Then** a new random state outline replaces the old one and the cities that fall outside it are removed with a message saying how many were removed.
4. **Given** an address that contains an invalid or damaged custom state, **When** the page loads, **Then** the page shows a friendly message and a new random state instead of an error.

### Edge Cases

- The visitor places no cities: the state is valid, with even-sized counties (all rural), and the city-lean control has no visible effect.
- A city is placed right at the edge of the outline: the counties around it still form a valid, connected map.
- Many cities are placed close together: the minimum distance between cities keeps counties above the smallest clickable size.
- The visitor changes the voter controls rapidly: the display keeps up and ends on the last value chosen.
- The visitor enters the builder while districts are drawn: they are asked to confirm, because rebuilding the map will clear the districts.
- The statewide split is set to an exact tie: the stat block shows a tie, and the state is valid.
- The page is narrow (320 px wide): the builder controls fit without horizontal scrolling, and the map remains clickable.
- A visitor with a screen reader: the number of cities, the statewide split, and the city lean are available as text; changes are announced.
- Voters, cities, and counties are fictional; the notice about fictional data still applies.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The page MUST offer a clearly labeled way to start building a custom state, next to "New map".
- **FR-002**: In the builder, the visitor MUST be able to add a city by clicking or tapping a spot inside the state outline, and remove a city by clicking or tapping its marker.
- **FR-003**: Every city MUST be shown as a visible marker on the map while the visitor is in the builder.
- **FR-004**: Placing, moving, or removing a city MUST redraw the counties so that counties near cities are smaller and hold more voters than counties far from cities, and the redrawn map MUST be shown within 1 second.
- **FR-005**: Clicks outside the outline, too close to another city, or beyond the city limit MUST NOT add a city and MUST show a short, specific message.
- **FR-006**: The builder MUST allow from 0 up to 12 cities, and cities MUST be at least a minimum distance apart so that every county stays large enough to click.
- **FR-007**: Keyboard visitors MUST be able to add and remove cities with the arrow keys and Enter, with the same limits as pointer use.
- **FR-008**: The builder MUST provide a control for the statewide split between the two sides of the current matchup, limited to a range of 30% to 70% for either side, and the resulting statewide total MUST match the chosen split to within 0.5 percentage points.
- **FR-009**: The builder MUST provide a control for city lean, which sets how strongly city counties lean toward one side compared with rural counties, from strongly toward side B through neutral to strongly toward side A, while the statewide split stays at its chosen value.
- **FR-010**: Changing either voter control MUST update the county colors and the statewide stat block within 1 second.
- **FR-011**: The same cities, voter settings, and outline MUST always produce exactly the same state.
- **FR-012**: Every state that the builder offers for use MUST satisfy the same rules as a random state: every county is one connected piece and large enough to click, and a complete plan of connected districts within the 10% balance limit is possible. If the visitor's choices cannot satisfy this, the page MUST NOT let them use the state and MUST say what to change.
- **FR-013**: The visitor MUST be able to finish the builder and use the state, after which the map shows the custom state with all districts empty and the usual editing, balance, and status features.
- **FR-014**: The visitor MUST be able to cancel the builder and return to the previous state with its districts unchanged.
- **FR-015**: Entering the builder or rebuilding while districts are drawn MUST ask for confirmation before any districts are lost.
- **FR-016**: The visitor MUST be able to clear all cities and reset the voter settings, and to request a new random outline; cities that fall outside a new outline MUST be removed with a message that says how many.
- **FR-017**: A custom state MUST be reproducible from the page address: opening the same address MUST show the same state, and an invalid address MUST fall back to a new random state with a friendly message.
- **FR-018**: "New map" MUST continue to create a new random state, and all existing features (hover, focus, editing, matchup toggle, district colors, balance rule, plan status, statewide stat block) MUST keep working on both random and custom states.
- **FR-019**: The builder controls MUST be accessible: labeled, usable by keyboard and touch, announcing changes to assistive technology, and not relying on color alone.
- **FR-020**: The builder MUST fit on screens from 320 px to 1920 px wide without horizontal scrolling.

### Key Entities

- **Custom State Plan**: The visitor's choices for one state: the outline, the list of city positions, the statewide split, and the city lean. It is all that is needed to rebuild the state.
- **City**: A point inside the outline that makes nearby counties smaller and denser and gives the area its city character.
- **Voter Settings**: The statewide split between the two sides and the city lean.
- **Generated State**: The counties, voters, and reference data produced from a Custom State Plan, in the same form as a random state, so the rest of the app treats it the same way.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can build a state with at least three cities and a changed voter split, and start drawing districts on it, within 2 minutes without instructions.
- **SC-002**: In 100% of checks, after placing or removing a city, the map redraws within 1 second and counties within the city's area are smaller than the state's average county size.
- **SC-003**: In 100% of checks, the statewide total matches the chosen split to within 0.5 percentage points.
- **SC-004**: In 100% of checks, with a positive city lean toward a side, that side's share among city counties is higher than its share among rural counties; with neutral lean the difference is small.
- **SC-005**: In 100% of checks, the same plan produces an identical state on every rebuild and when opened from its address.
- **SC-006**: In 100% of checks, a state accepted for use passes the same validity checks as random states (connected counties, clickable county size, and a possible balanced plan).
- **SC-007**: In 100% of checks, invalid clicks (outside the outline, too close, over the limit) show a message and leave the state unchanged.
- **SC-008**: On 320 px and 1920 px wide screens, all builder controls are visible and usable, with no horizontal scrolling.
- **SC-009**: All existing tests for random-state features keep passing.

## Assumptions

- The state outline is generated randomly, as in a random state; the visitor does not draw it, but can ask for a new one. "Just clicking where cities should be" means the visitor's own work is placing cities and choosing the voter makeup.
- Every city is the same size and strength; there is no per-city setting in this version.
- Voter makeup is controlled by two settings: the statewide split and the city lean. Per-county voter editing is out of scope.
- The number of counties and districts for a custom state stays within the same ranges as random states, and is chosen automatically from the number of cities and the outline.
- The statewide split range of 30% to 70% is wider than the 48% to 52% used for random states, so visitors can explore lopsided and close states; the 10% balance rule and connected-district rule are unchanged.
- The custom state is saved only in the page address, with no accounts or stored files.
- Counties that are far from all cities stay rural, and counties near a city are urban or suburban, in the same way as for random states.
- This feature builds on features 005 (random state generation and New map) and 007 (statewide stat block), and leaves other features unchanged.
