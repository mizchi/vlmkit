# Six common UIs written from scratch in MoonBit with mizchi/luna, judged with vlmkit

**Date**: 2026-11-14 · **Sites**: `examples/sites/{chat,search,video,maps,code,wiki}/` · **Briefs**:
`examples/sites/briefs/` · **Guide**: `examples/sites/LUNA.md`

## Question

Can an agent build the UI of a familiar product from nothing, close enough to the real pattern
that a visitor recognises it, and with its interactions working, using vlmkit to judge it?
The constraint: the UI is written in MoonBit with [`mizchi/luna`](https://github.com/mizchi/luna.mbt)
instead of hand-written HTML and JS.

## Setup

- **Six patterns, under fictional brands.** These are demo pages published on Pages, so they copy
  no real logo, name or text:

  | Pattern | Site |
  |---|---|
  | An assistant chat | Parley |
  | A search engine | Findwell |
  | A video site | Reelhouse |
  | A map | Wayfarer Maps |
  | A code host | Forgeyard |
  | An encyclopedia | Lexipedia |

- **Reference study first.** The real sites were opened in headless Chromium through the
  session's proxy, with TLS verified against its CA. Their screenshots were taken at 1280×800 and
  390×844, together with interaction states: typing, a menu open, search results, the mobile view.
  The measurements went into each brief's "Reference study". The screenshots stayed in the
  scratchpad, outside the repository.
  - Not reachable: the assistant apps, behind a bot challenge (HTTP 403), and the search results and
    video watch pages, behind a captcha. Their briefs describe the pattern instead. Nothing was done
    to get past a wall.
- **One agent per site, in parallel.** Each agent got `PROTOCOL.md` (the judged demo-site protocol),
  `LUNA.md` and its brief. Every gate run and screenshot went through `judge.mjs`, as for the
  earlier demo sites.
- **The luna build.** Each site keeps a MoonBit module in `src/`. `luna-build.mjs` builds it into
  the one committed classic script (`app.js`, iife), and `--check` says when that script is stale.
  The page needs no build step to be served or judged.

## Result

All six logs are closed (`check` passes, `done` rendered), and every `app.js` is up to date with
its source.

| Site | Rounds | Gate runs | Looks written | Defects | by eye | by a gate | `app.js` |
|---|---:|---:|---:|---:|---:|---:|---:|
| chat (Parley) | 4 | 84 | 64 | 17 | 11 | 6 | 373 KB |
| search (Findwell) | 3 | 71 | 55 | 21 | 13 | 8 | 545 KB |
| video (Reelhouse) | 3 | 114 | 63 | 34 | 19 | 15 | 537 KB |
| maps (Wayfarer Maps) | 3 | 95 | 77 | 29 | 19 | 10 | 616 KB |
| code (Forgeyard) | 3 | 106 | 47 | 26 | 14 | 12 | 442 KB |
| wiki (Lexipedia) | 3 | 64 | 48 | 29 | 17 | 12 | 360 KB |
| **total** | | **534** | **354** | **156** | **93** | **63** | |

As with the first eight logs (135 of 179), most defects were found by looking: 93 of 156 (60%).
What the gates found was what a look at one state misses:

- a reply's caret that never went away (`verify flow`);
- a header that overflows only between 1012 and 1045px (`check breakpoints --sweep`);
- pins covered by the floating UI at their centre (`check grounding`);
- a Play button that toggled playback straight back (`inspect motion` showed the controls never
  changing);
- borders at 1.4–1.6:1 (`check a11y contrast`, `check color`).

## What luna got in the way of (upstream findings)

Each of these was measured by at least one agent:

1. **`class=` and `dyn_class=` on SVG elements are dropped without a word.** Six sites of six
   hit it. Every icon rendered at its default size, or black.
   - `apply_static_attr` sends `class` to `elem.setClassName`. On SVG `className` is a read-only
     `SVGAnimatedString`: the write is ignored in sloppy mode and throws in strict mode.
   - Every site worked around it with `setAttribute("class", …)` from a `ref_` callback.
   - This is the one finding worth fixing in luna first.
2. **A dynamic attribute cannot be removed** (5 sites). `attr_dynamic` always calls
   `setAttribute`, and only `disabled` is special-cased. So `hidden`, `aria-current` and
   `aria-activedescendant` cannot be taken away, and a boolean attribute set to "false" still
   applies.
3. **`show()` unmounts what it hides.** An `aria-controls` then points at nothing (search).
4. **`for_each` keeps rows by reference and renders them untracked.** Indexes go stale while the
   list changes (search, via `verify flow`). A row's state read outside a closure is frozen at its
   first render (chat's caret). Nesting a reactive `for_each` inside a keyed block left duplicate
   rows (code).
5. **Missing element builders**: `table`, `tr`, `th`, `td`, `thead`, `caption`, `colgroup`,
   `dialog`, `sup`, `b`, `i`, `kbd`, `mark` and `cite`. Every site built these with
   `create_element`.
6. **`luna_components` returns `@core.Node`, not the client DOM's `DomNode`**, so its APG
   components do not compose with the `@element` DSL. Every site wrote its combobox, menus and
   dialogs by hand.
7. **Bundle size**: 360–616 KB of unminified `app.js` per site, with the luna runtime included.
   That is fine for a demo, heavy for a product.

Everything else luna left to the page was a one-line `extern "js"`: timers,
`requestAnimationFrame`, `matchMedia`, history, the clipboard, `showModal`, pointer capture,
fullscreen and storage. No site needed an inline `<script>`. `LUNA.md` now lists these pitfalls.

## What vlmkit got in the way of (findings about the tool)

From the agents' `note --kind tool` entries, verbatim where it matters. These are the follow-ups.

| # | Gate | What happened | Site |
|---|---|---|---|
| 1 | `inspect motion` | `--selector .caret --click .suggestion`, where `.caret` exists only after the click, crashed with a stack trace: `Error: without Jev every target needs the page's measurement: .caret`. It should be a usage error. | chat |
| 2 | `check color` / `check interactions` | False positives on a borderless field inside a bordered wrapper. `control-boundary-invisible` and `no-focus-indicator` judge the `<input>` alone, not the pill that draws its border and focus ring. | search, chat, maps |
| 3 | `check interactions` | `popup-no-focus-move` on an APG combobox. The pattern keeps focus in the input and moves `aria-activedescendant`. | search, maps, video |
| 4 | `check interactions` | The element cap (30) and the Tab walk (about 110 stops) cut a probe off. The cap is printed, but the walk's limit reads as "unreachable". | maps, wiki |
| 5 | `check interactions` | On `#/…` URLs, state carries from one probe to the next. A fragment-only navigation does not reload, so working menus read as `dead-disclosure`. | code, wiki |
| 6 | `verify flow` | No retry on assertions: a view rendered on `hashchange` failed until `wait` steps were added. There is also no "back" action. | code, search |
| 7 | `stress media` | It cannot read a stylesheet linked from a `file:` page: "no `@media print` rule". The same cross-origin issue `check auto` already reads around. | wiki |
| 8 | `check integrity` | `text-collision` on a paragraph that wraps around a float. It compares the paragraph's box, not its line boxes. | wiki |
| 9 | `check a11y contrast` | SVG `<text>` inside an `aria-hidden` layer (map labels) is never measured. The agent measured it by hand and found two labels under 4.5:1. | maps |
| 10 | `scan handlers --probe wheel`, `shot` | The wheel probe measures scrolling only, and `shot` has no wheel or drag action, so a map that zooms on the wheel needed a scratch Playwright script. | maps |
| 11 | `stress data` | `page-overflow-x` names an element inside a horizontal scroller rather than the cause. Decorative initials and `aria-hidden` SVG glyphs are treated as name slots. | code, video |
| 12 | `check copy` | Copy that exists only in a state (Subscribed, Starred, Stop generating) cannot be checked. The agents split their manifests per page and covered those lines with `verify flow`. | video, code, chat |
| 13 | `judge.mjs` | A defect's `--from` cannot be corrected after it is recorded. `shot --hover` times out on a `pointer-events: none` target. | code, video |

## Reproduce

```bash
export PATH="$HOME/.moon/bin:$PATH"
for s in chat search video maps code wiki; do node examples/sites/luna-build.mjs $s --check; done
pnpm exec vp test run examples/sites/sites.test.mjs tests/pages-site.test.mjs
node examples/vlmkit-intro-page/server.mjs   # then http://127.0.0.1:4190/sites/
```
