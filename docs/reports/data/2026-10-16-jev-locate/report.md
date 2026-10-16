# Jev box bench — `jev-1.14.0`

## Grounding: one `box` per named element

85 targets on 9 fixtures (1280x800 viewport, DPR 1). Edge resolution returned: **0.01** of the image (12.8px horizontally on 1280).

| | n | mean IoU | median IoU | IoU≥0.5 | click hit | covers | median edge err px |
|---|---:|---:|---:|---:|---:|---:|---:|
| all | 85 | 0.51 | 0.50 | 48% | 89% | 8% | 13.5 |
| small (short edge 16-27px) | 19 | 0.47 | 0.43 | 37% | 89% | 26% | 8.4 |
| medium (short edge 28-79px) | 64 | 0.51 | 0.50 | 50% | 89% | 3% | 15.5 |
| large (short edge ≥80px) | 2 | 0.89 | 0.89 | 100% | 100% | 0% | 7.5 |
| role: button | 21 | 0.57 | 0.62 | 62% | 86% | 5% | 8.5 |
| role: dropdown | 1 | 0.81 | 0.81 | 100% | 100% | 0% | 4.8 |
| role: heading | 18 | 0.51 | 0.44 | 39% | 94% | 22% | 13.5 |
| role: link | 37 | 0.44 | 0.43 | 35% | 86% | 5% | 20.2 |
| role: text field | 8 | 0.66 | 0.73 | 88% | 100% | 0% | 8.2 |

**Padding needed before a crop holds the whole target** (each edge grown by a fraction of the box, min px):

| pad | covers |
|---|---:|
| 0x, ≥0px | 8% |
| 0.25x, ≥4px | 52% |
| 0.5x, ≥8px | 69% |
| 1x, ≥16px | 91% |

**Confidence** — median 0.84 on click hits (n=76), 0.81 on misses (n=9); AUROC for click hit 0.58, for IoU≥0.5 0.52.

<details><summary>Click misses</summary>

| target | truth px | IoU | conf |
|---|---|---:|---:|
| blog-magazine-5: the "Interviews" link | 1031,54 96x46 | 0.00 | 0.71 |
| blog-magazine-2: the "Cities" link | 956,54 65x46 | 0.08 | 0.81 |
| page-0: the "Marketplace" link | 1109,18 84x21 | 0.12 | 0.87 |
| ecommerce-catalog-6: the "Collections" link | 952,62 112x44 | 0.12 | 0.72 |
| ecommerce-catalog-2: the "Audio" button | 170,257 70x42 | 0.15 | 0.79 |
| landing-product-4: the "Watch demo" button | 242,523 133x55 | 0.15 | 0.88 |
| ecommerce-catalog-5: the "Build a bundle" button | 540,431 145x50 | 0.20 | 0.90 |
| landing-product-1: the "Customers" link | 1001,49 110x45 | 0.25 | 0.50 |
| admin-panel-11: the "Create handoff note" heading | 917,345 232x27 | 0.30 | 0.86 |

</details>

## Locate: `locateByDescription` end to end

Presence (`noul`) and a first `box` in one request, then a `box` on the magnified crop. What a caller of the shipped function gets.

- Targets found: **81/85**; of those, the click point on the target **80/81**. End to end (found and on target): **94%**.
- Decoys reported not found: **85/85**.
- Median edge error of found targets: 4.1px; median IoU 0.75.

Not found: the "Night shift EU daytime US evening" dropdown on admin-panel (0.10); the text field whose placeholder reads "Choose a username" on form-app (0.01); the text field whose placeholder reads "you@example.com" on form-app (0.00); the text field whose placeholder reads "Enter your name" on form-app (0.01).

Found but off target: the "Build a bundle" button on ecommerce-catalog (IoU 0.40).

## Cost and latency

| stage | calls | questions | median latency ms | input tokens / call | USD total |
|---|---:|---:|---:|---:|---:|
| ground | 9 | 85 | 215 | 3143 | 0.00119 |
| locate | 251 | 421 | 287 | 3184 | 0.03357 |
