# Data Model: Feature 008

New entities live in `src/custom-state.js`. The generated state keeps the shape described in the [005 data model](../005-new-map-realistic-state/data-model.md), plus the fields below.

## Constants

| Name | Value |
|------|-------|
| `MAX_CITIES` | 12 |
| `MIN_CITY_DISTANCE` | 90 px |
| `SHARE_RANGE` | 300–700 (permille of all voters) |
| `LEAN_RANGE` | −100 to 100 |
| `CITY_SIGMA` | 55 px |
| `CUSTOM_MAX_ATTEMPTS` | 20 |
| `SHARE_TOLERANCE` | 0.005 |

## Custom State Plan

Everything needed to rebuild one custom state.

| Field | Type | Rules |
|-------|------|-------|
| `outlineSeed` | `string` | Must match `^[0-9a-z]{1,16}$`; selects the outline |
| `cities` | `{ x, y }[]` | At most 12; order is placement order |
| `shareA` | `number` | Integer from 300 to 700; default 500; side A's share of all voters in permille |
| `cityLean` | `number` | Integer from −100 to 100; default 50; positive means cities lean side A and the countryside leans side B |

### City

| Field | Rules |
|-------|-------|
| `x` | Integer from 0 to 800 |
| `y` | Integer from 0 to 600 |
| inside the outline | `pointInPolygon([x, y], outline)` must be true |
| spacing | Distance to every other city must be at least 90 px |

### Validation results

- `checkCityPlacement(plan, point)` returns `{ ok: true }` or `{ ok: false, reason }` where `reason` is `'outside'`, `'too-close'`, or `'limit'`. It checks in that order of precedence: limit, outside, too-close.
- `validatePlan(plan)` returns the list of rule violations (empty when valid); used by `decodeCustomCode`.

## Derived Values

| Value | Formula |
|-------|---------|
| `countyCount` | `min(120, 90 + 3 × cities.length)` |
| `districtCount` | `round(countyCount / 8)` |
| Outline | `outlineForSeed(outlineSeed)`: first non-null outline for salts 0–9 |
| Density weight | `1 + 8 × max over cities of exp(−d² / (2 × 55²))`; 1 with no cities |

## Build Result

`buildCustomState(plan)` returns one of:

| Result | Meaning |
|--------|---------|
| `{ ok: true, state }` | The state passed every layout check and the voter phase |
| `{ ok: false, reason: 'layout' }` | No attempt of 20 produced a valid layout |
| `{ ok: false, reason: 'plan' }` | The plan breaks a rule in `validatePlan` |

## Generated State (additions)

| Field | Meaning |
|-------|---------|
| `custom` | `true` for a custom state; absent or `false` for random states |
| `seed` | For a custom state, the plan's address code (see the contract) |
| `layoutKey` | String that names the layout: `outlineSeed` + cities + attempt. Equal keys mean equal county shapes |
| `plan` | The `CustomStatePlan` the state was built from (custom states only) |
| `statewideShareA` | Side A's share of all voters; within 0.005 of `shareA / 1000` |

## Builder Draft (app state only)

| Field | Type | Meaning |
|-------|------|---------|
| `mode` | `'view'` or `'build'` | Current page mode |
| `draft.plan` | `CustomStatePlan` | The plan being edited |
| `draft.result` | Build Result | The latest build |
| `draft.snapshot` | `{ state, address }` | What Cancel restores (the matchup stays as the visitor left it) |

## State Transitions

```text
view ──Build a state (confirm if districts exist)──▶ build
build ──city added/removed──▶ build   (layout phase, then voter phase)
build ──slider moved──▶ build         (voter phase only)
build ──New outline / Clear cities──▶ build
build ──Use this state (result.ok)──▶ view   (custom state, districts empty, address ?custom=…)
build ──Cancel──▶ view                (snapshot restored)
view  ──New map──▶ view               (random state, address ?seed=…)
```

## Validation Rules

- A plan is valid when:
  - `outlineSeed` matches `^[0-9a-z]{1,16}$`;
  - `shareA` is an integer from 300 to 700;
  - `cityLean` is an integer from −100 to 100;
  - there are at most 12 cities, each inside the outline and at least 90 px from every other.
- A built state passes the random-state checks:
  - every county is one connected piece of at least 160 px²;
  - the county graph is connected;
  - a reference plan exists that passes the 10% rule;
  - no county exceeds 0.75 × the ideal district;
  - the top 10% of counties hold at least 25% of voters and the median is at most 0.5 × the mean.
- The statewide share of side A is within 0.005 of `shareA / 1000`.
- The same plan always builds the same state, and applying the same settings twice gives the same voters.
