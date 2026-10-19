# Editor: the Insert popover

`page.html` is a document editor with an "+ Insert" button at the bottom-left
of the screen, captured with its popover open. 300ms after load the popover
grows out of the button: it scales from 60% to full size and fades in over
260ms, easing out, and it must grow FROM ITS BOTTOM-LEFT CORNER — the corner
nearest the button — so it looks like it comes out of the button. Then it stays
open, just above the button.

A reviewer says: "It opens from the wrong place — it seems to fly in from the
middle of the page instead of coming out of the button."

Fix it without changing where the popover sits once open. The viewport is
1280x800.
