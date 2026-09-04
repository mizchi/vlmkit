# Attempt ab — tree-bst-lesson (haiku)

Rounds to green: 1. First-attempt ✗: 0, ⚠: 0. Scene 713 B (timeline 26,754 B).

Success criteria met: search narration reports 7 comparisons (steps 30–36: "70 > 10, 20, 30, 40, 50, 60" then "70 = 70"); `explain` reads as a lesson ("Inserting in sorted order degenerates into a right-only chain"; a balanced-insertion note; the traversal caption explaining the invariant); in-order output "10, 20, 30, 35, 40, 45, 50, 60, 70".

Prediction vs actual: 7 comparisons predicted and got; 35 predicted as left child of 40 (confirmed by SVG: v-35 at x=257 under v-40 at x=319); 45 predicted as left child of 50 (confirmed: v-45 at x=381 under v-50 at x=443).

What helped: "Insert, search and delete walk a token down from the root with one captioned beat per comparison" told me what would be narrated automatically; the `note` convention gave the pattern for the balanced-insertion explanation; "caption replaces the generated caption for that beat" clarified overrides.

Missing or confusing: the guide should say that for a search the final equality beat counts as one of the comparisons (this mattered for verifying exactly 7, not 6). Nowhere does it explain that the traversal output appears as step text and as a row under the tree; a one-sentence note would have saved the verify step.

Guesses (all right): `initial` does not animate, so all inserts went through `ops` to match "start from empty"; a `note` becomes a step with its own caption; 35 and 45 draw at their in-order x and depth y.
