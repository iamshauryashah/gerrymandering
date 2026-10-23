# Implementation Plan: Unassigned Counties and Blank Districts

**Branch**: `003-unassigned-county-districts` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-unassigned-county-districts/spec.md`

## Summary

Change the existing static app so generated states start with no county-to-district assignments. District assignment becomes optional (`null` means no district). While a district is selected, clicking a county toggles it: unassigned counties are added, counties in other districts are moved, and counties already in the selected district are removed. Unassigned counties get a dotted overlay on the map, say "No district" in their details, and are counted in the control total.

This feature is implemented together with [004-balanced-contiguous-districts](../004-balanced-contiguous-districts/plan.md), which adds contiguity and balance rules on top of the same edit flow.

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript ES2022 modules (unchanged)

**Primary Dependencies**: None

**Storage**: N/A; in-memory only

**Testing**: Existing browser test page at `tests/index.html`

**Target Platform**: Current desktop and mobile browsers, 320–1920 px wide

**Project Type**: Static single-page web application

**Performance Goals**: Each add, move, or removal updates all views within 1 second

**Constraints**: No build step; served by `python3 -m http.server`

**Scale/Scope**: Same generated state; 8–20 initially empty districts

## Constitution Check

**Result**: PASS. [constitution.md](../../.specify/memory/constitution.md) is still an unfilled template, so no project gates apply. Baseline gates from 002 (automated tests, accessibility, no persistence) are kept.

## Project Structure

### Documentation (this feature)

```text
specs/003-unassigned-county-districts/
├── plan.md
├── data-model.md
├── contracts/changes.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
index.html                 # hint text update
styles.css                 # unassigned overlay style
src/state-generator.js     # stop generating assignments
src/districts.js           # nullable assignments, toggle edit, unassigned count
src/formatters.js          # "No district" details
src/main.js                # toggle edit flow, status text
src/ui/map-view.js         # unassigned overlay, labels
src/ui/control-total.js    # unassigned county row
tests/*.test.js            # updated expectations
```

**Structure Decision**: Modify the existing modules; no new files are needed for this feature.

## Complexity Tracking

None.
