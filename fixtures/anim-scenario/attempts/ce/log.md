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

