# Stack Contents Expected After Each Token

## Initial understanding from guide + brief

The postfix expression is: `3 4 + 2 *`

Expected stack state after each operation:

1. **Token 3 (push 3)**: Stack = [3]
2. **Token 4 (push 4)**: Stack = [3, 4] (4 on top)
3. **Token + (operator)**:
   - Pop right operand = 4: Stack = [3]
   - Pop left operand = 3: Stack = []
   - Push result 3 + 4 = 7: Stack = [7]
4. **Token 2 (push 2)**: Stack = [7, 2] (2 on top)
5. **Token * (operator)**:
   - Pop right operand = 2: Stack = [7]
   - Pop left operand = 7: Stack = []
   - Push result 7 * 2 = 14: Stack = [14]
6. **Final note**: Stack = [14]

## Key design decisions

- Used multiple `pop` and `push` operations to break down the `+` and `*` operators
- First pop gets the RIGHT operand (top of stack)
- Second pop gets the LEFT operand (this is the key narrative point from the brief)
- Computation description occurs on the final push of each operator
- Title explains what expression is being evaluated
- Final note summarizes the result

## First Attempt Results

### Check Output
```
✓ scene.json (stack): 0 error(s), 0 warning(s)
  7590ms · 12 steps (12 captioned) · 15 nodes · 17 tracks / 75 keyframes
  scene 626 B → timeline 6932 B (×11.1)
```

### Explain Output (narration as a numbered list)
```
Evaluate postfix: 3 4 + 2 * — 12 steps, 7590ms, 15 nodes
 1. [    0ms] Evaluate postfix: 3 4 + 2 *
 2. [  385ms] Token 3: push it
 3. [ 1045ms] Token 4: push it
 4. [ 1705ms] Token +: pop right operand = 4
 5. [ 2475ms] Pop left operand = 3 (second pop is left)
 6. [ 3245ms] Compute 3 + 4 = 7, push result
 7. [ 3905ms] Token 2: push it
 8. [ 4565ms] Token *: pop right operand = 2
 9. [ 5335ms] Pop left operand = 7 (second pop is left)
10. [ 6105ms] Compute 7 * 2 = 14, push result
11. [ 6765ms] Postfix evaluation complete. The answer is 14
12. [ 7315ms] Stack: 14 · removed 4, 3, 2, 7
```

### Final Frame Verification
From SVG rendering at end: The final frame contains only `<g id="v-4">` with visible opacity and text "14", 
positioned at the top stack slot (140, 248). All other values (3, 4, 7, 2) have opacity="0" and are invisible.

**SUCCESS**: Scene.json meets all criteria ✓
