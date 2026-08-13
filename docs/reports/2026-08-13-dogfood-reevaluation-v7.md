# Dogfood v7: re-evaluate the three existing scenarios (2026-08-13)

## Question

v6 recorded seven findings and all seven were fixed the next day. The fixes were
written from the agent's words, verified with unit tests, and verified by hand on
the pages the words came from. None of that answers the question this round asks:

**do the recorded findings still fail to reproduce on the scenarios that produced
them, and does the tool feel different to an agent who has never seen it?**

No new scenario. Three existing ones, re-run:

| scenario | prior runs | what it exercises now |
|---|---|---|
| `dogfood-animation-2026-08-10` | v1–v4, agents a–h | regression check: v4 closed all six of its gaps in v4 itself |
| `dogfood-dataviz-2026-08-11` | v5, agents i–j | the coverage line, `--allow`, `webServer` on a page whose `/api/live` never closes |
| `dogfood-adoption-2026-08-12` | v6, agent-k | all seven v6 fixes, in the triage posture that produced them |

## Part 1 — deterministic pass (no agents)

Cheapest first, and the honest order: before spending agents on a tool, check that
the fixes hold on the pages the complaints came from.

### The seven v6 findings, re-measured on the v6 console

| v6 finding | then | now |
|---|---|---|
| 1. eight findings for three CSS colours | 8 rows | **3 rows**, and `check a11y contrast` also reports 3 — exact parity, which was the complaint |
| 2. demoting a rule demoted nothing visible | `!` + `DRIFT` under `=info` | `verdict: … 0 warn, 3 info`, rows carry `i`, `re-tuned:` still printed |
| 3. `--min-reuse` could not reach the case | no expressible fix | `--allow "button#export;…"` → `COHERENT`, `allowed: 1 button instance(s)` |
| 4. the repo was dirtied silently | nothing announced | announced on first write — **but see Part 1b, this was only half true** |
| 5. no `webServer` | HAR workaround | one committed config starts the console, runs both gates, stops it |
| 6. `skipped: 28` uninterpretable | bare count | `coverage: 4 of 32 …` + `no role: td x12, th x4, tr x4, p x2, …` |
| 7. `rules` had no `reason`/`expires` | comment key only | long form parses, appears in `gates suppressions` tagged `[rule]` |

The v6 page's three greys are `#9a9a9a` (2.81:1), `#8d8d8d` (3.32:1) and `#a0a0a0`
(2.61:1); the three table rows that used to be three separate findings are now one
row reporting `3 element(s)`. Finding 6's numbers match the report exactly — the same
28 skipped, now reported as a fraction of 32 considered.

### Part 1b — the fix for finding 4 did not cover the path it was for

Re-running the scenario the way the scenario asks — one committed config, one
command — produced `.vlmkit/run-ledger.jsonl` in the working directory and said
**nothing about it**. Which is finding 4, verbatim, after finding 4 was fixed.

The cause is that the first-write notice is printed by the gate, and under
`gates run` each gate is a **child process whose stdout the batch runner
suppresses**. So the notice works when a gate is run by hand and is invisible on
the path an adopting project actually uses — the path the config exists to create.

It also never covered `test-results/` at all: a gate prints `report: <path>` for
what it wrote, but nothing said that directory was new and untracked, and that was
half of what v6's agent found with `ls`.

**Fixed** (`2892b5b`) on the batch summary, where both halves are visible and the
report is once per run rather than once per gate:

```
This run created 2 untracked path(s):
    .vlmkit/        an append-only record of every gate run, one line each
    test-results/   the gates' own reports and screenshots
Neither is in .gitignore. `vlmkit gates init` writes those entries for you.
```

Reported only for paths *this* run brought into existence — existence is snapshotted
before the jobs start — so a project that has seen it once does not get it again.

One bug of my own caught in review of that message: the single-path branch read
`It is in .gitignore.`, the opposite of the truth, in the one line whose whole job
is to say the path is untracked. Both branches are now asserted in tests.

### The animation scenario — regression check only

All four planted defects still reproduce on today's build: `page-overflow-x` (46px
at 768px, blamed on `#publish`), focus `[reverse]`, `reduced-motion-ignored` (5
animations still running), `infinite-animation` (`settle: never`). v4's six gaps
were all fixed within v4, so this scenario has no outstanding recorded finding —
which is what v4 concluded when it recommended a different page over a tighter
budget. Nothing shipped since has regressed it.

## Part 2 — fresh agents on the same scenarios

Two agents, neither having seen the other, on the two scenarios that most directly
exercise the seven fixes. Both prompts named the new affordances, because a fresh
agent cannot discover a flag it is forbidden to read the source for — and this round
asks whether they *help*, not whether they are findable.

| | agent-m (dataviz, repair, 3 rounds) | agent-l (adoption, triage) |
|---|---|---|
| prior run | agent-i / agent-j (v5) | agent-k (v6) |
| reached its criteria | yes — `ALL PASS (6/6)`, 15.1s cold | yes — `pnpm verify:ui`, 6 gates, 7s |
| used `webServer` | yes, verified with `CI=1` and no server running | yes — "no shell wrapper" |
| edited files it was told not to | none | none (`public/`, `src/` untouched) |
| host suite | n/a | 3 pass before and after |
| new "the tool is wrong" findings | 4 | 6 |

Both used `webServer` without being walked through it, and neither reached for a HAR
to work around a live server — which is what v6's agent had to invent. agent-m on the
part that used to cost a round:

> "I expected to spend the round guessing at the hang; instead the timeout error
> diagnosed it, and `gates init` pre-inserted `--wait-until load` for a URL source
> with a written reason."

### The finding of the round — `--allow` made the gate green forever

agent-m followed `check design --allow`'s own help text and landed in a
configuration that cannot report anything, then proved it deliberately:

> "Its help says: *'Use this rather than --min-reuse: … a 3-element role with one
> deliberate variant averages 1.5x and no threshold reaches it.'* I followed that.
> Result: `verdict: COHERENT (0 finding(s))`. I then broke `#snooze` on purpose —
> `COHERENT` again. Allowing one of 3 buttons leaves 2, below the default
> `--min-instances 3`, so the role stops being judged and **a skipped role prints
> identically to a coherent one**. […] So both documented configurations reproduce the
> exact complaint I was sent to fix — a verdict that never moves."

Reproduced, and worse than described: the role row printed `2 inst 2 styles reuse 1x
2 one-off` next to **`ok`**, under `COHERENT`. The row carried its own refutation.

This is a **false negative created by the fix for a false positive**, shipped one day
earlier, and the help text steering into it was written in the same commit. The
self-sabotage test is what caught it; no unit test would have, because the unit test
I wrote asserted `verdict === "coherent"` for exactly this input — it encoded the bug
as the expectation.

**Fixed** (`a079a76`). The arithmetic stands: two instances genuinely cannot clear a
3x floor, so declining to judge is correct. Declining *silently* was the defect.

```
verdict: NOT JUDGED (1 finding(s))
  roles judged: 0 of 1 seen, spacing values: 4
  button           2 inst    2 styles  reuse     1x  2 one-off  not judged
  not judged: button (2) — under --min-instances 3, so no finding can come from it.
  --allow took button under that floor. A real drift there would NOT be reported.
  To keep judging it: --min-instances 2 --min-reuse 2 (both — a 2-instance role
  cannot reach 3x however many instances the floor allows).
```

`not-judged` is a third **verdict state**, not a rendering tweak, because `--json` is
what CI reads and reporting `coherent` there is the same lie where nobody can see it.
A `nothing-judged` rule (info) makes it gateable: `--rule nothing-judged=suspect`
enforces "this gate must actually measure something". agent-m's own thresholds are
verified to move the verdict in both directions.

> "A tool whose job is telling you when a number stops moving should not be able to
> stop moving in silence."

### `--allow` could not scope the one thing it was needed for

agent-l hit the same class from the other side, on `check integrity`:

> "`--allow` can't scope `page-overflow-x`. `@table.orders` → `1 --allow rule(s)
> matched nothing` though the message says *'caused by: table.orders'*; there's no
> `selector` in the JSON. […] So the only working form is page-wide — I added a
> 1400px panel and got `NO DEFECTS … EXIT=0`. **CI is now blind to new overflow**;
> documented in the config."

The worst shape a suppression can have: the only expressible form silenced the whole
rule, so accepting one known overflow meant accepting every future one. The blamed
element was measured and printed all along — it just never reached the `selector`
field the matcher reads.

**Fixed** (`de9de2f`). Verified by re-running agent-l's own experiment: with the
narrow exemption committed, injecting a fresh 1400px offender reports `DEFECTS` and
exits **1**.

### The adoption path showed none of its findings

> "`gates run` prints `ALL PASS (6/6)` and shows none of the 10 warn findings. Adopt
> it naively and you learn nothing. Only `--output` preserves them."

The findings are the product, and `gates run` is the path a project adopts.
**Fixed** (`73dc7ef`) — the summary now names them:

```
24 warn(s) in 3 passing gate(s) — not shown above, and they did not fail the run:
      1  check design
     20  check tokens
      3  check breakpoints
See them: --show-output, or --output <dir> to keep every log. Gate on one: --rule <id>=suspect.
```

Read from the runner's own `exits 0 — N warn(s)` line, and this time the coverage was
**checked across the gate set before relying on it** rather than assumed — the
mistake `gateReported` made in v6 was trusting a convention only 8 of 12 gates
followed.

### My own `webServer`, one day old, broke `--json`

> "`gates run --json` is unparseable — the child server's stdout lands first:
> `orders console on http://localhost:4310/\n{`. vlmkit's own `webServer:` lines go
> to stderr correctly; the server's don't."

The spawn inherited stdout so a boot failure would reach the terminal. It still does
— stderr is a terminal too — and stdout is the command's result, which `--json` is a
contract for. **Fixed** (`2c171c1`); `gates run --json` now parses with a `webServer`
declared.

## Recorded, then fixed

Verified, none a wrong measurement, and all eight fixed the same day. Three of them
turned out to be **worse than their own reports** once measured; that is recorded
below rather than smoothed over.

1. **`gates run --json` gives ANSI-escaped child output, not structured findings.**
   > "findings arrive as one ANSI-escaped `output` string, not structured."
   The warn *counts* now surface (above), but a CI job wanting the findings themselves
   still parses terminal text. Needs the batch runner to invoke children with
   `--json` and merge envelopes, keeping the prose path for the failure display.

   **Fixed** (`3f533e6`): exactly that. Each child's envelope lands on the job as
   `gateReport` — verdict, counts, findings — turning one opaque string into 24
   addressable findings across three gates on the adoption scenario. The child's
   stdout is captured separately from its stderr to do it, which is the same lesson
   as the `webServer` greeting two commits earlier. An unparseable child falls back
   to `unparsedOutput` rather than throwing: a gate that dies in navigation prints
   prose, and losing the run's JSON because one job failed early would make the
   machine path less reliable than the prose one.
2. **`scan handlers` reports `registrations: 0 across 0 element(s)` → status `ok`.**
   > "zero listeners on a 3-button page is the finding."
   agent-l separately found all three buttons inert (`inert-control`), so the
   information exists in another gate; this gate's own zero is the wrong verdict.

   **Fixed** (`32936c3`): the collector now counts the controls the page presents —
   the denominator that was missing, since a static document and a page of dead
   buttons printed the same zero. The finding names all three explanations, because
   only one is a defect and this gate cannot tell which: inert controls, handlers it
   cannot attribute, or a page that genuinely needs none. `warn`, not `suspect`. And
   `status: ok` stopped printing beside a warn — the same self-contradiction
   `check design` had.
3. **`check a11y touch` has no `--exclude` and no selector `--allow`** while
   `check design` and `check integrity` both do.
   > "Vendor DOM is a page-level fact, not a per-gate one. The only exit is turning
   > the one rule off page-wide, which also stops checking our own buttons."
   Same for `check a11y contrast`: *"red CI or contrast off, nothing between."*
   Suggests a page-level `--exclude` shared by every gate rather than per-gate flags.

   **Fixed** (`3f2cb3d`) as a per-selector `--allow` on both. The contrast half was
   the sharper one: `check integrity` reports the same colours as a *warn* with an
   exemption, while this gate reports them as a *fail* with none — so one approved
   grey forced the whole rule off. Now one grey is exempted and named while the other
   two still fail. Three exemption parsers already existed, so the
   `<selector>;<reason>` form was extracted into `inspect/selector-exemption.ts` and
   `check design` moved onto it rather than a fourth copy being written. A
   config-level `exclude` shared by every gate is still the better shape for vendor
   DOM, and is not built.
4. **`check a11y touch --level AA` may contradict its own help.**
   > "Help: *'Clustered targets (within 24px of a sibling) are flagged…'* The vendor
   > buttons are 24x24 with a 4px gap; at `--level AA` it reported `✓ 0 undersized
   > target(s)`. Either the clustering check doesn't run at AA, or the help is wrong."
   Unresolved which; both are defects, and the answer decides the fix.

   **Determined, then fixed** (`62ffb3d`): the help was wrong. Clustering is computed
   only on targets already below the floor, so it annotates a finding and never
   causes one, and a 24x24 target passes AA on size — WCAG 2.5.8 sizes targets and
   does not condemn a compliant one for being adjacent.

   Checking it surfaced a worse bug the report had not reached. Dedupe keyed on the
   generated CSS path, which identical siblings share, so three buttons in one `div`
   collapsed to one element — and cluster detection, which compares each target
   against the *others*, had nothing left to compare against. Same pixels, same
   geometry, and the verdict moved with the markup:

   ```
   distinct classes -> inspected 3 | failures 3 | clustered 3
   identical markup -> inspected 1 | failures 1 | clustered 0
   ```

   So the most common clustered case — a row of identical icon buttons — could never
   report a cluster, and coverage was understated. Keyed on path plus position now.
5. **`gates list` prints plans that cannot run.**
   > "It listed `check layout … http://localhost:5311/` as job 4 of 7; only
   > `gates run` revealed `did not run: error: --contract <contract.json> is
   > required`. `list` validates rule names but not required flags."

   **Fixed** (`c2007a4`): **seven** gates declare a required flag and `check
   equivalence` declares two, so this was not one gate's quirk. Validated against
   the resolved command line, suppression flags included, so a suppression that
   supplies the flag counts as supplying it.
6. **Rule settings fan out to every gate's command line.** Both agents, independently.
   `--rule check.a11y.touch/target-undersized=off` is appended to `check copy` too,
   and a typo'd key printed the same config error once per gate.

   **Fixed** (`b9487fc`): the command line is filtered by the registry — a key
   belongs to a gate when it names that gate or is a bare rule id the gate declares.
   An unresolvable key is passed through rather than dropped, because dropping it
   would turn a config error into a setting that quietly does nothing. The validation
   split follows the same line: a qualified key is a config-level fact and is checked
   once with the whole catalog in view, while a bare rule id can only be judged
   against a gate and stays per-job.
7. **`.vlmkit/` and `test-results/` are written to the cwd, not the config's
   directory** — where v5 moved every *input* path. agent-l wrote the discrepancy
   into their `.gitignore` as a comment, which is the clearest possible signal that
   it is a real gap.

   **Fixed** (`b9487fc`), and the defect was worse than "wrong directory": the
   children run with the config's directory as their cwd, so their reports and ledger
   lines went there, while the batch process's own append used `process.cwd()`. A
   `gates run --config ../proj/...` from a sibling directory therefore wrote **two**
   ledgers in two places, each holding half the run.
8. **`gates init` did not scaffold `webServer` for a localhost URL** even though it
   already scaffolds `--wait-until load` for one. A `localhost` source implies a dev
   server the same way a URL source implies a page that may never idle.

   **Fixed** (`c2007a4`). The command is a placeholder and the output says to replace
   it: a wrong command that *looks* configured is worse than an obvious blank,
   because the run would start something unrelated and gate whatever answered.

## Honest read

Two of the four fixes in this round were defects in code shipped the day before, and
both were found by an agent doing the thing the code was written for. The
`--min-instances` hole is the sharpest lesson available: a fix for a false positive
introduced a false negative, my unit test asserted the false negative as correct, and
only a fresh agent's deliberate self-sabotage test surfaced it. The loop earns its
keep specifically where unit tests cannot go — an agent following the documentation
into a hole the author cannot see because the author wrote the documentation.

Three of the eight recorded findings were **understated by their own reports**, and
none of the three came apart from reading — only from measuring:

- `.vlmkit/` "written to the wrong directory" was actually two ledgers, one per
  process, each holding half the run;
- `--level AA` "contradicts its help" was actually a measurement that changed with
  markup detail nobody can see;
- `gates list` "prints plans that cannot run" named one gate and covered seven.

Worth naming as a pattern: an agent reports the symptom visible from outside, and
the maintainer's job is not to implement the report but to find what produces it.
Taking any of the three at face value would have shipped a smaller fix that left the
real defect in place.

## Files

- `fixtures/dogfood-{animation-2026-08-10,dataviz-2026-08-11,adoption-2026-08-12}/`
- `src/cli/commands/batch-cli.ts`, `src/cli/commands/batch-cli.test.ts`
