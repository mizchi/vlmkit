# Attempt be — re-edit vector-loader (sonnet)

First attempt: 0 ✗ / 0 ⚠. Green in round 1.

Success criteria met: `explain` shows Half way (0 ms) → Stalled… (800 ms) → 100% (2300 ms), 2700 ms total; bar at the end of the stall translate(132 80) width 144; at the end translate(180 80) width 240 — the README's values exactly.

Prediction vs actual: x = 132 / w = 144 at 60% (centre = 60 + w/2), x = 180 / w = 240 at the end, total 2700 ms — all three exact.

What made intent readable: "Shapes are centred on `pos`" answered whether x is the centre; "`at`: omitted = after the previous item; `<` = together with the previous" was clear; the existing `pct` beats demonstrated the pattern.

Ambiguous / missing: how a bare `{"wait": ms}` interacts with `at: "<"` on a neighbouring tween — "can a tween's `<` start together with a preceding wait, or only with a preceding tween?" Wanted: "'at': '<' means: start at the same time the immediately preceding array entry started, whether that entry is a tween or a wait." Also only inferable: a caption-less, duration 0, `at: "<"` beat gets no numbered row in `explain`. No diagnostic fired.
