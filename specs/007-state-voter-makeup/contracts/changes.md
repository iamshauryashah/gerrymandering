# Contract Changes: Feature 007

## Formatters (`src/formatters.js`)

- `getStatewideResult(counties)`: `getResult` applied to the summed side A and side B voters of every county. Returns `{ sideAVoters, sideBVoters, totalVoters, status, marginPercent }`.
- `formatStatewideMakeup(counties, matchup)`: the display model in the [data model](../data-model.md). Reuses `formatVoterDetails` for `statusText` and `margin`.

## UI Module (`src/ui/state-totals.js`)

- `renderStateTotals(container, state, matchup)`: replaces the container's children with the block below. Safe to call with any generated state (random or custom).

### DOM

```text
section.state-totals[data-role="state-totals"]   (aria-labelledby the h2, aria-live="polite")
├─ h2                                  "Statewide voters"
├─ p.totals-total                      "Total voters: 1,234,567"        [data-key="total"] on a span with the number
├─ p.totals-summary[data-status]       "Democrats lead statewide · Democrats +0.4 pts" | "Tied statewide"
├─ div.makeup-bar[role="img"][aria-label]
│  ├─ span.makeup-segment[data-side="sideA"]   style: width = share %, background = side color
│  └─ span.makeup-segment[data-side="sideB"]
└─ dl.totals-rows
   ├─ div.totals-side[data-side="sideA"]
   │  ├─ dt   swatch (aria-hidden) + side name
   │  ├─ dd.totals-percent[data-key="sideAPercent"]   "50.2%"
   │  └─ dd.totals-voters[data-key="sideAVoters"]     "1,234,567 voters"
   └─ div.totals-side[data-side="sideB"]   (same, with sideB keys)
```

- Side A is always first and left; side B second and right.
- `data-key="total"` holds the formatted total only.

## Page (`index.html`, `src/main.js`)

- `index.html`: `section.state-totals[data-role="state-totals"]` is the first child of `.map-side`, above `[data-role="control-total"]`.
- `main.js`:
  - `elements.stateTotals = $('state-totals')`.
  - `renderStateTotalsView()` calls `renderStateTotals(elements.stateTotals, app.state, app.matchup)`.
  - `renderAll()` calls it; `renderDistrictViews()` does not.
  - Feature 008's builder calls `renderStateTotalsView()` after every build or voter-settings change.

## Styles (`styles.css`)

- `.state-totals` joins the shared card rule with `.control-total`, `.plan-status`, and `.legend`, and the shared `padding: 12px 14px` rule.
- `.makeup-bar`: flex row, 16 px tall, rounded, with a 50% marker.
- `.totals-side`: two-line group so it fits 232 px of content width.

## Tests

- `tests/matchups.test.js` (formatter unit tests):
  - Sums equal the county sums and `state.totalVoters`.
  - Percentages add up to exactly 100.0% for the cases 50.04/49.96, 33.35/66.65, 50/50, and 99.95/0.05.
  - A tie gives "Tied statewide"; a lead gives the leader wording.
  - Switching the matchup changes names and colors only.
- `tests/ui.test.js` (block and page):
  - Block content and placement above the control block.
  - Numbers equal the county sums.
  - Edits leave the block's HTML identical.
  - Matchup toggle changes names and colors but not numbers.
  - A new map and a reloaded seed update it.
  - Fits 320 px with no horizontal overflow.
