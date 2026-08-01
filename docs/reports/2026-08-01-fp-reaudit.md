# False-positive re-audit of the 2026-08-01 threshold changes

This session moved five thresholds/behaviours that all carry
false-positive risk, and the backlog gated further work (the
ink-extents collision upgrade) on an FP re-audit. This is that audit.

Changes under test:

| Change | FP risk being tested |
|---|---|
| `adaptiveBgTolerance` (foreground threshold 12 → 4 on clean renders) | antialiasing halos becoming their own components |
| `pixelPresence` clamped against the background | legitimate segmentation disagreements stop being demoted → new blocking findings |
| occlusion probe forces `pointer-events` on while sampling | transparent overlays flagged as occluders |
| overflow culprit measured (`width: 0` probe) instead of ranked | wrong element named as cause |
| copy gate walks open shadow roots | text a user cannot see counted as visible |
| `settleAfterLoad` in interactions / handlers | different DOM measured than before |

## Method

**A/B on identical inputs.** Eight real pages (example.com, danluu.com,
Hacker News, MDN, Wikipedia, W3C APG tabs, web.dev, CSS Zen Garden)
mirrored locally with their same-origin CSS, then measured twice: once
with the pre-change commit (`86d4cdb`) and once with the current tree.
Any finding present in AFTER but absent in BEFORE is a candidate false
positive.

Mirror fidelity gaps (missing cross-origin scripts, query-string assets)
are acceptable *because* it is an A/B: an artifact appears in both arms
and cancels in the diff. That is the property that makes a cheap mirror
usable where the earlier single-arm dogfood had to hand-triage them.

## The harness was wrong on the first attempt

The first run reported **0 new findings, 0 disappeared** — for both
gates, on every page. That result was vacuous, and the reason is worth
recording because it would silently invalidate any future A/B in a
pnpm workspace:

The baseline worktree's `node_modules` was symlinked to the main repo's,
and `node_modules/@mizchi/vlmkit-*` there points at
`../../packages/vlmkit-*` **of the main repo**. Every cross-package
deep import (`@mizchi/vlmkit-markup/inspect/copy-check.ts` — which is
how the CLI reaches the gates) therefore resolved to the *current*
code. Both arms ran the same build. The old arm's own sources sat on
disk, unused.

It was caught by a prediction that failed: MDN has 16 open shadow roots,
so the shadow-traversal change *must* move the copy gate's text length —
and the A/B said it hadn't. Computing the expected numbers by hand
(`normalizeWhitespace(innerText)` = 11396 vs with shadow text = 11482)
against the arms' reported values (11482 in both) located the leak.

Fix: give the baseline worktree its own `node_modules` — every
third-party entry symlinked from the shared store, but `@mizchi/*`
pointing at the worktree's own packages. Re-verified before trusting
anything: `before=11396, after=11482`, matching the hand computation.

**Rule for future audits: prove the arms differ on a case where you
know the answer, before reading any result as evidence.** An A/B whose
arms are secretly identical produces the most reassuring possible
output.

## Results (valid run)

See `ab-integrity.md` / `ab-copy.md` in the audit scratch directory for
the per-page diff. Summary and classification below.

### `check integrity` — 8 pages × 3 viewports

_Filled in from the valid run._

### `check copy` visibility model

_Filled in from the valid run._

### Regression battery

The 17 intentional-pattern / exemption tests (sr-only, image
replacement, ellipsis truncation, hero overlay, aria-hidden decoration,
anchor, `csszengarden` candidates) pass unchanged, as do the full
485-test markup suite and 143-test core suite.

## Shadow-root coverage note

Only MDN in this corpus uses open shadow roots (16 hosts). Of its 9364
chars of shadow `textContent`, **8212 are `<style>`** (correctly skipped)
and only 81 are real UI copy. Two of those strings — "Toggle sidebar",
"Filter sidebar" — are *not* counted as visible, which is correct: they
are screen-reader-only labels on icon controls, and the geometric
visibility model applies inside shadow roots just as it does outside.
"Was this page helpful to you? Yes No" *is* counted, which is also
correct.

So the new code path is exercised by exactly one page in this corpus.
The synthetic regression test covers both halves (visible shadow copy
satisfies the gate; `font-size: 0` shadow copy still does not), but
real-site evidence for the shadow path is thin — one page, 81 chars.
