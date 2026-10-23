---

description: "Task list for Dense County Map With Contiguous, Balanced Districts"
---

# Tasks: Dense County Map With Contiguous, Balanced Districts

**Input**: Design documents from `/specs/004-balanced-contiguous-districts/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/changes.md, quickstart.md; [003 tasks](../003-unassigned-county-districts/tasks.md) complete or done alongside

**Tests**: Included; the browser test page is updated.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Foundational

- [X] T001 Change `COUNTY_RANGE` to 90–120, remove the 400 px² minimum (keep a small clickability floor), and pad county IDs to 3 digits in `src/state-generator.js`
- [X] T002 Add `isContiguous` and contiguity reasons to `getEditAction`/`applyCountyEdit` in `src/districts.js`
- [X] T003 Add `getBalance` and `getPlanStatus` in `src/districts.js`

## Phase 2: User Story 1 - Explore a Map With Many Small Counties (P1) 🎯 MVP

- [X] T004 [US1] Add city centers, the density weight field, weighted seed placement, and weighted relaxation in `src/state-generator.js`
- [X] T005 [US1] Replace the voter model with density-based voters, county `type`, `density`, and the urban/rural lean in `src/state-generator.js`
- [X] T006 [US1] Build the hidden reference plan, rescale voters per district, and reject attempts outside 0.75–1.33 in `src/state-generator.js`
- [X] T007 [P] [US1] Show county type and density rows in details in `src/formatters.js` and `src/ui/tooltip.js`
- [X] T008 [P] [US1] Add generator tests: 90–120 counties, the urban/rural ≥ 80% rule across seeds, a valid reference plan for 100 seeds, and unique names, in `tests/state-generator.test.js`

## Phase 3: User Story 2 - Draw Only Contiguous Districts (P2)

- [X] T009 [P] [US2] Add model tests for not-adjacent, split-source, split-selected, first county anywhere, and emptying a district in `tests/districts.test.js`
- [X] T010 [US2] Add the `edit-message` region in `index.html` and show or clear blocked-edit messages in `src/main.js`
- [X] T011 [US2] Add UI tests for blocked clicks and message clearing in `tests/ui.test.js`

## Phase 4: User Story 3 - Check Population Balance (P3)

- [X] T012 [P] [US3] Create `src/ui/plan-status.js` rendering the balance check and plan status into `data-role="plan-status"`
- [X] T013 [US3] Add the `.district-balance` label per row in `src/ui/district-list.js`
- [X] T014 [US3] Wire plan status into `src/main.js` and add styles in `styles.css`
- [X] T015 [US3] Add model tests for balance and plan status, including applying the reference plan, in `tests/districts.test.js`, and UI tests in `tests/ui.test.js`

## Phase 5: Polish

- [X] T016 Check performance (load under 2 s, edits under 1 s) and the 320 px and 1920 px layouts with many small counties
- [X] T017 Update the hint and notice text in `index.html` and run [quickstart.md](./quickstart.md)

## Dependencies

- Requires 003 T001–T003. T001–T003 block all stories. T004 → T005 → T006 run in order in one file.
