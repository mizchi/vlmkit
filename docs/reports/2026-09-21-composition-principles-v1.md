# check composition v1 — the four design principles, measured

2026-09-21

Question: can the four classical composition principles (近接 proximity / 整列
alignment / 反復 repetition / 対比 contrast) be pulled out of a render cheaply
and deterministically, and do the numbers agree with what a vision model sees?

Answer: three of the four, with four rules. 反復 was already covered. Six of
eleven candidate metrics were rejected. The study is
`docs/design/composition-metrics.md`; this is the run record.

## Method

`check design`'s own corpus split (designed pages vs agent-built ones) turned
out to be unusable here — the agent fixtures are app shells with **zero**
heading-led groups, so the two groups differ by page kind rather than by
composition quality. Replaced with paired mutants.

```
6 designed pages x (1 original + 8 single-principle CSS mutations) = 54 runs
```

Pages: `fixtures/css-challenge/{blog-magazine,landing-product,ecommerce-catalog,page,admin-panel,form-app}.html`,
at 1280x900, `networkidle` + fonts ready + 150ms.

Mutations, injected with `page.addStyleTag` so the fixture is untouched:

| name | principle | CSS |
|---|---|---|
| `prox-invert` | 近接 | `h1..h6 { margin-top: 2px; margin-bottom: 44px }` |
| `prox-uniform` | 近接 | `* { margin: 18px 0; gap: 18px }` |
| `rail-scatter` | 整列 | `body > * > *:nth-child(3n+2) { margin-left: 37px }` etc. |
| `rail-near-miss` | 整列 | `section:nth-of-type(2n) { margin-left: 5px; margin-right: -5px }` |
| `align-mix` | 整列 | `*:nth-child(2n) { text-align: center }` etc. |
| `flat-hierarchy` | 対比 | `h1..h6 { font-size: 20px; font-weight: 600 }` |
| `no-range` | 対比 | `* { font-size: 15px; font-weight: 400 }` |
| `repeat-break` | 反復 | `*:nth-child(3n+1) { padding: 9px; border-radius: 2px }` etc. |

A metric had to fire on its own mutant **and stay silent on the other seven**.
That second condition is what separates a metric measuring a principle from one
responding to any CSS change.

## Confusion matrix (shipped judge, 54 runs)

```
page                          lbl PROX rail FLAT NOC verdict
admin-panel__orig              0   0    0    0    0  composed
admin-panel__prox-invert       4   4    0    0    0  unbalanced
admin-panel__prox-uniform      4   1    0    0    0  unbalanced
admin-panel__flat-hierarchy    0   0    0    1    0  unbalanced
admin-panel__no-range          0   0    0    1    1  unbalanced
admin-panel__align-mix         0   0    0    0    0  composed
admin-panel__rail-near-miss    0   0    0    0    0  composed
admin-panel__rail-scatter      0   0    0    0    0  composed
admin-panel__repeat-break      0   0    0    0    0  composed
blog-magazine__orig            4   0    0    0    0  composed
blog-magazine__prox-invert     3   3    0    0    0  unbalanced
blog-magazine__flat-hierarchy  4   0    0    2    0  unbalanced
blog-magazine__no-range        4   0    0    2    1  unbalanced
ecommerce-catalog__orig        5   0    0    0    0  composed
ecommerce-catalog__prox-invert 5   5    0    0    0  unbalanced
ecommerce-catalog__rail-near-miss 5 0   2    0    0  composed
form-app__orig                 0   0    0    0    0  composed
form-app__prox-invert          0   0    0    0    0  composed   <- no judgeable label
form-app__rail-near-miss       0   0    4    0    0  composed
form-app__repeat-break         0   0    5    0    0  composed   <- cross-talk
landing-product__orig          7   0    1    0    0  composed
landing-product__prox-invert   8   5    1    0    0  unbalanced
page__orig                     3   0    0    0    0  composed
page__prox-invert              3   3    0    0    0  unbalanced
```

(Abridged; the full 54 rows come from `judgeComposition` over the collected
samples.)

| rule | specificity (originals) | sensitivity (own mutant) | cross-talk (other 7) |
|---|---|---|---|
| `proximity-inversion` | **6/6 silent** | 5/6 | **0/24** |
| `flat-heading-step` | **6/6 silent** | 5/6 | **0/24** |
| `no-type-contrast` | **6/6 silent** | **6/6** | **0/24** |
| `rail-near-miss` | 5/6 silent | 3/6 | fires on `repeat-break` (3/6) |

Both 5/6 misses are `form-app`, and both are reported rather than hidden: it has
no judgeable label (every heading opens a bordered card, where the card does the
grouping) and one heading level (nothing to compare).

## On the 16 real pages, with no mutation

```
page                 lbl PROX rail FLAT NOC verdict
admin-panel           0   0    0    0    0  composed
attempt-haiku         1   0    0    0    0  composed
attempt-s15-haiku     0   0    0    0    0  composed
attempt-s16-haiku     2   0    0    0    0  composed
attempt-s17-haiku     1   0    0    0    0  composed
attempt-s18-haiku     2   0    2    0    0  composed
attempt-s19-haiku     0   0    0    0    0  composed
blog-magazine         4   0    0    0    0  composed
dashboard             0   0    0    0    0  composed
ecommerce-catalog     5   0    0    0    0  composed
form-app              0   0    0    0    0  composed
grid-complex          0   0    0    0    0  composed
index                20   0    5    0    0  composed
landing-product       7   0    1    0    0  composed
page                  3   0    0    0    0  composed
stacking-context      3   0    1    1    0  unbalanced
```

**Zero proximity false positives across all 16.** The one carried finding is
`stacking-context`, and it is a true positive: it declares `h2` and `h3` and
renders both at 16px at the same weight.

## Why this is a separate gate

`check design` on the intact page and on `proximity-broken.html` prints
**byte-identical** findings — 12 buttons / 6 styles / reuse 2x, both times. No
style signature changes when a heading's margins move, so style reuse cannot see
this defect class at all.

The reverse also holds, which is why 反復 stays where it is: `repeat-break`
moved `check design` from 6 to 7 button styles and reuse 2.0x → 1.71x, while
`check composition` stayed silent.

## VLM cross-check — 8/8 agreement

14 screenshots (originals and mutants, shuffled, filenames `01.png`…`14.png`,
key withheld). A vision model read 8 and recorded a verdict per principle before
the key was revealed.

| img | truth | vision reader | gate |
|---|---|---|---|
| 01 | form-app `rail-near-miss` | "cards sit ~5px apart" → alignment | `rail-near-miss` x4 |
| 02 | blog `rail-near-miss` | clean | nothing |
| 03 | form-app original | clean | nothing |
| 04 | ecommerce `flat-hierarchy` | "hero no bigger than the section heads" | `flat-heading-step` x2 |
| 05 | blog original | clean | nothing |
| 06 | ecommerce original | clean | nothing |
| 07 | ecommerce `prox-invert` | "every heading detached from its content" | `proximity-inversion` x5 |
| 08 | page `rail-near-miss` | clean | nothing |

Rows 02 and 08 look like reader misses and are the strongest rows in the table:
both are mutants whose CSS did not match those pages' structure, so there was
nothing to see — and the gate reported nothing too. Agreement on absence is the
property a gate nobody watches actually needs.

Row 01 is the calibration: 5px is the perceptibility floor, caught only where
two cards sit adjacent and comparable. That is why `rail-near-miss` is `info`.

## Measurement bugs found and fixed

Four false positives / blind spots on intact pages, each now a regression test:

1. Measuring past the content — a heading compared to the next *text*, below a
   280px chart, reported a 283px gap. A heading's content can be an image.
2. A whole card read as a label (`form-app`'s `div.card`, a 16-vs-24px
   "inversion"). Fixed geometrically: a label is a box about as tall as its type.
3. The vacuous comparison — a heading flush with its group edge has `before = 0`
   and `after >= 0 * 1.5` is always true. Three false positives on
   blog-magazine's intact panels.
4. …and the blind spot that replaced it: **margin collapsing** puts an unbounded
   `<section>`'s border box exactly on its first heading, so declining to judge
   flush headings made `proximity-broken.html` report COMPOSED with **zero
   labels judged**. Fixed by climbing to the parent's own boundary; coverage on
   `examples/vlmkit-intro-page` went 4 → 20 labels.

## Not done

Live-URL validation against real-world designed pages did not run: the sandbox
re-terminates TLS and Chromium rejects the proxy CA (`ERR_CERT_AUTHORITY_INVALID`),
so MDN / web.dev / Hacker News could not be loaded. The false-positive rate on
production markup is the largest remaining unknown, and the reason every rule
ships at `warn` or `info` rather than `suspect`. Next round should run the same
16-page table against 10-15 live pages.

## Reproducing

```bash
vlmkit check composition fixtures/composition/composed.html          # COMPOSED
vlmkit check composition fixtures/composition/proximity-broken.html  # 近接
vlmkit check composition fixtures/composition/rail-broken.html       # 整列 (info)
vlmkit check composition fixtures/composition/hierarchy-broken.html  # 対比
vlmkit check composition fixtures/composition/contrast-broken.html   # 対比 floor

# the same page through the style gate, which sees none of it
vlmkit check design fixtures/composition/proximity-broken.html
```

Each broken fixture is `composed.html` plus **one** overriding rule, so a
finding can only be attributed to the principle that rule breaks.
