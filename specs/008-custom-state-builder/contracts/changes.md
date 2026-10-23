# Contract Changes: Feature 008

## Custom State Module (`src/custom-state.js`)

- `MAX_CITIES`, `MIN_CITY_DISTANCE`, `SHARE_RANGE`, `LEAN_RANGE`: constants (see the [data model](./../data-model.md)).
- `createPlan({ outlineSeed })`: a plan with no cities, `shareA` 500, and `cityLean` 50.
- `outlineForSeed(outlineSeed)`: the outline polygon for that seed.
- `checkCityPlacement(plan, point)`: `{ ok: true }` or `{ ok: false, reason: 'limit' | 'outside' | 'too-close' }`.
- `addCity(plan, point)`, `removeCity(plan, index)`, `toggleCityAt(plan, point)`: return a new plan. `toggleCityAt` removes the city within 12 px of the point, or else adds one. `findCityAt(plan, point)` returns the index of the nearest city within 12 px, or -1; the app uses it so that a click, tap, or Enter on a city removes it, and anywhere else tries to add one after `checkCityPlacement`.
- `withSettings(plan, { shareA, cityLean })`: a new plan with clamped integer settings.
- `buildCustomState(plan)`: `{ ok: true, state }` or `{ ok: false, reason: 'layout' | 'plan' }`. Pure and deterministic.
- `applyVoterSettings(state, { shareA, cityLean })`: a new state with new voters and the same `layoutKey`, polygons, neighbors, and reference plan.
- `encodeCustomCode(plan)` and `decodeCustomCode(text)`: round-trip a plan through the address code. `decodeCustomCode` returns a plan or `null`.
- `getCustomCodeFromUrl(search)`: the `custom` value from a query string, or `null`.

### Address code

```text
?custom=v1.<outlineSeed>.<shareA>.<cityLean>.<cities>
```

| Part | Format |
|------|--------|
| `outlineSeed` | `[0-9a-z]{1,16}` |
| `shareA` | integer, 300–700 |
| `cityLean` | integer, −100 to 100 |
| `cities` | `x_y` pairs joined by `-`, or `0` for none |

Example: `?custom=v1.k3x9a.520.50.210_180-400_300`.

## State Generator (`src/state-generator.js`)

- The layout and voter phases of `tryGenerate` are separate functions. Random states call them in the same order, with the same random stream, as before.
- Exported for the custom module: `generateOutline`, `placeSeeds`, `relaxSeeds`, `skewedVoterWeights`, `buildReferencePlan`, `solveStatewideOffset`, `classifyDensity`, and the constants they use.
- `generateState({ seed })` output for existing seeds is unchanged (regression test).

## Map View (`src/ui/map-view.js`)

- `createMapView(svg, { …, onBuildPoint(point), onCityToggle(index) })`.
- `mapView.setMode('build' | 'view')`: in build mode:
  - county clicks do nothing;
  - counties are removed from the tab order;
  - the svg is focusable with the label "City placement map. Arrow keys move the cursor, Enter adds or removes a city.";
  - `g[data-role="cities"]` is shown with one `g.city-marker[data-city="i"]` per city.
- `mapView.setCities(points)`: redraws the markers.
- `mapView.setState(state)`: a state whose `layoutKey` equals the current one keeps its county paths; `render()` then recolors.
- Keyboard cursor `g[data-role="build-cursor"]` (it carries `data-cursor="x,y"`): arrows move 10 px, Shift + arrows 40 px, clamped to 0–800 and 0–600; Enter (or Space) calls `onBuildPoint(cursor)`, and the app decides between removing a city within 12 px and adding one; the cursor starts at the center of the map. A click on a city marker calls `onCityToggle(i)`.

## Builder Panel (`src/ui/builder-panel.js`)

- `createBuilderPanel(root, { onShare(permille), onLean(value), onUse(), onCancel(), onClear(), onNewOutline() })`.
- `panel.render({ plan, result, matchup })` updates the city count, the two sliders and their text, the Use button, and the failure message.
- `panel.say(text)` writes to the live region and the visible message area.
- Elements (all inside `[data-role="builder"]`):
  - `[data-role="city-count"]`: "Cities: 3 of 12"
  - `input[data-role="share-slider"]`: min 30, max 70, step 0.5, label "<side A name> share of all voters"
  - `input[data-role="lean-slider"]`: min −100, max 100, step 10, label "City lean"
  - `button[data-role="build-use"]`, `[data-role="build-cancel"]`, `[data-role="build-clear"]`, `[data-role="build-outline"]`
  - `[data-role="build-message"]` with `role="status"` and `aria-live="polite"`

## Page (`index.html`, `src/main.js`)

- `button[data-role="build-state"]` labeled "Build a state" next to "New map".
- `root.classList.is-building` hides `.districts`, `[data-role="plan-status"]`, and `[data-role="control-total"]`; the legend, the matchup toggle, and the statewide stat block stay visible.
- `createApp(root, { seed, custom, confirm, buildState, makeOutlineSeed })`: `custom` is an address code that wins over `seed` when it decodes and builds; `buildState` (default `buildCustomState`) and `makeOutlineSeed` (default `createSeed`) can be replaced so tests can force a failed build or choose outlines.
- `createApp` returns, in addition: `mode`, `startBuilder()`, `builder` (`{ plan, result }` while building, otherwise `null`), `placeCity(point)`, `removeCity(index)`, `setBuilderSettings({ shareA, cityLean })`, `useBuiltState()`, `cancelBuilder()`, `clearCities()`, `newOutline()`.
- Address handling:
  - on load, a valid `?custom=` builds and uses that state; an invalid one shows the message and loads a random state;
  - after "Use this state" the address becomes `?custom=<code>`; after "New map" it becomes `?seed=<seed>`.
- Caption for a custom state: "A custom state · N counties · M districts · " plus a link `?custom=<code>` with the text "custom map link".

## Messages

| Situation | Text |
|-----------|------|
| Click outside the outline | "Cities must be inside the state." |
| Too close to another city | "Cities must be at least 90 pixels apart." |
| Limit reached | "You can place up to 12 cities." |
| Layout failed | "These cities can't make a map that splits into fair districts. Try moving cities further apart or removing one." |
| New outline removed cities | "New outline. N cit(y/ies) outside it were removed." |
| Invalid address | "That custom map link isn't valid, so here is a new random map." |
| Enter builder with districts | confirm: "Build a state? Your districts will be lost." |
| Clear with cities | confirm: "Clear all cities and reset the voter settings?" |

## Tests

- `tests/custom-state.test.js` (new): determinism, validity checks over 100 plans of 0–12 cities, city counts and small counties near cities, statewide split within 0.005 at 30, 50 and 70, lean effect (positive lean makes the city-county share higher than the rural share, neutral makes the gap small), voter-only updates keep the layout, placement rules, address encode/decode and rejection of bad codes, and a fingerprint regression for several random seeds.
- `tests/ui.test.js`: build flow by click and by keyboard, messages for invalid placement, sliders update colors and the stat block, matchup switch keeps numbers, Use leaves districts empty and editing works, Cancel restores the previous state and districts, confirmations, address restore, invalid address fallback, 320 px layout without overflow.
