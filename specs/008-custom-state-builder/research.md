# Research: Custom State Builder

## R1: Reuse the generator pipeline

- **Decision**: Split `tryGenerate` in `src/state-generator.js` into two functions that the random path calls back to back:
  1. **Layout phase**: outline → density field → county seeds → relaxation → clickable-size and connectivity checks → skewed voter totals → reference plan → density index and county type.
  2. **Voter phase**: lean per county → statewide offset → side A/B voters.

  Random states call both phases on the same random stream in the same order as today. The helpers the custom module needs (`placeSeeds`, `relaxSeeds`, `skewedVoterWeights`, `buildReferencePlan`, `solveStatewideOffset`, `generateOutline`, `classifyDensity` and the constants) are exported.
- **Rationale**: Every check that makes a random state valid (FR-012) then applies to a custom state with no second copy. A regression test fixes the fingerprint (names, voters, types) of several seeds before the refactor and requires it to stay equal after.
- **Alternatives**: Copy the pipeline into `custom-state.js`. Rejected: the two copies would drift. Add a `custom` option to `generateState` only. Rejected: it cannot separate the layout phase from the voter phase, which the sliders need.

## R2: Outline from a seed, independent of cities

- **Decision**: `outlineForSeed(outlineSeed)` calls the existing outline generator on `createRandom(outlineSeed + '|outline|' + k)` with `k = 0, 1, …, 9` and returns the first non-null outline (coverage ≤ 0.75 and a distinctive feature, as in 005).
- **Rationale**: The outline must not change when cities change or when a layout attempt is retried, or the visitor's city positions would no longer fit. "New outline" is just a new `outlineSeed`.
- **Alternatives**: Take the outline from the first successful attempt, as random states do. Rejected: it changes with every retry.

## R3: Cities, counts, and the density field

- **Decision**:
  - A city is an integer point `(x, y)` with `0 ≤ x ≤ 800`, `0 ≤ y ≤ 600`, inside the outline.
  - Cities are at least `MIN_CITY_DISTANCE = 90` px apart and there are at most `MAX_CITIES = 12`.
  - The density field is the random generator's formula with the visitor's cities: `weight = 1 + 8 × max over cities of exp(−d² / (2σ²))` with `σ = 55` and strength 1. With no cities the weight is 1 everywhere.
  - `countyCount = min(120, 90 + 3 × cities)`; `districtCount = round(countyCount / 8)`, which gives 11 to 15 districts.
- **Rationale**:
  - Spacing of about 1.6σ keeps the cities' circles of influence from merging into one blob and keeps small counties above the 160 px² minimum.
  - More cities means more counties, because cities need many small counties.
  - The district count stays within 8–20 and in a ratio the reference plan can balance.
- **Alternatives**: Draw the counts from a seed, as random states do. Rejected: adding a city would give no visible change in county count, and the spec says the counts follow the cities. Per-city strength and size: out of scope (spec assumption).
- **To tune during implementation** (as in 005): `σ`, `MIN_CITY_DISTANCE`, and the county formula, against 200 random plans of 0–12 cities. Target: at least 98% of plans build with no failure.

## R4: Layout attempts and failure

- **Decision**: Attempt `k` (0 to `CUSTOM_MAX_ATTEMPTS − 1`, with `CUSTOM_MAX_ATTEMPTS = 20`) runs the layout phase on `createRandom(outlineSeed + '|layout|' + k)` and returns the first that passes every check. If none passes, `buildCustomState` returns `{ ok: false, reason: 'layout' }`. The same attempt cap applies to the preview and to "Use this state", so what is previewed is what is used.
- **Rationale**: Deterministic (FR-011), bounded in time (20 attempts at about 100 ms is a 2 s worst case, and most plans pass on attempt 1–3), and failure is reported (FR-012, US3 scenario 6).
- **Failure message**: "These cities can't make a map that splits into fair districts. Try moving cities further apart or removing one."
- **Alternatives**: Random states use 40 attempts. Rejected for custom states: the worst case would be twice as long to wait after a click.

## R5: Voter phase and settings

- **Decision**:
  - Settings: `shareA` is an integer from 300 to 700 (permille of all voters; default 500). `cityLean` is an integer from −100 to 100 (default 50).
  - Per-county lean: `lean = (cityLean / 100) × amplitude × curve + regional + noise`.
    - `curve` is the 005 density S-curve.
    - `amplitude` is 0.26 where `curve > 0` and 0.17 where it is negative (the 005 amplitudes).
    - `regional` and `noise` are the 005 terms (±0.04 each).
  - The statewide offset comes from the existing bisection on target `shareA / 1000`, with per-county shares clamped to 0.08–0.92.
  - The regional angle and the per-county noise come from `createRandom(outlineSeed + '|voters')` drawn once per county in index order, so moving a slider never reshuffles the noise.
  - The voter phase passes only if `|actual share − target| ≤ 0.005` (SC-003).
- **Rationale**: A `cityLean` of +100 reproduces the 005 pattern (cities lean side A, countryside side B). Neutral removes the density gradient, leaving small random differences (FR-009). The bisection keeps the statewide split at the chosen value while the lean changes (US2 scenario 2).
- **Edge**: With no cities every county has about the same density, so the lean has no visible effect. The offset absorbs it, as the spec's edge case says.
- **Alternatives**: Separate controls for rural and city share. Rejected: three numbers that must sum to a target are harder to reason about than two independent controls.

## R6: Voter-only updates reuse the layout

- **Decision**: `applyVoterSettings(state, settings)` returns a new state with new county objects (new voters, same polygons, neighbors, areas, types) and the same `layoutKey`. `mapView.setState` treats a state with the same `layoutKey` as the same layout: it keeps the SVG paths and the app calls `render` to recolor.
- **Rationale**: A slider drag changes colors only. Re-creating the paths would reset hover and focus on every tick.
- **Alternatives**: Mutate the county objects in place. Rejected: hidden mutation breaks the rest of the app's assumption that a state is a value.

## R7: Address code

- **Decision**: `?custom=v1.<outlineSeed>.<shareA>.<cityLean>.<cities>` where:
  - `outlineSeed` matches `^[0-9a-z]{1,16}$` (what `createSeed()` returns);
  - `shareA` and `cityLean` are decimal integers (`cityLean` may start with `-`);
  - `cities` is `x_y` pairs joined by `-`, or `0` for none.

  Example: `?custom=v1.k3x9a.520.50.210_180-400_300`.

  `decodeCustomCode` returns a plan or `null` for any malformed or out-of-range value, including wrong version, bad seed, out-of-range settings, more than 12 cities, a city outside the outline, or two cities closer than 90 px. The page then shows "That custom map link isn't valid, so here is a new random map." and loads a random state. A valid `custom` wins over `seed` when both are present.
- **Rationale**: Short (about 100 characters at 12 cities), readable, versioned, and strictly validated, so a damaged link cannot break the page (FR-017).
- **Alternatives**: Base64 JSON. Rejected: longer, and harder to validate field by field. Storing in `localStorage`. Rejected: not shareable.

## R8: Builder mode in the map view

- **Decision**: `mapView.setMode('build' | 'view')` and `mapView.setCities(points)`.
  - Build mode adds a `cities` layer above the counties. Each city is a marker group (a visible dot and a larger invisible hit area) so touch targets reach about 24 px on screen.
  - A click or tap on the map converts the screen point to map coordinates with `getScreenCTM().inverse()`, rounds to integers, and calls `onBuildPoint(point)`. A click on a marker calls `onCityToggle(index)`.
  - County click handlers do nothing in build mode. Hover tooltips still work, so the visitor can see how dense a county is.
  - The svg is focusable in build mode and the counties are removed from the tab order. Arrow keys move a visible cursor by 10 px (40 px with Shift), clamped to the map. Enter adds a city at the cursor, or removes the city within 12 px of it. Escape leaves the cursor.
  - Placement rules (inside the outline, spacing, city limit) live in `custom-state.js` as `checkCityPlacement(plan, point)` and return `{ ok }` or `{ ok: false, reason: 'outside' | 'too-close' | 'limit' }`; the UI only shows the message.
- **Rationale**: One code path for pointer, touch, and keyboard. Rules are testable without the DOM.
- **Alternatives**: Make every county a placement target. Rejected: a city could not be put at an exact spot. A separate canvas overlay. Rejected: duplicates the SVG coordinate system and hover handling.

## R9: App flow

- **Decision**: `main.js` gets `app.mode` (`'view'` or `'build'`) and, while building, `app.draft = { plan, result, snapshot }` where `snapshot` is the previous `{ state, address }`. The matchup is not part of the snapshot: the toggle button owns it, so Cancel leaves whichever matchup is selected.
  1. **Enter** ("Build a state"): if any county is assigned, `confirm('Build a state? Your districts will be lost.')`; if declined, nothing changes. Otherwise create a plan with a new `outlineSeed` (the first of up to 8 fresh seeds whose empty plan builds), no cities, `shareA` 500, `cityLean` 50, and build it.
  2. **Edit**: a city change builds the layout again, then applies the voter settings. A slider change applies the voter settings only. Each change renders the map and the stat block.
  3. **Use this state**: allowed only when `result.ok`. Replaces `app.state` with the built state (all districts empty), sets the address to `?custom=…`, and returns to view mode.
  4. **Cancel**: restores `snapshot` (the same state object, so districts are unchanged) and its address. No confirmation, because nothing of the visitor's was changed.
  5. **Clear cities**: confirms if there are cities, then removes them and resets both settings.
  6. **New outline**: a new `outlineSeed` (the first of up to 8 fresh seeds whose plan, with the cities that fit it, builds); cities outside the new outline are removed and the message says how many.
- While building, the district list, plan status, and district-control block are hidden (`.is-building`); the legend, the matchup toggle, and the statewide stat block stay.
- **Rationale**: The existing confirm injection and `replaceState` pattern from 005 is reused; Cancel is free because the previous state is kept as a value.

## R10: Caption and sharing

- **Decision**: For a custom state the caption reads "A custom state · N counties · M districts · custom map link" and the link is `?custom=<code>`. `state.seed` holds the code and `state.custom` is `true`; random states are unchanged.
- **Rationale**: Reuses the caption slot, so a custom state can be copied from the page too.

## R11: Accessibility

- **Decision**:
  - The builder panel is a labeled `section`.
  - Each slider is an `input type="range"` with a `<label>`, an `<output>` showing the value in words ("Democrats 52.0%", "Cities lean Democratic +50"), and `aria-valuetext`.
  - The count "Cities: 3 of 12" and the message sit in a `role="status"` live region.
  - Cities are also listed as text ("City 1 at x 210, y 180") in a visually hidden list.
  - Color is never the only cue: markers are dots with an outline and the side names are written out.
- **Rationale**: Meets FR-019 without a new component library.

## R12: Dependency on 007

- **Decision**: Implement after 007. The builder calls the same function that renders the statewide stat block for every state, so there is no builder-specific stat code. If 007 is not yet built, the builder tasks still pass; the stat block assertions wait for 007.
- **Rationale**: One render path for all states (FR-010, FR-018).

## Final tuned values (T008, measured in the browser test page)

| Setting | Planned | Final | Why |
|---------|---------|-------|-----|
| `CITY_SIGMA` | 55 px | 55 px | Counties near cities were smaller than the state average in every one of 12 test plans |
| `MIN_CITY_DISTANCE` | 90 px | 90 px | Twelve cities fit, and 60 plans of exactly 12 cities all built |
| County count | `min(120, 90 + 3 × cities)` | unchanged | |
| District count | `round(counties / 8)` | unchanged | 11 to 15 districts; the reference plan balanced within 10% in every test plan |
| `CUSTOM_MAX_ATTEMPTS` | 20 | 20 | The most attempts any plan needed was 5 (average 1.3) |

Measured:
- 100 plans of 0–12 cities: 0 failed to build, average 64 ms, slowest 178 ms.
- 200 plans of 0–12 cities: 1 failed to build (99.5% succeeded, target 98%), average 96 ms, slowest 737 ms.
- 60 plans of exactly 12 cities: 0 failed, average 71 ms, slowest 215 ms.
- 150 outlines with no cities: 0 failed.
- A plan that fails all 20 attempts takes about 1 s before it reports failure.

Because the outline does not change between attempts, a rare outline can fail whatever the layout random stream does. The app therefore picks an outline seed that builds when it enters the builder or when the visitor asks for a new outline (R9), and shows the layout-failure message if a visitor's own city placement cannot be built.
