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
