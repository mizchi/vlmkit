# Brief: evaluating a postfix expression with a stack

Produce `scene.json` (kind `stack`) that evaluates the postfix expression
`3 4 + 2 *` on a stack, one token per beat:

1. `3` → push it.
2. `4` → push it.
3. `+` → pop two operands, say which ones and in what order, push the
   result `7`.
4. `2` → push it.
5. `*` → pop two, push `14`.
6. Finish with a note: the single remaining value is the answer.

Every beat's caption should say what the token is and what the stack rule
does with it; the pops that feed an operator should each say which operand
they produce (the second pop is the LEFT operand — make the narration say so).

Success: `vlmkit-anim check scene.json` exits 0 with no ✗ and no ⚠; the final
frame holds exactly one value, `14`; `vlmkit-anim explain scene.json` reads
as a lesson on postfix evaluation.
