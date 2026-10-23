# Feature Specification: New Map Button, Close Elections With Realistic Voter Patterns, 10% Balance, and Irregular State Shapes

> **Superseded by [010](../010-precinct-brush-tool/spec.md) for the building block**: counties are now precincts (500 to 800 per state). The close-election, voter-pattern and balance rules apply to precincts unchanged. Shapes
**Feature Branch**: `005-new-map-realistic-state`

**Created**: 2026-10-18

**Status**: Draft

> **Superseded by [009](../009-city-population-outlines/spec.md) for outlines**: the panhandle, river, coast, and notch feature list (FR-020 to FR-022 here) is replaced by outlines of straight surveyed borders meeting at corners plus natural river or coast borders, covering at most 80% of the bounding box.

**Input**: User description: "Yes, make a "new map button". Aditionally the maps are not looking quite as realistic as would be ideal so i have posted thej link to the 2024 election in texas, so that you can use that to analize domographics. then, instead of 10,000 votes, make it 10% change between highest and lowest populations. https://en.wikipedia.org/wiki/2024_United_States_presidential_election_in_Texas Finnaly, make the shape of the state a little wierder, not a rectangle."

## Clarifications

### Session 2026-10-18

- Q: Should generated states match Texas's statewide result? → A: No. Texas only shows how voting is distributed across real counties (urban vs. rural, concentration of voters). Every generated state should be close to even statewide, with each side getting 48–52% of all votes.
- Q: With a 48–52 statewide split, which side comes out slightly ahead? → A: Random. Either side can narrowly win, about half the maps each.

## Reference Data: 2024 Presidential Election in Texas

These figures come from the county results table on the linked Wikipedia page (254 counties, 11,388,674 votes). They are used only to learn how voting is distributed in a real election (who wins urban, suburban, and rural counties, and how concentrated voters are). They are NOT a target for the statewide result, which must be close to even (see Clarifications).

| Pattern | Texas 2024 |
|---------|------------|
| Statewide result | Republican 56.1%, Democrat 42.5%, others 1.4% (Republican +13.7) |
| Counties won by the Democrat | 12 of 254 (about 5%) |
| Vote concentration | Largest 5 counties cast 40% of votes; largest 20 cast 71% |
| Typical county | Median county cast 7,790 votes, about one-sixth of the average county |
| Large counties (200,000+ votes, 12 counties) | Republican 47% of the combined vote; most won by the Democrat, but some large counties narrowly Republican |
| Mid-size counties (50,000–200,000 votes, 23 counties) | Republican 64% |
| Small counties (10,000–50,000 votes, 70 counties) | Republican 76% |
| Very small rural counties (under 10,000 votes, 149 counties) | Republican 80%; the most Republican reach 92–96% |
| Exceptions | A few small, heavily Hispanic border counties were won by the Democrat |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Generate a New Map (Priority: P1)

A visitor wants to try a different state without editing the address bar. They click a "New map" button and a freshly generated state appears, with its own shape, counties, voters, and districts that start empty.

**Why this priority**: It is the quickest way to explore many states and the most direct request.

**Independent Test**: Click "New map" several times and confirm a different state appears each time, the link updates so the new map can be shared, and the districts start empty.

**Acceptance Scenarios**:

1. **Given** the website is open, **When** the visitor clicks "New map", **Then** a different randomly generated state replaces the current one within 2 seconds.
2. **Given** a new map was generated, **When** the visitor copies the page link and opens it later, **Then** the same state appears.
3. **Given** the visitor has added at least one county to a district, **When** they click "New map", **Then** they are asked to confirm that their districts will be lost, and nothing changes if they cancel.
4. **Given** no county is in a district, **When** the visitor clicks "New map", **Then** the new map appears without a confirmation.
5. **Given** a district was being edited, **When** a new map appears, **Then** editing mode is off, the blocked-click message is cleared, and the selected matchup stays the same.
6. **Given** a keyboard-only visitor, **When** they reach the "New map" button with Tab and press Enter or Space, **Then** it behaves the same as a click.

---

### User Story 2 - See Realistic Voter Patterns in a Close State (Priority: P1)

A visitor looks at the map and sees a real-election pattern like the one in Texas 2024: most counties are small, rural, and strongly side B; a handful of large urban counties hold a large share of the voters and strongly lean side A; and suburbs around cities are competitive. Unlike Texas, the state as a whole is close to even: each side gets 48–52% of all votes, and either side may narrowly win.

**Why this priority**: The user found current maps not realistic enough. Realistic voters make the gerrymandering exercise meaningful.

**Independent Test**: Generate many maps and confirm the statewide result is always 48–52% for each side, each side wins about half of the maps, and the county-size distribution and voting by county size follow the reference pattern.

**Acceptance Scenarios**:

1. **Given** a new state, **When** the visitor hovers over the largest counties, **Then** most of them lean side A, though some may narrowly lean side B.
2. **Given** a new state, **When** the visitor hovers over small rural counties, **Then** nearly all lean to side B, with the most lopsided around 85–90% side B.
3. **Given** a new state, **When** the visitor looks at the whole map, **Then** only a minority of counties (roughly 10–30%) are won by side A, yet the statewide vote is close to even because side A's counties hold many voters.
4. **Given** a new state, **When** the visitor adds up all voters, **Then** each side has between 48% and 52% of the statewide vote.
5. **Given** a new state, **When** the visitor hovers over a county next to a large city, **Then** its result is usually closer than the city's own result and closer than distant rural counties.
6. **Given** the visitor switches the matchup, **When** the colors and names change, **Then** the numbers stay the same, as before.

---

### User Story 3 - Balance Districts Within 10% (Priority: P2)

A visitor drawing districts sees the balance check use a 10% rule instead of a fixed 10,000 voters: the largest district can have at most 10% more voters than the smallest district.

**Why this priority**: A percentage rule works for any state size, so it stays fair as maps change.

**Independent Test**: Load a complete plan whose largest district is 9% bigger than the smallest one and confirm the check passes; change one county so the gap is 11% and confirm it fails.

**Acceptance Scenarios**:

1. **Given** every district has voters, **When** the largest district has no more than 10% more voters than the smallest, **Then** the balance check passes.
2. **Given** every district has voters, **When** the largest district has more than 10% more voters than the smallest, **Then** the balance check fails and shows how far over the limit it is.
3. **Given** any district is empty, **When** the visitor views the balance check, **Then** it fails, as before.
4. **Given** the plan-check panel, **When** it is displayed, **Then** it shows the largest and smallest district sizes, their percentage difference, and the 10% limit, instead of a 10,000-voter limit.
5. **Given** any generated state, **When** it is created, **Then** at least one complete, contiguous plan exists that meets the 10% rule.

---

### User Story 4 - See an Irregular State Shape (Priority: P3)

A visitor sees a state whose outline looks like a real US state with character, such as a panhandle, a jagged river border, a bumpy coastline, or a notch, instead of a rounded rectangle.

**Why this priority**: It improves realism and visual interest but does not change the editing workflow.

**Independent Test**: Generate many maps and confirm each outline fills much less of its bounding box than a rectangle would, includes at least one distinctive feature, and varies from map to map.

**Acceptance Scenarios**:

1. **Given** a new state, **When** the map is displayed, **Then** its outline is clearly not a rectangle or near-rectangle.
2. **Given** a new state, **When** the map is displayed, **Then** the outline includes at least one distinctive feature such as a panhandle, a jagged river border, a rugged coastline, or a notch.
3. **Given** several new maps, **When** they are compared, **Then** their outlines differ noticeably in shape.
4. **Given** an irregular outline, **When** the visitor hovers, focuses, or clicks any county, including counties in narrow parts, **Then** it responds the same as any other county.

### Edge Cases

- A narrow feature such as a panhandle must still contain whole counties that meet the minimum clickable size and connect to the rest of the state.
- A large urban county must never be so large that no balanced plan is possible; a county cannot hold more voters than one district can contain within the 10% rule.
- With 20 districts and few counties, each district has only a handful of counties; the generator must still guarantee a valid plan.
- Clicking "New map" twice quickly must result in one finished, consistent map, not a mix of two.
- If a generated state would break any rule, a different one is generated automatically without the visitor seeing an error.
- Opening an old link made before this feature shows a map produced by the new rules for the same seed; old maps are not preserved exactly.
- A few small rural counties may lean side A, like Texas border counties, but they must remain rare.

## Requirements *(mandatory)*

### Functional Requirements

**New map**

- **FR-001**: The website MUST show a "New map" button near the matchup toggle, above the map.
- **FR-002**: Activating "New map" MUST generate a new random state, replace the current map, district list, control total, and plan check, and update the page link so the new state can be shared and reloaded.
- **FR-003**: If any county is in a district, the website MUST ask the visitor to confirm before replacing the map; canceling MUST leave everything unchanged.
- **FR-004**: After a new map appears, all districts MUST start empty, editing mode MUST be off, and the selected matchup MUST be kept.
- **FR-005**: The "New map" button MUST be usable with mouse, touch, and keyboard and MUST have an accessible name.

**Realistic voters (distribution patterns from Texas 2024; statewide result close to even)**

- **FR-006**: County voter counts MUST be highly uneven: the most populous 10% of counties MUST hold at least 25% of all voters, and the median county MUST have no more than half the voters of the average county.
- **FR-007**: No county MAY hold more voters than about 75% of an ideal district, so that a balanced plan always remains possible.
- **FR-008**: Large urban counties MUST mostly lean side A, generally between 55% and 80% side A, and some large counties MAY narrowly lean side B.
- **FR-009**: Counties next to large urban counties MUST, on average, be more competitive than rural counties farther away, typically 40–60% side A.
- **FR-010**: Rural counties MUST lean strongly to side B, typically 60–90% side B, and at most 5% of rural counties MAY lean side A.
- **FR-011**: Only a minority of counties MUST be won by side A, typically 10–30% of all counties.
- **FR-012**: Every generated state MUST be close to even statewide: each side MUST get between 48% and 52% of all voters. Which side is ahead MUST be random, with each side ahead in about half of the maps.
- **FR-013**: Only two sides are modeled; third-party votes are left out, as before.
- **FR-014**: County details MUST keep showing the type (urban, suburban, or rural) and density, as before.

**10% balance rule**

- **FR-015**: The balance check MUST pass only when every district has voters and the largest district has at most 10% more voters than the smallest district.
- **FR-016**: The plan-check panel and district list MUST describe the rule as a percentage and MUST show the current percentage difference between the largest and smallest districts.
- **FR-017**: Each district's label MUST show whether it is within range of the ideal size or how far it is above or below that range.
- **FR-018**: Every generated state MUST have at least one complete, contiguous plan that meets the 10% rule.
- **FR-019**: The contiguity rules from feature 004 MUST stay the same.

**Irregular state shape**

- **FR-020**: Each state outline MUST cover no more than 75% of its bounding rectangle.
- **FR-021**: Each outline MUST include at least one distinctive feature: a panhandle or arm, a jagged river border, a rugged coastline, or a notch.
- **FR-022**: Outlines MUST vary between seeds, MUST be a single connected shape without holes, and MUST keep every county at or above the existing minimum clickable size.
- **FR-023**: The same seed MUST always produce the same outline, counties, and voters.

**Unchanged behavior**

- **FR-024**: County count (90–120), district count (8–20), districts starting empty, the editing rules, hover details, matchup toggle, and the control total MUST keep working as before.

### Key Entities

- **Generated State**: Now includes an irregular outline with at least one distinctive feature, and voters that follow real-election distribution patterns with a statewide result between 48% and 52% for each side.
- **County**: Same attributes as before; its voter count follows the uneven distribution, and its lean depends on its type and distance from large cities.
- **Balance Rule**: The largest district may have at most 10% more voters than the smallest district.
- **New Map Action**: Replaces the current state with a new random one and updates the shareable link.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of trials, clicking "New map" shows a different, fully interactive state within 2 seconds.
- **SC-002**: In 100% of trials, reopening the link after "New map" reproduces the same state.
- **SC-003**: Across 100 generated maps, every map meets FR-006, FR-007, and FR-020.
- **SC-004**: Across 100 generated maps, every map has each side between 48% and 52% of the statewide vote, side A is ahead in 35–65% of the maps, and the average share of counties won by side A is between 10% and 30%.
- **SC-005**: Across 100 generated maps, averaged by county size tier, side B's vote share rises from the largest tier to the smallest, matching the real-election pattern (side A ahead in the largest tier and roughly 65–80% side B in the smallest tier).
- **SC-006**: Across 100 generated maps, every map has a complete, contiguous plan that passes the 10% rule.
- **SC-007**: In a review of 20 generated maps, a viewer judges none of the outlines to be a rectangle or near-rectangle.
- **SC-008**: Every existing behavior listed in FR-024 still passes its tests.

## Assumptions

- The user's "10% change between highest and lowest populations" means the largest district may have at most 10% more voters than the smallest district.
- Texas is used only to learn how votes are distributed between urban, suburban, and rural counties; its 56–42 statewide result is not copied, and generated states are close to even (48–52).
- "Demographics" is interpreted as the voting patterns and population concentration by county in the linked page; the page provides vote results, not detailed demographic breakdowns.
- Real Texas counties, names, and geography are not copied; only the statistical patterns are used, scaled down to 90–120 counties.
- Texas's largest county has about 14% of the state's votes, which is larger than a whole district here; generated counties are capped at about 75% of an ideal district (FR-007) because counties cannot be split between districts.
- Side A represents Democrats, Socialists, or Purple and side B represents Republicans, Libertarians, or Orange, depending on the matchup, as before.
- A few rural side-A counties are allowed to echo Texas border counties, but feature 004's rule that rural counties are mostly side B still holds.
- The confirmation before replacing a map uses a simple confirm prompt; no undo is provided.
- The 10% rule replaces the 10,000-voter rule everywhere, including tests and documentation.
