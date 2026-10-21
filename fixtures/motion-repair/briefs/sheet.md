# Share: the bottom sheet

`page.html` is a photo page with a share sheet. 200ms after load the white
sheet rises from below the bottom edge of the screen into place, snappily —
it should be fully up within about a quarter of a second (280ms), slowing as
it lands — and then stays.

A reviewer says: "The sheet crawls up. It feels broken, like it's lagging."

Fix it without changing where the sheet ends up. The viewport is 1280x800.
