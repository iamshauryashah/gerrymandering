# Implementation Plan: Statewide Voter Makeup Stat Block

**Branch**: `007-state-voter-makeup` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-state-voter-makeup/spec.md`

## Summary

A read-only stat block in the map's side panel shows the whole state's voters: the total, each side's voters and percentage, a proportional bar in the sides' colors, and the statewide leader and margin.

The block is computed from every county's voters, so it never depends on districts. It is redrawn when a map loads (a new map or seed) and when the matchup changes. District edits do not redraw it.

The two side percentages are rounded to one decimal so that they add up to exactly 100.0%. The leader and margin text reuses the wording of the county and district details.

This block is also what feature [008](../008-custom-state-builder/plan.md) shows while a visitor builds a state, so it is rendered by one function that takes any state.

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript ES2022 modules

**Primary Dependencies**: None

**Storage**: N/A

**Testing**: Browser test page `tests/index.html`

**Target Platform**: Desktop and touch browsers, 320–1920 px wide

**Project Type**: Static single-page web application

**Performance Goals**: Redraw within 1 s of a new map or matchup change; the actual cost is under 1 ms for 120 counties

**Constraints**:
- No new voter data: every figure is a sum over existing county fields
- Percentages shown add up to exactly 100.0%
- Fits the 260 px side column and 320 px screens with no horizontal scrolling
- Figures and leader are text, not only color

**Scale/Scope**: One block; up to 120 counties

## Constitution Check

**Result**: PASS. The constitution (`.specify/memory/constitution.md`) is an unfilled template. The baseline gates from earlier features apply and are met:
- static site
- no dependencies
- accessible output
- tests on the browser test page

Re-checked after design: PASS.

## Project Structure

```text
specs/007-state-voter-makeup/
├── plan.md
├── research.md
├── data-model.md
├── contracts/changes.md
├── quickstart.md
└── tasks.md            # created by /speckit-tasks
```

```text
index.html                # section.state-totals in .map-side, above the district-control block
styles.css                # .state-totals card, bar, side rows
src/formatters.js         # getStatewideResult(counties), formatStatewideMakeup(counties, matchup)
src/ui/state-totals.js    # NEW: renderStateTotals(container, state, matchup)
src/main.js               # renderStateTotalsView(), called from renderAll()
tests/matchups.test.js    # formatter unit tests (this file already covers the formatters)
tests/ui.test.js          # block content, matchup change, edits leave it unchanged, new map, layout
```

**Structure Decision**: One new UI module that mirrors `control-total.js` and `plan-status.js`. The figures come from two small functions in `formatters.js`, next to the existing result and detail formatters, so the wording and rounding rules live in one place.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|----------|------------|--------------------------------------|
| Remainder rounding for the second side's percentage | FR-004 needs the shown percentages to add up to exactly 100.0% | Rounding each side separately can show 99.9% or 100.1% |
