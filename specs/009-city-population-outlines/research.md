# Research: City Population, Growing States, Realistic Outlines, and Smaller Dense Counties

## R1: Outline shape: a polygon of straight sides, not a radial blob

- **Decision**: A new `src/outline.js` builds the border as a polygon from corner points. It picks one of three templates at random, scales it into the map, then turns one or two sides into natural meanders (R2):
  - **Stepped box** (boxy): an axis-aligned rectangle (tilt at most 3°, width 1, height 0.6–0.85) with a rectangular notch taken out of one corner (35–55% of the width by 35–55% of the height), and, 30% of the time, a small clip or notch of 12–20% at the opposite corner. The big notch brings the fill below 80%.
  - **Slanted** (tilted): a quadrilateral or pentagon with two long, roughly parallel sides rotated 10°–35°, ends cut so every corner is 65°–115°, optionally with one corner clipped.
  - **Wedge** (irregular): five or six corners around a center at random angles (gaps 40°–110°, radii 0.7–1.0 of the largest), optionally with one concave step.
- **Rationale**: Real states are mostly surveyed straight lines meeting at corners, with rivers and coasts for the rest. A polygon gives the straight sides and corners (FR-013, FR-015); templates give the mix of boxy, tilted, and irregular outlines (SC-008).
- **Alternatives**: Keep the radial function and add polar half-planes (005). Rejected: its sides are curved arcs of a star shape, so it cannot make long straight sides meeting at 90°. Boolean union and difference of rectangles. Rejected: needs a geometry library or a fragile hand-written one.

## R2: Natural borders

- **Decision**: After scaling, choose one or two sides (never the pair kept straight) and replace each with a polyline sampled every 6 px along the side. The perpendicular offset is `d(t) = A · taper(t) · (0.6 sin(2π k₁ t + φ₁) + 0.3 sin(2π k₂ t + φ₂) + 0.1 n(t))`, with `k₁` in 2–4, `k₂` in 5–9, and `n` a smooth value-noise term.
  - `taper(t)` is 0 at both ends, so corners do not move.
  - `A = 0.05 × side length`, kept between 8 and 20 px.
  - A **river** uses the formula as is; a **coast** adds a second pass with `k` up to 16 at 40% of `A`.
  - The shape is fitted into the map with a 36 px margin (16 px plus 20 px for the largest offset), so a meander never leaves the map.
  - Sides are chosen, longest first with random tie-breaks, until the natural sides total at least 20% of the perimeter, each at least 120 px long.
- **Rationale**: Keeps the corners crisp while giving gentle, believable wiggles (FR-014) with no spikes.
- **Alternatives**: Random-walk noise along the whole outline. Rejected: it blurs the straight sides. A hand-drawn library of real states. Rejected: the spec says no copying of real states.

## R3: Outline validity and the fallback

- **Decision**: Every candidate outline must pass all of these (measured on the final polygon), else a new one is drawn, up to 20 times:
  - **simple**: no two sides cross (segment tests, about 100,000 pairs);
  - **fill**: area ÷ bounding-box area is at most `MAX_OUTLINE_COVERAGE`, now 0.80;
  - **corners**: at least four vertices turn by 35° or more;
  - **straight pair**: two adjacent straight sides, each at least 150 px, meeting at 60°–120°;
  - **natural**: natural sides total at least 20% of the perimeter;
  - **arm width**: opening the shape by a 25 px radius (erode by 6 grid steps of 4 px, then grow back) loses at most 2% of its area, using the existing `interiorDistances`, so every arm, peninsula, and notch is at least 50 px wide.

  After 20 failures a guaranteed template is used: a stepped box with one river side, which passes every check by construction.
- **Rationale**: Validity is checked, not hoped for. The fallback keeps generation total, so `generateState` can never fail on the outline.
- **Alternatives**: Fewer checks and trust the templates. Rejected: the meanders and tilts can still cause a crossing or a thin neck in rare cases.

## R4: Measuring realism without the generator's help

- **Decision**: `tests/outline.test.js` measures each outline from its polygon alone, with its own small helpers:
  - **straight run**: a stretch whose segments turn less than 3° from one to the next and stay within 2 px of the chord;
  - **straight pair**: two adjacent runs of at least 150 px whose corner turns 60°–120°;
  - **natural stretch**: a stretch of at least 20% of the perimeter with no straight run above 60 px;
  - **fill**, **corner count**, and **arm width** as in R3;
  - **variety**: among 100 outlines none repeats (compare rounded vertex lists) and at least three shape classes occur (classed by corner count, fill, and tilt of the longest side).
- **Rationale**: Tests that reuse the generator's checks would pass whatever it did. The measures match the spec's wording (SC-007, SC-008).

## R5: A weight field that makes dense counties small

- **Decision**: The county layout uses a weight `w(p) = 1 + max(towns(p), cities(p))` that the existing seed placement and relaxation turn into county size.
  - **City `c`** with population `P`: peak weight as first estimated `1 + 15 · (0.35 + 0.65 √(P / 300,000))` (the final formula is in "Final tuned values"). Its spread was estimated as `σ = 40 + 35 √(P / 300,000)` px, which is 46, 60, and 75.
  - **Towns**: three to six small bumps (peak weight 0.5–3.5 above 1, spread 35–70 px) so a state with no cities still has counties that vary in size. They come from their own stream and are not shown as cities.
  - **Relaxation** runs 8 passes instead of 4, so cell size follows the weight (cell area falls as the square root of the weight).
- **Rationale**: A bigger city gets a higher and wider peak, so its counties are smaller (FR-022); the 16× top weight gives about a 4× size range, which is what the decile target (FR-020) needs, while the 160 px² floor still holds.
- **Alternatives**: Drive county size directly from voters. Rejected: voters depend on size in R6, which would be circular.

## R6: County voters: baseline by size rank, plus each city's share

- **Decision**: After counties exist (so areas are known):
  1. **Baseline shares**: rank counties by `1 / area` times a ±8% noise, and give them the existing sorted lognormal draws (the skewed, capped weights), normalized to sum to 1. Smaller counties get larger shares.
  2. **City shares**: county `i` holds the fraction `K_c(i) · A_i / Σ_j K_c(j) · A_j` of city `c`'s population, where `K_c` is a Gaussian of the county's seed distance to the city with the city's `σ`.
  3. **Voters**: `raw_i = B · share_i + Σ_c P_c · cityShare_{c,i}`, with `B` the baseline (R7).
  4. The existing reference plan then rescales whole districts by factors of 0.75–1.33, which keeps the statewide total, and the voters are rounded (at least 1 each).
- **Rationale**:
  - Density is voters ÷ area. The baseline voters are ranked by smallness and the city voters are densest where counties are smallest, so density rises as size falls, with a rank correlation near −1 (FR-020).
  - Each city's voters sum to exactly its population (FR-010) and sit in the counties around it (FR-009).
  - The old voter-skew machinery (cap at 0.62 of an ideal district, tail restore) is reused unchanged.
- **Alternatives**: Voters straight from a smooth density field. Rejected: it gives too little skew and breaks the older spread checks (top 10% of counties hold at least 25%, median at most half the mean).

## R7: The state's total: baseline plus cities, exactly

- **Decision**: `total = B + Σ P_c`. The baseline `B` is drawn once from 450,000 to 720,000 using a stream named after the outline seed (`seed|baseline`), never the layout attempt's stream, so it does not change when a layout retries or when a city is added.
- **Rationale**: Adding a city of population `P` then changes the total by exactly `P` (rounding aside), well inside the spec's give-or-take 25% (SC-002), however the layout falls. The empty-state range matches what an empty state held before (about 90 counties at 5,000–8,000 voters).
- **Alternatives**: Scale the total with the county count. Rejected: adding a city adds three counties, which would add about 20,000 voters whatever its size, swamping a 10,000-voter town.

## R8: Random states use the same pipeline

- **Decision**: `generateState` draws two to four cities with populations of 50,000–150,000 (steps of 10,000), at least 150 px apart and 40 px inside the outline, and the baseline from `seed|baseline`. It then runs the same layout and voter phases as a custom state. The close-race target and the 48.5–51.5% statewide share are unchanged (the voter phase draws them when no target is given).
- **Rationale**: Every state obeys the same size and total rules (FR-023) with no second code path.
- **Alternatives**: Leave random states on the old density field. Rejected: the spec says the density-size rule applies to every state.

## R9: Selecting, resizing, and removing a city

- **Decision**: The draft keeps `selected` (an index or `null`) and `lastPopulation` (starting at 100,000), outside the plan, so neither is saved in the link.
  - Placing a city adds it at `lastPopulation` and selects it.
  - Clicking or tapping a city, or pressing Enter with the keyboard cursor on one, selects it.
  - The population slider edits the selected city and sets `lastPopulation`; with nothing selected it is disabled and a hint explains why.
  - "Remove city" and the Delete and Backspace keys (while the map has focus) remove the selected city and clear the selection. Removing a city above the selected one shifts the index down.
  - "New outline" and "Clear cities" clear the selection.
  - The selected city is drawn with a larger dashed ring as well as its dot, so color is not the only cue.
- **Rationale**: Matches the spec (FR-003 to FR-007) and removes the accidental-removal risk of click-to-remove.
- **Alternatives**: A global size slider for all cities. Rejected: the request is a size per city.

## R10: Slider updates

- **Decision**: Moving the slider updates its label and spoken value at once. The redraw follows 120 ms after the last movement, and a `change` event redraws at once. `setCityPopulation(index, pop)` is the immediate version, used by the debounce and by tests.
- **Rationale**: A population change moves the weight field, so the whole layout is rebuilt (about 100 ms on average). Coalescing keeps dragging smooth and still meets the 1 s target (SC-004).
- **Alternatives**: Rebuild on every `input` event. Rejected: dragging would queue many 100 ms rebuilds.

## R11: The link format

- **Decision**: `v2.<outlineSeed>.<shareA>.<cityLean>.<cities>` where each city is `x_y_p`, `p` being the population in units of 10,000 (an integer from 1 to 30), joined by `-`; `0` means no cities. `decodeCustomCode` still reads `v1` (cities `x_y`) and gives every city 100,000 voters. Encoding always writes `v2`. Any damaged, out-of-range, or not-fitting code returns `null`, which shows the existing "link isn't valid" message.
- **Rationale**: Populations travel in the link (FR-017, SC-009), and old links have a defined outcome. Because outlines changed, most old links no longer fit and show the message; that is the documented, expected result.
- **Alternatives**: Keep `v1` and guess sizes. Rejected: silent misreads.

## R12: Tests this feature supersedes

- **Decision**:
  - 005-era "100 seeds: state outlines are irregular, simple, and have a distinctive feature" (panhandle, river, coast, notch) is replaced by `tests/outline.test.js`.
  - 008's "random states from existing seeds are unchanged" fingerprints are re-recorded after this feature lands, as a guard for later changes.
  - 008's click-to-remove tests become select, Remove, and Delete tests.
  - The 005-era spread, close-race, and urban-versus-rural checks stay, with thresholds retuned only if R6 cannot meet them (R13).
- **Rationale**: The spec says outlines and click-to-remove change; everything else must keep passing (SC-011).

## R13: Tuning plan

- **Decision**: Starting values above are tuned against 100 seeds and 100 plans (0–12 cities, random populations), recorded in a "Final tuned values" table here after implementation:
  - **Size link**: rank correlation of density and area at most −0.8, and decile ratio at most one third, for random states, custom states, and states with no cities. Levers: relaxation passes, peak weights, town strength, and noise.
  - **Evenness with no cities**: every county within 0.25× to 4× of the average. Lever: town strength.
  - **Voter spread**: top 10% hold at least 25%, median at most half the mean, no county above 0.75 of an ideal district. Levers: the tail restore power and the baseline shares. If these cannot hold, relax the thresholds and record why.
  - **Success rate**: at least 98% of random plans build. Levers: city weight peaks and spacing.
  - **Outline pass rate**: how many candidates the checks reject, and that the fallback is almost never used.
- **Rationale**: Same approach as 005 and 008, where tuning turned estimates into measured values.

## Final tuned values

### Voters (T010)

Measured over 100 random states (`validation-0`…`99`), 150 further random seeds, and 100 custom plans of 0–12 cities with random populations.

| Item | Starting value | Final value | Why it changed |
|------|----------------|-------------|----------------|
| Random cities | 2–4, 60,000–240,000 | 2–4, 50,000–150,000 | Four large cities outweighed the baseline and flattened the county spread. |
| City reach `citySigma` | `40 + 35·√(pop/300000)` | unchanged | |
| Core share of the reach (`CITY_CORE`) | n/a | 0.6 | Voters gather inside this share of a city's reach. |
| City kernel | closeness × area | closeness × area × (baseline voters + 0.1 × the average baseline county) | Cities thicken counties that are already big, so the median county stays small. |
| County cap (`CITY_COUNTY_CAP`) | n/a | 0.6 of an ideal district, each county's cap drawn from 0.55–1 of that | Equal caps stack in neat multiples and stall the district balancer (reference-plan rejections fell about fourfold with uneven caps). |
| Reference-plan tries | 6 | 6 | |
| `URBAN_THRESHOLD` | 6 | 15 | With cities, about 30% of counties passed 6 times the median density and held about 75% of voters, so no more than about 70% of them could vote side A while the state stayed close. At 15 the urban class is about 20% of counties. |
| Lean amplitude, urban / rural | 0.26 / 0.17 | 0.32 / 0.10 | Keeps the smallest-county tier at 0.65–0.80 side B. |
| Spread thresholds (top 10%, median ÷ mean, largest county) | 0.25, 0.5, 0.75 | unchanged | |

| Result | Value |
|--------|-------|
| Random seeds that build | 250 of 250 |
| Custom plans that build | 100 of 100 |
| Statewide side A share | 0.485–0.514; A ahead in 47 of 100 |
| Top 10% share of voters | 0.259–0.582 |
| Median ÷ mean | 0.167–0.453 |
| Urban counties voting side A | 1286 of 1362 (94%) |
| Rural counties voting side B | 5806 of 5806 |
| Smallest-county tier, side B share | 0.747 |
| Slowest random state | about 1 s; slowest in the suite run 140 ms |

### County size (T022, revisited in T026)

Measured over 100 random states, 100 custom plans of 0–12 cities with random populations, and 40 plans with no cities.

| Item | Starting value | Final value | Why it changed |
|------|----------------|-------------|----------------|
| Relaxation passes | 8 | 10 | Past about ten the sizes barely moved, and each pass costs time (twenty made a random state take twice as long). |
| Relaxation weight | the weight | the weight to the power 2.5 (`RELAX_EXPONENT`) | Weighted relaxation alone only shrinks dense counties by about the square root of the weight. |
| Seed placement | accept with probability proportional to √weight, minimum spacing ∝ weight^−0.25, saturating at weight 9 | accept ∝ √(weight ÷ 19), minimum spacing ∝ weight^−0.5 | Weights above 9 made no difference, so a 300,000 city looked like a 30,000 one. |
| City peak weight | `1 + 15 × (0.35 + 0.65 √(pop ÷ 300000))` | `1 + 18 × (pop ÷ 300000)^0.6` | The old formula kept small cities almost as strong as big ones, so counties around a city did not shrink as it grew. |
| City field spread | `40 + 35 √(pop ÷ 300000)` px | `25 + 30 √(pop ÷ 300000)` px | With a dozen cities a wide spread covered the whole state and left no sparse counties, so the densest tenth stayed above a third of the sparsest. |
| City voter reach | `citySigma(pop)` × `CITY_CORE` 0.6 | `citySigma(pop)` × `CITY_CORE` 0.3 | The median county was above half the mean for plans with ten or more large cities; tighter reach fixed it (all 100 random-size plans now build). |
| Towns | 3–6, peak 0.5–3.5, spread 35–70 px | 4–6, peak 2–4.5, spread 35–70 px | With no cities the sizes needed more contrast. |
| Baseline shares | ranked by weight × noise | ranked by 1 ÷ area × noise of about ±8% | Makes voters follow the counties' actual sizes. |
| Size gate | n/a | a layout is drawn again unless the rank correlation is −0.84 or stronger, the densest tenth is at most 0.32 of the sparsest tenth's area, urban < suburban < rural by average area, and (no cities) every county is 0.27–3.9 times the average | The thresholds in the spec (−0.8, one third, a quarter to four times) are met with a margin in every state by construction, not by luck. |
| Custom attempts | 20 | 20 | Retries with the gate average 1.5 per plan. |

| Result | Value |
|--------|-------|
| Rank correlation of density and area | random −0.91 or stronger; custom and no-city −0.84 or stronger (the gate) |
| Densest tenth ÷ sparsest tenth (area) | at most 0.32 in every state (random, custom, none) |
| Urban < suburban < rural average area | every state that has all three types |
| No cities: county area ÷ average | 0.27–3.9 |
| Random states that build | 100 of 100 |
| Random-size plans of 0–12 cities that build | 100 of 100 (average 136 ms, slowest 645 ms) |
| Smallest county | 240 px² or more (limit 160) |
| Bigger city, smaller counties (30,000 versus 300,000 within 60 px) | 20 of 20 pairs |

### Outlines (T026)

| Item | Value |
|------|-------|
| Templates | stepped box, slanted quadrilateral or pentagon, wedge (five or six corners) |
| Natural borders | one or two adjacent sides, a river (amplitude `0.05 × side`, 8–20 px) or a coast (the same plus a finer wiggle at 40%), covering at least 26% of the perimeter when built (the check requires 20%) |
| Margin | 36 px |
| Fill | at most 0.80 (measured at most 0.79) |
| Opening by a disk | the generator checks 8 px cells with a 24 px disk and allows 1% loss; the test checks 4 px cells with a 25 px disk and allows 2% (measured at most 0.8%) |
| Candidates per outline | the first candidate usually passes; 200 test outlines all pass the gate |
| Time per outline | about 10 ms in the generator, under 2 ms once warm |
