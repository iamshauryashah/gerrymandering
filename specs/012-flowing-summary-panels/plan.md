# Implementation Plan: Flowing Summary Panels

**Branch**: `012-flowing-summary-panels` | **Date**: 2026-10-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-flowing-summary-panels/spec.md`

## Summary

When the column beside the map has empty room under the Plan check, the Statewide Voters, District Control and Legend blocks move up into it, in that order, as many as fit completely. The ones that do not fit stay where they are today, below the map. The work is one small module plus CSS.

1. **Real layout decides.** A new `src/ui/summary-dock.js` tries to dock all three blocks into the column, measures whether the column overflows, and takes blocks back out from the last one until it does not. Because it uses the browser's own layout, no heights are estimated, and the answer is right for any font, zoom or content (research R1, R2).
2. **CSS names the situation, script reads it.** Each layout sets a `--dock` value (`column` for the one-screen workbench, `beside` for the two-column layout, `none` for phones). The script only reads it, so the breakpoints stay in one place (R3).
3. **Docking is a DOM move, not a copy.** The three existing sections are moved into the column after the message area and moved back, in order, before the help text. Each block exists once, keeps its listeners, and keeps its reading order (R4, R5).
4. **No leftover gaps.** The layout carries `data-docked="0".."3"`, and the grid areas below the map drop the rows of blocks that moved up (R6).
5. **Compact when docked.** In the column the blocks use tighter spacing so more of them fit; their content is unchanged (R7).
6. **Re-runs itself.** Resize observers and a mutation observer re-run the fit when the window, zoom, district count, plan text, build mode or block content changes, before the browser paints (R8).

Builds on [011](../011-single-screen-editing/plan.md).

## Technical Context

**Language/Version**: HTML5, CSS3 (grid, container queries, custom properties), JavaScript ES2022 modules

**Primary Dependencies**: None (browser `ResizeObserver` and `MutationObserver`)

**Storage**: None; no data or address changes

**Testing**: `python3 scripts/test.py` (parallel headless Chrome). New tests join the `layout` group; one pure unit test for the count search

**Target Platform**: Same as 011: workbench from 1280 × 720, two-column from 760 px, one column below

**Project Type**: Static single-page web application

**Performance Goals**:
- One fit pass is at most four forced layouts of a small column, under 5 ms
- No visible flicker: passes run in the observer callbacks, before paint
- No pixel of movement of the map, picker, detail, Plan check, message area or brush bar (spec SC-004)

**Constraints**:
- No build step, no dependencies
- A block is never clipped, squeezed or given an inner scroll bar (FR-002)
- Each block exists once in the page at all times (FR-004)
- Editing, brush, builder and every block's rendering code do not change

**Scale/Scope**: Three blocks, three layouts, five tested window sizes, three district counts, about six window sizes for the resize walk

## Constitution Check

**Result**: PASS. The constitution is an unfilled template, so the baseline gates of earlier features apply and are met: static site, no dependencies, keyboard and screen-reader order preserved, every requirement covered by a test in the parallel suite.

**Post-design re-check**: still PASS. One departure from 011's "no scripts measure the window" constraint is recorded in research R1: CSS alone cannot say "this block fits, put it here, else there", so a small script reads the layout. It changes no behavior of the editor.

## Project Structure

### Documentation (this feature)

```text
specs/012-flowing-summary-panels/
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
index.html                    # unchanged markup; the three sections stay where they are until the script moves them
styles.css                    # --dock per layout, data-docked grid areas, compact docked styles
src/ui/summary-dock.js        # NEW: chooseDockCount (pure), createSummaryDock (observers and moves)
src/main.js                   # create the dock after the first render, destroy it with the app
tests/layout.test.js          # fit, order, once-only, resize, build-mode, other-layout tests
tests/summary-dock.test.js    # NEW: pure chooseDockCount tests
tests/groups.json             # add the new test file to the layout group
specs/011-single-screen-editing/spec.md  # note: the three blocks may now sit in the column
```

**Structure Decision**: Keep the flat 011 markup and add behavior on top of it. One module owns the placement, nothing else learns about it.

## Complexity Tracking

| Departure | Why needed | Simpler alternative rejected because |
|---|---|---|
| A small measuring script | "Put it here only if it fits" cannot be written in CSS | Duplicated blocks hidden by CSS would break "exactly once" (FR-004); fixed height guesses would break on zoom, fonts and content |
