# Research: Congressional District Editor

## Application delivery

- **Decision**: Build a static single-page website with HTML, CSS, and native JavaScript modules, served locally with `python3 -m http.server`.
- **Rationale**: The workspace has no existing app or Node.js runtime. The feature runs fully in the browser and needs no backend or persistence.
- **Alternatives considered**: A JavaScript framework with a build tool would require installing Node.js and adds unnecessary setup. A server-rendered app adds a backend without user value.

## Map rendering

- **Decision**: Render the state, counties, district borders, labels, and highlights as SVG.
- **Rationale**: SVG supports precise county shapes, pointer and keyboard interaction, scalable labels, and responsive resizing.
- **Alternatives considered**: Canvas requires custom hit-testing and accessibility. HTML grid cells would not look like a state map.

## Reproducible randomness

- **Decision**: Use a small seeded pseudorandom generator. Normal visits get a new random seed; `?seed=<value>` reproduces a specific state for testing.
- **Rationale**: Visitors still get a new state on each load, while tests and bug reports can recreate the same state.
- **Alternatives considered**: Unseeded randomness cannot be tested reliably.

## State and county geometry

- **Decision**: Create a star-shaped, irregular state outline with mostly broad edges and a few state-like jagged sections. Place 20–60 county seeds inside it, build Voronoi cells within the map bounds, and clip the visible cells to the state outline.
- **Rationale**: Voronoi cells resemble irregular counties, cover the state without overlaps, and are straightforward to compute for at most 60 seeds.
- **Alternatives considered**: Hex grids look artificial. Copying real state shapes conflicts with the fictional-data assumption.

## Area, adjacency, and labels

- **Decision**: Sample the state on a fine internal grid to calculate county area, find neighboring counties, identify connected district parts, and choose label points.
- **Rationale**: Grid sampling uses the same visible clipped shapes users interact with and avoids complex polygon intersection logic. Generation rejects and retries any state containing a county whose visible area is 400 square pixels or less at the 800 × 600 px full map size.
- **Alternatives considered**: Exact polygon clipping and union operations are more complex without a geometry library.

## Voter makeup

- **Decision**: Assign county totals from a skewed distribution that creates a few large-population counties, and set each county's lean using smooth regional trends plus local noise. Store generic Side A and Side B counts.
- **Rationale**: Realistic clustering creates interesting district outcomes. Generic sides let matchup changes relabel and recolor without changing voter numbers.
- **Alternatives considered**: Independent random leans per county produce noisy maps. Separate data per matchup conflicts with the spec.

## Initial districts

- **Decision**: Randomly choose 8–20 districts, pick spread-out starting counties, and grow districts across adjacent counties until all counties are assigned.
- **Rationale**: Every district starts with at least one county and usually forms a natural-looking contiguous area.
- **Alternatives considered**: Random county assignment creates fragmented districts. Equal-population districting is not required by the spec.

## Colors and accessibility

- **Decision**: Use stronger shades for larger leads, a gray tie color, and a hatched pale style for empty districts. Make counties, district entries, and pen buttons keyboard focusable with descriptive labels.
- **Rationale**: Lead strength and tie/empty states remain visible across all matchups, and keyboard users can access the same information.
- **Alternatives considered**: Color-only status indicators and hover-only details would exclude some users.

## Testing

- **Decision**: Use a small browser-based test runner for model and DOM tests, plus quickstart scenarios for visual and responsive checks.
- **Rationale**: This tests native modules in a real browser without adding dependencies.
- **Alternatives considered**: Node-based test tools are unavailable and would add setup work.
