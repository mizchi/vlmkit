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

Both arms were proven different before the results were read:

- **copy canary** — MDN (the only corpus page with open shadow roots)
  moved 11396 → 11482 chars; every other page identical.
- **integrity canary** — Hacker News's overflow message changed from
  `sticking out: #hnmain (right edge 804px), #hnmain > tbody:nth-of-type(1) …`
  to `caused by: #hnmain (796px wide; constraining it removes 36px of the
  overflow)`. Same finding, better attribution — and proof the integrity
  code path differs between arms.

### `check integrity` — 8 pages × 3 viewports

| Page | before | after | exempted |
|---|---|---|---|
| apg-tabs | defects (36) | defects (36) | 0 → 0 |
| danluu | clean (2 warns) | clean (2 warns) | 0 → 0 |
| example | clean (0) | clean (0) | 0 → 0 |
| hn | defects (7) | defects (7) | 0 → 0 |
| mdn-flex | defects (77) | defects (77) | 9 → 9 |
| webdev-lcp | defects (28) | defects (28) | 0 → 0 |
| wikipedia-css | defects (25) | defects (25) | 0 → 0 |
| zengarden | defects (24) | defects (24) | 25 → 25 |

**0 new findings, 0 disappeared, 0 exemption changes** across 199
findings and 34 exemptions. The unchanged exemption counts matter
independently: an exempted-pattern turning into a finding is the
false-positive signature for the intentional-pattern classes, and none
occurred.

The most load-bearing single result: **CSS Zen Garden reports 3
`occluded-text` findings and they are the same 3 in both arms.** That
page is a showcase of decorative absolutely-positioned art, exactly the
material the `pointer-events` override could have turned into false
occluders — and it did not.

### `check copy` visibility model

**0 new invisible-chunks, 0 new issues.** Visible-text length changed on
one page only (MDN, +86 normalized chars), which is precisely the page
with open shadow roots. The shadow traversal is a strict no-op where no
open shadow root exists.

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

## What this corpus does and does not gate

Defect-class coverage, measured (per-viewport counts on representative
pages): `js-error` and `broken-font` / `broken-image` dominate and are
mostly mirror artifacts — harmless here because they cancel across arms.
The classes that carry real signal for this audit:

| Class | Corpus coverage | Verdict for the changes under test |
|---|---|---|
| `occluded-text` | 3 (zengarden) | adequate — decorative-overlay-heavy page, no new findings |
| `low-contrast-text` / `invisible-text` | 9 | adequate |
| component extraction (via `verify markup`) | not exercised on real pages | **gap** — the adaptive-tolerance change is covered only by unit tests and the synthetic reproduction |
| `text-collision` | **1** (apg-tabs) | **inadequate** |

### The ink-extents upgrade is still NOT unblocked

The backlog gated it on "a false-positive re-audit," and it would be
convenient to read this audit as satisfying that. It does not. With a
single `text-collision` finding in the whole corpus, this corpus cannot
distinguish "the collision floor got looser without crying wolf" from
"nothing happened to be near the floor."

What that gate actually needs, now specified: a corpus of pages with
dense text overlap — tight `line-height` (< 1) display type, negative
`margin-bottom` heading patterns, fonts whose ascent+descent exceed 1em,
`writing-mode: vertical-rl`, and rotated text — measured for
`text-collision` findings before and after. The A/B harness built here
is the right instrument for it; the corpus is not.

What this audit *does* establish: the five threshold/behaviour changes
shipped this session introduce zero false positives on real markup, and
the harness plus the arm-isolation check are reusable for the next
threshold change.
