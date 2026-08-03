# introduce.md evaluation loop: blind persona review rounds (2026-08-01)

## Method

The agent-validation-loop applied to a document. Each round, two
FRESH disposable evaluators (no memory of prior rounds) read ONLY
`docs/introduce.md` in persona and answer a fixed rubric: one-sentence
summary, would-you-try-it, a comprehension quiz, picky quote-level
critique, blocking questions, three concrete suggestions, and a /10
score with an explicit no-inflation instruction. Personas: (A) a
VRT-naive frontend developer skeptical of tool marketing; (B) an
agent operator burned by false "verified" claims, evaluating tools.
The quiz is re-targeted each round at the previous round's fixes, so
"did the fix land" is measured, not assumed.

After round 3 the loop continued at the user's request. Persona B
(agent operator) was retired at its 7/10 plateau — its remaining asks
had crossed into operator-manual territory — and replaced from round 4
by (C) a tech lead evaluating team adoption cost, a lens the first
three rounds had not covered.

## Trajectory

| Round | A (frontend dev) | B (agent operator) | C (tech lead) | Comprehension quiz |
|---|---|---|---|---|
| 1 | 6/10 | 5/10 | — | all correct (basics) |
| 2 | 6/10 | 6/10 | — | all correct incl. round-1 fixes (gate def, speed, keys, ledger) |
| 3 | 6/10 | 7/10 | — | all correct incl. round-2 fixes (limits, exemptions, false-negative count) — B additionally inferred an unstated ledger limitation |
| 4 | 7/10 | retired | 6/10 | all correct incl. round-3 fixes (cheat-sheet when-annotations, SKILL.md excerpt, audit-site names) |
| 5 | 6/10 | — | 7/10 | all correct incl. round-4 fixes (triage path, manifest ownership, rollout order) |
| 6 | 6.5/10 | — | 6/10 | all correct incl. round-5 restructure (section order, agent-section compression) |
| 7 | 7/10 | — | 7/10 | all correct incl. round-6 fixes (minHeight every-match semantics, the 30px-button rule, contract example values) — both personas' best-ever scores |
| 8 | 7/10 | — | 8/10 | all correct incl. round-7 fixes (name fossil, verify-markup mechanism, never-idle behavior, cross-OS baselines, Haiku attribution, suppression persistence) — first 8 of the loop |
| 9 | 7/10 | — | 7/10 | all correct incl. round-8 fixes (verify-markup boundary, palette-harmony mechanism, install commands, vrt.config.json fossil, suspect floors, error exit behavior) |
| 10 | — | — | — | lens changed: (D) browser-internals engineer 6/10 + (E) executable-fidelity auditor — see below |

## What each round changed

- **Round 1 → 2**: jargon defined at first use (gate/MCP/skill, VLM
  dropped from prose); every adversarial claim linked to its dated
  report; ledger shown as a real JSON line; `.mcp.json` shown
  verbatim; worked kickback→fix→CLEAN example added; the three
  key-gated features named; MIT + CI usage stated.
- **Round 2 → 3**: expectations block (per-gate seconds, Playwright
  download weight, 30s network-idle settle — verified against source,
  auth-wall answer); copy-paste cheat sheet; skill path made concrete
  (one SKILL.md); **Honest limits** section (how "intentional" is
  measured, no user exemption list for integrity yet, the real
  false-negative number — 1 in 19 scenarios, promoted to probe A13 —
  flow gates prove only walked paths, no third-party CSS scoping).
- **Round 3 → 4**: when-to-use annotations on the cheat
  sheet + a `vlmkit watch` pointer, an actual SKILL.md excerpt
  (B's top ask two rounds running), the seven audit sites named
  inline with a methodology link; a 2-line GitHub Actions snippet,
  gate mechanics made concrete (case-sensitive copy matching, 25px
  sweep steps), and a "how is this different from a screenshot
  service" differentiation section.
- **Round 4 → 5**: team-adoption answers for the new tech-lead lens —
  who owns the copy manifest (same-PR rule), snapshot approve as the
  intended-change path, a failure-triage path (real defect vs
  intentional pattern vs tool limit), rollout order, MCP tool roster,
  manifest scale guidance; plus claim-scoping ("proves only walked
  paths") and concrete output examples.
- **Round 5 → 6 (restructure, not accretion)**: round 5 showed
  reviewer-driven accretion — the doc had grown 170 → 395 lines
  across rounds and A's score *fell* 7 → 6 citing length. Fix was
  structural: operations content moved before the agent section, the
  agent section compressed ~35%, "What vlmkit is not" tightened
  (395 → 371 lines). No new content added.
- **Round 6 → 7**: both personas converged on one blocker — show a
  real `layout.json`. Writing it exposed a **doc overclaim**: the
  text said "buttons ≥ 48px tall on mobile" was encodable, but
  `LayoutRule` had no height assertion. Resolution: implement
  `minHeight` in the tool (every-visible-match semantics, reports the
  shortest) rather than weaken the doc, then paste the E2E-verified
  4-rule example into "Can we encode our own rules?".

- **Round 7 → 8**: both personas converged again, this time on
  honesty gaps rather than missing content: the section heading
  "a referee that can't be argued with" was self-refuting (the doc
  itself documents three successful gaming attempts) → retitled
  "a referee with an audit trail"; "impossible to forget" (×2) →
  detectability phrasing with the CI-wiring caveat made explicit;
  cross-environment flakiness silence → a "Will it flake in CI?"
  bullet (geometry gates stable, snapshot baselines must be
  generated where they're compared); never-idle pages (polling/
  websockets) → stated plainly that the gate errors at the 30s cap,
  plus no-auth-injection admission; `verify markup`'s mechanism
  (dev: "the one claim I flatly don't believe") → one sentence on
  connectivity segmentation + region pairing + pixel confirmation;
  "inexpensive models handle this fine" → named Haiku 4.5 with the
  kickback-rounds caveat; the unexplained VLM-name tension → the
  "name is the fossil record" note; suppression persistence → new
  "Where does gate configuration live?" bullet admitting there is
  no central config file; integrity FP-audit gap → linked the
  2026-07-30 five-site external dogfood; project maturity → 0.8.x /
  one-maintainer disclosure sized to the rollout advice. Also fixed
  a broken em-dash sentence in the copy-gate paragraph and the
  cheat sheet's silent omission of `check interactions` (added; only
  `verify flow` stays out, with the reason stated).

- **Round 8 → 9**: the findings shrank a grade — no structural or
  honesty complaints left, mostly reference hygiene and unpriced
  operations. Fixed: the dangling forward-reference to the ledger
  (now introduced in the team section with lifecycle guidance —
  gitignore, one JSON line per run); `vrt.config.json` called out as
  a second naming fossil; the unquantified "rare" flake claim
  replaced with the real suspect floors (page overflow from 2px,
  text collision needs 6px on both axes) plus the error-vs-suspect
  CI behavior (errors exit non-zero — fail loudly, never silently
  pass); an ephemeral-CI baseline recipe (commit or cache, approve
  in the intending PR); `verify markup`'s applicability boundary
  stated (flat-fill UI comps, not photographic art); `check asset`'s
  "colors that don't clash" replaced with the measured
  palette-harmony mechanism (dominant-color share near the page
  palette, warn not fail); install commands made concrete in the
  expectations block; the MCP roster de-enumerated (it was
  first-introducing tools the doc never covers).

- **Round 9 fixes**: the dev found the loop's last genuine spec
  ambiguity — what exit code does a suspect produce *without*
  `--fail-on-suspect`? Verified against source and stated exactly
  (integrity fails always exit non-zero; suspect gates exit zero
  without the flag; errors always non-zero). Also fixed: the
  `check asset` cheat-sheet line now carries the `--against-bg` /
  `--page-palette` arguments its prose promised; a real `flow.json`
  example (from the S19 fixture) parallel to the layout example;
  "Every command runs after just that" scoped to tooling (the
  user-defined gates need their file written); the zero-FP claim
  re-scoped to "in that seven-site sample"; fonts promoted to a
  first-class determinism boundary (matched-font wobble ~1px vs
  missing-font reflow crossing any floor) in both the flake bullet
  and Honest limits; auth promoted from a parenthetical to its own
  Honest-limits bullet; a worked npm-scripts block with an honest
  ~20-page scale ceiling.

## Round 10 — changing the measurement axis (the loop's most productive round)

Rounds 4–9 had converged on prose polish because the *instrument* was
fixed: a persona reading the document. Round 10 changed the
instrument instead of the document, running two evaluators that could
contradict the source rather than only the wording:

- **(D) a browser-internals staff engineer** — judges whether each
  described mechanism is mechanically possible.
- **(E) an executable-fidelity auditor** — runs every command in the
  document and tests every behavioral claim empirically.

Scores: D 6/10 (lowest since round 4 — correctly so; it scored
mechanism opacity the prose personas could not see). E produced no
score by design; it produced a table of VERIFIED / MISMATCH.

### Real defects found (fixed, with tests)

1. **A13 occlusion was blind to `pointer-events: none` occluders.**
   Predicted by D from the mechanism alone, then confirmed
   empirically: `elementFromPoint` returns the *text element itself*
   when the occluder opts out of hit-testing, so `hit === el` short
   -circuits and the S19 defect class plus one declaration escaped.
   Fix: force hit-testing on page-wide while sampling, then restore;
   the opaque-paint requirement keeps false positives closed
   (transparent stretched-link test still green). Regression test
   M14a2, verified failing-before/passing-after.
2. **`check integrity` never awaited `document.fonts.ready`.** Only
   network idle — but `font-display: swap` reflows text *after* idle,
   so geometry probes measured fallback metrics on some runs. This
   contradicted the determinism claim the doc had made two rounds
   earlier.
3. **The ledger did not cover `snapshot` or `scan breakpoints`** (E's
   measurement: 0 lines appended). Since the doc pitches the ledger as
   the audit backbone for "every gate invocation," the code was fixed
   rather than the claim weakened — both now log, verified.

### Doc claims E falsified (my errors, now corrected)

- **The exit-code rule from round 9 was wrong.** I had written
  "the other checks exit zero unless you pass `--fail-on-suspect`"
  from reading `--fail-on-suspect` call sites. Measured reality:
  `check layout`, `verify flow`, `verify markup`, `scan handlers`,
  and `check interactions` all exit non-zero *without* the flag;
  `check copy`, `check asset`, `scan scroll` exit zero. Independently
  re-verified before rewriting. The doc now states the actual split
  (verdict gates fail closed, finding-list gates fail open, errors
  always fail) and names the inconsistency; unification is backlogged
  as a breaking change.
- **`check interactions` does not catch the clickable `<div>`** — a
  `<div onclick>` page returns `status: ok`. That needs
  `scan handlers` / `--handlers`. The doc had attributed the catch to
  the wrong command, in both prose and the cheat sheet: the mismatch
  most likely to produce a false "verified".
- **`vlmkit watch` is not a gate re-runner** (it is the older
  baseline/variant differ). The pointer implied the opposite.
- **i18n inflation is 1.4× (40%), not the documented 30%.**
- **`verify markup` misses low-contrast fills** inside its stated
  sweet spot: two `#f4f4f4` cards removed from a `#ffffff` page =
  2.12% of pixels differing, reported as `0.01%` and `DONE`.
  Disclosed in Honest limits; threshold fix backlogged.

### Method notes

- **Changing the evaluator's lens beat iterating the same lens.** Nine
  rounds of readers produced wording fixes; one round of a mechanism
  critic plus an executing auditor produced three code fixes and five
  falsified claims. The ratchet described below was a property of the
  instrument, not of the document.
- **An executing auditor is the only evaluator that can catch the
  author's own source-reading errors.** Every wrong claim in this
  round originated in *my* reading of the code (exit codes, i18n
  factor, which command owns the clickable-div catch) — errors no
  prose reviewer could see, and that I had introduced *while fixing
  earlier review findings*. Doc rounds can inject defects.
- **The auditor also caught its own setup error** (a `sed` had made
  its "modified" fixture byte-identical to the target) and retracted
  the finding. Instructing an auditor to distinguish "the doc is
  wrong" from "I set it up wrong" is what made its report usable.
- **One legitimate critique was deliberately not acted on.** D
  correctly identified that the collision floor's both-axes AND
  excludes thin slivers. Loosening a floor on one reviewer's
  reasoning is how a gate starts crying wolf, so it is disclosed as a
  known blind spot and backlogged behind a false-positive re-audit.

## Convergence call after round 9 (superseded by round 10)

Scores: dev 6, 6, 6, 7, 6, 6.5, 7, 7, 7 · operator 5, 6, 7 (retired)
· lead 6, 7, 6, 7, 8, 7. The comprehension quiz has been perfect for
eight consecutive rounds, each time re-targeted at the newest fixes —
transmission is not the bottleneck and hasn't been since round 2.

What distinguishes round 9's residue is its *category*: every
remaining ask is (a) feature work, not doc work (central gate-config
manifest, cookie/storage-state injection, user exemption list for
integrity, monorepo glob runner, parallelism/sharding), (b) evidence
that cannot be written into existence (external adopters, cross-OS
validation runs on hardware this project doesn't have, issue-response
track record for a young project), or (c) reference-manual content
the intro deliberately links out to. The in-scope findings this round
were real (exit-code semantics!) but they were the last of their
kind: three consecutive rounds of fresh evaluators produced no new
structural, honesty, or comprehension complaints.

Per the standing criterion — **quiz saturated AND remaining asks
out-of-scope or fabrication-requiring** — the loop should stop here.
The feature asks it surfaced are recorded in TODO.md as backlog, which
is the correct escalation: reviewer pressure on an honest document
ends up producing a tool roadmap.

## Original convergence call after round 3 (superseded — loop resumed)

- **Comprehension saturated**: every quiz answer correct in rounds
  2–3, including the subtlest material (exemption mechanics, the
  false-negative story). The document *transmits*; remaining score
  friction is scope, not clarity.
- **Remaining findings crossed the intro's scope boundary or would
  require fabrication**: LLM pricing/model tables, an exemption
  roadmap with dates, CI pipeline recipes, copy-manifest lifecycle —
  reference/configuration territory (and A said so themselves: "for a
  project that's fine; for an introduction…"). Declined rather than
  invented.
- **Score plateau with rising floor**: A flat at 6 across three rounds
  with rotating rationale (the persona wants a getting-started guide,
  which the intro deliberately is not); B rising 5→6→7 as integration
  and evidence concerns were answered.

## Standing observations for future doc loops

- Fresh evaluators per round are essential — the quiz proves fixes
  landed without contaminating the reader simulation.
- Persona tension is information: A wanted the agent section exiled,
  B called it the persuasive core. The resolution (skip cue +
  compression, not removal) satisfied B's trajectory without moving
  A — an accepted trade, documented rather than churned.
- The evaluators reliably over-ask an intro to be a manual. The
  convergence criterion that worked was "quiz saturated AND remaining
  asks are out-of-scope or fabrication-requiring," not a score
  threshold.
- **The rubric guarantees findings.** "A review with no findings is a
  failed review" is the right instruction for rigor, but it makes the
  loop a structural ratchet: every round produces suggestions, so the
  loop never self-terminates on an empty round. The stop signal has
  to come from the *content* of the findings (out-of-scope, would
  require fabrication, contradicts an earlier accepted trade), never
  their existence.
- **Reviewer-driven accretion is the loop's failure mode.** Each
  round's fixes add lines; the persona that wanted a short intro then
  scores the length down (A: 7 → 6 at round 5). Every few rounds the
  right move is a restructure/compression pass that adds nothing —
  treating "the doc got worse by getting more complete" as a real
  finding.
- **Evaluator pressure can find tool bugs, not just doc bugs.** The
  round-6 demand for a concrete example forced the discovery that the
  doc promised an assertion the tool didn't have (`minHeight`). A doc
  loop over an honest document is partially a spec-conformance test
  of the tool.
