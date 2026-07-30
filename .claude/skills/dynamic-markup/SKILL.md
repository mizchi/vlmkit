---
name: dynamic-markup
description: Markup with dynamic behavior — recreate a page whose requirements include responsive breakpoints, scrollable panels, and CSS animations from target screenshots plus a short motion brief, then prove the behavior with the deterministic dynamic-gate suite (check breakpoints / scan scroll / check animation / check motion). Static pixel convergence delegates to the auto-markup skill. Works with any agent model — the agent's own vision is the only VLM required, no API key; Haiku handles structure/spacing cheaply, hard 1px endgames measured to need Sonnet (see Model selection). Use when a markup task specifies how the page behaves (resizes, scrolls, animates), not just how one screenshot looks.
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
| Interactive states (visual) | hover/focus screenshots (see auto-markup §3.7) |
| Interactive state CHANGES (disclosure, tabs, switches, menus) | a reference page (`check interactions --reference` makes its event→ARIA-transition inventory the contract) — or an **interaction brief**: one line per control naming role, accessible name, event, and expected transition (see B5). **Brief authors: copy that is only visible in a state needs its own carrier** — a panel no screenshot shows and no brief line quotes has none, and the agent will invent plausible text for it that no gate can catch (S11: an always-hidden tab panel shipped with fabricated copy; only the verifier's source diff found it). Quote every state's visible copy in the brief, or provide one screenshot per state |
| Exact copy (spellings, casing) | a **copy manifest** (plain text, one required line per row) — verified by `check copy --manifest`; without one, `check copy` only runs its placeholder scan. **Brief authors: mandatory whenever the page carries real copy** — measured cost of omitting it: an S9 run went 18 rounds across two models with a wrong © year, missing `·` separators, and proper-noun typos (`Imlil`→`Imili`) that composition pairs happily and no gate can see. Vision transcription of ~14px text WILL introduce these. **No manifest available** (real mock, competitor capture): the target pixels themselves are the carrier — run `check copy attempt.html --target target.png` once composition has converged; it crops every rendered text block's bbox out of the target into contact sheets. All three S9 bugs are visible in a single sheet read — **but the sheets must be read by someone other than whoever transcribed the copy** (the driver/verifier, or `--vlm`): the eyes that misread `Imlil` as `Imili` at transcription time misread the review crop the same way (S9-fresh measured exactly this — the agent reviewed its own sheets, reported PASS, and the typo survived). Self-review of your own transcription is weak evidence |

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

Two opt-in extensions when the spec calls for them: `check breakpoints
--sweep` fuzzes the whole width range for horizontal overflow (widths
*between* breakpoints that B±1 never renders — the fixed-width-child
class of bug), and `check scroll` verifies scroll *behavior* (fixed
elements hold their viewport position, engaged sticky elements stick
at their `top`, mandatory snap containers land on a child snap edge —
including the "no child declares scroll-snap-align" miss).

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

### B5. `check interactions attempt.html [--reference reference.html]`

The a11y-event axis: what state changes do keyboard events produce?
The tool discovers interactive elements (roles + implicit semantics),
Tab-walks for reachability and focus indicators, fires each role's
canonical key (Enter for buttons/disclosures, Space for
checkbox/switch, arrows for tab/radio roving, ArrowDown for combobox,
Escape on opened popups), and records the response as ARIA transitions
(`expanded false -> true`), aria-controls target visibility, and a
layout delta — deterministic, no VLM.

When an activation opens a **popup** (dialog / menu / listbox), the
full APG pattern is probed in the same session: focus must move INTO
the popup, a modal dialog must trap Tab (landing on browser chrome is
fine — native `<dialog>` does that; landing on page content outside
the popup is a leak), menu/listbox items must be ArrowDown-navigable,
and Escape must close AND return focus to the trigger. Popup
*interiors* are hidden at rest, so they are verified through these
pattern probes, not itemized in the inventory.

**The wired-callback surface** (experimental): `check interactions
--handlers` (or standalone `scan handlers`) enumerates every callback
actually registered on the page — an `addEventListener` patch injected
before page scripts plus an `on*` attribute/property sweep — and
cross-checks it against the role-driven discovery. The headline
suspect is the **pointer-only control**: a visible element with a
click handler but no role, no keyboard handler, and no delegation
excuse — mouse users can operate it, keyboard and AT users cannot,
and the role-driven map alone can never see it (it is never
discovered). Handler types the probes don't fire are listed, never
silently dropped. Framework caveat: React-style root delegation shows
one listener on the root; per-element granularity is a vanilla /
Web Components property.

**Composites and announcements** are also first-class: a standalone
`listbox` tracks `aria-activedescendant` (resolved to the referenced
element's TEXT, so differing ids never false-mismatch) and the
selected-descendant set as ARIA transitions; a roving `grid` is
reachable through its cells and its arrow keys must move focus within
the composite (`focus moves within`); an action that updates a live
region (`aria-live` / `role=status|alert` / `output`) reports
`announces`, and losing that announcement against a reference is a
contract suspect. Listbox `option` children are captured through the
container's selection facts, not itemized.

- Run when the page has ANY interactive element beyond plain links.
  Suspects to fix: **dead-disclosure** (aria-expanded that never
  changes — the attribute is a promise, wire it or drop it),
  **broken-aria-controls** (id points at nothing),
  **focus-escapes-trap** (a modal that doesn't trap is not modal).
  Warns to fix or explain: **no-focus-indicator** (an explicit
  `outline: none` with no replacement — the UA default counts as an
  indicator, and a ring drawn on a DESCENDANT counts too (the APG
  `span.focus` pattern: outline:none on the control, ring on an inner
  span), so this only fires when you killed it everywhere),
  **not-tab-reachable** (roving-tabindex composite members are
  correctly exempt), **inert-control**, **escape-stuck**,
  **popup-no-focus-move**, **focus-not-returned**,
  **popup-arrows-dead**.
- With `--reference`, the reference's inventory is the behavioral
  contract: same elements (matched by role + accessible name), same
  reachability, same focus indicators, same ARIA transition per event.
  Any divergence is named. This is the recreation gate — a page can
  match every screenshot with `<div>`s and dead attributes; this gate
  is what fails it.
- Mock mode (no reference): the carrier is an **interaction brief**
  (per control: role, name, event, expected transition — e.g.
  "Shipping options: button, Enter toggles aria-expanded + panel").
  Verify the standalone inventory line-by-line against the brief the
  same way the motion brief is verified against B3.

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
re-measure without changing anything); tokens second.

Token discipline (measured: this cut tokens/round ~6x in S5-r5):
- Read each target screenshot ONCE, take thorough notes (structure,
  copy, colors, measured sizes), and work from your notes + tool
  reports afterward. Screenshot re-reads are the dominant token cost.
- Use `vlmkit verify markup` as the one measurement per round instead
  of running build page and the four gates separately.

Anti-thrash discipline (the failure mode that replaced early
self-declaration once verdicts became explicit):
- ONE targeted fix per round. Fix the FIRST kickback item first — the
  list is ordered, and a ROOT-CAUSE CANDIDATE line means the items
  below it are probably debris of that one defect.
- Kickback items carry deterministic context: a `[kind]` tag
  (text/solid/image — a text extra is NEVER fixed by deleting the
  text) and a selector attribution (`[rendered by \`.footer\`]`,
  `[target box falls in your \`.rail\`]`) from hit-testing the
  residual bbox against your own DOM rects. Start from the named
  selector instead of re-deriving which element owns the residual —
  the S9 escalation leg spent rounds on exactly that derivation, and
  the controlled S9 replay measured the effect: same stall, same
  budget, attribution on — Sonnet went from NOT-DONE-in-6 to
  **DONE-in-3**. (It does not rescue Haiku — the wall there is the
  reasoning, not the locating.) No attribution printed means no
  element overlaps the box (commonly a fully missing
  `position: fixed` element).
- Demotion is the TOOL's call, never yours: only lines the tool marks
  `[pixel-confirmed, not blocking]` are artifacts. A blocking line you
  suspect is an extraction quirk is still a real residual — three
  measured runs (S7, the S9 escalation, S9-fresh) each rationalized a
  genuinely missing element as "the tool can't isolate it", and all
  three were visually refuted by the verifier.
- The verdict prints a `trend vs previous run` line; on REGRESSED,
  revert your last change before trying anything else.
- When some targets pass and others fail, the kickback says which to
  protect — scope fixes to the failing target's media regime.

### B6. `check integrity attempt.html` (reference-free defect sweep)

Needs NO target image or manifest — run it as the last gate on every
attempt, and as the PRIMARY gate when there is no reference at all
(creative/zero-shot markup from a brief). It sweeps 1280/768/375 for
defects that are unambiguous without a reference: construction-phase JS
errors, empty/degenerate renders, broken images/stylesheets/scripts,
same-layer text collisions, clipped text, collapsed containers,
horizontal page overflow, and declared-but-unapplied styling. Findings
carry selector attribution; a `fail` flips the verdict to DEFECTS.

- Intentional patterns (hero overlay, `text-overflow: ellipsis`,
  zero-height positioning anchors, `aria-hidden` decoration) are
  exempted by the TOOL and listed under `exempted` — same rule as
  demotion: the exemption is the tool's judgment, not yours. If you
  believe a `fail` is intentional, the fix is to express the intent in
  CSS (positioned layer, ellipsis), not to argue with the report.
- Measured value on our own fixtures: the S8 edit fixture — verified
  DONE at 1280 — turned out to overflow 67px at 375 (`div.plans`),
  invisible to every reference-full gate because no 375 target existed.
  Multi-viewport integrity is exactly the net for that class.

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

## Model selection for the markup agent (measured 2026-07-28)

A/B on the same task, same prompt, same 12-round budget, current
toolchain (S7-fresh; pricing = Anthropic per-MTok rates at time of
measurement — re-check before relying on the dollar figures):

| | Haiku 4.5 ($1/$5) | Sonnet ($3/$15) |
|---|---|---|
| Outcome | NOT DONE at 12/12 (stalled on 1px-divider endgame) | **DONE in 9 rounds, zero kickbacks** |
| Tokens / wall time | 69.6k / ~6 min | 147.8k / ~18 min |
| Cost per run | ~1x | **~6x** (unit price 3x × tokens 2.1x) |

Guidance:

- **Sonnet — autonomous single-shot work.** Use it when nobody will
  babysit the loop, when the page must actually reach DONE, or when
  the task has a hard endgame (precise 1px hairlines, pseudo-element
  placement, sub-pixel text tuning). It diagnoses with measurements
  (direct pixel sampling, disposable test copies) instead of guessing.
- **Haiku — batch / cost-sensitive work with a driver harness.** ~6x
  cheaper per run and ~3x faster wall-clock, and fine through the
  structural and spacing phases — but it has a measured ceiling on
  hairline/endgame precision that more rounds do not fix. Plan for
  NOT DONE on hard pages: budget handoff legs (~15k tokens/round) and
  driver verification time, or escalate.
- **Escalation pattern:** start Haiku; if the trend is flat for ~2
  legs on the same residual class, hand the CURRENT attempt file plus
  the verbatim `verify markup` kickback to a Sonnet leg rather than
  burning more Haiku rounds. Never restart from scratch to escalate.
- The verifier/driver protocol below applies to BOTH models — Sonnet
  earns autonomy only while its runs keep independently verifying.

## Driver / verifier protocol (when running this skill via a subagent)

Every S5/S6 first leg — five for five — self-declared "complete" while
the done condition was unmet, regardless of how prominently the AND
condition was stated. If you are the driver, plan for it:

1. **Use `vlmkit verify markup` as the verdict**, both for the agent's
   loop and your own check:

   ```bash
   vlmkit verify markup attempt.html --target t-desktop.png \
     --target t-mobile.png [--reference reference.html]
   ```

   One command runs composition per target, all four gates, and a
   rest-pose pixel diff, prints an explicit DONE / NOT DONE verdict,
   the calibration floor (with `--reference` — kills "tool noise"
   claims), and a paste-ready kickback listing **every** residual.
   Instruct the agent to loop on it: in S6, an agent driven by the
   printed verdict was the first to end WITHOUT a false success claim.
2. **Audit rounds from the run ledger**, not the agent's log: every
   loop tool appends to `.vlmkit/run-ledger.jsonl` (timestamp, tool,
   headline numbers), so "did it actually re-measure?" and "did the
   numbers improve?" are checkable facts.
3. **Kick back with names, not verdicts**: the verify markup kickback
   section is written for this — every missing/extra with the
   displacement interpretation applied, gap deltas, height deltas.
   Generic "keep iterating" wastes a round; named deltas resolve in
   1-2.
4. **Budget tokens for the kickbacks**: resuming a subagent re-bills its
   transcript, so late segments cost more than their tool-call count
   suggests — measured at ~67k tokens/round for resume vs ~15k for a
   fresh agent with a verifier summary (S5-r4). Prefer the handoff for
   cost, but keep kickbacks small, repeated, and *complete*: a residual
   you leave out of the handoff text stays unfixed (r4's panel height),
   because the fresh agent lacks the resume's accumulated context to
   rediscover it. Passing the verbatim verify markup kickback closes
   that omission risk.

## Ground rules

- Never open the reference/original HTML if one exists.
- The motion brief is the only source of motion truth; screenshots are
  the only source of static truth. When they seem to conflict, the
  screenshots win for geometry and the brief wins for time.
- Trust gate reports over your own reasoning about your CSS — the whole
  point is that behavior bugs survive code review and die in rendering.
