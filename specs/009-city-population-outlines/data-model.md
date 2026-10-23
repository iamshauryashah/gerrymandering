# Data Model: Feature 009

Changes relative to the [008 data model](../008-custom-state-builder/data-model.md) and the [005 data model](../005-new-map-realistic-state/data-model.md).

## Constants

| Name | Value |
|------|-------|
| `POPULATION_RANGE` | `{ min: 10000, max: 300000 }`, in steps of `POPULATION_STEP` = 10,000 |
| `DEFAULT_POPULATION` | 100,000 |
| `BASELINE_RANGE` | 450,000 to 720,000 voters |
| `RANDOM_CITY_RANGE` | 2 to 4 cities of 50,000 to 150,000 voters (random states) |
| `MAX_OUTLINE_COVERAGE` | 0.80 (was 0.75) |
| `OUTLINE_MARGIN` | 36 px (16 px plus 20 px for the largest meander) |
| `STRAIGHT_RUN_MIN` | 150 px |
| `NATURAL_SHARE_MIN` | 0.20 of the perimeter |
| `ARM_WIDTH_MIN` | 50 px |
| `RELAX_PASSES` | 10 (was 4); the weight is raised to `RELAX_EXPONENT` 2.5 first |

## City

| Field | Rules |
|-------|-------|
| `x` | Integer from 0 to 800 |
| `y` | Integer from 0 to 600 |
| `pop` | Integer from 10000 to 300000 and a multiple of 10000 |
| inside the outline | `pointInPolygon([x, y], outline)` must be true |
| spacing | At least 90 px from every other city |

## Custom State Plan

| Field | Type | Rules |
|-------|------|-------|
| `outlineSeed` | `string` | Must match `^[0-9a-z]{1,16}$` |
| `cities` | `City[]` | At most 12; each as above |
| `shareA` | `number` | Integer from 300 to 700 |
| `cityLean` | `number` | Integer from −100 to 100 |

## Builder Draft (app state only)

| Field | Type | Meaning |
|-------|------|---------|
| `selected` | `number \| null` | Index of the selected city; exactly one city or none |
| `lastPopulation` | `number` | Population given to the next new city; 100,000 until the slider is used |

`selected` and `lastPopulation` are not part of the plan and are not saved in the link.

## Outline

| Field | Rules |
|-------|-------|
| `outline` | Polygon of vertices in map pixels, inside the 36 px margin |
| `shapeFeatures` | `[template, ...naturalKinds]`, for example `['stepped', 'river']`; the template is `'stepped'`, `'slanted'`, or `'wedge'` and each natural kind is `'river'` or `'coast'` |

A valid outline:
- has no crossing sides;
- fills at most 0.80 of its bounding box;
- has at least four vertices turning 35° or more;
- has two adjacent straight sides of at least 150 px meeting at 60° to 120°;
- has natural sides totaling at least 0.20 of its perimeter;
- loses at most 2% of its area when opened by a 25 px radius (so every arm is at least 50 px wide).

## Generated State (additions and changes)

| Field | Change |
|-------|--------|
| `cities` | **New.** The cities the state was built from (`{ x, y, pop }`); for a random state, the random cities |
| `baseline` | **New.** The all-rural baseline voters |
| `totalVoters` | Now `baseline + Σ city populations` (to rounding) |
| `layoutData` | Unchanged in shape; `totals` and `densityIndex` come from the new voter rule |
| `seed` | For a custom state, the `v2` code |
| County `density` | Voters ÷ area in square miles, as before; now rises as county area falls |

## County Voters

| Term | Rule |
|------|------|
| baseline share | Sorted lognormal draws handed out by `1 / area` (±8% noise), normalized to sum to 1 |
| city share of county `i` for city `c` | `K_c(i) · A_i ÷ Σ_j K_c(j) · A_j`, `K_c` a Gaussian of the seed distance with the city's spread |
| raw voters | `baseline × baseline share + Σ_c pop_c × city share` |
| final voters | Raw voters times the reference-plan district factor (0.75 to 1.33), rounded, at least 1 |

## City Weight Field

| Part | Rule |
|------|------|
| city peak weight | `1 + 18 × (pop / 300000)^0.6` (the final value, see research.md "Final tuned values") |
| city spread (σ) | `25 + 30 √(pop / 300000)` px for the weight field; `40 + 35 √(pop / 300000)` px (`citySigma`) times `CITY_CORE` 0.3 for where the city's voters live |
| towns | 4 to 6 bumps, peak 2 to 4.5 above 1, spread 35 to 70 px, from their own stream |
| weight at a point | `1 + max(towns, cities)` |

## Validation Rules

- Total voters equal the baseline plus the cities' populations, within rounding, whatever the layout attempt.
- Adding, removing, or resizing a city changes the total by its population (within 25% allowed; in practice exact to a few voters).
- Rank correlation between county density and area is at most −0.8; the densest tenth average at most one third the area of the sparsest tenth; urban counties average smaller than suburban, smaller than rural.
- Every earlier state rule holds: 90–120 counties, each at least 160 px² and one piece, a connected county graph, no county above 0.75 of an ideal district, and a reference plan within the 10% rule.
- The same seed, outline seed, or link always gives the same outline, cities, counties, and voters.

## State Transitions

```text
build ──place city──▶ build        (new city at lastPopulation, selected)
build ──click / tap / Enter on a city──▶ build   (that city selected)
build ──population slider──▶ build (selected city resized; layout rebuilt; lastPopulation updated)
build ──Remove city / Delete / Backspace──▶ build (selected city removed; nothing selected)
build ──New outline / Clear cities──▶ build      (nothing selected)
```
