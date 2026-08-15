# Dogfood: Moonlight SVG Editor — pointer-driven drag

Date: 2026-08-15
Target: <https://moonlight.mizchi.workers.dev/> (a client-rendered SVG editor)
Ask: improve vlmkit against this app, drag and drop included.

## The browser cannot reach the live URL from this sandbox

Measured before anything else, because it decides the method:

| Client | Target | Result |
|---|---|---|
| `curl` | `https://moonlight.mizchi.workers.dev/` | 200, 397 bytes |
| `curl` | `/assets/main-eBVkwLvr.js` | 200, 207,648 bytes |
| Chromium (no proxy) | the site | `ERR_CONNECTION_RESET` |
| Chromium (`proxy: HTTPS_PROXY`) | the site | `ERR_CONNECTION_RESET` |
| Chromium (`--proxy-server=…`, `--no-sandbox`) | the site | `ERR_CONNECTION_RESET` |
| Chromium (all three configs) | `https://example.com/` | `ERR_CONNECTION_RESET` |

The control on `example.com` is the point: **Chromium has no outbound network here at all**,
independent of the site and of proxy configuration. The agent proxy logged
`recentRelayFailures: []` throughout — the browser's requests never arrived. Every gate worth
running needs a browser, so the live URL is not directly testable from this environment.

**Method used instead: a local mirror.** `curl` works, so the shell and both JS assets were
fetched and served from `127.0.0.1` (in `no_proxy`, and reachable by the browser). The mirror
is faithful rather than a stand-in: the bundle contains no `fetch` of any API, no additional
chunks, and one external reference (a github.com link). Loaded locally it renders the real
editor — 214 elements, 18 `<svg>`, 18 buttons, the tool palette, `Elements (11)`.

Anyone with network access should re-run these commands against the live URL; nothing here
depends on the mirror except the ability to open a browser.

## Finding 1 — this app's drag is pointer-driven, and vlmkit gave it the wrong remedy

`[draggable]` count on the page: **0**. The editor registers no `dragstart` anywhere, so the
HTML5 drag-and-drop rules added earlier today find nothing. Its canvas drags with pointer
events:

```
div#app>div>div>svg: pointerdown, pointermove, pointerup, pointerleave, contextmenu, wheel
```

What `scan handlers` said about it:

```
suspect [pointer-only-control] div#app>div>div>svg … has a pointerdown/pointerup handler but
no role, no keyboard handler, and no interactive descendant … Give it a role + tabindex + key
handling, or move the handler onto a real control.
```

The finding is true and **the advice is wrong**. `tabindex` and a key handler do not make a
drawing canvas draggable, any more than they start an HTML5 drag. This is exactly the
situation `drag-without-keyboard-alternative` was written for — *provide another route to the
same result* — and that rule could not see it, because it only looked for `dragstart`.

**Fix.** `down + move on the same element` now classifies a pointer-drag surface
(`pointerdown`/`mousedown`/`touchstart` with `pointermove`/`mousemove`/`touchmove`), the
keyboard-alternative rule covers both drag families with wording per family, and
`pointer-only-control` steps aside for a drag surface so the two contradictory remedies never
appear together. After:

```
warn [drag-without-keyboard-alternative] div#app>div>div>svg … is operated by dragging
(pointer drag) with no keyboard handler … Provide a non-drag path to the same result — arrow-key
nudging, numeric position/size fields, or a menu action for the same edit — rather than tabindex
and a key handler, which cannot perform a drag.
```

The two accordion headers on the same page (`Canvas Settings▶`, `Elements (11)▼`) are
click-only and keep their `pointer-only-control` finding, which is the control for the change.

**Deliberate limits, both measured:**

- The signature requires `move` on the *same element*. The common alternative — `pointerdown`
  on the element, `pointermove`/`pointerup` on `window` — is not matched. Pairing an element's
  `down` with a *global* `move` would call every `pointerdown` on a page with a cursor-follow
  effect a drag, and a wrong "this is a drag" claim misroutes the fix in the other direction.
- `setPointerCapture` in the handler source would be the unambiguous marker. The surface caps
  samples at 80 characters and real apps ship minified: checked on this editor's three
  captured snippets, it is not visible.
- **Severity change:** this canvas moves from `suspect` to `warn`. Same reasoning as the HTML5
  case — the alternative route is often elsewhere on the page, which an element-local view
  cannot see. A page that failed CI on `pointer-only-control` for a drag surface now warns.

## Follow-up — the canvas drag is now driven, not just classified

`pointerdown`/`pointermove`/`pointerup` were sitting in `unprobed-handler-types`: "NOT covered
by the interaction probes". Unlike HTML5 drag, a pointer drag *is* drivable — `mouse.down` /
`mouse.move` / `mouse.up` is the same input a user produces — so `--probe-drag` now performs
the gesture on each pointer-drag surface and measures the element's own pixels either side.

On this editor's canvas:

```
Pointer-drag gesture (real mouse input):
  - div#app>div>div>svg: feedback while held 8.14%, changed after release 8.53%
```

and `unprobed-handler-types` dropped from 8 types to 5, because three of them were exercised.
That warn had been making a claim that was no longer true.

**Pixels rather than the DOM**, and the reason is in `fixtures/handlers/pointer-drag.html`:

| pad | feedback while held | changed after release |
|---|---|---|
| `#works` | ~3% | ~3% |
| `#feedback-only` | ~3% | 0.00% |
| `#dead` | 0.00% | 0.00% |
| `#canvas-works` | ~1% | ~2% |

`#canvas-works` draws on a `<canvas>`: its DOM never changes at all, so a DOM comparison
would call every canvas editor dead. The separation between 0.00% and ~1% is wide.

**Reported, not graded — deliberately.** A 0% row is ambiguous on a real page: dead handlers,
a gesture that began somewhere ungrabbable, and feedback painted outside the element's box are
indistinguishable from here. Turning it into a finding would report a state this has not
established, so `#dead` yields evidence rather than a verdict.

### The one graded outcome: `pointer-drag-intercepted`

Wrapping the page's own listeners answers what pixels cannot — did they run at all? Two pads
with identical registrations look the same in pixels and are different defects:

| pad | pixels | own-listener invocations |
|---|---|---|
| `#dead` | 0.00% / 0.00% | the full trio — reachable, and inert |
| `#swallowed` | 0.00% / 0.00% | **0** — a transparent sibling takes every event |

"Registered, gesture delivered over the box, nothing invoked" has one explanation: something
is between the pointer and the listener — an overlay or backdrop, `pointer-events` on an
ancestor, a listener on a detached node. So that is a suspect, and `#dead` stays evidence.

Making it safe was most of the work, and two things were measured rather than reasoned:

- **A wrapper breaks `removeEventListener` by reference**, so every add-then-remove would leak
  a live listener and the tool would alter the page it measures. A WeakMap from the page's
  listener to its wrapper fixes it. A test runs a fixture with and without the patch and
  requires the page's own log to be identical — covering removal by reference, `{ once: true }`
  across two clicks, an object listener with `handleEvent`, `this` in a function listener, the
  same function in both phases with only the capture one removed, and a throwing listener that
  must not stop the rest. Removing the `removeEventListener` half makes it report
  `+ "REMOVED-FIRED"`.
- **Install order decides whether the handler snippets are real.** The counting patch has to go
  on *before* `HANDLER_PATCH_SCRIPT`; the other order makes the registration recorder capture
  `"function () { bump(this); return invoke.apply(…"` — the wrapper's own source — for every
  listener on the page. Both orders were run and diffed.

On this editor's canvas the count is nonzero and no `pointer-drag-intercepted` is reported,
which is the control: the canvas is reachable, and its finding remains the keyboard one.

## Finding 2 — eight findings that could not say which element they were about

Eight rows of the surface read:

```
- div>div>div>button "": click, mouseenter, mouseleave
```

One per toolbar icon. Both of the gate's identity signals were blank at the same time: the
text is empty (icon-only buttons), and these elements carry no `id` and no `class`, so
`describe()` produced the same path for all of them. The information a human uses to tell
them apart was on the elements the whole time — `aria-label`: `Zoom Out`, `Zoom In`,
`Fit to Canvas`, `Download SVG (Ctrl+S)`, `Copy SVG (Ctrl+Shift+C)`,
`Import SVG (Ctrl+Shift+V)`, `View on GitHub`.

`text` now falls back to the accessible name — `aria-label`, `title`, a child `img[alt]`,
then `placeholder`/`value` — and every row names itself. This travels into findings too,
which quote `"${e.text}"`.

For the record: the app has **no** unnamed buttons (18 of 18 have `aria-label` or `title`).
The empty labels were vlmkit reading the wrong attribute, not a defect in the page.

## What the app itself reported (unmodified gates)

Not vlmkit defects — recorded because they are what the tool is for.

| Gate | Verdict |
|---|---|
| `check integrity` | `DEFECTS` — 2 fail, 1 warn |
| `scan scroll` | `suspect` — `page-overflow-x` |
| `check interactions` | `ok`, 11 warns |
| `scan handlers` | 2 suspect (the accordion headers), 1 warn (the canvas) |

- **`page-overflow-x` 8px at every viewport.** `#app > div:nth-of-type(1)` starts at x=8 and
  is 1280px wide, so it ends at 1288 in a 1280 viewport.
- **`occluded-text` at 375px.** The `78%` zoom readout is completely covered — 100% of
  sampled glyph points hit the occluder.
- **`low-contrast-text`.** `No elements` renders `#999` on white at 2.85:1, under the 4.5:1
  AA floor for 11px text.

## Reproducing

```bash
mkdir -p /tmp/moonlight/assets && cd /tmp/moonlight
curl -sS https://moonlight.mizchi.workers.dev/ -o index.html
curl -sS https://moonlight.mizchi.workers.dev/assets/main-eBVkwLvr.js -o assets/main-eBVkwLvr.js
curl -sS https://moonlight.mizchi.workers.dev/assets/modulepreload-polyfill-EeOZK34R.js \
  -o assets/modulepreload-polyfill-EeOZK34R.js
python3 -m http.server 4930 &

vlmkit scan handlers      http://127.0.0.1:4930/ --probe-drag
vlmkit check integrity    http://127.0.0.1:4930/
vlmkit check interactions http://127.0.0.1:4930/ --handlers
```

The asset filenames are content-hashed and will change with the next deploy; read them out of
`index.html` rather than copying them from here.
