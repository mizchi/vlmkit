# Visual / a11y gate for the orders console

## The one command

```bash
pnpm vrt          # CI gate. Exits non-zero while any finding below is untriaged.
pnpm vrt:advisory # same run, always exit 0 — use while the list below is being worked through
pnpm vrt:record   # re-record vrt/orders.har (only when the page calls a new endpoint)
```

`pnpm vrt` runs `vlmkit gates run` against `vlmkit.gates.json` (8 gates, ~8s wall).

**It needs no dev server and no free port.** Every gate replays
`vrt/orders.har`, which is a committed recording of `/`, `app.css` and
`/api/orders`. That is load-bearing for two reasons:

1. `serve.mjs` answers `/api/orders` with values that move on every request
   (`A-1000`, `$121.00`, then `A-1001`, `$122.00`, …). Without the HAR the gate
   measures different text on every run. vlmkit says so itself on every unpinned
   run: *"http://localhost:4321/ is live and not pinned — a re-run may measure
   different data."*
2. `serve.mjs` holds `/api/stream` open forever, so Playwright's default
   `networkidle` milestone never fires. Hence `--wait-until load --timeout 15000`
   on every gate line — `vlmkit gates init` added those flags itself and
   explained why.

The `source` in `vlmkit.gates.json` is still `http://localhost:4321/` because
that string is the HAR's lookup key, not a host anyone connects to. If the port
inside `vrt/orders.har` ever changes, that string has to change with it.

## Findings — real problems in our console

Four defects, all pre-existing. Nothing in `public/` was changed to make a gate pass.

| # | What | Where | Reported by |
|---|------|-------|-------------|
| 1 | `.orders` is `width: 940px` (fixed), so the page scrolls horizontally by **188px at 768px** and by 57/56/63px right at the 900px breakpoint. The `@media (max-width: 900px)` rule only shrinks `main`'s padding; it never touches the table. | `public/app.css:7` | `check integrity` (**fail**, `page-overflow-x`), `check breakpoints` (3 warns) |
| 2 | Three greys fail WCAG AA at 13px: `.who` `#9a9a9a` = **2.81:1**, `.state` `#8d8d8d` = **3.32:1**, `.hint` `#a0a0a0` = **2.61:1**. Need 4.5:1. | `public/app.css:5,10,11` | `check a11y contrast` (**fail**), `check integrity` (5 warns) |
| 3 | A developer note is shipped to users: *"Totals exclude tax. **FIXME confirm rounding with finance**."* | `public/index.html:16` | `check copy` (**fail**, `placeholder-text`) |
| 4 | All three footer buttons — Export CSV, Refund, Archive — are inert. There is no click or key handler anywhere in `index.html`; the only script fetches the order list. | `public/index.html:19-21` | `check interactions` (3 warns, `inert-control`) |

Only #1–#3 fail the build today. #4 is `warn` by default so `pnpm vrt` exits 0
on it; raise it with `"check.interactions/inert-control": "suspect"` once the
handlers land, so it can never silently regress.

## Findings — the tool being wrong or unhelpful

- **`check design` / `component-drift`: not a defect.** It reports that our 3
  buttons render 2 distinct styles and that "a system reuses each style 3x or
  more". We have one primary action and two secondary ones; that *is* the
  design. A 3-button footer can never satisfy a 3x-reuse floor, and the
  documented lever (`--min-reuse 2`) does not silence it either — measured
  average reuse is 1.5. Demoted to `info` in `vlmkit.gates.json` rather than
  `off`, so it comes back if the footer grows and genuinely fragments.
- **The same contrast defect is reported 8 times.** `check integrity` emits one
  `low-contrast-text` warn per table row (`#rows > tr:nth-of-type(1) > td:nth-of-type(4)`,
  `…(2)…`, `…(3)…`) plus `.who` and `.hint` = 5; `check a11y contrast` collapses
  the rows correctly and emits 3. Three CSS colours, eight lines. Only one gate
  should own contrast.
- **`gates run`'s summary contradicts its own data.** It prints
  `verdict: 2 FAILED, 1 DID NOT RUN (5 passed)` and annotates
  `check a11y contrast` with `did not run: vlmkit check a11y contrast` — while
  `vrt/results/check-a11y-contrast-….txt` contains a complete measurement
  ("inspected 9 text-bearing element(s), ✗ 3 contrast failure(s)") and
  `vrt/results/batch-summary.json` says `"passed": 5, "failed": 3`. **Do not
  trust the "DID NOT RUN" count**; read `batch-summary.json` or the per-gate
  logs. Reproduces on every run.
- **The re-tuned rule is broadcast to every gate.** `gates list` shows
  `--rule check.design/component-drift=info` appended to all 8 commands,
  including the 7 that do not declare that rule. Harmless, but it makes every
  logged command line 45 characters longer and the log filenames collide on the
  first 80 chars.
