# Animation evaluation: `vlmkit check animation` (2026-07-27)

## Motivation

`vlmkit check motion` only scans CSSOM declarations — it can say "an
animation is declared" but not whether the animation *does* anything, when
the page stops moving, or whether `prefers-reduced-motion` is honored in the
rendered output. knowledge.md has tracked this gap since the css-challenge
era ("animation-delay: dead-code — already completed at static capture
time; detection fundamentally difficult"). The auto-markup pipeline also
needed it: an agent that authors animations had no signal tool to verify
them, and infinite animations silently poison every screenshot-based loop
(`build page`, `diff png`, snapshot).

## Design

Frame-sampled, deterministic, no VLM — same philosophy as the rest of the
signal-tool family. The wall clock is never raced:

1. Load, `document.getAnimations({ subtree: true })`, stash the live
   references on `window`, `pause()` everything.
2. Pose the page at **rest** (see gotcha below), screenshot the baseline.
3. Per animation: seek `currentTime` through N deterministic sample points
   of one iteration (default 25/50/75/100%, end clamped to −1ms so
   `fill: none` doesn't snap), screenshot each, pixel-diff successive
   frames in Node (`frameDelta`: count / ratio / bbox, tolerance 8).
4. Reduced-motion pass: fresh page with
   `emulateMedia({ reducedMotion: "reduce" })`, re-collect animations,
   count those still running with duration ≥ 100ms (the
   `animation-duration: 0.01ms` accessibility pattern counts as honored).
   This is behavioral — `check motion`'s CSS-text regex can be fooled by a
   rule that exists but doesn't cover the animating selectors.

### Issues emitted

| kind | severity | meaning |
|---|---|---|
| `no-visible-effect` | suspect | animation sampled at every point, no pixels moved — dead animation (e.g. animating `z-index`) |
| `infinite-animation` | warn | page never settles; message includes a ready `--mask "<selector>"` hint for VRT capture |
| `long-settle` | warn | finite settle time exceeds threshold (default 3000ms) — captures inside the window are nondeterministic |
| `reduced-motion-ignored` | suspect | animations still run under emulated `prefers-reduced-motion: reduce` |

Per-animation evidence: motion bbox (union of frame deltas), peak frame
ratio, total changed pixels, duration/delay/iterations. `--frames <dir>`
writes every sampled PNG for VLM or manual inspection. `--json` for agents.

## Dogfood

Fixture: card with a 600ms `slide-in` entrance (transform+opacity), an
infinite 1s `spin` spinner (transform rotate), a dead 2s `noop` animation
(`z-index` only), no reduced-motion rule.

```
status: suspect
animations: 3 (evaluated 3, infinite 1)
settle: never (infinite animation)
reduced-motion: 3 animation(s) still running

  - div.card `slide-in` 600ms x1: visible, motion region (39,49) 370x255, peak frame delta 1.54%
  - div.spinner `spin` 1000ms x∞: visible, motion region (64,147) 40x40, peak frame delta 0.03%
  - span.badge `noop` 2000ms x1: no visible effect
```

The spin motion region is exactly the spinner's 40x40 bbox. Adding
`@media (prefers-reduced-motion: reduce) { * { animation: none !important } }`
flips the report to `reduced-motion: honored` and drops the suspect. A
static page reports `ok, animations: 0, settle: 0ms`.

## Gotcha found while dogfooding: the baseline must be the rest pose

First implementation held **all** animations at `currentTime = 0` for the
baseline and during each other's evaluation. Result: the spinner reported
`no visible effect` even though seeking demonstrably rotated it
(`getComputedStyle` showed the matrix changing). Cause: the card's entrance
animation at t=0 applies its start keyframe — `opacity: 0` — so the whole
card subtree, spinner included, rendered as background. Rotating an
invisible spinner changes nothing.

Fix: the shared baseline is the **rest pose** — finite animations seeked
*past their end* (`delay + duration × iterations`; `fill: none` falls back
to natural style, `fill: forwards` keeps the last keyframe — both are the
true settled appearance), infinite animations held at 0. Each animation
returns to its rest time after evaluation. This is the general form of the
same class of bug as `build page`'s background-anchoring issue: a reference
state chosen for determinism must also be *representative*, or the
measurement silently evaluates the wrong thing.

## Addendum: controllability boundary + `uncontrolled-motion` guard

A follow-up question — "does this work on CSS animations, and can they be
controlled from outside?" — led to a per-kind verification:

| Animation kind | Enumerable / seekable via WAAPI | Evaluated |
|---|---|---|
| CSS `@keyframes` | yes (`CSSAnimation` reflection) | yes — this was the original dogfood |
| CSS transition | yes, while alive at collect time | yes (hover-triggered ones are `inspect interact`'s domain) |
| WAAPI `element.animate()` | yes | yes, including the infinite flag |
| rAF/JS tick (GSAP-ticker style) | **no** — invisible to `getAnimations()` | no, and worse: see below |
| video / GIF / SMIL | no | no |

The rAF case is not just a blind spot: the ticker keeps moving the page
*during* evaluation, so its pixels leak into whichever animation is being
sampled — in the mixed fixture the CSS animation's motion region grew from
its real 60px-tall box to 220px because the rAF box below it moved between
screenshots. A dead animation can read as visible this way.

Guard added: the rest pose is captured **twice back-to-back with nothing
seeked in between**; any delta between the two captures is motion the WAAPI
cannot hold still. It is reported as `uncontrolledMotion` (count + bbox) and
raises a `warn`-severity `uncontrolled-motion` issue stating that overlapping
frame deltas may be contaminated. This also fixes the false negative where a
page animated *only* by rAF reported `ok, animations: 0` — it now warns, with
the moving region's bbox. Static pages stay clean (tolerance 8 absorbs
antialiasing; the flag needs ≥ minChangedPixels).

Verified: mixed fixture pinpoints the rAF box at (200,200) 85x60; rAF-only
page warns despite `animations: 0`; static page still reports `ok`.

## Files

- `packages/vlmkit-markup/src/style/animation-eval.ts` — implementation
  (pure helpers `frameDelta` / `unionBbox` / `computeSettleMs` /
  `deriveAnimationIssues` are exported and unit-tested without Playwright)
- `packages/vlmkit-markup/src/style/animation-eval.test.ts` — 13 tests
- CLI: `vlmkit check animation` (`src/cli/cli.ts`), cross-referenced from
  `check motion`'s header; README, TODO.md, auto-markup SKILL.md updated.
