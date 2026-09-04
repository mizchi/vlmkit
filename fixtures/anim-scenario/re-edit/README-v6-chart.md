# Re-edit task (v6, chart): a third region and a corrected number

`chart-regions.scene.json` shows a week of error rates for two regions with
a Thursday incident in one of them.

Change request from the author: **add `eu-west` (`0.5, 0.6, 2.4, 0.7, 0.5`),
which had its own, worse incident on Wednesday, and tell that story after
the us-east one; then correct Thursday's us-east figure to `1.2` — the
post-mortem found part of that spike was a metrics bug — and say so.**

Requirements: every series ends up visible; the alert threshold is still
drawn once and before either incident is discussed; the Wednesday and
Thursday incidents each get a focused beat; the y axis must still fit the
new peak (do not hard-code `yMax` unless you have to — and if you do, say
why in your log).

Success: `vlmkit-anim check chart-regions.scene.json` exits 0 with no ✗ and
no ⚠; `explain` tells the story in the order above; the final frame shows
the us-east Thursday bar at 1.2.

Write down, before your first `check`, what you expect the y-axis top to be
after the edit.
