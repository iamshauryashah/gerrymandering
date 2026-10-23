# Quickstart: Feature 005

## Prerequisites

- From the project root, run `python3 -m http.server 8000`.

## Automated

1. Open `http://localhost:8000/tests/` with the cache disabled.
2. Expect the title `PASS: N passed, 0 failed`.
3. The console should log:
   - outline coverage (max ≤ 0.75)
   - top-10% voter share (min ≥ 25%)
   - statewide side A share range (within 48–52%)
   - side A win rate (35–65%)
   - urban/rural vote rates
   - generation time

## Manual

1. Open `http://localhost:8000/?seed=demo-1`. Hover the largest counties: most lean side A. Hover rural counties: they lean strongly to side B.
2. Click **New map**. The map, district list, and address change. Reload the page: the same map appears.
3. Add a county to District 1, then click **New map** and cancel. Nothing changes. Click again and confirm: a new map appears with empty districts.
4. Load the reference plan from the console: `gerryApp.setAssignments(gerryApp.state.referencePlan)`. The plan check shows "Valid plan", a difference under 10%, and the limit "10%".
5. Click **New map** 10 times. Every outline is clearly irregular, with a panhandle, river edge, rugged coast, or notch.

## Results (implementation run)

- Automated: `PASS: 43 passed, 0 failed` (39 before the feature, plus the New map UI test and three 100-seed generator tests).
- Generation: slowest of 100 seeds about 110 ms, at most 4 attempts; New map is instant.
- 1366 px: irregular outlines (panhandle, river, coast, notch), cities blue and countryside red for `demo-1`.
- 320 px: no horizontal overflow; the toolbar wraps and New map is a 44 px target.
