# Jev 1.14 box / image bench (2026-10-16)

TypeSafe's [Jev 1.14](https://typesafe.ai/blog/jev-1-14) (`jev-1.14.0`, released 2026-10-14) is a
"System One" model. It writes no prose. A request is a `state` (text, objects, images) plus typed
questions, and each answer comes back typed: `box` (one bounding box plus a confidence, new in 1.14),
`noul` (the probability that a statement is true), `choice` and `score`. Nothing has to be parsed,
so it fits vlmkit's judges directly. This round measures what it can do on UI screenshots against a
truth read from the DOM or the pixels.

```bash
node --experimental-strip-types src/experiments/benchmark/jev-box/jev-box.ts \
  --per-fixture 12 --out test-results/jev-box --md report.md     # TYPESAFEAI_API_KEY, ~3 min, ~$0.045
node --experimental-strip-types src/experiments/benchmark/jev-box/jev-box.ts \
  --rescore --out docs/reports/data/2026-10-16-jev-box           # this round's answers, no key
```

Client: `@mizchi/vlmkit-ai/jev-client.ts` (`askJev`, multipart, image header, limits checked
locally, 429 retry). Raw answers and the generated tables: `docs/reports/data/2026-10-16-jev-box/`.

## Setup

- **Ground truth for grounding**: the 9 CSS-challenge fixtures captured at a 1280x800 viewport and
  DPR 1, so one CSS px is one image px (Jev rejects edges over 1568px and does not resize). The
  targets are links, buttons, headings and form fields with a label of 2-40 characters that
  appears nowhere else on the page. Each one sits fully inside the viewport and is topmost at its
  own centre, and its truth box is `getBoundingClientRect()`. Up to 12 targets per fixture, seeded:
  85 in all.
- **Ground truth for changes**: zoom-accuracy's planted cases at DPR 1, two variants per kind.
  Each case changes one ≤13px digit, sets a short label to a seeded hue, shifts one element by
  1-6px, or changes nothing. The truth is the changed pixels' bounds. Each case is cut to a
  1280-wide window of at most 900px centred on the change. `ecommerce-catalog` was dropped because
  its two unchanged DPR-1 captures differ in a 2x6px region, which leaves 57 cases.
- Questions name the image in backticks, as the docs ask (``the "Issues" link in `screenshot`.``).
  The screenshot goes in `state` once, and all of a fixture's questions share one request.

## Results

### 1. Grounding: one `box` per named element

| | n | mean IoU | median IoU | IoU≥0.5 | click hit | median edge err px |
|---|---:|---:|---:|---:|---:|---:|
| single look | 85 | 0.51 | 0.50 | 48% | **89%** | 12.2 |
| refined (2nd call on a 4x crop) | 85 | 0.60 | 0.71 | 65% | **96%** | 5.2 |

"Click hit" means the box's centre falls on the element.

- **Edges come back at two decimals.** Every edge value is a multiple of 0.01, which is 12.8px on
  a 1280px screenshot and 8px on 800px. A single look cannot be finer than that, and a 21px-tall
  nav link spans about 2.6 steps. The median edge error of 12px is the grid, not a misread.
- **A second call on a crop recovers it.** The crop is the first box padded 1x, grown to the
  API's 280px minimum and magnified up to 4x (median 4x). On that crop the median edge error
  halved (12.2 → 5.2px). 6 click misses were fixed and none broken, and IoU rose by more than
  0.05 on 50 targets and fell by more than 0.05 on 24. The refined boxes are tight (they cover
  the whole element 1% of the time), so pad before cropping.
- **The single-look misses are neighbours.** All 9 are a box on the adjacent item in the same nav
  or button row, for example "Marketplace" boxed as the link before it and "Cities"/"Interviews" in a
  magazine nav. It never boxed a random place.
- **`confidence` does not tell a good box from a bad one.** AUROC is 0.56 for click hit and 0.52 for
  IoU≥0.5. The median is 0.84 on hits and 0.82 on misses. Do not gate on it: refine instead.
- Padding the single-look box by 1x (at least 16px) makes it hold the whole target 87% of the time.

### 2. Presence: `noul` on targets vs decoys

`box` always returns a box, so there is no "not found" answer and absence has to be asked with a
`noul`. The positives were the 85 real targets ("`screenshot` shows the "Issues" link"). The
negatives were 85 decoys, labels taken from other fixtures.

- AUROC **0.98**. At 0.5 it accepted 95% of the targets and **0% of the decoys**.
- The four rejected targets: three are form-app text fields described by their **placeholder**
  (noul 0.00-0.01, though `box` found all three), and one is a long multi-line select label. So
  placeholder text does not count as "shown" for `noul`.

### 3. Changes on the whole screenshot (baseline + current in one state)

| planted | n | noul≥0.5 | box centre on the change (±8px) | mean IoU vs changed px |
|---|---:|---:|---:|---:|
| text (one digit, ≤13px) | 14 | 100% | 57% | 0.10 |
| color (seeded hue) | 18 | 100% | 94% | 0.22 |
| offset (1-6px) | 16 | **31%** | 19% | 0.07 |
| none | 9 | 11% false alarm | — | — |

The changed-vs-none AUROC is 0.96. Jev notices a colour or a digit and locates a colour, but it
mostly misses 1-6px shifts and its boxes are loose. A pixel diff does all three exactly and for
free, so this is not a job for Jev.

### 4. The vlmkit split: the pixel diff says where, Jev says what

Both captures are cropped to the changed pixels (padded 0.5x, at least 280px per edge) and
magnified up to 4x. Jev answers one `choice` over text / colour / position, plus the direction for
shifts.

| planted | n | → text | → color | → position | right |
|---|---:|---:|---:|---:|---:|
| text | 14 | 14 | 0 | 0 | **100%** |
| color | 18 | 0 | 18 | 0 | **100%** |
| offset | 16 | 0 | 0 | 16 | **100%** |

**48/48.** For position the confidence is lower (median 0.47, against 0.97-1.00 for the others),
but the choice is still right. The direction of a shift was right only 8/16 (chance is 1/5), so
take the direction from the deterministic `region-shift` estimate, not from Jev.

### Cost and latency

| stage | calls | questions | median latency | input tokens / call | USD |
|---|---:|---:|---:|---:|---:|
| ground | 9 | 85 | 159 ms | 3,143 | 0.0012 |
| refine | 85 | 85 | 505 ms | 3,608 | 0.0129 |
| present | 9 | 170 | 157 ms | 3,339 | 0.0013 |
| diff | 57 | 114 | 184 ms | 6,400 | 0.0153 |
| classify | 48 | 64 | 767 ms | 7,116 | 0.0144 |

Input costs $0.042 per Mtok and output is free, so one 1280x800 screenshot is about 3.1k tokens,
or $0.00013. **Questions on a shared state are nearly free**. The image is read once per request, not once per
question: `present` (18.9 questions a call) used 3,339 tokens against `ground`'s 3,143 (9.4 a
call) on the same screenshots, which is about 20 tokens per extra question. The whole round cost about $0.045. For scale, the
fix-loop's Stage-1 default (`ui-tars-1.5-7b`) answers in about 1.35s.

**Run to run**: the full bench was run twice. The single-look click hit was 89% both times, the
refined click hit 98% then 96%, the diff AUROC 0.94 then 0.96, and classify 48/48 both times.
Answers are not byte-identical between runs.

## What to build into vlmkit, in order

1. **Change-kind labelling of pixel-diff regions** (`diff png` / `--elements-html` output). Each
   region gets `kind: text | color | position` from one `choice`, at 48/48 for about $0.0003 and
   under 1s a region. This is the role `diff region` was deprecated from (it fabricated deltas
   and misattributed selectors), with the job split the other way round: pixels find the region,
   and Jev only names what changed, which a person can check by looking at the crop. Values stay
   deterministic: shift magnitude and direction from `region-shift.ts`, colours from the pixels.
2. **Grounding by description where there is no DOM.** `scan a11y` on Flutter web or Android, or
   `inspect interact` steps written as "click the Save button": box, then refine on a crop, then
   pad, for 96% click hit. Pair it with a `noul` for presence, because `box` cannot say "absent".
   Do not phrase targets by placeholder in the `noul`.
3. **Cheap typed gates as an advisory layer.** A `noul` or `choice` per screenshot ("shows an
   error banner", "page kind") at about $0.0001 a call, 0.2s, with no parsing. This is not a
   replacement for the deterministic gates.

Not worth building: whole-screenshot change detection with Jev (shifts 31%), and any decision
based on `box.confidence`.

## Limits of this round

- One viewport size (1280x800) and 9 fixtures, all synthetic CSS-challenge pages. There are no
  photos and no canvas apps yet, and there are few tiny targets (no targets with a short edge
  under 16px qualified, and only 2 over 80px).
- Each target was asked about with one phrasing. The `noul` presence result depends on wording
  (see the placeholders).
- The direction and magnitude questions were asked only through `choice` on the crop. A `score`
  over 1-6px was not tried.
