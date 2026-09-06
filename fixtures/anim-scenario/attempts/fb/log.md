# Log — ports and adapters (modules kind)

## Kind chosen

`kind: modules`. Considered `diagram` (nodes/edges, walked by sequence) but the
brief is explicitly "a still figure" showing which side each part sits on and
what depends on what — that is exactly what the guide describes `modules` for
("the picture, not the motion, is the explanation... dependencies point one
way and the layout follows from them; containers group modules"). `modules`
also gives me `groups` (containers) for free, which `diagram` does not have,
and I need four groups: driving side, application, domain(+port), adapters.
Did not consider `graph` seriously — the guide says `graph` is for a walk
(BFS/Dijkstra) over nodes that never move, not a static ownership map, and its
anchors table has no `groups` concept.

## First `check` output (verbatim, before any edits)

```
✓ scene.json (modules): 0 error(s), 0 warning(s)
  1260ms · 3 steps (2 captioned) · 25 nodes · 2 tracks / 4 keyframes · annotations: 1 drawn, 1 on screen at the end
  scene 1141 B → timeline 4916 B (×4.3)
  next: vlmkit-anim explain scene.json · vlmkit-anim render scene.json --step N · vlmkit-anim html scene.json --out page.html
```

Passed clean on the first attempt — 0 rounds of fixing needed. See "friction"
below for why this is not the same as "the guide made the right design
obvious."

## Design

Modules: `http` (HTTP handler), `cli` (CLI command) — the driving side;
`appsvc` (Application services); `domain` (Domain model); `port` (Repository
port, the interface the domain owns); `postgres`, `inmemory` — the two driven
adapters.

Real `deps` (all six point inward):
- `http -> appsvc`, `cli -> appsvc` (driving side calls into the application)
- `appsvc -> domain`, `appsvc -> port` (application uses the domain and talks
  to persistence only through the port)
- `postgres -> port`, `inmemory -> port` (both adapters depend on/implement
  the port; the port never depends on them)

Deliberately **not** added to `deps`: `domain -> postgres`. That is the bug the
brief is about, and putting it in `deps` would (a) make it a real, same-status
edge as the others, contradicting "visibly different", and (b) pull `domain`
into having an outgoing dependency in the picture, contradicting the success
criterion "the domain has no outgoing dependency in the picture."

Groups: `driving` (http, cli), `application` (appsvc), `domaincore` (domain +
port, labelled "domain (owns the port)" — the port is drawn as part of the
domain's box, since the brief says the domain owns that interface), `adapters`
(postgres, inmemory).

## Marking the forbidden dependency

Used the **annotation op `relate`**, not `deps`:

```json
{
  "relate": { "from": "domain", "to": "postgres", "label": "forbidden — must not exist", "style": "line" },
  "caption": "The domain must depend on nothing outside itself. domain -> postgres is the import to delete; every real dependency above points inward, toward domain and its port."
}
```

This sits in `sequence` (one beat), so the scene is technically no longer
"sequence-less", but `still` renders the final frame and the guide says
`check` does not require or forbid a `sequence` on `modules`. `relate` was
the only annotation op documented as drawing "a labelled arrow between two
anchors" for a relation that is not a real dependency — the doc even names
this exact use case ("A ∥ C", "this came from that") as what `relate` is for,
so it does generalize to "this must never point there."

**Did the guide tell me how to do this?** Partially. It told me the mechanism
(`relate`, `style: "line"` for "no head") but said nothing about colour, and
I initially wrote in this log that `relate` could not be coloured at all
("no op ... lets you apply `bad` or any colour"). That was wrong, and I only
found out by rendering: opening `figure.svg`/`figure.png` (the brief's own
"look at your own SVG before declaring done" step) shows the `relate` line
drawn in `#f59e0b` (the theme's accent/amber), with no arrowhead, curved
where the real dep-edges are straight black lines with arrowheads — so it
*is* visibly distinct, automatically. **Nowhere in `docs/anim-ir.md` or in
`schema --kind annotations` / `schema --kind modules` does it say a `relate`
is drawn in the accent colour.** The guide documents `theme.accent` only as
"colours" with no behavioural tie, and every worked example of `relate` in
the guide is monochrome-rendered in the prose so the colour never shows up in
what an author reads before writing the scene. I distinguished the forbidden
edge by:
1. **Not being in `deps`** at all (so it does not share the arrow style, the
   layering influence, or the "real dependency" status of the six actual
   edges),
2. `style: "line"` (no arrowhead, vs. every real edge which defaults to
   `arrow`), which — it turns out — also happens to be drawn amber, not the
   deps' black,
3. An explicit, unambiguous `label`: "forbidden — must not exist",
4. A caption that says outright what must be deleted.

The remaining gap: I still have no way to ask for the `bad` (presumably red)
theme token specifically — `relate` always renders in `accent`, not
whichever theme colour the author names, and amber usually means
"highlighted / under discussion" elsewhere in the IR (`sort` compare,
`array` highlight, `graph` highlight), not "wrong." The guide ships a `bad`
colour and never wires it to anything an author's scene can trigger.

## Coordinates / colours / canvas sizes typed by hand

**None.** Zero literal coordinates, zero colours, zero canvas dimensions
anywhere in `scene.json`. Every position comes from the automatic dependency
layering (`tb`, the default) and every colour comes from the default theme.
This is squarely inside what `modules` is designed for — I never had to reach
for `vector` or a raw `canvas`/`theme` override.

## Rounds

Round 1 (first `check`): 0 ✗, 0 ⚠. No edits made — went straight to `layout`,
`explain`, `still`.

## `layout` result

```
$ pnpm exec vlmkit-anim layout scene.json
```
See terminal output captured below in this file's final section — no issues
reported (exit 0).

## Final check: looked at the rendered figure

`figure.png` (via `still --out figure.png`, `PLAYWRIGHT_BROWSERS_PATH` set)
confirms: 4 group boxes laid out top-to-bottom by real dependency depth
(driving side → application → domain(+port), with adapters at the same
depth as application since both are "one below" the domain/port leaves);
six black straight arrows with arrowheads for the real deps, all pointing
down/inward; one amber curved line with no arrowhead and the label
"forbidden — must not exist" arcing from Domain model over the application
box to Postgres repository. Domain model has no outgoing black arrow — only
the amber relate line touches it, and that line is not a `deps` edge. This
matches the brief's success criteria by inspection.

## Anything I wanted and could not express

- **A way to *choose* which theme colour a `relate` (or a `deps` edge) is
  drawn in**, specifically the `bad` token. I got a distinct colour (amber,
  the same accent used for "currently interesting" elsewhere in the IR) for
  free and undocumented, but not the semantically-correct "red / wrong"
  colour the brief's scenario calls for and the theme already names. Being
  drawn in the same colour as "highlighted / under discussion" elsewhere in
  the IR is a weaker signal for "this must be deleted" than red would be.
- A dashed line (as opposed to `style: "line"`, which is solid with no head)
  would have added a second, stronger signal for "this must not be" vs. "this
  is a fact, just undirected" (which is `line`'s only other documented use —
  the `emits` edge in the guide's own `modules` example is a normal, allowed
  edge drawn with `style: "line"`, so `line` alone doesn't mean "forbidden",
  it means "undirected/informational"). I couldn't find a `dash` or similar
  field on `relate` or `deps` edges (unlike `vector` tweens, which do have
  `dash`).
