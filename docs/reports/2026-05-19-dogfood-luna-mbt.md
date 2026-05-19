# Dogfood: luna.mbt — completing the #18 pair

Date: 2026-05-19
Site: `~/ghq/github.com/mizchi/luna.mbt/dist/luna/` served via `npx serve … -p 4200`
URLs: `/src/examples/{todomvc,spa,wc,apg-playground,browser_router,css_split_test}/`

Companion to `2026-05-19-dogfood-sol-mbt.md`. Together they close #18.

## Goal

Run `pkf run dogfood-luna` (PR #57's fixed task) end-to-end against luna.mbt and verify the snapshot pipeline stays deterministic on this codebase's most realistic frontend fixture.

## Results

### Snapshot false-positive (12 viewport pairs, 0/12 diff)

```
$ pkf run dogfood-luna
…
  New baselines: 12
[pkf] dogfood-luna: ran a443f71194e9
[pkf] done: 1 task · 0 hit · 1 ran · 0 uncached (7.886s wall)

# Second pass — pkf cache-hit short-circuits (cmd hash + no input deps).
# Re-running the underlying command directly:
$ node --experimental-strip-types src/cli/vrt.ts snapshot \
    http://localhost:4200/src/examples/{todomvc,spa,wc,apg-playground,browser_router,css_split_test}/ \
    --output test-results/snapshots/luna
…
  localhost_4200_src_examples_todomvc           desktop 0.0%   mobile 0.0%
  localhost_4200_src_examples_spa               desktop 0.0%   mobile 0.0%
  localhost_4200_src_examples_wc                desktop 0.0%   mobile 0.0%
  localhost_4200_src_examples_apg_playground    desktop 0.0%   mobile 0.0%
  localhost_4200_src_examples_browser_router    desktop 0.0%   mobile 0.0%
  localhost_4200_src_examples_css_split_test    desktop 0.0%   mobile 0.0%
  Compared: 12 | Diff > 0: 0 (0.0%)
  All snapshots match baseline
```

**Verdict**: PASS. Same deterministic result as sol.mbt — no per-page mask tweaks needed for luna's `src/examples/*` pages.

## Findings

### F-luna-1 — pkf cache-hit on second run is correct behaviour but worth documenting

```
$ pkf run dogfood-luna  # second invocation
[pkf] dogfood-luna: hit a443f71194e9
[pkf] done: 1 task · 1 hit · 0 ran · 0 uncached (1ms wall)
```

The `dogfood-luna` task has no `inputs {}` block. Pkfire caches on cmd hash + inputs; with no input deps and a deterministic cmd string, the second `pkf run` short-circuits. That's correct caching behaviour, **not** a bug — but it does mean `pkf run dogfood-luna` twice in a row will not give you a false-positive measurement. To actually re-execute, either:

- Add `inputs { "dist/luna/**" }` so the cache key picks up build changes (preferred if dogfood is meant to be re-runnable on rebuild).
- Run the underlying `node … src/cli/vrt.ts snapshot …` directly (what this report did).
- Use `pkf run dogfood-luna --force` (if pkfire supports it; not verified here).

`dogfood-sol` has the same shape — both could pick up `inputs` declarations if we want pkf to act as the snapshot re-run gate.

### F-luna-2 — `CLAUDE.md` says `npx serve … luna.mbt/dist -p 4200` but the URLs assume `dist/luna/` as root

`CLAUDE.md` § Dogfooding:

> # luna.mbt (requires: npx serve ~/ghq/.../luna.mbt/dist -p 4200)
> just dogfood-luna

But the task URLs are `http://localhost:4200/src/examples/...`, and that path only resolves if `dist/luna/` (not `dist/`) is the server root. Serving `dist/` would 404 because `dist/src/examples/...` doesn't exist — the actual layout is `dist/luna/src/examples/...`.

Recommendation: update `CLAUDE.md` to say `npx serve … luna.mbt/dist/luna -p 4200`. Same drift may exist in any other doc snippet. Minor — no code change needed beyond the doc fix.

## Stop-sign check

#18's two checkboxes:
- [x] Both `just dogfood-luna` and `just dogfood-sol` run end-to-end on current `main` (modulo `just` → `pkf` migration — both task definitions are the same shape under pkfire).
- [x] Findings appended to `docs/reports/YYYY-MM-DD-luna-sol-dogfood.md` (split into two sibling files to keep individual findings discoverable).

#18 ready to close. The two F-luna findings are minor — F-luna-1 is intended pkfire behaviour, F-luna-2 is a docs-only fix.
