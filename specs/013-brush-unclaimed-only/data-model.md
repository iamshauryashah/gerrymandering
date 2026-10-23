# Data Model: Brush Only Takes Unclaimed Precincts

No stored data, no change to states, plans, URLs or computed numbers.

## Brush Settings (existing, extended)

| Field | Type | Default | Meaning |
|---|---|---|---|
| `on` | boolean | false | The brush is active (needs a selected district) |
| `size` | number | 50 | Circle radius (10 to 150, step 5) |
| `mode` | `add` \| `erase` | `add` | What a stroke does |
| `unclaimedOnly` | boolean | **false** (new) | When true, an add stroke takes only precincts that belong to no district |

Rules:
- `unclaimedOnly` is kept while the same state is shown, across selecting other districts, brush off and on, size and mode changes, and matchup changes.
- It resets to false when a new map is generated, a custom state is used, or a link is opened.
- It has no effect on single clicks with the brush off, and none in erase mode.

## Stroke (existing, extended)

| Field | Meaning |
|---|---|
| `district`, `mode`, `radius`, `before`, `covered`, `reasons` | unchanged |
| `unclaimedOnly` | **new**; copied from the setting when the stroke starts; true only if `mode` is `add` and the setting is on |

## Skip Reasons (existing, extended)

| Reason | When | Text |
|---|---|---|
| `not-adjacent` | an addable precinct does not touch the district | "not touching District N" |
| `splits-source` | moving it would split its district | "would split another district" |
| `splits-selected` | erasing it would split the selected district | "would split District N" |
| `claimed` (new) | `unclaimedOnly` is on and the precinct belongs to another district | "already in another district" |

A covered precinct is still exactly one of added, moved, removed, unchanged or skipped. With `unclaimedOnly` on, `moved` is always 0 and `removed` is always 0.

## Rules of the add pass with `unclaimedOnly`

For each covered precinct, in the existing fixed order, repeated until nothing changes:
1. Already in the selected district: unchanged (as before).
2. In another district: skip, reason `claimed`. Nothing else is checked.
3. Unclaimed: the existing checks apply (touches the selected district, or the district is empty and this is the nearest unclaimed one), then it is added.

## State transitions

- Settings: toggled by the checkbox or `setBrush({ unclaimedOnly })`; reset on new state.
- A stroke reads the setting once at its start; changing it afterward affects only the next stroke.
