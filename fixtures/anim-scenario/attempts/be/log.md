# be — vector-loader re-edit log

## Prediction (before first check)

Track is 240 wide starting at x=60 (left edge), so bar centre x = 60 + w/2.

- 50% (unchanged "Half way" beat): w=120, x=120 — matches file already.
- 60% (end of the new stall creep): w = 240*0.6 = 144, x = 60 + 144/2 = **132**.
- 100% (end): w=240, x=180 (matches README's stated success value).

Timeline duration math:
- Half way bar: duration 800 (t=0→800)
- pct "50%": duration 0, at "<" (same start as Half way)
- stall bar 50%→60%: duration 1500, after previous → starts 800, ends 2300
- pct "Stalled…": duration 0, at "<" (starts 800, together with stall bar)
- final bar 60%→100%: duration 400, after previous → starts 2300, ends 2700
- pct "100%": duration 0, at "<" (starts 2300)

**Predicted total duration: 2700ms.**
End of stall (bar reaches 60%, right before final fill starts): **t=2300**.

Note: README says duration "grows by exactly the stall's length". Original
total was 800+400(wait)+600(Done)=1800. My computed new total 2700 is a
growth of 900ms, not the stall's own 1500ms — because the final fill also
got shorter (600→400). Flagging this now to check against actual behavior.

## Round 1 (only round needed)

`check`:
```
✓ vector-loader.scene.json (vector): 0 error(s), 0 warning(s)
  2700ms · 3 steps (3 captioned) · 3 nodes · 3 tracks / 11 keyframes
  scene 882 B → timeline 1146 B (×1.3)
```
0 ✗, 0 ⚠ on the first attempt. Green immediately, no fix round needed.

`explain`:
```
A loading indicator — 3 steps, 2700ms, 3 nodes
 1. [    0ms] Half way
 2. [  800ms] Stalled…
 3. [ 2300ms] 100%
```

`render --at 2300` (end of stall): bar `translate(132 80)` rect `width="144"`
→ x=132, w=144. Matches prediction exactly.

`render --at end` (t=2700): bar `translate(180 80)` rect `width="240"`
→ x=180, w=240. Matches README's stated success values exactly.

Total duration actual: 2700ms — matches prediction exactly.

All predictions (x=132/w=144 at 60%, x=180/w=240 at end, 2700ms total)
were confirmed on the first attempt.
