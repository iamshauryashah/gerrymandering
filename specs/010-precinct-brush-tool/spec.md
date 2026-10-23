# Feature Specification: Precinct Building Blocks and Brush Selection Tool

> **Extended by [013](../013-brush-unclaimed-only/spec.md)**: the brush has an option, "Only unclaimed precincts", that makes adding take only precincts that belong to no district.

> **Superseded by [011](../011-single-screen-editing/spec.md) for layout**: the page is now arranged so that picking a district, editing the map and reading the district's status need no scrolling on a laptop or desktop window. The brush controls are now a one-row bar directly above the map; the brush behavior is unchanged.

**Feature Branch**: `010-precinct-brush-tool`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "instead of counties, make the building blocks precinct. This is so that it is much easier to make districts. With the precinct instead of counties, make a tool that can select a large amount of precincts together at once, and make there be a slider to decide the largeness of that tool."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Draw Districts From Small Precincts (Priority: P1)

A visitor opens a generated state (random or custom) and sees it divided into many small precincts instead of about 100 counties. Everything that used to work on counties now works on precincts: each precinct has a name, voter counts, a density type, a fill color for its voter makeup, details on hover or keyboard focus, and can be added to, moved between, or removed from the selected district one click at a time. The finer pieces let the visitor shape district borders much more precisely and meet the population-balance rule with much smaller adjustments.

**Why this priority**: Replacing counties with precincts is the foundation. The brush tool is only useful once precincts exist, and this story alone already makes districts easier to fit.

**Independent Test**: Can be fully tested by generating a state, confirming it has between 500 and 800 precincts and no counties anywhere in the interface, then selecting a district and clicking precincts to add, move, and remove them, checking that totals, contiguity rules, balance check and plan status behave as they did for counties.

**Acceptance Scenarios**:

1. **Given** a newly generated random state, **When** the map appears, **Then** it is divided into between 500 and 800 non-overlapping precincts that together cover the whole state, and the word "county" does not appear in the map, details, district list, status messages, or built-in help text.
2. **Given** a precinct is hovered or keyboard-focused, **When** its details appear, **Then** they show its name, total voters, each side's count and percentage, the leading side or tie, lead margin, density and type (urban, suburban, or rural), and its district or "no district".
3. **Given** a district is selected for editing, **When** the visitor clicks an unassigned precinct, a precinct in another district, or a precinct already in the selected district, **Then** the precinct is added, moved, or removed respectively, subject to the same contiguity rules that applied to counties.
4. **Given** the visitor builds a custom state, **When** it is built, **Then** it is also divided into precincts under the same rules as a random state, and denser areas have smaller precincts as before.
5. **Given** a fresh state with no districts assigned, **When** the visitor works toward a complete plan, **Then** at least one plan exists in which every precinct is assigned, every district is contiguous, and all district voter counts are within the balance limit.

---

### User Story 2 - Select Many Precincts With a Brush (Priority: P2)

While a district is selected for editing, the visitor can turn on a brush tool. The brush is a circle that follows the pointer over the map. Clicking, or pressing and dragging, assigns every precinct inside the circle to the selected district in one action. A slider next to the brush control sets how big the circle is, from a size that covers only one or two precincts to a size that covers a large part of the state, so the visitor can paint broad areas quickly and then refine edges with a small brush.

**Why this priority**: This is the main productivity gain the visitor asked for. It depends on precincts (Story 1) but is a separate, independently demonstrable tool.

**Independent Test**: Can be fully tested by selecting a district, turning on the brush, setting a size with the slider, clicking once on the map and confirming that every precinct whose center is inside the circle joins the district, then dragging across the map and confirming a continuous strip is assigned.

**Acceptance Scenarios**:

1. **Given** a district is selected for editing and the brush is on, **When** the visitor moves the pointer over the map, **Then** a circle matching the current brush size follows the pointer so the visitor can see what a click would cover.
2. **Given** the brush is on and set to a medium size, **When** the visitor clicks once on the map, **Then** every eligible precinct whose center lies inside the circle is assigned to the selected district at once, and the map, district list, voter totals, balance check, plan status, and control total all update immediately.
3. **Given** the brush is on, **When** the visitor presses and drags across the map, **Then** precincts along the whole path are assigned as the pointer moves, and the result is one continuous painted area.
4. **Given** the brush size slider, **When** the visitor drags it from its smallest to its largest value, **Then** the on-map circle resizes live, the smallest size covers roughly one to three precincts in a typical area, and the largest size covers a circle at least a quarter of the state's width across.
5. **Given** the brush is on, **When** the visitor chooses the erase option (or holds the Shift key while using the brush), **Then** brushing removes the precincts inside the circle that belong to the selected district and leaves all other precincts unchanged.
6. **Given** the brush is on, **When** the visitor presses Escape, turns the brush off, or deselects the district, **Then** the brush circle disappears and clicks on precincts return to selecting one precinct at a time.
7. **Given** no district is selected, **When** the visitor looks at the brush controls, **Then** the brush cannot be used and the controls explain that a district must be selected first.

---

### User Story 3 - Brush Respects Plan Rules and Gives Clear Feedback (Priority: P3)

A brush stroke can cover many precincts, some of which could not be added without breaking a rule (for example, splitting the selected district into disconnected pieces, or splitting another district when a precinct is taken from it). The brush applies every precinct that is allowed and skips the ones that are not, then tells the visitor what happened so a large stroke never silently leaves the plan in an invalid or surprising state.

**Why this priority**: It keeps the existing contiguity guarantee intact for bulk edits. The brush is usable without polished feedback, but trust in the result depends on it.

**Independent Test**: Can be fully tested by brushing over an area that includes precincts that are not adjacent to the selected district and precincts whose removal would split a neighboring district, then confirming that only allowed precincts changed and that a message reports how many were applied and how many were skipped.

**Acceptance Scenarios**:

1. **Given** the selected district already has precincts, **When** a stroke covers precincts that are not connected to it, **Then** only precincts that are connected to the district (directly or through other precincts added in the same stroke) are added and the rest are skipped.
2. **Given** the selected district is empty, **When** the visitor strokes over an area, **Then** the precinct nearest the brush center is added first, and only precincts connected to it are added, so the district starts as one contiguous piece.
3. **Given** a stroke covers a precinct whose move would leave another district disconnected, **When** the stroke is applied, **Then** that precinct is skipped and every district remains contiguous after the stroke.
4. **Given** a stroke is applied, **When** it finishes, **Then** a short message states how many precincts were added, moved, or removed and how many were skipped and why (for example "Added 42 precincts, skipped 5 that would split a district"); a stroke that changes nothing says so instead of staying silent.
5. **Given** a stroke that is applied by dragging, **When** the visitor releases the pointer, **Then** one message summarizes the whole drag, not one message per step.
6. **Given** the same state, district, brush size, and stroke, **When** the stroke is repeated from the same starting situation, **Then** it produces the same result every time.

---

### Edge Cases

- A stroke begins or ends off the map: only precincts actually inside the circle and inside the state are affected; areas outside the state are ignored.
- A very large brush on a densely packed region covers hundreds of precincts: the stroke still completes and updates the display without noticeable delay.
- Brush circle covers no precinct centers (for example, over water or outside the outline): nothing changes and the message says nothing was selected.
- The brush is painting while the visitor switches the matchup or generates a new state: the stroke ends cleanly, the brush circle is dismissed if the district selection is cleared, and no partial assignment is left behind.
- Touch screens: a one-finger drag with the brush on paints; the brush circle appears at the touch point; the page does not scroll while painting.
- Keyboard users: the brush size slider is operable by keyboard; a keyboard user can apply the brush to the focused precinct's position (centered on that precinct) with the Enter key; one-precinct-at-a-time editing remains available with the brush off.
- Precincts of very different sizes (small dense precincts and large rural ones) under the same circle: inclusion depends only on whether the precinct's center is inside the circle, never on its size.
- Shared links created before this feature refer to counties; they open with the new precinct layout (their cities and city sizes are kept) and nothing from the old county layout is reproduced.
- A district becomes too large or too small because of a big stroke: the strokes are still allowed (the balance check only reports), and the balance check and district list show the new status immediately.

## Requirements *(mandatory)*

### Functional Requirements

**Precincts as the building blocks**

- **FR-001**: Each generated state, random or custom, MUST be divided into between 500 and 800 precincts, inclusive, that do not overlap and together cover the whole state.
- **FR-002**: Precincts MUST replace counties everywhere: the map, details pop-up, district list, balance and status messages, built-in help text, and shared-link behavior MUST refer to precincts and MUST NOT mention counties.
- **FR-003**: Each precinct MUST have a unique fictional name, a total voter count, and voter counts for two sides that add up to the total.
- **FR-004**: Each precinct MUST be classified as urban, suburban, or rural from its population density, and its details MUST show its type and density.
- **FR-005**: Denser precincts MUST be visibly smaller than sparser ones, preserving the density-to-size relationship that applied to counties.
- **FR-006**: The sum of all precinct voter counts MUST equal the state's displayed total voters, and the statewide voter makeup, city population, and voter-lean behavior from earlier features MUST be unchanged.
- **FR-007**: Urban precincts MUST lean toward the side that urban counties leaned toward before, and rural precincts MUST lean toward the other side, so that under the Democrats vs Republicans matchup at least 80% of urban precincts are won by Democrats and at least 80% of rural precincts are won by Republicans.
- **FR-008**: Every precinct MUST be hoverable, clickable, and keyboard-focusable regardless of its size, and its details MUST be available on hover and keyboard focus.
- **FR-009**: Each generated state MUST allow at least one complete plan in which every precinct is assigned, every district is contiguous, and all district voter counts are within the balance limit.
- **FR-010**: All district editing behavior from the earlier district features (8 to 20 districts, blank starting districts, unassigned precincts allowed, add/move/remove by click, contiguity checks and blocked-click messages, balance check, plan status, district list, control total, district colors) MUST continue to work with precincts in place of counties, with the same rules and limits.
- **FR-011**: Opening a shared custom-state link from an earlier version MUST NOT fail; it MUST open a state built from the same cities and city sizes using the precinct layout.

**Brush tool**

- **FR-012**: While a district is selected for editing, the website MUST offer a brush control that turns the brush tool on and off, and the brush MUST be off by default.
- **FR-013**: The brush control MUST be unavailable, and MUST say a district must be selected first, whenever no district is selected.
- **FR-014**: The website MUST provide a brush size slider with a visible current value, usable by mouse, touch, and keyboard.
- **FR-015**: The brush size slider's smallest value MUST cover roughly one to three precincts in a typical area, and its largest value MUST cover a circle at least a quarter of the state's width across; the default MUST be a medium size.
- **FR-016**: While the brush is on and the pointer is over the map, a circle matching the current brush size MUST follow the pointer, and it MUST resize immediately when the slider changes.
- **FR-017**: A click (or tap, or Enter on a focused precinct) with the brush on MUST apply the brush to every precinct whose center lies inside the circle, subject to the plan rules in FR-020 to FR-023.
- **FR-018**: Pressing and dragging with the brush on MUST apply the brush continuously along the pointer path, covering every precinct whose center was inside the circle at any point of the drag.
- **FR-019**: The brush MUST offer an add mode (default) that assigns covered precincts to the selected district, and an erase mode that removes covered precincts from the selected district; holding Shift MUST temporarily switch to the other mode, and the active mode MUST be visibly indicated.
- **FR-020**: In add mode, when the selected district is non-empty, the brush MUST add only precincts that are connected to the district, directly or through other precincts added by the same stroke; covered precincts that are not connected MUST be skipped.
- **FR-021**: In add mode, when the selected district is empty, the brush MUST first add the covered precinct nearest the brush center and then only precincts connected to it.
- **FR-022**: A covered precinct that belongs to another district MUST be moved into the selected district only if the other district stays contiguous afterward; otherwise it MUST be skipped.
- **FR-023**: In erase mode, the brush MUST remove covered precincts from the selected district only in a way that leaves the selected district contiguous (or empty); precincts whose removal would split it MUST be skipped.
- **FR-024**: A brush stroke MUST NOT leave any district non-contiguous; the result of the stroke MUST be identical whenever the same stroke is applied to the same starting plan.
- **FR-025**: After a stroke (a click, tap, or the whole drag from press to release), the website MUST show one short message with the number of precincts added, moved, or removed, the number already in the district (unchanged), and the number skipped with the reason; a stroke that changes nothing MUST say so.
- **FR-026**: Every applied brush change MUST immediately update district boundaries, number badges, district colors, list entries, details, unassigned markings, balance check, plan status, and control total, exactly as single-precinct edits do.
- **FR-027**: Pressing Escape, turning the brush off, deselecting the district, or changing the matchup or state MUST end any stroke in progress and hide the brush circle; precincts MUST then respond to clicks one at a time as in FR-010.
- **FR-028**: Precinct details pop-ups MUST NOT appear while a drag stroke is in progress.
- **FR-029**: The brush MUST work with touch input without scrolling the page during a stroke, and the brush controls MUST have clear accessible labels.
- **FR-030**: The brush size and mode MUST be remembered while the visitor keeps working on the same state, and MUST reset to defaults only when a new state is generated or a link is opened.

### Key Entities

- **Precinct**: The smallest map unit. Has a unique fictional name, a boundary, a total voter count, per-side voter counts, a density and density type (urban, suburban, rural), and at most one district. Replaces the county.
- **District**: A numbered group of precincts (0 or more, contiguous when non-empty) with voter totals that are the sum of its precincts. Unchanged except that it is built from precincts.
- **Brush**: A circular selection tool with an on/off state, a size, and a mode (add or erase). Applies to all precincts whose centers lie inside the circle at the pointer position.
- **Brush Stroke**: One click, tap, key press, or press-drag-release gesture. Produces a single summary (added, moved, removed, skipped) and one consistent plan result.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of generated states, random and custom, contain between 500 and 800 precincts and show no mention of counties anywhere in the interface.
- **SC-002**: A visitor can assign a district covering at least 10% of the state's precincts using the brush in under 20 seconds, compared with needing one click per precinct.
- **SC-003**: A visitor can complete a full plan (every precinct assigned, contiguous, within the balance limit) for a typical state in under 10 minutes using the brush, and in at least 90% of attempts in usability testing can complete one without needing a reset.
- **SC-004**: After any single brush stroke, 100% of districts remain contiguous and no precinct belongs to more than one district.
- **SC-005**: The map, district list, totals, balance check, plan status, and control total are updated within 0.25 seconds of releasing the pointer, even for the largest brush size and the largest states.
- **SC-006**: While dragging the brush, the on-screen circle keeps up with the pointer with no visible lag, and a drag of at least 3 seconds does not freeze or slow the page.
- **SC-007**: Moving the size slider from smallest to largest changes the number of precincts covered under the pointer from about 1 to 3 up to at least 10% of all precincts in at least 95% of tested placements near the middle of the state.
- **SC-008**: For 100% of tested strokes, the reported counts (added, moved, removed, unchanged, skipped) add up to the number of precincts whose centers were inside the circle, and the district totals match the sum of their precincts.
- **SC-009**: Every precinct is reachable and its details readable using hover or keyboard on 100% of generated states, including the smallest precincts.
- **SC-010**: A new random state appears within 2 seconds on a typical laptop.
- **SC-011**: Every brush control (on/off, size, mode) can be fully operated using only the keyboard, and the brush can be used by touch on a phone-sized screen.
- **SC-012**: Opening a shared link from the previous version never produces an error page; it opens a precinct-based state with the same cities.

## Assumptions

- Precincts are the new smallest unit and replace counties completely; there is no county layer above precincts. The previous state of the app (about 90 to 120 counties) is superseded.
- The precinct count of 500 to 800 is chosen so that precincts are small enough to make district drawing easy yet still large enough to hover and click on a typical screen; the exact count can be adjusted during planning if rendering or usability requires it.
- Precinct voter counts are the previous county voter totals divided among many more areas, so a typical precinct has far fewer voters than a county did. The statewide total, number of districts (8 to 20), and the 10,000-voter balance limit from earlier features are unchanged.
- Each precinct gets a unique fictional name; naming conventions are decided in planning.
- The brush is a circle; a precinct counts as covered when its center point lies inside the circle. Overlap with the circle is not required.
- The brush only changes precinct assignments for the selected district, and is turned off by default. With the brush off, clicking a precinct behaves exactly as before: add, move, or remove one precinct at a time.
- Contiguity is enforced on every brush stroke, using the same definition as before (shared borders, not single-point corners). Balance is only reported, not enforced, because the balance check already shows when districts are out of range.
- A district's hover details list its precincts by name only when there are few of them; a larger district shows its precinct count and a short sample of names followed by "and N more", so the pop-up stays readable.
- Skipped precincts are reported with a short count and reason, not highlighted individually.
- Undo or redo of a stroke is out of scope; the visitor can undo a mistake by using the erase mode or the single-precinct tools.
- Shared links keep encoding cities and city sizes only; district plans are not saved in links. Links created before this feature open with the new layout, which is not the same layout as before.
- The title, matchup toggle, legend, statewide voter makeup block, state builder, city population slider, and realistic outlines from earlier features remain as they are.
- Desktop browsers with mouse and keyboard are the primary target; touch support is required but is a secondary priority.
