# Dogfood scenario: ops dashboard (2026-08-11)

**Agents must not read this file.** It is the answer key. `brief.md` is what they get.

## Why this scenario exists

The animation scenario (`fixtures/dogfood-animation-2026-08-10/`) ran four rounds and
its wrong-measurement count reached zero, but every finding in v4 came from the same
four gates on the same page — so it had stopped producing new *kinds* of defect.

More pointedly: **the four features that closed #112 shipped without any agent ever
touching them.** They were designed from a written adoption report, which is a good
source but not the same as watching someone try to use them. This scenario exists to
put all four in front of an agent that has never been told they exist:

| #112 item | What forces it here |
|---|---|
| 1. `--timeout` / `--wait-until` / `--har` | `/api/live` is an `EventSource` the server never closes, so `networkidle` never fires and every URL gate dies at 30s having reported nothing |
| 2. optional-peer Playwright | not exercised by this scenario (it is an install-time property; `package-install-smoke` covers it) |
| 3. `seed.spec.template.ts` | not exercised (install-time) |
| 4. `check design --exclude` | `.vendorchart-ctrl-group` holds 3 icon-only buttons that become the *dominant* button style, so the page's own buttons are reported as the deviants |

It also drags in four gates the animation scenario never touched: `check copy`,
`check breakpoints`, `check a11y contrast` (via `check integrity`), and `check design`.

## Declared defects

All in `page/theme.css` or the markup's own text. Nothing is annotated as wrong.

| # | Defect | Where | Gate that should catch it |
|---|---|---|---|
| D1 | `.status` is `#a8a8a8` on white — 2.38:1, below the 3:1 floor even for large text | `theme.css` `.status` | `check integrity` → `low-contrast-text` (warn ×3) |
| D2 | `.grid` is `repeat(3, 240px)` = 768px of track in a 720px content box; the `@media (max-width: 767px)` collapse is off by one, so 768px exactly is broken | `theme.css` `.grid` + media query | `check integrity` → `page-overflow-x` (24px, **fail**); `check breakpoints` → `overflow-at-boundary` (warn) |
| D3 | `TODO: confirm the denominator with the platform team` shipped in the UI | `index.html` third panel | `check copy` → `placeholder-text` (**fail**) |
| D4 | Vendor control buttons (24×24, no padding, no radius, no painted text) outnumber the page's own buttons 3:3 and win the "dominant style" vote | `index.html` `.vendorchart-ctrl-group` | `check design` → `component-drift`, unfixable without `--exclude` |

The brief's item 4 supplies the real copy for D3 ("successful requests, not total
requests") so the agent does not have to invent product facts.

## Success criteria

Every command must run against the **served URL**, not a saved static copy — the
brief says so explicitly, and a static copy is how the previous adoption report
worked around item 1 rather than using the fix.

1. `check integrity <url>` exits 0
2. `check copy <url>` exits 0
3. `check breakpoints <url> --rule overflow-at-boundary=suspect` exits 0
4. `check design <url>` judges only the page's own components, and the agent states
   what the role-reuse number says about them

(4) is deliberately not exit-code gated. `component-drift` is `warn`, so the gate
exits 0 even while the metric is meaningless — which is the complaint in brief item 5
and in #112 item 4, stated as the report's author stated it.

## Known scenario limits

- After `--exclude`, the page's own 3 buttons are 1 primary + 2 secondary, and 3
  instances cannot reuse a style 3× unless all three are identical. So
  `component-drift` still fires on a legitimate primary/secondary variant, and
  `check design` has no `--allow`. **This is a real gap** — `check integrity` and
  `check drift component` both have one — and it is the most likely thing this round
  will surface. It is why (4) is not exit-code gated: gating it would repeat the
  animation scenario's v2 flaw, where the success criterion and the brief could not
  both hold.
- `check a11y touch --level AA` reports 0 undersized: the vendor buttons are exactly
  24×24 and the page's own are 44px. Not part of the criteria.

## Verified before the round (2026-08-11, on `main` at 0f67c6a)

```
check integrity <url>                       → error: page load timed out (30000ms), 47s wall
check integrity <url> --wait-until domcontentloaded
                                            → DEFECTS (1 fail, 3 warn): page-overflow-x 24px @768,375
                                              + low-contrast-text ×3 at 2.38:1
check copy <url> --wait-until dcl           → suspect: placeholder-text "TODO"
check breakpoints <url> --wait-until dcl    → warn: overflow-at-boundary, 767px checked, overflow 0/0/24px
check design <url> --wait-until dcl         → DRIFT, exit 0; dominant style is the vendor's
                                              (3×, "no painted text"), our buttons are the deviants
check design <url> --exclude ".vendorchart-ctrl-group" --rule component-drift=suspect
                                            → exit 1, "1 root match(es), 11 element(s) removed"
```

## Attempts

`attempts/agent-<letter>/` — one directory per agent, each a full copy of `page/`.
