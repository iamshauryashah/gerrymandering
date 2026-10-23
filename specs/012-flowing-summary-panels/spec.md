# Feature Specification: Flowing Summary Panels

**Feature Branch**: `012-flowing-summary-panels`

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "make the Statewide Voters, District Control and Legend blocks responsive so that if there is open space after Plan check, then those three panels can scooch up. The aim is to minimize vertical up/down scrolling."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Summary Panels Fill Open Space Beside the Map (Priority: P1)

A visitor on a desktop or laptop is editing districts on the one-screen editing layout from feature 011. Below the map and the right-hand column the page still has the Statewide Voters block, the District Control block, and the Legend, so reaching them means scrolling down even when the right-hand column has empty room under the Plan check. After this feature, those three blocks move up into that empty room, in that order, as many as fit completely. On a tall window all three are visible on the same screen as the map; on a short window they stay below as they do today.

**Why this priority**: This is the whole request. The empty room under the Plan check is wasted screen on every large window, and filling it removes the scrolling to those blocks without costing anything else.

**Independent Test**: Can be fully tested by opening the same state at several window sizes from 1280 × 720 up to 1920 × 1080, and checking for each size which of the three blocks are on the first screen, that they sit under the Plan check, and that nothing else on the screen has moved or shrunk.

**Acceptance Scenarios**:

1. **Given** the one-screen editing layout and room left under the Plan check for the Statewide Voters block, **When** the page is shown, **Then** that block appears directly under the Plan check, fully visible, without any scrolling.
2. **Given** room for more than one block, **When** the page is shown, **Then** the blocks appear in the order Statewide Voters, District Control, Legend, with no gap in the order (the District Control block is never shown there while the Statewide Voters block is left below, and the Legend is never shown there while the District Control block is left below).
3. **Given** a window tall enough for all three blocks, **When** the page is shown, **Then** all three are visible at once with the map, the picker, the district detail, the Plan check, and the brush controls, and none of them is shown a second time lower on the page.
4. **Given** a window with no room under the Plan check (for example 1280 × 720 with 20 districts), **When** the page is shown, **Then** the page looks and behaves as it did before this feature: the three blocks follow below the screen and can be reached by scrolling.
5. **Given** the three blocks are shown beside the map, **When** the visitor edits the map, **Then** their numbers update immediately, and the page does not scroll or shift.

---

### User Story 2 - The Panels Re-Flow When the Window or the State Changes (Priority: P2)

How many blocks fit depends on the window height and on how much room the picker and the Plan check take. When the visitor resizes the window, zooms the page, loads a state with a different number of districts, or the Plan check changes between its shorter and longer forms, the set of blocks shown beside the map is recalculated, so the blocks that fit are up and the ones that do not fit are below, with nothing cut off and nothing overlapping.

**Why this priority**: The one-screen layout is only useful if it stays correct when the window is not the size it was first opened at. It builds on Story 1.

**Independent Test**: Can be fully tested by opening the page at a tall size, shrinking the window step by step to a short size and growing it back, and by loading states with 8, 14, and 20 districts, checking each time that the blocks beside the map are exactly the ones that fit completely.

**Acceptance Scenarios**:

1. **Given** all three blocks are beside the map, **When** the window is made shorter until the last block no longer fits, **Then** that block (and only the blocks after it in the order) moves below, and no block is ever partly cut off or hidden.
2. **Given** a block is below because it did not fit, **When** the window is made taller until it fits, **Then** it moves up beside the map.
3. **Given** the visitor loads a new state with more districts, **When** the picker grows, **Then** the blocks that no longer fit move below, and the picker, the district detail, and the Plan check do not shrink or move to make room for them.
4. **Given** the visitor is in the middle of a brush stroke or an edit, **When** the window is resized, **Then** the edit is not lost or interrupted.

---

### User Story 3 - Other Layouts Use Their Open Space Too (Priority: P3)

On mid-sized windows (such as a small laptop window, or a tablet) the page shows the map with a narrower column beside it. When that column has empty room under the Plan check, the same blocks move up into it, in the same order and under the same rule, so the visitor scrolls less there as well. On phone-sized windows, where there is no column beside the map, the blocks simply follow in one column as they do today.

**Why this priority**: It extends the same idea to the screens the main goal does not target. The one-screen layout (Stories 1 and 2) is the main benefit, and these screens already allow some scrolling.

**Independent Test**: Can be fully tested by opening the page at 1000 × 800, 768 × 1024, and 390 × 800 and checking where each of the three blocks is, that nothing overlaps or runs off the side, and that there is no sideways scrolling.

**Acceptance Scenarios**:

1. **Given** a window with a column beside the map and open room under the Plan check, **When** the page is shown, **Then** the blocks that fit completely appear in that column, in order, and the rest follow below the map.
2. **Given** a phone-sized window, **When** the page is shown, **Then** the three blocks appear in one column below the map and the controls, in the order Statewide Voters, District Control, Legend, as before.
3. **Given** any window size, **When** the page is shown, **Then** there is no sideways scrolling.

---

### Edge Cases

- **A block is taller than the open room by a small amount**: it stays below. A block is never squeezed, clipped, or given its own inner scroll bar to make it fit.
- **Open room that is too small for any block**: nothing moves up and the column keeps the Plan check as its last item.
- **The Plan check text changes length**: the room under it changes with it; the page recalculates, but the picker, the detail, and the Plan check keep their sizes and positions, and the blocks that are already shown only move down or out if they no longer fit.
- **Build a state mode**: the builder panel replaces the editing panels as it does today, and the three blocks keep following the layout used in that mode; they do not appear in the column.
- **An error is shown instead of a map**: the layout falls back as it does today, and the blocks are not shown beside an empty map.
- **Keyboard and screen-reader order**: moving a block up must not make the reading order or the Tab order jump around; the blocks stay in the order Statewide Voters, District Control, Legend, after the Plan check.
- **Page zoomed in**: the room under the Plan check shrinks, so fewer blocks (possibly none) are beside the map; this is the same as a shorter window.
- **No room on a tall window because the picker is full**: if 20 districts fill the column, the blocks stay below even on a window that is tall enough for fewer districts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On the one-screen editing layout, the system MUST place the Statewide Voters, District Control, and Legend blocks, in that order, under the Plan check and its reserved message area (which stays right under the Plan check so it never moves), as many of them as fit completely in the room that is left in the column.
- **FR-002**: A block MUST be placed under the Plan check only if all of it fits fully inside the window without scrolling; a block MUST never be clipped, squeezed, given an inner scroll bar, or overlap another block.
- **FR-003**: If a block does not fit, it and every block after it in the order MUST stay in their normal place below, and MUST be reachable by scrolling the page.
- **FR-004**: Each of the three blocks MUST appear exactly once on the page, either under the Plan check or in its normal place below, and MUST show the same information as before in either place.
- **FR-005**: Placing blocks under the Plan check MUST NOT change the size or position of the map, the district picker, the district detail, the Plan check, the message area, or the brush controls, and MUST NOT shrink the map.
- **FR-006**: The set of blocks shown under the Plan check MUST update when the window is resized, the page is zoomed, a state with a different number of districts is loaded, or the Plan check changes length, with no reload needed and without losing an edit or brush stroke in progress.
- **FR-007**: Editing MUST keep every behavior it had before (selecting, adding, moving, and removing precincts, brushing, undo and messages), and the numbers in the blocks MUST update as before wherever the blocks are shown.
- **FR-008**: On windows with a column beside the map but not the one-screen layout, the system MUST apply the same rule (FR-001 to FR-004) to the open room under the Plan check in that column.
- **FR-009**: On narrow (phone-sized) windows, the three blocks MUST stay in one column in the order Statewide Voters, District Control, Legend, below the map and its controls, as before.
- **FR-010**: The system MUST NOT cause sideways scrolling at any window size.
- **FR-011**: The Tab order and the reading order MUST stay Plan check, Statewide Voters, District Control, Legend, whether the blocks are beside the map or below it.
- **FR-012**: In Build a state mode, and while an error replaces the map, the blocks MUST keep the layout those modes use today.
- **FR-013**: No information, control, or block may be removed; the help text and the fictional-data notice stay where they are, below the three blocks.

### Key Entities

- **Summary Block**: One of the three secondary panels, the Statewide Voters block, the District Control block, or the Legend. It has a fixed order and a size that does not change to fit.
- **Open Room**: The space left in the column beside the map after the Plan check, measured against the visible window. It is what decides how many Summary Blocks move up.
- **Placement**: For each Summary Block, whether it is shown under the Plan check or in its normal place below. It follows from the Open Room and the order, never from a setting.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 1920 × 1080 with up to 14 districts, all three blocks are visible on the first screen together with the map, the picker, the district detail, the Plan check, and the brush controls, and the visitor does not scroll to reach any of them.
- **SC-002**: At every tested laptop and desktop size from 1280 × 720 to 1920 × 1080 and with 8, 14, and 20 districts, the number of blocks under the Plan check equals the number that fit completely: adding one more block would exceed the window.
- **SC-003**: In every tested size, no block is clipped, overlaps another, has an inner scroll bar, or is shown twice, and no part of the page is wider than the window.
- **SC-004**: Placing the blocks under the Plan check changes the position and size of the map, the picker, the detail, the Plan check, and the brush controls by 0 pixels compared with the same window before the feature.
- **SC-005**: Whenever at least one block moves up, the distance the page can be scrolled is smaller than it was with all blocks below the map, and with all three up only the help text and the notice are left below.
- **SC-006**: After shrinking and growing the window through at least five sizes, the blocks under the Plan check are exactly the ones that fit at each size, and an edit started before a resize finishes correctly.
- **SC-007**: A visitor can read the statewide voter makeup and the district control totals while editing, at 1920 × 1080, without moving the page, in a review of the editing loop (pick, edit, read) of at least ten edits.

## Assumptions

- This builds on feature 011. The one-screen layout (map on the left; picker, district detail, Plan check, and message area in the column on the right) is the starting point, and its measured sizes and its "map stays the main attraction" rule still apply.
- The blocks go under the Plan check only when the room is real: they never make the map smaller and never force the column to scroll inside itself.
- The order (Statewide Voters, District Control, Legend) is fixed and each block is all-or-nothing; a later block never jumps ahead of an earlier one that does not fit.
- The Statewide Voters, District Control, and Legend blocks keep their present content. Beside the map they may use tighter spacing so more of them fit, but they are never collapsed, tabbed, hidden, or cut to fit. If the tighter spacing still cannot show all three at 1920 × 1080 with up to 14 districts (SC-001), SC-001 is revised to the measured result during implementation.
- The help text and the fictional-data notice stay below the page content and may still need scrolling to reach; only the three named blocks move.
- At the smallest laptop size with the most districts there is no open room, so the three blocks stay below there; the feature helps most on taller windows, and that is expected.
- "Fits" is judged against the visible window height, and the result is recalculated whenever that height or the column content changes.
- Phone-sized windows already scroll by design and are not a target for fewer scrolls.
- The statewide, control, and legend numbers and what they mean are unchanged by this feature.
