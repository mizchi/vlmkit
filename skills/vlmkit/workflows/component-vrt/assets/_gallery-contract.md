# The gallery contract, and what `check story` needs from it

A **gallery** is one page that can render any of your stories on demand. It is
the half of Playwright component testing that lives in *your* repo — Playwright's
own docs are explicit that it is framework-specific and yours to own, with no
template to copy. The templates in this directory exist to close that gap.

## The contract

Two functions on `window`, and one element:

```js
window.mount({ story, props })   // render `story` with `props` into #root
window.unmount()                 // tear the current story down
```

- **`params` is `{ story, props }`** — the story id (string) and a plain
  serializable props object.
- **Render into `#root`.** Playwright's `mount` fixture returns a `Locator` for
  `#root` itself, and `vlmkit check story` screenshots that same element. This is
  what makes the image the size of the component instead of the size of the
  viewport.
- **Return a promise that rejects on failure** — unknown story, render throw.
  Quoting the spec: "there is no HTTP-status or DOM-attribute signalling." The
  rejection is the *only* failure channel, and it is what turns a typo'd story id
  into a real message instead of a blank screenshot. `check story` surfaces it as
  a `mount-failed` finding.
- **Reuse the root across calls.** Re-rendering into the same root (rather than
  recreating it) is what makes the fixture's `component.update(props)` preserve
  component-internal state.
- **`window.mount` is your setup hook.** It is the browser-side equivalent of the
  old `beforeMount`/`afterMount`: install providers, seed a store, start a mock
  server, disable animation. There is no separate hook registry — the function
  you own *is* the hook.

## Resolve, then render

`mount` passes the story id through untouched; resolution is the gallery's job.
The recommended grammar:

- `<path under src, without the .story.* extension>/<ExportName>` —
  `src/components/Button.story.tsx` export `Primary` → `components/Button/Primary`
- Any unique trailing suffix resolves too: `Button/Primary`
- A single-file-component story (`Button.story.vue`) is one story, addressed by
  its path alone: `components/Button`

Make ambiguity an **error**, not a first-match guess. Silently picking one of two
matching stories produces a diff nobody can trust.

## Two things `check story` needs that the fixture does not

1. **Await layout, not just render.** The fixture is usually followed by a
   locator assertion that retries; a screenshot is not. If `window.mount`
   resolves before the browser has laid the component out, the first shot catches
   an empty box. Every template here awaits two `requestAnimationFrame`s at the
   end of `mount` for exactly this reason — it costs nothing and removes a whole
   class of flake.
2. **Kill animation.** A story mid-transition is not pixel-stable. The cheapest
   place to fix that is inside `window.mount`, globally, once:

   ```js
   const style = document.createElement('style');
   style.textContent = `*,*::before,*::after{
     animation-duration:0s!important; animation-delay:0s!important;
     transition-duration:0s!important; transition-delay:0s!important;
   }`;
   document.head.append(style);
   ```

   `check story --settle <ms>` is the fallback when a story genuinely needs to
   settle. Prefer disabling animation: waiting makes every run slower, and it only
   reduces the flake rather than removing it.

## Files here

| File | Use |
|---|---|
| `gallery.vanilla.html` | Zero dependencies. Works over `file://`, so `check story` runs with no dev server. Read this first — the whole contract in ~40 lines. |
| `gallery.host.html` | Host page for the framework galleries; the `<script type="module">` entry your bundler serves. |
| `gallery.react.template.tsx` | React 18+, stories discovered with `import.meta.glob`. |
| `gallery.vue.template.ts` | Vue 3, same discovery, `createApp`/`unmount` lifecycle. |
| `button.story.template.tsx` | What a story file looks like, including the hidden-form pattern for asserting state. |
| `playwright.ct.config.template.ts` | The `components` project for `playwright.config.ts` — needs Playwright 1.62+ for the `mount` fixture. `check story` does **not**. |

Copy, rename (drop `.template`), and adjust the glob to your source layout.
