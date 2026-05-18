---
name: vrt-migration-eval
description: Evaluate whether a framework / CSS-library / build-system swap (Tailwind → vanilla CSS, reset-css switch, bundler swap, etc.) produced a visually-equivalent result. Three modes — compare (deterministic pixel + CSD), blind (agent runs without baseline reference), subagent (dispatched-agent verification) — let the caller pick the rigour level. Use when the diff is large by construction (the markup was rewritten) and a flat pixel diff would drown the actual regressions in noise.
---

# vrt-migration-eval

Migration VRT differs from "did my CSS edit visibly change something?"
(see `vrt-visual-diff`) because the markup is **deliberately
different** — Tailwind utilities become hand-written classes, CSS-in-JS
becomes CSS modules, etc. A flat pixel comparison would be 60-90%
noise. This skill structures the comparison around component bounding
boxes and computed-style deltas to surface only the deltas that matter.

## The three modes

| Mode | Cmd | What it does | Use when |
|---|---|---|---|
| **compare** | `vrt migration compare` | Deterministic: capture both, pixel diff + per-section bbox + computed-style diff per viewport | Baseline + variant are both rendered, you want a numeric verdict |
| **blind** | `vrt migration blind` | Variant agent never sees baseline pixels — only structural hints. Forces agent to converge from spec text alone | Stress-test the migration: "can the new stack reproduce the layout from scratch?" |
| **subagent** | `vrt migration subagent` | Dispatched subagent runs `compare` + writes a structured verdict | You want a fresh, unbiased read inside a longer chain |

Default to **compare**. Use blind / subagent when you're auditing the
toolchain itself, not the migration.

## Precondition (gate)

**Before running, name the migration: `<from-stack> → <to-stack>`.**
If you cannot fill in both sides (e.g. "Tailwind → vanilla CSS",
"reset-css `eric-meyer` → `modern-normalize`", "Vite → Rspack
pipeline"), this is the wrong skill — stop and use `vrt-visual-diff`
instead. The Quickstart's `vrt migration compare baseline.html
variant.html` command shape matches *any* two-file pair, so it's
easy to fall into. The named-migration check is the gate.

## Invocation

The `vrt` CLI in this repo is invoked **from source**:

```bash
node --experimental-strip-types src/cli/vrt.ts <command...>
# e.g. node --experimental-strip-types src/cli/vrt.ts migration compare baseline.html variant.html
```

The published binary (`./dist/vrt.mjs` or a globally installed `vrt`)
may lag the source. If it errors with `Unknown command: migration`,
the dist is stale — run `pnpm build` or use the source form. All
`vrt ...` invocations below assume one of these two forms.

## When to use

- Tailwind → vanilla CSS (or vice versa) port.
- Bootstrap / Bulma / Reset-CSS swap.
- Bundler swap (Vite → Rspack etc.) where the CSS pipeline differs.
- Theme system rewrite (CSS variables → design tokens).

## When NOT to use

- Single CSS file edit: use `vrt-visual-diff`.
- New page being authored from scratch (no baseline): use
  `vrt-markup-synth`.
- CI gate over time: use `vrt-regression-watch`.

## Quickstart

`--output <dir>` is a **directory** path; the engine writes
`<dir>/migration-report.json` (+ per-viewport PNGs) into it. Pass
that JSON file — not the dir — to `vrt diff agent`.

```bash
# Two HTML files, side by side → writes reports/migration-report.json
vrt migration compare baseline.html variant.html \
  --output reports/

# Two URLs (different dev servers / preview deploys)
vrt migration compare \
  --url http://localhost:3000/ \
  --current-url http://localhost:8080/ \
  --mask ".marquee-container,.hero-badge" \
  --output reports/

# Then format for the agent
vrt diff agent reports/migration-report.json
```

## Computed-style diff is the load-bearing signal

Pixel diff catches large layout shifts but **misses semantic
divergence** that produces identical pixels by accident — e.g. one
side uses sibling `margin`, the other uses flex `gap` with the same
visual result, but the next responsive breakpoint diverges. CSD
captures the (selector, property, value) tuple per viewport so the
report surfaces:

- **Universal pairs**: selectors whose properties differ on every
  viewport. Almost always "fix the base rule."
- **Breakpoint-gated pairs**: selectors that differ on a viewport
  subset. Almost always "missing or wrong `@media` rule."

`vrt diff agent` renders these as two subtables under "Verified
deltas (computed-style) × viewport" — read top-to-bottom.

## Mode: blind

```bash
vrt migration blind <baseline-url> <variant-url> --rounds 3
```

The variant builder agent gets:
- The baseline URL (for spec inference only — pixels not surfaced).
- A budget (N rounds).
- A success metric (target diffRatio threshold).

After each round, `migration blind` runs `migration compare` and feeds
the diff signal back. The point is to learn whether the agent can
converge purely from CSD + structural hints, without "looking" at the
target. Use this when evaluating how robust the new stack's authoring
ergonomics are.

## Mode: subagent

```bash
vrt migration subagent baseline.html variant.html
```

Spawns a fresh CC subagent that runs `vrt migration compare`, reads
the Markdown report, and writes a verdict. Useful inside a longer
chain where you want one unbiased opinion ("is this migration done?")
without the caller's context bleeding in.

## Masking is non-optional

Migration diffs include cosmetic differences in non-deterministic
content (timestamps, marquee animations, generated IDs). Always pass
`--mask <selectors>` for any selector whose content isn't
controlled. The `vrt diff html` quickstart in `vrt-visual-diff` shows
the syntax — `migration compare` accepts the same flag.

## Environment

| Variable | Purpose |
|---|---|
| `VRT_LLM_PROVIDER` | `gemini` (default) / `openrouter` — only the `subagent` mode invokes an LLM |
| `VRT_LLM_MODEL` | Override the model (e.g. `claude-haiku-4-5`) |
| `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | Required for `subagent` mode only |

## Outputs

| File | Mode | Purpose |
|---|---|---|
| `migration.json` | compare | machine input to `vrt diff agent` |
| `migration-<vp>.png` | compare | pixel diff per viewport |
| Markdown verdict | subagent | structured agent reply |
| `rounds/<N>/` | blind | per-round capture + diff trail |

## Failure modes

- Variant URL not served on stated port → "ECONNREFUSED"; start the
  dev server first.
- Pixel diff > 0.5 across all viewports → the variant page is showing
  an error page, not the migrated content. Check the URL.
- CSD universal pairs empty but pixels diverge → reset-CSS shift (the
  selectors in the baseline don't exist in the variant). Use the
  bySelector counts in the report to find missing selectors.
