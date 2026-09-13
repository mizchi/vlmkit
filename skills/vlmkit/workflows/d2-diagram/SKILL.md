---
name: d2-diagram
description: Draw a software architecture, system, data-model or call-flow diagram as D2 text laid out by TALA (D2's whiteboard-style engine, open source since D2 0.9), and look at it in the terminal before anyone opens an image — `d2 --layout=tala x.d2 x.txt` renders the same layout as Unicode box drawing, `--ascii-mode standard` as plain ASCII for a README. Loop: write `.d2` → `d2 fmt` / `validate` → terminal render → SVG / PNG → fix the text. Use when asked for a D2 diagram, an architecture diagram kept as editable text in the repo, a TALA layout, a diagram that shows in a terminal or a code block, or when the repo already has `.d2` files. Not for animations or figures held to a fact sheet (`explanatory-animation`, `explain-with-anim`).
metadata:
  internal: true
---

# d2-diagram

A D2 file is the diagram; the picture is a render of it. The writer's job is
the text — ids, labels, containers, connections — and TALA's job is where the
boxes go and how the lines bend. The terminal render exists so the writer
reads the picture on every round without leaving the shell, and so the
diagram can live in a README code block, a PR comment, or a `--help` text.

```d2
direction: right
web: Web frontend
api: API server
db: PostgreSQL {shape: cylinder}
web -> api: HTTPS
api -> db: SQL
```

```
                                                          .-‾‾‾‾‾‾-.
                                                         │╲-______-╱│
                    HTTPS                        SQL     │          │
┌─────────────┐──────────────▶┌───────────┐─────────────▶│          │
│Web frontend │               │API server │              │PostgreSQL│
│             │               │           │              │          │
└─────────────┘               └───────────┘               ╲-______-╱
```

(`d2 --layout=tala x.d2 x.txt`, verbatim, D2 0.8.1-HEAD.)

This skill is for a diagram whose deliverable is **D2 text**: someone will
edit it later, TALA lays it out, and it renders wherever D2 does. When the
picture must be *checked against the code* (a module map held to the import
graph) or *move* (an algorithm step by step), use `explanatory-animation` /
`explain-with-anim` instead — a D2 diagram is a drawing, and nothing in D2
tells you it is wrong. The two combine: draw the modules and dependencies that
`vlmkit-anim facts <dir> --depth 1 --out f.expect.json` lists, so the D2 is
grounded, and keep both files.

## Invocation

```bash
d2 --version                                # v0.9.0 or newer bundles TALA
d2 layout                                   # must list: tala (bundled)

d2 --layout=tala arch.d2 arch.txt && cat arch.txt   # the terminal render (Unicode box drawing)
d2 --layout=tala --ascii-mode standard arch.d2 arch.txt   # plain ASCII (+ - | / < > v), for READMEs and dumb terminals
d2 --layout=tala arch.d2 --stdout-format ascii -    # to stdout, for a pipe or a PR comment
d2 --layout=tala arch.d2 arch.svg           # the figure for docs
d2 --layout=tala arch.d2 arch.png           # a raster to look at with your own vision (no browser needed)
d2 fmt arch.d2                              # canonical formatting, in place
d2 validate arch.d2                         # syntax only; exit 1 with file:line:col
```

Install when `d2` is missing — never drive the diagram through an online
playground:

```bash
curl -fsSL https://d2lang.com/install.sh | sh -s --      # the installer; it rejects the obsolete --tala flag
brew install d2                                          # macOS
go install github.com/d2lang/d2@latest                   # Go 1.27+; what to do when the install script gets a 403 through a proxy
```

`D2_LAYOUT=tala` in the environment is the same as the flag. `vars: { d2-config:
{ layout-engine: tala } }` inside the file is honoured for `.svg` / `.png` **and
not for `.txt`** on the build this was measured on (0.8.1-HEAD, 2026-09-13: the
text render fell back to dagre and came out 163 columns wide instead of 120),
so pass the flag anyway; put the config in the file so the next renderer of
the SVG gets the same engine.

## Why TALA, and when not

TALA (Terrastruct's AutoLayout Algorithm) is D2's own engine for software
architecture diagrams, open-sourced under MPL-2.0 and bundled in D2 since 0.9.0
(older releases needed a separate download). Where dagre and ELK lay a directed
graph out in layers, TALA arranges boxes the way a whiteboard drawing does —
orthogonal, symmetric where it can be, clustered by container — and it is the
only engine that honours every D2 feature: `direction` per container,
`width` / `height` on containers, `near: <other shape>`, and `top` / `left` to
pin a shape while the engine places the rest.

| The diagram is… | Engine |
|---|---|
| Boxes in containers with connections in several directions (an architecture, a deployment, a data model) | **tala** |
| One flow with a clear direction, many hops (a pipeline, a DAG) | tala with `direction: right`; if it still reads badly, `elk` — the blog is explicit that TALA does less well on flowing graphs |
| Thirty-plus shapes | Split by container into two files. TALA's runtime is nonlinear in size: 30 nodes took 0.94s here where ELK took 0.05s; layouts that size also read badly whatever the engine |

**Randomness, made reproducible.** TALA tries three seeds (`--tala-seeds`
default `1,2,3`) and keeps the best complete result, so the same file renders
the same picture twice — measured identical here. A label change can still
cascade into a different arrangement. Two consequences: never describe the
geometry in prose ("the box on the left") — name ids; and when a layout is
ugly, `--tala-seeds 4,5,6` gives you a *different* layout, not a nudged one.
Pin with `top` / `left` (both together, TALA only) when a shape must stay put:
the blog's intended hybrid is that you choose positions for the few boxes
that matter and TALA routes everything else.

## Route by task

| Task shape | Write |
|---|---|
| "Draw the architecture / how the services fit" | Containers per area (`packages: packages/ { core; capture; … }`), connections between children (`cli -> packages.markup`), `direction: right` at the root, per-container `direction` where a group flows the other way |
| "Draw the data model / tables" | `shape: sql_table` with `id: int {constraint: primary_key}` rows; connect columns (`orders.user_id -> users.id`) |
| "Draw the request / call flow between components" | `shape: sequence_diagram` at the root; actors in first-use order; one message per line with its label |
| "Draw the classes" | `shape: class` with `+method(): type` / `-field: type` lines |
| "Draw the deployment / network" | Containers for hosts and zones; `shape: cylinder` for stores, `shape: cloud` for external services, `shape: queue` for brokers |
| "We already have a `.d2`" | Edit it; `d2 fmt`; render before and after; do not switch its engine or theme without saying so |
| "Put it in the README / a code block / a PR comment" | The `standard` ASCII render inside a fenced block; check its width (below); keep the `.d2` next to it |
| "It has to be checked against the code" | `vlmkit-anim facts <dir>` first, draw exactly its modules and deps, cite the sheet — or hand the task to `explanatory-animation` |

## The loop

```
1. write arch.d2                                     ids ASCII; the label after the colon is what the reader sees
2. d2 fmt arch.d2 && d2 validate arch.d2             syntax; exit 1 names file:line:col and the missing } or destination
3. d2 --layout=tala arch.d2 arch.txt && cat arch.txt read the picture in the terminal — every box, every arrow, its direction
   wc -L arch.txt                                    columns; over your terminal's width, change `direction` or split
4. d2 --layout=tala arch.d2 arch.png                 look at it once with your own vision (labels, edge labels, icons the text render drops)
5. fix the text; go to 2
```

Five rounds at most. The text render is where you read *structure*: which
box is inside which, what points at what, whether an arrow runs the way the
sentence does. Read *labels* on the PNG. A compile error is one line —
`arch.d2:2:9: invalid style keyword: "colour"`, `2:1: connection missing
destination` — fix the line it names.

## Done condition

- `d2 validate` exits 0 and `d2 fmt` changes nothing.
- The TALA render exits 0 (`d2 layout` listed `tala (bundled)` — the render
  did not silently fall back).
- The terminal render fits the width it is for: 120 columns for a wide
  terminal, 80 for a README code block, measured with `wc -L`.
- Every shape and connection in the prose is named by its id, and every id in
  the prose is in the file.
- The `.d2` is committed where the SVG is; the SVG is a build output or is
  committed next to it — never only pasted.

## Reading the terminal render

Measured on 0.8.1-HEAD with the file under `assets/`:

- **Width is the layout's, not yours.** The workspace map rendered at 120
  columns with TALA `direction: right`, 94 with `direction: down`, 163 with
  dagre or ELK. `--scale` does not shrink the text render. The levers are
  `direction`, splitting a container into its own file, and shorter labels.
- **Edge labels are written onto the line** and their spaces become line
  characters (`vlmkit check integrity─page─html`). Keep terminal-bound edge
  labels to one or two words, or drop them from the terminal version.
- **`shape: text` and `|md …|` blocks render as empty boxes.** A title, a
  legend or a paragraph belongs in the prose around the render, or in a
  variant of the file rendered only to SVG.
- **CJK labels pad every glyph** (`ウ  ェ  ブ`) and misalign the box that holds
  them. Ids stay ASCII always; for a diagram that will be *read* in a
  terminal, keep labels ASCII too and put the Japanese in the surrounding
  text. The SVG / PNG render Japanese correctly.
- **`standard` mode** keeps the same layout with `+ - | / < > v` only — the
  version for a README that is read on GitHub, where box-drawing glyphs in a
  code block depend on the viewer's font.
- **Icons and images are dropped**; sequence diagrams, `sql_table` and
  `class` shapes render, with their rows.

## Rules the writer keeps

- Ids are ASCII and stable (`api`, not `API server`); the label goes after
  the colon, `_` reaches the parent (`presents -> _.regift`), dots reach into
  containers (`cli -> packages.core.plugin`).
- One root `direction`; a container that must flow the other way sets its own
  (TALA only).
- Connections read as sentences: `a -> b: verb`. `--` is undirected, `<->`
  both ways; `{style.stroke-dash: 3}` on a connection marks it optional or
  planned — say which, in the label or the prose.
- `vars: { d2-config: { layout-engine: tala } }` at the top of every file, so
  a render without the flag still gets TALA for the SVG.
- No coordinates unless a shape must be pinned; then `top` and `left`
  together, on that shape only, and a comment saying why.

## Deliver

- In a chat: the terminal render in a fenced block (it *is* the picture in a
  terminal), the ids named in the prose, the `.d2` and the PNG / SVG as files
  (`SendUserFile` when available).
- In a PR or issue: the `standard` render in a fenced block, or the SVG
  committed and linked. The `.d2` in the diff is the review target.
- In docs: the `.d2` committed next to the page and the SVG generated by the
  build (`d2 --layout=tala docs/arch.d2 docs/arch.svg` in a script), or the
  SVG committed when the site has no build step.

## Failure modes

- `d2: command not found` → install (above); do not draw it in another tool.
- `d2 layout` does not list `tala` → an old release; upgrade. The installer's
  `--tala` flag no longer exists and is rejected.
- The text render came out dagre-shaped and wide though the file says
  `layout-engine: tala` → the `.txt` path ignores the in-file config on some
  builds; pass `--layout=tala`.
- `connection missing destination`, `maps must be terminated with }` → the
  line and column named; usually a trailing `->` or an unclosed brace.
- `invalid style keyword` → D2 spells `color`, `stroke`, `stroke-dash`,
  `fill`, `font-size`, `bold`, `opacity`, `shadow`, `3d`, `multiple`.
- Every round moves the boxes though you changed one label → TALA reflowed;
  pin the few shapes whose place matters with `top` / `left`, or accept it and
  stop describing positions.

`assets/vlmkit-workspace.d2` is this repository's workspace as a D2 file, and
`assets/vlmkit-workspace.txt` is its TALA terminal render — what a clean round
looks like.
