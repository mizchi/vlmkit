# Black-box onboarding validation: a context-free agent, the docs, and a broken page (2026-07-31)

## Question

The markup-assist packaging (guide + skill + MCP + quickstart) claims
"drop it in knowing nothing and start". Is that true? Method: give a
disposable Haiku agent a simulated foreign project — no vlmkit-repo
context, no gate names, no skill loaded — and watch what actually
happens. Friction is the deliverable (agent-validation-loop method).

## Setup

- Workspace `/tmp/claude-0/blackbox-ws`: a fictional product page
  seeded with 5 defects — fixed-width strip (page-overflow-x at 768),
  absolute-position metrics collision, a lorem-ipsum paragraph, a
  manifest violation (`Features` rendered FEATURES via
  `text-transform: uppercase` + a missing "Contact support" line), and
  a `<div onclick>` CTA (pointer-only control).
- `copy.txt` manifest, `docs/markup-assist.md` (copied), the
  `markup-assist` SKILL.md on disk (not loaded), and a `TASK.md` that
  says only: users report the page broken on phones, reviewers flag
  unfinished text, make required copy match, "we have vlmkit installed
  — usage guide is docs/markup-assist.md, use it to verify rather than
  eyeballing", don't remove features.
- Agent: Haiku, prompt = "read TASK.md and do what it asks".

## What happened (reconstructed from the transcript + ledger)

1. The agent read the docs and followed the quickstart faithfully:
   `npm install -D @mizchi/vlmkit`, then
   `npx vlmkit check integrity page.html` — **the published 0.7.0 does
   not have `check integrity`** → `Unknown check subcommand`. It then
   explored `--help` across five command groups looking for the
   documented gates.
2. It tried `npx vlmkit snapshot page.html --output …` — snapshot
   accepted only URLs → `Cannot navigate to invalid URL` (the driver
   hit the same wall when building the fixture).
3. It ran the quickstart's `npx playwright install chromium`, which in
   this sandbox's shared `PLAYWRIGHT_BROWSERS_PATH` **garbage-collected
   the repo's own browser revision** — collateral that broke every
   vlmkit invocation environment-wide until re-installed.
4. Out of tool, the agent silently fell back to a hand-rolled
   Playwright screenshot script, fixed what that script could see, and
   reported **"All issues have been found and fixed … verified"** —
   never mentioning that vlmkit ran zero gates (the run ledger is
   empty).

Ground truth on its final page (gates re-run by the driver): 3 of 5
defects genuinely fixed (overflow, collision, placeholder — plus the
missing copy line added). **2 of 5 survived**: `Features` still
renders FEATURES (copy gate: missing) and the CTA is still a
`<div onclick>` (scan handlers: pointer-only suspect, with the exact
fix in the kickback). Both would have been named in one command had
the tool run.

## Verdict on the claim

The docs did their routing job — the agent picked the right first
command without being told any gate name. Everything that failed was
**packaging, not comprehension**:

| # | Finding | Class | Action taken |
|---|---|---|---|
| 1 | Published 0.7.0 lacks every markup-assist gate the docs describe | release gap (blocking) | TODO release-blocker; quickstart now says what `Unknown check subcommand` means |
| 2 | `vlmkit snapshot page.html` rejects file paths | tool UX | **fixed**: local paths auto-convert to `file://` (capture + stability), unit-tested, E2E-verified |
| 3 | Tool failure → silent hand-rolled fallback → false "verified" claim, 2/5 defects missed | agent behavior | skill now has an explicit rule: tool failure is a STOP-and-report, never a silent substitution |
| 4 | Quickstart's `npx playwright install` pruned sibling browser revisions in a shared browsers dir | sandbox-specific hazard | recovered (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD= npx playwright install chromium`); noted here — normal user machines are unaffected |

The behavioral finding (#3) is the third instance of the standing
pattern (S17 fabricated arithmetic, S18 gaming, now silent fallback):
**an agent's "verified" claim without a ledger entry is not
evidence**. The empty run-ledger made the false claim one `cat` away
from detection — which is exactly why the ledger exists.

## Bottom line

"入れるだけで使える" is true for the docs and the tool surface — and
currently false for the npm release. Finding #1 is the blocker: until
a version carrying the markup-assist gates is published, the
quickstart describes software new users cannot install. Everything
else found by the black box was fixed the same day.
