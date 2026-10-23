# Feature Specification: Brush Only Takes Unclaimed Precincts

**Feature Branch**: `013-brush-unclaimed-only`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "make a toggle on the brush tool when adding, that if clicked will not, when instructed to add, take any precincts from another district and only take precincts that have not yet been claimed."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Paint Without Stealing From Other Districts (Priority: P1)

A visitor is drawing districts with the brush. Today, when the brush adds precincts to the selected district, every precinct under the circle that belongs to another district can be taken away from it (as long as that district stays in one piece). Painting next to a finished district therefore nibbles away at it. After this feature, the brush controls include a switch, "Only unclaimed precincts", that is off by default. With it on, adding with the brush takes only precincts that no district has claimed yet. Precincts already in another district are left exactly where they are, however many the circle covers.

**Why this priority**: This is the whole request. Protecting finished districts while painting a new one is what makes the brush safe to use close to existing borders.

**Independent Test**: Can be fully tested by drawing two neighboring districts, selecting one, turning the switch on, painting across the shared border and into unclaimed land, and confirming that only unclaimed precincts joined the selected district and that no precinct of the other district changed.

**Acceptance Scenarios**:

1. **Given** the brush is on in add mode with "Only unclaimed precincts" on and the circle covers unclaimed precincts and precincts of another district, **When** the visitor clicks or paints, **Then** only the unclaimed precincts (that also follow the existing connection rules) join the selected district, and every precinct of every other district stays in its district.
2. **Given** the switch is on and the circle covers only precincts of other districts, **When** the visitor clicks, **Then** nothing changes and the message says that no precincts were changed because those under the brush already belong to other districts.
3. **Given** the switch is off, **When** the visitor paints over precincts of another district, **Then** the brush behaves exactly as it did before this feature (it may move them, subject to the existing keep-it-in-one-piece rule).
4. **Given** the switch is on and the selected district is empty, **When** the visitor clicks, **Then** the district starts with the unclaimed covered precinct nearest the start of the stroke, and later precincts follow the existing connection rule.
5. **Given** the switch is on, **When** a drag passes over a mix of unclaimed and claimed precincts, **Then** the unclaimed ones along the path that connect to the district are added and the claimed ones are skipped, and the result is the same every time the same stroke is applied to the same starting plan.

---

### User Story 2 - The Switch Is Clear, Stays Put, and Fits the Screen (Priority: P2)

The visitor can tell at a glance whether the brush will take precincts from other districts. The switch has a plain label, shows its state in words as well as by look, can be used with mouse, touch and keyboard, and only matters when the brush is adding. Turning it on or off never makes the page layout jump.

**Why this priority**: The switch only helps if it is easy to find and its state is never in doubt. It also must not undo the one-screen layout from feature 011. It builds on Story 1.

**Independent Test**: Can be fully tested by toggling the switch with the mouse and the keyboard, switching the brush between add and erase, and checking its label, its state, its availability, and that no other control moved.

**Acceptance Scenarios**:

1. **Given** the brush section is shown, **When** the visitor looks at it, **Then** the switch is part of the brush controls, has the label "Only unclaimed precincts", and is off by default.
2. **Given** the switch, **When** the visitor presses Space or Enter on it with the keyboard, or clicks or taps it, **Then** its state changes and the new state is visible and announced to screen readers as on or off.
3. **Given** the brush is in erase mode, **When** the visitor looks at the switch, **Then** it is still shown, in the same place, but unavailable, dimmed, and described (to screen readers and as a hover hint) as applying to Add only.
4. **Given** the visitor holds Shift to temporarily switch between add and erase, **When** the effective mode is add, **Then** the switch applies, and **when** it is erase, the switch has no effect; the switch itself does not change.
5. **Given** the page is on a laptop or desktop window of at least 1280 × 720, **When** the switch is added, **Then** the one-screen layout still holds: nothing needs page scrolling, the map is not smaller, and no other control moves (feature 011).

---

### User Story 3 - The Setting Is Remembered and Reported (Priority: P3)

The switch keeps its position while the visitor keeps working on the same state, and starts off again for a new state or an opened link, like the brush size and mode. The message after each stroke tells the visitor how many precincts were left alone because another district already has them, so an unchanged map is never a mystery.

**Why this priority**: It rounds the feature off so that it behaves like the other brush settings. The core protection works without it.

**Independent Test**: Can be fully tested by turning the switch on, doing several strokes and selecting other districts, then generating a new state and checking the reset, and by reading the message after strokes with mixed coverage.

**Acceptance Scenarios**:

1. **Given** the switch is on, **When** the visitor selects another district, turns the brush off and on, changes the size, or changes the matchup, **Then** the switch stays on.
2. **Given** the switch is on, **When** a new map is generated, a custom state is used, or a shared link is opened, **Then** the switch is off.
3. **Given** the switch is on and a stroke covered some precincts that belong to other districts, **When** the stroke ends, **Then** the message gives the number added, the number unchanged, and the number skipped with the reason that they already belong to another district.
4. **Given** the brush is off, **When** the visitor clicks precincts one at a time, **Then** those single clicks behave as before whether the switch is on or off.

---

### Edge Cases

- **Covered precincts are all claimed**: nothing changes, and the message says so (Story 1, scenario 2).
- **Covered precincts are all unclaimed**: the switch makes no difference.
- **Precincts already in the selected district**: they are counted as unchanged, as before, whatever the switch says.
- **Unclaimed precincts that do not touch the selected district**: they are still skipped as "not touching", as before; the switch adds a rule and removes none.
- **An unclaimed precinct that is only reachable through a claimed one**: it is skipped as not touching, because claimed precincts are not moved or crossed.
- **A district that becomes unclaimed during the same stroke**: not possible with the switch on, because the brush in add mode with the switch on removes nothing from any district.
- **Erase mode**: the switch does not apply and erasing works exactly as before.
- **Shift held mid-stroke**: the mode used for a stroke is the one it started with, as before.
- **Keyboard add**: pressing Enter on a focused precinct with the brush on follows the switch exactly like a click.
- **No district selected**: the whole brush section is unavailable as before, switch included.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The brush controls MUST include a switch labelled "Only unclaimed precincts", off by default.
- **FR-002**: With the switch on and the brush adding, the brush MUST add to the selected district only precincts that belong to no district, and MUST NOT take, move, or change any precinct that belongs to another district.
- **FR-003**: With the switch on, every rule that applied to adding before MUST still apply to the unclaimed precincts: they are added only if connected to the selected district (directly or through precincts added by the same stroke), an empty district starts with the covered unclaimed precinct nearest the start of the stroke, and no district may end up in more than one piece.
- **FR-004**: With the switch off, the brush MUST behave exactly as it did before this feature, in add mode and in erase mode.
- **FR-005**: The switch MUST apply to clicks, taps, Enter on a focused precinct, and drags, with the brush on, and MUST give the same result for the same stroke on the same starting plan.
- **FR-006**: The switch MUST apply only when the effective mode is add. In erase mode it MUST be shown in place but unavailable, and MUST have no effect; holding Shift to swap modes MUST make the switch apply or not apply to match the effective mode, without changing the switch (so with Add chosen and Shift held the stroke erases and the switch has no effect, and with Erase chosen and Shift held the stroke adds and the switch's stored value applies, although the box still looks unavailable).
- **FR-007**: The switch MUST be usable with mouse, touch and keyboard, MUST show its state in words or a visible mark as well as by look, and MUST announce its state to screen readers.
- **FR-008**: The switch's state MUST be remembered while the visitor works on the same state, across selecting other districts, turning the brush off and on, and changing the brush size, mode or matchup, and MUST reset to off when a new map is generated, a custom state is used, or a link is opened.
- **FR-009**: After a stroke, the message MUST count the precincts skipped because they already belong to another district, separately from the other skipped reasons, and a stroke that changes nothing for that reason MUST say so.
- **FR-010**: The switch MUST NOT change what single clicks do while the brush is off.
- **FR-011**: Adding the switch MUST NOT break the one-screen layout of feature 011 (no scrolling at 1280 × 720 and larger, the map not smaller, no other control moved, nothing clipped) and MUST NOT cause sideways scrolling at any size.
- **FR-012**: Every district update that a stroke causes (borders, colors, list tiles, detail, balance, plan status, control total) MUST happen as for any other stroke.
- **FR-013**: No existing control, message or behavior is removed. The brush hint is shortened while the brush is on, and it gives way to the stroke message while one is shown and returns when the message is cleared (to keep the brush bar in its one row).

### Key Entities

- **Unclaimed-Only Setting**: An on/off choice for the brush's add behavior. It is remembered with the other brush settings (size and mode), applies only when adding, and is off whenever a state is new.
- **Claimed Precinct**: A precinct that belongs to any district. With the setting on, the brush adding never changes one.
- **Unclaimed Precinct**: A precinct that belongs to no district. It is the only kind the brush adds when the setting is on.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With the switch on, in 100 random strokes over a plan with several districts, the number of precincts that change district from one district to another is 0, and every precinct added was unclaimed before the stroke.
- **SC-002**: With the switch off, the result of every stroke in the same 100 strokes is identical to the result before this feature.
- **SC-003**: A visitor can turn the switch on, and the next stroke leaves every neighboring district untouched, in one try, without reading any help (checked by hand in the manual check, not by an automated test).
- **SC-004**: The switch's state is readable by a screen reader and by color-blind visitors (in words or a mark, not color alone) in 100% of its states (on, off, unavailable).
- **SC-005**: At every laptop and desktop size from 1280 × 720 to 1920 × 1080 the map, the picker, the district detail and the plan status have the same size and position with the switch as without it, and nothing needs page scrolling.
- **SC-006**: After any stroke that skipped precincts because they were claimed, the message states how many, in every such case.
- **SC-007**: The switch keeps its position through at least 10 district selections, brush on and off, size changes and matchup changes on one state, and is off after a new map, custom state or opened link.

## Assumptions

- The "switch" is built as a labelled checkbox; it is called a switch in this spec.
- The switch lives in the brush controls from feature 010 and its one-row bar from feature 011; its look follows the other brush controls.
- The word "claimed" means "assigned to any district", and "unclaimed" means "unassigned", the same as the existing "no district" precincts.
- The switch is off by default so that the brush behaves as people already know it.
- With the switch on the brush adds only; it never removes, so the contiguity of other districts cannot be affected.
- The switch affects only brush strokes; single clicks with the brush off are unchanged (the existing click rules still let a click take a precinct from another district).
- The shared-link format does not store this setting; like the brush size and mode, it is not shared.
- Messages follow the style of the existing stroke message.
