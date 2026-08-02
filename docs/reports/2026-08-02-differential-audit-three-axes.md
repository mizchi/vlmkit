# Differential audit: viewport order, dpr, `--json` vs printed output

2026-08-02. The load-mechanism defect earlier today was found by asking "do two
paths that should agree actually agree?" This applies the same instrument to the
three remaining axes. Two produced defects; one turned out not to be an
equivalence question at all.

## 1. Viewport sweep order — defect

`check integrity` dedupes findings across the sweep, keeping the first
observation. So the retained finding — and its reported viewport — depended on
the order the caller listed widths in:

```
--viewports 1280,768,375 :  low-contrast-text | p.low-contrast | 1280
--viewports 375,768,1280 :  low-contrast-text | p.low-contrast | 375
```

Same defect, same page, different attribution. Two consequences:

- **`--allow "…@1280"` was silently order-dependent.** The exemption feature
  added hours earlier matches on viewport, so a rule scoped to a width worked or
  didn't depending on how the sweep was ordered.
- **"@375" reads as "mobile only"** for a defect present at every width, which
  is a different bug to fix than a genuinely mobile-only one.

**Fix.** The sweep is sorted widest-first internally, whatever order the caller
gave, and a repeat at a narrower width now records that width instead of being
dropped without trace:

```
low-contrast-text | p.low-contrast | 1280,768,375
near-misalignment | button.btn-b   | 1280,768,375
near-misalignment | button.btn-c   | 1280,768        <- 375 is fine, and now visible
```

`btn-c` misaligns at two widths and not the third — information that did not
exist in the report before. `--allow` matches any observed width.

## 2. dpr — not an equivalence axis

Only `build component` exposes `--dpr`, and there it deliberately changes the
render to match a retina target image, so there is nothing that "should agree".
The gates do not take a dpr, and the one measurement already available (the font
determinism probe, same day) put dpr 2 at ≤1.00px of ink drift with zero verdict
flips. No work; recorded so the axis is not re-opened as an unknown.

## 3. Printed output vs the data — defect

`check a11y contrast`, `check a11y touch` and `check a11y focus` printed a
headline count and then **five rows, with no note that the list was cut**:

```
✗ 12 contrast failure(s)
  p.low0 — 1.92:1 …
  p.low1 — 1.92:1 …
  p.low2 — 1.92:1 …
  p.low3 — 1.92:1 …
  p.low4 — 1.92:1 …          <- and that is the whole output
```

Twelve findings, five shown. `check breakpoints` and `check integrity` already
disclosed their caps (`… N more (use --json for all)`); these three did not, and
their markdown reports cut at 20/30 rows silently too.

**Fix, and the mistake inside it.** I added the disclosure lines first —
"… 7 more (see the report, or --json for all)" — and then checked: **these gates
had no `--json` flag at all.** The notice pointed at something that did not
exist, and the markdown version claimed "the JSON report has all of them" when
there was no JSON report. Rather than soften the wording to match a weaker
reality, `--json` was added to all four (the three a11y gates plus
`stress i18n`), so the claim is true and an agent can get every row:

```
check a11y contrast --json  ->  json rows: 12
check a11y touch    --json  ->  json rows: 12
```

That is also a consistency fix in its own right: the docs describe `--json` as
available on the gates, and these were the exceptions.

## Regression gate

`packages/vlmkit-markup/src/output-consistency.test.ts` — six tests: same
findings in either sweep order, attribution to the widest observed width, the
per-width list distinguishing page-wide from mobile-only, `--allow` matching any
observed width, and the two a11y reports retaining all twelve findings the
console truncates.

## Method note

Three defects in one day came from the same question, asked of a different pair
each time: navigate vs `setContent`, four hand-rolled argv parsers vs each other,
sweep order vs sweep order, printed vs stored. None of them was visible in a
single run — each needed two runs and a comparison. Axes now measured and clean:
`file://` vs `http://`, dpr, and these three.
