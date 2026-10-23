# Research: Brush Only Takes Unclaimed Precincts

## R1. Where the rule goes

**Decision**: In `applySegment`'s add branch, before the adjacency and split checks, skip any covered precinct whose current district is not null and not the selected district when the stroke has `unclaimedOnly`. Record the reason `claimed`.

**Rationale**: The add branch already loops over covered precincts in a fixed order until nothing changes. A precinct skipped first for being claimed never reaches the "split source" rule, so no other district can be touched. With the rule on, nothing is removed from any district, so no other district can become non-contiguous, and the selected district still grows only through adjacent precincts.

**Alternatives considered**: Filtering the covered list before the loop (loses the covered count and the reason, so the message could not report it); post-processing the result by undoing moves (could leave the plan in a state the rules never allow).

## R2. Empty selected district and stroke order

**Decision**: Unchanged ordering. For an empty selected district the covered precincts are sorted by distance from the stroke start; claimed ones are skipped in the loop, so the first unclaimed one in that order starts the district, which is exactly "the covered unclaimed precinct nearest the start" (spec Story 1, scenario 4). Unclaimed precincts that touch the district only through a claimed precinct stay skipped as `not-adjacent`.

**Rationale**: Keeps the engine deterministic: the same stroke on the same plan gives the same result (FR-005).

## R3. The setting and its lifetime

**Decision**: `app.brush` becomes `{ on, size, mode, unclaimedOnly }`. `setBrush({ unclaimedOnly })` changes it, the `brush` getter reports it, and the place that resets brush settings for a new state (map, custom state, opened link) resets it to false. The stroke copies the value when it starts, so toggling later cannot change a stroke in progress. Turning the brush off or selecting another district leaves it alone.

**Rationale**: Matches spec FR-008 and the way size and mode already behave. The stroke already captures the effective mode at its start (Shift held), so `unclaimedOnly` applies only when that captured mode is add (FR-006).

**Alternatives considered**: Saving it in the shared link (rejected in the spec's assumptions); reading it live during the stroke (makes results depend on timing).

## R4. The control

**Decision**: A native `<input type="checkbox">` with a visible label "Only unclaimed precincts" in the brush section, `data-role="brush-unclaimed"`, checked state in the DOM, off by default, disabled when no district is selected or the brush mode is Erase. In erase mode it is dimmed, has a `title` ("Applies when adding") and an `aria-describedby` pointing at a visually hidden note "Applies to Add only", so touch and screen-reader users get the same information as hover users. It is not a custom switch widget.

**Shift**: the box's look follows the chosen mode only. The stroke captures the effective mode (chosen mode, flipped while Shift is held) and the stored value, so with Erase chosen and Shift held the stroke adds and the stored value applies, and with Add chosen and Shift held the stroke erases and the value is ignored.

**Rationale**: A checkbox gives Space-to-toggle, touch targets, focus ring and "checked / not checked" announcements without code, and shows state with a check mark, not color alone (SC-004). Disabled-in-place keeps the layout stable (spec Story 2, scenario 3).

**Alternatives considered**: A button with `aria-pressed` styled like the brush toggle (needs more code for the same result and looks like the main toggle); hiding it in erase mode (would move other controls).

## R5. A defect found in the brush bar, and the bar budget

Measured at 1280 × 720 with the brush on, in a browser tab that was still running older CSS (so the bar read 772 × 56; the current rule gives a 52 px row, to be re-measured on a fresh load in T001): the notes cell (hint plus message) is 239 px wide and 85 px tall, so the text overflows the bar by 30 px or more and runs off the bottom of the window (notes bottom 745 against a window of 720). The 011 fit test only checked the bar's own box, so it did not see this.

Bar width budget at 1280 (772 minus 24 padding): toggle 106 + mode 128 + size field 232 + gaps 42 = 508, leaving 239 for the notes. A new control of about 190 px does not fit beside them, and the bar would wrap to two rows and grow past its 52 px row, which would shrink the map (breaks FR-011).

**Decision**: In the one-screen layout make the bar compact and keep it one row:
- the toggle, the mode radios and the size field use tighter padding and gaps and a 96 px slider;
- the checkbox label wraps to two short lines ("Only unclaimed" / "precincts") beside its box, about 110 px wide;
- the notes cell shows one thing at a time: the stroke message while there is one, otherwise the hint, clamped to two lines of the cell (about 250 px wide);
- the hint text while the brush is on is shortened to fit two lines: "Click or drag on the map. Hold Shift to swap Add and Erase."
- a test asserts that every element in the bar, notes included, lies inside the bar and inside the window.

Total: about 90 + 100 + 110 + 150 + gaps 40 = 490, leaving about 255 px for the notes.

**Rationale**: Fixes the overflow and makes room for the new control without touching any other box. The hint and the message already never need to be visible together: the message replaces the hint's job after a stroke.

**Alternatives considered**: Letting the bar grow to two rows (the map would shrink, spec SC-005 would fail); moving the stroke message to the message slot in the column (changes where 010's message lives and the column has about 3 px spare at 20 districts); dropping the hint (the spec keeps every message).

## R6. Other layouts

**Decision**: In the two-column and one-column layouts the bar wraps freely; the checkbox simply flows with the other controls. No fixed heights there.

**Rationale**: Only the workbench has a fixed row.

## R7. Message wording

**Decision**: Reason text for `claimed` is "already in another district". The existing summary builds "No precincts were changed: 12 precincts under the brush already in another district." and "Added 5 precincts, 2 already in District 3, skipped 9 (already in another district)". Skipped counts are separate per reason through the existing `reasons` map (spec FR-009, SC-006).

**Rationale**: Reuses the summary path; one string added.

**Alternatives considered**: A separate "left alone" count (a sixth bucket would break the rule that added, moved, removed, unchanged and skipped add up to covered).

## R8. Testing the guarantee

**Decision**: A seeded property test in `tests/brush.test.js`: on a plan with several finished districts and unclaimed land, apply 100 random strokes (random start, size, drag path, selected district) with the setting on and check: no precinct that was in a district before is in a different district after; every precinct that changed was unclaimed before; every district stays contiguous; the result is repeatable. With the setting off (omitted and explicit false) the result of the same 100 strokes equals the result of the current engine, using a fixed expected snapshot generated before the change (T001 captures it).

**Rationale**: Directly proves SC-001 and SC-002.

## Final measured values

**Baseline before 013 (T001)**: full suite 171 passed, 0 failed (after 012). Brush bar on a fresh page load, 20 districts, brush on, a stroke message showing (bar height is the 52 px row everywhere; notes cell is the hint plus the message):

| Window | Bar | Notes cell (width × height, bottom) | Bar bottom | Overflow past the bar |
|---|---|---|---|---|
| 1280 × 720 | 772 × 52 | 239 × 85, 749 | 708 | 41 px (and 29 px past the window) |
| 1366 × 768 | 858 × 52 | 325 × 68, 780 | 756 | 24 px (12 px past the window) |
| 1440 × 900 | 932 × 52 | 399 × 51, 895 | 888 | 7 px |
| 1536 × 864 | 1028 × 52 | 495 × 51, 859 | 852 | 7 px |
| 1920 × 1080 | 1412 × 52 | 879 × 42, 1066 | 1068 | none |

Control widths at 1280: toggle 106, mode 128, size field 232. This confirms the overflow described in R5 on a fresh load (the 56 px figure there came from a tab with older CSS).

_After 013 (compact bar, same strokes, long message showing)_: the bar stays 52 px tall at every size and nothing in it overflows. Control widths are the same at every size: toggle 93, Add/Erase stacked 60, the box 124 (two lines), size field 146. The notes cell is 301 × 28 px at 1280 × 720 (two lines), 387 at 1366, 461 at 1440, 557 at 1536 and 941 at 1920 (one line). The 41 px overflow at 1280 × 720 and the 24 px and 7 px overflows at 1366 and 1440 are gone. The size label shows "Size" in the one-screen bar (its accessible name is still "Brush size"), and the stroke message also carries a `title` with its full text.
