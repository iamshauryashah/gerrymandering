# Contract Changes: Dense County Map With Contiguous, Balanced Districts

## Model API

- `generateState({ seed, countyCount?, districtCount? })`: `countyCount` must be 90–120.
- `getEditAction(state, countyId, selected)` adds `allowed` and `reason` (see [data-model.md](../data-model.md)).
- `applyCountyEdit(state, countyId, selected)` returns `{ state, edit }`; when `edit.allowed` is false, `state` is unchanged.
- `isContiguous(state, countyIds)` returns true for zero or one county, or when all are connected by shared borders.
- `getBalance(state)` returns the balance check.
- `getPlanStatus(state)` returns the plan status.

## UI

- `data-role="edit-message"` (role `alert`) shows a blocked-edit explanation and is hidden after the next applied edit or when editing stops.
  - `not-adjacent`: "District N must stay connected. Pick a county that touches it."
  - `split-source`: "Can't take <County>: it would split District M into pieces."
  - `split-selected`: "Can't remove <County>: it would split District N into pieces."
- `data-role="plan-status"` shows the balance check (pass/fail, largest, smallest, difference, limit, ideal size), unassigned counties, and overall status ("Valid plan" or what is missing).
- Each district row includes `.district-balance` with "Empty", "Within range", "Too large +N", or "Too small −N".
- County details show "Type" and "Density" rows.
