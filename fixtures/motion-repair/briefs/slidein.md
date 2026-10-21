# Orders: the details panel

`page.html` is an order list with a white details panel docked to the right
edge of the screen. A quarter of a second after load the panel glides in from
beyond the right edge of the screen — from outside the window, moving
leftwards into place — over 320ms, fading in and slowing as it lands. Then it
stays docked on the right.

A reviewer says: "The panel comes from the wrong direction. It flies out of
the middle of the page towards the edge."

Fix it without changing where the panel ends up. The viewport is 1280x800.
