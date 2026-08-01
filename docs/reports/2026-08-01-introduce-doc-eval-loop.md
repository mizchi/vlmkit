# introduce.md evaluation loop: three rounds of blind persona review (2026-08-01)

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

## Trajectory

| Round | A (frontend dev) | B (agent operator) | Comprehension quiz |
|---|---|---|---|
| 1 | 6/10 | 5/10 | all correct (basics) |
| 2 | 6/10 | 6/10 | all correct incl. round-1 fixes (gate def, speed, keys, ledger) |
| 3 | 6/10 | 7/10 | all correct incl. round-2 fixes (limits, exemptions, false-negative count) — B additionally inferred an unstated ledger limitation |

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
- **Round 3 → final polish**: when-to-use annotations on the cheat
  sheet + a `vlmkit watch` pointer, an actual SKILL.md excerpt
  (B's top ask two rounds running), the seven audit sites named
  inline with a methodology link.

## Convergence call (loop ended after round 3)

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
