---
description: "Tasks for feature 013"
---

# Tasks: Brush Only Takes Unclaimed Precincts

**Input**: Design documents from `/specs/013-brush-unclaimed-only/`

**Prerequisites**:
- [plan.md](./plan.md)
- [spec.md](./spec.md)
- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [contracts/changes.md](./contracts/changes.md)
- [quickstart.md](./quickstart.md)

**Tests**: Included, in the parallel suite.
- Run a group with `python3 scripts/test.py brush` (or `ui`, `layout`), everything the change could touch with `python3 scripts/test.py --affected`, and the full suite once at the end with `python3 scripts/test.py`.
- Engine tests are in `tests/brush.test.js` (the `brush` group), panel and state tests in `tests/ui.test.js`, bar-fit tests in `tests/layout.test.js` (the `layout` group, same-origin iframes of exact sizes).

**Order**: The phases follow dependencies, not only story numbers.
- Setup captures today's stroke results before any engine change, so "setting off behaves exactly as before" can be proved.
- Foundational work carries the setting through the engine's options and the app's brush state without changing any behavior.
- US1 (the rule itself) comes first, then US2 (the control and the compact brush bar), then US3 (remembering, resetting and reporting).

**Terms**: Names come from [data-model.md](./data-model.md) and [contracts/changes.md](./contracts/changes.md). "Claimed" means assigned to any district; "unclaimed" means no district. "Setting" is `unclaimedOnly`.

**Measuring tasks** (T017, T024) record real sizes of the brush bar in [research.md](./research.md) ("Final measured values") and [quickstart.md](./quickstart.md) ("Results"). If the bar cannot hold the new checkbox inside its one 52 px row at 1280 × 720 with a message showing, do not let the bar grow: shorten labels or the slider further, and say so in the completion report.

**Do not**: change what the brush does with the setting off, what single clicks do, the shared-link format, or the boxes of the map, picker, detail, Plan check and message area.

**Relation to 012**: Implement [012](../012-flowing-summary-panels/tasks.md) first. Both features edit `styles.css`, `src/main.js` and `tests/layout.test.js`, and T010 and T013 compare against the final column and bar boxes that 012 leaves. If 013 is built first instead, re-run the 012 layout tests afterwards. Either way, re-run T001's bar measurement after the other feature lands.

## Phase 1: Setup

- [x] T001 Run `python3 scripts/test.py` and record the current full-suite count as the baseline (0 failures). Then, before touching `src/brush.js`, create `tests/brush-baseline.js` exporting a snapshot of today's behavior: for a fixed generated state (use `tests/fixtures.js`) and a fixed seeded list of 100 strokes (random district 1 to 8, size, mode add or erase, a click or a drag of 2 to 12 points, applied in sequence to one evolving plan), the assignments after each stroke and each stroke's summary message. Generate it by running the unchanged engine once (a throwaway script or temporary test that prints JSON), paste the result into the file, and add the file to `shared` in `tests/groups.json`. Also record in `specs/013-brush-unclaimed-only/research.md` ("Final measured values") the brush bar's widths and heights at 1280 × 720 with the brush on and a stroke message showing, measured on a fresh page load with a hard reload (the figures quoted in research R5 came from a tab with older CSS; the current row is 52 px).

---

## Phase 2: Foundational — carry the setting through, change nothing yet

**Purpose**: The option exists everywhere it must, and the app can set and read it, but the engine ignores it so far. The suite stays green.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 In `src/brush.js`, add `unclaimedOnly = false` to the options of `startStroke` and `strokeAt` and store `unclaimedOnly: Boolean(unclaimedOnly) && mode === 'add'` on the stroke, per [contracts/changes.md](./contracts/changes.md). Nothing else in the engine reads it yet.
- [x] T003 In `src/main.js`: add `unclaimedOnly: false` to `app.brush` at start and at the place that resets the brush for a new state, link or custom state (the `app.brush = { on: false, size: ..., mode: 'add' }` line near the state-change reset); make `setBrushOptions` accept `unclaimedOnly` (a boolean is stored as given, anything else is ignored); make `startRun` pass `unclaimedOnly: app.brush.unclaimedOnly` to `startStroke`; make the `brush` getter and `setBrush` report and set it; pass it to `brushPanel.render`.
- [x] T004 Run `python3 scripts/test.py brush ui`; all pass. The 100-stroke snapshot from T001 is not tested yet (T006 adds that test).

**Checkpoint**: The setting exists end to end with no behavior change.

---

## Phase 3: User Story 1 — Paint without stealing from other districts (Priority: P1) 🎯 MVP

**Goal**: With the setting on and the brush adding, only unclaimed precincts are added; other districts are never touched.

**Independent Test**: Draw two neighboring districts, paint across the shared border with the setting on, and check that only unclaimed precincts joined.

### Tests for User Story 1

- [x] T005 [P] [US1] In `tests/brush.test.js`, add the rule tests (FR-002, FR-003, FR-005; spec Story 1 scenarios 1, 2, 4, 5): with `unclaimedOnly` on, (a) a stroke covering unclaimed and other-district precincts adds only the unclaimed connected ones and leaves every precinct of every other district exactly as it was; (b) a stroke covering only other-district precincts changes nothing, `skipped` equals the covered count and the reasons are `claimed`; (c) an unclaimed precinct reachable only through a claimed one is skipped as `not-adjacent`; (d) an empty selected district starts at the unclaimed covered precinct nearest the start, even when a claimed precinct is nearer; (e) precincts already in the selected district count as unchanged; (f) erase mode ignores the option (same result as without it); (f2) Shift cases through the app's `dragBrush(points, { shiftKey: true })` (in `tests/ui.test.js` if the app hook is needed): with Add chosen and Shift held the stroke erases and the option makes no difference, with Erase chosen and Shift held the stroke adds and the stored option applies (claimed precincts untouched); (g) the same stroke on the same plan gives the same plan and summary; (h) `moved` and `removed` are always 0 with the option on in add mode.
- [x] T006 [US1] In `tests/brush.test.js`, add the guarantee tests (SC-001, SC-002; research R8): (a) on a plan with several finished districts and unclaimed land, 100 seeded random strokes (random start, size, drag path, selected district) with the option on: no precinct that was in a district before a stroke is in a different district after it, every precinct that changed was unclaimed before, every district stays contiguous, and replaying the same list gives the same plans; (b) the same 100-stroke list from T001 with the option missing and with it explicitly `false` equals `tests/brush-baseline.js` exactly (assignments and messages).

### Implementation for User Story 1

- [x] T007 [US1] In `src/brush.js`, add the rule to `applySegment`'s add branch: after the "already in the selected district" check and before the adjacency and split checks, `if (stroke.unclaimedOnly && (working[id] ?? null) !== null) { stroke.reasons.set(id, 'claimed'); continue; }`; add `claimed` to `reasonText` returning `already in another district`. Touch nothing else in the engine.
- [x] T008 [US1] Run `python3 scripts/test.py brush`; all pass, including T006(b) (the off-behavior is byte-identical).

**Checkpoint**: User Story 1 works on its own through the app's `setBrush({ unclaimedOnly: true })`; the control comes next.

---

## Phase 4: User Story 2 — The switch is clear, stays put, and fits the screen (Priority: P2)

**Goal**: A labelled checkbox in the brush bar, usable by mouse, touch and keyboard, available only while adding, and the bar still fits its one row.

**Independent Test**: Toggle the checkbox with mouse and keyboard, switch between Add and Erase, and check the bar's contents and every other box.

### Tests for User Story 2

- [x] T009 [P] [US2] In `tests/ui.test.js`, add the control tests (FR-001, FR-006, FR-007; Story 2 scenarios 1 to 3): the checkbox `[data-role="brush-unclaimed"]` exists in the brush section with the visible label "Only unclaimed precincts" and is unchecked; it is disabled with no district selected; with a district selected it is enabled, a click and then a Space press (focus it, dispatch the key) each toggle it and the app's `brush.unclaimedOnly` follows; in erase mode it is still in the same place, disabled, with a `title` and an `aria-describedby` that resolves to the hidden note "Applies to Add only" (and both are gone in add mode), and enabled again (with its old state) after switching back to add; a drag through the app with it on leaves another district's precincts untouched (end to end), and after that stroke the selected district's list tile and the plan status have changed (FR-012); pressing Enter on a focused precinct with the brush on and the option on adds only if the precinct is unclaimed and leaves a claimed precinct where it is (FR-005); single clicks with the brush off still take a precinct from another district whether it is on or off (FR-010).
- [x] T010 [P] [US2] In `tests/layout.test.js`, add the brush bar fit test (FR-011, SC-005; research R5): at 1280 × 720, 1366 × 768, 1440 × 900, 1536 × 864 and 1920 × 1080 with 20 districts, a district selected and the brush on, after a stroke that leaves a long message (for example one that adds, leaves some unchanged and skips both claimed and not-touching precincts): every element in the brush bar (toggle, mode radios, the checkbox and its label, size field, hint or message) lies fully inside the bar box and the window; the bar is no taller than its row (52 px); the map frame, picker, detail, Plan check and message area boxes equal their boxes with the checkbox temporarily hidden; the page has not scrolled. This test is expected to fail before T013 (it also catches the 85 px notes overflow found in planning).
- [x] T011 [P] [US2] In `tests/layout.test.js`, add the other-layout test (spec Story 2, FR-011): at 1000 × 800, 768 × 1024, 390 × 800 and 320 × 700 the checkbox is visible and inside the window, the brush bar wraps without clipping, and `documentElement.scrollWidth` does not exceed the window width.

### Implementation for User Story 2

- [x] T012 [US2] In `index.html` add the checkbox between the mode fieldset and the size field exactly as in [contracts/changes.md](./contracts/changes.md); in `src/ui/brush-panel.js` read it, wire its `change` to a new `onUnclaimedOnly(checked)` callback, and make `render({ available, on, mode, size, unclaimedOnly })` set `checked`, `disabled` (when `!available` or `mode === 'erase'`); add the hidden note `<span class="visually-hidden" id="brush-unclaimed-note" data-role="brush-unclaimed-note">Applies to Add only</span>` after the label and, while the box is disabled for erase, set a `title` ("Applies when adding") and `aria-describedby="brush-unclaimed-note"` on the checkbox (remove both otherwise); in `src/main.js` pass `onUnclaimedOnly: (value) => setBrushOptions({ unclaimedOnly: value })` when creating the panel.
- [x] T013 [US2] In `styles.css` and `src/ui/brush-panel.js`, make the one-screen brush bar compact per research R5: tighter padding and gaps and a 96 px slider for the controls; the checkbox label wraps to two short lines beside its box (about 110 px wide); the notes cell shows the stroke message while there is one and otherwise the hint, clamped to two lines (`say` and `render` keep `hint.hidden` equal to "the message is not empty", with the hint's `textContent` always set); shorten the hint while the brush is on to "Click or drag on the map. Hold Shift to swap Add and Erase."; dim `.brush-unclaimed` when its input is disabled like the other brush controls. Leave the two-column and one-column layouts free-flowing.
- [x] T014 [US2] Run `python3 scripts/test.py brush ui layout districts`; all pass. Fix by adjusting widths, labels or the slider, not by loosening T010.
- [x] T015 [US2] Check by hand with quickstart sections 2, 3 and 5 at 1280 × 720 (browser device toolbar is fine); fix any clipping or shift found. Also confirm SC-003 by hand: a first-time user (or you, without reading help) ticks the box and the next stroke leaves the neighboring district untouched in one try.

**Checkpoint**: User Stories 1 and 2 both work: the rule, a usable control, and a bar that fits.

---

## Phase 5: User Story 3 — The setting is remembered and reported (Priority: P3)

**Goal**: The setting behaves like the other brush settings, and the message explains claimed skips.

**Independent Test**: Turn it on, work through the changes in the spec, then start a new state and check the reset; read the messages after mixed strokes.

### Tests for User Story 3

- [x] T016 [P] [US3] In `tests/ui.test.js`, add the memory and reset tests (FR-008, SC-007): with it on, ten district selections, brush off and on, size changes, mode changes and matchup changes leave it on (the checkbox is checked each time); a new map, a custom state ("Use this state") and an opened link (`?seed=` load or the existing link-open path used by earlier tests) each leave it off and unchecked; a stroke in progress is not affected by changing the setting afterwards.
- [x] T017 [P] [US3] In `tests/brush.test.js` and `tests/ui.test.js`, add the message tests (FR-009, SC-006; research R7): an all-claimed stroke says "No precincts were changed: N precincts under the brush already in another district."; a mixed stroke says "Added …, N already in District D, skipped M (already in another district)" with the claimed reason counted separately from `not-touching`; added, moved, removed, unchanged and skipped still add up to covered; the brush panel shows the message in the notes cell and hides the hint while a message exists, and shows the hint again after the brush is turned off or a new stroke starts.

### Implementation for User Story 3

- [x] T018 [US3] Fix whatever T016 and T017 find in `src/main.js`, `src/brush.js` or `src/ui/brush-panel.js` (for example a reset path that was missed, or the hint staying hidden after the message is cleared). Keep the contract in [contracts/changes.md](./contracts/changes.md); update it if it changes.
- [x] T019 [US3] Run `python3 scripts/test.py brush ui layout`; all pass.

**Checkpoint**: All three stories work.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T020 [P] Add short notes under the title of `specs/010-precinct-brush-tool/spec.md` ("**Extended by [013](../013-brush-unclaimed-only/spec.md)**: the brush has an option to take only unclaimed precincts when adding.") and `specs/011-single-screen-editing/spec.md` ("**Refined by [013](../013-brush-unclaimed-only/spec.md)** for the brush bar: its controls are compact and the hint and the stroke message share one cell.").
- [x] T021 [P] Fill in "Final measured values" in `specs/013-brush-unclaimed-only/research.md` (the bar's content widths and heights at the five window sizes, the notes cell's room, and the before and after of the overflow found in planning) and "Results" in `specs/013-brush-unclaimed-only/quickstart.md` (the test run and the 100-stroke result).
- [x] T022 [P] Remove anything unused (old brush bar rules that nothing uses, debug code). Run `python3 scripts/test.py --affected`.
- [x] T023 Run the full suite once with `python3 scripts/test.py`; it must pass with 0 failures.
- [x] T024 Final checks: every `data-role` the tests and `src/main.js` query exists exactly once in `index.html`; the checkbox's accessible name is "Only unclaimed precincts"; no console errors on load, stroke or reset; with the setting off, the 100-stroke baseline still matches exactly; the 010 and 011 tests pass unchanged apart from the hint-text wording.

---

## Dependencies & Execution Order

- **Setup (Phase 1)**: T001 first, before any engine change (the baseline must come from unchanged code).
- **Foundational (Phase 2)**: needs Setup. T002 and T003 touch different files and can run in parallel; T004 last.
- **US1 (Phase 3)**: needs Phase 2. T005 and T006 are in one file, so one after the other; T007 after them; T008 last.
- **US2 (Phase 4)**: needs Phase 2; the end-to-end test in T009 needs US1's rule. T009, T010 and T011 are in two files (T010 and T011 share one, so one after the other); T012 before T013; T014 after T013; T015 last.
- **US3 (Phase 5)**: needs US1 and US2. T016 and T017 touch overlapping files, so one after the other; T018 follows; T019 last.
- **Polish (Phase 6)**: needs all stories. T020, T021 and T022 in parallel; T023 after them; T024 last.

## Parallel Opportunities

```text
Setup:         T001 (alone, first)
Foundational:  T002 + T003, then T004
US1 tests:     T005 → T006 (same file), then T007 → T008
US2 tests:     T009 + (T010 → T011), then T012 → T013 → T014
Polish:        T020 + T021 + T022
```

## Implementation Strategy

- **MVP**: Phases 1 to 3 (through T008). That delivers the guarantee itself: with the setting on, the brush never takes from another district. It is usable through the app's `setBrush` hook; the checkbox follows in Phase 4.
- **Incremental**: US2 adds the visible control and fixes the bar overflow found in planning; US3 adds persistence and the message polish.
- **Risk first**: whether the checkbox fits the 52 px row is the main unknown. T010 is written before T013 so it fails first, and T013 is where the room is won.
- **Speed**: while working, run only the groups named in each task (each about 15 s or less); run the full suite once at T023.
