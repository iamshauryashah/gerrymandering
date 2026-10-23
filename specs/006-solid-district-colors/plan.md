# Implementation Plan: Solid District Colors With Hover Reveal

**Branch**: `006-solid-district-colors` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-solid-district-colors/spec.md`

## Summary

Each county in a district is painted with its district's result color, and the seam lines between counties inside the district are hidden. The map therefore shows one solid area per district. Counties not in any district keep their own colors.

Hovering or focusing a county in a district, or hovering or focusing that district's row in the list, temporarily "reveals" the district: its counties return to their own colors and outlines until the pointer or focus leaves.

On touch screens, tapping a county while not editing keeps the district revealed until the next tap somewhere else.

Repainting runs after every change, so district colors stay current while editing.

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript ES2022 modules

**Primary Dependencies**: None

**Storage**: N/A

**Testing**: Browser test page `tests/index.html`

**Target Platform**: Desktop and touch browsers, 320–1920 px wide

**Project Type**: Static single-page web application

**Performance Goals**:
- Reveal and unreveal within 0.2 s
- Repaint after an edit within 1 s; the actual cost is a few ms

**Constraints**:
- District color equals the badge and swatch color (same function)
- No flicker when moving between counties of the same district

**Scale/Scope**: Up to 120 counties and 20 districts

## Constitution Check

**Result**: PASS. The constitution is an unfilled template. Baseline gates met:
- static site
- no dependencies
- keyboard and focus parity
- tests

Re-checked after design: PASS.

## Project Structure

```text
specs/006-solid-district-colors/
├── plan.md
├── research.md
├── data-model.md
├── contracts/changes.md
└── quickstart.md
```

```text
src/ui/map-view.js       # paintCounties(), revealed-district state, pointer/focus/touch handling, setRevealed()
src/ui/district-list.js  # row hover/focus callbacks (onDistrictEnter/onDistrictLeave)
src/ui/legend.js         # note text about solid districts and hover reveal
src/main.js              # wire list reveal to the map; clear reveal on load and edit-mode changes
styles.css               # .county[data-revealed] outline emphasis
tests/ui.test.js         # replace the 002 "never recolor" test; add reveal tests
```

**Structure Decision**: All changes are in the existing UI modules. The model is unchanged.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|----------|------------|--------------------------------------|
| Reveal state with a related-target check | Prevents flicker inside a district | Plain enter/leave per county flashes between counties |
| Sticky reveal on touch | Touch has no hover (FR-007c) | Hover-only reveal is unreachable on phones |
