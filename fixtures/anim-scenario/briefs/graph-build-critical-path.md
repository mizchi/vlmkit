# Brief: the fastest build order

Produce `scene.json` (kind `graph`) for a **directed** package dependency
graph, laid out left to right, where each edge weight is the minutes the
downstream build waits on the upstream one:

`core → utils` (2), `core → api` (5), `utils → api` (1), `utils → web` (4),
`api → web` (2), `api → cli` (3).

Explain, with Dijkstra from `core`, how long each package waits before it
can start, and end by showing the path that determines when `web` can build.
Pin `core` at the left edge and `web` at the right edge; let the rest be laid
out automatically. Caption at least the two beats where a shorter route
replaces a longer one.

Success: `vlmkit-anim check scene.json` exits 0 with no ✗ and no ⚠; the last
captioned beat names the path to `web` and its total.
