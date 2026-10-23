# Quickstart: Unassigned Counties and Blank Districts

Run the app with `python3 -m http.server 8000` and open <http://localhost:8000/?seed=demo-1>. Tests are at <http://localhost:8000/tests/>.

## Validation scenarios

1. **Blank start**: Load the app. Confirm no district borders or number badges appear, every district says "Empty", and the control total shows every county as unassigned.
2. **Add**: Click a pen, then click a county. Confirm it joins the district and the unassigned count drops by one.
3. **Remove**: Click the same county again. Confirm it leaves the district, is marked unassigned again, and the district returns to empty.
4. **Move**: Build two districts, select one, and click a county from the other. Confirm the county moves.
5. **Details**: With editing off, hover an unassigned county. Confirm its details say "No district".

## Measured results (2026-10-18)

- Test page: 39 passed, 0 failed.
- Load: 16 ms for a 97-county map; slowest county edit: 1.6 ms.
- 100 seeds: smallest county 656 px²; urban counties voting Democrat-side 3407/3407; rural counties voting Republican-side 4068/4068; slowest generation 40 ms.
