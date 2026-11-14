# Parley — AI assistant chat (demo)

A chat window in the pattern of the big assistant apps, for a fictional assistant called **Parley**:
a history sidebar, one conversation ("Planning a lunar observation night") and a composer at the
bottom. Replies are canned and chosen by the prompt's keywords; they stream in three words every
50ms with a blinking caret. Written in MoonBit with [mizchi/luna](https://github.com/mizchi/luna.mbt)
and built into one classic script, so it runs from `file://` with no network requests.

How it was judged: [`JUDGMENT.md`](./JUDGMENT.md).

## URL parameters

| Parameter | Effect |
| --- | --- |
| `?theme=dark` / `?theme=light` | Force a theme (the default follows `prefers-color-scheme`) |
| `?animate=0` | Replies appear whole instead of streaming (also under `prefers-reduced-motion`) |
| `?chat=new` | Open on the empty "New chat" state with its four suggestions |
| `?history=empty` | Start with no conversations at all (the empty-history state) |

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page: static landmarks (`aside`, `header`, `main`) that luna renders into |
| `styles.css` | All styling; light and dark tokens, the phone drawer under 768px |
| `app.js` | **Built** from `src/` by `node examples/sites/luna-build.mjs chat`. Never edit by hand |
| `src/main/data.mbt` | Seed history, the conversation, canned replies, models, suggestions |
| `src/main/markdown.mbt` | The Markdown subset replies use (paragraphs, bold, inline code, lists, headings, tables, fenced code) |
| `src/main/state.mbt` | Signals, streaming, sending, scrolling |
| `src/main/main.mbt` | The views and `main` |
| `src/main/js.mbt` | Timers, focus, clipboard, menus' arrow keys and the focus trap, via `mizchi/js_core` |
| `copy.txt` | Required copy for `check copy --manifest` |
| `flow-*.json` | `verify flow` scripts: sending, stopping and regenerating, the drawer and dialog focus traps |
