# Research: Dense County Map With Contiguous, Balanced Districts

## R1: Smaller counties near cities

- **Decision**: Place seeds with a density weight `w = 1 + 8·urban`, where `urban` is the strongest Gaussian falloff from 2–4 city centers. Use weighted Lloyd relaxation so each county holds a similar share of weight, making urban counties smaller.
- **Rationale**: Real urban counties are smaller and denser. It also keeps county voter counts within a narrow range, which is needed for the balance rule.
- **Alternatives**: Uniform county sizes with very dense cities. Rejected: one city county could exceed a whole district's population.

## R2: Urban/rural voting pattern

- **Decision**: Relative density `rel = w × noise`. Type: urban if `rel ≥ 4`, rural if `rel < 1.8`, otherwise suburban. Democratic (side A) share = `0.5 + 0.25·ln(rel / 2.68)` plus a smooth regional term (±0.04) and county noise (±0.07), clamped to 0.12–0.88.
- **Rationale**: At the thresholds the density term is about ±0.1, larger than nearly all of the noise, so well over 80% of urban counties vote Democratic and of rural counties vote Republican.
- **Alternatives**: Assigning party by type directly. Rejected: suburban counties need gradual, competitive results.

## R3: Guaranteeing a valid plan

- **Decision**: Grow a hidden reference plan from far-apart starting counties, always extending the smallest district by a neighboring county, then improve balance by moving border counties when contiguity is kept. Rescale each district's county voters so every reference district equals the target. Reject the attempt if any scale factor is outside 0.75–1.33.
- **Rationale**: Contiguous by construction and balanced to within rounding, so FR-006 always holds.
- **Alternatives**: A search for a balanced plan after generating voters. Rejected: slow and may fail.

## R4: Contiguity checks

- **Decision**: Counties are adjacent when they share an edge on the 4 px sampling grid (4-neighbor adjacency, no diagonal corners). Contiguity is checked by BFS on the remaining counties of the affected district, at most 120 nodes per check.
- **Rationale**: Exact against the shown geometry and fast.

## R5: Balance check and district labels

- **Decision**: Pass when no district is empty and max − min district voters ≤ 10,000. Each district is labeled relative to the ideal size (state voters ÷ district count): within ±5,000 is "Within range", above is "Too large", below is "Too small", and no counties is "Empty".
- **Rationale**: If every district is within ±5,000 of the ideal, the 10,000 limit is met. When a complete plan fails, at least one district is outside that window, so the labels always show what to fix.
