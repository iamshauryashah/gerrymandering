# Quickstart: Feature 009

## Prerequisites

- A static server at the repository root, for example `python3 -m http.server 8000`.
- A browser with the cache disabled.

## Automated

Open `http://localhost:8000/tests/`. Expect the title `PASS: N passed, 0 failed`, including the new outline, county-size, population, and link tests and every earlier test that this feature does not supersede (see the [contract](./contracts/changes.md#superseded-tests)).

The 100-seed outline and county-size tests take a few seconds each; wait for the title to change.

## Manual

1. **Outlines** (US3): Open `http://localhost:8000/?seed=demo-1`, then click **New map** five or six times (or try `?seed=a`, `?seed=b`, `?seed=c`, `?seed=d`). Each outline should show straight sides meeting at corners and at least one wiggly river or coast side, with no oval blobs, spikes, or thin necks, and the shapes should visibly differ.
2. **Dense counties are smaller** (US4): On any map, cities show as clusters of small counties and open country as larger ones. Hover a small county in a cluster and a large one in the countryside; the small one has the higher density in its tooltip.
3. **Open the builder** (US1): Click **Build a state**. The map shows an empty state with no cities. The "City population" slider is disabled with the hint "Place or select a city to set its population."
4. **Place and size cities** (US1):
   - Click inside the state. A city appears, ringed and selected, and the slider reads "City 1: 100,000 voters".
   - Drag the slider to 300,000. The counties around the city shrink and the stat block's total jumps up.
   - Place a second city and drag its slider to 10,000. It starts at the last value you chose (300,000), then drops; the first city keeps its own size.
   - Click the first city to select it again; the slider shows its value. Nothing is removed by the click.
5. **State grows** (US2): Watch "Total voters" in the Statewide voters block. Adding a city raises it by about that city's population; shrinking or removing it lowers it again. The statewide split still matches the split slider.
6. **Remove** (US1): With a city selected, click **Remove city** (or press Delete or Backspace with the map focused). The city goes and nothing is selected.
7. **Keyboard** (US1): Tab to the map, move the cursor with the arrow keys, press Enter on empty ground to place a city and on a city to select it, adjust the slider with the arrow keys, and press Delete on the map to remove the selected city.
8. **Use and share** (US5): Click **Use this state**, copy the address (`?custom=v2…`), and open it in a new tab. The same cities, populations, counties, and statewide numbers appear.
9. **Old links**: Open `http://localhost:8000/?custom=v1.k3x9a.520.50.210_180-400_300`. Because outlines changed, expect either a state with two 100,000-voter cities or the "link isn't valid" message.
10. **Small screens**: At 320 px wide the slider, hint, and Remove button fit with no horizontal scrolling.

## Expected outcomes

| Check | Expect |
|-------|--------|
| Total voters after adding a city of P | Rises by P (to within a few voters) |
| Rank correlation of density and county size | At most −0.8 on every map |
| Densest tenth of counties versus sparsest tenth | At most one third the average size |
| Outlines | Two straight 150 px sides meeting at a corner, one wiggly side, no ovals |
| Population slider, selection, Remove | Map and stat block update within 1 s |
| Same seed or link | Same outline and counties every time |

See the [data model](./data-model.md) for the rules and numbers, and the [contract](./contracts/changes.md) for element names and messages.

## Results

Measured on this machine with Chromium, caches off.

### Visual and accessibility (T032)

| Check | Result |
|-------|--------|
| Page width 320, 1366, and 1920 px with three cities of 300,000, 40,000, and 150,000 | No horizontal scrolling; the slider, its output, and every builder button stay inside the builder panel |
| Selected city | Has the class `selected`, `data-selected="true"`, and a dashed `circle.city-ring`, so selection is not colour alone |
| Slider | Label "City population", range 10 to 300 (thousands) in steps of 10, `aria-valuetext` equal to its output ("City 3: 150,000 voters") |
| Nothing selected | Slider and Remove city are disabled; the hint reads "Place or select a city to set its population." |
| Remove | Remove city, Delete, and Backspace on the map each remove the selected city and clear the selection |
| Outlines | Straight sides with corners and at least one river or coast side, from three templates; 100 outlines are all different (`tests/outline.test.js`) |

The screenshot tool in this environment returned a stale page, so the look of the outlines and the dense county clusters was checked through the numbers in the tests and `research.md` rather than by eye. Please look at a few maps in the browser.

### Timing (T033)

| Measure | Target | Measured |
|---------|--------|----------|
| One outline | under 20 ms | 4.8 ms average over 100 outlines in the page |
| Build with 12 cities of 300,000 | under 1 s | 360–490 ms |
| Population change on that plan | under 1 s | 190–560 ms |
| Adding or removing a city on that plan | under 1 s | 180–350 ms |
| Slider redraw after the last movement | 120 ms wait plus the build | about 0.5 s in the worst case |
| Load from a `?custom=` address with 12 cities | under 2 s | about 145 ms |
