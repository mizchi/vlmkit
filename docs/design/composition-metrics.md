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

**The specificity above was measured on fixtures and did not survive production
markup.** On 14 mirrored designed pages the rule fired 46 times and every one
was a false positive: a block against its own ancestor's padding, two unrelated
containers, an inline box's prose-wrap edge, or a pair with no recorded parent.
It now requires **two siblings on the two rails** — which takes the live corpus
to 0 while three separate alignment mutants keep firing — and the finding names
the container whose children disagree, because that container is the only reason
the two edges are comparable at all.

Two traps worth knowing before touching this rule again, both measured in
`docs/reports/2026-09-23-composition-rail-classification-v3.md`:

- **"Ignore ancestor/descendant pairs" is the intuitive fix and it is wrong.**
  It names the biggest false-positive class correctly and silences
  `rail-broken-nested`, where a subsection really is indented 5px off the rail
  its own siblings sit on. The distinction is siblinghood, not nesting.
- **"Require both rails' blocks to be equally wide" also reaches zero on live
  pages, in one line** — which is how a narrowing tuned to the answer presents
  itself. `rail-broken-shrink` separates them: an uncompensated `margin-left`
  changes the width too, so the width test reports nothing on it.

That is why `fixtures/composition/` now carries three alignment mutants. One
shape of a defect cannot tell a real narrowing from a lucky one.

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

## Validated against production markup

This section used to say the live-URL round **was not run**, and that the
false-positive rate on real-world markup was the largest remaining unknown. It
has been run: `docs/reports/2026-09-22-composition-live-corpus-v2.md`, 14
professionally designed pages mirrored locally (the sandbox re-terminates TLS
and the measurement browser rejects the proxy CA, so the pages come down through
`wget --ca-certificate` and are served back over 127.0.0.1 — the same mirroring
the original design-policy study used).

**The first run flipped the verdict on 7 of 14 designed pages.** Every one of
those findings was a false positive, and they fell into three mechanisms, all of
which are now fixed and pinned as regressions:

| mechanism | pages | fix |
|---|---|---|
| The block above the heading is a **kicker** — a breadcrumb, date, byline or eyebrow that belongs to the title. Set tight above it ON PURPOSE. | 6 | Climb through a block whose type is at most half the label's size (`KICKER_SIZE_RATIO`) |
| The label **opens its group**, so the boundary measured was its container's padding-top — not a thing it could be mis-grouped with | 2 | The boundary must be a preceding SIBLING; otherwise unjudgeable |
| The page **declares no heading at all**, so "nothing reads as the most important" describes a list rather than finding a defect | 1 | `no-type-contrast` requires ≥1 declared heading |

After the fixes: **13 of 14 clean**, and all five committed fixtures still
discriminate exactly as before — `proximity-broken` still reports 4 inversions,
the intact page still reports none.

### The fix that had to be un-made

The kicker test was first written as "short text and a smaller font". That is
wrong in the direction that matters: a 74-character paragraph is short, and body
text is *always* smaller than a heading, so it absorbed ordinary prose and then
measured the gap above *that* — inventing `before: 16` on web.dev's
`h2#monitor_lcp_breakdown_in_javascript`, where the rendered gaps are 32 above
and 32 below. Equal. No inversion at all.

What separates a kicker from a peer is **rank, not length**, and the two
populations are not close: breadcrumb-over-title measures 3.0x (16px under a
48px h1, on both web.dev and developer.chrome.com), body-prose-over-heading
1.5x, and a CodePen embed over an h3 1.67x. The cut at 2.0 has margin on both
sides. `textContent` length is a bad proxy for "short" anyway — that same
`devsite-article-meta` is one 24px line carrying 357 characters, most of them in
markup a reader never sees.

### The residual class, and why it is not fixed

One page still reports: css-tricks' related-post cards, five identical
instances of

```
FLEXBOX  IMAGES            <- tag row
Article on Oct 3, 2019     <- <time>, 7.7px above the title
Adaptive Photo Layout…     <- h3, the card's payload
                           <- 40px (an authored margin-top on the byline)
[avatar] Tim Van Damme     <- flush to the card's content bottom
```

The rule's premise is that a heading labels what follows it. In a card the
heading **is** the payload: `[tags, date, title]` is the head and the byline is a
separate group, deliberately pushed away. So the finding is a false positive —
and geometry cannot tell it from a true one. Its gap ratio is **5.2** (7.7 →
40), *higher* than the paired mutant's 3.7 (12 → 44), and its absolute gap above
(7.7px) sits close enough to the mutant's (12px) that any floor drawn between
them would be a free parameter tuned to the answer already wanted — the exact
trap this document records for grid conformance. It is left reporting, with the
mechanism written down, and `--allow "<selector>;<reason>"` is the lever for it.

That is the honest state of the rule: quiet on 13 of 14 production pages, and
unable to distinguish a card title from a drifted label.
