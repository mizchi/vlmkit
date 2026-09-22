# check composition v3 — what `rail-near-miss` was actually reporting

2026-09-23

v2 (`docs/reports/2026-09-22-composition-live-corpus-v2.md`) ended by naming
`rail-near-miss` as the one rule whose live behaviour was measured and not
explained:

> **`rail-near-miss` was not classified on this corpus.** It fired 26 times
> across 8 pages at `info`. Whether those are stray margins or sub-pixel layout
> is unmeasured — it does not carry a verdict, so it was not the priority, but
> it is the obvious next round.

This round classifies every one of them. **Not one was a misalignment.** All of
them were the rule comparing two edges that had no reason to agree, in four
distinct mechanisms. One predicate fixes all four: the live corpus goes from 46
findings to **0**, and three separate alignment mutants all keep firing.

## Correcting the baseline first

v2's figure does not survive re-measurement, and the report is the record, so:
the pre-fix count is **46 rail pairs across 11 of the 14 pages**, not 26 across
8. v2's own table sums to 20, not the 26 its prose claims, and its `info` column
is blank for three pages (`csstricks` 6, `mdn` 2, `mdn-learn` 2) that do fire.
The gate caps the printed list at five rows per page, which is a third number
again (29). Everything below is the uncapped pair count, measured at the gate's
own settings — 1280x900, `networkidle` — so the before and after are the same
measurement.

```
page          pre-fix pairs
chromedev            1
csstricks            6
hackernews           2
mdn                  2
mdn-learn            2
nngroup              3
smashing             2
tailwind             2
w3c-apg              3
webdev               2
wikipedia           21
                    --
                    46      (a11yproject, caniuse, danluu, reactdev: 0)
```

## The four mechanisms

### 1. A block against its own ancestor's edge (the largest class)

Hacker News nests a 1070.4px `<table>` inside a 1074.4px one; the 2px is
cellpadding. Wikipedia's navboxes run `td` 631.4 → `div` 629.4 → `ul` 622.3,
three rails and two near misses per box, repeated down the page — **16 of its
21 findings**. css-tricks reports a 532px `<textarea>` inside its 536px form:
the field's border. w3c-apg has a `div.note` inset inside its `<section>`.

An ancestor and its descendant have *different containing blocks*. The delta is
the ancestor's own padding or border, so the same edge was never available to
both, and the difference is the design rather than a departure from it.

### 2. Two unrelated containers (the most misleading class)

css-tricks puts a 462px sidebar column and the 1032px article body on rails 7px
apart — different containers, thousands of pixels apart vertically, nothing in
common. Smashing compares a 761px header nav against a 512px article card.
NN/g, a 500px promo banner against a 754px table of contents. web.dev, an 801px
article aside against a 947px footer nav.

Nothing about a page says these edges should line up, so "two rails 7px apart"
is not a claim about the page at all. This is the same trap as the per-container
alignment metric v1 rejected, in mirror image: page-wide tallying escapes block
layout's freebie and buys conflation of *independent* rails.

### 3. Text extent (7 of Wikipedia's 21, plus MDN)

Wikipedia's citation runs — `span#mw-reference-text-cite_note-21`,
`cite#CITEREFBrekle2011`, `i`, `a` — are inline boxes 660-700px wide. An inline
box's right edge is **wherever the last line of prose ended**. Two of them 2px
apart is two sentences of near-equal length.

### 4. No recorded parent

MDN's skip links (`ul.a11y-menu>li>a`, 1261px wide, inset 2px inside the 1265px
full-bleed rail) sit at `parent: -1` — the collector records -1 when no ancestor
was kept as a box. So do the page-layout divs. This one only became visible
*after* the fix for the first three, and is in this list because reading -1 as
"same parent" left exactly these 4 findings standing on mdn and mdn-learn.

## The measurement

Five candidate narrowings, each against both populations. A narrowing is only
worth shipping if it reaches zero on the live corpus **and** keeps the mutant —
anything that silences the mutant too is measuring nothing. Two further mutants
of the same principle were written for this round, because the committed
`rail-broken` has only one shape of the defect and a narrowing can pass it by
luck:

- **`rail-broken-shrink`** — `margin-left: 5px` with no compensating negative
  margin, so the offset sections are 5px *narrower* as well as shifted. Only the
  left rail splits. Arguably the likelier authoring slip of the two.
- **`rail-broken-nested`** — the stray indent lands on the subsections *inside*
  a section, so the offset block is a descendant of the container it disagrees
  with.

| variant | what it requires | LIVE (14) | rail-broken | -shrink | -nested | other 4 fixtures |
|---|---|---|---|---|---|---|
| **current** | nothing | 46 | 2 | 1 | 2 | 0 |
| sameWidth | both rails' blocks equally wide | **0** | 2 | **0 ✗** | 2 | 0 |
| noNesting | neither rail's blocks nest in the other's | 34 ✗ | 2 | 1 | **0 ✗** | 0 |
| noTextExtent | neither rail carried only by inline boxes | 28 ✗ | 2 | 1 | 2 | 0 |
| siblingsNaive | shared `parent`, -1 included | 4 ✗ | 2 | 1 | 2 | 0 |
| **siblings** | shared real `parent` | **0** | **2** | **1** | **2** | **0** |

`siblings + noTextExtent` also measures 0/2/1/2, so the text-extent condition
adds nothing on top and does not ship. One predicate does the whole job.

### Two findings worth more than the fix

**The intuitive fix is wrong.** "Ignore ancestor/descendant pairs" addresses the
biggest class by name and is the first thing anyone would write — and it
silences `rail-broken-nested`, where a subsection really is indented 5px from
the rail its own siblings sit on. The distinction is not nesting. Wikipedia's
`td → div → ul` chain has no two *siblings* on the two rails; the mutant's `h2`
and `p` versus `div.subsection` does. Without the third mutant this round would
have shipped `noNesting` at 34 findings, or `sameWidth` at zero and blind to
half the defect.

**"Same width" is the other trap, and it looks better than it is.** It reaches
zero on the live corpus with a single one-line test, which is exactly how a
narrowing tuned to the answer presents itself. `rail-broken-shrink` is what
distinguishes them: an uncompensated `margin-left` changes the width too, so
requiring equal widths reports nothing on it.

## What shipped

`measureRails` now requires that **some block on each rail shares a parent with
some block on the other**, and the finding names that container:

```
i [rail-near-miss]: Two children of div.shell sit on left rails 5px apart
  (div.shell>header.masthead at 232px, div.shell>section at 237px; 4 block(s)
  on the second). Siblings share a containing block, so the same edge was
  available to both — nobody designs a 5px indent, so this is usually a stray
  margin. …
```

Naming the container is the point, not decoration: it is the entire reason the
two edges are comparable. Before this round the row said "two of the page's
rails", which on 11 of 14 production pages was describing an ancestor's padding,
two unrelated columns, or where a sentence happened to wrap.

`RailNearMiss` gained `via` and `siblingOnA`; both are in the `evidence` block.

## After the fix

Through the shipped CLI, at the gate's defaults:

```
=== fixtures ===
composed             composed    —
proximity-broken     unbalanced  proximity-inversion=4
rail-broken          composed    rail-near-miss=2
rail-broken-shrink   composed    rail-near-miss=1
rail-broken-nested   composed    rail-near-miss=2
hierarchy-broken     unbalanced  flat-heading-step=1
contrast-broken      unbalanced  flat-heading-step=2 no-type-contrast=1

=== live corpus ===
a11yproject   composed    labels=20   —      nngroup     composed    labels=20   —
caniuse       composed    labels= 0   —      reactdev    not-judged  labels= 0   nothing-judged=1
chromedev     composed    labels= 5   —      smashing    composed    labels= 0   —
csstricks     unbalanced  labels=17   proximity-inversion=6
danluu        composed    labels= 0   —      tailwind    composed    labels=24   —
hackernews    composed    labels= 0   —      w3c-apg     composed    labels= 2   —
mdn           composed    labels=18   —      webdev      composed    labels=24   —
mdn-learn     composed    labels= 5   —      wikipedia   composed    labels=10   —
```

**`rail-near-miss`: 46 → 0 on production markup, with every mutant still
firing.** Each alignment mutant reports only `rail-near-miss` and nothing else,
so the new fixtures are not leaking into the other three principles. csstricks'
6 `proximity-inversion` rows are v2's documented residual class (card titles
bonded to their dates, gap ratio 5.2 against the mutant's 3.7 — `--allow` is the
lever, not a fourth threshold).

Six unit tests on the pure judge, one per mechanism plus the two kept behaviours;
the suite's existing rail tests were rewritten because all of them used
`parent: -1` blocks, a shape the gate never sees on a real page.

## Reproducing

```bash
bash output/live-corpus/mirror.sh
python3 -m http.server 8099 --directory output/live-corpus/pages &
node output/live-corpus/rail-probe.mjs        # every pair, both rails, all blocks
node output/live-corpus/rail-classify.mjs     # attribute each to a mechanism
node output/live-corpus/rail-variants.mjs     # the variant table above
bash output/live-corpus/rail-verify.sh        # the shipped gate, fixtures + corpus
```

The harness is under `output/` (gitignored) because it depends on the live web;
the corpus list, the per-page counts and the variant table are the reproducible
part.

## Still open

- **The `nothing-judged` path is still only exercised by a mirror artefact.**
  `reactdev` reports `not-judged` on production markup, which is what v2 asked
  for — but it is a 6-element React shell whose content never came down, not a
  real app shell. An app shell with rendered content remains unmeasured.
- **`rail-near-miss` now has no live firings at all**, which means the corpus no
  longer says anything about its true-positive rate outside the fixtures. That
  is the right trade for a rule that was 46-for-46 wrong, but it does mean the
  only evidence it ever fires correctly is three mutants.
