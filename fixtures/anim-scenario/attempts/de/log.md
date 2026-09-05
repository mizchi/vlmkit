# Batched Pandora's Box — Attempt Log

## Storyboard (beats drawn by hand)

Beat 1: Title + setup scene
  - Three boxes in a row, all closed
  - Text: "3 boxes with unknown rewards"
  - Goals: show which are closed/open, costs

Beat 2: Batch 1 setup
  - Boxes 1 and 2 highlighted / accented
  - Cost annotation: total cost for batch 1 (setup + box costs)
  - Text: "Open boxes 1 and 2 together: cost 1/5 + 1/5 + 1/5 setup = 3/5"

Beat 3: Box 1 reveals
  - Box 1 "opens" (visual change)
  - Reward label "1/2" appears
  - Best so far: 1/2
  - Cost so far: 3/5
  - Text: "Box 1 always gives 1/2"

Beat 4: Box 2 reveals (two branches needed)
  - Show two possible outcomes for box 2
  - Path A: Box 2 = 99
  - Path B: Box 2 = 1/2 (or 0)

Beat 5a (Path A): Stop decision
  - Best so far: 99 (box 2 result dominates)
  - Text: "With 99 already won, second batch costs 6/5, not worth it"
  - Final: score = 99 - 3/5 ≈ 98.4

Beat 5b (Path B): Consider second batch
  - Best so far: 1/2 (box 1)
  - Box 2 gave something worse
  - Text: "Box 2 gave 1/2 (or 0), consider opening box 3"

Beat 6b: Decision calculation
  - Cost of batch 2: 1 + 1/5 = 6/5
  - Box 3 expected reward: 1/5 × 10 = 2
  - Incremental gain if open: 1/5 × (10 - 1/2) = 1.9
  - Expected cost: 6/5 = 1.2
  - Text: "Expected gain 1.9 > cost 1.2, so open batch 2"

Beat 7b: Batch 2 opens, box 3 reveals
  - Box 3 opens
  - Reward "10" appears (the good outcome we're showing)
  - Best so far: 10
  - Cost so far: 3/5 + 6/5 = 9/5
  - Text: "Box 3 shows 10 — excellent!"

Beat 8b: Final score
  - Best reward: 10
  - Total cost: 9/5
  - Score: 10 - 9/5 = 8/5 = 1.6
  - Text: "Final score: 1.6 (vs 98.4 on path A)"

Beat 9: Conclusion
  - Show that adaptive policy (react between batches) beats fixed policy
  - Paper's bound: at most 2×, on this instance ~1.19×
  - Text: "Adaptive policies beat fixed menus by bounded factor"

**Kinds chosen:**
- Primary: `kind: vector` (custom shapes for boxes, tweens for opening/closing, annotations for rewards/costs)
- Reason: No built-in kind exactly covers "boxes in batches with conditional branching". `vector` lets us show:
  - Boxes as rectangles (closed state via outline, open state via fill or color)
  - Rewards as text annotations appearing
  - Branch via two separate sequences (both shown, or via compose)
  
**Coordinate/color fallbacks needed:**
- Box positions (x,y): need to place 3 boxes in row 1 (batch 1) and 1 box in row 2 (batch 2)
- Box sizes: fixed dimension for visibility
- Colors: closed boxes (gray), open boxes (lighter), rewards (green text), costs (red text or annotation)
- Text positions: above/below boxes for labels

**Caption load:**
- "Best so far" value: shown in annotation at each reveal (no on-screen element for it)
- "Total cost so far": shown in annotation (sum of box costs + setup costs)
- Expected gain comparison "1.9 vs 1.2": must be in caption since it's the decision logic
- Running probabilities and expected values: in captions, not drawn

## Rounds

### Round 1: Initial attempt
[To be filled in after running `check`]

