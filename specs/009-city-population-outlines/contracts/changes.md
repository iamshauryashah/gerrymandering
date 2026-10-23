# Contract Changes: Feature 009

## Outline Module (`src/outline.js`, new)

- `generateOutline(random)`: returns `{ outline, shapeFeatures }`. It never returns `null`: after 20 rejected candidates it returns a guaranteed stepped box with one river side.
  - `outline` is a polygon of `[x, y]` points inside the map with a 36 px margin.
  - `shapeFeatures` is `[template, ...naturalKinds]` with `template` one of `'stepped' | 'slanted' | 'wedge'` and each natural kind `'river' | 'coast'`.
- `outlineCoverage(outline)`: area divided by bounding-box area.
- `checkOutline(outline)`: `{ ok, problems }`, where `problems` lists any of `'crossing'`, `'fill'`, `'corners'`, `'straight-pair'`, `'natural'`, `'arm-width'`. It is the generator's own gate; tests measure outlines independently.
- Constants: `MAX_OUTLINE_COVERAGE` (0.80), `OUTLINE_TEMPLATES`, `NATURAL_KINDS`.
- `src/state-generator.js` re-exports `generateOutline`, `outlineCoverage`, and `MAX_OUTLINE_COVERAGE`. `SHAPE_FEATURES` is removed.

## State Generator (`src/state-generator.js`)

- Population constants, shared with the custom-state module: `POPULATION_RANGE`, `POPULATION_STEP`, `DEFAULT_POPULATION`, `BASELINE_RANGE`, `RANDOM_CITY_RANGE`.
- `createCityField(cities, towns)`: the weight function `w(p)` from the data model (cities by population, plus towns).
- `createTowns(random, outline)`: three to six background bumps for a state's weight field.
- `buildLayout(random, { outline, weightAt, cities, baseline, countyCount, districtCount })`:
  - runs 10 relaxation passes (weights raised to the power 2.5);
  - voters are baseline shares (ranked by `1 / area`) plus each city's kernel-weighted share;
  - the layout result also carries `cities` and `baseline`.
- `splitVoters`, `assembleCounties`, and `assembleState` keep their signatures; `assembleState` adds `cities` and `baseline` to the state.
- `generateState({ seed, countyCount, districtCount })`: unchanged signature. Random states draw two to four cities and the baseline from `seed|baseline`, then use the same build as a custom state. The same seed still gives the same state, but a different one than before this feature.

## Custom State Module (`src/custom-state.js`)

- A city is `{ x, y, pop }`. Plan and city rules are in the [data model](./../data-model.md).
- `POPULATION_RANGE`, `POPULATION_STEP`, `DEFAULT_POPULATION`: re-exported.
- `normalizePopulation(value)`: clamps to 10,000–300,000 and rounds to a multiple of 10,000.
- `addCity(plan, point, pop = DEFAULT_POPULATION)`, `removeCity(plan, index)`, `setCityPopulation(plan, index, pop)`: return a new plan. `toggleCityAt` is removed (click no longer toggles).
- `findCityAt(plan, point)`: unchanged (nearest city within 12 px, or -1).
- `validatePlan(plan)`: also reports `city-<i>-population` when a population is not a multiple of 10,000 from 10,000 to 300,000.
- `buildCustomState(plan)`:
  - the baseline comes from the stream `outlineSeed|baseline`;
  - city weights use each city's population;
  - `state.cities` is the plan's cities and `state.baseline` the baseline;
  - `state.layoutKey` includes every city's population.
- `applyVoterSettings(state, settings)`: unchanged.

### Address code

```text
?custom=v2.<outlineSeed>.<shareA>.<cityLean>.<cities>
```

| Part | Format |
|------|--------|
| `outlineSeed` | `[0-9a-z]{1,16}` |
| `shareA` | integer, 300–700 |
| `cityLean` | integer, −100 to 100 |
| `cities` | `x_y_p` triples joined by `-`, `p` an integer from 1 to 30 (units of 10,000); `0` for none |

Example: `?custom=v2.k3x9a.520.50.210_180_10-400_300_25`.

- `encodeCustomCode` always writes `v2`.
- `decodeCustomCode` reads `v2`, and also `v1` (cities `x_y`) giving every city 100,000 voters. Any damaged, out-of-range, or not-fitting code returns `null`.

## Map View (`src/ui/map-view.js`)

- `createMapView(svg, { …, onBuildPoint, onCitySelect(index), onCityDelete() })`. `onCityToggle` is replaced by `onCitySelect`.
- `mapView.setCities(points, selectedIndex = null)`:
  - each marker is `g.city-marker[data-city]`;
  - the selected marker also has the class `selected`, `data-selected="true"`, and a dashed ring `circle.city-ring` (larger than the dot), so selection is not color alone.
- A click or tap on a marker calls `onCitySelect(index)`.
- Delete and Backspace on the focused map call `onCityDelete()`; arrow keys and Enter work as in 008 (Enter calls `onBuildPoint`, and the app selects the city under the cursor or places one).

## Builder Panel (`src/ui/builder-panel.js`)

- `createBuilderPanel(root, { onShare, onLean, onPopulation(thousands), onPopulationCommit(thousands), onRemove, onUse, onCancel, onClear, onNewOutline })`.
- `panel.render({ plan, result, matchup, selected })` also:
  - sets `input[data-role="pop-slider"]` (min 10, max 300, step 10, in thousands) to the selected city's population and enables it;
  - with `selected === null` disables the slider and shows the hint in the output;
  - enables `button[data-role="build-remove"]` only with a selected city.
- Elements (inside `[data-role="builder"]`):
  - `label[for="pop-slider"]`: "City population"
  - `input[data-role="pop-slider"]` with `aria-valuetext` equal to the output text
  - `output[data-role="pop-output"]`: "City 2: 150,000 voters" or the hint
  - `button[data-role="build-remove"]`: "Remove city"
- The slider's `input` event calls `onPopulation` (label only); its `change` event calls `onPopulationCommit`.

## Page (`src/main.js`)

- The draft holds `selected` and `lastPopulation`. `app.builder` returns `{ plan, result, selected }`.
- `placeCity(point)`: a point on a city selects it (it no longer removes it); elsewhere it places a city at `lastPopulation` after the usual rules, and selects it.
- Added to the app object: `selectCity(index)`, `setCityPopulation(index, pop)`, `removeSelectedCity()`. `removeCity(index)` remains for tests and scripts.
- A population change redraws the map 120 ms after the last slider movement (`input`), or at once on `change`; `setCityPopulation` is immediate and also sets `lastPopulation`.
- `New outline` and `Clear cities` clear the selection. Removing a city above the selected one keeps the same city selected.

## Messages

| Situation | Text |
|-----------|------|
| No city selected (hint) | "Place or select a city to set its population." |
| City selected (slider text) | "City 2: 150,000 voters" |
| City selected (announced) | "City 2 selected. 150,000 voters." |
| Population changed | "City 2 set to 150,000 voters." |
| City removed | "City 2 removed. 2 of 12 cities." |
| Invalid address | "That custom map link isn't valid, so here is a new random map." |

The 008 messages for placement rules, build failures, New outline, and Clear cities are unchanged.

## Superseded Tests

- 005's outline test with panhandle, river, coast, and notch kinds → `tests/outline.test.js`.
- 008's "random states from existing seeds are unchanged" fingerprints → re-recorded after this feature.
- 008's click-to-remove tests → select, Remove city, and Delete tests.

## New Tests

- `tests/outline.test.js`: for 100 seeds, independent measurements of straight pairs, natural stretches, fill, corners, simplicity, arm width, variety, determinism.
- `tests/state-generator.test.js` and `tests/custom-state.test.js`:
  - density-size rank correlation and decile ratio over 100 random and 100 custom states, including no cities;
  - urban, suburban, and rural average sizes;
  - counties near bigger cities are smaller;
  - totals equal the baseline plus city populations; adding, resizing, and removing change the total by the population;
  - the statewide split holds at any city size;
  - v2 round-trip and v1 decoding.
- `tests/ui.test.js`: selection by click, tap, and Enter; slider; Remove button and Delete; hint when nothing is selected; the draft's last population; links carrying populations.
