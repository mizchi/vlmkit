# Jev box bench — `jev-1.14.0`

## Grounding: one `box` per named element

85 targets on 9 fixtures (1280x800 viewport, DPR 1). Edge resolution returned: **0.01** of the image (12.8px horizontally on 1280).

| | n | mean IoU | median IoU | IoU≥0.5 | click hit | covers | median edge err px |
|---|---:|---:|---:|---:|---:|---:|---:|
| all | 85 | 0.51 | 0.50 | 48% | 89% | 11% | 12.2 |
| small (short edge 16-27px) | 19 | 0.47 | 0.46 | 42% | 84% | 32% | 8.8 |
| medium (short edge 28-79px) | 64 | 0.51 | 0.49 | 48% | 91% | 5% | 16.2 |
| large (short edge ≥80px) | 2 | 0.87 | 0.87 | 100% | 100% | 0% | 9.1 |
| role: button | 21 | 0.59 | 0.66 | 71% | 86% | 5% | 7.6 |
| role: dropdown | 1 | 0.64 | 0.64 | 100% | 100% | 0% | 6.7 |
| role: heading | 18 | 0.49 | 0.44 | 39% | 89% | 22% | 13.3 |
| role: link | 37 | 0.43 | 0.42 | 30% | 89% | 8% | 19.6 |
| role: text field | 8 | 0.67 | 0.70 | 88% | 100% | 13% | 6.0 |

**Padding needed before a crop holds the whole target** (each edge grown by a fraction of the box, min px):

| pad | covers |
|---|---:|
| 0x, ≥0px | 11% |
| 0.25x, ≥4px | 49% |
| 0.5x, ≥8px | 69% |
| 1x, ≥16px | 89% |

**Confidence** — median 0.84 on click hits (n=76), 0.86 on misses (n=9); AUROC for click hit 0.49, for IoU≥0.5 0.50.

<details><summary>Click misses</summary>

| target | truth px | IoU | conf |
|---|---|---:|---:|
| blog-magazine-5: the "Interviews" link | 1031,54 96x46 | 0.00 | 0.78 |
| landing-product-1: the "Customers" link | 1001,49 110x45 | 0.00 | 0.52 |
| blog-magazine-2: the "Cities" link | 956,54 65x46 | 0.08 | 0.82 |
| ecommerce-catalog-2: the "Audio" button | 170,257 70x42 | 0.15 | 0.81 |
| landing-product-4: the "Watch demo" button | 242,523 133x55 | 0.20 | 0.87 |
| ecommerce-catalog-7: the "Delivery promise" heading | 45,545 126x23 | 0.22 | 0.86 |
| ecommerce-catalog-5: the "Build a bundle" button | 540,431 145x50 | 0.23 | 0.90 |
| page-0: the "Marketplace" link | 1109,18 84x21 | 0.25 | 0.88 |
| admin-panel-11: the "Create handoff note" heading | 917,345 232x27 | 0.29 | 0.86 |

</details>

## Refine: ask again on a magnified crop around the first box

Crop = first box padded 1x (≥16px), grown to ≥280px per edge, magnified up to 4x (median 4.0x). One extra call per target.

| | n | mean IoU | median IoU | IoU≥0.5 | click hit | covers | median edge err px |
|---|---:|---:|---:|---:|---:|---:|---:|
| single look | 85 | 0.51 | 0.50 | 48% | 89% | 11% | 12.2 |
| refined | 85 | 0.60 | 0.71 | 65% | 96% | 1% | 5.2 |

Paired: IoU up >0.05 on 50, down >0.05 on 24, of 85. Click hit flips: 6 fixed, 0 broken.

## Present: `noul` on targets vs decoys

`box` always returns a box, so absence has to be asked separately. 85 real targets, 85 decoys (labels from other fixtures).

AUROC **0.98**; at 0.5: 95% of targets accepted, 0% of decoys accepted. Median noul 0.98 / 0.01.

Targets rejected: "Night shift EU daytime US evening" on admin-panel (0.14), "Choose a username" on form-app (0.01), "you@example.com" on form-app (0.00), "Enter your name" on form-app (0.01).

## Diff: planted changes (zoom-accuracy cases), baseline + current in one state

48 planted, 9 unchanged. noul AUROC (changed vs none) **0.96**.

| kind | n | noul≥0.5 | median noul | box centre on change (±8px) | mean IoU vs changed px |
|---|---:|---:|---:|---:|---:|
| text | 14 | 100% | 0.98 | 57% | 0.10 |
| color | 18 | 100% | 0.98 | 94% | 0.22 |
| offset | 16 | 31% | 0.33 | 19% | 0.07 |
| none | 9 | 11% | 0.22 | — | — |

## Classify: the pixel diff says where, Jev says what

Both captures cropped to the changed pixels (padded 0.5x, ≥280px per edge) and magnified up to 4x; one `choice` over text / colour / position, plus direction for shifts.

| planted | n | text | color | position | right | median confidence when right / wrong |
|---|---:|---:|---:|---:|---:|---|
| text | 14 | 14 | 0 | 0 | **100%** | 1.00 / — |
| color | 18 | 0 | 18 | 0 | **100%** | 0.97 / — |
| offset | 16 | 0 | 0 | 16 | **100%** | 0.47 / — |

Shift direction right on **8/16** (chance ≈ 1/5).

## Cost and latency

| stage | calls | questions | median latency ms | input tokens / call | USD total |
|---|---:|---:|---:|---:|---:|
| ground | 9 | 85 | 159 | 3143 | 0.00119 |
| refine | 85 | 85 | 505 | 3608 | 0.01288 |
| present | 9 | 170 | 157 | 3339 | 0.00126 |
| diff | 57 | 114 | 184 | 6400 | 0.01532 |
| classify | 48 | 64 | 767 | 7116 | 0.01435 |
