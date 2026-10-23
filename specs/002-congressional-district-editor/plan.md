# Implementation Plan: Congressional District Editor

**Branch**: `002-congressional-district-editor` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-congressional-district-editor/spec.md`

## Summary

Add congressional districts to the fictional state map from `001-gerrymandering-map-explorer`. Each new state is divided into 8–20 numbered districts. Counties are always colored by their own generated voter makeup; district number badges and list swatches are colored by combined district votes. All voter choices are known exact counts. Districts are listed below the map with details on hover/focus, editable by selecting a district's pen icon and clicking counties, and summarized in a control total beside the map.

Because the 001 map is not implemented yet, this plan includes its required foundation: a seeded state/county generator, county rendering, matchup toggle, legend, and county tooltip. The site will be a dependency-free static web page using SVG for the map and an in-memory state model that recalculates district results after each county reassignment.

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript ES2022 modules

**Primary Dependencies**: None; browser-native SVG, DOM, and ES modules

**Storage**: N/A; all state is in memory and is discarded on reload

**Testing**: Browser-run unit/integration test page using native ES modules; manual validation through [quickstart.md](./quickstart.md)

**Target Platform**: Current versions of Chrome, Edge, Firefox, and Safari on desktop and mobile; screen widths 320–1920 px

**Project Type**: Static single-page web application

**Performance Goals**: Initial render within 3 seconds; tooltip display within 0.5 seconds; county reassignment and matchup updates within 1 second

**Constraints**: No build step, network service, user account, persistence, or real election/geographic data; keyboard-accessible controls; works when served by Python's built-in static server

**Scale/Scope**: One generated state per page load with 20–60 counties and 8–20 districts; map coordinate space is 800 × 600 px at full size, scaled proportionally on smaller screens; every county's visible area must exceed 400 px² in that full-size space

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Pre-research result**: PASS. [constitution.md](../../.specify/memory/constitution.md) contains only unfilled template placeholders, so no project-specific gates are ratified.

Baseline quality gates applied for this plan:

- Keep the solution simple and dependency-free unless a requirement cannot be met otherwise.
- Keep generation and district calculations independently testable from rendering.
- Make reproducible generation available for testing.
- Meet the spec's accessibility, performance, and fictional-data requirements.

**Post-design result**: PASS. The design uses one static app, no third-party dependencies, deterministic seeded generation, separated model/rendering modules, and documented keyboard behavior.

## Project Structure

### Documentation (this feature)

```text
specs/002-congressional-district-editor/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── model-api.md
│   └── ui-contract.md
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
index.html
styles.css
src/
├── main.js
├── random.js
├── geometry.js
├── state-generator.js
├── districts.js
├── matchups.js
├── formatters.js
└── ui/
    ├── map-view.js
    ├── district-list.js
    ├── control-total.js
    ├── matchup-toggle.js
    ├── legend.js
    └── tooltip.js

tests/
├── index.html
├── test-runner.js
├── state-generator.test.js
├── districts.test.js
├── matchups.test.js
└── ui.test.js
```

**Structure Decision**: Use a single static web app at the repository root. Pure model modules in `src/` contain generation, adjacency, district assignment, and voter aggregation. UI modules in `src/ui/` render and wire interactions. Browser-run tests in `tests/` import the same modules directly.

## Complexity Tracking

No constitution violations or justified complexity exceptions.
