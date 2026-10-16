# `diff png --kind`: a model's label for each pixel-diff region (2026-10-16)

This builds item 1 of `2026-10-16-jev-box-bench.md`. The pixel diff finds the regions
deterministically, and Jev answers one typed `choice` per region, on both captures cut to the
region and magnified: was it **text**, **color**, **position**, or **presence** (appeared or
disappeared)? The region, `shift` and `colorSample` stay measured, and `kind` is the only field
that a model supplies.

```bash
vlmkit diff png baseline.png current.png --kind                  # TYPESAFEAI_API_KEY
vlmkit diff png baseline.png current.png --kind --json           # regions[].kind = {label, confidence, uncertain, model}
vlmkit diff png … --kind --kind-limit 4 --kind-model jev-preview
```

```
  regions:  4
    (160,160) 32x32 [content] #b0b4b8 -> #afb2b6 kind:text(0.99)
    (224,160) 96x32 [content] kind:text(0.99)
    (352,160) 160x32 [content] kind:position(0.49, uncertain)
    (544,160) 128x32 [content] #b5b9be -> #b5b9bd kind:position(0.25, uncertain)
  kind:     4 labelled by jev-1.14.0 (2 uncertain, 0 skipped), $0.00118 — a model's label on each crop, not a measurement
  summary:  1 icon-change, 1 element-added, 2 text-change
```

That example is `page-text`: one nav badge changed from "5" to "0" and widened, which pushed every
tab after it about 1px right. The deterministic `summary` calls the regions element-added and text
changes. The labels say text, text, position, position, which matches what happened.

Code: `@mizchi/vlmkit-ai/region-kind.ts` (window, scale, `labelRegionKinds`, the asker) and
`attachRegionKinds` in `packages/vlmkit-markup/src/png-diff.ts`. Bench stage:
`jev-box.ts --only regions`. Data: `docs/reports/data/2026-10-16-jev-region-kind/` (`--rescore`
reproduces the tables with no key).

## Setup

The eval runs end to end, as the CLI does. Each case's two captures go through
`compareScreenshots` (the same call that `diff png` makes, threshold 0.1), and every region it
returns is labelled on its own crop.

- **The cases are planted, at 1280px wide and DPR 1.** From zoom-accuracy, each case changes one
  ≤13px digit, sets a short label to a seeded hue, shifts one element by 1-6px, or changes nothing.
  This round also adds 17 **presence** cases: one named element per case is hidden with
  `visibility: hidden`, so nothing reflows. Half the cases hide it in `current` (disappeared) and
  half in `baseline` (appeared).
- **The crop** is the region padded by half its size on each side (at least 16px), grown to Jev's
  280px minimum and magnified up to 4x. Each region is its own request, because the crops of
  several regions in one request would exceed Jev's 64k context.
- **Scoring** checks a region against the planted kind only when it overlaps the planted element.
  The first version of the scorer counted every region, and so marked the `page-text` tabs above
  as four "text mislabelled as position". The tabs had moved, so those four labels were right.
  Regions off the planted element are listed as collateral and not scored.

## Results

74 cases gave 72 regions: 65 planted cases gave all 72, and the 9 unchanged cases gave none.
All 72 were labelled and none skipped. 65 regions overlap the planted element.

| planted | regions | → text | → color | → position | → presence | right | right at conf ≥ 0.6 |
|---|---:|---:|---:|---:|---:|---:|---|
| text | 14 | 14 | 0 | 0 | 0 | **100%** | 14/14 |
| color | 18 | 0 | 18 | 0 | 0 | **100%** | 18/18 |
| offset (1-6px) | 16 | 0 | 5 | 11 | 0 | **69%** | 6/6 |
| presence | 17 | 0 | 0 | 0 | 17 | **100%** | 17/17 |

Per case, labelled by its largest region on the planted element: text 14/14, color 18/18, offset
11/16, presence 17/17.

- **Every miss is a small shift read as colour.** A 1-2px move of antialiased text changes edge
  pixels much like a recolour does. Two of the five misses carry a measured `shift` (0,-2 and
  2,0), so the pixels already say "position" where the label says "color".
- **Here confidence carries signal**, unlike `box`'s in the grounding bench (AUROC 0.56). The
  AUROC for a right label is **0.97**. All 5 wrong labels were below 0.6, and 5 of the 60 right
  ones were. Those 5 right ones are all positions, which Jev answers with low confidence even
  when it is right. So `--kind` marks a label below 0.6 as `uncertain`
  (`REGION_KIND_SURE`). At or above it, 55 of 55 labels were right.
- **Adding the fourth option cost nothing on the other three.** The first round asked with three
  options (text / colour / position) on the planted box, and got 48/48. With `presence` added and
  the real regions as crops, text, colour and presence were all right. Shifts dropped from 16/16
  to 11/16. A likely cause, not separately measured: a real region of a moved element is
  sometimes only part of it, where the planted box showed the whole element.
- Collateral regions, which this round does not score, were labelled as follows. In the two
  `page-text` cases, the four shifted tabs were labelled `position` and all four were marked
  `uncertain`. The "Pull requests" region was labelled `text` (0.99) twice, though it moved and
  did not change. That is a wrong label above the threshold.

Cost: 72 calls, about 7.2k input tokens each, median 217ms, **$0.022 for the whole round** (about
$0.0003 a region). Regions are asked 4 at a time.

## Decisions in the implementation

- **Off by default, and refused without a key.** `--kind` is the only network call in `diff png`
  and the only output field that is not measured. Without `TYPESAFEAI_API_KEY` the command exits 2
  before measuring anything, and the message points at `--crop-regions` (look at the crops
  yourself) instead of returning a report that has no labels.
- **Largest regions first, at most 12** (`--kind-limit`). Regions past the limit get
  `kindSkipped`. So does a failed call (each region independently), and so does a pair of
  captures of different sizes: after a reflow the same window shows different content, so no one
  region's label would be true.
- **The direction of a shift is never asked.** Jev got it 8/16 on the crop in the first round,
  and `region.shift` measures it.
- **`summary` / `changes` (`classifyVisualDiff`) are unchanged**, so a JSON consumer sees exactly
  the shape it saw before, plus `regions[].kind` and a top-level `kind` summary only when
  `--kind` is given.

## Not covered

- All the pages are synthetic CSS-challenge fixtures at 1280px. There are no images, canvases or
  photos, and no change larger than one element. A region that mixes kinds (a re-layout that also
  recolours) still gets one label.
- The 0.6 threshold comes from 65 regions in one round. Re-check it when the model changes:
  `jev-latest` moves to 1.14.0 about a week after release, and a deprecation of 1.13 is announced.
