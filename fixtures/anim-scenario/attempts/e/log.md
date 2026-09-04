# Log — heap-priority-queue attempt

## Round 1 (first attempt, straight from guide)

scene.json written directly from `docs/anim-ir.md`'s "kind: heap" section:
`format: vlmkit-anim/scene@1`, `kind: heap`, `type: min`, `ops` list with
five `{"push": n}`, one `{"note": "..."}` before the first pop, then two
`{"pop": true}`. Title set per brief requirement.

```
$ node --experimental-strip-types src/cli/vlmkit.ts anim check fixtures/anim-scenario/attempts/e/scene.json
✓ scene.json (heap): 0 error(s), 0 warning(s)
  9790ms · 20 steps (20 captioned) · 16 nodes · 24 tracks / 93 keyframes
  scene 257 B → timeline 8264 B (×32.2)
  next: vlmkit anim explain ... · vlmkit anim render ... --step N · vlmkit anim html ... --out page.html
EXIT:0
```

Clean on the first try — no ✗, no ⚠. 9790ms is under the brief's 20s cap.
No changes needed. Confirmed via `explain` that the pop order is 1 then 4
(step 13: "pop: the root 1 comes out", step 17: "pop: the root 4 comes out";
final step: "Done. Heap: 7, 8, 9; popped 1, 4"), matching the brief's success
criterion exactly.

No round 2/3/4 needed — budget not spent, stopping here since check passed
clean on round 1 and the success criterion (pop order 1, 4) is verified via
`explain` and rendered frames.
