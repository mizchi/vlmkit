# `vlmkit batch` — multi-page gate runner, and what it costs in CI

2026-08-02. Backlog item "マルチページランナー": run every page's gates from
one glob, and answer the CI-time-budget question with measurements instead of
a shrug.

## Design: the exit code is the interface

Each (gate, page) pair runs as its own child process, and the verdict is that
process's **exit code**. Nothing else is parsed.

That choice falls straight out of the exit-code contract unified in
`packages/vlmkit-core/src/gate-exit.ts` (suspect/defect ⇒ non-zero, warn ⇒
zero). Because the runner reads only the exit code:

- it needs no knowledge of any report shape, so a gate is batchable the day it
  lands — `check design`, added hours earlier, needed zero runner changes;
- a gate's own flags pass through untouched (`--gate "check design --min-reuse 4"`);
- one page's crashed browser cannot take the run down.

The alternative — importing each gate's `run*Check()` and reading `verdict` —
would have required per-gate adapters for four different report shapes
(`verdict: "clean" | "defects"`, `done: boolean`, `verdict: "coherent" |
"drift"`, plain finding arrays) and would have made every new gate a runner
change too.

```bash
vlmkit batch --gate "check integrity" "routes/**/*.html"
vlmkit batch --gate "check integrity" --gate "check design" "dist/**/*.html" --concurrency 4
vlmkit batch --gate "check integrity" "routes/**/*.html" --shard 2/3 --output ci-logs/
```

## Measured: concurrency sweep

9 pages (`fixtures/auto-markup-proof/creative/*.html`), `check integrity`
(the heaviest gate — 3 viewports per page), 4-core container, one discarded
warm-up run before the sweep so no row pays the cold Chromium page cache.

| concurrency | wall | job time total | avg in flight | slowest job | speedup vs serial |
|---|---|---|---|---|---|
| 1 | 34.9s | 34.9s | 1.00 | 4.3s | 1.00x |
| 2 | 20.0s | 36.0s | 1.80 | 4.4s | **1.75x** |
| 4 | 13.1s | 42.4s | 3.23 | 5.7s | **2.66x** |
| 8 | 11.0s | 64.9s | 5.92 | 8.0s | **3.17x** |

Two things to read off this:

**Per-job time inflates with concurrency, so "jobs in flight" is not speedup.**
The same nine jobs sum to 34.9s of work at concurrency 1 and 64.9s at
concurrency 8 — each job gets slower as browsers compete for 4 cores. The
first draft of the summary line divided job time by wall time and printed
"5.9x" for the concurrency-8 run, where the honest gain over a serial run was
3.17x. The output now says `avg 5.9 jobs in flight` instead, which is what
that ratio actually measures.

**The knee is at cores, and past it you buy wall-clock with CPU.** On 4 cores,
concurrency 2 is nearly free (+3% total job time for 1.75x). Concurrency 4
costs +21% job time for 2.66x. Concurrency 8 buys a further 16% of wall for
+53% more CPU — worth it on a dedicated CI runner billed by wall clock,
wasteful on a shared one. Default is `min(4, cores - 1)`.

## Measured: sharding across runners

Same page set, `--shard i/3`, concurrency 2 per shard — the "three CI machines"
case:

| shard | jobs | wall |
|---|---|---|
| 1/3 | 3 | 7.8s |
| 2/3 | 3 | 7.8s |
| 3/3 | 3 | 7.6s |

Balanced to within 0.2s, versus 20.0s for one runner at the same concurrency.
Sharding is **stride**, not contiguous slices: pages in one directory tend to
cost the same (a `routes/admin/**` subtree of dense tables is uniformly slow),
so contiguous slicing hands one shard the whole expensive subtree. Stride
spreads neighbours across shards.

## The floor

No amount of concurrency beats the slowest single job (4.3s serial, 8.0s at
concurrency 8). That is why the summary prints the five slowest jobs: when
wall time is dominated by one page, the fix is that page's gate set or that
page, not more parallelism. Adding runners past `pages / slowest-job` buys
nothing.

## Scope

- Verdicts are exit codes, so a *warn*-level finding (`check design` drift,
  `check copy` advisories) does not fail a batch run — same as running the gate
  by hand. `--output <dir>` keeps every job's log plus `batch-summary.json`
  when you want the warnings anyway.
- One gate set applies to all matched pages. Per-page gate sets remain the
  separate open backlog item (中央ゲート設定ファイル); this runner is the
  execution half, not the configuration half.
- Numbers above are one 4-core container. The point is the shape (knee at
  cores, per-job inflation, stride balance), not the absolute seconds.
