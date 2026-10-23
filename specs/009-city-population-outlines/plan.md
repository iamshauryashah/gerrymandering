# Implementation Plan: City Population, Growing States, Realistic Outlines, and Smaller Dense Counties

**Branch**: `009-city-population-outlines` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-city-population-outlines/spec.md`

## Summary

Four changes to the state generator and the builder, all sharing one pipeline:

1. **City population.** Each city carries a population (10,000–300,000 voters). The builder gets a "City population" slider for the selected city, a selection model (click selects, a button or Delete removes), and links that carry each size.
2. **Growing state.** A state's voters are an all-rural baseline plus each city's population. A city's voters are shared out over the counties around it, so adding, removing, or resizing a city changes the total by its population.
3. **Realistic outlines.** A new outline builder makes the border from straight surveyed sides meeting at corners, with one or two sides replaced by a natural meander (river, coast). It replaces the old radial-blob generator.
4. **Dense counties are smaller.** County size follows a density weight (cities by population, plus small background towns), and county voters are handed out by how small a county is, so density and size line up. Bigger cities get smaller counties around them.

Random states now use the same pipeline as custom ones: they pick two to four cities with random populations and feed them through the same build. That is what makes the new rules hold for every state (FR-023) without two code paths.

Builds on [008](../008-custom-state-builder/plan.md), [007](../007-state-voter-makeup/plan.md), and [005](../005-new-map-realistic-state/plan.md).

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript ES2022 modules

**Primary Dependencies**: None

**Storage**: The custom-state code in the page address only (`history.replaceState`); the code format moves to `v2`

**Testing**: Browser test page `tests/index.html`

**Target Platform**: Desktop and touch browsers, 320–1920 px wide

**Project Type**: Static single-page web application

**Performance Goals**:
- Outline generation under 20 ms
- City add, remove, or resize redraws within 1 s (layout phase averages under 100 ms)
- Population slider: the label follows at once; the map redraws within 1 s of the last movement
- Page load from a `?custom=` link under 2 s

**Constraints**:
- No build step
- The same seed, outline seed, or link always gives the same outline and counties
- Counties at least 160 px² and one piece; 90–120 counties; a balanced plan of connected districts possible
- The statewide split stays within 0.5 points of its slider whatever the cities' sizes
- Total voters = baseline + sum of city populations (FR-010), the baseline never depending on the cities

**Scale/Scope**:
- 0–12 cities of 10,000–300,000 voters
- Statewide totals up to about 4.3 million voters
- 100-seed statistical tests for outlines, county sizes, and totals

## Constitution Check

**Result**: PASS. The constitution (`.specify/memory/constitution.md`) is an unfilled template. The baseline gates from earlier features apply and are met:
- static site
- no dependencies
- keyboard and touch parity for every pointer action
- accessible controls
- tests on the browser test page

Re-checked after design: PASS.

## Project Structure

```text
specs/009-city-population-outlines/
├── plan.md
├── research.md
├── data-model.md
├── contracts/changes.md
├── quickstart.md
└── tasks.md            # created by /speckit-tasks
```

```text
src/outline.js              # NEW: surveyed-polygon outline builder, natural borders, validity checks (moved out of state-generator.js)
src/state-generator.js      # city weight field with towns, size-ranked county voters, baseline + city shares, random cities; re-exports outline helpers
src/custom-state.js         # city population (POP constants), validatePlan, setCityPopulation, v2 code (v1 still decodes), baseline stream
src/ui/builder-panel.js     # population slider, selected-city text and hint, Remove city button
src/ui/map-view.js          # selected-city ring, onCitySelect, Delete/Backspace on the map
src/main.js                 # selection, last-chosen population, debounced population redraw, remove selected
index.html                  # population slider and Remove city button in the builder
styles.css                  # selected ring, slider, button
tests/outline.test.js       # NEW: 100-outline realism measurements and determinism
tests/state-generator.test.js  # outline test replaced; thresholds for the density-size rules and totals
tests/custom-state.test.js  # populations, totals, sizes, v2/v1 codes; fingerprint test re-recorded
tests/ui.test.js            # selection replaces click-to-remove; slider, Remove, keyboard, links
tests/index.html            # load the new test file
```

**Structure Decision**: One new logic module (`outline.js`) because the outline code is about to be replaced wholesale and is large enough to deserve a file of its own. The county and voter changes stay in `state-generator.js`, where the pipeline already lives, so random and custom states keep sharing it.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|----------|------------|--------------------------------------|
| A polygon outline builder with natural-edge replacement and an independent validity pass | Straight borders meeting at corners cannot come from a radial function | Tweaking the radial outline cannot make corners and long straight sides |
| Voters handed out by county size, then city voters added by kernel share | Makes density and size line up (FR-020) while keeping the voter-skew machinery and exact city totals (FR-010) | Voting from a smooth density field gives too little skew and breaks the old spread checks |
| A dedicated baseline stream per outline seed | Keeps the total equal to baseline plus the cities, however the layout attempts fall | Drawing the baseline per attempt makes a city's effect on the total jump around |
| Random states built from random cities | One pipeline, so every state obeys the same size and total rules | A second code path would drift from the first |
| Debounced population redraw | A population change reshuffles the layout (about 100 ms), so dragging needs coalescing | Redrawing on every slider event makes dragging jerky |
| `v2` link format with `v1` still decoded | City populations must travel in the link, and old links get a defined outcome | Reusing `v1` would silently misread old links |
