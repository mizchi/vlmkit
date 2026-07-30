# Selector-heal tier calibration (2026-07-30)

Issue #14 calibrates the report labels used by `vrt interact --heal-all`; it
does not change the selector-healing algorithm.

## Corpus

[`data/2026-07-30-selector-heal-calibration.json`](data/2026-07-30-selector-heal-calibration.json)
contains 23 labeled, deterministic selector failures exercised against the
repository's real `fixtures/interact/{heal-all-demo,dropdown-form,form-validation}`
pages. Each record retains the intended repair, the actual top candidate, and
its measured confidence. The executable regression test re-runs every case.

| confidence band | cases | result |
|---|---:|---|
| >= 0.40 | 6 | 6/6 true positives |
| 0.15–0.40 | 12 | mixed; informational only |
| < 0.15 | 5 | suppress; includes low-signal true repairs and noise |

Notably, the old 0.30 strong cutoff would have promoted a 0.325 false positive:
`button.btn-seconday` incorrectly suggested `button.btn-primary` rather than
`button.btn-secondary`. The lower weak cutoff of 0.10 also showed 0.10–0.13
noise, so it is raised to 0.15.

## Decision

| tier | old | calibrated | meaning |
|---|---:|---:|---|
| strong | >= 0.30 | **>= 0.40** | actionable `did you mean` |
| weak | >= 0.10 | **>= 0.15 and < 0.40** | informational `weak match` |
| none | < 0.10 | **< 0.15** | suppressed |

The strong tier is precision-first: it must not make a wrong-sibling suggestion
look actionable. This corpus is fixture-derived rather than a production
telemetry sample, so new real interaction failures should be appended before
relaxing the cutoff.

## Validation

```bash
pnpm --filter @mizchi/vlmkit-markup test
```

The calibration test loads all corpus fixtures in Chromium and checks both the
recorded top candidate and the exact confidence, making score changes visible
in CI.
