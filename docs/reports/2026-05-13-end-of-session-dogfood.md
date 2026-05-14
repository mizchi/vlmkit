# End-of-session validation dogfood

**Date**: 2026-05-13 (session close)
**Subagent**: a3a363e29733303c6
**Toolkit state**: 27 commands, 19/19 smoke, 51/51 unit

## Subagent scenario chosen

**Scenario B — Explore + heal**: declarative-action HTML +
deliberate selector typo + healer verification.

## Subagent's killer-signal moment

> `vrt explore` reported Δ 0.00% on `toggle-menu` while `vrt
> interact` clicking the same `[data-vrt-action='toggle-menu']`
> selector on the same file produced a clean 3.71% diff. PNGs from
> explore were byte-identical (md5 `4f3c5d5bcbff…`).

If only `explore` had been run, the agent would have spent
"20 minutes adding inline `onclick=` attrs" hunting a non-bug.
`interact` immediately disproved that hypothesis. The compound
workflow caught the false signal.

**Investigation**: I attempted to reproduce on a near-identical
fixture (3 data-vrt-action buttons, inline addEventListener) and
got correct Δ values (greet 0.12% / toggle-menu 6.60% / show-toast
0.41%). I could not reproduce the byte-identical-PNG outcome,
including with `DOMContentLoaded`-deferred listener wiring. The
subagent's fixture was cleaned up before I could inspect it.

The subagent's reproducibility note is real but appears
fixture-specific. Without their HTML I can't fix the underlying
issue. I did make the related signal more honest:

## Fixes shipped

### 1. `--help` confused with positional file argument

```
$ vrt explore --help
error: file not found: --help
```

Now every CLI handles `--help` / `-h` at the top of `main()` (15
files patched via Python AST-aware insertion). The usage text
prints normally.

### 2. `explore` "dead — no visible effect" verdict too confident

Changed to: `no pixel delta — action may be wired but
timing-missed, or genuinely no-op`. Tells the agent that a 0%
result has at least three plausible causes (timing miss, no-op,
wiring bug), not just one.

This directly addresses the subagent's observation that an
explore-only run would have led them down the wrong debugging
path. The new wording invites cross-checking with `interact`.

### 3. Healer suggestions only fire on failure (out of scope)

The subagent noted that a typo selector matching the *wrong*
element silently succeeds — no healing offered. This is by design:
running the healer on every successful step would 2-5× the wall
time. Worth documenting; not worth changing.

## Subagent's final score

> Yes — I'd reach for vrt tomorrow, specifically `interact` and the
> selector healer. The healer is the standout: it turned a typo-
> induced 5-second timeout into an actionable "did you mean
> `button.btn-secondary`?" with confidence scores, which is exactly
> the feedback loop a markup agent needs.

Caveats:
- "until [explore's silent-zero-diff] is tightened up I'd use it
  only as a discovery aid, not as a verifier"
- "the toolkit's compound power (explore → discover, interact →
  verify, healer → recover) is real, and one bug in one path
  doesn't undermine the workflow"

## Open follow-ups from this dogfood

1. The explore Δ-0 reproducibility issue stays open until we have
   a reliable repro. Mitigation: the new "may be wired but
   timing-missed" verdict tells users to cross-check with
   `interact` rather than trust the verdict alone.
2. Selector healer could optionally probe `successful` steps too,
   behind an opt-in `--heal-all` flag, to catch wrong-element
   silent successes. Deferred.

## Toolkit state at session close

- **27 commands** (`vrt help` lists all of them)
- **19/19 smoke** (`scripts/smoke-all-clis.sh`)
- **51/51 unit tests** (`node --test src/**/*.test.ts`)
- **5 dogfood reports** in `docs/reports/`:
  - capability-survey.md
  - scenario-matrix.md → scenario-matrix-v2.md
  - comprehensive-dogfood.md
  - webmcp-browser-harness-extract.md
  - end-of-session-dogfood.md (this file)

Scenario-matrix v2 in-scope coverage: **55% full / 87% useful**.
Closing point.
