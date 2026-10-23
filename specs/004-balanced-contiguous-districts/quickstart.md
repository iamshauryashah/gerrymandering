# Quickstart: Dense County Map With Contiguous, Balanced Districts

Run `python3 -m http.server 8000`, then open <http://localhost:8000/?seed=demo-1>. Tests: <http://localhost:8000/tests/>.

## Validation scenarios

1. **Counties**: Confirm the caption shows 90–120 counties. Hover a small city county and a large rural county; confirm their type and density, with urban counties mostly Democratic and rural counties mostly Republican.
2. **Contiguity**: Select District 1 and click a county. Then click a county that does not touch it; confirm it is blocked with a message. Click a touching county; confirm it is added and the message clears.
3. **Split protection**: Build a line of three counties in a district, then click the middle one; confirm removal is blocked. Try taking the middle county from another district; confirm that is blocked too.
4. **Balance**: Confirm the plan status shows the ideal district size, largest, smallest, difference, and the 10,000 limit, and that each district row shows its balance label.
5. **Valid plan**: In the browser console, apply `gerryApp.state.referencePlan` with `gerryApp.assignCounty` for every county (tests do this automatically) and confirm the plan status says "Valid plan".

## Measured results (2026-10-18)

- Test page: 39 passed, 0 failed.
- Load: 16 ms for a 97-county map; slowest county edit: 1.6 ms.
- 100 seeds: smallest county 656 px²; urban counties voting Democrat-side 3407/3407; rural counties voting Republican-side 4068/4068; slowest generation 40 ms.
