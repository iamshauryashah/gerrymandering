# Model API Contract

These browser modules expose pure functions that tests and UI modules use. Function names are a contract; internal helpers may vary.

## Random generation

- `createRandom(seed) -> () => number`: returns deterministic values in `[0, 1)` for the same seed.
- `generateState({ seed, countyCount?, districtCount? }) -> GeneratedState`: creates the outline, 20–60 counties, voter counts, adjacency, 8–20 districts, and initial assignments. Optional counts are for tests and must stay within the allowed ranges.

## Districts

- `summarizeDistrict(state, districtNumber) -> CongressionalDistrict`: aggregates county voters and calculates status, margin, components, and label point.
- `summarizeDistricts(state) -> CongressionalDistrict[]`: summarizes every district in number order.
- `reassignCounty(state, countyId, districtNumber) -> GeneratedState`: returns a new state with the county moved; returns an equivalent state when the county is already in that district.
- `getControlTotal(districts) -> ControlTotal`: counts Side A, Side B, tied, and empty districts.

## Matchups and formatting

- `MATCHUPS`: ordered matchup definitions.
- `getNextMatchup(currentId) -> Matchup`: cycles through matchups in order.
- `getResultColor(status, marginPercent, matchup) -> string`: returns the side color shade, tie color, or empty style key.
- `formatVoterDetails(result, matchup) -> object`: returns display-ready totals, percentages rounded to one decimal place, leading side or status, and margin.

## Validation errors

Invalid county IDs, district numbers, matchup IDs, or out-of-range test counts must throw an `Error` with a clear message. User actions in the UI must never produce invalid assignments.
