# vlmkit adoption — what it found in the orders console

Evaluated 2026-08-13 against `public/index.html` served by `serve.mjs` on port 4310.
Config: `vlmkit.gates.json`. Run it with `pnpm verify:ui`.

Nothing in `public/` or `src/` was changed. Every finding below is a triage item, not
a fix.

---

## Real problems in our console

| # | Finding | Where | Gate | Status in CI |
|---|---|---|---|---|
| 1 | **The orders table overflows the viewport at every width below ~964px.** `table.orders` is `width: 940px`; at a 768px viewport the page scrolls horizontally by 188px, and by 636px at the 320px end of the sweep. The `@media (max-width: 900px)` rule shrinks `main`'s padding from 24px to 16px, which buys back 8px of a 188px problem. | `public/app.css:7` | `check integrity` / `page-overflow-x`; `check breakpoints --sweep` / `sweep-overflow` | **suppressed**, `expires 2026-10-15`, ticket ORD-1481. Suppressed only so the rest of the plan can gate; see the caveat in the config. |
| 2 | **A `FIXME` is shipped to users.** Rendered page text contains `Totals exclude tax. FIXME confirm rounding with finance.` | `public/index.html:16` | `check copy` / `placeholder-text` | **rule off**, `expires 2026-10-15`, ticket ORD-1482. Re-enable the rule in the PR that deletes the FIXME. |
| 3 | **Three text colours fail WCAG AA on white.** `p.who` `#9a9a9a` = 2.81:1; `p.hint` `#a0a0a0` = 2.61:1; `td.state` `#8d8d8d` = 3.32:1. All are 13px body text, floor is 4.5:1. (`th` `#767676` = 4.54:1 passes, barely.) | `public/app.css:5,10,11` | `check integrity` / `low-contrast-text` | **visible, non-blocking.** warn by default, so CI prints it and exits 0. Not suppressed — we want it in the log every run. |
| 4 | **All three footer buttons are inert.** `#export`, `#refund`, `#archive` are focusable and respond to Enter with no ARIA change and no layout change. `index.html` registers no listener for any of them. A "Refund" button that silently does nothing is the worst version of this. | `public/index.html:19-21` | `check interactions` / `inert-control` | **visible, non-blocking** (warn). |

### Not blocking CI, worth knowing
- `check breakpoints --sweep` localises #1 precisely: overflow across the whole
  `320-945px` range, i.e. a regime that testing only at declared breakpoints
  (900 ± 1) would still have caught here, but only by luck.
- `check a11y focus` (3 focus steps), `check a11y touch` (3 targets, all ≥44px) and
  `stress i18n` (text inflated 1.4x) are clean. The 44px `min-height` on `.btn` is
  doing its job.

---

## The tool being wrong or unhelpful here

**`check design` — flags our primary button as design-system drift.** Excluded from
the plan. Its output:

> `[component-drift] button: 3 "button" elements render 2 distinct styles (used 2x, 1x;
> a system reuses each style 3x or more, and this role averages 1.5x). Dominant style,
> used 2x: … Deviating: button#export … differs in background-color rgb(255,255,255) →
> rgb(31,111,235).`

`#export` is the primary action and is *supposed* to look different from Refund and
Archive. The gate is measuring "instances per distinct style" as an average, so any
page with one primary and two secondary buttons is mathematically drift. It says
"This reports inconsistency, not which style is correct" — true, but on a 3-button
page there is no reading of it that is actionable. Revisit if we ever have a real
component library to conform to.

**`check theme` — 8 of 8 "unthemed components".** Excluded. Output:

> `! theme pixel delta: 0.1% (page barely responds to color scheme)` /
> `✗ unthemed components: 8 of 8`

The console has never claimed dark-mode support and has no `prefers-color-scheme`
rule. This is a feature request rendered as a defect. Three of the eight "components"
it lists are 1px table borders (`0,66 1280×1 fill #e4e4e4`).

**`check tokens` — 20 padding violations against a scale we never declared.**
Excluded. It defaults to `0,2,4,8,12,16,20,24,…` and our `10px`/`18px` paddings are
off it. Technically correct, zero information: we have no token scale, so the gate is
comparing us to vlmkit's opinion. Would become useful the day we declare one via
`--config`.

**`check a11y contrast` — same three findings as #3, but exit 1 and no way to scope
it.** Excluded in favour of `check integrity`, which reports identical measurements
at warn. The gate has exactly one rule (`contrast-below-aa`) and no `--allow`, so the
only options are "red CI on day one" or "contrast checking entirely off". Reporting
the same defect through `check integrity` gets us the finding *and* a green build.

**`scan handlers` — reports `registrations: 0 across 0 element(s)` and status `ok`.**
Excluded. On a page with three buttons and zero event listeners, "0 registrations"
is the finding, not the all-clear. `check interactions` catches the same thing
properly (#4).

**`check layout`** needs `--contract <contract.json>`; there is nothing to point it at.

**`--allow` cannot scope a `page-overflow-x` exemption, and its `@<viewport>` scope
silences the wrong viewport.** This is the one item on this page that costs us
coverage, so it is worth spelling out.

The finding names the culprit in prose — *"caused by: table.orders (extends to
x=956px…)"* — and the docs say to copy the selector as printed. But:

```
$ … check integrity <url> --allow "page-overflow-x@table.orders;ORD-1481"
1 --allow rule(s) matched nothing
  - page-overflow-x@table.orders;ORD-1481
```

In `--json` the finding has no `selector` field at all, so no selector can ever match.
Scoping by viewport instead is worse than useless — a `@768` exemption silenced a
finding the same run printed at `@1280`:

```
$ … check integrity <page with a NEW 1400px panel> --allow "page-overflow-x@768;ORD-1481"
verdict: NO DEFECTS, 3 WARN (0 fail, 3 warn, 1 exempted)
  - [page-overflow-x]  @1280: user exemption (page-overflow-x@768): ORD-1481
EXIT=0
```

…and `--allow "page-overflow-x@375;…"` reported "matched nothing" even though the
original finding covers `viewports: [768, 375]`.

**Consequence for us:** the unscoped exemption in `vlmkit.gates.json` is the only form
that works, and it means **CI is currently blind to all new horizontal overflow on
this page.** Verified: adding a 1400px-wide panel to `index.html` still exits 0.
`check breakpoints --sweep` keeps printing overflow at warn, so it lands in the
artifact, but it does not fail the build. This is the argument for fixing ORD-1481
early rather than sitting on the suppression.

---

## Why the config looks the way it does

- **`--wait-until load --timeout 15000` on every navigating gate is load-bearing.**
  `serve.mjs` holds `/api/stream` open forever, so the gates' default `networkidle`
  milestone can never fire. `vlmkit gates init` adds these flags itself when the
  source is a URL and explains why — believe it.
- **`webServer` in the config replaces a shell wrapper.** It starts `node serve.mjs
  4310`, polls the URL until it answers, and stops it afterwards, so CI needs no
  start/trap-kill/poll script. Port 4310 appears twice (webServer + page source) and
  must match.
- **No committed HAR.** `vlmkit snapshot record-har` works and `--har` replays it with
  the server completely down (verified — identical findings, no server), but it is
  keyed on the full URL including port and pins `/api/orders` to one recorded
  response. That is a fixture that goes stale silently. If we later want gate runs
  that don't boot a server, this is the switch to reach for.
- **Suppressions are the triage queue.** `pnpm verify:ui` is not the whole contract:

  ```
  node --experimental-strip-types ../../../src/cli/vlmkit.ts gates suppressions \
    --require-owner --require-expiry
  ```

  lists every accepted finding with owner and days-left, and an expired entry fails
  `gates run` even when the page passes.
- **`gates run` prints `ALL PASS` and shows none of the 10 warn-level findings.**
  That is why `pnpm verify:ui` passes `--output test-results/vlmkit`: findings #3 and
  #4 only exist in those per-gate `.txt` files. **CI must upload that directory as an
  artifact or the warnings are invisible.**
