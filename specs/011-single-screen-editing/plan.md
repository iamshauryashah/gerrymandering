# Implementation Plan: Single-Screen District Editing

**Branch**: `011-single-screen-editing` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-single-screen-editing/spec.md`

## Summary

On a desktop or laptop window (at least 1280 × 720) the whole editing loop fits on one screen: the map takes the largest share, a right-hand column holds a compact district picker, a new selected-district detail and the plan status, and a one-line brush bar sits under the map. Everything else (state totals, control totals, legend, help text, notice) moves below that screen. The work is mostly layout, with one new small UI module.

1. **Flat page, three layouts.** The page's sections become direct children of one layout element, and three named-area grids arrange them: a single-screen "workbench" (at least 1240 px of page width and 720 px of height, not while building a state), a two-column layout for mid-size or short windows, and a single column for phones. The same markup serves all three, so nothing is duplicated or moved by script (research R1, R2).
2. **Map first.** In the workbench the map fills the cell left over after the top bar and brush bar, scaled to fit with its shape kept. It is 47% of a 1280 × 720 window and larger on bigger screens; every other part gives way before it does (R3).
3. **Compact picker.** The district list becomes a grid of small tiles (number, color, leader, status word with a symbol, and the amount over or under), so 20 districts take about 290 px of height instead of a page-long list (R4).
4. **District detail (new).** `src/ui/district-detail.js` shows the selected district's voters, allowed range, distance from it, status, precinct count, leader and margin, and whether it is connected. With no district selected it says what to do (R5).
5. **No movement.** Message areas get reserved space, the "Editing District N" line moves into the detail, programmatic focus no longer scrolls, and the page never scrolls during editing (R6, R8).

Builds on [010](../010-precinct-brush-tool/plan.md), [009](../009-city-population-outlines/plan.md), [004](../004-balanced-contiguous-districts/plan.md) and [002](../002-congressional-district-editor/plan.md).

## Technical Context

**Language/Version**: HTML5, CSS3 (grid, container queries, `dvh` units), JavaScript ES2022 modules

**Primary Dependencies**: None

**Storage**: None; no data or address changes

**Testing**: `python3 scripts/test.py` (parallel headless Chrome). Layout is measured in same-origin iframes of exact sizes in a new `layout` test group; existing UI tests are updated where sections moved

**Target Platform**: Desktop and laptop windows from 1280 × 720 up to 2560 × 1440 (the single-screen workbench); tablets and phones from 320 px up (stacked, scrolling allowed)

**Project Type**: Static single-page web application

**Performance Goals**:
- No extra work per edit beyond redrawing the detail (under 5 ms); the 0.25 s update limit of earlier features still holds
- No layout shift: zero pixels of movement of the map and panels in the edit walkthrough

**Constraints**:
- No build step; no dependencies
- Every existing control and piece of information stays (spec FR-015, FR-021)
- Behavior of the brush, editing rules, builder, matchup and links does not change
- Window height and width are the only inputs: no scripts measure the window

**Scale/Scope**:
- 8 to 20 districts in the picker
- Five tested window sizes, three district counts, plus 320 to 2560 px widths for horizontal overflow

## Constitution Check

**Result**: PASS. The constitution (`.specify/memory/constitution.md`) is an unfilled template, so the baseline gates from earlier features apply and are met:
- static site, no dependencies
- keyboard and touch parity, with focus order picker → brush → map → rest (FR-020)
- accessible names, status in words and symbols, live regions kept
- every requirement covered by tests in the parallel suite

**Post-design re-check**: still PASS. One departure is recorded in research (the "Editing District N" line moves into the detail area, keeping its role and wording), and none adds a dependency.

## Project Structure

### Documentation (this feature)

```text
specs/011-single-screen-editing/
├── plan.md              # This file
├── research.md          # Decisions R1–R13 with the space budget and measurements
├── data-model.md        # The district detail view model, the layouts and their areas
├── quickstart.md        # How to check the feature by hand and by command
├── contracts/
│   └── changes.md       # Markup, CSS layout, module and test-hook changes
├── checklists/
│   └── requirements.md
└── tasks.md             # Created by /speckit-tasks
```

### Source Code (repository root)

```text
index.html                    # Flat layout element with named children; district detail, message slot, brush bar; secondary sections last
styles.css                    # Three layouts (workbench, two-column, single column); tiles; compact panels; no-shift rules
src/
├── matchups.js               # shortName for each side (tile text)
├── main.js                   # Render the detail with the other district views; editing status goes into the detail
└── ui/
    ├── district-list.js      # Tile content (number, leader, status symbol and word, offset); same events and ids
    ├── district-detail.js    # NEW: renders the selected district's detail or the "pick a district" prompt
    ├── plan-status.js        # Compact two-column rows (same content)
    ├── brush-panel.js        # Same module; markup becomes a one-row bar with a fixed-height message cell
    └── map-view.js           # Programmatic focus uses preventScroll

tests/
├── layout.test.js            # NEW: iframe layout checks at five sizes and three district counts, walkthrough, overflow
├── ui.test.js                # Updated: tests that read old positions or the old list rows
├── groups.json               # New "layout" group
└── fixtures.js               # (unchanged) reused for seeds with 8, 14 and 20 districts
```

**Structure Decision**: Keep the single static project and the module split. The layout lives in CSS with named grid areas over one flat piece of markup; the only new code is the detail module and the layout test file.

## Design Notes

- **Phases**: (1) markup and layout: the three grids with the existing panels moved but unchanged inside, so the workbench exists and the old tests still describe the same content; (2) the compact picker and the district detail; (3) no-shift and focus details, the layout tests, and polish. Phase 1 alone already removes most scrolling.
- **Where the risk is**: fitting 20 districts, the detail and the plan status into a 636 px column at 1280 × 720. The space budget in research R4 totals 624 px, so there is almost no spare room; the layout test at 1280 × 720 with 20 districts is the gate, with tile padding, a two-line tile and finally the column scrolling inside itself (so the page still never scrolls) as the fallbacks.
- **Build mode**: stays in the two-column or single-column layout (scrolling allowed), exactly as today (spec assumption).
- **No new rules or data**: balance numbers, statuses and messages come from the existing district, balance and plan-status code.

## Complexity Tracking

No constitution violations. One choice adds size and is explained in research: the flat markup with named grid areas (R2) is a larger rewrite of `index.html` and `styles.css` than adding a media query, but it avoids duplicated markup and script that moves elements.
