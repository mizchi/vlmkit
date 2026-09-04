# Attempt ad — re-edit tree-delete (sonnet)

First attempt: 0 ✗, 0 ⚠; green in round 1.

Success criteria met. `explain` step 14: "30 has two children: its in-order successor 35 (the smallest value in the right subtree) takes its place; 40 keeps its spot as 35's new right child, and 45 is already gone from the earlier delete". Final in-order line: "inorder: 20, 35, 40, 50, 60, 70, 80".

Prediction vs actual: predicted successor 35, 40 demoted to a leaf under the promoted 35, 45 absent (deleted by the prior op). `render --at end` confirms: visible circles v-20 (71,202), v-35 (195,138), v-40 (257,202), v-50 (381,74), v-60 (443,202), v-70 (505,138), v-80 (567,202); x ascending matches in-order rank; 35 sits at 30's old depth, 40 at depth 2. v-30 / v-45 present with opacity 0. Exact match.

What made intent readable: the worked example already deletes a two-child node, and the prose states the rule plainly ("two children (the in-order successor, the smallest value on the right, takes the node's place)"); with "caption replaces the generated caption of that op's **last** beat" that was enough to compute the successor by hand.

Gap: the guide never states what happens to the displaced subtree when the successor has its own right child — a harder tree would have required guessing. Wanted: "If the successor itself has a right child, that child takes the successor's old spot." No diagnostic fired.
