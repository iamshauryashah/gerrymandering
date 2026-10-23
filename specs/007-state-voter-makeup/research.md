# Research: Statewide Voter Makeup Stat Block

## R1: Where the numbers come from

- **Decision**: Sum `sideAVoters` and `sideBVoters` over `state.counties` and pass the sums to the existing `getResult(sideA, sideB)`. The result gives `totalVoters`, `status` (`sideA`, `sideB`, or `tie`), and `marginPercent`.
- **Rationale**:
  - Counting every county, assigned or not, meets FR-002 and FR-007.
  - District edits only change `assignments`, so FR-010 holds by construction.
  - Reusing `getResult` keeps tie and margin rules identical to counties and districts.
- **Check**: The sum must equal `state.totalVoters`; a test asserts it.
- **Alternatives**: Sum the districts. Rejected: unassigned counties would be missing. Read `state.statewideShareA`. Rejected: it exists only on generated states, it is a ratio, and it has no counts.

## R2: Percentages that add up to 100.0%

- **Decision**: Work in integer tenths of a percent. `tenthsA = round(sideA / total × 1000)` and `tenthsB = 1000 − tenthsA`. Display `tenths / 10` with one decimal.
- **Rationale**: The second side is the remainder, so the pair always totals exactly 100.0% (FR-004, SC-002). Integer math avoids floating-point drift such as 99.99999.
- **Edge**: When the total is 0 (not possible for generated states) both show 0.0%.
- **Alternatives**: Round each side with `formatPercent`. Rejected: 50.04% and 49.96% round to 50.0% and 50.0%, but 33.35 and 66.65 style splits can sum to 100.1%. Largest-remainder rounding. Rejected: with two sides it gives the same answer as the remainder rule.

## R3: Leader and margin wording

- **Decision**: Reuse `formatVoterDetails` for the leader and the margin. The summary line is `<statusText> statewide · <margin>`, for example "Democrats lead statewide · Democrats +0.4 pts". A tie reads "Tied statewide" with no margin.
- **Rationale**: Same wording as the tooltips (FR-005). The margin comes from the exact voters, as in the county and district details, so a 0.1 point difference from the rounded percentages is possible and matches the rest of the page.
- **Alternatives**: Compute the margin from the displayed percentages. Rejected: it can show "+0.0 pts" for a state that has a leader.

## R4: The proportional bar

- **Decision**: A `div.makeup-bar` with two `span.makeup-segment` children whose widths are each side's exact share (not the rounded one), colored with the side's `shades[3]`. A thin marker at 50% shows the halfway line. The bar has `role="img"` and an `aria-label` such as "Democrats 50.2%, Republicans 49.8%".
- **Rationale**:
  - Plain HTML and CSS, no canvas or chart code.
  - `shades[3]` is the color the district-control rows use, so the two blocks match (US3 scenario 3).
  - The label text, the rows, and the summary carry the same information, so color is not the only cue (FR-012).
- **Alternatives**: An SVG bar. Rejected: more markup with no benefit. A pie chart. Rejected: harder to compare two near-equal shares than a bar with a midpoint marker.

## R5: Layout in the side panel

- **Decision**: Add the section as the first block of `.map-side`, above the district-control block. Each side is shown as a two-line group: swatch, name, and percentage on the first line, voter count on the second.
- **Rationale**:
  - The side column is 260 px wide (about 232 px inside the padding). Name, voter count, and percentage on one line need about 245 px and would overflow with a 7-digit count.
  - Placing it above the control block meets FR-011 and keeps both visible together on desktop; on narrow screens the side panel stacks below the map, so the two blocks stay adjacent.
- **Alternatives**: Put it above the map. Rejected: it pushes the map down on phones.

## R6: When it redraws

- **Decision**: `main.js` gets `renderStateTotalsView()`, called from `renderAll()` only. `renderAll()` already runs on load (new map, seed) and on every matchup change. `renderDistrictViews()` (used by edits) does not call it.
- **Rationale**: FR-008 to FR-010 follow from where the call sits. Feature 008 calls the same function when its builder changes cities or voter settings.
- **Alternatives**: Redraw on every edit and rely on the numbers being equal. Rejected: needless work, and the unchanged-DOM test for SC-004 would be weaker.

## R7: Accessibility

- **Decision**:
  - A `section` with `aria-labelledby` pointing at the heading "Statewide voters".
  - `aria-live="polite"`, like the sibling blocks, so a new map or matchup change is announced.
  - The total, each side's voters and percentage, and the summary are real text.
  - The swatches are `aria-hidden`.
- **Rationale**: Matches the existing blocks and FR-012.
