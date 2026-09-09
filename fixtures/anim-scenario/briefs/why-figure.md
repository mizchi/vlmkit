# Brief: a figure too wide to read, brought back to one screen

`inputs/project-structure.json` is a `diagram` a repository's docs carried as
a mermaid graph: 32 nodes, 47 edges, five containers. Imported as it is, it
compiles to a canvas over 8000px wide — on a laptop screen it shrinks until
no label can be read — and `layout` finds lines through labels.

Make it a figure a reader can take in at one glance, and keep it the same
graph. Copy the input to `structure.json` and edit that. You may reword or
break labels (`\n`), change `layout`, regroup, nest, or flatten containers,
reorder lists, add a `title` — but every node and every edge in
`facts/project-structure-facts.expect.json` stays, and nothing is added.
Render it with `vlmkit-anim still structure.json --out structure.svg`.

Deliver `structure.json`, `structure.svg` and `log.md`.

Success: `vlmkit-anim check structure.json --expect facts/project-structure-facts.expect.json`
exits 0 with no ✗ and no ⚠ (so both canvas sides under 2000px), and
`vlmkit-anim layout structure.json` reports no issue. At most five rounds of
edit → check; stop at five whatever the state and say so.

Also record in `log.md`, per round: the exact `check` lines, what you decided
to change and *what told you* that was the thing to change (a `check` line, a
`why` line, a `layout` line, the picture, a guess) — quote it; whether the
change did what you expected, and by how much (the canvas size before and
after). At the end: what you would want the tool to have told you and did not.
