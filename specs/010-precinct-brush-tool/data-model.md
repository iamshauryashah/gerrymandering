# Data Model: Precinct Building Blocks and Brush Selection Tool

Shapes are plain objects. Only changes from 009 are described in full; everything not listed keeps its 009 meaning with `county` renamed `precinct`.

## Precinct (replaces County)

| Field | Type | Meaning |
|-------|------|---------|
| `id` | string | `p001` to `p800`, three digits, in layout order |
| `index` | integer | Position in `state.precincts` (the order the generator made them) |
| `name` | string | Unique fictional name (research R11) |
| `polygon` | `[x, y][]` | Voronoi cell, clipped to the map rectangle (the state outline clips it when drawn) |
| `seedPoint` | `[x, y]` | The generator's seed, used for drawing shared edges |
| `center` | `[x, y]` | **New.** Centroid of the precinct's cells on the layout grid, one decimal; the point the brush tests |
| `area` | number | Area in square pixels from the layout grid |
| `neighbors` | string[] | Ids of precincts sharing a border (not just a corner), sorted |
| `sideAVoters`, `sideBVoters`, `totalVoters` | integers | Voters; the sides add up to the total |
| `densityIndex`, `density`, `type` | number, integer, `urban` / `suburban` / `rural` | As in 009 |

Rules: 500 to 800 precincts per state; precincts do not overlap and cover the state; each is one piece; the sum of `totalVoters` is `state.totalVoters` (baseline + city populations); denser precincts are smaller (the 009 size gate, re-tuned); `neighbors` is symmetric.

## State (changes only)

| Field | Change |
|-------|--------|
| `precincts`, `precinctsById` | Replace `counties`, `countiesById` |
| `assignments` | Maps precinct id to a district number or `null`, as before |
| `grid` | Still the 4 px grid used for badge placement (research R2) |
| `layoutKey`, `layoutData` | Custom states: `layoutData` keeps `points`, `totals`, `densityIndex` as before |
| `districts[n].precinctIds` | Replaces `countyIds`; `components` is still the connected parts, as before |

Reference plan: `referencePlan` maps each precinct id to a district number and proves a balanced, connected plan exists (unchanged idea).

## Brush (UI state, kept by the app)

| Field | Type | Default | Meaning |
|-------|------|---------|---------|
| `on` | boolean | `false` | Whether the brush is active. Turned off when no district is selected, on Escape (first press), and when a new state or link is opened |
| `size` | integer | `50` | Radius in map pixels, 10 to 150, step 5 |
| `mode` | `add` / `erase` | `add` | The chosen mode; Shift flips it for one stroke |

`size` and `mode` are remembered while the visitor keeps working on the same state, and reset when a new state is generated or a link is opened (FR-030). Switching from one district's pen to another keeps the brush on.

## Stroke (exists from pointer press to release)

| Field | Type | Meaning |
|-------|------|---------|
| `district` | integer | The selected district when the stroke began |
| `mode` | `add` / `erase` | The effective mode (the chosen mode, flipped when Shift was held at press) |
| `radius` | number | Brush radius in map pixels, fixed when the stroke starts |
| `before` | assignments | The plan at press, to build the summary at release |
| `covered` | Set of ids | The precincts whose centers were inside the circle at any point of the stroke |
| `lastPoint` | `[x, y]` | The previous processed pointer position, the start of the next segment |
| `skipReason` | Map id → reason | The last failed check for each precinct that did not change |

A click, tap or keyboard Enter is a stroke made of one segment with `a = b`.

## Stroke result (what the summary reports)

| Field | Meaning |
|-------|---------|
| `covered` | Number of precincts covered over the whole stroke |
| `added`, `moved`, `removed`, `unchanged`, `skipped` | Counts; the five add up to `covered` |
| `reasons` | Counts of skipped precincts by reason: `not-adjacent`, `splits-source`, `splits-selected` |
| `changed` | Ids whose district changed |
| `message` | The sentence shown to the visitor |

## Validation rules (from the spec)

- No stroke leaves any district with more than one connected part (FR-024, SC-004).
- A precinct belongs to at most one district at all times.
- Moving a precinct out of a district only when that district stays connected (FR-022); removing only when the selected district stays connected (FR-023); adding only when connected to the selected district or the first precinct of an empty one (FR-020, FR-021).
- The same stroke on the same plan gives the same plan (FR-024).

## State changes of the editor

```text
brush off ── press brush button ──▶ brush on  (needs a selected district)
brush on  ── Escape / button / deselect district / new state ──▶ brush off
brush on  ── pointer press ──▶ stroke (segments each frame) ── release / cancel ──▶ summary, brush stays on
brush on  ── Enter on focused precinct ──▶ one-segment stroke ──▶ summary
```
