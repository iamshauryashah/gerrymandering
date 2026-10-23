# Contract Changes: Feature 005

## Model API

- `generateState({ seed, countyCount?, districtCount? })` returns the fields in [data-model.md](../data-model.md), including `shapeFeatures`, `balanceRatio`, and `statewideShareA`.
- `BALANCE_RATIO` (0.10) replaces `BALANCE_LIMIT`.
- `getBalance(state)` returns `ratio` and `differencePercent`. It passes when `largest ≤ smallest × 1.10` and no district is empty.

## App API

- `createApp(root, { seed, confirm? })`: `confirm` defaults to `window.confirm`. Tests can inject it.
- `app.newMap()`: same as clicking the button. Returns `true` if a new map was loaded, `false` if it was canceled.

## UI

- `button[data-role="new-map"]`:
  - Text "New map", in the toolbar next to the matchup toggle.
  - Keyboard operable.
- After a new map:
  - the address has `?seed=<new seed>`
  - the caption link matches the new seed
  - districts are empty
  - editing is off
  - the edit message is hidden
  - the matchup is unchanged
- Plan check:
  - `dd[data-key="difference"]` shows "N voters (P%)".
  - `dd[data-key="limit"]` shows "10%".
  - The failure text says "must be within 10%".
- Page hint text describes the 10% rule.
