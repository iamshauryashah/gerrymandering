# Data Model: Feature 005

Changes relative to [004 data model](../004-balanced-contiguous-districts/data-model.md).

## Generated State

| Field | Change |
|-------|--------|
| `outline` | Irregular radial outline, 360 points, coverage ≤ 0.75 of its bounding box |
| `shapeFeatures` | **New.** Array of 1–2 of `'panhandle'`, `'river'`, `'coast'`, `'notch'` |
| `balanceRatio` | **New.** `0.10`; replaces `balanceLimit` |
| `statewideShareA` | **New.** Side A share of all voters, 0.48–0.52 |
| `referencePlan` | Unchanged; must pass the 10% rule |

## County

| Field | Change |
|-------|--------|
| `totalVoters` | Skewed by density rank. Capped at 0.75 × the ideal district size |
| `densityIndex` | County density ÷ median county density |
| `type` | urban (index ≥ 6), suburban, or rural (index < 1.6); thresholds may be tuned |
| `sideAVoters` | From the lean formula with the statewide offset |

## Balance (from `getBalance`)

| Field | Meaning |
|-------|---------|
| `pass` | No empty district and `largest ≤ smallest × (1 + ratio)` |
| `ratio` | 0.10 |
| `differencePercent` | `(largest − smallest) / smallest × 100`, one decimal; 0 when there are no filled districts |
| `largest`, `smallest`, `difference`, `ideal`, `empty` | As before |
| `districts[].balance` | `'empty'`, `'ok'`, `'over'`, or `'under'`, relative to ideal × (1 ± 0.1/2.1) |

## Validation Rules

- Every map:
  - one outline piece
  - coverage ≤ 0.75
  - at least one shape feature
  - each county ≥ 160 px² and one piece
- Voter checks:
  - the top 10% of counties by voters hold ≥ 25% of voters
  - median ≤ 0.5 × mean
  - max county ≤ 0.75 × ideal
- Statewide side A share is in [0.48, 0.52].
- The reference plan passes the 10% rule.
