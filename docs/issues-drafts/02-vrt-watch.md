# Dev inner loop: `vlmkit watch` + round-vs-round diff for fast iteration

## Context

The 2026-05-15 closed-loop validation runs (agent-a … agent-d) each
took 45–146 tool calls × ~10 seconds per `vlmkit diff html`. That's an
acceptable cost for a one-shot convergence loop, but it's far too
slow for a developer-or-agent actively writing CSS. Today every
re-run starts cold: full browser launch, full diff pipeline, full
JSON emit, full triptych compose.

The data needed for fast iteration is already there — what's missing
is two pieces of UX glue:

1. **A file-watcher that re-runs vlmkit on save.** No tool today; users
   alt-tab back to the terminal and re-type the compare command
   between every edit.
2. **A round-vs-round diff.** vlmkit currently only compares variant vs
   golden. The agent's most-useful cognitive prompt during a long
   loop is "what did I just change that affected the diff in
   direction X?" — which requires variant-now vs variant-previous-run
   data that nothing surfaces today.

## What's needed

### `vlmkit watch <baseline> <variant>`

```
vlmkit watch fixtures/golden/page.html src/page.html \
  --tokens DESIGN.md \
  --output .vrt/runs/
```

- Watches the variant's HTML + its referenced stylesheets (resolved
  via the same file-mode `page.goto(file://)` machinery that powers
  `vlmkit diff html`).
- Debounce: ~150 ms after the last write event to coalesce burst
  saves.
- Mutex: one compare runs at a time. New file events during a run
  queue exactly one follow-up; further events overwrite the queued
  one.
- Persistent output paths so an external viewer (image preview tab,
  another shell tailing files) sees fresh content on each run.
- On Ctrl-C, prints the summary of the last run and exits cleanly.

### Round-vs-round diff

After each run inside the watch loop, emit a small markdown summary
to `.vrt/runs/latest-delta.md` (and stdout) describing the diff
between this run and the previous one — NOT against the golden, but
against the variant's own prior state.

Sections:

- **Your changes** — selectors / properties whose computed-style
  changed between the previous run and this one. Sourced from
  `computedStyleDiff` between consecutive `migration-report.json`s.
- **Effect on goldens** — per-viewport diff% delta (e.g.
  `desktop: 2.0% → 0.6% (-1.4pp)`).
- **Suggestion stability** — wireframe-fix suggestions that:
  - **resolved**: appeared in previous run but not this one (positive)
  - **persisted**: appear in both
  - **newly introduced**: didn't exist before, exist now (negative —
    your edit regressed something)

The "newly introduced" category is the most-valuable signal: it tells
an agent that their last edit broke something it didn't intend to.
This is the watcher analog of agent-c's round-3 desktop regression
that they only discovered on the *next* round.

## Done when

- [ ] `vlmkit watch` enters a stable loop with debounced re-runs.
- [ ] Inter-run diff produces `latest-delta.md` with the four
      sections above.
- [ ] Tests:
  - simulated file modifications trigger exactly one re-run
  - inter-run "newly introduced suggestion" surfaces when a fake edit
    regresses a metric
- [ ] Doc updated.

## Out of scope

- IDE integration (LSP / VSCode extension).
- Remote watch / sync.
- Hot-reload of the loaded HTML (we still go through a clean
  `page.goto` each round).

## Severity

`major` — dev experience. The inner loop directly determines whether
a human/agent can stay in flow during UI implementation. 10-second
round trips break flow.

## Open question

Do we wire `vlmkit watch` to the existing snapshot baseline machinery,
or keep it as a two-file compare wrapper for v1? Recommend the latter
to ship quickly; baselines integration is in the baseline-and-approve
ticket.

## References

- `src/migration-compare.ts` (compare pipeline to wrap)
- `chokidar` is already in node_modules transitively via Playwright
  for file watching; check before adding a new dep.
