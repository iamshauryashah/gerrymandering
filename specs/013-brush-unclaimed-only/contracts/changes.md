# Contract: UI and Code Changes

No external interface. The contract is the brush engine's options, the brush panel, and the page markup.

## `src/brush.js`

```js
startStroke(state, { district, mode = 'add', radius = BRUSH_SIZE.default, unclaimedOnly = false })
// returns { district, mode, radius, unclaimedOnly: Boolean(unclaimedOnly) && mode === 'add', before, covered, reasons }

strokeAt(state, { district, mode, radius, unclaimedOnly }, point)   // passes the option through
```

- `applySegment`, add branch: for each covered precinct `id` (after the "already in the selected district" check), `if (stroke.unclaimedOnly && (working[id] ?? null) !== null) { stroke.reasons.set(id, 'claimed'); continue; }`, before the adjacency and split checks.
- `reasonText('claimed')` returns `already in another district`.
- With `unclaimedOnly` false or missing, every function behaves as it does today.
- `finishStroke` and the message builder are unchanged; `claimed` is counted in `reasons` like the others.

## `src/ui/brush-panel.js`

```js
createBrushPanel(root, { onToggle, onMode, onSize, onUnclaimedOnly })
panel.render({ available, on, mode, size, unclaimedOnly })
```

- Reads `[data-role="brush-unclaimed"]` (a checkbox); its `change` calls `onUnclaimedOnly(checked)`.
- `render` sets `checked`, and `disabled` when `!available` or `mode === 'erase'`; while disabled for erase it sets a `title` ("Applies when adding") and `aria-describedby` pointing at a visually hidden note (`data-role="brush-unclaimed-note"`, "Applies to Add only"), and removes both otherwise.
- The hint text while the brush is on is "Click or drag on the map. Hold Shift to swap Add and Erase."; the other two hint texts are unchanged.
- The notes cell shows the stroke message when there is one, otherwise the hint: `say(text)` and `render` keep `hint.hidden` equal to "the message is not empty"; the hint's `textContent` is always set.

## `src/main.js`

- `app.brush = { on, size, mode, unclaimedOnly: false }` at start and wherever it is reset for a new state, link or custom state.
- `setBrushOptions({ size, mode, unclaimedOnly })`: a boolean `unclaimedOnly` is stored as given; anything else is ignored.
- `startRun` passes `unclaimedOnly: app.brush.unclaimedOnly` to `startStroke`.
- `window.gerryApp.setBrush({ unclaimedOnly })` and the `brush` getter report the field.
- `renderBrush` passes `unclaimedOnly` to the panel.

## `index.html`

In the brush section, between the mode fieldset and the size field:

```html
<label class="brush-unclaimed"><input type="checkbox" data-role="brush-unclaimed" disabled> Only unclaimed precincts</label>
<span class="visually-hidden" id="brush-unclaimed-note" data-role="brush-unclaimed-note">Applies to Add only</span>
```

No other markup, id or role changes.

## `styles.css`

- Compact the brush bar in the one-screen layout (research R5): controls' padding, gaps, 96 px slider, two-line checkbox label, notes cell with the hint or the message clamped to two lines.
- The other layouts keep their free-flowing wrap.
- `.brush-unclaimed:has(input:disabled)` is dimmed like the other disabled brush controls.

## Tests (contract of behavior)

- `tests/brush.test.js`: with the option on: a claimed precinct under the brush never changes; unclaimed connected ones are added; claimed-only coverage changes nothing and reports `claimed`; an unclaimed precinct reachable only through a claimed one is skipped as `not-adjacent`; an empty district starts at the nearest unclaimed covered precinct; erase ignores the option; a stroke is repeatable; 100 seeded random strokes (R8) keep every pre-existing assignment and every district contiguous; with the option off or missing the 100 strokes equal the captured snapshot of today's results; message text for the all-claimed and mixed cases.
- `tests/ui.test.js`: the checkbox exists with its label, is unchecked by default, is disabled with no district selected and in erase mode, is toggled by click and by Space, reports state to the accessibility tree (checked or not); the state survives selecting another district, brush off and on, size, mode and matchup changes; it resets on a new map, a custom state and an opened link; a drag with the setting on leaves another district's precincts untouched through the app; single clicks with the brush off are unchanged; the message and hint share the notes cell.
- `tests/layout.test.js`: at the five laptop and desktop sizes with 20 districts and the brush on, after a stroke message is shown, every element of the brush bar (controls and notes) is fully inside the bar and the window, the bar is no taller than 52 px row, and the boxes of the map frame, picker, detail, Plan check and message area equal their boxes with the checkbox forced hidden; no sideways scrolling at 320 to 1920 px.
