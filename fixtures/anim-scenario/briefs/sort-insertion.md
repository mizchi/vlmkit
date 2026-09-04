# Brief: insertion sort, explained

Produce `scene.json` that explains **insertion sort** on the values
`[7, 2, 9, 4, 1]` to someone who has never seen it.

Requirements:
- Every value must end in sorted order (the checker reads the final frame).
- The narration must say, at least once, that the left part is the "sorted run"
  (or equivalent) and why an element stops where it stops.
- Keep the whole thing under 15 seconds of playback.

Success: `vlmkit anim check scene.json` exits 0 with no ✗ lines, and
`vlmkit anim explain scene.json` reads as a coherent explanation.
