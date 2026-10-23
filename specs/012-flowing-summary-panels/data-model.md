# Data Model: Flowing Summary Panels

No stored data and no change to state, plans, URLs or any computed number. This feature adds one piece of view state, derived entirely from the layout.

## Summary Block

One of three existing page sections, in a fixed order.

| Field | Meaning |
|---|---|
| `key` | `totals` (Statewide Voters, `data-role="state-totals"`), `control` (District Control, `data-role="control-total"`), `legend` (Legend, `data-role="legend"`) |
| `order` | 0, 1, 2 in that order, never changes |
| `place` | `column` (docked, last children of the right-hand column) or `below` (before the help text in the layout) |

Rules:
- Each block exists once in the page at all times (FR-004).
- A block is never clipped, squeezed or given an inner scroll bar (FR-002).
- Its content and its renderer are unchanged; only its place and its spacing differ.

## Placement

The set of blocks whose `place` is `column`, always a prefix of the order.

| Field | Meaning |
|---|---|
| `docked` | Integer 0 to 3: blocks `0 .. docked-1` are in the column, the rest are below |
| `mode` | `column`, `beside` or `none`, read from the layout's `--dock` value |

Rules:
- `docked` is the largest count (0 to 3) for which the open room test passes (R1, R2); it is 0 when `mode` is `none`, in build mode, or when the layout has no box (error state).
- Placement is a function of the current layout only: the same window, state and content always give the same `docked`, with no memory of earlier values.
- `docked` is published as `data-docked` on the layout element so the grid can drop the rows of blocks that moved up.

## Open Room Test

| Mode | Fits when |
|---|---|
| `column` | the column's `scrollHeight` is at most its `clientHeight` plus 1 px |
| `beside` | the column's height is at most the map cell's height plus the gap plus the brush bar's height |
| `none` | never (nothing is docked) |

## State transitions

`docked` can change when: the window or zoom changes, a new state or a different district count is shown, the Plan check text changes length, a block's content grows or shrinks, build mode opens or closes, or an error replaces the map. Every change is applied before the next paint. A change never touches the map, the selection, the brush or an edit in progress.
