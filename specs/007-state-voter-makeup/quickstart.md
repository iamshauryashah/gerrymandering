# Quickstart: Feature 007

## Prerequisites

- A static server at the repository root, for example `python3 -m http.server 8000`.
- A browser with the cache disabled.

## Automated

Open `http://localhost:8000/tests/`. Expect the title `PASS: N passed, 0 failed`, including the new formatter and block tests and every earlier test.

## Manual

1. Open `http://localhost:8000/?seed=demo-1`.
2. **Block content** (US1): In the side panel, above "District control", find "Statewide voters":
   - the total voters, with thousands separators;
   - each side's name, percentage, and voter count;
   - a bar split in the two side colors, with a mark at the halfway point;
   - a summary such as "Democrats lead statewide · Democrats +0.4 pts".
3. **Check the math**: The two percentages add up to 100.0%, and the two voter counts add up to the total.
4. **Matchup** (US2): Click the matchup toggle. Names and colors change; every number stays the same.
5. **Edits** (US2): From the console, load the reference plan: `gerryApp.setAssignments(gerryApp.state.referencePlan)`. Then turn on editing for a district and add or remove counties. The stat block does not change.
6. **New map** (US2): Click **New map**. The block shows the new state's totals. Reload `?seed=demo-1`: the original numbers return.
7. **Side by side** (US3): At 1366 px wide, the stat block and "District control" are both visible without scrolling between them. At 320 px they stack with the stat block directly above the control block, and there is no horizontal scrolling.
8. **Accessibility**: With a screen reader or the accessibility tree, the total, both voter counts, both percentages, and the summary are available as text, and the bar has a text label.

## Expected outcomes

| Check | Expect |
|-------|--------|
| Side totals | Equal the sum over all counties, assigned or not |
| Percentages | Add up to exactly 100.0% |
| Matchup change | Names and colors change; numbers do not |
| District edits | Block unchanged |
| New map | Block shows the new totals within 1 s |

See the [data model](./data-model.md) for the rounding rule and the [contract](./contracts/changes.md) for the markup.

## Results

- Full browser suite: **58 passed, 0 failed**, up from a baseline of 49. The 9 new tests cover the statewide sums, the 100.0% rounding rule, the leader, tie, and bar label, matchup changes, district edits, new map and reloaded seed, and the layout.
- Numbers: the displayed total and each side's voters equal the sums over every county and `state.totalVoters`, for `demo-1`, `demo-2`, and 20 more seeds. The two percentages add up to exactly 100.0% for every tested split, including 50.04/49.96 and 99.95/0.05.
- Matchup: all three matchups change only the side names and colors; every figure, the bar widths, and the margin stay the same.
- Edits: adding, moving, removing, and clearing districts leave the block's HTML identical. A new map updates it well inside 1 s, and reloading `demo-1` brings back the original block.
- Layout, measured on fresh loads at 1920, 1366, and 320 px wide:
  - 1366 px and wider: the block is 260 px wide in the side column, 16 px above "District control", with no horizontal scrolling and every row fitting.
  - 320 px: the block is 300 px wide, directly above "District control", with no horizontal scrolling, and both side names stay on one line.
  - A 7-digit voter count fits at both 260 px and 320 px.
- Visual check: in the browser, the block shows the total, the summary ("Democrats lead statewide · Democrats +1.8 pts" for `demo-1`), a two-color bar with a halfway mark, and one two-line group per side.
- Accessibility: the section is labelled by its heading and is a polite live region; the figures and summary are text; the bar has a text label ("Democrats 50.9%, Republicans 49.1%"); the swatches are hidden from assistive technology.
