# Quickstart: Feature 008

> **Superseded by [009](../009-city-population-outlines/quickstart.md)** where they differ: a click on a city selects it instead of removing it (use **Remove city**, Delete, or Backspace), random states are no longer unchanged from before the split, and `?custom=` links are `v2` (`v1` still opens).

Run these after 007 is built, because the builder shows the statewide stat block.

## Prerequisites

- A static server at the repository root, for example `python3 -m http.server 8000`.
- A browser with the cache disabled.

## Automated

1. Before changing the generator, record the fingerprint of the random-state regression seeds (names, voters, county types) in `tests/custom-state.test.js`.
2. Open `http://localhost:8000/tests/`. Expect the title `PASS: N passed, 0 failed`, including the new custom-state tests and every earlier test.

## Manual

1. Open `http://localhost:8000/?seed=demo-1` and note the state.
2. Click **Build a state**. The district list is hidden, the builder panel appears, and the map shows an empty outline of even-sized counties. Cities: 0 of 12. The statewide stat block shows the split.
3. **Place cities** (US1):
   - Click three spots well inside the outline. Three markers appear and the counties near them get smaller.
   - Click a marker. That city disappears.
   - Click outside the outline and click right next to a city. Each shows its message and adds nothing.
   - Place cities until 12 are placed, then click again. The limit message shows.
4. **Keyboard** (US1): Tab to the map, move the cursor with the arrow keys (hold Shift for large steps), press Enter to add a city, press Enter on a city to remove it.
5. **Voter makeup** (US2):
   - Drag the statewide split to 40%. County colors shift and the stat block shows about 40%.
   - Drag city lean to +100, then −100. City counties and the countryside change places in color, and the statewide split stays about 40%.
   - Switch the matchup. Names and colors change; the numbers do not.
6. **Use it** (US3): Click **Use this state**. The builder closes, all districts are empty, and the address is `?custom=…`. Edit a district and check the balance rule and plan status.
7. **Cancel**: Draw districts on a random map, click **Build a state**, accept the confirmation, then click **Cancel**. The earlier map returns with its districts.
8. **Share** (US4): Copy the `?custom=` address into a new tab. The same cities, counties, and statewide numbers appear.
9. **Clear and New outline**: Use **Clear cities** (confirm) and **New outline** (cities outside the new outline are removed, with a count).
10. **Bad address**: Open `?custom=v1.x.999.0.0`. A friendly message shows and a random map loads.
11. **Small screens**: At 320 px wide there is no horizontal scrolling and cities can be placed by tapping.

## Expected outcomes

| Check | Expect |
|-------|--------|
| Same plan, rebuilt | Identical counties and voters |
| 30%, 50%, 70% split | Statewide stat block within 0.5 points |
| City click to redraw | Under 1 s |
| Slider drag | Colors follow immediately; hover and focus are not reset |
| Random seeds from before | Unchanged maps |

See the [data model](./data-model.md) for limits and the [contract](./contracts/changes.md) for element names and messages.

## Results

- Full browser suite: **90 passed, 0 failed**, up from a baseline of 58 (after 007). It passed on five consecutive runs, and the builder tests use a different random outline each run. One early flaky test (a click 89 px from a city could round to exactly 90 px) was fixed by testing at 85 px.
- Random states are unchanged: the fingerprints of five seeds (`demo-1`, `demo-2`, `regress-3`, `regress-4`, `regress-5`) recorded before the generator split are identical after it (FR-018).
- Validity: 100 plans of 0–12 cities built with 0 failures (average 64 ms, slowest 178 ms). Every built state had connected counties of at least 160 px², a connected county graph, a reference plan within the 10% rule, and no county above 0.75 of an ideal district.
- Tuning run (see [research.md](./research.md)): 200 mixed plans gave 99.5% success (1 failure), 60 plans of exactly 12 cities gave 0 failures, and 150 empty plans gave 0 failures. The builder picks an outline that builds when it opens or when a new outline is requested.
- Placement: clicks, taps, and Enter add a city; clicking a city removes it. Clicks outside the state, within 90 px of a city, and past 12 cities add nothing and show the contract messages. Exactly 90 px apart is allowed.
- Voter makeup: the statewide split matched the slider to within 0.5 points at 30%, 50%, and 70% on 20 plans; city lean +100 / 0 / −100 gave an urban-minus-rural gap above +0.1, near zero, and below −0.1; a slider drag reuses the county shapes and keeps focus.
- Use and Cancel: Use gives an empty, fully editable custom map whose reference plan is a valid balanced plan; Cancel brings back the previous state object with its districts, asks nothing, and leaves the address alone; a failed build disables Use, shows the failure message, and keeps the last good map.
- Address: `?custom=v1.<seed>.<share>.<lean>.<cities>` reloads the same cities, counties, voters, and statewide numbers. Damaged or out-of-range codes (including 13 cities, a city outside the outline, cities 89 px apart, `-0`, and leading zeros) show the friendly message and a random map. New map puts `?seed=` back.
- Clear cities and New outline: both behave as specified, including the confirmation, the kept voter settings, and the message with the number of removed cities.
- Timing on a plan with 12 cities (1366 px): a city click redraws in 45 ms on average (83 ms at most), a slider moves in about 2 ms, and a page load from a `?custom=` address takes 61 ms. All are far under the 1 s and 2 s targets.
- Layout, measured on fresh loads at 1920, 1366, and 320 px in build mode: no horizontal scrolling, nothing overflowing the builder panel (300 px wide at 320 px, 260 px in the side column), four buttons 40 px tall, the statewide stat block visible, and the district sections hidden.
- Accessibility: in build mode the tab order is the matchup toggle, New map, Build a state, the map (one stop, no counties), the two sliders, then the four buttons. The map is labelled "City placement map…", the message area is a polite live region, each slider has a label and a spoken value ("Cities lean Democrats +80"), and the cities are also listed as text.
- Visual check: in the browser, four city markers sit among small dense counties; with city lean +80 and a 45% split the cities are blue against a red countryside, the caption reads "Building your own state", and the builder panel shows the count, both sliders with their words, the message, and the four buttons.
- Deviations from the plan:
  - Cancel keeps whichever matchup is selected instead of restoring one, because the toggle button owns that state.
  - Enter calls `onBuildPoint` and the app decides between removing and adding, instead of the map view calling `onCityToggle` for a nearby city.
  - Only `generateOutline`, `boundingBox`, `generateNames`, `generateStateName`, `buildLayout`, `splitVoters`, `assembleCounties`, and `assembleState` are exported from the generator, not the lower-level seed helpers.
