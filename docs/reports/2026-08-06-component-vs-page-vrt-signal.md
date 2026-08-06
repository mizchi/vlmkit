# Component-scoped vs page-scoped VRT: signal cost and precision

Date: 2026-08-06. Harness: `src/experiments/component-vrt/ab-run.ts`
(`node --experimental-strip-types src/experiments/component-vrt/ab-run.ts --seeds 1,2,3,4,5,6`).

## The question

When an agent repairs **one component**, is a component-scoped VRT signal
(`vlmkit check story`) cheaper and more precise than diffing the whole page that
component lives on?

## Answer, in one line each

- **Cheaper: yes, decisively.** 11.6x fewer signal bytes, **152.6x fewer image
  tokens**.
- **More precise at localizing: no — this was my hypothesis and it is refuted.**
  Both arms named the mutated component in 6/6 seeds.
- **Better at catching the blast radius: yes.** The page arm missed 2 of 9
  expected changes; the component arm missed 0.
- **Fewer retakes / fewer output tokens: not measured.** See the limits section —
  this needs a repair agent in the loop, and no number is offered for it.

## Setup

Six components (`Button`, `Badge`, `Avatar`, `Card`, `Alert`, `Toolbar`) defined
once in `fixture/components.css` and `fixture/_markup.js`, rendered by **two
hosts off the same files**: `page.html` composes them into a page,
`gallery.html` mounts them as stories. Sharing the sources is the fairness
condition — with a copy per host the two arms would be measuring two different
regressions.

`Toolbar` deliberately renders an Avatar, a Badge and a Button, so the corpus
contains a composite whose blast radius is larger than itself.

Six seeds, one per component, each deleting one layout-affecting declaration
from that component's own rule block (so ground truth is unambiguous). Seed 1
removes `.c-button { padding }`, seed 4 removes `.c-card { border }`, and so on.

**The page arm is given its strongest signal, not a convenient one.** It runs
`vlmkit diff html`, whose computed-style diff localizes by selector — not merely
the pixel path. That matters: measured on its own, the pixel path attributes a
Button padding deletion to a 320x672 region on `.page`, the wrapper, because
removing the padding reflows every section below it. Had I compared against
*that*, the localization result would have been manufactured.

## Measurements

## Per seed


| seed | mutated component | removed | page bytes | story bytes | page img tokens | story img tokens |
|---|---|---|--:|--:|--:|--:|
| 1 | `Button` | `padding` | 129,513 | 7,925 | 3,714 | 28 |
| 2 | `Badge` | `letter-spacing` | 25,367 | 7,850 | 3,714 | 28 |
| 3 | `Avatar` | `height` | 105,860 | 7,662 | 3,714 | 26 |
| 4 | `Card` | `border` | 96,843 | 5,942 | 3,714 | 34 |
| 5 | `Alert` | `padding` | 63,839 | 5,948 | 3,714 | 13 |
| 6 | `Toolbar` | `padding` | 52,608 | 5,562 | 3,714 | 17 |

## Totals

| metric | page-scoped | component-scoped | ratio |
|---|--:|--:|--:|
| signal bytes | 474,030 | 40,889 | **11.6x** |
| image tokens (approx) | 22,284 | 146 | **152.6x** |
| localized the right component | 6/6 | 6/6 | |
| false positives (outside blast radius) | 0 | 0 | |
| missed changes (inside blast radius) | 2 | 0 | |

## Localization detail

| seed | expected (blast radius) | page implicates | story implicates |
|---|---|---|---|
| 1 | `Button`, `Toolbar` | `Button` | `Button`, `Toolbar` |
| 2 | `Badge`, `Toolbar` | `Badge` | `Badge`, `Toolbar` |
| 3 | `Avatar`, `Toolbar` | `Avatar`, `Toolbar` | `Avatar`, `Toolbar` |
| 4 | `Card` | `Card` | `Card` |
| 5 | `Alert` | `Alert` | `Alert` |
| 6 | `Toolbar` | `Toolbar` | `Toolbar` |

Image tokens use Anthropic's documented `w*h/750` approximation, applied to the PNG dimensions actually emitted. Output tokens and retake counts are absent on purpose: both require a repair agent in the loop, and estimating them would be fabrication.


## Where the 152x comes from

Per seed, the page arm emits three heatmaps because it sweeps three viewports:

| arm | images an agent opens | tokens (approx) |
|---|---|--:|
| page | 1280x900, 375x900, 1440x900 | 1536 + 450 + 1728 = **3714** |
| component | 64x19 (Button), 326x58 (Toolbar) | 2 + 26 = **28** |

Two effects compound. The obvious one is that a component box is a fraction of a
viewport. The less obvious and larger one is **selectivity**: the component arm
only produces an image for the stories that actually changed, so five of six
components cost nothing to look at. The page arm has no such option — a page
heatmap covers everything whether it changed or not.

Signal bytes tell the same story with less drama: 25-130 KB per page-arm report
against a steady 5.5-8 KB for the component arm. The page arm's variance is
itself informative — its report grows with how much of the page reflowed, so the
regressions that are hardest to localize are also the ones that cost the most to
read.

## What refuted my hypothesis

I expected the component arm to localize better. It did not: **6/6 for both**.
`diff html`'s computed-style diff names `.c-button`, `.c-badge` and so on
reliably, because a deleted declaration changes that selector's computed styles
whatever else reflows around it. The page arm is not blind, and the pitch for
component-scoped VRT should not claim it is.

Where the arms genuinely differ is the **blast radius**:

| seed | expected to change | page arm reports | component arm reports |
|---|---|---|---|
| 1 | `Button`, `Toolbar` | `Button` | `Button`, `Toolbar` |
| 2 | `Badge`, `Toolbar` | `Badge` | `Badge`, `Toolbar` |

The Toolbar renders a Button, so deleting the Button's padding really does change
the Toolbar. The page arm's selector-level signal misses it — the Toolbar's *own*
computed styles are unchanged; only its child moved — while the component arm
catches it, because it re-renders and re-diffs the Toolbar as its own story.
Neither arm produced a false positive outside the blast radius.

For a component-library change, that is the more useful property of the two: it
answers "what else did I just break" rather than only "where did I break it".

**This metric was wrong in my first run.** The harness scored `Toolbar` as a
false positive for a Button mutation, which made the component arm look
*imprecise* when it had in fact caught a real change the other arm missed —
the exact inverse of the truth. `COMPOSES` in the harness now encodes the
composition, and a test keeps it in step with what the fixture actually renders.

## Limits, stated plainly

- **Retake counts and output tokens are not measured, and not estimated.** Both
  require a real repair agent or the VLM/LLM fix loop. No API key is available in
  this environment (`OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
  all unset), so the loop could not make a call. The harness produces exactly the
  inputs that arm would consume, so it can be added without changing anything
  here.
- **N = 6, one fixture, one machine.** Enough to establish direction and order of
  magnitude, not a statistical claim. The seed classes are all single-declaration
  deletions; value mutations and multi-property regressions are untested.
- **The fixture page is ~1280x900.** Real application pages are commonly several
  times taller, and the page arm's cost scales with page area while the component
  arm's does not — so 152x is a floor for realistic pages, not a ceiling.
- **Both arms are deterministic here.** No claim is made about how a model
  *behaves* given either signal; only about what each signal costs and contains.
- The component arm requires a gallery. That setup cost is real and is not
  amortized in these numbers.

## What would settle the unanswered half

One controlled agent A/B, same shape as `2026-06-06-ab-external-synthesis.md`:
fresh disposable agents, fixed round budget, same seeds, one arm given the page
signal and one the story signal, scoring rounds-to-green and wrong-edit count.
That measures retakes directly instead of inferring them from signal size.
