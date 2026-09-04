# Report — state-tcp-teardown, attempt b

**1. First-attempt check result:** exit 0, clean — `0 error(s), 0 warning(s)`.
No ✗/⚠ lines at all.

**2. Rounds used:** 1 of 4. Round 1 (only round): wrote scene.json from the
guide's `kind: state-machine` section + `schema --kind state-machine`;
checker passed immediately, no edits needed.

**3. Final stats:** `4830ms · 6 steps (6 captioned) · 21 nodes · 10 tracks /
33 keyframes`, `scene 733 B → timeline 5455 B (×7.4)`. Brief's success
criterion met: `explain` confirms all four events fire in order (close, ACK,
FIN, timeout), ending in final state CLOSED.

**4. What helped:** the state-machine table row `"transitions" | required:
{"from","to","on","note"}; one per (from, on)` — this told me directly that
FIN_WAIT_1 could have two outgoing transitions (on ACK, on FIN) without
conflict, which is exactly the simultaneous-close branch the brief asks for.
The `trace` row's promise that "the validator lists the legal ones when it is
not" gave confidence to write the trace without pre-checking transitions by
hand.

**5. Missing/ambiguous:** nothing blocked me, but the guide is silent on two
things I had to guess: (a) whether a state/transition that the `trace` never
visits (CLOSING, and its two edges) is idiomatic or would warn — it neither
warns nor errors, so "a hidden node that is never shown" warning listed in
the loop section doesn't cover "a state built but never reached by the
trace," and I only learned that by getting 0 warnings back; (b) layout
control for branching paths — `diagram` kind lets you pin `pos`, but
`state-machine` only offers `lr|tb|circle`, so I had no lever if the
auto-layout had put CLOSING somewhere confusing (it happened to look fine).

**6. Judgement:** yes, for the traced path — the rendered frames clearly show
ESTABLISHED→FIN_WAIT_1→FIN_WAIT_2→TIME_WAIT→CLOSED with the sent
segment/action on each arrow and the active state highlighted orange. The gap
is the CLOSING branch: it's drawn (satisfying "show" literally) but never
animated or highlighted, since the trace never fires FIN from FIN_WAIT_1. A
newcomer sees a static, unexplained alternate box. If the format allowed a
second `trace` (or a `traces: [[...], [...]]`) I'd add a short simultaneous-
close run so CLOSING actually lights up once, rather than sitting inert.
