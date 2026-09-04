# Re-edit task (v8, vector): a stall in the middle

`vector-loader.scene.json` is a progress bar that fills to 50%, pauses,
then fills to 100%.

Change request from the author: **the pause should become a visible stall:
after "Half way", the bar creeps from 50% to 60% over 1.5 seconds while the
label reads "Stalled…", then the final fill goes from 60% to 100% in 400 ms
and the label says "100%".** Keep the bar anchored on its left edge (the bar
grows rightwards from x = 60, so its centre `x` is 60 + width / 2). Keep the
"Half way" beat exactly as it is.

Requirements: the label change and the bar motion of each beat start
together (use `"at": "<"` as the existing file does); the total duration
grows by exactly the stall's length; no node leaves the canvas.

Success: `vlmkit-anim check vector-loader.scene.json` exits 0 with no ✗ and
no ⚠; `explain` shows the beats Half way → Stalled… → 100%; at the end the
bar's `w` is 240 and its `x` is 180.

Write down, before your first `check`, the `x` and `w` you expect for the
60% state and the total duration you expect.
