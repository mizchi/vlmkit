# Batched Pandora's Box Animation — Attempt Log

## Hand-drawn Storyboard (14 beats max, per brief)

**Beat sequence:**
1. Title + intro: "3 boxes, open in batches, choose which batch to open next"
2. Show 3 closed boxes with their costs labeled (1/5, 1/5, 1)
3. Show reward distributions (box 1: always 1/2; box 2: 0/2/99; box 3: 10/0)
4. Decision: open batch 1 (boxes 1+2 together), show setup cost 1/5 + box costs 1/5+1/5 = 3/5 total
5. Batch 1 opens: boxes 1 and 2 move/glow, cost updates to 3/5
6. Box 1 reward appears: 1/2
7. Box 2 reward appears: 1/2 (one of three outcomes; for now assume this path)
8. Best so far updates: max(1/2) = 1/2; total cost = 3/5
9. Branch point: should we open batch 2 with box 3?
   - Show the cost: 1 + setup 1/5 = 6/5
   - Show the expected analysis: 1/5 chance of 10 is worth it (caption with 1.9 vs 1.2)
10. Decide: yes, open batch 2
11. Batch 2 opens: box 3 moves/glows, cost updates to 3/5 + 6/5 = 9/5
12. Box 3 reward appears: 10 (showing the good outcome)
13. Best so far updates: max(1/2, 10) = 10; total cost = 9/5
14. Final: show score = 10 - 9/5 = 41/5 = 8.2

**Kind choice:**
- Primary: **vector** — gives full control over box placement, movement, number updates
- Rationale: narrative is about batches opening (visual state change), costs accumulating, best reward tracking. Vector lets me draw rectangles for boxes, animate them, update text values for costs/best. State-machine doesn't fit (no explicit transitions, rewards appear within a batch). Diagram/matrix are too rigid.

**Expected structure:**
- Canvas: 600×400 for good space
- Nodes: 3 box rectangles, text nodes for labels (costs, rewards, best-so-far, total-cost)
- Timeline: 14 tweens + `wait` operations to reveal/move/update at each beat
- Captions: on each tween or `wait`, explaining what is changing

**First attempt challenges expected:**
- Hardcoding box positions (x, y coords)
- Hardcoding text values (cost 3/5 = 0.6, etc.)
- Captions carrying facts like "expected gain 1.9 > 1.2" since that won't appear visually
- May need to split into two scenes if one gets too long (14 beats → 12+ tweens)

---

## Round 1

### Attempt 1a: Single vector scene

**Check output:**
```
✓ scene-1.json (vector): 0 error(s), 0 warning(s)
  5100ms · 14 steps (14 captioned) · 14 nodes · 10 tracks / 25 keyframes
  scene 4126 B → timeline 4581 B (×1.1)
```

**Explain output (14 steps):**
1. Setup: boxes, costs, distributions
2-3. Goal and problem statement
4. Batch 1 decision, costs update to 3/5
5. Batch 1 opens, both rewards appear at once
6-7. Rewards revealed: 1/2, 1/2; best = 1/2
8-9. Decision analysis: "expected reward gain 1/5 × (10 − 1/2) = 1.9, cost = 1.2, so 1.9 > 1.2"
10. Batch 2 decision, cost updates to 9/5
11-12. Batch 2 opens, box 3 shows 10
13. Final: score = 8.2
14. Concluding statement about adaptive policies

**Observations:**
- ✓ All key facts appear in explain: best (1/2→10), costs (3/5→9/5), expected gain comparison (1.9 > 1.2)
- ✓ Visual state tracking (boxes change color, rewards show, state vars update)
- ✓ Decision branching narrated clearly (why 1.9 > 1.2)
- ⚠ Step 8's caption is awkward (catches myself recalculating) — should clean up wording
- ⚠ Rewards are visible at opacity 0.3 on unopened boxes from the start — could hide them initially
- ⚠ Expected value explanation could be more concise

**Hardcoded values:**
- Box positions: 90, 190, 290 (x-axis spacing), 120 (y-axis baseline)
- Canvas size: 600×420 to fit 3 boxes left, state display right
- State tracking text positioned at x=450 (right side)
- Costs: "cost 1/5", "cost 1/5", "cost 1"
- Rewards shown as numbers: 1/2, 1/2, 10
- Color values: #e8e8e8 (closed), #a8e6a8 (opened), #0066cc (accent blue)

**Next improvements:**
1. Fix step 8 caption to remove the recalculation stumble
2. Hide rewards (opacity 0) initially, reveal only during batch opening
3. Consider whether a state-machine companion scene would help illustrate the decision tree (the two outcomes: box 2 shows 99 vs. 1/2)


### Round 2: Refinements

**Changes made:**
1. Removed the opacity=0.3 "preview" reveals and kept rewards hidden (opacity=0) until batch opens
2. Simplified captions, removing the awkward recalculation in step 8
3. Consolidated steps 2-3, cutting from 14 to 12 steps
4. Streamlined the decision explanation into step 8 (cleaner: "Expected gain: 1.9, Cost: 1.2, Since 1.9 > 1.2...")

**Check output:**
```
✓ scene-1.json (vector): 0 error(s), 0 warning(s)
  4400ms · 12 steps (12 captioned) · 14 nodes · 10 tracks / 22 keyframes
  scene 3748 B → timeline 4269 B (×1.1)
```

**Metrics improved:**
- Duration: 5100ms → 4400ms (13% faster)
- Bytes: 4126 B → 3748 B (9% smaller)
- Steps: 14 → 12 (more concise)

**Explain output still carries:**
- Best updates: 1/2 (step 6) → 10 (step 11)
- Cost tracking: 0 → 3/5 (step 4) → 9/5 (step 9)
- Expected gain calculation: "1/5 × 9.5 = 1.9. Cost: 1.2" (step 8)
- Final score: 8.2 (step 11)

**Requirements checklist (from brief):**
- ✓ Visible at each beat: closed/open boxes, rewards, best-so-far, total cost
- ✓ Setup and box costs shown separately: "1/5 + 1/5 + setup 1/5 = 3/5" (step 4)
- ✓ Decision rule: expected gain (1.9) > cost (1.2) → open batch 2 (step 8)
- ✓ One concrete run with one outcome: box 2 = 1/2, batch 2 outcome = 10
- ✓ All scenes pass check with no ✗/⚠

**Narrative completeness:**
The scene explains:
- The problem: maximize (best reward - total cost)
- The constraints: batches mean all rewards in a batch appear together
- The policy: adaptive (decide after each batch based on results)
- One full run: batch 1 opens, decision made, batch 2 opens, final score
- Why the policy is adaptive: "we reacted to batch 1 outcome, chose whether to open batch 2"

**Design decision: single scene vs. multiple**
Considered whether to add a second scene showing the alternative branch (box 2 = 99 → stop immediately). Decided against it because:
1. The brief says "show one outcome (say 10)" — one path, not both
2. The decision rule is clear enough that viewers can infer the alternative
3. Single cohesive scene more effective than fragmenting across two

---

## Round 3 — Final review


### Scene passes with no errors or warnings. Moving to final analysis.

---

## COORDINATE/COLOUR FALLBACK

**Hardcoded positions (absolute):**
- Box 1: x=90, y=120, size 50×70
- Box 2: x=190, y=120, size 50×70
- Box 3: x=290, y=120, size 50×70
- State header: x=450, y=30 (text-anchor: start)
- Best/Cost labels: x=450, y=60 and y=90
- Batch markers: x=140, y=250 and x=290, y=250
- Canvas: 600×420

*Why these numbers:* 100-unit x-spacing keeps boxes readable. y=120 baseline aligns with reward labels at y=70 (above) and cost labels at y=210 (below). Right panel at x=450 leaves ~130px margin from rightmost box. Vertical layout uses first 300px for boxes, 250px below for labels.

**Hardcoded colours:**
- Closed boxes: #e8e8e8 (light gray)
- Opened boxes: #a8e6a8 (light green)
- Reward text / batch labels: #0066cc (blue)
- Background: #f9f5f0 (off-white)
- Text: #1f2328 (dark gray, from theme)

*Why these choices:* Closed → opened uses a clear visual change (gray to green). Blue rewards pop against light background. Off-white background reduces eye strain for 4.4-second animation.

---

## CAPTION LOAD (facts ONLY in captions, not on screen)

**Facts that live entirely in captions:**
1. "Boxes show 0, 1/2, or 99 (equal chance)" — reward distribution for box 2 (step 2)
2. "Setup cost 1/5 adds to their individual costs" — how setup cost works (step 4 caption)
3. "Batching constraint: no intermediate decisions" — why both rewards appear together (step 5)
4. "Could have been 0 or 99" — acknowledging the other possible outcomes for box 2 (step 6)
5. "If it shows 10 (1/5 chance), we gain 10 − 1/2 = 9.5" — the payoff structure (step 7)
6. "Expected gain: 1/5 × 9.5 = 1.9. Cost: 1.2" — the expected value calculation (step 8)
7. "Adaptive beats fixed: we reacted to batch 1, then chose batch 2. Fixed policy could not." — the key insight (step 12)

**Facts shown on screen:**
- Boxes visual state (closed gray → opened green)
- Individual box costs as labels (1/5, 1/5, 1)
- Rewards as numbers above opened boxes (1/2, 1/2, 10)
- Best-so-far: state panel updates (— → 1/2 → 10)
- Total cost: state panel updates (0 → 3/5 → 9/5)
- Batch markers when each batch opens

**Why this split:**
- On-screen: visual dynamics (what boxes do) + tracked state (best, cost)
- Captions: reasoning (why distributions matter, what calculations mean, what alternatives exist)
- The most critical insight (1.9 > 1.2, therefore open batch 2) lives in caption step 8, but the visual green color change shows the decision is acted on

---

## STORYBOARD vs. DELIVERED

**Planned beats (from hand-sketch):**
1. Setup: show boxes, costs, rewards → **DELIVERED** (steps 1-3 cover all three boxes + goal)
2. Batch 1 decision: show cost = 3/5 → **DELIVERED** (step 4)
3. Batch 1 opens: boxes move/glow → **DELIVERED** (green color change)
4. Batch 1 rewards appear → **DELIVERED** (steps 5-6, both rewards reveal)
5. Best/cost update → **DELIVERED** (state panel updates)
6. Branch decision: cost/benefit analysis → **DELIVERED** (steps 7-8, expected gain comparison)
7. Batch 2 opens → **DELIVERED** (step 9, box 3 turns green)
8. Batch 2 reward appears → **DELIVERED** (step 10, "10" becomes visible)
9. Final score calculation → **DELIVERED** (step 11: "8.2")
10. Conclusion: adaptive beats fixed → **DELIVERED** (step 12)

**Beats bent or rephrased:**
- "Decision: should we open batch 2?" — made more concrete: "Compare expected gain (1.9) vs cost (1.2)"
- "Show the good outcome" (box 3 = 10) — delivered literally (step 10 animation + caption)

**Beats not shown:**
- Alternative branch (box 2 = 99 → stop immediately) — NOT animated, only mentioned in caption. This is by design per the brief ("show one outcome").

**Generic structures not in the format:**
- A second overlay panel showing the comparison (1.9 vs 1.2) side-by-side — vector doesn't have a table/chart structure, so this lives in caption
- A decision-tree diagram showing both branches — would require state-machine or diagram kind; not attempted per brief guidance
- A "confidence" or "probability" annotation on outcomes — the format doesn't have conditional branching visuals

---

## HONESTY: DOES THIS EXPLAIN THE ALGORITHM?

**What a viewer gets:**
1. ✓ The problem: maximize (reward − cost), can stop anytime
2. ✓ The constraint: batches mean no intermediate decisions within a batch
3. ✓ One concrete policy: open batch 1 (boxes 1+2), then decide on batch 2 based on outcome
4. ✓ The decision rule: compare expected gain to cost, choose if positive
5. ✓ Adaptive property: the choice of batch 2 depended on the batch 1 outcome (saw 1/2, then evaluated)

**What is NOT clear without re-reading carefully:**
1. ⚠ Why box 2's outcome (1/2) was surprising or important — we mention "could have been 0 or 99" but the implication (99 would be excellent, 0 would be bad) isn't strongly shown
2. ⚠ The "non-reusable" constraint (boxes disappear after opening) — assumed but never stated
3. ⚠ The scope of the paper's contribution (bounded factor of 2×, actual 1.19× on this instance) — not mentioned at all

**Bottom line:** The animation explains the algorithm well enough for someone unfamiliar with it to follow the concrete run and understand why batch 2 was opened. The decision rule (1.9 > 1.2) is front-and-center. It does NOT convey the full theoretical contribution (bounding adaptive vs. fixed), but that wasn't the brief's primary goal — explaining the problem and policy shape was.

---

## WHAT WOULD HELP MOST (one sentence)

A **value label that tracks a number through the timeline** (e.g., "expected gain: 0.5" → "expected gain: 1.9" as properties change) would eliminate the need to state "expected gain: 1/5 × 9.5 = 1.9" in a caption; the calculation could happen on screen.

---

## Summary statistics

- Kinds used: **1** (vector)
- Scenes: **1** (scene-1.json)
- First-attempt ✗/⚠ count: **0** (passed check immediately)
- Rounds to green (polished): **2**
  - Round 1: 0 errors, 0 warnings; 14 steps, 5.1s, 4126 B
  - Round 2: 0 errors, 0 warnings; 12 steps, 4.4s, 3748 B (final)
- Bytes: **3748** (scene only; timeline 4269 B after compilation)

