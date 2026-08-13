# agent-k — adopting vlmkit into the orders console

Role: platform engineer, first week, does not own `consumer/`.
Budget: 3 rounds. Used all 3.

## Round 0 — baseline

- `cd consumer && pnpm test` → exit 0, `# tests 3 / # pass 3 / # fail 0`. That is green.
- Read `consumer/`: 1 page (`public/index.html` + `app.css`), a dev server whose
  `/api/orders` values move on every request and whose `/api/stream` is held open
  forever, 3 unit tests, 1 Playwright smoke spec.
- `vlmkit --help` → command groups only. Useful: it named `gates` as
  "Run repeatable local and CI gates", which is the thing the brief asks for, so
  I did not have to guess.

## Round 1 — what does it find

Started the console on 4321. Ran, one at a time, against `http://localhost:4321/`:

| Command | Exit | Helped? |
|---|---|---|
| `check integrity` | 1 | **Yes.** Named the overflow *and its cause* (`table.orders`, 940px, "shrinking or moving it removes 188px"). |
| `check a11y contrast` | 1 | **Yes.** 3 failures with measured ratios, hex pairs and the text. |
| `check a11y focus` | 0 | Clean. Fine — a pass I can trust is worth having. |
| `check a11y touch` | 0 | Clean (buttons are `min-height: 44px`). |
| `check copy` | 1 | **Yes.** Caught `FIXME` shipped in user-visible copy. |
| `check breakpoints` | 0 | Partly. 3 warns, all the same root cause as integrity's fail. |
| `check design` | 0 | **No** — false positive, see below. |
| `check interactions` | 0 | **Yes.** All 3 footer buttons are inert. Real. |
| `check integrity <file.html>` (no server) | 1 | **Dead end**, correctly so: `file://` makes the fetch throw, so it invents a `js-error` and loses the table rows. The page must be served. |

Every URL run ended with the same footer, unprompted:

> `http://localhost:4321/ is live and not pinned — a re-run may measure different
> data. Pin it: vlmkit snapshot record-har http://localhost:4321/ --out app.har,
> then --har app.har`

That single line is the most valuable output of the whole exercise — it is the
answer to "how do I put this in CI" and it came from the tool, not the docs.

## Round 2 — make it a config

- `vlmkit gates init --pages … --gate …` wrote `vlmkit.gates.json` and **added
  `--wait-until load --timeout 15000` by itself**, explaining: *"the default
  `networkidle` milestone never fires on a page that holds a connection open (a
  stream, a poll), and every gate would time out having reported nothing."* That
  is exactly this app's `/api/stream`. It diagnosed a trap I had not hit yet.
- `snapshot record-har` → `vrt/orders.har`. Then I killed the server and re-ran
  `check integrity … --har vrt/orders.har`: **identical findings, no server**.
  This is the adoption unlock — CI needs no dev-server step and no port.
- `examples/vlmkit.gates.json` (docs) taught me `suppressions` (reason / owner /
  expires) and the `rules` block. Needed the docs for this; `gates --help`
  mentions suppressions but not their shape.
- Tried to suppress the `check design` false positive with the documented
  `--min-reuse 2` → **did not work** (average reuse is 1.5, still drifts).
  Fell back to `"check.design/component-drift": "info"`.
- Tried to annotate that decision inline: `"//check.design/component-drift": "…"`
  inside the `rules` map → **config error**:
  `error: defaults.rules["//check.design/component-drift"]: must be one of off,
  suspect, warn, info`. The `//`-comment convention the tool's own example file
  uses at object level is rejected one level down.
- `gates run --output vrt/results` → 8 jobs, 9.4s wall. Found the
  `2 FAILED, 1 DID NOT RUN` bug (below).

## Round 3 — commit it, prove nothing broke

- `package.json`: added `vrt`, `vrt:advisory`, `vrt:record`. Did not touch `test`.
- `.gitignore`: `vrt/results/`, `test-results/`, `.vlmkit/` (the tool created all
  three and mentioned none of them).
- `vrt/README.md`: the triaged finding list.
- `.github/workflows/vrt.yml`: one step, `pnpm vrt`.
- `pnpm vrt` twice → byte-identical except timings. Deterministic.
- `pnpm test` → exit 0, `# tests 3 / # pass 3 / # fail 0`, identical to baseline.
