# Implementation Plan: New Map Button, Close Elections With Realistic Voter Patterns, 10% Balance, and Irregular State Shapes

**Branch**: `005-new-map-realistic-state` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-new-map-realistic-state/spec.md`

## Summary

Builds on [004](../004-balanced-contiguous-districts/plan.md). Four changes:

1. **New map button** next to the matchup toggle. It asks for confirmation when any county is in a district, generates a new seed, and updates the address with `history.replaceState`.
2. **Voter model**:
   - County voter totals follow a capped, skewed (lognormal) distribution assigned by county density rank, so a few urban counties hold many voters, as in real elections.
   - Party lean rises with relative density.
   - A statewide offset is solved by bisection so each map lands at 48.5–51.5% for each side, with a random winner.
3. **Balance rule**: the 10,000-voter limit becomes a 10% ratio (largest ≤ 1.10 × smallest).
4. **Outline**: generated as a star-shaped radial function combining a lumpy base, polar "straight borders", and at least one distinctive feature (panhandle, river border, rugged coast, or notch). The outline is retried until it covers ≤ 75% of its bounding box.

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript ES2022 modules

**Primary Dependencies**: None

**Storage**: Seed in the page address only

**Testing**: Browser test page `tests/index.html`

**Target Platform**: Current desktop and mobile browsers, 320–1920 px wide

**Project Type**: Static single-page web application

**Performance Goals**:
- Load and "New map" within 2 s
- Generation averages under 100 ms
- Edits within 1 s

**Constraints**:
- No build step
- Every county ≥ 160 px² and a single piece
- The same seed always gives the same state

**Scale/Scope**:
- 90–120 counties and 8–20 districts
- Statewide 48–52%
- 10% balance ratio

## Constitution Check

**Result**: PASS. The constitution (`.specify/memory/constitution.md`) is an unfilled template. The baseline gates from earlier features apply and are met:
- static site
- no dependencies
- accessible controls
- tests on the browser test page

Re-checked after design: PASS.

## Project Structure

```text
specs/005-new-map-realistic-state/
├── plan.md
├── research.md
├── data-model.md
├── contracts/changes.md
├── quickstart.md
└── tasks.md            # created by /speckit-tasks
```

```text
index.html                 # New map button in the toolbar; hint text for the 10% rule
styles.css                 # toolbar layout for two buttons
src/state-generator.js     # radial outline with features, skewed voter totals, statewide offset, BALANCE_RATIO
src/districts.js           # getBalance uses the ratio; percent difference
src/ui/plan-status.js      # shows the % difference and the 10% limit
src/ui/district-list.js    # balance label window from the ratio
src/main.js                # New map action, confirmation, address update
tests/state-generator.test.js  # outline, voter-distribution, and statewide tests over 100 seeds
tests/districts.test.js        # 10% rule
tests/ui.test.js               # New map button, plan-check text
```

**Structure Decision**: No new modules. The outline and voter-model helpers stay inside `state-generator.js`.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|----------|------------|--------------------------------------|
| Rank-based voter totals with an iterative cap | Meets FR-006 and FR-007 at once | Physics-only density tuning cannot guarantee both skew and the per-county cap |
| Bisection on a statewide offset | Guarantees 48–52 (FR-012) | Fixed lean formulas give results that drift with the map |
| Radial outline with polar features | Irregular shapes that are always one piece without holes | Polygon union and difference needs a geometry library |
