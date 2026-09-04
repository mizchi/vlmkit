# Attempt z — re-edit chart-regions (haiku)

Errors: 0. Warnings: 0. Rounds to green: 1.

Requirements met: all series visible (us-east, eu-west, ap-south); alert threshold at 1% drawn once before both incidents; Wednesday and Thursday incidents each get a focused highlight; y axis fits the peak with no hard-coded `yMax`. `explain` in order: "The alert threshold is 1%; Thursday crossed it" → "A bad deploy at 14:00 UTC … bringing it from 1.8 to 1.2" → "eu-west had its own, worse incident on Wednesday" → "A cascade failure at 11:30 UTC spiked errors to 2.4%". Final frame: us-east Thursday at 1.2.

Y-axis top, prediction vs actual: predicted 2.5 (round number just above 2.4); actual 3.0. The guide says "a round number just above the largest value" but does not specify the rounding, leaving this ambiguous.

Made intent clear: the highlight syntax explicitly names both `series` and `category` ("A highlight target T picks by any combination of `series` and one of `index` / `category`"), which made the two-incident structure unambiguous; the sequence array mirrors story beats; captions embed the domain reasoning.

Ambiguous: the yMax rounding algorithm is undocumented. The guide does not clarify whether an implicit reveal applies to series added mid-way; selective `reveal` turned out to be correct — each series must be revealed explicitly. Wish-it-said: "When multiple series share a sequence, a `reveal` of one series does not reveal others; each must be revealed explicitly. Use `{"reveal": "all"}` to show all series at once."

No diagnostics fired: the check reported no warning about unrevealed series; that silence was correct (ap-south was revealed at the end).
