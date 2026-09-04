# Brief: can Ann reach Fay in two hops?

Produce `scene.json` (kind `graph`) with six people — `Ann`, `Bob`, `Cat`,
`Dan`, `Eve`, `Fay` — and these friendships (undirected):
Ann–Bob, Ann–Cat, Bob–Dan, Cat–Eve, Eve–Fay, Dan–Fay.

Write the traversal **by hand as explicit ops** (do not use `algorithm`):
a breadth-first walk from Ann that stops as soon as Fay is found, with a
caption on every beat saying what is being checked and why. Label each person
with their hop count when discovered. End by painting the path that reached
Fay.

Success: `vlmkit-anim check scene.json` exits 0 with no ✗ and no ⚠; the
final frame shows the path Ann → … → Fay in the done colour, and no person
who was never reached is coloured as visited.
