# Feature Specification: City Population, Growing States, Realistic Outlines, and Smaller Dense Counties

> **Superseded by [010](../010-precinct-brush-tool/spec.md) for the building block**: the counties here are now precincts (500 to 800 per state), and denser precincts are still smaller. Everything else in this feature is unchanged.

**Feature Branch**: `009-city-population-outlines`

**Created**: 2026-10-19

**Status**: Draft

**Input**: User description: "make a slider in the build a state part of the app so that you can chose the population of a city. Also increase the population of the state when cities are added. Finnally the state outlines should be a little more realistic." Added later: "Also can you make the counties with higher density smaller"

**Builds on**: [008](../008-custom-state-builder/spec.md) (the state builder), [005](../005-new-map-realistic-state/spec.md) (random states and outlines), and [007](../007-state-voter-makeup/spec.md) (the statewide stat block).

**Supersedes**:
- 008 FR-002 and its first user story, where clicking a city removed it. Clicking a city now selects it, and a separate action removes it (see User Story 1).
- 008 FR-018 and its test that random states from existing seeds never change. Outlines change in this feature, so the same seed now gives a different map than before.
- 005's list of required outline features (panhandle, river, coast, notch). It is replaced by the realism rules below; the one-piece, no-holes, and clickable-county rules stay.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose How Big Each City Is (Priority: P1)

In the builder, every city has its own population. A slider lets the visitor set the population of the selected city, from a small town to a big metropolis. Placing a city selects it, and clicking a different city selects that one, so the visitor can place a few cities and then size each one.

**Why this priority**: It is the main new control the visitor asked for, and it makes the builder far more expressive than same-size cities.

**Independent Test**: Place two cities, select the first, set its slider to the maximum, select the second, set its slider to the minimum, and confirm each city keeps its own value and the counties around the big city hold many more voters than those around the small one.

**Acceptance Scenarios**:

1. **Given** the visitor is in the builder, **When** they place a city, **Then** the city becomes the selected city, is clearly highlighted on the map, and the population slider shows its population in voters, for example "City 2: 100,000 voters".
2. **Given** a city is selected, **When** the visitor moves the population slider, **Then** that city's population changes, the voters in the counties around it change, and the map and the statewide stat block update within 1 second.
3. **Given** two cities with different populations, **When** the visitor clicks or taps the other city, or moves the keyboard cursor onto it and presses Enter, **Then** that city becomes selected and the slider shows its own value.
4. **Given** no city is selected (no cities placed, or the selected city was removed), **When** the visitor looks at the slider, **Then** it is disabled and a short hint says to place or select a city first.
5. **Given** a city is selected, **When** the visitor chooses "Remove city" or presses Delete or Backspace, **Then** the city is removed, nothing is selected, and the map redraws.
6. **Given** the visitor places a new city, **When** it is added, **Then** it starts at the population the visitor last chose with the slider (100,000 voters before any choice).
7. **Given** a bigger city and a smaller city, **When** the visitor compares the counties around them, **Then** the counties around the bigger city hold more voters on average, and its counties are the most populous on the map.
8. **Given** a keyboard visitor, **When** they use the builder, **Then** they can select a city with the cursor and Enter, change its population with the slider's arrow keys, and remove it with Delete, with the same results as the pointer.
9. **Given** a touch visitor, **When** they tap a city, drag the slider, and tap the Remove city button, **Then** it works exactly like a pointer.

---

### User Story 2 - The State Grows With Its Cities (Priority: P1)

Cities are where people live, so adding a city makes the state bigger. The state's total population rises by about the new city's population, and it falls again when the city is removed or made smaller.

**Why this priority**: It makes the voter numbers honest: a state with big cities should have more voters than one with no cities, and the visitor can see it in the statewide stat block.

**Independent Test**: Note the statewide total voters with no cities, add a city, and confirm the total rises by about that city's population; raise the city's slider and confirm the total rises again; remove the city and confirm the total returns to about where it started.

**Acceptance Scenarios**:

1. **Given** a state with some cities, **When** the visitor adds a city of population P, **Then** the state's total voters rise by P, give or take 25%.
2. **Given** a city of population P, **When** the visitor removes it, **Then** the state's total voters fall by P, give or take 25%.
3. **Given** a city, **When** the visitor raises or lowers its population slider, **Then** the state's total voters rise or fall by about the same amount (give or take 25%) as the slider changed.
4. **Given** two states that differ only in one city's population, **When** their totals are compared, **Then** the one with the bigger city has more total voters.
5. **Given** a state with no cities, **When** it is displayed, **Then** its total voters are about what an all-rural state had before this change, and every city adds to that baseline.
6. **Given** the statewide stat block (feature 007), **When** a city is added, removed, or resized, **Then** the total, each side's voters and percentages, and the bar all update, and the statewide split still matches the split slider to within 0.5 percentage points.
7. **Given** the state has grown or shrunk, **When** the visitor starts drawing districts, **Then** the ideal district size, the 10% balance rule, and a possible balanced plan all follow the new total.
8. **Given** a size or placement of cities that cannot make a map splitting into fair districts, **When** the build fails, **Then** the same failure message as before is shown and Use this state stays disabled.

---

### User Story 3 - More Realistic State Outlines (Priority: P1)

State outlines look more like real states. Instead of a smooth, lumpy oval with an odd arm, an outline mixes straight, surveyed borders that meet at corners with irregular natural borders such as a river or a coast. This applies to random states, to states in the builder, and to every new outline.

**Why this priority**: The outline is the first thing a visitor sees, and it is part of what makes the made-up state feel believable.

**Independent Test**: Generate 100 outlines and confirm, for each, that it has at least two straight borders that meet at a corner, at least one irregular natural border, no needle-thin spikes, and does not look like an oval.

**Acceptance Scenarios**:

1. **Given** a random state or a new builder outline, **When** it is displayed, **Then** it has at least two straight borders, each at least 150 map pixels long (about a fifth of the map width), meeting at a corner of between 60° and 120°.
2. **Given** the same outline, **When** it is displayed, **Then** at least one border is a natural, irregular line (a river, a coast, or a mountain boundary) that wiggles gently over at least a fifth of the state's perimeter.
3. **Given** any outline, **When** it is displayed, **Then** it is one connected piece with no holes and no crossing lines, it does not look like an oval or circle (it fills no more than 80% of its bounding box and has at least four distinct corners), and every arm, peninsula, or notch is at least 50 map pixels wide.
4. **Given** 100 different seeds, **When** their outlines are compared, **Then** they are visibly varied: no two share the same shape, and a mix of boxy, tilted, and irregular outlines appears.
5. **Given** an outline, **When** the map is drawn, **Then** counties are still at least 160 px² and one piece each, districts can still be balanced and connected, and every earlier feature works as before.
6. **Given** the visitor chooses "New outline" in the builder, **When** the new outline appears, **Then** it follows the same realism rules, and cities that fall outside it are removed with a message, as before.
7. **Given** the same seed or the same custom link, **When** the map is rebuilt, **Then** the outline is the same every time.

---

### User Story 4 - Crowded Counties Are Drawn Smaller (Priority: P1)

The more crowded a county is, the smaller it is drawn. Cities show up as clusters of small counties and open country as a few large ones, the way real maps look. This applies to every state, random or built, and it works together with city population: around a bigger city the counties are smaller still.

**Why this priority**: County size is one of the first things a visitor sees on the map. Today a dense county is only somewhat likely to be small; this makes the link clear and dependable, and it makes the map read like a real one at a glance.

**Independent Test**: Generate a state, rank its counties by density and by size, and confirm the densest counties are clearly the smallest and the sparsest clearly the largest; then place a city and raise its population and confirm the counties around it shrink.

**Acceptance Scenarios**:

1. **Given** any state, **When** its counties are ranked by density (voters per square mile) and by drawn size, **Then** the two rankings agree strongly: higher density means smaller size, with a rank correlation of at least 0.8 in strength.
2. **Given** any state, **When** the densest tenth of its counties is compared with the sparsest tenth, **Then** the densest tenth are on average at most one third the size of the sparsest tenth.
3. **Given** any state, **When** the counties are grouped by the labels urban, suburban, and rural, **Then** the average urban county is smaller than the average suburban county, which is smaller than the average rural county.
4. **Given** a city, **When** the counties around it are compared, **Then** the county nearest its center is among the smallest, and counties grow larger on average the further they are from it.
5. **Given** a bigger city and a smaller city in the same place, **When** the maps are compared, **Then** the counties around the bigger city are smaller on average than those around the smaller one.
6. **Given** a state with no cities, **When** it is displayed, **Then** counties are still bigger where they are emptier and smaller where they are fuller, while sizes stay fairly even (no county more than four times, or less than a quarter of, the average).
7. **Given** any state, **When** it is displayed, **Then** every county is still at least 160 px² and one piece, the state still has 90 to 120 counties, and a complete balanced plan of connected districts is still possible.
8. **Given** the same seed or the same custom link, **When** the map is rebuilt, **Then** the counties are identical every time.

---

### User Story 5 - Sizes Are Saved and Shared (Priority: P2)

A custom state's link carries each city's population, so opening the link shows the same cities with the same sizes. Clearing the cities resets everything, as before.

**Why this priority**: Sharing already works for cities and voter settings; city sizes must be part of it or links would not reproduce the state.

**Independent Test**: Build a state with three different-sized cities, use it, open the address in a new tab, and confirm each city, its population, and the statewide total are the same.

**Acceptance Scenarios**:

1. **Given** a custom state in use, **When** the visitor reloads or opens its address elsewhere, **Then** the same cities with the same populations appear, and the counties, voters, and statewide numbers are identical.
2. **Given** a link made before this feature (without city populations), **When** it is opened and its cities still fit the outline, **Then** every city opens at the default 100,000 voters; **otherwise** the usual "link isn't valid" message and a random map appear.
3. **Given** a damaged link, or one with a population outside the allowed range, **When** the page loads, **Then** the friendly message and a random map appear instead of an error.
4. **Given** the visitor chooses "Clear cities", **When** it is confirmed, **Then** all cities (with their populations) are removed and the voter settings reset, as before.
5. **Given** the visitor cancels the builder, **When** they return, **Then** their previous map is back, unchanged.

### Edge Cases

- A visitor places 12 cities and sets them all to the maximum: the state becomes very large; numbers use thousands separators, the stat block still fits, and the map either builds or shows the failure message.
- One huge city and several tiny ones: the huge city's voters are spread over many counties, so no single county exceeds the usual share of an ideal district.
- The selected city is removed, or "New outline" drops it: nothing is selected and the slider is disabled.
- A city's population is changed rapidly by dragging: the display keeps up and ends on the last value.
- Two cities selected at once is not possible: exactly one city (or none) is selected.
- A city on the edge of the state has fewer counties around it: its voters are still all counted in the state's total.
- Switching the matchup in the builder changes names and colors but not populations or totals.
- Older shared links and seeds look different now because outlines changed, and some old custom links no longer fit their outline.
- On a 320 px wide screen, the slider, its label, and the Remove city button fit with no horizontal scrolling.
- A screen reader hears which city is selected, its population, and any change; the selected city is not shown by color alone.
- The county count stays between 90 and 120, so when counties around cities get smaller, counties in open country get larger; none may be so large that a balanced plan becomes impossible.
- A city at the edge of the state still gets small counties around it, as far as the outline and the 160 px² minimum allow.
- Two cities close together: their small counties merge into one dense cluster rather than ringing each city separately.
- A county's size is never changed by drawing districts or by the matchup; only the state itself decides it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every city MUST have a population, in voters, chosen from 10,000 to 300,000 in steps of 10,000, with 100,000 as the starting value.
- **FR-002**: The builder MUST offer a slider labeled "City population" that sets the population of the selected city and shows its value in words (for example "City 2: 150,000 voters") and in the slider's spoken value.
- **FR-003**: Placing a city MUST select it, and exactly one city or none MUST be selected at any time. The selected city MUST be highlighted with a mark that does not depend on color alone.
- **FR-004**: Clicking, tapping, or pressing Enter with the keyboard cursor on a city MUST select it and MUST NOT remove it.
- **FR-005**: A "Remove city" button, and the Delete and Backspace keys, MUST remove the selected city and clear the selection.
- **FR-006**: With no city selected, the slider MUST be disabled and a hint MUST tell the visitor to place or select a city.
- **FR-007**: A new city MUST start at the population last chosen with the slider, or 100,000 before any choice.
- **FR-008**: Changing a city's population MUST update the voters in the counties around it, the map colors, and the statewide stat block within 1 second.
- **FR-009**: A city's voters MUST live in the counties around it, so the counties around a bigger city hold more voters on average than those around a smaller one.
- **FR-010**: The state's total voters MUST equal an all-rural baseline plus the cities' populations: adding, removing, or resizing a city MUST change the total by its population change, give or take 25%. With no cities the total MUST stay about what an all-rural state had before this feature.
- **FR-011**: The statewide split slider MUST keep its meaning: the state's total side A share MUST match the chosen split to within 0.5 percentage points whatever the cities' sizes.
- **FR-012**: Every built state MUST still satisfy the existing validity rules: counties of at least 160 px² in one piece, a connected county graph, no county above 0.75 of an ideal district, and a complete plan of connected districts within the 10% balance rule. If the visitor's choices cannot, the existing failure message MUST show and Use this state MUST stay disabled.
- **FR-013**: Every outline, for random states and in the builder, MUST have at least two straight borders of at least 150 map pixels each meeting at a corner of between 60° and 120°.
- **FR-014**: Every outline MUST have at least one natural, irregular border that wiggles gently over at least a fifth of the state's perimeter.
- **FR-015**: Every outline MUST be one connected piece with no holes or crossing lines, MUST fill no more than 80% of its bounding box, MUST have at least four distinct corners, and every arm, peninsula, or notch MUST be at least 50 map pixels wide.
- **FR-016**: The same seed, the same outline seed, or the same custom link MUST always produce the same outline. Outlines from different seeds MUST differ.
- **FR-017**: A custom link MUST carry every city's population and reproduce the state exactly. A link without populations MUST open with every city at 100,000 voters if its cities fit the outline; a damaged link, an out-of-range population, or a link whose cities do not fit MUST show the existing "link isn't valid" message and a random map.
- **FR-018**: The city selection, the slider, and the Remove city button MUST work with pointer, touch, and keyboard, announce changes to assistive technology, and fit from 320 px to 1920 px wide without horizontal scrolling.
- **FR-019**: All other behavior (placing cities, limits and messages, voter settings, Use this state, Cancel, New outline, Clear cities, district drawing, the matchup toggle, and the stat block) MUST keep working, except where this specification supersedes it.
- **FR-020**: A county's drawn size MUST fall as its density rises. Across the counties of any state, the rank correlation between density and size MUST be at least 0.8 in strength (denser means smaller), and the densest tenth of counties MUST average at most one third the size of the sparsest tenth.
- **FR-021**: County sizes MUST agree with the county labels: the average urban county MUST be smaller than the average suburban county, which MUST be smaller than the average rural county.
- **FR-022**: Around each city, counties MUST be smallest at its center and larger on average with distance, and the counties around a bigger city MUST be smaller on average than those around a smaller city in the same place.
- **FR-023**: The size rule MUST apply to random states and to states built in the builder, including a state with no cities (where county sizes also stay within a quarter to four times the average), and the same seed or custom link MUST always give the same counties.
- **FR-024**: The existing county rules MUST still hold: 90 to 120 counties, every county at least 160 px² and one piece, a connected county graph, and a complete balanced plan of connected districts possible.

### Key Entities

- **City**: A point inside the outline with a population. It also has a selected or not-selected state while the visitor is building.
- **City Population**: The number of voters, from 10,000 to 300,000 in steps of 10,000, who live in and around a city and are counted in the state's total.
- **State Total Population**: The all-rural baseline plus every city's population; the figure shown in the statewide stat block.
- **Outline**: The state's border: a mix of straight surveyed borders meeting at corners and irregular natural borders.
- **Custom State Plan**: As in feature 008, now including each city's population.
- **County Density**: A county's voters divided by its area in square miles, as already shown in county details. It decides how small the county is drawn.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time visitor can place a city and set its population within 10 seconds, without instructions.
- **SC-002**: In 100% of checks, adding a city of population P raises the state's total voters by between 0.75 P and 1.25 P, and removing it lowers the total by the same range.
- **SC-003**: In 100% of 100 checks, a state with a bigger city (everything else equal) has more total voters than the same state with a smaller one, and the counties around the bigger city hold more voters on average.
- **SC-004**: In 100% of checks, the population slider, city selection, and Remove city update the map and the stat block within 1 second.
- **SC-005**: In 100% of checks, the statewide split matches its slider to within 0.5 percentage points with cities of any size.
- **SC-006**: At least 98% of random plans (0 to 12 cities, random sizes) build into states that pass every existing validity rule; the rest show the failure message.
- **SC-007**: In 100% of 100 generated outlines, each has at least two straight borders of at least 150 px meeting at a corner of 60° to 120°, at least one natural irregular border, one connected piece, a bounding-box fill of at most 80%, and no arm narrower than 50 px.
- **SC-008**: Among 100 outlines, none repeat and at least three clearly different overall shapes (for example boxy, tilted, and irregular) appear.
- **SC-009**: In 100% of checks, a custom link reproduces the same cities, populations, counties, voters, outline, and statewide numbers.
- **SC-010**: On 320 px and 1920 px wide screens, the new controls are fully visible with no horizontal scrolling.
- **SC-011**: All earlier tests keep passing, except the tests this specification supersedes (click-to-remove and the unchanged-seed fingerprints), which are replaced by tests of the new behavior.
- **SC-012**: In 100% of 100 generated states (random and built, with 0 to 12 cities), the rank correlation between county density and size is at least 0.8 in strength, and the densest tenth of counties average at most one third the size of the sparsest tenth.
- **SC-013**: In 100% of the same checks, the average urban county is smaller than the average suburban one, which is smaller than the average rural one, and the counties around a bigger city are smaller on average than those around a smaller one.
- **SC-014**: Showing only the map with no labels, a visitor can pick out where the cities are from the clusters of small counties, in every test map that has cities.

## Assumptions

- "Realistic" means resembling real US state outlines: straight borders from surveys, river meanders, and coastlines, with corners where straight borders meet. It does not mean copying any real state. "A little more realistic" means a visible improvement over today's smooth lumpy shapes, not a new look.
- "Population" means voters, since every number in the app counts voters.
- Each city has its own population, set by one slider that edits the selected city. New cities start at the last chosen value so that several big cities can be placed quickly.
- Selecting a city replaces click-to-remove from feature 008. Removal moves to an explicit button and the Delete and Backspace keys, so a click can no longer lose a city by accident.
- The all-rural baseline stays about as large as an empty state's total is today (roughly half a million to three quarters of a million voters); cities add to it.
- Outlines change for everyone: maps from earlier seeds, and earlier custom links, will not look the same as before. Shared links are not guaranteed to keep working, and an old custom link whose cities no longer fit its outline shows the usual message.
- The 12-city limit, the 90 px city spacing, the statewide split range, the 10% balance rule, and the 160 px² county size are unchanged.
- The state outline, the cities, and the voter settings are still saved only in the page address.
- "Higher density" means more voters per square mile, the figure already shown as a county's density. Because the map is drawn to scale, this is a stronger link between what a county holds and how big it looks, not a new measure.
- The number of counties stays 90 to 120, so smaller counties in cities mean larger counties in the countryside. The 160 px² minimum still limits how small the densest counties can be.
- Counties may be redrawn when a city's population changes, since the size of a county follows its density. The same cities, populations, and settings always give the same counties.
- This keeps and strengthens 008's rule that counties near cities are smaller; it also changes how every county of an existing seed looks, which the outline change already does.
