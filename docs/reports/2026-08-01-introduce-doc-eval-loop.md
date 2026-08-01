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

## Convergence call after round 3 (superseded — loop resumed)

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
