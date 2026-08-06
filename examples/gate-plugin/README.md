# Gate plugin example

A self-contained project that adds two gates of its own. It has its own
`vlmkit.config.json`, so it runs as-is:

```bash
cd examples/gate-plugin

vlmkit rules                                # both gates appear, under design-system
vlmkit rules check dom-budget               # its rule table

vlmkit check house-brand page.html          # pass
vlmkit check house-brand page-broken.html   # suspect (off-brand font) → exit 1

vlmkit check dom-budget  page.html          # pass; budgets read from the config
vlmkit check dom-budget  page-broken.html   # depth warn → exit 0
vlmkit check dom-budget  page-broken.html --rule check.dom-budget/depth-over-budget=suspect
vlmkit check dom-budget  page-broken.html --max-depth 20   # a flag beats the config
```

From a checkout without a global install, substitute
`node --experimental-strip-types ../../src/cli/vlmkit.ts` for `vlmkit`.

## The files

| File | What it demonstrates |
|---|---|
| `house-gates.ts` | The smallest useful gate — read a file, match strings, no browser. Read this to see the plugin boundary. |
| `dom-budget.gate.ts` | The shape a real house metric takes — render the page, measure numbers, compare each against a budget. Copy this one. |
| `index.ts` | Both gates in one `definePlugin` — the unit of distribution. |
| `vlmkit.config.json` | `"plugins"` plus a `"domBudget"` block, showing a gate reading its own config key. |
| `page.html` | Conforms to both gates. |
| `page-broken.html` | Trips one rule in each: a `suspect` font and a `warn` nesting depth. |

`index.ts` is what the config points at. `house-gates.ts` *also* default-exports
a plugin holding just its own gate — it is the smaller thing to point a first
config at, and the docs use it for that. Don't declare both in one config: they
share `check.house-brand`, and the registry rejects duplicate gate ids rather
than letting one silently win.

## Writing your own

[`docs/authoring-gates.md`](../../docs/authoring-gates.md) walks through the
contract field by field, the severity and category choices, reading config,
measuring in a browser, and testing.

These two gates are covered by `src/cli/plugin-e2e.test.ts`, which spawns the
real CLI against them — so a broken example fails a test here rather than a
reader's first attempt.
