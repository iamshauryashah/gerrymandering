# Implementation Plan: Dense County Map With Contiguous, Balanced Districts

**Branch**: `004-balanced-contiguous-districts` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-balanced-contiguous-districts/spec.md`

## Summary

Builds on [003](../003-unassigned-county-districts/plan.md). The generator produces 90–120 counties with a density field centered on 2–4 cities: counties are smaller near cities (density-weighted relaxation) and denser in voters. Each county gets a type (urban, suburban, rural) from its relative density, and its Democratic share rises with density, so urban counties vote Democratic and rural counties vote Republican. A hidden reference plan proves that every generated state can be split into contiguous districts within 10,000 voters of each other. Edits that would break contiguity are blocked with a message; a balance check and plan status are shown beside the map.

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript ES2022 modules

**Primary Dependencies**: None

**Storage**: N/A

**Testing**: Browser test page `tests/index.html`

**Target Platform**: Current desktop and mobile browsers, 320–1920 px wide

**Project Type**: Static single-page web application

**Performance Goals**: Load within 2 seconds; each edit, including contiguity checks, within 1 second

**Constraints**: No build step; every county remains clickable and keyboard-focusable however small

**Scale/Scope**: 90–120 counties, 8–20 districts, 10,000-voter balance limit

## Constitution Check

**Result**: PASS. The constitution is an unfilled template; baseline gates from 002 apply.

## Project Structure

```text
specs/004-balanced-contiguous-districts/
├── plan.md
├── research.md
├── data-model.md
├── contracts/changes.md
├── quickstart.md
└── tasks.md
```

```text
index.html                 # plan-status and edit-message regions
styles.css                 # plan status, balance labels, blocked message
src/state-generator.js     # 90–120 counties, density field, voter model, reference plan
src/districts.js           # contiguity checks, blocked edits, balance check, plan status
src/formatters.js          # county type and density in details
src/main.js                # blocked-edit messages, plan-status rendering
src/ui/district-list.js    # per-district balance label
src/ui/plan-status.js      # new: balance check and plan status panel
src/ui/tooltip.js          # extra detail rows
tests/*.test.js            # updated and new tests
```

**Structure Decision**: One new UI module (`plan-status.js`); everything else extends existing modules.

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|----------|------------|--------------------------------------|
| Hidden reference plan with per-district voter rescaling | Guarantees FR-006 (a valid plan always exists) | Random voters alone often make the 10,000-voter limit impossible to meet |
