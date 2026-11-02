# Report: the Share panel

`page.html` is a report page with a Share button in its header. Clicking
Share opens a small panel under the button: it fades in while dropping 8px
into place, over 200ms, slowing at the end. Clicking Share again closes it:
it fades out the same way, over the same 200ms, and is then gone.

A reviewer says: "Closing is smooth, but the panel just pops open. There's no
fade at all when it appears."

Fix it without changing how the panel looks once it is open, or where it is.
The viewport is 1280x800.
