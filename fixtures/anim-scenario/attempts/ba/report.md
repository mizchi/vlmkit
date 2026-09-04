# Attempt ba — stack-postfix (haiku)

First attempt: 0 ✗, 0 ⚠. Rounds: 1. Scene 626 B → 6932 B compiled (×11.1); 12 steps, 7590 ms.

Success criteria met: `check` exits 0; the final frame holds exactly one value, 14 (only v-4 visible); `explain` reads as a lesson. Key lines: "Token +: pop right operand = 4" → "Pop left operand = 3 (second pop is left)" → "Compute 3 + 4 = 7, push result" → "Compute 7 * 2 = 14, push result" → "Stack: 14 · removed 4, 3, 2, 7".

What helped: the `kind: stack` schema and the bracket-matching example directly modelled the pattern; the caption override gave exact narrative control.

Confusing: the guide states "every op is its own beat by default"; the brief's "one token per beat" initially suggested the tool might collapse several ops into one step. Wanted: "When a single token requires multiple operations (an operator popping two values), write multiple ops with clarifying captions — the tool renders them as distinct steps, and narration can tie them to one conceptual action."

Guesses (right): multiple `pop` ops per operator render sequentially with their own captions; the second pop's caption says "left operand"; the computation is described on the `push`.
