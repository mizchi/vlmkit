# Jev box bench — `jev-1.14.0`

## Regions: `diff png --kind` end to end

The regions `compareScreenshots` finds on each case (not the planted box), each labelled on its own crop with four options. 65 planted cases gave 72 regions (72 labelled, 0 skipped); 9 unchanged cases gave 0 regions. 65 regions touch the planted element and are scored; 7 are collateral (the change moved something else) and listed apart.

Per region on the planted element:

| planted | regions | → text | → color | → position | → presence | right | right at conf ≥ 0.6 |
|---|---:|---:|---:|---:|---:|---:|---|
| text | 14 | 14 | 0 | 0 | 0 | **100%** | 14/14 |
| color | 18 | 0 | 18 | 0 | 0 | **100%** | 18/18 |
| offset | 16 | 0 | 5 | 11 | 0 | **69%** | 6/6 |
| presence | 17 | 0 | 0 | 0 | 17 | **100%** | 17/17 |

Confidence: 5/5 wrong labels and 5/60 right ones are below 0.6. AUROC of confidence for a right label 0.97.

Per case, the label of its largest region on the planted element:

| planted | cases | right |
|---|---:|---:|
| text | 14 | **14/14** |
| color | 18 | **18/18** |
| offset | 16 | **11/16** |
| presence | 17 | **17/17** |

<details><summary>Mislabelled regions on the planted element</summary>

| case | region | px | regionType | shift | label (conf) |
|---|---|---:|---|---|---|
| blog-magazine-offset | 32,416 256x64 | 1084 | content | 0,-2 | color (0.41) |
| ecommerce-catalog-offset | 640,768 256x64 | 1486 | content |  | color (0.36) |
| ecommerce-catalog-offset-2 | 32,416 160x64 | 688 | content | 2,0 | color (0.51) |
| stacking-context-offset | 768,512 96x64 | 433 | content |  | color (0.27) |
| stacking-context-offset-2 | 672,512 96x64 | 440 | content |  | color (0.32) |

</details>

<details><summary>Collateral regions (off the planted element), as labelled</summary>

| case | region | px | regionType | shift | label (conf) |
|---|---|---:|---|---|---|
| ecommerce-catalog-text-2 | 128,352 32x32 | 6 | content |  | text (0.96) |
| page-text | 224,160 96x32 | 93 | content |  | text (0.99) |
| page-text | 352,160 160x32 | 95 | content |  | position (0.39) |
| page-text | 544,160 128x32 | 122 | content |  | position (0.27) |
| page-text-2 | 224,160 96x32 | 93 | content |  | text (0.99) |
| page-text-2 | 352,160 160x32 | 95 | content |  | position (0.55) |
| page-text-2 | 544,160 128x32 | 122 | content |  | position (0.45) |

</details>

## Cost and latency

| stage | calls | questions | median latency ms | input tokens / call | USD total |
|---|---:|---:|---:|---:|---:|
| regions | 72 | 72 | 217 | 7171 | 0.02168 |
