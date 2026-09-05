# Batched Pandora's Box — two scenes

1. **`scene-1.json`** (`kind: matrix`) — the concrete run: boxes 1–3 as a
   cost/reward grid, batch 1 (boxes 1+2) opening together, running
   best-so-far and cost-so-far, the decision to open batch 2, box 3
   revealing 10, final score 8.2.
2. **`scene-2.json`** (`kind: state-machine`) — the decision itself: the
   fork after batch 1 (box2=99 → stop, else → open batch 2), the
   expected-value comparison (1.9 vs 1.2) on the branch edge, a rewind
   (`goto`) that replays the untaken 99 branch, and the paper's bound
   (≤2×, ~1.19× here) as the closing note.
