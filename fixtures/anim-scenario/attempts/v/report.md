# Attempt v — chart-deploy-frequency (haiku)

- 0 errors, 0 warnings; 1 round to green (first attempt passed). Scene 845 bytes → timeline 14,315 bytes.

Success criteria met (all six beats confirmed by `explain`, in order): search first ("Search team: already at high deployment velocity"); payments crossing the target ("Payments team crosses the target in Q3"); threshold when relevant ("Target: 10 deploys per week", after payments); mobile ("Mobile team lags behind the target"); focus on mobile with the decision ("The review decided to invest in the mobile platform", series highlighted); the effect ("A pipeline fix shipped late in Q4, boosting mobile above target", bar animated to 11).

What the guide got right: the concrete chart example was directly applicable; the English descriptions of `reveal`, `threshold`, `highlight`, `set` were sufficient; the note that explicit captions replace generated ones let me tell the story deliberately.

What was unclear or missing:

- The guide shows only `{"highlight": {"category": "ap"}}` but I needed `{"highlight": {"series": "mobile"}}`. The schema line "highlight: {series, index | category}" is ambiguous — it should explicitly state "use *one* of: series, index, or category as the key" and show an example with each.
- "Default: reveal each series in order" doesn't show what auto-captions look like. It should clarify: "generated captions default to the series label; write your own to narrate the story."
- The guide doesn't explain *when* to place a threshold in a sequence. I inferred (correctly) that it should come after revealing the series that makes it relevant, but this multi-step narrative ordering would benefit from an example.

Guesses (all correct): `{"highlight": {"series": "mobile"}}` dimmed other series to 0.25 opacity; mobile bars stay bright when highlighted; threshold placement after payments tells the story cleanly; `{"set": {"series": "mobile", "index": 3, "value": 11}}` rendered the bar at the new height.
