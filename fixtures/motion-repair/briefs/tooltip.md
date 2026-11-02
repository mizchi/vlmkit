# Report: the Filter hint

`page.html` is a report page with a toolbar. Shortly after load (350ms) a dark
hint drops open under the "Filter" button and stays. It should unfold
downwards, the way a window blind is pulled down: its top edge, where it hangs
from the toolbar, never moves, and the rest of it extends down below that edge
over 240ms while it fades in, slowing as it settles.

A reviewer says: "The hint rises up out of nowhere instead of hanging from the
button. It looks like it's floating upward into place."

Fix it without changing where the hint ends up. The viewport is 1280x800.
