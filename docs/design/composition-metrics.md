# Deterministic composition metrics — feasibility study

`docs/design/design-policy-metrics.md` asked whether design quality can be
gated deterministically and answered it for one axis: **beauty is not
measurable, self-consistency is.** That study shipped `check design`, which
measures consistency of *style* — do your buttons render one way.

This one asks the next question. The four classical composition principles —
**近接 proximity, 整列 alignment, 反復 repetition, 対比 contrast** (Robin
Williams' P.A.R.C., the C.R.A.P. of design-school handouts) — are what an AI
web-design prompt tells a model to obey and what a design review checks by eye.
Can they be measured from a render, cheaply, without a VLM?

Partly. Three of the four can. One was already covered. Six of the eleven
candidate metrics failed and are documented here, because a rejected metric is
the more reusable half of a study like this.

## The line, restated for composition

| Not measurable (taste — stays out) | Measurable (composition — can be a rule) |
|---|---|
| "is 24px the right gap under this heading?" | "the gap under this heading is 44px and the gap above it is 12px, so it reads as belonging to the block above" |
| "should this section be indented?" | "two of your rails are 5px apart" |
| "is this hierarchy well proportioned?" | "you declared h2 and h3 and rendered both at 16px" |
| "does this page feel balanced?" | — nothing. Dropped. |

Every claim in the right column is a **relation the page asserts about itself**,
measured against how it rendered. Same shape as `check design`, different
substrate: geometry rather than style signatures.

## Why the obvious corpus split does not work

The first attempt reused the previous study's corpus — designed pages versus
agent-built ones (`fixtures/auto-markup-proof/creative/attempt-s15..19-haiku.html`).
It cannot validate a composition metric, and the reason is worth recording:

> The agent fixtures are **app shells** (a dashboard, a chat tool, a card-battle
> game, a checkout). They contain **zero heading-led groups** — `labels = 0` on
> five of six. The designed fixtures are content pages with 3-20. The two groups
> differ in *page kind*, not in composition quality, so any metric keyed on
> headings "discriminates" perfectly and measures nothing.

Style reuse was robust to page kind, which is why the earlier study got away
with this corpus. Composition is not.

## The experiment that does work: paired mutants

Take a page that reads well, break **exactly one principle** with injected CSS,
and require the metric to fire on the mutant and stay silent on the original.

- **Sensitivity** — fires on the mutant.
- **Specificity** — silent on the original, and silent on the *other seven*
  mutants. That second half is what catches a metric that merely responds to
  any CSS change.

Six designed pages (`fixtures/css-challenge/{blog-magazine,landing-product,ecommerce-catalog,page,admin-panel,form-app}.html`)
x 8 single-principle mutations = **54 runs**. Harness and mutation CSS:
`docs/reports/2026-09-21-composition-principles-v1.md`.

The mutations are deliberately blunt. A metric that needs a subtle mutation to
be provoked is not measuring the principle, and a mutation that breaks two
principles cannot attribute a firing to either.

## Result

### Shipped

| rule | principle | originals | its mutant | other 7 mutants |
|---|---|---|---|---|
| `proximity-inversion` | 近接 | **0/6** | 5/6 fire | **0/24** |
| `flat-heading-step` | 対比 | **0/6** | 5/6 fire | **0/24** |
| `no-type-contrast` | 対比 (floor) | **0/6** | **6/6** fire | **0/24** |
| `rail-near-miss` | 整列 | 1/6 | 3/6 fire | fires on `repeat-break` |

The two 5/6 misses are the same page and are honest: `form-app` has **no
judgeable label** (every heading opens a bordered card, where the card does the
grouping) and **one heading level** (nothing to compare). The gate reports both
facts on its coverage line rather than passing silently.

`rail-near-miss` is the weak survivor and ships at `info`. It has decent
specificity but 3/6 sensitivity, and a per-element padding change reports
through it as well as through `check design`'s `component-drift` — so it is
true, and it does not carry a verdict. Same shape as `scale-outlier`.

### Already covered — 反復 is not here

`check design`'s `component-drift` owns repetition. The mutant run confirms it
responds: a per-nth-child padding mutation moved `ecommerce-catalog` from 6 to
7 button styles and its reuse figure from 2.0x to 1.71x. A second repetition
rule in this gate would report the same defect twice.

### Rejected

| candidate | why it failed |
|---|---|
| **Column rail score** (do a container's children share a left edge) | **1.00 on 14 of 16 pages.** Block layout hands every child the same left edge — you cannot misalign a column without trying. The same trap as the 4px-grid metric the previous study rejected: it measures CSS, not design. |
| **Group separation ratio** (inter-group gap / intra-group gap) | Intact pages span **0.86-3.00** and the mutants land *inside* that range. No threshold separates them. Kept in the report as context, explicitly labelled "cannot carry a verdict". |
| **Type-scale sprawl** (distinct font sizes) | **Ran backwards.** Designed pages use 3-14 sizes, generated ones 2-4. |
| **Indistinct step** (two font sizes within 8%) | **Ran backwards.** Designed pages average 1.6 such pairs, generated 0.33. "Don't be a wimp" is only meaningful between levels the page *declares*, which is what `flat-heading-step` does. |
| **text-align disagreement** within a stack | Fired **8 times on one intact designed page**. A centred hero beside left-aligned body copy is a decision. |
| **Section rhythm** (variation in the gaps between sections) | No data on half the corpus, no separation on the rest. |

## The four measurement bugs the mutants found

Each was a false positive or a blind spot on an intact page, and each is now a
regression test in `packages/vlmkit-markup/src/style/composition.test.ts`.

1. **Measuring past the content.** v1 built the reading flow from *text* boxes,
   so a chart card's `<h2>` was compared to the next text on the page — below a
   280px chart — and reported a 283px "gap after". A heading's content can be an
   image. Fixed by measuring between siblings.

2. **Calling a card a label.** v2 used "short text" to identify a label and
   caught `form-app`'s whole `div.card`, reporting a 16-vs-24px inversion on it.
   The distinguishing test is geometric: *a label is a box about as tall as its
   own type* (`div.card` is ~190px around 18px; `.section-head` is ~34px around
   28px, and that row genuinely is a label).

3. **The vacuous comparison.** A heading flush against its group's top edge has
   `before = 0`, and `after >= 0 * 1.5` is always true — three false positives
   on blog-magazine's intact sidebar panels. Two separate fixes: a box that
   **paints** its boundary (border, radius, own background) has already grouped
   its contents, so its first child is not judged at all; and…

4. **…the blind spot that replaced it.** Declining to judge every flush heading
   killed the most common generated-markup shape outright, because **margin
   collapsing** puts an unbounded `<section>`'s border box exactly on its first
   heading. `fixtures/composition/proximity-broken.html` reported COMPOSED with
   **zero labels judged**, on a page whose every heading had visibly drifted.
   Fixed by *climbing*: when a label is flush with its parent, the parent is not
   the boundary — the parent's own boundary is. The climb also tripled coverage
   on real pages (`examples/vlmkit-intro-page` 4 → 20 labels).

Two smaller ones, from the unit tests rather than the corpus: `no-type-contrast`
fired on a fixture whose whole body was four words (a page with one `<span>`
trivially has no type contrast, so the claim needs `CONTRAST_MIN_LEAVES` text
blocks behind it), and `measureSeparation` used a stricter stack floor than
`measureProximity`, which hid the gaps *between* sections on any page that had
exactly two.

## Cross-checked against a vision reader

The deterministic numbers are only worth shipping if they agree with what
someone looking at the page would say. Fourteen screenshots — originals and
mutants, shuffled, opaque filenames — were read by a vision model with no
access to the metric, its verdict recorded before the key was revealed.

**8 of 8 read images agreed with the gate, including which principle:**

| image | truth | vision reader said | gate said |
|---|---|---|---|
| 01 | form-app `rail-near-miss` | "cards sit ~5px apart" | `rail-near-miss` x4 |
| 02 | blog `rail-near-miss` | clean | nothing |
| 03 | form-app original | clean | nothing |
| 04 | ecommerce `flat-hierarchy` | "hero is no bigger than the section heads" | `flat-heading-step` x2 |
| 05 | blog original | clean | nothing |
| 06 | ecommerce original | clean | nothing |
| 07 | ecommerce `prox-invert` | "every heading detached from its content" | `proximity-inversion` x5 |
| 08 | page `rail-near-miss` | clean | nothing |

Rows 02 and 08 are the informative ones. Both are *mutants* the reader called
clean — and the gate also reported nothing, because the mutation's selectors did
not match those pages' structure. Reader and metric agreed that there was
nothing to see, which is the agreement that matters for a gate nobody watches.

Row 01 sets the perceptibility floor: a 5px rail split was caught on the page
where two cards sit adjacent and comparable, and would have been missed
otherwise. That measurement is why `rail-near-miss` is `info`.

## What stays out

- **Which gap or size is correct.** The gate reports that a label is 12px from
  one thing and 44px from another; choosing is the human's.
- **Balance, whitespace "feel", visual weight, brand fit.** No measurable
  self-referential claim was found for any of them.
- **Colour.** `check a11y contrast` and `check palette` own it. "Do these hues
  go together" is taste.
- **Emphasis as a positive requirement.** "Is there a clear primary action" is
  measurable in principle (one button's signature distinct from its peers) and
  was deliberately left out: it pulls *against* `check design`, which rewards
  buttons rendering identically. Two gates disagreeing about the same
  measurement is worse than a missing rule.

## Limitation on the evidence

The corpus is 16 local pages plus 54 mutant runs. Live-URL validation against
real-world designed pages (MDN, web.dev, Hacker News — the previous study's
reference set) **was not run**: the sandbox re-terminates TLS and the measurement
browser will not accept the proxy CA, so the pages could not be loaded. The
false-positive rate on real-world production markup is therefore the largest
remaining unknown, and the reason every rule here is `warn` or `info` rather
than `suspect`.
