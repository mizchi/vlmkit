# Deterministic design-policy metrics — feasibility study

vlmkit guarantees function (nothing broken, copy present, responsive
boundaries hold, controls operable) and deliberately refuses to judge
aesthetics. The question here: **can design quality be gated
deterministically at all**, or is it all taste?

## The distinction that makes it possible

Beauty is not measurable. **Self-consistency is.** The line is:

| Not measurable (taste — stays out) | Measurable (policy — can be a gate) |
|---|---|
| "is 24px the right gap here?" | "you used 23px here and 24px in 40 other places" |
| "is this the right blue?" | "your buttons render 6 distinct padding/radius/size signatures" |
| "does this layout feel balanced?" | "these 4 cards sit on 4 different left edges" |
| "is this typography good?" | "12 distinct font sizes for 9 text roles" |

Everything in the right column is a **conformance or entropy measurement
against a system the page itself declares** — either an explicit token file
or the page's own dominant values. No taste required, no VLM required.

`check tokens` already does the explicit-policy half (values off a declared
radius/spacing/z-index scale). What is missing is the *inferred* half, and
that is where the interesting signal turned out to be.

## What was measured

Four candidate metrics, on three designed real pages (MDN, web.dev,
Wikipedia — mirrored) and five agent-built zero-shot fixtures
(`attempt-s15..s19-haiku.html`), all at 1280px, visible elements only
(`checkVisibility`, so collapsed `<details>` content does not pollute):

| page | els | spacing values | top-6 coverage | 4px-grid fit | left-rail top-8 | font sizes | **button signatures** |
|---|---|---|---|---|---|---|---|
| MDN | 1497 | 18 | 0.963 | 0.857 | 0.729 | 5 | **1 / 8** |
| web.dev | 801 | 11 | 0.940 | 0.716 | 0.742 | 7 | **1 / 5** |
| Wikipedia | 5802 | 41 | 0.812 | 0.234 | 0.406 | 13 | 2 / 25 |
| agent s15 | 51 | 9 | 0.883 | 0.922 | 0.686 | 6 | **3 / 6** |
| agent s16 | 82 | 9 | 0.952 | **0.978** | 0.744 | 6 | **3 / 8** |
| agent s17 | 70 | 7 | 0.989 | **1.000** | 0.957 | 7 | 1 / 1 |
| agent s18 | 67 | 9 | 0.945 | 0.898 | 0.955 | 5 | 2 / 2 |
| agent s19 | 50 | 11 | 0.864 | 0.864 | 0.420 | 8 | **6 / 7** |

"button signatures" = distinct `(padding×4, radius, font-size, height)`
tuples / number of button instances.

## Result: the obvious metric fails, the useful one is the opposite

**Grid conformance does not discriminate — agents beat designers at it.**
Agent pages score 0.86–1.00 on 4px-grid fit; MDN scores 0.857 and web.dev
0.716. LLM-written CSS uses round numbers religiously, so "is it on an 8px
grid" is a metric an agent passes trivially while still producing an
incoherent page. As a *policy* check (does this match OUR declared scale)
it remains valid — that is `check tokens` — but as a *quality* signal it is
close to worthless.

A methodological trap worth recording: my first implementation picked the
grid base with the best fit, which always chose **base 2** at 98% fit,
because every even number fits base 2. "Best fit" over a free parameter
measures nothing. The table above tests a fixed set (4, 8) and prefers the
largest base that still explains ≥80% of values.

**Component-signature uniformity discriminates sharply, and in the
direction that matters.** MDN renders 8 buttons with **one** signature;
web.dev 5 buttons with **one**. Agent s19 renders 7 buttons with **six**
distinct signatures; s15 and s16 sit at 3 signatures for 6 and 8 buttons.

That is the real, measurable difference between a designed page and a
generated one:

> Agent-built pages are **locally tidy but globally incoherent** — every
> value is a round number, and almost every component instance is a
> slightly different round number. Designed systems are the reverse: they
> may use odd values, but they *reuse* them.

Spacing-vocabulary concentration is a weaker version of the same signal
(top-6 coverage 0.81–0.99 across both groups — overlapping, so not usable
alone). Left-rail concentration is confounded by page size (Wikipedia 0.406
with 5802 elements vs s17 0.957 with 70) and needs normalisation before it
can carry a verdict.

## Proposed gate: `check design` (inferred-system conformance)

One new gate, four findings, all phrased as *consistency* claims with the
offending selectors attached — never as taste:

1. **`component-drift`** (the strong one) — group visible elements by
   inferred role (explicit `role`, or button/heading/link/input semantics),
   compute each instance's style signature, and report roles whose instance
   count exceeds their signature count by less than a threshold. Kickback
   names the minority signatures and the majority they deviate from:
   `7 buttons render 6 distinct signatures; 5 differ from the dominant
   (12/20/12/20, r=6, 14px, h=40) — .btn-ghost has padding 10/18/10/18`.
2. **`scale-outlier`** — derive the dominant spacing set from the page
   itself (values covering ≥90% of usages), then report the stragglers:
   `23px used once; 24px used 41 times — .card-footer`. This is the
   inferred-policy twin of `check tokens`, usable with no config.
3. **`rail-drift`** — for siblings in the same container, report left/right
   edges that differ by 1–3px (near-misalignment already exists as an
   integrity probe A12; this extends it to a whole-container verdict).
4. **`type-scale-sprawl`** — distinct font sizes vs distinct text roles,
   reported as a ratio with the outlier sizes named.

Severity: **warn by default**, not suspect. A page may legitimately have
three button variants; the finding is information for a human, and the
`--fail-on-suspect` contract should not turn "your design system has
drifted" into a build failure unless the team opts in with a declared
policy (`--policy design.json` pinning expected signature counts per role).

## Why this is worth building

- It is the first metric in this project that would have **failed the agent
  work we shipped**. Every S15–S19 fixture passed all functional gates
  while carrying 3–6 button signatures. The functional gates cannot see
  this class at all.
- It needs no reference design, no tokens file, and no VLM — the page is
  compared against itself.
- It fixes an asymmetry in the pitch: vlmkit tells an agent when the page
  is *broken*, but says nothing when the page is *incoherent*, which is the
  more common outcome of generated markup.

## What stays out

- Any judgement of *which* value is right. The gate reports that 23px and
  24px coexist; choosing between them is the human's.
- Colour harmony beyond the existing `check palette` / contrast work.
  "Do these hues go together" is taste.
- Visual hierarchy, balance, whitespace "feel", brand fit.
- The `2/25` case (Wikipedia): a large organic site will always show
  drift, and that is not a defect to fix — it is why the default is warn
  and why the gate is most useful on new/generated pages and design-system
  components, not on twenty years of accumulated wiki CSS.

## Open questions before implementation

1. **Role inference quality.** `button` is easy; "card" and "panel" are
   not. The gate should only group roles it can infer deterministically,
   and say which elements it skipped (no silent coverage gaps).
2. **Signature granularity.** Including rendered `height` catches real
   drift but also flags a button that is taller only because its label
   wrapped. Height may belong in a separate finding from the style tuple.
3. **Threshold shape.** `signatures/instances` is scale-sensitive at small
   n (1 button = 1 signature = perfect). Needs a minimum instance count
   (≥3) before reporting, like the other probes' floors.
4. **State confusion.** A `:disabled` or `aria-pressed` button legitimately
   differs. Signatures should be computed per resting state, or states
   detected and excluded — the interaction gate already knows how to find
   them.
