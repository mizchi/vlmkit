# Gate and rule execution cost

Date: 2026-08-06. Tool: `vlmkit bench gates` (added in the same change).

Reproduce:

```bash
vlmkit bench gates \
  fixtures/css-challenge/page.html fixtures/css-challenge/dashboard.html \
  fixtures/css-challenge/form-app.html fixtures/css-challenge/admin-panel.html \
  fixtures/css-challenge/blog-magazine.html \
  --repeat 3 --probe-suppression --md
```

18 of the 26 gates run from a bare page; the other 8 need a target image, a
contract, a flow, a selector, or a PNG rather than a page. 270 runs, 493s.

## What the numbers say

**1. Per-rule execution cost is zero, and that is structural.** A gate performs
one measurement (`run`) and then projects it onto findings (`findings`). Every
rule it declares reads that same report. `run` is **100% of wall clock** for all
18 gates after rounding, and the projection across every gate on the table below
totals **0.39ms**. There is no per-rule execution to optimize.

**2. Turning rules off saves nothing — measured, not asserted.** On the slowest
gate, all rules on vs all rules off differs by **+29ms (0.4%)**, i.e. noise.
Rule settings are applied *after* the measurement by design, so a silenced
finding can still be reported as silenced. This is worth stating loudly because
the opposite is the natural assumption: someone tuning a slow CI job will reach
for `--rule …=off` and get nothing. To spend less, drop a gate or narrow its
inputs (fewer viewports, no `--sweep`).

**3. Four gates are 60% of the bill.** A full sweep of all 18 on one page is
**~29.9s serial**. `check interactions` (6.4s), `stress media` (4.7s),
`check perf` (3.7s) and `check integrity` (3.3s) are **18.1s of that — 60.5%**.
The remaining 14 gates together cost 11.8s. Any real budget conversation is
about those four, and the rest is close to free once a browser is warm.

Each of the four is slow for a different and legitimate reason: `check
interactions` probes every interactive element in sequence, `stress media` renders
variants, `check perf` has a deliberate 3s observation window, and
`check integrity` sweeps three viewports. None is a defect. `check perf`'s window
is the only one tunable without losing coverage (`--observe`).

**4. `check interactions` has 5x variance across pages** — 2753ms to 13705ms.
Its cost scales with the number of interactive elements, so it is cheap on a
landing page and expensive on an admin panel. Budget it per-page, not as a
constant.

**5. Cheapest and most expensive signal.** `check tokens` is the best value on
this corpus at **24ms per finding** (29 findings for 699ms);
`check.interactions/not-tab-reachable` and `check.integrity/low-contrast-text` are
the most expensive at **~3.4s per finding**, both because they fired on only 3 of
15 runs while riding on a slow gate. Expensive-per-finding is not an argument for
removal — a rule that fires rarely and catches a real defect is worth it. It is
an argument about which gate you are willing to pay for.

## Reading the "never fired" number honestly

64 of 84 rules did not fire. **This corpus is deliberately healthy markup** — the
`css-challenge` fixtures are the baselines that mutation testing breaks on
purpose — so non-firing is the *expected, correct* result for most rules, and the
number says almost nothing about whether a rule is valuable. It would be a
serious misreading to conclude that three quarters of the ruleset is dead weight.

What the list is genuinely useful for: it names the defect classes this corpus
does not exercise, which is a to-do list for fixtures rather than for rules. Run
the same bench against a corpus of known-broken pages and the interesting number
becomes the inverse — rules that still do not fire when the defect is present.

## Method and caveats

- Median of 3 runs per page per gate; min/max reported so variance is visible.
- Every run is a **cold browser launch**, which is what the CLI does. A long-lived
  browser would shift the constant but not the ranking.
- Per-rule cost is **attributed**, not isolated: each run's measurement time is
  split equally across the rules that fired in that run, then averaged per run.
  It is an allocation of a shared cost. Equal-split is the honest default when
  the work is genuinely shared; it does mean a gate with one firing rule charges
  that rule the whole measurement.
- No ledger rows are written during a bench (`ledger: false`), so the audit trail
  being measured is not polluted by the measurement.
- Single machine, Node 22.22, headless Chromium. Treat the absolute numbers as
  this-machine figures and the ratios as portable.

## Measurements

5 source(s) × 3 repeat(s), 270 runs in 493.3s.

| gate | category | median | min | max | run % | findings | rules fired | ms/finding |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| `check interactions` | behavior | 6420ms | 2753ms | 13705ms | 100% | 5 | 3/15 | 1284ms |
| `stress media` | behavior | 4682ms | 4419ms | 5638ms | 100% | 3 | 2/2 | 1561ms |
| `check perf` | infrastructure | 3659ms | 3640ms | 3716ms | 100% | 0 | 0/6 | — |
| `check integrity` | correctness | 3339ms | 3147ms | 3789ms | 100% | 0 | 1/18 | — |
| `check theme` | design-system | 1575ms | 1539ms | 1873ms | 100% | 9 | 2/2 | 175ms |
| `scan handlers` | behavior | 943ms | 907ms | 1086ms | 100% | 0 | 0/3 | — |
| `check design` | design-system | 936ms | 900ms | 951ms | 100% | 1 | 2/3 | 936ms |
| `stress i18n` | behavior | 879ms | 787ms | 1104ms | 100% | 7 | 2/3 | 126ms |
| `check a11y focus` | correctness | 863ms | 750ms | 917ms | 100% | 3 | 3/3 | 288ms |
| `check breakpoints` | behavior | 859ms | 785ms | 989ms | 100% | 0 | 0/5 | — |
| `check animation` | behavior | 854ms | 804ms | 1871ms | 100% | 0 | 0/5 | — |
| `check a11y contrast` | correctness | 762ms | 720ms | 871ms | 100% | 3 | 1/1 | 254ms |
| `check a11y touch` | correctness | 751ms | 713ms | 885ms | 100% | 6 | 1/1 | 125ms |
| `check scroll` | behavior | 700ms | 674ms | 725ms | 100% | 0 | 0/4 | — |
| `check tokens` | design-system | 699ms | 674ms | 771ms | 100% | 29 | 1/2 | 24ms |
| `check copy` | correctness | 673ms | 639ms | 770ms | 100% | 0 | 0/5 | — |
| `check motion` | behavior | 672ms | 645ms | 694ms | 100% | 1 | 2/2 | 672ms |
| `scan scroll` | behavior | 656ms | 637ms | 668ms | 100% | 0 | 0/4 | — |

`run %` is the share spent in the gate's measurement. Every rule the gate declares reads that one measurement, so the projection is the remainder — 0.39ms across every gate above.

### Attributed cost per rule

Each run's measurement time split equally across the rules that fired in it. This is an allocation of a shared cost, not an isolated timing — rules are not separately executed.

| rule | declared | fired | findings/run | attributed/run | ms/finding |
|---|---|--:|--:|--:|--:|
| `check.interactions/inert-control` | warn | 15/15 | 4.4 | 5157ms | 1172ms |
| `stress.media/variant-broken` | suspect | 15/15 | 2 | 2403ms | 1202ms |
| `stress.media/variant-ignored` | warn | 15/15 | 1 | 2403ms | 2403ms |
| `check.interactions/not-tab-reachable` | warn | 3/15 | 0.4 | 1370ms | 3424ms |
| `check.design/component-drift` | warn | 15/15 | 1.2 | 842ms | 702ms |
| `check.theme/theme-inert` | warn | 15/15 | 1 | 818ms | 818ms |
| `check.theme/unthemed-component` | warn | 15/15 | 8 | 818ms | 102ms |
| `stress.i18n/vertical-wrap` | warn | 15/15 | 14.6 | 815ms | 56ms |
| `check.a11y.contrast/contrast-below-aa` | suspect | 15/15 | 3.2 | 774ms | 242ms |
| `check.tokens/scale-violation` | warn | 15/15 | 31.6 | 704ms | 22ms |
| `check.integrity/low-contrast-text` | warn | 3/15 | 0.2 | 699ms | 3494ms |
| `check.a11y.touch/target-undersized` | suspect | 12/15 | 6.4 | 617ms | 96ms |
| `check.motion/missing-reduced-motion` | suspect | 12/15 | 0.8 | 470ms | 588ms |
| `check.interactions/no-focus-indicator` | warn | 3/15 | 0.2 | 458ms | 2291ms |
| `check.a11y.focus/reverse` | suspect | 15/15 | 1.8 | 393ms | 218ms |
| `check.a11y.focus/skip-row` | warn | 15/15 | 2 | 393ms | 197ms |
| `check.design/scale-outlier` | info | 3/15 | 0.2 | 91ms | 455ms |
| `stress.i18n/horizontal-overflow` | suspect | 3/15 | 0.6 | 82ms | 137ms |
| `check.motion/running-animation` | warn | 3/15 | 0.8 | 68ms | 85ms |
| `check.a11y.focus/trap` | suspect | 3/15 | 0.2 | 55ms | 273ms |

### Rules that never fired (64 of 84)

A rule that never fires is a defect class this corpus does not contain — not dead weight by itself. Widen the corpus before concluding a rule is untested.

`check.breakpoints/boundary-gap`, `check.breakpoints/boundary-spike`, `check.interactions/broken-aria-controls`, `check.integrity/broken-font`, `check.integrity/broken-image`, `check.integrity/clipped-content`, `scan.scroll/clipped-content`, `check.perf/cls-needs-improvement`, `check.perf/cls-poor`, `check.integrity/collapsed-container`, `check.interactions/composite-arrows-dead`, `check.integrity/container-protrusion`, `check.interactions/contract-extra`, `check.interactions/contract-mismatch`, `check.interactions/contract-missing`, `check.copy/copy-image-mismatch`, `check.copy/copy-invisible`, `check.copy/copy-missing`, `check.interactions/dead-disclosure`, `check.integrity/degenerate-render`, `scan.handlers/delegated-handlers-opaque`, `check.interactions/escape-stuck`, `stress.i18n/extends-beyond-parent`, `check.integrity/failed-stylesheet`, `check.perf/fcp-needs-improvement`, `check.perf/fcp-poor`, `check.scroll/fixed-drifts`, `check.interactions/focus-escapes-trap`, `check.interactions/focus-not-returned`, `check.interactions/handler-surface-mismatch`, `check.animation/infinite-animation`, `check.integrity/invisible-text`, `check.integrity/js-error`, `check.perf/lcp-needs-improvement`, `check.perf/lcp-poor`, `check.animation/long-settle`, `check.integrity/near-misalignment`, `check.integrity/nested-scroll`, `scan.scroll/nested-scroll`, `check.animation/no-visible-effect`, `check.integrity/occluded-text`, `check.breakpoints/overflow-at-boundary`, `check.integrity/page-overflow-x`, `scan.scroll/page-overflow-x`, `check.copy/placeholder-text`, `scan.handlers/pointer-only-control`, `check.interactions/popup-arrows-dead`, `check.interactions/popup-no-focus-move`, `check.integrity/redirected`, `check.copy/redirected`, `check.breakpoints/redirected`, `check.scroll/redirected`, `scan.scroll/redirected`, `check.design/redirected`, `check.animation/reduced-motion-ignored`, `check.tokens/shadow-tier-excess`, `check.scroll/snap-not-snapping`, `check.scroll/sticky-not-sticking`, `check.breakpoints/sweep-overflow`, `check.integrity/text-clipped`, `check.integrity/text-collision`, `check.animation/uncontrolled-motion`, `scan.handlers/unprobed-handler-types`, `check.integrity/unstyled-page`

### Does turning rules off save time?

Measured on `check interactions`, the slowest gate:

| | ms |
|---|--:|
| all rules on | 7403 |
| all rules off | 7432 |
| delta | +29 (0.4%) |

Noise. Rule settings are applied to the findings **after** the measurement — by design, so a silenced finding can still be reported as silenced. Pruning rules buys clarity, not time; to spend less, drop a gate or narrow its inputs.
