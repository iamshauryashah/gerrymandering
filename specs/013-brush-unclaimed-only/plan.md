# Implementation Plan: Brush Only Takes Unclaimed Precincts

**Branch**: `013-brush-unclaimed-only` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-brush-unclaimed-only/spec.md`

## Summary

The brush gets one more setting, "Only unclaimed precincts" (off by default). When it is on and the brush is adding, the brush skips every precinct that already belongs to a district, so finished districts are never nibbled. The work is a small rule in the brush engine, one more setting in the brush state and panel, and a compact brush bar that still fits its one row.

1. **A rule, not a new algorithm.** `startStroke` records `unclaimedOnly` (true only for an add stroke); in `applySegment`'s add pass, a precinct that belongs to another district is skipped with a new reason, `claimed`, before any adjacency or split check. Everything else (connection rule, empty-district start, repeat passes, determinism) is unchanged (research R1, R2).
2. **One more brush setting.** `app.brush` gains `unclaimedOnly`, kept and reset exactly like `size` and `mode`, exposed through `setBrush` and the `brush` getter for tests (R3).
3. **A checkbox, not a custom switch.** A native checkbox labelled "Only unclaimed precincts" in the brush bar: keyboard, touch and screen-reader behavior come for free, and the checked mark shows the state without color (R4).
4. **Same layout, compact bar.** The brush bar is already overfull at 1280 × 720 (research R5 records a defect found while planning). The plan makes the bar's controls compact and lets the hint and the stroke message share one cell, so everything, including the new checkbox, fits inside the 52 px row and nothing else moves (R5, R6).
5. **A clear message.** The skip reason reads "already in another district", counted with the other skip reasons by the existing summary (R7).

Builds on [010](../010-precinct-brush-tool/plan.md) and [011](../011-single-screen-editing/plan.md).

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript ES2022 modules

**Primary Dependencies**: None

**Storage**: None; the setting is session-only like brush size and mode and is not in shared links

**Testing**: `python3 scripts/test.py brush layout ui` (parallel headless Chrome); brush engine tests in `tests/brush.test.js`, panel and state tests in `tests/ui.test.js`, bar-fit tests in `tests/layout.test.js`

**Target Platform**: Same as 010 and 011: laptop and desktop one-screen layout from 1280 × 720, tablets and phones from 320 px

**Project Type**: Static single-page web application

**Performance Goals**: No change: a stroke segment still applies within the 0.25 s limit; the new check is one lookup per covered precinct

**Constraints**:
- No build step, no dependencies
- Setting off means identical behavior to today, bit for bit (spec FR-004, SC-002)
- The map, picker, detail, Plan check and brush bar keep their boxes (spec FR-011, SC-005)
- No district may ever end up in two pieces (with the setting on nothing is removed from any district)

**Scale/Scope**: One engine rule, one setting, one control, one reason string, one CSS pass over the brush bar

## Constitution Check

**Pre-research result**: PASS.

- **I. Fictional Data and Clear Provenance**: PASS. The feature changes brush behavior only; it introduces no real-world data.
- **II. Trustworthy Data and Model Invariants**: PASS. Claimed precincts remain assigned, and seeded tests cover determinism, connectivity, and unchanged behavior when the setting is off.
- **III. Accessible, Responsive Interaction**: PASS. The labeled native checkbox supports keyboard use and exposes its state; layout tests cover the one-screen and narrow-screen constraints.
- **IV. Simple Static-First Architecture**: PASS. The feature uses existing static browser code and adds no service, persistence, or dependency.
- **V. Specification and Test Discipline**: PASS. Requirements, acceptance scenarios, and regression tests cover the new behavior and existing brush guarantees.

**Post-design re-check**: PASS. The model, control, and layout design remain within all five principles; no exceptions or complexity justifications are required.

## Project Structure

### Documentation (this feature)

```text
specs/013-brush-unclaimed-only/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── changes.md
├── checklists/requirements.md
└── tasks.md   (created by /speckit-tasks)
```

### Source Code (repository root)

```text
src/brush.js            # startStroke(unclaimedOnly), applySegment add rule, 'claimed' reason text
src/ui/brush-panel.js   # checkbox wiring, render(unclaimedOnly), hint and message share one cell
src/main.js             # app.brush.unclaimedOnly, setBrushOptions, startRun, reset on new state, setBrush/brush hook
index.html              # the checkbox in the brush section
styles.css              # compact brush bar, checkbox, shared notes cell
tests/brush.test.js     # engine tests
tests/ui.test.js        # panel and state tests
tests/layout.test.js    # bar-fit tests
```

**Structure Decision**: Put the rule where the other add rules live (`src/brush.js`), keep the setting with the other brush settings, and reuse the existing stroke summary and message path.

## Complexity Tracking

No constitution violations to justify.
