# Brief: why a priority queue pops the smallest first

Produce `scene.json` (kind `heap`, min-heap) that explains how a priority
queue built on a binary heap works: push 9, 4, 7, 1, 8, then pop twice.

Requirements:
- A short title.
- Add a note (a captioned pause) before the first pop that says what the
  reader should watch for (the root is always the minimum).
- Playback under 20 seconds.

Success: `vlmkit-anim check scene.json` exits 0; the pops come out as 1 then 4.
