# Data Model Changes: Unassigned Counties and Blank Districts

Builds on [002 data-model.md](../002-congressional-district-editor/data-model.md).

## District Assignment

- `state.assignments`: map of county ID → district number **or `null`**.
- Every county ID is present as a key; `null` means the county has no district.
- New states have every value set to `null`.

## District Summary

- Unchanged fields: `number`, `countyIds`, `sideAVoters`, `sideBVoters`, `totalVoters`, `status`, `marginPercent`, `components`, `labelPoint`, `labelRoom`.
- Every district starts with `status: 'empty'` and no `labelPoint`.
- Unassigned counties are excluded from every district.

## Edit Action

Result of clicking a county while district `S` is selected:

| County's current district | Action   | New value |
|---------------------------|----------|-----------|
| `null`                    | `add`    | `S`       |
| another district `D`      | `move`   | `S`       |
| `S`                       | `remove` | `null`    |

## Control Total

`{ sideA, sideB, tied, empty, unassigned }`. `unassigned` is the number of counties whose assignment is `null`.
