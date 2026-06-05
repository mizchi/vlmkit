# A/B external-repo scenario v2: value mutations, post-friction-fix (2026-06-06)

## Question

v1 (`2026-06-05-ab-external-v1.md`) ended in a tie-on-outcome /
loss-on-cost for vlmkit, but the seed had a ceiling effect (deleted
block recoverable by copy-paste from a sibling rule). v2 tests the
seed class where measurement should matter: **property-value
mutations with no surviving copy of the original values** — and runs
on a vlmkit build with v1's friction drafts 01–03 fixed (`diff
region` tall-image auto-downscale, max-tokens 1500 + truncation
retry, `diff png` dimension/Δheight reporting).

## Setup

Same target (`startbootstrap-agency`), scorer, budget (5 rounds),
and success bar (max per-viewport diff < 1%) as v1. Differences:

- **Injected regression** (seed 23, `--mutate 3 --min-line 10600`):
  - `#mainNav.navbar-shrink` `background-color #212529 → #450076`
  - `#portfolio .portfolio-item .portfolio-caption`
    `background-color #fff → #b4d1ff`
  - `.timeline > li .timeline-image` (min-width:1200px)
    `margin-left 85px → 49px` (rendered as `-85px → -49px`)
  - Initial diff: 1280 3.78% / 768 3.43% / 375 6.07% — all viewports.
- Both arms may now write ad-hoc Node scripts with `playwright`,
  `pngjs`, `pixelmatch` (v1 allowed control only playwright; v1's
  treatment hand-rolled pngjs anyway, so this levels the field).
- v1 artifacts (`seed-1/`, reports, issue drafts, the injection
  script) added to the FORBIDDEN list — seed-1's repaired CSS is
  pixel-equivalent to the v2 answer key.

## Result

| metric | control (no vlmkit) | treatment (vlmkit) |
|---|---|---|
| final max diff | **0.000%** | **0.000%** |
| rounds used | 1 / 5 | 1 / 5 |
| wall clock | 5m43s | 5m47s |
| subagent tokens | 49.5k | 49.8k |
| tool calls | 23 | 30 |
| mutations repaired | 2 / 3 | 2 / 3 |

**Dead heat on every axis.** Versus v1 (vlmkit 1.8× slower, 1.3×
more tokens), the friction fixes brought treatment to cost parity:
v1's treatment spent "~60% of time working around the two `diff
region` failures"; v2's treatment spent ~70% on productive recon
instead.

### The latent third mutation — a scorer blind spot

Both arms independently left `#mainNav.navbar-shrink` broken
(`#450076` violet instead of `#212529`) and still scored a perfect
0.000%: the class only applies after JS adds it on scroll, so a
static full-page capture never renders it. Only the answer-key CSS
diff caught it. Generalizable: **pixel-perfect against static
captures ≠ fully repaired** — interaction-state styles (scroll
classes, hover, focus) need state-aware capture. vlmkit's
multi-state tooling covers pseudo-states but not JS-toggled classes.

## What worked — the agents' own words

Treatment, on the intended vlmkit happy path finally functioning:

> "`diff png --json` colorSamples. The 768px viewport reported
> exactly `#ffffff → #b4d1ff`, and grepping styles.css for that
> literal hex landed directly on the broken rule."

> "Cross-viewport comparison (diff present at 1280, absent at
> 375/768) was the media-query localizer."

Control converged just as fast, but only by building the tooling
inline — and took a detour vlmkit's measured colors would have
prevented:

> "The cropped screenshots misled me — I read the timeline diff as a
> 'blue ring vs gray ring' color change. A scanline through the
> circle at y=3565 showed identical pixel sequences offset by exactly
> +36px, proving it was a position shift, not a color change."

> "~40% writing the three ad-hoc analysis scripts
> (diff-regions/crop/sample)."

## What didn't — remaining vlmkit friction

1. **`diff region` (VLM) is still net-negative.** Prose summary
   correct, structured table wrong: both findings attributed to
   `.masthead` with `#252327 → #252328, Delta 0` bboxes in the page
   header; the timeline shift missed entirely. "The VLM call (12s)
   bought nothing the pixel diff hadn't already given." → draft 09
   (suppress Delta-0 rows), reinforces draft 06.
2. **No deterministic region→selector mapping.** Treatment: hit-test
   the pixel-diff's own bboxes against `--elements-html` DOM rects —
   "would have named `.portfolio-caption` without a VLM." Control
   independently wished for the same ("pixel coordinate → DOM element
   + matched CSS rules"). → draft 07.
3. **No cross-viewport presence matrix.** "1280-only ⇒ check
   ≥1200px media queries" is mechanical; both v1 and v2 agents did it
   by hand. → draft 08.
4. **Shift still misclassified**: "element-added/element-removed
   (#ffffff → #ffffff)" for a pure position shift — draft 04 remains
   open and was re-hit verbatim. Control's wish ("report 'region at
   (555,3488) matches region at (591,3488), offset +36,0'") is
   draft 04's spec, stated independently.
5. Minor: ad-hoc pngjs scripts fail outside the repo root (module
   resolution) — undocumented.

## Verdict for v2

- **Outcome and cost: parity.** The v1 cost gap is closed; the fixes
  paid for themselves.
- **The deterministic signals are vlmkit's value; the VLM path keeps
  hurting.** Treatment's praise was exclusively for measured pixels
  (colorSamples, region geometry, dimension delta). Its only
  complaint-free round came from ignoring `diff region` after one try.
- **A competent agent with pngjs is a brutal baseline.** Twice now,
  control hand-rolled the missing affordance inside the round budget.
  vlmkit's edge can't be "possible vs impossible"; it has to be
  "zero-setup, pre-verified, classified signal" vs "20+ minutes of
  ad-hoc scripts per repo" — which only shows up in cost at higher
  task volume or harder seeds.
- Both arms shipped a latent regression while scoring 0.000% — the
  strongest argument yet for state-aware capture as a first-class
  vlmkit feature.

## Next (v3 candidates)

1. Implement drafts 04 + 07 (shift classification, deterministic
   region→selector) — the two features both arms specified
   independently, in nearly identical words.
2. Harder seed: 5+ mutations across a larger stylesheet with subtler
   deltas (±8 px / ±16 RGB), where per-region recon cost dominates
   and hand-rolled scripts stop scaling.
3. Multi-task volume test: N seeds in sequence with a shared round
   budget — measures the amortized cost of control's script-writing
   vs vlmkit's zero-setup.

## Files

- Report v1: `docs/reports/2026-06-05-ab-external-v1.md`
- New drafts: `docs/issues-drafts/{07,08,09}-*.md`
- Run artifacts (gitignored): `test-results/ab-external/seed-23m/`
- Answer key: `test-results/ab-external/seed-23m/answer-key.json`
