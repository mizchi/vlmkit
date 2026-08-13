# agent-l adoption log (2026-08-13)

Invocation used throughout, from `/home/user/vlmkit`:
`node --experimental-strip-types src/cli/vlmkit.ts …`

## 0. Baseline
- `cd consumer && pnpm test` → `# pass 3 / # fail 0`, exit 0. That is green.
- Read the app (87 lines). Eyeball suspects first so I can tell a real find from a
  lucky guess: `.orders { width: 940px }`; greys `#9a9a9a` / `#a0a0a0` / `#8d8d8d`;
  `FIXME` in shipped copy at `index.html:16`; `/api/orders` values move every request
  (`tick++`) so no pixel baseline can be committed over this page.
- `serve.mjs` also holds `/api/stream` open forever. Flagged as a likely
  `networkidle` trap before running anything.

## 1. Survey — one gate at a time, over http://localhost:4310/
`vlmkit --help` → `vlmkit rules` (27 gates / 123 rules, grouped by "kind of question").
Good orientation; I picked candidates from the `correctness` + `behavior` groups.

| gate | exit | outcome → what I did next |
|---|---|---|
| `check integrity` | 1 | 1 fail (`page-overflow-x`, blames `table.orders`, 188px @768) + 3 `low-contrast-text` warns. Keep. |
| `check a11y contrast` | 1 | Same 3 contrast findings, but fail-level, 1 rule, no `--allow`. Redundant → dropped in favour of integrity. |
| `check copy` | 1 | `placeholder-text` on the FIXME. Keep. |
| `check breakpoints --sweep` | 0 | overflow 320–945px + at 899/900/901. Keep (localises the same defect). |
| `check interactions` | 0 | 3x `inert-control` — Export/Refund/Archive respond to nothing. Keep; real finding. |
| `check a11y focus` / `touch` / `stress i18n` | 0 | clean. Kept the two a11y ones (cheap, ~2s). |
| `scan handlers` | 0 | `registrations: 0 across 0 element(s)` → status **ok**. Zero listeners on a 3-button page is the finding, not the all-clear. Dropped. |
| `check design` | 0 | `component-drift`: primary button differs from the two secondaries. False positive by construction. Dropped. |
| `check theme` | 0 | "unthemed components: 8 of 8" — console never claimed dark mode. Dropped. |
| `check tokens` | 0 | 20 padding violations vs vlmkit's default spacing scale, which we never declared. Dropped. |
| `check layout` | 1 | `error: --contract <contract.json> is required`. Nothing to point it at. Dropped. |

## 2. HAR pinning (every gate nags about it)
`snapshot record-har … --out consumer/vlmkit/app.har` → 3 requests, then
`check integrity --har …` with **the server killed** reproduced byte-identical
findings. Works exactly as advertised, and the tool warns it is keyed on the full URL.
Decision: **not committed.** It freezes `/api/orders` to one recorded response and
goes stale silently; `webServer` gives CI the real app for the same 7s.

## 3. Making it one command
`gates init --pages <url> --gate "check integrity"` auto-added
`--wait-until load --timeout 15000` and explained why (held-open connection never
reaches networkidle) — that is the trap I predicted in step 0, handled for me. It did
**not** scaffold a `webServer` block despite the source being `http://localhost:4310/`.

Wrote `consumer/vlmkit.gates.json` by hand (webServer + 6 gates + 2 suppressions),
then `gates list` → prints each fully-composed command. That view is what caught the
`rules`-fan-out problem below. `gates run` → ALL PASS 6/6, wall 7.1s, server started
and stopped by the tool. `cwd: "."` resolves relative to the config, and running
`gates run` from `consumer/` auto-discovers `./vlmkit.gates.json`.

## 4. Things I probed on purpose
- **Typo'd rule id** → config error listing the valid ids. Good. (Reported once per
  gate in the plan, so one typo prints 6 identical lines.)
- **Expired suppression** (rolled the dates back to 2026-06-15) → exit 1, plus
  *"A failure below may be this, not a new regression."* Best message in the tool.
- **`gates suppressions --require-owner --require-expiry`** → the triage queue, with
  days-left. This is the artifact that makes the adoption reviewable.
- **`gates run --json`** → **not parseable**: the child server's own stdout
  (`orders console on http://localhost:4310/`) is printed to stdout ahead of the JSON.
  vlmkit's own `webServer:` lines correctly go to stderr; the server's do not.
- **`--output <dir>`** → per-gate `.txt` with the full output (warns included) plus
  `batch-summary.json`. This is the only place findings #3/#4 survive, so
  `pnpm verify:ui` passes it.
- **Does a new regression fail?** Copied `public/` to scratch, added a 1400px panel
  and a `TODO:`, served on 4311. With our two suppressions in force: **exit 0, "NO
  DEFECTS"**. The unscoped `page-overflow-x` allow swallows all overflow.
- **Tried to narrow it.** `@table.orders` → "matched nothing" (no `selector` in the
  JSON finding). `@768` → silenced a finding printed `@1280`; `@375` → "matched
  nothing" though the finding lists `viewports:[768,375]`. No narrower form exists.

## 5. Committed under `consumer/`
- `vlmkit.gates.json` — plan, webServer, 2 owned+expiring suppressions.
- `vlmkit-findings.md` — findings split real / tool-is-wrong, with quoted output.
- `package.json` — `verify:ui` script (+ a `//verify:ui` note).
- `.gitignore` — `.vlmkit/`, `test-results/` (both written to cwd, not config dir).
- Nothing in `public/` or `src/` touched.

## 6. Final
- `pnpm verify:ui` → ALL PASS (6/6), exit 0, ~7s.
- `pnpm test` → `# pass 3 / # fail 0`, exit 0. Same as baseline.
