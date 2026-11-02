# Deploys: the list of recent deploys

`page.html` lists recent deploys. When the page loads, the rows come in one
after another from the top: the first straight away, each next one 80ms after
the one above. Each row fades in while rising 12px into place over 300ms,
slowing at the end. No row is visible before its turn.

A reviewer says: "The bottom rows are just there immediately, and the top one
animates last. It looks like the cascade runs the wrong way, or not at all."

Fix it without changing how the list looks once it has settled. The viewport is
1280x800.
