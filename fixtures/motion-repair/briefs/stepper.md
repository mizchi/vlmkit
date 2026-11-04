# Mail: the side panel

`page.html` is a mail app with a dark side panel on the left. When the page
loads, the panel glides in from beyond the left edge and fades in over 600ms,
in one smooth movement that slows as it arrives. At rest it sits flush with
the left edge of the window.

The panel uses the app's shared entrance keyframes, which other panels use
too.

A reviewer says: "The panel doesn't glide, it judders in, in a few hops."

Fix it without changing how far it travels, how long it takes or how it looks
at rest. The viewport is 1280x800.
