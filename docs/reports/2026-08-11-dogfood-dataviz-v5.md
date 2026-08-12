# Dogfood v5: the #112 features, in front of an agent for the first time (2026-08-11)

## Question

v4 ended with the animation scenario's wrong-measurement count at zero and a
recommendation: run a different page, not a tighter budget. After #112 merged, a
sharper gap appeared.

**The four features that closed #112 shipped without any agent touching them.** They
were designed from a written adoption report — a good source, and not the same as
watching someone try to use them. This round put two of them in front of agents that
had never been told they exist. (The other two are install-time properties;
`package-install-smoke` covers those.)

| #112 item | What forces it in this scenario |
|---|---|
| 1. `--timeout` / `--wait-until` / `--har` | `/api/live` is an `EventSource` the server never closes, so `networkidle` never fires and every URL gate dies at 30s having reported nothing |
| 4. `check design --exclude` | three icon-only vendor buttons become the *dominant* button style, so the page's own buttons are reported as the deviants |

Two agents, two rounds each, on the same page with different jobs:

- **agent-i** — fix the reported problems. Every command against the served URL; a
  saved static copy is how the adoption report worked around item 1 instead of using
  the fix, and the brief rules it out.
- **agent-j** — do not fix anything; get the checks into CI. "The numbers change
  between loads, so a run has to be reproducible" and "the configuration has to be
  committed alongside the page — not in one person's shell history, and not a CI job
  whose command is 200 characters of flags nobody can review."

Same MUST-NOT list as every round: no source, no git history, no reports, no other
attempts, and no sight of the animation scenario.

## Result

Both agents reached their criteria. **Both independently named the same two things as
the worst friction**, having never seen each other's work — which is the strongest
signal this loop has produced.

| | agent-i (repair) | agent-j (CI) |
|---|---|---|
| Rounds | 2 of 2 | 2 of 2 |
| Criteria reached | 4 of 4, plus a fifth gate it judged necessary | 4 of 4 |
| Escaped the 30s hang via | `--help` | `--help` |
| Found `--exclude` via | `--help` | `--help` |
| Findings | 7 | 8 |
| Findings that were real bugs | 1 | 2 |

15 findings. I reproduced every one before fixing anything.

## What worked — their own words

The messages that carry the arithmetic did the work again, quoted by both:

> "`caused by: main.grid > section:nth-of-type(3) (extends to x=792px: starts at
> 552px, 240px wide; shrinking or moving it removes 24px of the overflow); 3 other
> element(s) past the edge were probed and each accounts for 0px or less.`" —
> "culprit, magnitude, and the fact that the other candidates are innocent. One-shot
> fix."

That last clause is v4's fix being used by someone who never knew it was added.

The footer added at the end of v4, from the previous round's "my fix lives in a shell
command that a CI job would have to duplicate":

> "Every gate's help footer: *'a `"gates"` entry in vlmkit.gates.json is the whole
> command, so any flag above belongs there'* — answered 'how do I commit this'
> without a doc lookup."

And `--exclude`'s auditability, which #112's author had asked for by name:

> "printing `Excluded subtrees (11 unique element(s) omitted) — .vendorchart-ctrl-group:
> 1 root match(es), 11 element(s) removed`, and promising to warn if the selector goes
> stale. A reviewable exclusion, not a silent suppression."

`--rules` turned out to serve a second purpose nobody designed it for:

> "Told me `overflow-at-boundary` and `component-drift` are warn-level, so I knew
> *why* two gates pass. This is what let me reason about *which* findings could
> actually fail a gate instead of chasing all of them."

## Fixed

### F1 — the navigation timeout was a dead end (both agents, independently)

The entire failure was one line: `error: page load timed out (Timeout 30000ms
exceeded)`.

> "It doesn't say the default wait state is `networkidle`, doesn't say `--wait-until`
> exists, doesn't say a request is still open, doesn't name it. The tool *knows* the
> milestone it was waiting on and that `/api/live` is in flight."

> "Dead end as guidance, useful as evidence. Reproduced the reported symptom; told me
> nothing about how to proceed."

It is #112 item 1 restated in the reporter's words: "the timeout error reads like the
tool can't handle the page rather than like a hint to change approach — we only found
the workaround by experiment." **Fixed**: the message names the milestone, the
still-open requests with how long each has been open, and the flags that end the
wait — including which one will not help.

**The instructive part is where the fix had to go.** I put it in `navigatePage` first
and the message did not change, because there are 42 `.goto(` call sites across 20
files and three of them hand-roll the same options object — `check integrity` being
one. Wrapping `newPage` at the launch choke point is the only edit that covers all
42. That choke point was built earlier in this session for exactly this shape of
problem, and I still reached for the narrower fix first.

### F2 — `check integrity` called a WCAG AA failure CLEAN

> "With `.status` at `#949494`: integrity → `verdict: CLEAN (0 fail, 0 warn, 0
> exempted)`, exit 0; `check a11y contrast` → `3.03:1 (need 4.5)`, exit 1. […] Fixing
> only to satisfy criterion 1 would have left the low-vision reporter failed with a
> green gate."

`low-contrast-text` cut at a flat 3:1 — WCAG's *large-text* floor applied to every
piece of text. Two gates disagreeing about the same three elements, with the
reference-free gate giving the green. The computed font-size was in scope at the cut
and simply was not read. **Fixed**: 4.5:1, or 3:1 for large text, and the message
names the floor and the size that chose it. Widens what the gate reports; the rule
stays `warn`, so nobody's gate newly fails.

### F3 — a committed config only worked from one directory

> "`gates run --config fixtures/.../vlmkit.gates.json` from repo root dies with
> `page.routeFromHAR: ENOENT … open '/home/user/vlmkit/dashboard.har'` and a
> Playwright stack trace, not a config error. A committed config whose paths work
> from only one directory is not committed."

The agent's workaround was `cd "$(dirname "$0")"` in a wrapper, labelled as a
workaround in its own comment. **Fixed**: gate processes run in the config's
directory and `source` globs expand from the same base. Configs at the repo root are
unaffected.

### F4 — `gates run` could not tell a broken page from a broken run

> "`verdict: 4 FAILED (0 passed)` with zero reasons and **no distinction between
> 'gate found defects' and 'gate never ran'**. CI cannot tell a broken page from a
> broken harness."

All four "failures" were one harness error, printed as four defects. **Fixed**:
`0 FAILED, 2 DID NOT RUN`, with the reason inline — re-running to learn why the
harness broke is a whole cycle, and CI may not have one. Also fixed: the hint offered
`pass --output <dir>` *when `--output` had just been passed*.

### F5 — `check design` said three things it did not mean

The reuse figure was an average printed as a per-style claim, contradicting its own
next sentence (`each style reused only 1.5x` … `Dominant style, used 2x`): "No style
is used 1.5 times. […] I could not tune the gate into agreement with itself." The
fingerprints hid the delta: "Both styles print `border 1`". And `--exclude` appeared
nowhere in the output that needs it — `grep -c -- '--exclude'` on the failing output
returns **0**, the same shape of gap v4 fixed for `check drift component --allow`.

**Fixed** all three, the last by noticing what the agent noticed: a dominant style
that paints no text in a zero-padding, zero-radius, transparent box is vendor chrome,
and the gate can say so.

Worth recording that the agent's guess was half wrong. It believed the delta was
`background` *and* `border-color`; `border-color` is not in the signature at all, so
the gate now correctly claims only `background-color`. Adopting the report verbatim
would have made the tool lie in a new way.

### F6 — the hint existed on two of four gates

> "the fix exists only in `--help`, and *only in 2 of the 4 gates' help text* — `check
> integrity` and `check design` print the same flag without the 'SPA that never
> reaches network idle' hint, and integrity is the gate you reach for first."

`page-load.ts` exists so these flags are declared once, and its header claimed a test
asserted they come from the fragment rather than from a copy. **No test did** — the
registry walk checked the flags exist and work, which a copy also satisfies. Both
gates now spread the fragment, and the guard asserts *identity*: "declares its own
--timeout (identical today, and still a copy)". Verified by injecting that exact
regression and watching it fail.

## Not fixed, recorded

Six findings stand. Each is real; none is a wrong measurement.

1. **`--har` is the documented reproducibility answer and there is no recorder.**
   `docs/configuration.md`: "record a HAR with Playwright and replay it" — so every
   project writes the same 20-line script, which is the knowledge-in-shell-history
   problem one level down. agent-j wrote `record-har.mjs` to finish its task. A
   `vlmkit snapshot record-har` is the obvious answer and is a feature, not a fix.
2. **A HAR has no staleness signal, and is port-bound.** An endpoint absent from the
   recording is *aborted*, which surfaces as a broken-resource **defect** rather than
   "your fixture is out of date" — a wrong finding kind, and the most serious of the
   six. The recording is keyed on the full URL, so changing the port silently stops
   it matching.
3. **`gates init` scaffolds a config that times out.** Handed an `http://` source it
   emits a plan where every gate dies in navigation. It has the URL; it could
   scaffold the flags or warn.
4. **No gate says its input was unpinned.** Four gates hit a live URL and returned
   verdicts with nothing indicating a re-run could differ. agent-j answered the
   reproducibility question by writing a jitter server and diffing outputs itself,
   and suggested `gates run --repeat 2 --require-stable`.
5. **`check breakpoints` re-fetches per width** — 6 `/api/metrics` hits per run, so
   its B-1/B/B+1 comparison spans three datasets against a live endpoint. A
   data-driven `boundary-spike` is structurally possible and would look exactly like
   a CSS bug. `--har` fixes it as a side effect; nothing warns.
6. **A verdict word can disagree with its own counts.** `verdict: DRIFT` with exit 0,
   and — after F2 — `CLEAN (0 fail, 3 warn)`. The line that resolves it is the last
   one printed, below the findings. agent-i: "a coin-flip in CI."

Also recorded, not a bug: `check a11y contrast` writes to `test-results/` in the repo
root rather than beside the page under test.

## What this round says about the loop

The animation scenario had converged to presentation-only findings. A new page with a
different defect class immediately produced **three real bugs** — a size-blind
contrast floor, a cwd-relative config path, and a summary that conflated two
different failures — none of which four rounds on the previous page could have found.

The v4 recommendation was right, and understated. It is not that a different page
finds *more*; it is that the previous page had stopped being able to find *this kind
of thing at all*.

The other lesson is about the source of the requirements. Every #112 feature worked
exactly as specified, and the two put in front of an agent were both undiscoverable
from the output that needs them. A written report tells you what to build. It does
not tell you where the reader will be standing when they need it.

## Files

- `fixtures/dogfood-dataviz-2026-08-11/` — scenario, `attempts/agent-i/`, `attempts/agent-j/`
- `packages/vlmkit-core/src/browser-launch.ts`
- `packages/vlmkit-markup/src/inspect/integrity-check.ts`
- `packages/vlmkit-markup/src/style/design-policy.ts`
- `packages/vlmkit-markup/src/gates/{integrity,design}.gate.ts`
- `src/cli/commands/{batch,gates}-cli.ts`
