# Data Model Changes: Dense County Map With Contiguous, Balanced Districts

Builds on [003 data-model.md](../003-unassigned-county-districts/data-model.md).

## County (new fields)

- `type`: `'urban' | 'suburban' | 'rural'`
- `density`: voters per square mile (1 map px = 0.5 mi, so area in sq mi = px² × 0.25)
- `densityIndex`: relative density used for type and voting pattern (internal)

## State (new fields)

- `balanceLimit`: 10,000
- `idealDistrictVoters`: total state voters ÷ district count
- `referencePlan`: hidden assignment map proving a valid plan exists (tests only; never shown)

## Edit Action (extended)

`{ action, from, to, allowed, reason }`. `reason` is one of:

- `not-adjacent`: the selected district has counties and the clicked county touches none of them
- `split-source`: taking the county would split its current district
- `split-selected`: removing the county would split the selected district

## Balance Check

`{ pass, limit, largest, smallest, difference, empty, ideal, districts: [{ number, balance }] }`, where `balance` is `'empty' | 'over' | 'under' | 'ok'` relative to `ideal ± limit/2`.

## Plan Status

`{ valid, complete, unassigned, contiguous, balanced }`. A plan is valid only when it is complete, contiguous, and balanced.
