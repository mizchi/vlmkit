# Brief: interactive map — "Wayfarer Maps"

- **Directory**: `examples/sites/maps/`
- **Pattern**: interactive app — a pannable, zoomable map with search and a place panel
- **Language**: English
- **Implementation**: MoonBit with `mizchi/luna`. Read [`../LUNA.md`](../LUNA.md) first.

## What it is

**Wayfarer Maps**, a fictional map of a fictional harbour city, "Port Lumen". There are no tiles
from anywhere and no network. The map is an **SVG drawn by the program from seeded data**:

- coastline and water, a river with two bridges, parks;
- about 30 streets as polylines with names, three avenues with route-number shields, and a
  railway line with 5 stations;
- building blocks as fills;
- about 40 places, each with a category icon (cafés, restaurants, hotels, museums, parks, transit).

One page, `index.html`. The URL holds the view, `?at=<x>,<y>,<zoom>`, and `&place=<id>` when a
place is selected. Changes update it with `history.replaceState`.

## Reference study

The pattern is the big map apps. Measured at 1280×800:

- The map fills the viewport, with a pale grey 72px strip on the left (the collapsed app rail).
- A floating search card at the top left: about 370×46, white, fully rounded, a shadow, with a
  search icon and a directions icon at its right end.
- Searching opens a side panel about 420px wide under the search card, with its right corners
  rounded:
  - filter chips (Price, Rating, Hours, All filters);
  - the heading "Results", with a Share link;
  - result rows, each with a bold name, "4.8" and stars, "Coffee shop · area · address",
    "Closed · Opens 11 AM Sun" in red and grey, and an 84px rounded photo on the right;
  - a checkbox at the panel's foot: "Update results when map moves".
- A tab on the panel's right edge collapses it.

## Layout and behaviour

- **Map**:
  - Drag to pan, with pointer events.
  - The wheel zooms around the pointer. Double-click zooms in.
  - The +/− buttons zoom around the centre. Zoom runs over 6 levels; labels and minor streets
    appear by level, and street names show from level 3.
  - Keyboard while the map has focus: the arrows pan 100px, + and − zoom, and Home resets the view.
  - The map is a focusable region labelled "Map of Port Lumen", with instructions as its
    description.
  - Pan and zoom ease over 200ms, and reduced motion makes them instant.
  - A scale bar at the bottom right tracks the zoom.
- **Markers**:
  - Places are pins in their category colour, with the icon inside. Each pin is also a real
    `<button>` with the place's name.
  - Hovering or focusing a pin shows a small label card. Clicking it selects the place: the pin
    grows, the panel shows the place, and the map eases to it.
  - Pins that would overlap at low zoom are merged into one numbered cluster circle. Clicking the
    cluster zooms in.
- **Search box**: a combobox with the label "Search Wayfarer Maps".
  - Typing suggests places and categories ("Coffee near Harbour Quarter"). Enter shows the results
    list.
  - When the box is empty, focusing it shows "Recent" searches.
  - × clears the box, and the directions icon opens Directions.
- **Category chips** under the search box: Restaurants, Coffee, Hotels, Museums, Parks, Transit.
  Each is a toggle. It filters the pins and opens the results list for that category.
- **Side panel**:
  - Results list: rows as in the reference study. Hovering a row highlights its pin, and clicking
    the row selects the place.
  - Place view:
    - a header image drawn in SVG, the name, "4.6 ★★★★★ (812)", the category and a price level;
    - a row of round actions: Directions, Save (a toggle), Nearby, Share (opens a dialog with a
      link), Send to phone;
    - tabs: Overview / Reviews / About;
    - Overview shows the address, opening hours in a table (today in bold, "Open · Closes 10 PM"
      from a fixed "now" of Tue 14:30) and a website link;
    - Reviews shows 5 seeded reviews, with a "Sort" menu.
  - A Back arrow returns to the results. A collapse tab hides the panel.
  - "Update results when map moves" filters the list to the visible area when it is ticked.
- **Directions**:
  - Two fields, From and To, plus a swap button.
  - Mode tabs (Drive, Transit, Walk, Cycle) with fixed durations.
  - Choosing two places draws a route polyline along the streets: a precomputed path for 3 seeded
    pairs, and a straight dashed line otherwise, labelled "Approximate".
  - Steps listed below.
- **Layers**: a button at the bottom left with a thumbnail. Its popover offers Default / Transit
  (thicker rail and station labels) / Terrain (park and water tint).
- **Phones**: the panel becomes a bottom sheet with three snap heights: peek, which shows the place
  name; half; and full. It is dragged by its handle, and the handle is also a button that cycles
  the heights. Search and chips stay on top. Pins and the +/− buttons stay at least 44px.

## Visual direction

The map is light and muted, with the information on top. Use the palette of a real street map:
pale blue water, soft green parks, white streets with grey casings, and yellow for the avenues.
Labels need a halo so they stay legible. The UI floats in white cards with soft shadows, and one
accent colour marks the selected place.

## Required copy

```
Wayfarer Maps
Search Wayfarer Maps
Port Lumen
Results
Directions
Update results when map moves
Open
Closed
```

## States to show (final round)

- The default view at desktop and mobile sizes.
- Zoomed in to street names.
- A pin's hover label.
- The Coffee chip on, with its results list.
- A place selected: Overview, then Reviews.
- Directions with a drawn route.
- The layers popover, set to Transit.
- The panel collapsed.
- The mobile bottom sheet at peek, half and full.
- A numbered cluster at low zoom.

## Gates this brief leans on

- `scan handlers --probe-drag`: the pan and sheet drags are really wired.
- `check interactions`: the combobox, tabs, popover, dialog and the map's keyboard.
- `check grounding`: can a pixel-driven agent click a pin?
- `check a11y focus`, `check a11y touch` (pins and controls) and `check a11y contrast` (labels on
  the map).
- `check motion` / `check animation`: the easing, reduced motion.
- `check mobile`: the sheet, touch.
- `check scroll` / `scan scroll`: the panel scroller.
- `check design`.
