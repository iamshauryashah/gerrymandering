# Data Model: Feature 007

No stored data and no model changes. The block is a view of the existing county voters.

## Statewide Voter Makeup (derived)

Computed by `getStatewideResult(counties)` from every county in `state.counties`.

| Field | Meaning |
|-------|---------|
| `sideAVoters` | Sum of every county's `sideAVoters` |
| `sideBVoters` | Sum of every county's `sideBVoters` |
| `totalVoters` | `sideAVoters + sideBVoters`; equals `state.totalVoters` |
| `status` | `'sideA'`, `'sideB'`, or `'tie'` (from `getResult`) |
| `marginPercent` | `|sideA − sideB| / total × 100`; 0 for a tie |

## Display Model

Returned by `formatStatewideMakeup(counties, matchup)`.

| Field | Rule |
|-------|------|
| `totalVoters` | `formatCount(total)`, with thousands separators |
| `sides[0]`, `sides[1]` | Side A, then side B |
| `sides[i].key` | `'sideA'` or `'sideB'` |
| `sides[i].name` | The matchup's side name |
| `sides[i].color` | The matchup's `shades[3]` for that side |
| `sides[i].voters` | `formatCount(voters)` |
| `sides[i].share` | Exact share of all voters, 0–100, used for the bar width |
| `sides[i].percent` | Rounded to one decimal, as a string with `%`; the two percentages MUST add up to exactly 100.0% |
| `status` | As above |
| `summary` | `"<leader> lead statewide · <leader> +<margin> pts"` or `"Tied statewide"` |
| `ariaLabel` | `"<A name> <A percent>, <B name> <B percent>"` for the bar |

## Validation Rules

- Rounding is done in integer tenths: `tenthsA = round(sideA / total × 1000)` and `tenthsB = 1000 − tenthsA`.
- The sums include every county, whether or not it is in a district.
- `totalVoters` equals the sum of both sides' voters.
- Switching the matchup changes only `name` and `color`; every number, `status`, and `summary` voters and margin stay the same (the `summary` text uses the new side name).
- Editing district assignments never changes any field.
- An exact tie has `status` `'tie'`, a summary of "Tied statewide", and no margin.
