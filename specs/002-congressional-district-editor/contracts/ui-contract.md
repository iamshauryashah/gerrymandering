# UI Contract

## Page order

1. Main heading: "Gerrymandering like Gerry the Salamander"
2. Matchup toggle showing the active matchup
3. Map area with the generated state, county shapes, district borders, district numbers, legend, and control total beside it
4. Congressional district list below the map
5. Fictional-data notice

## Matchup toggle

- Starts at "Democrats vs Republicans".
- Each activation advances to "Socialists vs Libertarians", "Purple vs Orange", then back to the start.
- Changes labels and colors only; voters, counties, and assignments stay the same.

## Map

- Each county is a focusable map control with an accessible name containing the county name and district number.
- County fill always uses the county's own generated voter result and never changes when the county is reassigned.
- District boundaries show grouping. Each non-empty district has a number badge colored by the district's combined voter result.
- With editing off, hover/focus shows county details and the county's district details.
- With editing on, the county under the pointer or focus is highlighted. Click, Enter, or Space assigns it to the selected district.
- Non-empty districts show their number badge on the largest connected part.

## District list

- Shows every district in number order with its color swatch, number, leading side or status, and pen button.
- Hover/focus on a district entry shows district details.
- Pen button accessible name: "Edit district N"; pressed state reflects whether district N is selected.
- Only one pen button can be pressed at once.

## Editing mode

- Activating a district's pen button selects it.
- The map and list visibly identify the selected district and show a message such as "Editing District N: click counties to add them."
- Activating the selected pen button again or pressing Escape exits editing mode.

## Details and control total

- Tooltips stay fully visible within the viewport and hide when the pointer leaves the related element or focus moves away.
- District details include number, county count, county names, total voters, each side's count and percentage, leading side or tie/empty status, and margin.
- The control total shows active side names and colors, plus tied and empty district counts. Its counts update after every reassignment.
