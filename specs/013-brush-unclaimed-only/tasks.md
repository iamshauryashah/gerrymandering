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

**Tests**: Required by the feature's measurable success criteria. Use the browser test runner:
`python3 scripts/test.py brush ui layout`.

**Terms**: "Claimed" means assigned to any district; "unclaimed" means assigned to no district.
The setting is `unclaimedOnly`.

## Phase 1: Setup

**Purpose**: Capture baseline behavior before changing the brush engine.

- [x] T001 Run `python3 scripts/test.py` and record the passing baseline in `specs/013-brush-unclaimed-only/research.md`; capture the unchanged engine's 100-stroke assignments and messages in `tests/brush-baseline.js`, register that file in `tests/groups.json`, and add root ignore patterns in `.gitignore`.

## Phase 2: Foundational

**Purpose**: Carry the new setting through the engine and app state without changing brush behavior.

- [x] T002 Add `unclaimedOnly = false` to `startStroke` and `strokeAt` options in `src/brush.js`; store it on the stroke as true only when the option is truthy and `mode === 'add'`.
- [x] T003 Add `unclaimedOnly: false` to initial and new-state brush settings in `src/main.js`; accept boolean updates, pass the value into `startStroke`, and expose it through the `brush` getter and `setBrush` test hook.
- [x] T004 Run `python3 scripts/test.py brush ui` and confirm unchanged behavior still passes in `tests/brush.test.js` and `tests/ui.test.js`.

**Checkpoint**: The setting is carried end to end but has no effect on precinct assignment.

## Phase 3: User Story 1 - Paint Without Stealing From Other Districts (Priority: P1) 🎯 MVP

**Goal**: With the setting enabled for an add stroke, only unclaimed precincts can join the selected district.

**Independent Test**: In `tests/brush.test.js`, paint across a shared border with the option enabled and verify that only connected unclaimed precincts change assignment while every other district remains untouched.

### Tests for User Story 1

- [x] T005 [P] [US1] Add focused engine tests in `tests/brush.test.js` for claimed-only coverage, mixed claimed/unclaimed coverage, already-selected precincts, empty-district start order, adjacency through claimed land, erase mode, repeatability, and zero moved/removed precincts.
- [x] T006 [US1] Add a seeded 100-stroke guarantee and compatibility test in `tests/brush.test.js`; assert every changed precinct was unclaimed before its stroke, all districts remain contiguous, replay is deterministic, and omitted/false options match `tests/brush-baseline.js`.

### Implementation for User Story 1

- [x] T007 [US1] In `src/brush.js`, skip claimed precincts in the add branch before adjacency or split checks when `stroke.unclaimedOnly` is true, record reason `claimed`, and map it to the text "already in another district".
- [x] T008 [US1] Run `python3 scripts/test.py brush` and fix failures in `src/brush.js` or `tests/brush.test.js` without changing option-off behavior.

**Checkpoint**: The brush engine protects claimed precincts and preserves the existing behavior when the setting is off.

## Phase 4: User Story 2 - The Switch Is Clear, Stays Put, and Fits the Screen (Priority: P2)

**Goal**: Provide an accessible checkbox that only applies to adding and fits in the existing brush bar without moving other workbench controls.

**Independent Test**: Use `tests/ui.test.js` to toggle the checkbox by pointer and keyboard and confirm its checked/disabled state; use `tests/layout.test.js` to verify the bar and surrounding boxes at desktop and narrow viewport sizes.

### Tests for User Story 2

- [x] T009 [P] [US2] Add checkbox, label, pointer/keyboard, checked-state, unavailable-state, and Shift-effective-mode tests in `tests/ui.test.js`.
- [x] T010 [P] [US2] Add brush-bar containment, unchanged workbench-box, and no-horizontal-overflow assertions in `tests/layout.test.js` for the viewport sizes specified in `specs/013-brush-unclaimed-only/spec.md`.

### Implementation for User Story 2

- [x] T011 [P] [US2] Add a labeled, initially unchecked checkbox and its visually hidden Add-only note to the brush controls in `index.html`.
- [x] T012 [US2] In `src/ui/brush-panel.js`, wire the checkbox change event, render its checked and disabled state, and expose the Add-only hint with `title` and `aria-describedby` while disabled for erase mode.
- [x] T013 [US2] In `src/main.js`, connect the brush panel callback to `setBrushOptions` and pass `unclaimedOnly` to `brushPanel.render`.
- [x] T014 [US2] In `styles.css`, compact the one-screen brush controls, wrap the checkbox label, and show either the hint or stroke message in the shared notes cell while preserving free-flow wrapping at other breakpoints.
- [x] T015 [US2] Run `python3 scripts/test.py ui layout` and adjust `index.html`, `src/ui/brush-panel.js`, or `styles.css` until accessibility and layout assertions pass without relaxing test expectations.

**Checkpoint**: The checkbox is usable and the brush bar fits without displacing existing workbench content.

## Phase 5: User Story 3 - The Setting Is Remembered and Reported (Priority: P3)

**Goal**: Keep the choice for the current state, reset it for a new state or opened link, and report claimed precincts skipped after each stroke.

**Independent Test**: Verify retention across district and brush-control changes, reset on new/custom/linked states, and accurate all-claimed and mixed-stroke messages in `tests/ui.test.js` and `tests/brush.test.js`.

### Tests for User Story 3

- [x] T016 [P] [US3] Add setting retention, new-map/custom-state reset, opened-link, and in-progress-stroke tests in `tests/ui.test.js`.
- [x] T017 [P] [US3] Add all-claimed and mixed-reason stroke-summary tests in `tests/brush.test.js`; verify skipped counts remain separate and all category counts sum to covered precincts.

### Implementation for User Story 3

- [x] T018 [US3] Update all new-map, custom-state, and opened-link reset paths in `src/main.js` so `unclaimedOnly` resets to false while ordinary district and brush-control changes retain it.
- [x] T019 [US3] Update the stroke summary and brush-panel message handling in `src/brush.js` and `src/ui/brush-panel.js` so claimed skips are counted and the hint is hidden only while a stroke message is present.
- [x] T020 [US3] Run `python3 scripts/test.py brush ui layout` and fix retention, reset, summary, or hint/message regressions in `src/main.js`, `src/brush.js`, or `src/ui/brush-panel.js`.

**Checkpoint**: The setting persists for the active state, resets for new states, and explains skipped claimed precincts.

## Phase 6: Polish and Cross-Cutting Validation

**Purpose**: Keep related documentation aligned and verify the complete feature.

- [x] T021 [P] Add the feature 013 relationship notes to `specs/010-precinct-brush-tool/spec.md` and `specs/011-single-screen-editing/spec.md`.
- [x] T022 [P] Update measured brush-bar results in `specs/013-brush-unclaimed-only/research.md` and runnable validation outcomes in `specs/013-brush-unclaimed-only/quickstart.md`.
- [x] T023 Run `python3 scripts/test.py --jobs 2 --timeout 120` and record the complete passing result in `specs/013-brush-unclaimed-only/quickstart.md`.
- [x] T024 Complete the final markup, accessibility, console-error, responsive-layout, and option-off compatibility checks in `specs/013-brush-unclaimed-only/quickstart.md`.

## Dependencies and Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 must capture the original behavior before any brush-engine change.
- **Foundational (Phase 2)**: Depends on T001 and blocks all user-story work.
- **User Story 1 (Phase 3)**: Depends on Phase 2; provides the core brush guarantee.
- **User Story 2 (Phase 4)**: Depends on Phase 2 and uses the engine option from US1 for end-to-end interaction.
- **User Story 3 (Phase 5)**: Depends on US1 and US2, because it extends the setting's UI state and stroke feedback.
- **Polish (Phase 6)**: Depends on all user stories.

### User Story Dependencies

- **US1 (P1)**: Independent after the foundational option plumbing; this is the MVP.
- **US2 (P2)**: Follows US1 for a working end-to-end control; its markup, panel, and layout tests can be developed in parallel where they touch separate files.
- **US3 (P3)**: Follows US1 and US2; reset paths and stroke summaries build on the setting and control.

### Parallel Opportunities

- **US1**: T005 can run in parallel with unrelated setup work; T006 follows because both edit `tests/brush.test.js`.
- **US2**: T009 and T010 can proceed in parallel; T011 is separate from the panel implementation in T012. T012 and T013 coordinate through the panel contract, and T014 can be developed independently after markup is defined.
- **US3**: T016 and T017 can proceed in parallel because they edit separate test files; implementation and integration validation follow.
- **Polish**: T021 and T022 touch separate documentation files and can proceed in parallel.

## Parallel Execution Examples

### User Story 1

```text
T005: Add focused brush-engine behavior tests in tests/brush.test.js
T001: Capture pre-change behavior in tests/brush-baseline.js and specs/013-brush-unclaimed-only/research.md
```

### User Story 2

```text
T009: Add checkbox behavior tests in tests/ui.test.js
T010: Add viewport and layout tests in tests/layout.test.js
T011: Add checkbox markup in index.html
```

### User Story 3

```text
T016: Add retention and reset tests in tests/ui.test.js
T017: Add claimed-skip summary tests in tests/brush.test.js
```

## Implementation Strategy

1. Capture the existing full-suite and stroke-output baseline before changing engine behavior.
2. Complete the option plumbing, then implement and independently verify US1 as the MVP.
3. Add the accessible control and layout behavior in US2; run `python3 scripts/test.py ui layout`.
4. Add state lifetime and skip reporting in US3; run `python3 scripts/test.py brush ui layout`.
5. Update validation documentation and run `python3 scripts/test.py` before considering the feature complete.

**Format validation**: Every task uses an unchecked checkbox, sequential task ID, story label for user-story tasks, and an explicit repository file path.
