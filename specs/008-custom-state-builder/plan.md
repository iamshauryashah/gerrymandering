# Implementation Plan: Custom State Builder

**Branch**: `008-custom-state-builder` | **Date**: 2026-10-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-custom-state-builder/spec.md`

## Summary

A "Build a state" mode lets a visitor click to place cities inside a generated outline and set two voter controls: the statewide split and the city lean. The visitor then starts drawing districts on that state.

The state generator is reused, not copied, so a custom state obeys the same validity rules as a random one:
- **Layout phase** (outline, cities, counties, voter totals, reference plan). Cities replace the random density field. It runs when the outline or the cities change.
- **Voter phase** (each county's side A/B split). It depends only on the two voter controls and runs in a few ms, so the sliders feel live.

A custom state is rebuilt from a short code in the page address (`?custom=…`): the outline seed, the two settings, and the city positions.

Builds on [005](../005-new-map-realistic-state/plan.md) (generator, New map) and [007](../007-state-voter-makeup/spec.md) (statewide stat block, shown in the builder through the same render call).

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript ES2022 modules

**Primary Dependencies**: None

**Storage**: The custom-state code in the page address only (`history.replaceState`)

**Testing**: Browser test page `tests/index.html`

**Target Platform**: Desktop and touch browsers, 320–1920 px wide

**Project Type**: Static single-page web application

**Performance Goals**:
- City click to redrawn map under 1 s; the layout phase averages under 100 ms
- Slider drag to recolored map under 1 s; the voter phase takes a few ms
- Page load from a `?custom=` address under 2 s

**Constraints**:
- No build step
- The same code always gives the same state
- A state offered for use has connected counties of at least 160 px² and a reference plan within the 10% rule
- Random states generated from existing seeds MUST NOT change

**Scale/Scope**:
- 0–12 cities
- 90–120 counties
- Statewide split 30%–70%
- City lean −100 to +100

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
specs/008-custom-state-builder/
├── plan.md
├── research.md
├── data-model.md
├── contracts/changes.md
├── quickstart.md
└── tasks.md            # created by /speckit-tasks
```

```text
index.html                  # "Build a state" button beside "New map"; builder panel markup in the side panel
styles.css                  # builder panel, city markers, keyboard cursor, .is-building hides the district sections
src/state-generator.js      # export the layout helpers; split tryGenerate into layout and voter phases (random output unchanged)
src/custom-state.js         # NEW: plan limits, validation, encode/decode, outline from seed, buildCustomState, applyVoterSettings
src/ui/builder-panel.js     # NEW: counts, the two sliders, buttons, message and live region
src/ui/map-view.js          # build mode: city layer, click-to-point, keyboard cursor; reuse the layout when only voters change
src/main.js                 # view/build mode, draft plan, enter/cancel/use, address handling, caption for custom states
tests/custom-state.test.js  # NEW: determinism, validity over many plans, settings, encode/decode, random-state regression
tests/ui.test.js            # builder flow, keyboard, limits, cancel, use, address restore
tests/index.html            # load the new test file
```

**Structure Decision**: One new logic module (`custom-state.js`) and one new UI module (`builder-panel.js`). The generator keeps its single pipeline; the random path calls the same two phases in the same order, so existing seeds give identical maps.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|----------|------------|--------------------------------------|
| Layout phase and voter phase split inside the generator | Sliders must update in a few ms, and a custom state must pass the same checks as a random one | Re-running the whole generator per slider tick costs up to seconds. Copying the pipeline into a new module lets the two drift apart. |
| `layoutKey` on a state | Lets the map reuse its county shapes when only voters change | Rebuilding about 120 paths per tick resets hover and focus |
| Own random streams per concern (outline, layout attempt, voters) | Moving a slider must not reshuffle counties; adding a city must not change the outline | One shared stream makes every change reshuffle everything |
| Compact `?custom=` code | A custom state must be shareable (FR-017) | A seed alone cannot carry city positions |
| Keyboard placement cursor | Pointer-only placement would exclude keyboard users (FR-007) | Tabbing through 120 counties cannot target an arbitrary point |
