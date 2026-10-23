# Contract: UI and Code Changes

This feature has no external interface. The contract is the page structure and the small module that places the blocks.

## Page structure

- `index.html` markup is unchanged. The three sections (`state-totals`, `control-total`, `legend`) start as direct children of `[data-role="layout"]`, just before the help text (`.hint`).
- The layout element gains `data-docked="0".."3"`, set by the script.
- Docked, the three sections are the last children of `[data-role="panels"]` (after `.message-slot`), in the order `state-totals`, `control-total`, `legend`.
- No `id`, `data-role` or `aria-*` attribute of any block changes. One class is added to a docked block: `is-docked`.

## `src/ui/summary-dock.js` (new)

```js
// Largest count in 0..total for which fits(count) is true, trying total first, then fewer. 0 when none fits.
export function chooseDockCount(total, fits);

// Creates the placement controller.
// options: { layout, column, map, brush, blocks, hint, app }
//   layout  the [data-role="layout"] element (reads --dock, writes data-docked)
//   column  the [data-role="panels"] element
//   map     the .map-cell element, brush the [data-role="brush-tool"] element (for the `beside` test)
//   blocks  the three sections, in order
//   hint    the element the undocked blocks are inserted before
//   app     the main.app element (build mode is its `is-building` class)
// returns { update(): number, destroy(): void, get docked(): number }
export function createSummaryDock(options);
```

Behavior:
- `update()` runs one pass and returns `docked`. It returns 0 (and places every block below) when `--dock` is `none`, when the app is in build mode, or when the column has no box.
- A pass: place all `total` blocks in the column; for `count` from `total` down to 0 check the fit for the first `count` blocks in the column; place the rest below; set `data-docked`; toggle `is-docked` on the docked blocks.
- A pass is idempotent: running it again with nothing changed leaves the DOM and the result as they were.
- Observers (research R8) call `update()`. `destroy()` disconnects them and puts the blocks back below.
- A pass that is already running ignores re-entrant calls.

## `src/main.js`

- After the first render, `createSummaryDock({ ... })` is created once and kept on the app object (for tests and for teardown). `app.destroy()` calls `dock.destroy()`.
- The test hook `window.gerryApp` exposes `dock` (read-only) so tests can read `dock.docked`.
- No render function changes.

## `styles.css`

- `--dock: none` on `.layout`; `--dock: beside` in the two-column rule; `--dock: column` in the workbench rule; `--dock: none` while building a state.
- In the two-column and workbench layouts the template areas below the map follow `data-docked` (research R6).
- `.panels > .is-docked` blocks: `flex: none`, compact padding, compact rows (research R7). Their colors, borders and content are the same.
- No rule in the one-column layout changes.

## Tests (contract of behavior)

- `tests/summary-dock.test.js`: `chooseDockCount` with a fake predicate: all fit, none fit, only the first fits, a predicate that is not monotonic (the largest passing count wins), `total` of 0.
- `tests/layout.test.js` additions (each at the five laptop sizes with 8, 14 and 20 districts unless noted):
  - exactly the blocks that fit are docked: with one more block the column would overflow, and with the current count it does not;
  - every block exists once and in the order totals, control, legend, whichever place it is in;
  - the map, picker, detail, Plan check, message area and brush bar have the same boxes as with nothing docked;
  - no docked block is clipped or overlaps, no inner scroll bar appears, the column does not scroll;
  - resize walk: shrink and grow through six sizes, `docked` matches the fit each time, an edit made before a resize still stands;
  - district count change (new map with another count): `docked` is re-computed;
  - other layouts: 1000 × 800 (`beside`), 768 × 1024, 390 × 800 (`none`, `docked` is 0), no sideways scrolling;
  - build mode: `docked` is 0 and the builder shows as before;
  - the page's scroll distance at 1920 × 1080 is smaller than with nothing docked by at least the docked blocks' height.
