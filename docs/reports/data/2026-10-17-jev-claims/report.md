# Jev box bench — `jev-1.14.0`

## Claims: one `noul` per statement, all in one request per screenshot

54 screenshots: each fixture clean and with each of 5 plants. A claim is true on its own plant and on a fixture that natively shows it (form-app: error-banner; stacking-context: modal, looked at).

| claim (statement) | caught (true cases) | false alarm, clean pages | false alarm, other plants | AUROC | median noul true / false |
|---|---:|---:|---:|---:|---|
| error-banner: "an error message or error banner" | **14/14** | 0/8 | 0/32 | 1.00 | 0.99 / 0.01 |
| modal: "a modal dialog open over the page" | **14/14** | 0/8 | 2/32 | 1.00 | 0.99 / 0.03 |
| broken-image: "a broken or missing image" | **9/9** | 0/9 | 1/36 | 1.00 | 0.97 / 0.08 |
| overlap: "text overlapping other text so that it is hard to read" | **9/9** | 0/9 | 8/36 | 0.99 | 0.91 / 0.09 |
| loading: "a loading spinner or loading indicator covering the page" | **8/9** | 0/9 | 0/36 | 1.00 | 0.86 / 0.01 |

Missed: loading on landing-product/loading (0.49).

False alarms: overlap on admin-panel/broken-image (0.56), overlap on admin-panel/loading (0.75), broken-image on blog-magazine/loading (0.84), modal on dashboard/broken-image (0.55), overlap on dashboard/broken-image (0.59), overlap on ecommerce-catalog/broken-image (0.69), overlap on ecommerce-catalog/loading (0.58), modal on grid-complex/broken-image (0.84), overlap on landing-product/broken-image (0.66), overlap on page/broken-image (0.58), overlap on stacking-context/loading (0.53).

## Cost and latency

| stage | calls | questions | median latency ms | input tokens / call | USD total |
|---|---:|---:|---:|---:|---:|
| claims | 54 | 270 | 185 | 3047 | 0.00691 |
