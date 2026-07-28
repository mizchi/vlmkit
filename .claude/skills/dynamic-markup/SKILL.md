---
name: dynamic-markup
description: Markup with dynamic behavior — recreate a page whose requirements include responsive breakpoints, scrollable panels, and CSS animations from target screenshots plus a short motion brief, then prove the behavior with the deterministic dynamic-gate suite (check breakpoints / scan scroll / check animation / check motion). Static pixel convergence delegates to the auto-markup skill. Works with any agent model including Haiku; the agent's own vision is the only VLM required — no API key. Use when a markup task specifies how the page behaves (resizes, scrolls, animates), not just how one screenshot looks.
---

# dynamic-markup

The auto-markup skill converges *pixels*. This skill converges *behavior*:
what happens when the viewport changes width, when a panel has more
content than fits, when the page loads and something moves. A page can
match every screenshot and still be wrong — an animation that never
fires, a panel that grew instead of scrolling, a breakpoint that leaves
one width orphaned. Each of those is invisible to a single pixel diff
and each has a deterministic detector here.

**You are the VLM.** Read the targets with your own vision. The tools
below are Playwright + pixel/DOM math — no AI API, no key.

## Invocation

```bash
node --experimental-strip-types src/cli/vlmkit.ts <command...>
```

## Inputs — how behavior requirements arrive

Static truth comes from pixels; behavior truth needs a carrier:

| Requirement | Carrier |
|---|---|
| Layout / copy / colors | target screenshots (one per viewport) |
| Responsive variants | one screenshot per viewport width |
| Scrollport hidden content | an extra "scrolled to bottom" screenshot |
| Animation | a **motion brief** (short text: what moves, duration, easing, iteration, reduced-motion policy) — or a frame strip |
| Interactive states | hover/focus screenshots (see auto-markup §3.7) |

Never invent behavior that has no carrier. No motion brief and no frame
strip means **author zero animations** — say so in your report rather
than decorating. A visible cut-off row in a panel is a carrier for
"this panel scrolls"; missing rows without a scrolled screenshot are
not a carrier for their content.

## Phase A — static convergence (delegate)

Follow the **auto-markup** skill pipeline: palette/scan → skeleton →
`build page` composition loop per viewport → `build component` →
decoration audit. Converge every viewport's composition *before*
authoring motion — animations move pixels and make composition reports
harder to read.

One addition when animations are specified: author the entrance
animation with `both`/`forwards` fill ending exactly at the static
layout you converged, so the rest pose equals the screenshots.

## Phase B — dynamic gates

Run all four after static convergence. Every suspect must be fixed or
explained; warns must be either expected (and written down) or fixed.

### B1. `check breakpoints attempt.html`

Renders at B−1 / B / B+1 for every discovered breakpoint (add
`--breakpoints 768,1024` to force values). Failures and their usual
causes:

- `boundary-spike` — a property at exactly B matches neither regime:
  almost always a `max-width: (B-1)px` vs `min-width: (B+1)px` pair or
  duplicated conflicting rules. Make one regime own B.
- `boundary-gap` — an element hidden (or visible) only at exactly B:
  two hide/show rules that don't meet.
- `overflow-at-boundary` — a fixed-width child wider than the boundary
  width. Fix inside the offending regime's media query only; never
  regress the converged base.

### B2. `scan scroll attempt.html`

Proves the scroll requirements are real:

- Every panel the spec says scrolls must appear under
  **Scroll containers** with `overflow > 0` on the right axis. A panel
  listed as a **dead scrollport** (or absent) grew to fit its content —
  fixed height missing. This is the bug a default-screenshot pixel diff
  cannot see.
- `page-overflow-x` names the elements sticking out; on mobile widths
  this is the classic regression — check it at every target viewport
  (`--viewport 375x740`).
- `clipped-content` catches `overflow: hidden` swallowing rows you
  meant to make scrollable.
- `--json` emits `expectedScrollports` entries — paste into the UI
  Contract if the project keeps one.

### B3. `check animation attempt.html`

Evaluates every authored animation by rendered frames:

- **`no-visible-effect` (suspect)** — the animation runs but no pixel
  moves: keyframes animating a property the element doesn't render,
  a zero-size element, or `animation-name` typo. Dead motion code.
- Compare the **evaluated animations list** against the motion brief
  line by line: count, target selector, duration, iterations
  (`x1` vs `x∞`), and — for oscillating animations — the **leg time**
  must all match. The report annotates oscillation as `(alternate,
  leg 1200ms)` or `(palindromic keyframes, leg 600ms)`: a brief saying
  "1.2s per leg" is satisfied by `alternate` at 1.2s but NOT by a
  palindromic 0%/50%/100% cycle at 1.2s (that runs each leg in 600ms —
  double speed, identical duration). The brief is the spec; the report
  is the measurement.
- **`reduced-motion-ignored` (suspect)** — the brief's reduced-motion
  clause is not honored: add the `@media (prefers-reduced-motion:
  reduce)` override (auto-markup keeps colors in variables; keep
  motion behind this media the same way).
- **`infinite-animation` (warn)** — expected when the brief says
  "forever": confirm the selector matches the brief, note the
  suggested `--mask`, and carry it into Phase C.
- **`long-settle` (warn)** — entrance takes longer than the threshold;
  check the brief's duration before "fixing".
- **`uncontrolled-motion` (warn)** — something moves that WAAPI cannot
  pause (rAF script, video, GIF). If you didn't author it, you probably
  vendored it; either remove it or mask it in every capture.

### B4. `check motion attempt.html`

Declaration-level cross-check: the reduced-motion *rule* exists in the
CSS (B3 tests behavior, B4 the stylesheet), and the running/paused
inventory matches what you authored.

## Phase C — capture discipline

Pixel verification of an animated page needs two adjustments, both read
directly off the B3 report:

1. **Wait for settle**: screenshot after `settleMs` (plus margin), or
   seek animations to rest first — otherwise the entrance animation's
   intermediate frame becomes your "final" render.
2. **Mask infinite animations**: pass the B3-suggested `--mask
   "<selector>"` to `diff png` / `snapshot` / `vlmkit compare` runs, or
   pause animations before capture. An unmasked pulse makes every diff
   nondeterministic — including your own convergence loop in Phase A,
   which is why authoring motion *after* static convergence is the
   default order.

## Optional VLM assist

Your own vision suffices (Haiku-grade included — see the S1–S5 proofs
in docs/reports/). With an `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY`,
`vlmkit diff region --model anthropic/claude-haiku-4-5` can second-check
color pairs; treat it as color naming only — structure and shift always
come from the deterministic reports (see auto-markup §5 caveats).

## KPIs — rounds and tokens

Every run is scored on two KPIs (ledger: `docs/knowledge.md`
"Markup Agent KPI"):

- **rounds** — one measure→fix cycle counts as one round. Keep a
  one-line log per round and state the total in your final report.
- **tokens** — total tokens consumed. You cannot observe your own
  count: if you are a subagent, your *driver* records it from the
  harness usage line, so your job is only to make the round log
  accurate; if you are the top-level session, report your context
  usage as an approximation and say so.

KPIs only count for runs that reach the done condition below —
stopping early with leftover deltas is a failed run, not a cheap one.
Optimize rounds first (fix the biggest reported delta each round, never
re-measure without changing anything); tokens second (read report
files and crops instead of re-reading full screenshots you have
already seen).

## Budget & stopping

- Static convergence: auto-markup's budget (3-5 rounds single viewport,
  8-12 multi-viewport).
- Dynamic gates: normally 1-2 rounds — the reports name the selector
  and the fix. If a gate still fails after 2 targeted fixes, re-read
  the brief/targets; you are probably fixing the wrong requirement.
- Done is an **AND**, not an OR: (1) composition converged per
  viewport — `build page` missing 0 / extra 0, per auto-markup's
  stopping rule — AND (2) all four gates clean or expected-warn-only,
  AND (3) a final masked, settled pixel diff. Green gates do not excuse
  leftover missing/extra components; a leftover `build page` delta with
  budget remaining means keep iterating. Report the gate outputs
  verbatim alongside the diff numbers.
- Sizes are spec too: a scrollport must scroll (gate B2 proves it) *and*
  match the target's panel height (Phase A proves it). Passing B2 with
  a too-tall panel shifts everything below it — the S5 proof's main
  residual.

## Driver / verifier protocol (when running this skill via a subagent)

Every S5 run — three for three — self-declared "complete" while the
done condition was unmet, regardless of how prominently the AND
condition was stated. If you are the driver, plan for it:

1. **Calibrate first**: if a reference render exists, run `build page
   <target.png> <reference.html>` once. Its score (normally 0/0) is the
   floor; it defeats the agent's "the residual is tool noise" move with
   a measurement.
2. **Verify the final claim independently** — re-run `build page` on
   both viewports and the four gates yourself. Self-reported numbers
   drift (stale copy-paste between rounds is common).
3. **Kick back with names, not verdicts**: state which target component
   is missing, what it really is ("your own footer, displaced by excess
   vertical space above it"), and where the fix goes. Generic "keep
   iterating" wastes a round; named deltas resolve in 1-2.
4. **Budget tokens for the kickbacks**: resuming a subagent re-bills its
   transcript, so late segments cost more than their tool-call count
   suggests. A fresh agent with a verifier summary may be cheaper than
   a resume (unmeasured — record it if you try).

## Ground rules

- Never open the reference/original HTML if one exists.
- The motion brief is the only source of motion truth; screenshots are
  the only source of static truth. When they seem to conflict, the
  screenshots win for geometry and the brief wins for time.
- Trust gate reports over your own reasoning about your CSS — the whole
  point is that behavior bugs survive code review and die in rendering.
