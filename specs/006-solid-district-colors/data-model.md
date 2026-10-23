# Data Model: Feature 006

No model changes. The new state belongs to the UI only.

## Map View State

| Field | Type | Meaning |
|-------|------|---------|
| `revealedDistrict` | `number \| null` | District whose counties currently show their own colors |
| `stickyReveal` | `boolean` | `true` when the reveal came from a touch tap |

## County Paint Rule

| County | Fill | Stroke |
|--------|------|--------|
| Not in a district | Own result color | White seam (CSS default) |
| In district *n*, *n* not revealed | District *n* result color | Same as fill (no seam) |
| In district *n*, *n* revealed | Own result color | White seam; `data-revealed="true"` |
