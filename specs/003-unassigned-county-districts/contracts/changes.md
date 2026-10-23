# Contract Changes: Unassigned Counties and Blank Districts

Changes to [002 model-api.md](../../002-congressional-district-editor/contracts/model-api.md) and [002 ui-contract.md](../../002-congressional-district-editor/contracts/ui-contract.md).

## Model API

- `generateState({ seed })` returns `assignments` with every county set to `null` and every district empty.
- `reassignCounty(state, countyId, districtNumber | null)` sets or clears a county's district. Returns the same state object when nothing changes.
- `getEditAction(state, countyId, selectedDistrict)` returns `{ action: 'add' | 'move' | 'remove', from, to }`.
- `applyCountyEdit(state, countyId, selectedDistrict)` returns `{ state, edit }` and applies the action above.
- `countUnassigned(state)` returns the number of counties with no district.

## UI

- Unassigned counties have the `unassigned` class, an overlay in `data-role="unassigned"`, and the accessible name `"<County name>, No district"`.
- County details for an unassigned county show a second section titled "No district".
- The editing status reads `Editing District N: click counties to add or remove them.`
- The control total includes a row with `data-key="unassigned"` labeled "Unassigned counties".
- Removing the last county from a district makes it empty: no border, no badge, and it counts as empty.
