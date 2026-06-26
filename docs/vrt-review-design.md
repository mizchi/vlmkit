# VRT Review (accept-or-reject) Design

Date: 2026-06-26
Status: Approved (design phase)

## Goal

When a Playwright VRT (`toHaveScreenshot`) fails, judge — with a model — whether
the visual change is an **intended change** (accept → update the baseline) or a
**regression** (reject). Provide a standalone, reusable judge that CI can call,
and have the heal loop's observe phase use the same judge.

This generalizes vlmkit-heal's existing in-loop observe (which only saw the
`actual` screenshot and was coupled to the heal loop) into a first-class
`reviewVrtDiff()` that compares baseline vs actual and returns a graded verdict.

## Lesson baked in

intentional-vs-regression cannot be decided from pixels alone (prior cycle). So
the intent signal is layered, and `confidence` reflects how much signal was
available; an `acceptThreshold` gate stops low-confidence pure-vision "accepts"
from being baked into the baseline.

## Public contract (`src/review.ts`)

```ts
import type { ModelTier } from "./types.ts";

interface VrtReviewInput {
  baselinePng: Buffer;          // before (Playwright -expected.png)
  actualPng: Buffer;            // after (-actual.png)
  diffPng?: Buffer;             // -diff.png if present
  // intent signal, layered (highest priority first):
  expectedChange?: string;      // 1. explicit declaration (spec / PR)
  gitContext?: string;          // 2. commit message + code diff (caller-supplied)
  // 3. neither -> vision-only model guess
  tier: ModelTier;              // any vision-capable driver (gemini / claude / gpt-5 ...)
}

type ReviewVerdict = "accept" | "reject" | "unsure";

interface VrtReview {
  verdict: ReviewVerdict;       // accept = intended/update-ok, reject = regression, unsure = human
  confidence: number;           // 0..1; lower when the intent signal was weak (vision-only)
  reason: string;               // short rationale
  intentSource: "expectedChange" | "gitContext" | "vision-only";
  costUsd: number;
}

function reviewVrtDiff(input: VrtReviewInput): Promise<VrtReview>;
```

- Shows the model **baseline + actual (+ diff)** — a real before/after comparison.
- Judgment only; never mutates the baseline (action stays in heal / the caller).
- `intentSource` records what drove the judgment; vision-only ⇒ lower confidence.

## Capture + git context

```ts
// capture.ts (extends the outputDir auto-detection from #70)
function findVrtArtifacts(cwd: string, outputDir?: string): {
  baseline?: Buffer;  // *-expected.png
  actual?: Buffer;    // *-actual.png
  diff?: Buffer;      // *-diff.png
};

// git-context.ts — optional helper; reviewVrtDiff itself only takes a string (no git coupling)
function collectGitContext(cwd: string, opts?: { base?: string }): string;
//   = last commit message + a truncated code diff (base=origin/main for PR diff in CI)
```

Data flow:
```
VRT fail → findVrtArtifacts(cwd)  → baseline/actual/diff
         → (optional) expectedChange / collectGitContext()
         → reviewVrtDiff(...) → { verdict, confidence, reason, intentSource }
```

## heal integration

The observe phase (vrt-diff branch) is replaced by `reviewVrtDiff`:

```
vrt-diff detected
  → findVrtArtifacts(cwd)
  → reviewVrtDiff({ baseline, actual, diff, expectedChange: opts.expectedChange,
                    gitContext?, tier: observe.current() })
  → verdict:
       accept AND confidence >= acceptThreshold → update baseline → verify
       reject                                   → Verdict = "regression" (no update, stop)
       unsure OR (accept but low confidence)    → Verdict = "needs-review" (no update, human)
```

New options / verdict:
- `HealOptions.acceptThreshold?: number` — default 0.8. An `accept` below this is
  not auto-applied (becomes `needs-review`). Quantifies the safety rule
  "never bake an unverified change into the baseline".
- New `Verdict` value `"needs-review"`. CI maps: accept→update, reject→fail,
  needs-review→ask a human.

## File layout (vlmkit-heal)

- `src/review.ts` — `reviewVrtDiff` (prompt build, 3-image send, response parse)
- `src/git-context.ts` — `collectGitContext`
- `src/capture.ts` — add `findVrtArtifacts`
- `src/heal.ts` — observe path → review + acceptThreshold gate + needs-review
- `src/types.ts` — `VrtReviewInput` / `VrtReview` / `ReviewVerdict`, `acceptThreshold`, extend `Verdict`

## Test strategy (TDD)

- Unit (mock LLM): prompt build + response parse (verdict + confidence + reason);
  intentSource layering (expectedChange > gitContext > vision-only); the
  acceptThreshold gate (a 0.7 accept under default 0.8 → needs-review).
- Real-API smoke: a real intentional VRT change → `accept` (high confidence) and a
  real regression → `reject`, using a cheap reasoning VLM (e.g. gemini-2.5-flash-lite).

## Out of scope (YAGNI)

- A CLI (`vlmkit-heal review`) — the function is the deliverable; a CLI can wrap it later.
- Auto-opening PRs / posting review comments — the caller decides what to do with the verdict.
