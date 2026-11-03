# Settings: the filters drawer

`page.html` has a Filters button in the header. A click slides a dark drawer
in from the right edge over 180ms, slowing as it arrives, and another click
slides it back out the same way. The page's timings and easings come from its
design tokens at the top of the stylesheet.

A reviewer says: "The drawer just appears and disappears. It doesn't slide."

Fix it without changing the drawer's look or where it rests. The viewport is
1280x800.
