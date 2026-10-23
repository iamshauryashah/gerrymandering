# Feature Specification: Single-Screen District Editing

> **Refined by [013](../013-brush-unclaimed-only/spec.md)** for the brush bar: its controls are compact and the hint and the stroke message share one cell.

> **Refined by [012](../012-flowing-summary-panels/spec.md)**: the Statewide Voters, District Control and Legend blocks now move up into open space under the Plan check when there is room, and the detail panel keeps one height with or without a selection.

**Feature Branch**: `011-single-screen-editing`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "right now, the user needs to scroll down to select a district, then scroll up to make changes to the map, then scroll down to understand the implications (too big, too small, within range, etc.) on that district, and then scroll up to make the adjustments. This up and down scrolling is not a good end user experience. I need you to update the UI so that the selection of the district, updating the map, and viewing the implications on the district does not require a user to scroll on a desktop or laptop screen. (since mobile phone screens are smaller, it is ok if some scrolling is required.)"

## Clarifications

### Session 2026-10-20

- Q: How much freedom is there to rearrange the screen, and what must stay dominant? → A: Any part of the page may be moved, resized, or condensed (header, buttons, picker, detail, plan status, brush controls, side panels), as long as the map remains the main attraction of the screen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pick a District, Edit the Map, and Read Its Status Without Scrolling (Priority: P1)

A visitor on a desktop or laptop is drawing districts. Today the district list sits far below the map and the balance numbers sit in a long side column, so each round of "pick a district, change the map, see whether the district is now too big or too small" means scrolling down and up. After this feature, everything needed for that loop is on the screen at the same time: the districts to pick from, the whole map, the selected district's status (including whether it is too big, too small, or within range), the overall plan status, and the brush controls. The visitor selects a district, paints or clicks on the map, and reads the effect right away, with the page never moving.

**Why this priority**: This is the whole request. Every drawing session repeats this loop dozens of times, so removing the scrolling is the largest improvement to the editing experience.

**Independent Test**: Can be fully tested by opening a state on a laptop-sized window, selecting a district, making a series of edits with clicks and with the brush, and confirming after each edit that the district's new status is visible without any scrolling and that the page's scroll position never changes.

**Acceptance Scenarios**:

1. **Given** a state is shown in a window at least 1280 pixels wide and 720 pixels tall, **When** the visitor selects a district for editing, **Then** the district picker, the entire map, the selected district's detail, the overall plan status, the brush controls, and the matchup toggle are all fully visible at once without scrolling.
2. **Given** a district is selected, **When** the visitor adds, moves, or removes a precinct (by click or by brush), **Then** the selected district's voter total, how far it is from the allowed range, and its status (empty, too small, within range, or too large) update on the same screen immediately, and the page does not scroll or shift.
3. **Given** a district is selected, **When** the visitor picks a different district from the picker, **Then** the detail for the newly selected district replaces the previous one in the same place, the map stays where it is, and the page does not scroll.
4. **Given** the visitor has made 10 edits in a row, **When** they look back at what they had to do, **Then** none of those steps needed a scroll action.
5. **Given** an edit is refused because it would split a district, **When** the message appears, **Then** it appears on the same screen without moving the map or the panels.

---

### User Story 2 - See Every District's Status at a Glance in the Picker (Priority: P2)

The district picker shows all districts at once, and each entry shows its number, its color, who leads it, and whether it is empty, too small, within range, or too large, with the amount it is over or under. The visitor can see which districts still need work and jump straight to the next one to fix, without hovering over entries or opening anything.

**Why this priority**: Picking the next district to fix is the first half of the loop. The loop is only scroll-free if the picker itself carries enough information to choose well, and it makes the whole plan's progress visible at a glance. It builds on Story 1's layout.

**Independent Test**: Can be fully tested by drawing part of a plan and checking that all districts appear in the picker at once, each with a readable status, that statuses update as edits are made, and that a district can be selected from the picker in one click.

**Acceptance Scenarios**:

1. **Given** a state with any number of districts from 8 to 20, **When** the screen is shown at a laptop size, **Then** every district appears in the picker at the same time, with no inner scrolling.
2. **Given** a plan is partly drawn, **When** the visitor looks at the picker, **Then** each entry shows its number, color, leading side or tie or empty, and a status word (empty, too small, within range, or too large) with how far it is over or under the allowed range.
3. **Given** the visitor edits a district, **When** the edit is applied, **Then** the picker entries for every district that changed update at once.
4. **Given** statuses are shown, **When** the visitor reads them, **Then** the status is conveyed by words (and a shape or symbol), not by color alone.
5. **Given** a district entry in the picker, **When** the visitor clicks its pen (or presses Enter or Space on it), **Then** that district becomes the one being edited, as before.

---

### User Story 3 - Everything Else Stays Available, and Other Screen Sizes Still Work (Priority: P3)

The rest of the page (the statewide voter block, the district control totals, the legend, the help text, the fictional-data notice, and the buttons to start a new map or build a state) is all still there. It may be moved, condensed, or placed lower on the page, but nothing is removed, and the visitor never has to reach it in the middle of the editing loop. On smaller windows and phones the page falls back to a stacked layout where some scrolling is fine; there is never sideways scrolling.

**Why this priority**: It protects what already works and covers the screens the main goal does not target. It is lower priority because the editing loop itself is delivered by Stories 1 and 2.

**Independent Test**: Can be fully tested by checking that every earlier piece of information and control is still present and working at several window sizes, including a phone-sized one, and that there is no horizontal scrolling at any size.

**Acceptance Scenarios**:

1. **Given** the new layout, **When** the visitor looks for the statewide voter block, the control totals, the legend, the help text, and the notice, **Then** each is still on the page and shows the same information as before.
2. **Given** a window narrower than 1280 pixels or shorter than 720 pixels, **When** the page is shown, **Then** the layout adapts: the map, the picker, and the selected district's detail stay together where there is room, and otherwise stack, with scrolling allowed.
3. **Given** a phone-sized window (320 to 480 pixels wide), **When** the page is shown, **Then** the content stacks in a sensible order, every control is usable, and there is no horizontal scrolling.
4. **Given** the visitor resizes the window or changes the browser zoom while editing, **When** the size changes, **Then** the layout reflows without losing the current state, the selected district, or any edit.
5. **Given** the visitor switches the matchup, starts a new map, or opens the state builder, **When** these actions finish, **Then** they work as before.

---

### Edge Cases

- A state with 20 districts and a long fictional state name: the picker and the header still fit the working screen without inner scrolling.
- A message appears or disappears (a blocked-edit message, a brush summary, a hint): the map and the panels do not jump or resize because of it.
- The hover pop-up for a precinct or district opens near an edge: it stays inside the window and does not hide the selected district's detail while the visitor is editing.
- No district is selected: the detail area explains what to do (pick a district) instead of showing an empty box, and the page still fits without scrolling.
- Very wide or tall screens (for example 2560 pixels wide): the working screen uses the extra room sensibly (a larger map) and does not stretch to an unusable shape.
- A short window (for example 720 pixels tall) with 20 districts: the panels and the picker shrink or condense before the map does, and the map still covers at least 40% of the window.
- A browser with extra toolbars or a zoom level above 100% that makes the usable window smaller than 1280 by 720: the page falls back to the smaller-window layout, and scrolling there is acceptable.
- The state builder is open: it keeps working as it does now; this feature does not change it.
- Keyboard use: moving focus between the picker, the brush controls, and the map precincts never scrolls the page away from the working screen.

## Requirements *(mandatory)*

### Functional Requirements

**The editing screen**

- **FR-001**: In a window at least 1280 pixels wide and 720 pixels tall at 100% browser zoom, with a district selected, the page MUST show all of the following completely and at the same time, with no page scrolling: the district picker, the entire map, the selected district's detail, the overall plan status, the brush controls with their message line, the matchup toggle, and the editing status line.
- **FR-002**: The map MUST be the main attraction of the editing screen: it is shown whole and not cropped, it is the largest item on the screen, and it covers at least 40% of the window's area at every size in SC-001 (never smaller than 560 pixels wide and 420 pixels tall at 1280 by 720). It grows with larger windows to use the available room, without becoming unusable on very large screens.
- **FR-002a**: Every other part of the page MAY be moved, resized, or condensed to make this fit, and when room is tight those parts give way before the map does. No other single item may be as large as the map.
- **FR-003**: Selecting a district, making any edit by click or brush, and switching to another district MUST NOT scroll the page or shift the position of the map, the picker, or the panels.
- **FR-004**: When a message appears or disappears (a blocked-edit explanation, a brush summary, a hint), the map and the panels MUST NOT move or change size.
- **FR-005**: The header area (title and state caption) and the top buttons MAY be moved, made more compact, or combined with other parts to free room, but the matchup toggle, the New map button, and the Build a state button MUST remain on the page and usable.

**The district picker**

- **FR-006**: The picker MUST show every district of the state at once (8 to 20), with no inner scrolling, in every window size covered by FR-001.
- **FR-007**: Each picker entry MUST show the district's number, its color, its leading side (or tie, or empty), a status of empty, too small, within range, or too large, and the number of voters it is over or under the allowed range when it is outside it.
- **FR-008**: Statuses MUST be shown with words (and a symbol or shape), not by color alone.
- **FR-009**: Each entry MUST keep the pen control (and keyboard activation) that selects the district for editing, with the same behavior as before (one selected at a time, selecting again or pressing Escape stops editing), and the visible marking of the selected district.
- **FR-010**: Hovering or focusing a picker entry MUST still reveal that district on the map and show its details, as before.

**The selected district's detail and the plan status**

- **FR-011**: While a district is selected, a detail area next to the map MUST show for that district: its number, its leading side and margin, its voter total, its number of precincts, how far its voter total is from the allowed range (and the allowed range itself), its status (empty, too small, within range, too large), and whether it is connected.
- **FR-012**: The overall plan status MUST be visible on the editing screen: whether the plan is complete (every precinct assigned), every district is connected, the balance check passes (largest and smallest district voter counts, their difference, and the limit), and the overall valid or not valid result.
- **FR-013**: The detail area and the plan status MUST update immediately (within 0.25 seconds) after every applied change, as the existing panels do.
- **FR-014**: When no district is selected, the detail area MUST say that a district needs to be picked and show the overall plan status, so the screen is useful before editing starts.

**Everything else, and other screen sizes**

- **FR-015**: Every piece of information and every control that exists today (the statewide voter block, the district control totals, the legend, the help text, the fictional-data notice, the matchup, new map and build controls, hover details, and keyboard access) MUST remain available. They MAY be moved, condensed, or placed lower on the page, and reaching them MAY need scrolling.
- **FR-016**: In windows narrower than 1280 pixels or shorter than 720 pixels, the layout MUST adapt: it keeps the map, the picker, and the selected district's detail together where room allows, and stacks them otherwise; scrolling is allowed.
- **FR-017**: On phone-sized windows (320 to 480 pixels wide) the content MUST stack, every control MUST remain usable, and scrolling is allowed.
- **FR-018**: At every window size from 320 to 2560 pixels wide there MUST be no horizontal scrolling.
- **FR-019**: Resizing the window or changing the browser zoom MUST re-flow the layout without losing the state, the selected district, the brush settings, or any edit.
- **FR-020**: Keyboard focus order MUST stay logical (picker, then brush controls, then map, then the rest), and moving focus between these parts MUST NOT scroll the page away from the editing screen.
- **FR-021**: The state builder, the matchup behavior, the brush behavior, the district editing rules, and the statewide voter block MUST behave exactly as they do now; this feature changes where things are shown, not what they do.

### Key Entities

- **Editing Screen**: The set of things shown together while editing: the district picker, the map, the selected district's detail, the overall plan status, the brush controls, and the matchup toggle.
- **District Picker**: A compact set of entries, one per district, each showing number, color, leading side, status and amount over or under range, and the pen control.
- **District Detail**: The area describing the selected district: voters, precincts, leading side and margin, allowed range and distance from it, status, and whether it is connected.
- **Plan Status**: The overall result: complete, connected, balanced (largest, smallest, difference, limit), and valid or not.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At window sizes of 1280 by 720, 1366 by 768, 1440 by 900, 1536 by 864, and 1920 by 1080 (100% zoom), with a district selected and the brush turned on, 100% of the items in FR-001 are fully inside the window at the same time, for states with 8, 14, and 20 districts.
- **SC-002**: In an automated walkthrough of "select a district, make 10 edits (5 clicks and 5 brush strokes), then switch to another district and make 10 more", the page's scroll position never changes and no scroll action is needed at any of those window sizes.
- **SC-003**: The distance a visitor must scroll to complete one round of "pick a district, edit, read its status" drops from more than 1,000 pixels today to 0 on a 1440 by 800 window.
- **SC-004**: At every size in SC-001 the whole map is the largest item on the screen and covers at least 40% of the window's area; at 1280 by 720 it is at least 560 by 420 pixels, and at 1920 by 1080 it is at least 800 pixels wide.
- **SC-005**: All 8 to 20 districts appear in the picker at once in 100% of generated states at every size in SC-001.
- **SC-006**: The selected district's detail, its picker entry, and the plan status show the new numbers within 0.25 seconds after every edit, and the map and panels do not move when messages appear (0 pixels of layout shift in the walkthrough of SC-002).
- **SC-007**: At every width from 320 to 2560 pixels there is no horizontal scrolling, and every item that existed before this feature can still be found and used.
- **SC-008**: In a short usability check, at least 90% of testers complete "make District 3 within range" on a laptop-sized window without saying they had to scroll.

## Assumptions

- "Desktop or laptop screen" means a window at least 1280 pixels wide and 720 pixels tall (the visible page area, excluding browser toolbars) at 100% browser zoom. Smaller windows, higher zoom levels that reduce the visible area below that, tablets, and phones use the adaptive layout, where scrolling is acceptable.
- "Implications of an edit" means what the visitor reads to judge a district: its voter total against the allowed range (too small, within range, too large, and by how much), its leading side and margin, whether it is connected, and the overall plan status. The existing balance rules and numbers (10% limit, connected districts, every precinct assigned) are not changed.
- The existing district list, plan status, and control total content is reused and rearranged; no new kinds of data or rules are added.
- The title area and the top buttons can be made more compact, and sections that are not part of the editing loop (statewide voter block, legend, notice) can sit lower on the page or be condensed.
- The arrangement (for example, picker beside or below the map, detail beside the map, where the header and buttons go) is decided during planning and can be changed freely, as long as all items in FR-001 fit on the screen sizes listed and the map stays the main attraction (FR-002).
- The state builder screen is out of scope and is not changed; its own layout may still need scrolling.
- The brush, matchup, new map, and shareable links keep working exactly as they do today.
- Desktop and laptop browsers with a mouse and keyboard are the primary target; touch devices must keep working with the adaptive layout.
