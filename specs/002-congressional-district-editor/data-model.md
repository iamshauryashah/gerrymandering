# Data Model: Congressional District Editor

## GeneratedState

| Field | Description | Rules |
|---|---|---|
| `seed` | Seed used to generate the state | Shown or reproducible through `?seed=` |
| `name` | Fictional state display name | Optional; the page title remains the main heading |
| `outline` | State boundary polygon | One connected region |
| `counties` | Generated counties | 20–60 items |
| `districts` | Congressional districts | 8–20 items |
| `assignments` | Map of county ID to district number | Every county appears exactly once |

The geography, voters, district count, and initial assignments are created once per page load.

## County

| Field | Description | Rules |
|---|---|---|
| `id` | Stable identifier | Unique within the state |
| `name` | Fictional county name | Unique within the state |
| `polygon` | Unclipped county shape | Displayed within the state outline |
| `seedPoint` | Generated point inside the county | Inside the state outline |
| `area` | Visible sampled area | Greater than 400 square pixels in the 800 × 600 px full-size map coordinate space |
| `neighbors` | Adjacent county IDs | Symmetric and excludes itself |
| `sideAVoters`, `sideBVoters` | Whole-number vote counts | Non-negative integers |
| `totalVoters` | Total votes | Equals `sideAVoters + sideBVoters` and is greater than 0 |

County vote counts are known final votes for every voter, are generated with the map, and determine the county's fill color.

## Matchup

| Field | Description |
|---|---|
| `id` | `dem-rep`, `soc-lib`, or `purple-orange` |
| `label` | Display label shown in the toggle |
| `sideA`, `sideB` | Side names and colors |

Order: Democrats vs Republicans → Socialists vs Libertarians → Purple vs Orange → Democrats vs Republicans.

## CongressionalDistrict (derived)

| Field | Description | Rules |
|---|---|---|
| `number` | District number | Consecutive from 1 |
| `countyIds` | Assigned counties | May be empty after editing |
| `sideAVoters`, `sideBVoters`, `totalVoters` | Combined county votes | Sums of assigned counties |
| `status` | `sideA`, `sideB`, `tie`, or `empty` | `empty` only when no counties are assigned |
| `marginPercent` | Lead percentage-point margin | 0 for a tie or empty district |
| `components` | Connected groups of assigned counties | Uses county neighbors |
| `labelPoint` | Point for the district number badge | Inside the largest component; absent if empty |

## EditingSelection

| Field | Description |
|---|---|
| `districtNumber` | Selected district, or `null` when editing is off |

Transitions:

- Off → district N: activate district N's pen button.
- District N → district M: activate district M's pen button.
- District N → off: activate district N's pen button again or press Escape.
- District N → district N with county moved: click a county outside district N.

## ControlTotal (derived)

| Field | Description |
|---|---|
| `sideA` | Number of districts led by Side A |
| `sideB` | Number of districts led by Side B |
| `tied` | Number of tied districts |
| `empty` | Number of empty districts |

The four values always sum to the number of districts.
