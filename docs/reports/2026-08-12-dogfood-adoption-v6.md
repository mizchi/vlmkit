# Dogfood v6: adoption, and the regression it caught (2026-08-12)

## Question

Five rounds varied the page and the budget and kept the posture: an agent handed a
fixture, told to fix it or to produce evidence from it. The axis never varied is the
posture — and it matters, because **every real finding in this project traces back to
#112**, which was neither task. It was someone adopting the tool into a repo they owned,
next to a test suite they could not break.

So: a small orders console (`consumer/`) with its own `package.json`, unit tests that
run offline, its own Playwright pin, and a dev server whose data moves between requests
and whose `/api/stream` never closes. One agent, three rounds, three constraints from
the brief — don't break `pnpm test`, make the diff self-explanatory, **triage rather
than fix**.

That last one is the point. Five rounds of "make the gates pass" selected for agents
that work *around* a bad message. This one asked an agent to judge them.

## Result

It adopted the tool, and it caught a regression I had introduced two days earlier that
five rounds of fix-tasks could not have surfaced.

| | |
|---|---|
| Rounds | 3 of 3 |
| Deliverables | config + one command, triaged findings, `pnpm test` evidence — all three |
| Real defects found in the console | 4 |
| Findings judged "the tool is wrong or unhelpful" | 4 |
| Console files edited to make a check pass | **0** (`diff -r` clean) |
| Verdict | "Yes — pinned to a HAR. I would not keep it in the shape it ships in." |

## The regression

```
verdict: 2 FAILED, 1 DID NOT RUN (5 passed)
  ! check a11y contrast … (exit 1, 2.2s)
      did not run:   vlmkit check a11y contrast
```

> "But `vrt/results/check-a11y-contrast-….txt` contains a complete measurement
> (`inspected 9 text-bearing element(s)` / `✗ 3 contrast failure(s)`) […] The summary
> reports a real WCAG failure as infrastructure noise. This alone would get the tool
> distrusted in a code review."

Its hypothesis was indentation. The truth was worse: **4 of 12 gates print no
`verdict:` or `status:` line at all** — `check a11y contrast`, `check a11y touch`,
`check a11y focus`, `check tokens`. My `gateReported()` keyed on exactly that line.

**The reasoning error is the part worth keeping.** When I moved the exit-intent line
under the verdict, I justified the anchor by writing that it "is not invented:
`batch-cli`'s `gateReported()` already depends on the same convention" — citing code I
had written myself the same day, and never checking how many gates follow it. Circular,
twice. `withExitIntent` survived it because absence falls back to appending;
`gateReported()` did not, because absence was load-bearing there.

Fixed by keying on the banner (`vlmkit <command>`), which all 12 gates do print and a
harness failure does not — verified across all twelve this time.

Its own summary of why this one mattered more than the rest:

> "What would change my mind to a flat no: if #1 were declined. Everything else I can
> work around in config; a summary that lies about what ran is not something a consumer
> can patch from the outside."

## What the shipped fixes did, unprompted

Five fixes from this cycle sat in the adopter's path, and the agent had never been told
they existed. Two did the adoption *for* it:

> "Every unpinned URL run appended, unprompted: `… is live and not pinned — a re-run may
> measure different data. Pin it: vlmkit snapshot record-har …`. That is the entire
> answer to 'how does this go in CI', volunteered before I asked. **I would not have
> thought to look for it.**"

> "`gates init` added two flags I had not asked for and justified them: `Added
> --wait-until load --timeout 15000 because the source is a URL …`. That is precisely
> this app's `/api/stream`. **It diagnosed a trap I had not hit yet.**"

Both were written from v5's findings, where an agent had to discover the same things
from `--help` after burning a round. And `record-har` warned it about the mistake it
would have made later — "keyed on the full URL, so a different host or port stops
matching".

The result is a hermetic gate: `pnpm vrt`, 8 gates, ~8s, **no dev server and no port**,
verified by killing the server and re-running to identical findings.

## Fixed from this round

- **`gates run` misclassifying a gate that ran** (above).
- **A `//` key inside `rules` is now a comment**, as it already was one level up.
  `suppressions` carry `reason`/`owner`/`expires`; `rules` carried none, and the obvious
  workaround was rejected by the validator — so the justification for "the tool is wrong
  about this finding" could not sit next to the decision. The agent's larger point
  stands and is recorded: the auditable path exists for suppressions while the
  un-auditable one is what a false positive needs, which inverts the project's own best
  idea.

## Recorded, not fixed

Each verified, none a wrong measurement.

1. **The same three CSS colours produce eight findings.** `check integrity` emits one
   `low-contrast-text` per table row (`#rows > tr:nth-of-type(1) > td:nth-of-type(4)`,
   `(2)`, `(3)`) where `check a11y contrast` correctly collapses to three. "Eight lines
   for three CSS colours is how a gate becomes something people pass `--advisory` to."
2. **Demoting a rule demotes nothing visible.** `--rule component-drift=info` re-tunes
   the verdict and prints `re-tuned: component-drift warn->info`, but the finding still
   renders with a warn-shaped `!` and the verdict still says `DRIFT` — because
   `gate.format(report)` never sees the applied rules. Reproduced. Fixing it is a
   contract change, and after being burned twice this cycle on clever inference over
   gate-owned prose, it should be the contract change rather than a third heuristic.
3. **`--min-reuse` cannot reach the value it is recommended for.** The metric is
   instances/styles, so a 3-element role with one deliberate variant averages 1.5x and
   no threshold short of disabling the check clears it. `examples/vlmkit.gates.json`
   recommends `--min-reuse 2` for exactly this case. `check design` needs a per-selector
   allow like `check integrity --allow`.
4. **Adopting the tool dirtied the repo silently.** `--output` covers stdout logs;
   `test-results/` and `.vlmkit/run-ledger.jsonl` have no flag and nothing announces
   them. The agent found them with `ls` and wrote the `.gitignore` itself.
5. **No `webServer` equivalent** in `vlmkit.gates.json`, which Playwright has had for
   years. The HAR path made it moot here.
6. **`skipped: 28 (no inferable role)`** — 28 of 30 elements skipped means the verdict
   rests on almost nothing, and nothing says whether that is normal.
7. **`rules` needs a first-class `reason` (and `expires`)**, not just a comment key.

Also: the agent judged `component-drift` a **false positive** on this page — three
buttons, two styles, one is the primary action. It demoted the rule rather than
contorting the console. That is the triage the round was built to observe, and it landed
on the same conclusion the v5 report reached from the other direction.

## What the posture bought

The four "tool is wrong" findings are a category five rounds of fix-tasks never
produced, because a fix-task agent's incentive is to get past a bad message, not to
rule on it. The regression is the sharpest case: an agent told to make gates pass would
have seen `DID NOT RUN`, added `--wait-until`, and moved on.

Where to go next is now a real question rather than an obvious one. The adoption posture
found a class of problem in one round; whether a second round of it finds more, or
whether the loop is done, is not answerable from here.

## Files

- `fixtures/dogfood-adoption-2026-08-12/` — scenario, `consumer/`, `attempts/agent-k/`
- `src/cli/commands/batch-cli.ts`
- `packages/vlmkit-core/src/plugin/rules.ts`
