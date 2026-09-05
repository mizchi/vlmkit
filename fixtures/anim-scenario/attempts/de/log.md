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

### Round 1: Initial attempt (COMPLETE - PASSED)

**File:** scene.json (vector, single path)

**Changes made:** Rewrote from multi-path branch approach (confusing reset) to single path showing the more interesting case (box 2 = 1/2, open batch 2, get 10).

**Check output:**
```
✓ scene.json (vector): 0 error(s), 0 warning(s)
2100ms · 5 steps (5 captioned) · 15 nodes · 16 tracks / 35 keyframes
scene 3916 B → timeline 4853 B (×1.2)
```

**Explain output:** 5 steps with captions covering:
1. Batch 1 setup
2. Rewards reveal (1/2 and 1/2) + decision evaluation
3. Go ahead: expected gain 1.9 > cost 1.2
4. Batch 2 opens, box 3 shows 10, final score 1.6
5. Conclusion: adaptive beats fixed, bounded by 2×

**Success criteria met:**
- ✓ No ✗ or ⚠ (0 errors, 0 warnings)
- ✓ Shows which boxes are closed/open at each step
- ✓ Shows rewards revealed: batch 1 gets 1/2 and 1/2, batch 2 gets 10
- ✓ Shows best so far: updated from 1/2 to 10
- ✓ Shows total cost: 3/5 initially, then 9/5 after batch 2
- ✓ Shows setup and box costs separately: "box costs 1/5+1/5 + setup 1/5"
- ✓ Shows decision rule: "expected gain 1.9 > cost 1.2"
- ✓ Mentions alternative: "if box 2 = 99, stop, score 98.4"
- ✓ Conclusion: policy adapts between batches, bounded by 2× (1.19× here)

---

## Deliverables

### 1. Kinds used, error count, rounds to green, bytes per scene
- **Kinds used:** 1 kind (`vector`)
- **Why:** No semantic kind (array, sort, stack, etc.) directly models "boxes in batches with conditional decisions". `vector` allows custom shapes (boxes), tweens (open/close), and text annotations for rewards and decisions.
- **First-attempt errors:** 3 ✗ (invalid `weight` property, then 3 invalid `ms` keys in timeline items)
- **Rounds to green:** 2 rounds (round 1 had keyword errors, round 1b fixed them)
- **Bytes per scene:** 3916 B (scene JSON) → 4853 B (compiled timeline) = 1.24× expansion

### 2. Coordinate and colour fallbacks (manually written positions/colours)

**Coordinates (x, y positions):**
- Boxes: `[120, 100]`, `[280, 100]`, `[440, 100]` for boxes 1, 2, 3 (row layout, spaced 160px apart, no formula available)
- Reward text: centered in boxes at `[120, 105]`, etc. (slight y-offset from box center for visibility)
- Panels: `[600, 280]` (cost), `[600, 310]` (best), `[350, 270]` (decision) — right side for panels, center-bottom for decision
- Batch labels: `[200, 40]` (batch 1), `[440, 40]` (batch 2) — above their respective box groups
- **Why manual:** Vector kind requires absolute positions; no automatic layout. Spacing chosen to balance readability (avoid overlap).

**Colours (hex codes):**
- Box background (closed): `#e5e7eb` (light gray)
- Box background (open): `#fcd34d` (yellow)
- Reward text: `#10b981` (green, indicates good news)
- Labels and panels: `#1f2937` (dark gray for contrast)
- Strokes: `#374151` (medium gray)
- **Why manual:** No palette system in vector kind. Colors chosen to support the narrative (gray=closed/unknown, yellow=processing/open, green=reward).

### 3. Caption load (facts that only live in captions, not on screen)

The following facts are ONLY in captions because no on-screen element carries them:

1. **Box probabilities & distributions:**
   - "Box 1: always 1/2"
   - "Box 2: not the rare 99 outcome" / "prob 1/5 each outcome"
   - "Box 3: the good outcome; prob 1/5"
   - **Why:** Reward distributions cannot be shown visually in a single frame; they're inherent to the problem setup.

2. **Setup cost notation:**
   - "setup + costs = 3/5" broken down as "(box costs 1/5+1/5 + setup 1/5)"
   - **Why:** Visual shows only the final cost; the additive formula is explanation.

3. **Expected value calculations:**
   - "Box 3 expected reward: 1/5 × 10 = 2"
   - "Batch 2 cost: 6/5 = 1.2"
   - "Incremental gain: 1/5×(10−1/2) = 1.9"
   - **Why:** Arithmetic cannot be shown on screen; it lives in narration.

4. **Decision comparison:**
   - "Expected gain 1.9 > cost 1.2 → open batch 2"
   - **Why:** The comparison is the decision logic itself — it's inherently a caption.

5. **Alternative path (counterfactual):**
   - "If box 2 had shown 99: stop. Score would be 99−3/5≈98.4. Policy adapts to reward signals."
   - **Why:** We only show one path; the alternative is mentioned to explain the decision rule, not shown.

6. **Paper's contribution:**
   - "Adaptive policy (deciding after each batch) beats any fixed menu, bounded by 2×. On this instance: ~1.19×"
   - **Why:** The bound is the paper's theorem; it cannot be inferred from one example.

### 4. Storyboard vs delivered (beats kept, bent, dropped)

**Beats kept:**
- Setup: show 3 boxes, introduce batch structure
- Batch 1 opening: boxes 1 and 2 highlighted
- Rewards revealing: 1/2 and 1/2
- Decision logic: show expected gain calculation
- Batch 2 opening: box 3 appears and opens
- Outcome: box 3 shows 10
- Conclusion: mention adaptive policy advantage

**Beats bent:**
- Original storyboard showed BOTH paths (99 and 1/2) with a visual reset between them
- Delivered: ONE path (1/2) with alternative mentioned in caption
- **Why:** Avoid confusing visual reset (boxes closing then reopening with different values). Single path is clearer; alternative explained in prose.

**Beats dropped:**
- "Show scoring calculation with clear numbers" — partially: panels show best and cost, but detailed arithmetic only in captions
- "Compare 99-path score side-by-side with 1.6" — alternative mentioned in step 4 caption, not shown visually
- **What would carry them:** 
  - Scoring: a `matrix` kind showing a score table, or repeated `vector` scenes
  - Side-by-side: `kind: compose` with two panes, but this breaks single-run narrative

### 5. Does the result explain the algorithm?

**What the viewer WILL understand:**
- There are boxes with unknown rewards and opening costs
- Boxes are opened in batches (all rewards in a batch appear together)
- After batch 1, we decide whether to open batch 2 based on current rewards
- The decision uses expected value: if (expected gain from next batch) > (cost), open it
- The policy adapts to what we've seen (unlike fixed menus)
- This adaptation is bounded in how much better it can be

**What the viewer will NOT fully understand:**
- The exact probability distributions of each box (mentioned in captions, not visualized)
- Why 1.9 vs 1.2 is the right comparison (the math is shown, but not *derived*)
- What a "fixed menu" is in detail (only said "beats fixed menus")
- The generality of the bound (shown one instance, 2× bound mentioned)
- Non-reusable vs reusable variants (only non-reusable shown, the other not mentioned)

**Verdict:** The scene explains the POLICY SHAPE (adaptive branching on batch results, cost-benefit decision rule) well. It explains the PROBLEM adequately. It does NOT explain the paper's theoretical contribution deeply (the 2× bound is just mentioned).

### 6. One sentence: what would help most

**The greatest missing feature:** An **"if-then-else" primitive** that shows branching paths conditionally (when box 2 = 99, take path A; when box 2 < 99, take path B) without requiring manual reset or composition, so the decision rule is visible as a tree, not just as captions.

---

## Summary

- **Kinds:** 1 (vector)
- **Scenes:** 1 (scene.json)
- **First-attempt ✗/⚠:** 3 ✗ (fixed in 1 round)
- **Rounds to green:** 2
- **Bytes:** 3916 B
- **Status:** ✓ ALL SUCCESS CRITERIA MET. Scene passes check with 0 errors/warnings; explain output carries all required facts (best, cost, decision rule, expected values, alternative path).

