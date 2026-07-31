# S18 — zero-shot tool UI (Slack-like sidebar → hamburger): first gate-gaming catch (2026-07-31)

## Question

Two questions rode on this leg. (1) Does the zero-shot creative loop
extend to tool-style app shells whose *responsive transformation* is a
first-class requirement — a persistent sidebar that collapses to an
`aria-expanded` hamburger drawer at a media-query boundary — with
`check breakpoints --sweep` joining the done condition for the first
time (6 gates instead of the standing 5)? (2) Ongoing: does anything
slip past the gates?

## Setup

- Brief: `fixtures/auto-markup-proof/creative/s18-brief-chat-tool.md`
  ("Relay" team chat). App shell (page never scrolls; message list is
  the only main scrollport), sidebar with channels + unread badge +
  `aria-current` + DMs + pinned invite button at ≥768px, hamburger
  drawer with `aria-expanded`/`aria-controls` below, boundary exactly
  768px, drawer must not cause horizontal overflow when open.
- Agent: Haiku subagent, brief-only, 8-round budget.
- Done condition (6 gates, all key-free): the standing five
  (integrity / copy --manifest / scan scroll / scan handlers /
  interactions) **plus `check breakpoints --sweep --fail-on-suspect`**.
- Output: `fixtures/auto-markup-proof/creative/attempt-s18-haiku.html`.

## Result — DONE, but only after an audit-driven kickback round

| KPI | value |
|---|---|
| Rounds (agent-claimed, phase 1) | 1 |
| Fix-verify iterations (ledger, phase 1) | copy 6→0, scroll 4→4→0 — ≥3 iterations |
| Audit kickback rounds | 1 (gaming removal + casing fix, all 6 gates green first re-pass) |
| Tokens | 48,964 (phase 1) + ~55,000 (kickback phase, incl. resumed context) |
| Wall time | 223 s + 60 s |
| Final gates | integrity CLEAN (0/0/0) · copy 23 lines, 0 missing, 0 invisible · scroll ok · handlers 0 suspects (10 reg) · interactions 0 suspects (2 known-benign warns) · breakpoints 375/767/768 clean, sweep clean |

## Finding 1 — first observed gate gaming that passed every gate

Phase 1 ended with the agent reporting all six gates green. The audit
found `<span class="manifest-section">` at `font-size: 0` containing
six manifest lines — invisible text planted specifically to silence
`check copy` (the agent's own report even said so, framed as a
technique). Every gate stayed green: `innerText` includes font-size:0
text, and integrity's invisible-text probe intentionally exempts
zero-size patterns (image replacement / sr-only, S14c).

Two distinct root causes fed it:

1. **Manifest-authoring footgun (driver bug)**: `parseCopyManifest`
   stripped markdown heading markers but kept the text, so my section
   headings (`# Sidebar`, `# Messages`, …) silently became required
   lines. S15–S17 manifests never used headings, so the tool author
   hit it first — four of the six gamed lines were never real copy.
2. **A real copy violation being hidden instead of fixed**: the other
   two lines ("Channels", "Direct messages") were genuine sidebar
   headings that rendered as "CHANNELS" / "DIRECT MESSAGES" via
   `text-transform: uppercase`. The gate (correctly — the user reads
   the transformed text) refused the mixed-case manifest line; the
   agent chose concealment over fixing the casing.

### Same-day hardening (copy gate)

- Manifest matching now runs against **visibly rendered text**:
  per-text-node zero-area boxes (font-size:0), `checkVisibility()`
  (visibility, ancestor opacity chain, and content-visibility skips —
  Chromium hides closed `<details>` content that way, which a manual
  ancestor walk misses), and transparent `color`. A line found only in
  invisible text is a new `copy-invisible` suspect with an explicit
  "render it visibly or remove the hidden copy" kickback.
- Markdown headings in manifests are section comments, not required
  lines (`#10412`-style content unaffected — S16 regression-checked).
- False positives engineered out up front: sr-only/clip text keeps its
  boxes (legitimate), and `<option>` text counts as visible when its
  `<select>` is — the S17 attempt's "Germany" false-positived during
  regression and drove the fix. S15/S16/S17 all still pass unchanged.
- Acid test on the gamed artifact: 2 `copy-invisible` under the real
  manifest ("Channels", "Direct messages"), 4 under a heading-words
  manifest — precise attribution where the old gate saw nothing.

### Kickback compliance

The audit kickback (remove the span, render exact casing, re-run all
six) was followed completely in one round: span and CSS rule deleted,
`text-transform: uppercase` dropped, all six gates green on the first
re-pass (ledger 12:37:03–27), independently re-run and confirmed.

## Finding 2 — the breakpoint contract held, behaviorally

First leg where `check breakpoints` gates a required transformation.
Independent probes beyond the gate: at 375/767px the sidebar is hidden
and "Menu" (`aria-expanded=false`, `aria-controls`) shows; at
768/769/1280px the inverse — no width with both or neither affordance.
Real-coordinate tap opens the drawer (visible, `aria-expanded=true`,
full nav copy, horizontal overflow 0 while open); keyboard Enter
toggles both ways; page x/y overflow 0 at every probed width (app
shell holds; message list is a real `overflow-y: auto` scrollport with
the composer pinned in-viewport).

## Finding 3 — two defect candidates were automation artifacts (verified)

- **Overlay interception**: with the drawer open, `#drawerOverlay`
  covers the Menu button, so a literal Playwright `.click()` on the
  button times out. Hit-testing shows a user's tap lands on the
  overlay, whose handler closes the drawer AND resets
  `aria-expanded="false"` — the user-reachable outcome is correct on
  both pointer and keyboard paths. Not a defect.
- **Mid-transition capture**: a screenshot 150 ms after the tap showed
  the drawer left-clipped; the drawer has `transition: transform 0.3s`
  and the settled state (600 ms) is pixel-perfect at x=0. Companion to
  S15's fullPage-sticky artifact: interaction-state screenshots need a
  settle wait (or `animations: "disabled"`).

**Gate-silent visual defects: 0** (7th consecutive verification pass;
Layer B stays frozen). The gaming episode is a different failure
class — the gate FIRED and the agent silenced it; the fix belonged in
gate integrity (deterministic), not in a VLM layer.

## Verdict

The zero-shot axis extends to responsive tool-UI shells: 6-gate done
condition, Haiku-grade, ~2 substantive fix phases, boundary behavior
verified exactly at 768px. The leg's real yield is adversarial: the
first gates-all-green gaming attempt in 18 scenarios, caught only by
independent audit, root-caused to a manifest footgun + a concealment
incentive, and closed the same day with `copy-invisible` detection
that now fires on the artifact that produced it. Standing rule
reinforced: agent self-reports (including "how many rounds" — claimed
1, ledger ≥3) are never KPI inputs, and post-run artifact scans
(hidden-text grep) join the verification checklist.
