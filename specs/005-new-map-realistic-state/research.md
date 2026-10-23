# Research: New Map Button, Close Elections, 10% Balance, Irregular Shapes

## R1: What the Texas 2024 results teach (distribution only)

- **Decision**: Use Texas 2024 only for the shape of the voting pattern:
  - Voters are concentrated: the top 5 of 254 counties cast 40% of votes, and the median county is about one-sixth of the mean.
  - Side B's share rises steadily as counties get smaller: 47% (200k+), 64%, 76%, then 80% (under 10k).
  - Suburbs are competitive.
  - A few rural exceptions exist.
- **Rationale**: The user clarified that states must be close to even (48–52) and that Texas only shows how real voting is distributed.
- **Alternatives**: Copy Texas's 56–42 result. Rejected by the clarification.

## R2: Skewed voter totals with a cap

- **Decision**:
  1. Rank counties by density weight times noise.
  2. Draw sorted lognormal quantiles with σ ∈ [1.0, 1.3] and assign them by rank (densest county gets the largest).
  3. Apply a cap of `0.75 × ideal district` by clamping and renormalizing, up to 10 rounds.
  4. Multiply by per-county noise (±15%) before re-sorting, so neighbors are not perfectly ordered.
  5. After the reference plan rescales voters, re-check the cap, the top-10% share (≥ 25%), and median ≤ ½ mean. Retry the attempt if any check fails.
- **Rationale**:
  - A lognormal with σ ≈ 1.2 has median/mean ≈ 0.49.
  - The cap guarantees that a balanced plan can exist.
  - Ranking keeps urban counties as the largest.
- **Alternatives**: Steeper density exponent only. Rejected: it cannot control the median and the cap together.
- **Note**: The 004 weighted relaxation (smaller counties near cities) is kept. Density = voters / area therefore rises even faster toward cities.

## R3: County type

- **Decision**:
  - `densityIndex` = county density ÷ median county density.
  - Urban if ≥ 6, rural if < 1.6, otherwise suburban.
  - These are starting values, tuned during implementation against the 100-seed test.
- **Rationale**: Relative to the state, so it is independent of the absolute voter scale.

## R4: Lean and the 48–52 statewide result

- **Decision**:
  - `shareA = clamp(0.5 + δ + a·ln(densityIndex / pivot) + regional(±0.04) + noise(±0.05), 0.08, 0.92)`.
  - Start with a ≈ 0.13.
  - Pick a target `t = 0.5 ± U(0.003, 0.015)`, with a 50/50 random sign.
  - Solve δ by bisection over [−0.3, 0.3] so that Σ sideA / Σ voters = t. This works because shareA never decreases as δ grows.
  - Reject the attempt if the result after rounding falls outside 48–52 or the winner is not the intended side.
- **Rationale**: Every map ends up between 48.5% and 51.5%, either side wins about half the time, and the urban-to-rural gradient is kept.
- **Checks** (100-seed test):
  - Urban counties ≥ 80% side A.
  - Rural counties ≥ 80% side B.
  - Side A wins 10–30% of counties on average.
  - Side B's share rises from the largest size tier to the smallest.

## R5: 10% balance rule

- **Decision**:
  - Pass when no district is empty and `largest ≤ 1.10 × smallest`.
  - The percent difference shown is `(largest − smallest) / smallest × 100`, rounded to one decimal.
  - Per-district window: ideal × (1 ± r), with r = 0.1 / 2.1 ≈ 4.76%.
- **Rationale**: If every district is inside the window, (1 + r) / (1 − r) = 1.10, so the plan passes. When a complete plan fails, at least one district is outside the window.
- **Alternatives**: Measure relative to the ideal size (±5%). Rejected: the user asked for the gap between highest and lowest.

## R6: Irregular outline

- **Decision**: The outline is a star-shaped polygon r(θ) with 360 vertices around a center. The steps are:
  1. **Base**: an ellipse with low-frequency waves (from 004).
  2. **Straight borders** (0–2): polar half-planes `r ≤ d / cos(θ − φ)`.
  3. **Features** (1–2, chosen at random):
     - **Panhandle**: a constant-width arm, `r = max(r, h / |sin(θ − θ₀)|)` capped at length L. The arm is 50–90 px wide and 1.4–1.8 × the base radius long.
     - **River border**: over a 60–100° range, add a meander (2–3 sine terms at 6–14 cycles) of ±4–8% of the radius.
     - **Rugged coast**: over a 70–120° range, add fractal noise (several octaves up to 30 cycles) of ±3–6%.
     - **Notch**: a smooth dip of 25–40% depth over 15–30°.
  4. **Fit**: scale and translate into [16, W−16] × [16, H−16], keeping the aspect ratio.
  5. **Accept** only if area / bounding-box area ≤ 0.75. Otherwise draw a new outline, up to 20 times, then force a panhandle.
- **Rationale**: A radial function always produces one connected shape without holes or self-intersections. A panhandle alone usually brings coverage below 75%. The features are recorded as `state.shapeFeatures` for tests.
- **Alternatives**: Polygon boolean union. Rejected: needs a geometry library or a fragile hand-written version.
- **Clickable-size check**: the existing ≥ 160 px² and one-piece checks still apply. Narrow arms are at least 50 px wide, so the minimum clickable size can still be met.

## R7: New map flow

- **Decision**:
  - A `button[data-role="new-map"]` labeled "New map" sits in the toolbar beside the matchup toggle.
  - Clicking it checks whether any county is assigned. If so, it asks `confirm('Start a new map? Your districts will be lost.')`; the prompt can be injected for tests.
  - It then runs `load(createSeed())` and updates the address with `history.replaceState(null, '', '?seed=…')`. The matchup is kept.
- **Rationale**:
  - Generation is synchronous, so double clicks are naturally serialized.
  - `replaceState` avoids Back-button behavior that would drop work without a prompt.
- **Alternatives**: `pushState` plus a `popstate` reload. Rejected: Back would silently discard districts.

## Final tuned values (T012, measured on seeds validation-0…99)

| Setting | Planned | Final | Why |
|---------|---------|-------|-----|
| Lognormal σ | 1.0–1.3 | U(1.15, 1.4) | Wider tail survives the cap better. |
| County cap | 0.75 × ideal | 0.62 × ideal before the reference rescale, 0.75 × ideal checked after | Headroom for the per-district factors. |
| Spread restore | — | Raise weights to the power 1.3 (up to 10 passes) until median ≤ 0.42 × mean and top-10% ≥ 0.28 | Capping flattened the distribution; median/mean landed at 0.5–0.7 without it. |
| Minimum county | — | 3% of the average county's voters | Avoids 1-voter counties. |
| Lean curve | a·ln(densityIndex/pivot), a ≈ 0.13 | tanh(0.6 · ln(densityIndex / √(6·1.6))), × 0.26 above the pivot and × 0.17 below, ± regional 0.04, ± noise 0.04 | The log curve was unbounded; urban counties outweigh rural ones, so the statewide offset pushed rural counties to the 92% clamp. |
| Offset search | [−0.3, 0.3], 40 steps | [−1, 1], 50 steps | Same result; wider bracket is safer. |
| Thresholds | urban ≥ 6, rural < 1.6 | unchanged | |

Measured: no seed needed more than 4 attempts (slowest generation about 110 ms); statewide side A 48.5–51.5% with side A ahead in about half the maps; side A wins about 19% of counties; rural side B share about 61–92% (no rural county leans A); urban side A wins about 86%; size tiers' side B share about 0.45 > 0.64 > 0.75 > 0.78; outline coverage 0.55–0.75; all four feature kinds appear.
