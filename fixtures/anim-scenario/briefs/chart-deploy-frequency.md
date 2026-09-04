# Brief: deploys per week, three teams, one target

Produce `scene.json` (kind `chart`, bars) explaining a platform team's
quarterly review:

- Categories: `Q1`, `Q2`, `Q3`, `Q4`.
- Series: `payments` (8, 9, 12, 14), `search` (20, 24, 26, 30), `mobile`
  (3, 4, 4, 5) — deploys per week.
- The org target is **10 deploys per week**.

Story beats, in order: show `search` first as the team already there; then
`payments`, which crosses the target during the year; then `mobile`, which
never does. Draw the target line at the moment it becomes relevant. Focus on
`mobile` while the caption says what the review decided. Finally, show the
effect of that decision: `mobile`'s Q4 value is revised to 11 after a
pipeline fix shipped late in the quarter.

Success: `vlmkit-anim check scene.json` exits 0 with no ✗ and no ⚠, and
`vlmkit-anim explain scene.json` tells the story in the order above.
