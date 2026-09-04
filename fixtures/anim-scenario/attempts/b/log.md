# Log — state-tcp-teardown, attempt b

## Round 1

Wrote scene.json straight from docs/anim-ir.md's `kind: state-machine` section
and the `vlmkit anim schema --kind state-machine` output, without running the
checker first (per instructions). Modelled TCP active-close teardown per the
brief: ESTABLISHED -> FIN_WAIT_1 -> FIN_WAIT_2 -> TIME_WAIT -> CLOSED as the
main trace, plus FIN_WAIT_1 -> CLOSING -> TIME_WAIT as the untraced
simultaneous-close branch. `note` on every transition per the brief's
requirement.

`check` output:
```
✓ scene.json (state-machine): 0 error(s), 0 warning(s)
  4830ms · 6 steps (6 captioned) · 21 nodes · 10 tracks / 33 keyframes
  scene 733 B → timeline 5455 B (×7.4)
  next: vlmkit anim explain fixtures/anim-scenario/attempts/b/scene.json · vlmkit anim render fixtures/anim-scenario/attempts/b/scene.json --step N · vlmkit anim html fixtures/anim-scenario/attempts/b/scene.json --out page.html
```
Exit code: 0. No errors, no warnings. No round 2 was needed — attempt is clean
on the first try.
