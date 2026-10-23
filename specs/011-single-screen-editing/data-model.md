# Data Model: Single-Screen District Editing

No stored data, rules or links change. This feature adds one derived view model and defines the layouts and their areas.

## District Detail (derived, per edit)

Built from the existing district summary (`state.districts[n - 1]`) and the existing balance result (`getBalance(state)`), so it always agrees with the picker and the plan status.

| Field | Source | Notes |
|-------|--------|-------|
| `number` | district | 1 to the district count |
| `status` | balance entry `balance` | One of `empty`, `under`, `ok`, `over`; shown as "○ Empty", "▼ Too small", "● Within range", "▲ Too large" |
| `offset` | balance entry `offset` | Voters outside the range: positive over `upper`, negative under `lower`, 0 when within or empty |
| `lower`, `upper`, `ideal` | balance result | The allowed range and the ideal size |
| `totalVoters` | district | Whole number |
| `leader` | district `status` and `marginPercent` | Side short name and margin, "Tied", or "Empty" |
| `precinctCount` | district `precinctIds.length` | |
| `connected` | district `components.length <= 1` | When false, the number of pieces is shown |

Rules: a district with no precincts is `empty` with no leader and no range comparison; `offset` is 0 inside the range; all numbers are whole and use the app's number formatting.

## Picker Tile (derived, per district)

| Part | Content |
|------|---------|
| Number and color | The district number on its result color (the empty pattern when the district is empty) |
| Leader | Short side name and margin ("Dem +5.2"), "Tied", or "Empty" |
| Status | Symbol and words, as above |
| Amount | "+4,210" or "−1,860" when outside the range; blank otherwise |
| Pen | Unchanged control with `aria-pressed` |

The tile's accessible label is the existing full sentence (number, leader with margin, precinct count, balance wording).

## Layouts and their areas

The container is the page content element; each layout is a set of named areas over the same children.

| Layout | When | Areas (rows) |
|--------|------|--------------|
| Workbench | Content at least 1240 px wide, window at least 720 px tall, not building | `top top` / `map panels` / `brush panels` / `totals control` / `legend legend` / `hint hint` / `notice notice`; rows: top 52 px, map `1fr`, brush 56 px (the first three together exactly one window tall), then auto |
| Two columns | Content 760 px or wider and the workbench does not apply (including building) | `top top` / `map panels` / `brush panels` / `totals control` / `legend legend` / `hint hint` / `notice notice`, no fixed heights |
| One column | Content under 760 px | `top` / `map` / `brush` / `panels` / `totals` / `control` / `legend` / `hint` / `notice` (the map is shown first, ahead of the panels, though it follows them in the markup; keyboard order stays picker, brush, map, which is acceptable because phones are touch-first) |

Panels column (children, in order): builder (only while building), picker, district detail, plan status, message slot.

## Space budget (workbench, 1280 × 720, 20 districts)

See research R4: 294 + 132 + 130 + 44 + 24 = 624 px of a 636 px column.

## State transitions

```text
no district selected ── pen ──▶ district N selected   (detail shows N; editing line shown in the detail)
district N selected  ── pen on N / Escape ──▶ none    (detail shows the prompt)
district N selected  ── pen on M ──▶ M selected       (detail shows M; nothing else moves)
any edit             ──▶ picker tiles, detail, plan status update in place
```
