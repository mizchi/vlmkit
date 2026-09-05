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
