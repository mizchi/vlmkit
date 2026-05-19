# Dogfood: sol.mbt — verifying the merged agent-skills fixes

Date: 2026-05-19
Site: `~/ghq/github.com/mizchi/sol.mbt/website/dist-docs/` served via `npx serve … -p 3000`
URLs probed: `/`, `/luna/`, `/sol/`, `/benchmark/` (the `Taskfile.pkl` definition also lists `/luna/tutorial-js/islands/`, which is now 404 — see Findings).

## Goal

Validate three fixes that landed during agent-skill v1–v5 rounds, against a real static site instead of synthetic fixtures:

1. **PR #50 — diff-report rename + dual-write** (`migration-report.json` kept as legacy alias, both byte-identical)
2. **PR #51 — Verified deltas hoist** (section #2, right after `Diff by viewport`)
3. **Snapshot false-positive baseline** — a no-op re-run must produce 0% across all viewport pairs

## Results

### 1. Snapshot false-positive (8 viewport pairs, 0/8 diff)

```
$ vrt snapshot http://localhost:3000/ http://localhost:3000/luna/ \
    http://localhost:3000/sol/ http://localhost:3000/benchmark/ \
    --output test-results/snapshots/sol \
    --mask ".marquee-container,.hero-badge"

# First run
  New baselines: 8

# Second run (same inputs)
  localhost_3000_root         desktop 0.0%   mobile 0.0%
  localhost_3000_luna         desktop 0.0%   mobile 0.0%
  localhost_3000_sol          desktop 0.0%   mobile 0.0%
  localhost_3000_benchmark    desktop 0.0%   mobile 0.0%
  Compared: 8 | Diff > 0: 0 (0.0%)
  All snapshots match baseline
```

**Verdict**: PASS. Deterministic re-capture on real-world Vite-built static site. The default `.marquee-container,.hero-badge` mask was enough — no flapping selectors on sol's docs site.

### 2. Dual-write (PR #50)

```
$ vrt migration compare \
    --url http://localhost:3000/luna/ \
    --current-url http://localhost:3000/luna/ \
    --output test-results/dogfood-luna-migration \
    --mask ".marquee-container,.hero-badge"

$ ls test-results/dogfood-luna-migration/
diff-report.json
luna-desktop.png
luna-mobile.png
luna-wide.png
migration-report.json

$ diff -q diff-report.json migration-report.json
# (no output → byte-identical)
```

**Verdict**: PASS. Both filenames present, byte-identical. Legacy callers pinning `migration-report.json` continue working; new callers can use `diff-report.json`.

### 3. Verified deltas hoist (PR #51)

`vrt diff agent` on `fixtures/element-compare/` emitted sections in this order:

```
# VRT diff (for agent)
…
### Diff by viewport (worst first)
| Viewport | Diff | … |
…

### Verified deltas (computed-style) × viewport (catches breakpoint-gated rules)
#### Universal pairs (every viewport — fix the base rule)
| Selector | Property | Baseline | Variant |
| `>h1[1]`     | font-size       | 24px | 32px |
| `>h1[1]`     | height          | 28px | 37px |
| `>header[1]` | height          | 28px | 61px |
| `>header[1]` | padding-bottom  | 20px | 60px |
| `>header[1]` | padding-top     | 20px | 60px |

### Per-section diffRatio (heatmap × component-bbox)
…
```

**Verdict**: PASS. `Verified deltas` is section #2 (line 16 of the Markdown), directly after `Diff by viewport`. The triage order documented in `vrt-visual-diff/SKILL.md` matches actual output.

## Findings (separate from the three checks)

### F1 — `Taskfile.pkl` `dogfoodSol` task points at the wrong entry

```pkl
local dogfoodSol = new Task {
  name = "dogfood-sol"
  cmd = #"""
    node src/cli/commands/snapshot.ts \
      http://localhost:3000/ \
      …
  """#
}
```

`src/cli/commands/snapshot.ts` is a library (525 lines of types + helpers, no main entry). Running `node src/cli/commands/snapshot.ts --help` exits 0 with no output — the task silently no-ops. The 0.5.0 CLI entry is `src/cli/vrt.ts`, so the cmd should be:

```pkl
cmd = "node --experimental-strip-types src/cli/vrt.ts snapshot http://localhost:3000/ …"
```

This is a regression introduced when the CLI was restructured to the `vrt <group> <leaf>` shape. The unit test in `src/cli/commands/snapshot.test.ts` exercises the library API and doesn't catch this. Worth fixing in a follow-up PR.

### F2 — `dogfoodSol` URL list contains a stale 404

`http://localhost:3000/luna/tutorial-js/islands/` is in the task URL list but sol.mbt's current build only ships `luna/tutorial-js/islands_basics/` and `luna/tutorial-js/islands_state/`. The bare `islands/` path 404s. Either the upstream docs were reorganized or the Taskfile was authored against an earlier build.

Recommendation: drop the URL, or replace with one of the actual subdirs.

## Stop-sign check

This dogfood was an external verification of the v1–v5 loop's merged work, not another loop round. The three merged fixes each held up under real-world inputs. No further skill-side iteration warranted from this exercise.

The two findings (F1, F2) are infrastructure-side, not skill-side — filed as #54 (Taskfile.pkl `dogfoodSol` invokes a library file) and #55 (stale islands URL).
