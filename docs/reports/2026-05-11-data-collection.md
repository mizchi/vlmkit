# Data Collection — 2026-05-11

End-to-end measurements run after wiring up `vrt snapshot stability`,
`vrt snapshot fix-prompt`, the Cloudflare Browser Run CDP backend, and
the workflow capture-route decoupling. All runs use the local Chromium
backend so they form the baseline that future Cloudflare Browser Run
runs can be compared against.

## 1. Snapshot stability (false-positive rate)

`vrt snapshot stability` against the static migration fixture pages
served from a local HTTP server. Baseline locked on iteration 0; the
remaining iterations compare against it. Any non-zero diff counts as
a positive (`--fp-threshold 0`).

Command:

```bash
vrt snapshot stability \
  http://127.0.0.1:45333/migration/tailwind-to-vanilla/after.html \
  http://127.0.0.1:45333/migration/reset-css/normalize.html \
  http://127.0.0.1:45333/migration/reset-css/modern-normalize.html \
  http://127.0.0.1:45333/migration/shadcn-to-luna/after.html \
  --iterations 5 --fp-threshold 0
```

Results (32 comparisons = 4 URLs × 2 viewports × 4 follow-up iterations):

| URL | Viewport | Comparisons | Positives | FP rate | max diff |
|---|---|---|---|---|---|
| tailwind-to-vanilla/after.html | desktop | 4 | 0 | 0.00% | 0.00% |
| tailwind-to-vanilla/after.html | mobile | 4 | 0 | 0.00% | 0.00% |
| reset-css/normalize.html | desktop | 4 | 0 | 0.00% | 0.00% |
| reset-css/normalize.html | mobile | 4 | 0 | 0.00% | 0.00% |
| reset-css/modern-normalize.html | desktop | 4 | 0 | 0.00% | 0.00% |
| reset-css/modern-normalize.html | mobile | 4 | 0 | 0.00% | 0.00% |
| shadcn-to-luna/after.html | desktop | 4 | 0 | 0.00% | 0.00% |
| shadcn-to-luna/after.html | mobile | 4 | 0 | 0.00% | 0.00% |

**Overall FP rate: 0/32 = 0.00%.** Static fixtures + Chromium headless
shell + `networkidle` waits produce byte-stable PNGs across reloads, so
the new `stability` mode is well calibrated for future regression
detection (any non-zero rate on this baseline would indicate either
renderer drift or a new source of nondeterminism).

Raw report: `test-results/data-collection/stability/stability-report.json`

## 2. Migration-compare baselines

Re-ran `migration-compare` on every fixture under
`fixtures/migration/`. Breakpoint discovery in 2026-05 yields more
viewports than the original 2026-04 reports (13 for tailwind, 7 for
reset-css, 10 for shadcn), exposing diffs that the older 4-viewport
runs missed.

### 2.1 tailwind-to-vanilla (13 viewports)

| Variant | mobile (375) | sample-481 | below-640 | at-640 | sample-662 | below-768 | at-768 | sample-807 | below-1024 | at-1024 | desktop | sample-1423 | wide (1440) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| after.html | 31.06% | 27.56% | 26.71% | 4.90% | 4.78% | 4.26% | 4.35% | 4.19% | 3.53% | 2.47% | 1.99% | 1.79% | 1.78% |
| after-blank.html | 31.06% | 27.56% | 26.71% | 4.90% | 4.78% | 4.26% | 4.35% | 4.19% | 3.53% | 2.47% | 1.99% | 1.79% | 1.78% |

**Update (later the same day):** the 27–31% mobile drift turned out to
be infrastructure noise — the sandbox blocks `cdn.tailwindcss.com`
TLS, so `before.html` was rendering unstyled. After baking the
Tailwind CDN output into a new `before-inlined.html` fixture, the
re-measurement returns to **0.00% across all 13 viewports**:

| Variant vs `before-inlined.html` | All 13 viewports |
|---|---|
| after.html | **0.00%** |

Full diagnosis + fix: `docs/reports/2026-05-11-tailwind-fixture-reproducibility.md`.
The 2026-04-01 "0.0% pixel-perfect" claim is therefore reproducible —
the agent's hand-written vanilla CSS still matches Tailwind output at
every newly-discovered breakpoint, not just the four originally
tested.

Dominant fix candidates (against the broken CDN baseline, retained for
reference): `.col-hidden-mobile { display }`,
`.stats-grid { grid-template-columns }`, `.nav { display }`.

Raw report: `test-results/data-collection/migration-tailwind/migration-report.json`

### 2.2 reset-css (7 viewports)

| Variant | mobile | sample-481 | at-640 | above-640 | sample-866 | desktop | wide |
|---|---|---|---|---|---|---|---|
| modern-normalize.html | 2.62% | 2.06% | 1.55% | 1.55% | 1.86% | 1.26% | 1.12% |
| destyle.html | 12.71% | 11.45% | 10.12% | 10.14% | 7.96% | 7.03% | 6.82% |
| no-reset.html | 4.02% | 3.48% | 2.99% | 2.96% | 2.50% | 1.86% | 1.71% |

Baseline = `normalize.html`. modern-normalize is the closest neighbour
(1.1–2.6% diff, mostly color-change category). destyle is the largest
delta because it strips heading/typography defaults (7–12.7% diff,
dominated by header-nav layout changes).

Raw report: `test-results/data-collection/migration-reset/migration-report.json`

### 2.3 shadcn-to-luna (10 viewports)

| Variant | mobile | sample-546 | below-768 | at-768 | sample-813 | below-1024 | at-1024 | sample-1162 | desktop | wide |
|---|---|---|---|---|---|---|---|---|---|---|
| after.html | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% | 0.00% |
| after-blank.html | 58.36% | 52.74% | 51.42% | 33.65% | 33.32% | 28.12% | 22.06% | 20.52% | 20.15% | 19.55% |

The current luna CSS in `after.html` is genuinely pixel-perfect with
the shadcn baseline at every discovered viewport. `after-blank.html`
(minimal reset only, prepared earlier today for the blind-test
scaffold) sits at 19.6–58.4%, matching what the E3 report recorded.

Raw report: `test-results/data-collection/migration-shadcn/migration-report.json`

## 3. CSS Challenge detection rate (selector mode, no LLM)

```bash
NO_IMAGES=1 node --experimental-strip-types src/css-challenge-bench.ts \
  --fixture all --mode selector --trials 10 --no-db
```

| Fixture | Trials | Visual | A11y | Either | Silent | Rate |
|---|---|---|---|---|---|---|
| admin-panel | 10 | 8 | 3 | 9 | 1 | 90.0% |
| blog-magazine | 10 | 10 | 5 | 10 | 0 | 100.0% |
| dashboard | 10 | 9 | 3 | 10 | 0 | 100.0% |
| ecommerce-catalog | 10 | 9 | 4 | 10 | 0 | 100.0% |
| form-app | 10 | 8 | 4 | 9 | 1 | 90.0% |
| grid-complex | 10 | 7 | 3 | 10 | 0 | 100.0% |
| landing-product | 10 | 8 | 5 | 9 | 1 | 90.0% |
| page | 10 | 10 | 6 | 10 | 0 | 100.0% |
| stacking-context | 10 | 7 | 6 | 10 | 0 | 100.0% |
| **Total** | **90** | **76** | **39** | **87** | **3** | **96.7%** |

Cross-fixture either-detection rate stays at the **96.7%** documented
in the README. Visual-channel alone catches 84.4% (76/90); a11y alone
catches 43.3% (39/90); the joint check raises that to 96.7% with only 3
silent regressions across 90 random selector deletions. Silent cases
(both with auto-classified reason):

- `admin-panel .form-row input:focus, ... { outline }` — `hover-only`
  (focus-state styling, not visible in the default render)
- `form-app .alert-success { background }` — `dead-code`
  (selector exists but no matching element in the rendered DOM)
- `landing-product .pricing-card .btn-secondary:hover { background }` — `hover-only`

All three line up with the known taxonomy in `docs/knowledge.md`:
focus/hover states need the Playwright hover fallback (or crater BiDi)
to be detected, and dead-code rules are correctly invisible by design.

Raw reports: `test-results/css-bench/<fixture>/bench-report.json`

## 4. Headline numbers

| Metric | Value | Source |
|---|---|---|
| Stability FP rate (Chromium headless, static pages) | 0.00% (0/32) | §1 |
| Migration: shadcn→luna pixel-perfect viewports | 10/10 (100%) | §2.3 |
| Migration: tailwind→vanilla pixel-perfect viewports (`before-inlined.html`) | **13/13 (100%)** | §2.1 |
| Reset CSS migration: normalize↔modern-normalize | 1.12–2.62% diff | §2.2 |
| CSS Challenge cross-fixture detection rate | 96.7% (87/90) | §3 |
| CSS Challenge visual-only detection rate | 84.4% (76/90) | §3 |
| CSS Challenge a11y-only detection rate | 43.3% (39/90) | §3 |

## 5. Archived raw data

Slim per-run extracts are committed under
`docs/reports/data/2026-05-11/`:

- `stability.json` — full `stability-report.json` from §1
- `migration-tailwind.json` / `migration-reset.json` / `migration-shadcn.json`
  — variant × viewport diff ratios + dominant category + top fix candidates
- `css-challenge-bench.json` — per-fixture detection rates + the 3 silent cases

The full unsummarized reports (with heatmap pixel data, paint-tree
diffs, etc.) live under `test-results/data-collection/` and
`test-results/css-bench/<fixture>/` but are not checked in to keep
the diff small.

## 6. Notes for future runs

1. The `tailwind-to-vanilla` blind-test "answer" no longer holds at the
   current breakpoint coverage. Re-running the LLM loop (or hand-fixing
   the `.col-hidden-mobile` / `.stats-grid` / `.nav` rules at
   below-640) is the smallest follow-up to recover 0.0%.
2. Stability is currently measured on static HTML files only. To get a
   meaningful FP rate on real apps, the same command should be run
   against the dev server of an external project (luna.mbt, sample-webapp).
3. The Cloudflare Browser Run backend (`--backend cloudflare`) is in
   place but not yet measured here — credentials are needed. When that
   data exists, the stability table above is the apples-to-apples
   comparison point.
