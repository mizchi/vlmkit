# A/B external-repo scenario v3: subtle mutations vs drafts 04+07 (2026-06-06)

## Question

v2 ended in a dead heat. v3 ships the two features both v2 agents
specified independently — per-region translation estimates (draft 04)
and deterministic region→DOM-selector mapping via
`diff png --elements-html` (draft 07) — and raises the difficulty to
the class where measurement should dominate: **5 subtle value
mutations** (color deltas 24–44/channel incl. dark-on-dark, px factors
0.72–1.35), no sibling rules, spread across nav / timeline / contact.

## Setup

Same target, scorer, budget, success bar as v1/v2. Seed 42
(`--mutate 5 --subtle`):

- `#mainNav .navbar-nav .nav-item .nav-link` color `#fff → #d7dee6`
- `.timeline > li.timeline-inverted > .timeline-panel:before`
  border-right-width `14px → 11px`
- `section#contact` background-color `#212529 → #090353`
- `section#contact form#contactForm ...` border-color
  `#ffc800 → #daaa29`
- `section#contact form#contactForm :-moz-placeholder` color
  `#ced4da → #b0afff`

Initial diff: 1280 7.15% / 768 5.42% / 375 4.90%. Prior experiment
dirs (seed-1, seed-23m — their workspaces encode the original CSS)
added to FORBIDDEN. Treatment brief advertises the new affordances.

## Result

| metric | control (no vlmkit) | treatment (vlmkit) |
|---|---|---|
| final max diff | **0.000%** | **0.000%** |
| rounds used | 2 / 5 | 2 / 5 |
| wall clock | 5m58s | 5m55s |
| subagent tokens | 49.0k | 51.9k |
| tool calls | 29 | 34 |
| mutations repaired | **2 / 5** | **3 / 5** |

Cost parity again — but two qualitative separations, both in
vlmkit's favor:

1. **Localization without screenshots.** Treatment: "`diff png
   --elements-html` selectorCandidates (...) mapped both regions
   straight to greppable CSS scopes — **I never opened a screenshot
   before knowing where to look**." Control spent ~50% of its time
   writing/debugging four throwaway pngjs scripts and described its
   selector attribution as "grep luck — `#090353` being unique in 11k
   lines was fortunate, not guaranteed."
2. **More complete repair.** Treatment additionally found and
   reverted the scorer-invisible `:-moz-placeholder` mutation (a
   Firefox-only rule a Chromium-based scorer can never see) by
   noticing the anomalous color while inside the right selector scope.
   Control left 3 latent mutations; treatment left 2.

### Scorer blind spots, round three

Three of five mutations were invisible to the fixed scorer
(Chromium static captures, pixelmatch 0.1): the 3px arrow-width
change, the gold border shift, the Firefox-only placeholder. With v2's
scroll-state finding, the catalogue of static-capture blind spots now
reads: JS state classes, engine-specific rules, sub-threshold deltas.

## What worked — the agents' own words

Draft 07 (deterministic selectors) delivered exactly as specified:

> "Region bounding boxes + diffPixelCount let me triage the 943px nav
> residual instantly."

And control, for the third consecutive run, independently specified
the feature the other arm already had:

> "Tool I wished I had: a 'diff region → CSS rule' mapper: given a
> y-band, run `document.elementFromPoint`/box queries in the live page
> to name the covering element + matched rules."

Three runs, three independent restatements of the same spec —
region→selector mapping is no longer a hypothesis about what agents
want.

## What didn't — new friction (drafts 10–12)

1. **`colorSample` median is the wrong statistic** (draft 10).
   Treatment: "the median hit the white form inputs, hiding the
   actual bg change (#212529 → #090353). (...) sampling only
   *differing* pixels would have named the answer directly." This
   single defect forced ~40% of treatment's time into hand-rolled
   samplers — it is the remaining gap between "selector candidates
   point at the scope" and "one-shot read of the fix value."
2. **Text regions surface no usable color delta** (draft 11) —
   antialiasing defeats the median; the agent wants the extreme
   differing-pixel pair.
3. **"layout-shift" label without a measured offset** (draft 12).
   Treatment called shift "a dead feature"; it is not (same dist
   build reports `shift {dx:36}` on 5/7 regions of the v2 captures) —
   v3 simply contained no translations. The shape-derived label and
   the measured field need consistent vocabulary.

## Verdict for v3

- **Outcome/cost: parity for the third time** — on this task size,
  a script-literate agent matches vlmkit's wall-clock.
- **Quality: first real separation.** Treatment repaired 3/5 vs 2/5
  and never needed a screenshot for localization. The deterministic
  selector mapping (draft 07) converted the v2 wish into the v3
  workflow verbatim.
- **The remaining bottleneck is one statistic**: colorSample must
  sample differing pixels only (draft 10). Both arms' residual
  hand-rolling traces to that single defect.
- Loop health check (skill stopping criteria): new gaps are now
  statistic-level refinements, not missing features; per-fix commit
  size is shrinking; agent-side variance (grep luck, anomaly
  noticing) explains a growing share of outcomes. The loop is
  approaching diminishing returns.

## Next

1. Fix draft 10 (diff-pixels-only colorSample) — small, and it
   closes the specific gap that still forces hand-rolled samplers.
2. Then stop the loop and synthesize: v1–v3 across the version axis
   (friction fixed → cost parity → quality edge), update README /
   docs/knowledge.md positioning (deterministic signals first, VLM
   path demoted), and decide on PR.

## Files

- Reports: v1 `2026-06-05-ab-external-v1.md`, v2
  `2026-06-06-ab-external-v2.md`
- New drafts: `docs/issues-drafts/{10,11,12}-*.md`
- Run artifacts (gitignored): `test-results/ab-external/seed-42s/`
