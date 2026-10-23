# Implementation Plan: Precinct Building Blocks and Brush Selection Tool

**Branch**: `010-precinct-brush-tool` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-precinct-brush-tool/spec.md`

## Summary

Two changes that build on each other:

1. **Precincts replace counties.** The generator makes 500–800 small precincts instead of 90–120 counties, for random and custom states alike. Voter totals, density types, the density-to-size rule, the reference plan, the size gate and the shared-link format keep working; only the unit gets smaller and many more of them are drawn. Everything named "county" is renamed "precinct", in the interface text and in the code (`state.counties` → `state.precincts`, `data-county-id` → `data-precinct-id`, and so on), so the product and the source agree. The work this needs inside the generator is performance and tuning: a nearest-seed lookup for the grid sampler, a finer layout grid, a one-pass piece check, and re-tuned gates (research R1–R4).
2. **Brush tool.** While a district is selected, a brush button, an add/erase choice and a size slider appear. A circle follows the pointer; a click, tap or drag applies every precinct whose center is inside it. The logic is a pure module (`src/brush.js`) that evaluates a stroke against the current plan, using the same contiguity and adjacency rules as single clicks, skipping what would break a rule and reporting counts. A drag is a sequence of capsules (segments between pointer samples), so fast drags cannot skip precincts, and the summary is computed by comparing the plan before and after the stroke.

Builds on [009](../009-city-population-outlines/plan.md), [008](../008-custom-state-builder/plan.md), [004](../004-balanced-contiguous-districts/plan.md), [003](../003-unassigned-county-districts/plan.md) and [002](../002-congressional-district-editor/plan.md).

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript ES2022 modules

**Primary Dependencies**: None

**Storage**: None new. The custom-state code in the page address keeps the `v2` format (cities and sizes only); district plans are still not saved

**Testing**: Browser test page `tests/index.html` (driven by Playwright in this environment); no Node is installed, so logic is tested in the page

**Target Platform**: Desktop and touch browsers, 320–1920 px wide

**Project Type**: Static single-page web application

**Performance Goals**:
- A new random state appears in under 2 s (SC-010); a custom build after a city change stays under 1.5 s
- A brush step (the pointer moved, new plan drawn) costs under 50 ms at 800 precincts, so a drag never freezes; the plan, list, totals and status are redrawn within 250 ms of release (SC-005, SC-006)
- Hover and focus details appear with no visible delay

**Constraints**:
- No build step; the same seed or link always gives the same precincts
- 500–800 precincts, each in one piece, drawn without overlap, and a balanced plan of connected districts is possible
- Stroke results are deterministic and never leave a district in two pieces
- No user-visible or in-code mention of "county" (checked by a grep gate)

**Scale/Scope**:
- Up to 800 precincts, 8–20 districts, up to 12 cities, up to about 4.3 million voters
- 100-seed statistical tests for generation (as in 009), plus brush property tests over random strokes

## Constitution Check

**Result**: PASS. The constitution (`.specify/memory/constitution.md`) is an unfilled template, so the baseline gates from earlier features apply and are met:
- static site, no dependencies
- keyboard and touch parity for every pointer action (the brush has Enter, tap and drag paths; precincts get arrow-key navigation)
- accessible controls with labels, live status text and visible focus
- every requirement covered by tests on the browser test page

**Post-design re-check**: still PASS. The only departures are called out in research (a roving tab stop for precincts instead of 800 tab stops, a capped name list in district details) and neither adds a dependency or a new project.

## Project Structure

### Documentation (this feature)

```text
specs/010-precinct-brush-tool/
├── plan.md              # This file
├── research.md          # Decisions R1–R12 with measurements and rationale
├── data-model.md        # Precinct, brush state, stroke and summary shapes
├── quickstart.md        # How to run and check the feature
├── contracts/
│   └── changes.md       # Public function, DOM and event contract changes
├── checklists/
│   └── requirements.md
└── tasks.md             # Created by /speckit-tasks
```

### Source Code (repository root)

```text
index.html                    # Brush panel markup, precinct wording in help text
styles.css                    # Brush panel, brush circle, focus ring for precincts, no-scroll while painting
src/
├── geometry.js               # Nearest-seed lookup for sampleGrid and voronoiCells; one-pass piece count
├── state-generator.js        # PRECINCT_RANGE, finer layout grid, re-tuned gates, precinct names, assemblePrecincts
├── custom-state.js           # precinctCountFor / districtCountFor, renamed fields
├── districts.js              # Renamed API (reassignPrecinct, applyPrecinctEdit, ...); batch reassignPrecincts
├── brush.js                  # NEW: pure stroke logic (coverage, add/erase passes, summary)
├── formatters.js             # Precinct wording; capped name list in district details
├── main.js                   # Brush state, stroke handling, messages, Escape order, wording
└── ui/
    ├── brush-panel.js        # NEW: toggle, add/erase, size slider, status text
    ├── map-view.js           # Renamed layers/attributes; brush circle; stroke pointer events; roving tab stop
    └── district-list.js, plan-status.js, control-total.js, tooltip.js, state-totals.js, legend.js   # wording only

tests/
├── brush.test.js             # NEW: coverage, rules, determinism, summary arithmetic, property tests
├── state-generator.test.js   # Precinct count, names, sizes, speed; 100-seed checks re-tuned
├── custom-state.test.js      # Renamed; fingerprints re-recorded
├── districts.test.js         # Renamed API
├── ui.test.js                # Renamed selectors; brush panel, circle, drag, keyboard, touch
├── size-helpers.js           # Renamed
└── index.html                # Loads brush.test.js
```

**Structure Decision**: Keep the single static project and the existing module split. The stroke rules live in one new pure module so they can be tested without the DOM, and the brush panel is its own small UI module in the style of `builder-panel.js`. The rename is done file by file with a final grep gate, rather than keeping `county` names inside the code.

## Design Notes

- **Phases**: (1) rename and generator changes, so a precinct state exists and all earlier behaviors pass; (2) brush logic and panel with the circle, click and drag; (3) rule feedback, keyboard, touch and polish. Phase 1 alone is User Story 1 and is shippable.
- **Where the risk is**: generation at 650 units is about 20 times the work per layout, and a quick probe on the current code showed every layout rejected at 650 units (area and piece checks) and about 2 s per layout with a 2 px grid. Research R1–R4 hold the measured fixes; the tasks put them first, behind a measurable gate (100 random seeds and 100 custom plans all build, under the time limit).
- **Stroke model**: pointer samples become segments; each segment is a capsule; the whole drag is one stroke whose summary compares the plan at press and at release. Details in research R6–R8.
- **No new link version**: the `v2` code already holds all the input; the layout it produces simply changes, as it did in 009 (spec FR-011).

## Complexity Tracking

No constitution violations. Two choices add size and are explained in research: the full rename (R10) and the separate layout grid (R2).
