# check composition v2 — the false-positive rate on production markup

2026-09-22

v1 (`docs/reports/2026-09-21-composition-principles-v1.md`) shipped the gate on
54 paired-mutant runs and ended by naming what it had not done:

> Live-URL validation against real-world designed pages **was not run**: the
> sandbox re-terminates TLS and Chromium rejects the proxy CA. The
> false-positive rate on production markup is the largest remaining unknown, and
> the reason every rule ships at `warn` or `info` rather than `suspect`.

This round runs it. **The verdict flipped on 7 of 14 professionally designed
pages, and every one of those findings was a false positive.** Three mechanisms,
all fixed; 13 of 14 clean afterwards, with fixture sensitivity unchanged.

## Getting the pages in

Chromium will not accept the sandbox's egress CA
(`ERR_CERT_AUTHORITY_INVALID`), so the gate cannot be pointed at a live URL.
`wget --ca-certificate=/root/.ccr/ca-bundle.crt` does accept it, so the pages
come down through the trusted path, keep their stylesheets and fonts
(`--page-requisites --convert-links`), and are served back over `127.0.0.1`
(in `no_proxy`, so no TLS at all). This is the same mirroring
`docs/design/design-policy-metrics.md` used for its own reference set.

Each mirror's fidelity was checked before it was measured, not after: stylesheet
count, applied rule count, element count, rendered height, resolved body font,
plus a screenshot. That check earned its keep — `react.dev/learn` came down as
a **6-element, 900px-tall blank page** (a React SPA whose mirror is just the
shell) and was dropped. Two other bugs it caught in the harness itself: `wget
--adjust-extension` writes the entry at the URL's own path depth, and a
"first `index.html` anywhere" fallback picked css-tricks' 20KB
`license/embed/index.html` instead of the 719KB article. Entries are now derived
deterministically from the URL path.

**14 pages measured**: MDN (`box-shadow`, `Learn_web_development`), web.dev,
developer.chrome.com, css-tricks, Smashing Magazine, NN/g, react.dev *(dropped)*,
tailwindcss, caniuse, a11yproject, W3C APG, Wikipedia, Hacker News, danluu.

## First run: 7 of 14 flipped

```
page          verdict      labels  warn findings
a11yproject   composed     20      —
caniuse       composed      0      —
chromedev     unbalanced    9      proximity-inversion=1
csstricks     unbalanced   19      proximity-inversion=6
danluu        unbalanced    0      no-type-contrast=1
hackernews    composed      0      —
mdn-learn     composed      7      —
mdn           composed     20      —
nngroup       unbalanced   23      proximity-inversion=1
smashing      composed      1      —
tailwind      unbalanced   29      proximity-inversion=1
w3c-apg       unbalanced    3      proximity-inversion=1
webdev        unbalanced   25      proximity-inversion=1
wikipedia     composed     10      —
```

`flat-heading-step` fired **zero times** across all 14 — the one rule that
needed no change.

## The three mechanisms

### 1. The kicker (6 pages)

Every proximity firing but one had the same shape. web.dev:

```
Home > Articles > Resources > Learn Core Web Vitals   <- 16px, 16px above
Optimize Largest Contentful Paint                     <- h1, 48px
                                                      <- 32px
A step-by-step guide on how to break down LCP…        <- body
```

The breadcrumb is set tight above the title **on purpose**: the two read as one
title block, and the wider gap below separates that block from the body. That is
the most conventional editorial layout on the web, and the rule was calling it a
mis-grouping. Same shape on developer.chrome.com (`devsite-article-meta`),
css-tricks (`breadcrumbs`), tailwindcss (an eyebrow `p.flex`).

**Fix**: climb *through* such a block instead of measuring against it. What
makes it a kicker is its **rank**, and the populations are far apart:

| relation | ratio |
|---|---|
| 16px breadcrumb under a 48px h1 (web.dev, chrome) | **3.0** |
| 16px `<p>` under a 24px h2 (web.dev, chrome) | 1.5 |
| 19.2px CodePen embed under a 32px h3 (css-tricks) | 1.67 |

A cut at 2.0 has margin on both sides.

**This fix had to be un-made once.** It was first written as "short text and a
smaller font", which absorbed a 74-character *body paragraph* and measured the
gap above it — inventing `before: 16` on web.dev's
`h2#monitor_lcp_breakdown_in_javascript` where the rendered gaps are **32 above
and 32 below**. Equal. Not an inversion at all, and the bug turned 1 finding
into 2 on three pages. Length is the wrong axis: body text is always smaller
than a heading, and `textContent` length is a bad proxy for "short" anyway —
`devsite-article-meta` is one 24px line carrying **357 characters**, most of them
in markup nobody sees.

### 2. The label that opens its group (2 pages)

W3C APG's page title sits 4.7px below `main`'s content edge and 27.5px above the
body; NN/g's footer heading, 16px below the footer's padding edge and 32px above
its list. Both were judged against **their container's padding-top**, which is
not something the label could be mis-grouped with — nothing above it is inside
the group at all.

**Fix**: the boundary must be a preceding **sibling**. When the climb runs out of
siblings the label is unjudgeable and says so. (The climb itself stays — it is
what handles margin collapsing, where an unbounded `<section>`'s border box
begins exactly where its first heading does.)

A related sub-case: NN/g stacks its footer sections *flush*, so the gap above
measured **0** and the ratio test went vacuous — anything is `>= 0 * 1.5`. A zero
gap means paint is doing the separating, not space, so it is now unjudgeable
too.

### 3. A page that declares no heading (1 page)

danluu.com is a date-and-link index: every row 16px/400, no headings, by design.
`no-type-contrast` reported that nothing is emphasized — **true**, and a correct
description of a list rather than a defect found in one.

**Fix**: the rule requires at least one declared heading. A page has to *claim* a
hierarchy before it can fail to render one.

## After the fixes

```
page          verdict      labels  warn  info
a11yproject   composed     20      —     —
caniuse       composed      0      —     —
chromedev     composed      5      —     rail-near-miss=1
csstricks     unbalanced   17      proximity-inversion=6
danluu        composed      0      —     —
hackernews    composed      0      —     rail-near-miss=2
mdn-learn     composed      5      —     —
mdn           composed     18      —     —
nngroup       composed     20      —     rail-near-miss=3
smashing      composed      0      —     rail-near-miss=2
tailwind      composed     24      —     rail-near-miss=2
w3c-apg       composed      2      —     rail-near-miss=3
webdev        composed     24      —     rail-near-miss=2
wikipedia     composed     10      —     rail-near-miss=5
```

**13 of 14 clean.** `rail-near-miss` is `info` and never carried a verdict; it
fires on 8 pages, which is consistent with what v1 measured about it.

Sensitivity is unchanged — every committed fixture still discriminates:

| fixture | verdict | findings |
|---|---|---|
| `composed.html` | COMPOSED | — |
| `proximity-broken.html` | UNBALANCED | `proximity-inversion` x4 |
| `rail-broken.html` | COMPOSED | `rail-near-miss` x2 (info) |
| `hierarchy-broken.html` | UNBALANCED | `flat-heading-step` |
| `contrast-broken.html` | UNBALANCED | `flat-heading-step` x2, `no-type-contrast` |

## The residual class, left reporting on purpose

css-tricks' related-post cards, five identical instances:

```
FLEXBOX  IMAGES            <- tag row
Article on Oct 3, 2019     <- <time>, 7.7px above the title
Adaptive Photo Layout…     <- h3 19.2px, the card's payload
                           <- 40px: an authored margin-top on the byline,
                              which sits flush to the card's content bottom
[avatar] Tim Van Damme
```

The rule's premise is that a heading labels what follows it. In a card the
heading **is** the payload: `[tags, date, title]` is the head and the byline is a
separate group, pushed away deliberately. So this is a false positive — and
geometry cannot tell it from a true one:

- its gap ratio is **5.2** (7.7 → 40), *higher* than the paired mutant's **3.7**
  (12 → 44), so the ratio cannot separate them;
- its absolute gap above is **7.7px** against the mutant's **12px** — close
  enough that any floor drawn between them is a free parameter tuned to the
  answer already wanted, which is precisely the trap
  `docs/design/composition-metrics.md` records for grid conformance.

So it keeps reporting, the mechanism is written down, and
`--allow "<selector>;<reason>"` is the lever. Inventing a fourth threshold to
make this one page green would have made the study worthless.

## What changed in the code

- `isKicker` + `KICKER_SIZE_RATIO` — climb through a block at most half the
  label's type size.
- `gapAbove` resolves to a preceding sibling only; a flush (`< 1px`) gap is
  unjudgeable.
- `no-type-contrast` requires `hierarchy.levels.length > 0`.
- Four new regression tests, one per lesson including the un-made fix, so the
  char-length version cannot come back. 40 tests on the pure judge.

Full suite 304 files / 3807 tests green; `pnpm typecheck` clean.

## Reproducing

```bash
bash output/live-corpus/mirror.sh                       # mirror the corpus
python3 -m http.server 8099 --directory output/live-corpus/pages &
node output/live-corpus/shoot.mjs                       # fidelity + screenshots
vlmkit check composition http://127.0.0.1:8099/webdev/articles/optimize-lcp.html
```

The harness lives under `output/` (gitignored) because it depends on the live
web; the corpus list and the per-page numbers above are the reproducible part.

## Still open

- **`rail-near-miss` was not classified on this corpus.** It fired 26 times
  across 8 pages at `info`. Whether those are stray margins or sub-pixel layout
  is unmeasured — it does not carry a verdict, so it was not the priority, but it
  is the obvious next round.
- **One page kind is missing**: every page here is content-led. An app shell
  (the kind v1 found has no heading-led groups at all) would exercise the
  `nothing-judged` path on production markup rather than on a fixture.
