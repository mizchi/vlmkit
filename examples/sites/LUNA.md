# Writing a demo site in MoonBit with mizchi/luna

Some briefs ask for the page to be written in [MoonBit](https://www.moonbitlang.com/) with
[`mizchi/luna`](https://github.com/mizchi/luna.mbt), a fine-grained reactive UI library. This file is
what such a site needs on top of [`PROTOCOL.md`](./PROTOCOL.md). Everything in PROTOCOL.md still
holds: static files, no network, fictional brands, the judge, the log.

## What is committed, and what is served

```
examples/sites/<name>/
  index.html     the page: landmarks, the <style>/<link> it needs, <div id="app">, <script src="app.js">
  styles.css     plain CSS (luna renders DOM; style it as usual)
  app.js         BUILT from src/ — committed, never edited by hand
  src/
    moon.mod     the MoonBit module (copy the template below)
    main/
      moon.pkg   the executable package, linked as an iife (a classic script works from file://)
      *.mbt      your code
```

`app.js` is the artifact. The page needs no build step to be served or judged. Only the build
script writes `app.js`:

```sh
export PATH="$HOME/.moon/bin:$PATH"
node examples/sites/luna-build.mjs <name>            # src/ -> app.js, then re-run your gates and shots
node examples/sites/luna-build.mjs <name> --check    # exit 1 when app.js is stale
```

Build after every source change, before any gate or shot, or you judge the previous build. Run
`moon` only through this script or inside `src/` (`moon check --target js` is fast for type errors).
`src/_build/` is ignored by git. Running `luna-build.mjs` is the one exception to PROTOCOL.md's
rule against running builds. Everything else in that rule still stands: no `pnpm install` and no
`pnpm build`.

Put the data the page shows (seed records, text) in MoonBit as well. A little hand-written inline
`<script>` is acceptable only for something luna cannot do; say why in a `note --kind decision`.
Prefer luna.

## Template

`src/moon.mod`:

```
name = "vlmkit-sites/<name>"

version = "0.1.0"

import {
  "mizchi/luna@0.25.2",
  "mizchi/js_browser@0.13.0",
  "mizchi/js_core@0.13.0",
  "mizchi/signals@0.6.6",
}

preferred_target = "js"
```

Add `"mizchi/luna_components@0.23.4"` if you use its WAI-ARIA APG components (dialog, combobox,
tabs, menu button, listbox, disclosure, slider, …). Read their `.mbti` before using them.

`src/main/moon.pkg`:

```
import {
  "mizchi/luna/dom" @element,
  "mizchi/luna/js/resource",
  "mizchi/js_browser/dom",
  "mizchi/js_core" @js,
}

supported_targets = "js"

pkgtype(kind: "executable")

options(
  link: { "js": { "format": "iife" } },
)
```

`src/main/main.mbt`. This was compiled and run in Chromium from `file://` before this file was
written: the filter, toggle, list and count all update.

```moonbit
///|
struct Item {
  id : Int
  title : String
}

///|
fn input_value(e : @js.Any) -> String {
  let target : @js.Any = e._get("target")
  target._get("value").cast()
}

///|
fn main {
  let items : @resource.Signal[Array[Item]] = @resource.signal([
    { id: 1, title: "First" },
    { id: 2, title: "Second" },
  ])
  let query = @resource.signal("")
  let open = @resource.signal(false)
  let visible = @resource.memo(fn() {
    let q = query.get()
    items.get().filter(fn(it) { q == "" || it.title.contains(q) })
  })
  let app = @element.div(class="app") <| [
    @element.input(
      type_="search",
      attrs=[("aria-label", @element.AttrString("Filter"))],
      on=@element.events()
        .input(fn(e) { query.set(input_value(e |> @js.identity)) })
        .keydown(fn(e) {
          let k : @js.Any = e |> @js.identity
          if k._get("key").cast() == "Escape" { query.set("") }
        }),
    ),
    @element.button(
      dyn_attrs=[("aria-expanded", @element.attr_dynamic(fn() { open.get().to_string() }))],
      on=@element.events().click(fn(_e) { open.update(fn(v) { !v }) }),
    ) <| [@element.text("Toggle")],
    @element.show(fn() { open.get() }, fn() {
      @element.p(class="panel") <| [@element.text("Panel open")]
    }),
    @element.ul() <| [
      @element.for_each(fn() { visible() }, fn(it, _i) {
        @element.li(attrs=[("data-id", @element.AttrString(it.id.to_string()))]) <| [@element.text(it.title)]
      }),
    ],
    @element.p(dyn_class=fn() { if open.get() { "on" } else { "off" } }) <| [
      @element.text_dyn(fn() { "\{visible().length()} shown" }),
    ],
  ]
  match @dom.document().getElementById("app") {
    Some(el) => @element.render_to(el, app)
    None => ()
  }
}
```

## The API, briefly

- **Elements**: `@element.<tag>(id?, class?, style?, dyn_class?, dyn_style?, on?, ref_?, attrs?, dyn_attrs?) <| [children]`.
  Most HTML tags exist. Where a tag name is a MoonBit keyword, the function takes a trailing
  underscore: `main_`, `header_`, `footer_`. Inputs take `type_`. Text is `text("…")`, and text that
  changes is `text_dyn(fn() { … })`. SVG has `svg`, `svg_g`, `svg_path`, `svg_rect`, `svg_circle`,
  `svg_line`, `svg_text`, …
- **Attributes**: static ones go in `attrs=[("aria-label", AttrString("…")), ("tabindex", AttrInt(0)), ("hidden", AttrBool(true))]`.
  Changing ones go in `dyn_attrs=[("aria-selected", attr_dynamic(fn() { … }))]`, and a class that
  changes goes in `dyn_class=fn() { … }`.
- **Events**: `on=events().click(…).keydown(…).input(…).focus(…).blur(…).submit(…).change(…).mouseenter(…)`.
  Each handler gets a typed event. Turn it into `@js.Any` with `e |> @js.identity` and read
  properties with `_get("key")`, `_get("target")`, and so on. Call methods through `@js.Any`'s
  `_call`, for example `preventDefault`.
- **State**: `@resource.signal(v)` gives `.get()`, `.set(v)` and `.update(fn(v) { … })`.
  `@resource.memo(fn() { … })` is derived state, `@resource.effect(fn() { … })` is a side effect,
  and `@resource.batch(fn() { … })` groups several updates into one. Read signals **inside** the
  closures (`text_dyn`, `dyn_*`, `show`, `for_each`), or nothing updates.
- **Structure**: `show(when, render)` renders conditionally, `for_each(items_fn, fn(item, index) { … })`
  renders a list, `index_each` renders a list by index, `fragment([...])` groups nodes, and
  `portal_to_body([...])` renders a dialog or popover into the body.
- **Element access** (focus, scroll, measuring): `ref_=fn(el) { … }` hands you the `@dom.Element`
  once it is mounted. Keep it in a `Ref` and call `focus()` or `scrollIntoView` on it later through
  `@js.Any`.
- **Input value**: a signal does not write back to the field by itself. Bind it with
  `dyn_attrs=[("value", attr_dynamic(fn() { query.get() }))]`: for `value`, luna sets the
  property, not the attribute, so clearing the signal clears the field.
- **Mount**: `@element.render_to(element, node)` replaces what is inside the element. Get the
  element with `@dom.document().getElementById("app")`.

Reference, readable on this machine (outside the repository; read it, do not edit it):

- `/home/user/mizchi/luna.mbt/luna/src/dom/pkg.generated.mbti`: every element and helper, with its signature.
- `/home/user/mizchi/luna.mbt/luna/src/js/resource/pkg.generated.mbti`: signals, memo, effect, batch.
- `/home/user/mizchi/luna.mbt/website/01_luna/03_api-moonbit/04_client-dom.mbt.md`: client DOM guide; every sample in it compiles.
- `/home/user/mizchi/luna.mbt/website/01_luna/05_tutorial-moonbit/`: signals, effects, show, for, lifecycle.
- `/home/user/mizchi/luna.mbt/luna_components/src/`: APG components (`dialog.mbt`, `combobox.mbt`, `tabs.mbt`, …).

The first `moon build` of a module fetches its dependencies from mooncakes into `~/.moon`. That
takes a minute; later builds take seconds.

## Pitfalls the first sites found

These come from the agents that built the first six luna sites (chat, search, video, maps, code,
wiki). Each was measured, not guessed:

- **`class=` on SVG elements is dropped without a word.** luna sets classes through `className`, and
  an SVG element ignores that. Set SVG classes from `ref_` with `setAttribute`, through the
  typed helper below:
  `ref_=fn(e) { js(e)._call("setAttribute", [@js.any("class"), @js.any(cls)]) |> ignore }`.
  Or style the SVG through its HTML parent.
- **`show()` unmounts what it hides.** An `aria-controls` that points into hidden content then
  points at nothing. For a popup whose id must exist while it is closed, keep it mounted and toggle
  `hidden` (or `display: none`) instead.
- **`for_each` keeps rows by reference and renders each row untracked.** A row's index, and any
  signal read outside a `text_dyn` / `dyn_*` closure, keeps its first value. Use `index_each` when
  ids or positions come from the index, and read signals inside closures.
- **A dynamic attribute cannot remove itself.** `attr_dynamic` always calls `setAttribute`, except
  for `disabled`. Use `"false"` where ARIA allows it. Otherwise add and remove the attribute in an
  effect on the element's `ref_`.
- **`table`, `tr`, `td`, `th`, `dialog`, `cite` and `b` have no helper.** Use
  `create_element("table", [("class", attr_static("…"))], children)`.
- **luna_components returns `@core.Node`, not the client DOM's `DomNode`**, so its components
  do not compose with the `@element` DSL. Write the APG pattern by hand, using its source as a
  guide.
- **`@js.identity(e)._call(…)` does not type-check** (`Type _/0 has no method _call`). A typed helper
  does: `fn[T] js(v : T) -> @js.Any { @js.identity(v) }`.
- **MoonBit snags**: generic functions are written `fn[T] f(…)`; `typealias @element.DomNode`
  does not parse, but `using @element {type DomNode}` does; `parse_int` lives in `@string`; slices
  are written `arr[a:b]`.

## Things luna will not do for you

- **Server-rendered first paint**: the page is empty until `app.js` runs. Keep `index.html`'s
  landmarks static where you can (`<header>`, `<main id="app">`, `<footer>`), so a check that runs
  before the script still finds a page with structure.
- **Determinism**: no `Math.random()` without a seed and no clock in anything displayed, exactly as
  in PROTOCOL.md. A "now" is a fixed date written into the data.
- **Reduced motion**: luna leaves animation to you. Honour `prefers-reduced-motion` in CSS, and
  `?animate=0` when something moves on load.
