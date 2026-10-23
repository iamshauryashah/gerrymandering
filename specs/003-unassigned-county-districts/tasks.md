---

description: "Task list for Unassigned Counties and Blank Districts"
---

# Tasks: Unassigned Counties and Blank Districts

**Input**: Design documents from `/specs/003-unassigned-county-districts/`

**Prerequisites**: plan.md, spec.md, data-model.md, contracts/changes.md, quickstart.md

**Tests**: Included; the existing browser test page is updated.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational

- [X] T001 Stop generating district assignments in `generateState`; set every county's assignment to `null` in `src/state-generator.js`
- [X] T002 Support `null` assignments in `reassignCounty`, `summarizeDistricts`, and label-point placement in `src/districts.js`
- [X] T003 Add `getEditAction`, `applyCountyEdit`, and `countUnassigned` in `src/districts.js`

## Phase 2: User Story 1 - Start With a Blank District Map (P1) 🎯 MVP

- [X] T004 [P] [US1] Update `tests/state-generator.test.js` and `tests/districts.test.js` to expect all counties unassigned and all districts empty on load
- [X] T005 [US1] Render district borders only between different assigned districts and no badges for empty districts in `src/ui/map-view.js`
- [X] T006 [US1] Update the UI tests for a blank start (no badges, every district "Empty") in `tests/ui.test.js`

## Phase 3: User Story 2 - Add and Remove Counties While Editing (P2)

- [X] T007 [P] [US2] Add model tests for add, move, remove, and re-add in `tests/districts.test.js`
- [X] T008 [US2] Use `applyCountyEdit` for county clicks and keyboard activation in `src/main.js`
- [X] T009 [US2] Update the editing status text to "click counties to add or remove them" in `src/main.js`
- [X] T010 [US2] Add UI tests for click-to-remove, rapid toggles, and keyboard activation in `tests/ui.test.js`

## Phase 4: User Story 3 - Understand Unassigned Counties (P3)

- [X] T011 [P] [US3] Add the dotted unassigned overlay layer, `unassigned` class, and "No district" accessible names in `src/ui/map-view.js` and `styles.css`
- [X] T012 [P] [US3] Show a "No district" section for unassigned counties in `src/main.js` and allow sections without voter rows in `src/ui/tooltip.js`
- [X] T013 [US3] Add an "Unassigned counties" row to the control total in `src/ui/control-total.js`
- [X] T014 [US3] Add UI tests for the overlay, "No district" details, and the unassigned count in `tests/ui.test.js`

## Phase 5: Polish

- [X] T015 Update the page hint and notice text in `index.html`
- [X] T016 Run `tests/index.html` and the scenarios in [quickstart.md](./quickstart.md)

## Dependencies

- T001–T003 block all stories. US1 → US2 → US3 share `src/main.js` and `src/ui/map-view.js`, so run them in order.
- Implemented together with [004 tasks](../004-balanced-contiguous-districts/tasks.md).
