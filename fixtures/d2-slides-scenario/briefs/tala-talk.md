# Brief: "Diagrams that live in the repo" — a conference lightning talk

You are giving a 10-minute lightning talk to a room of backend engineers who
keep their architecture diagrams in a drawing tool and have never heard of D2.
Build the deck.

## What the talk has to land

In order, and one slide each unless noted:

1. **Title.** "Diagrams that live in the repo", with a subtitle naming the
   talk as being about D2 and TALA.
2. **The problem.** A diagram in a drawing tool goes stale the moment the code
   changes, and nobody notices. Say why: it is not in the diff, it is not in
   review, and only one person has the file.
3. **What D2 is** — a text format for diagrams. **With a figure**: three boxes
   showing `.d2 text` → `layout engine` → `.svg / .png / terminal`.
4. **What TALA is and why its licence matters** — D2's own layout engine,
   whiteboard-style rather than a strict hierarchy, open source (MPL-2.0) and
   bundled, so a repo can commit a `.d2` file and every contributor renders the
   same picture with no paid component. **With a figure**: the three bundled
   engines (`dagre`, `elk`, `tala`) as a choice, with `tala` marked as the one
   this talk uses.
5. **The one thing that bites you.** A reference to an id that is not in scope
   does not error — D2 creates a new shape, so the picture silently gains
   boxes. **With a figure** showing a container `api` holding `orders`, a
   container `data` holding `postgres`, and the edge that should join them
   drawn from the root with full paths.
6. **What to do about it** — the loop, as a list: write the text, format and
   validate it, read the render, hold the picture to a fact sheet before
   trusting it.
7. **Closing.** One line the room should remember, plus where to get D2.

## Required content

The deck's own text must contain all of these, verbatim (they are checked
against the built `copy.txt`):

- `Diagrams that live in the repo`
- `MPL-2.0`
- `not in the diff`
- `creates a new shape`
- `whiteboard-style`

## Done condition

Not "it built". All four of these, on the build you deliver:

1. The build exits 0 **with no warning on stderr**.
2. `check integrity` is CLEAN on `index.html` (all three default viewports)
   **and** on `print.html` at `--viewports 1280`.
3. `check copy --manifest <built>/copy.txt --allow-invisible unknown` reports
   **missing 0**.
4. `check a11y contrast` on `print.html` reports **0 failures**, over a count
   consistent with every slide being read (roughly ten or more elements per
   slide — a handful means you pointed it at `index.html`).

If you conclude a gate finding cannot be fixed from the deck source at all,
stop trying: write down exactly what you concluded, what you would need, and
deliver the build anyway.

Plus: every figure above is present, and the five required strings are in
`copy.txt`.

## From v2 on: the fact sheets are yours

Two of the figures ship a fact sheet, because a figure that compiles can still
draw the wrong thing and no page gate can tell:

- `briefs/facts/tala-talk-phantom.facts.json` — the phantom-box slide's figure.
  **Exhaustive**: an extra box is the bug the slide is about.
- `briefs/facts/tala-talk-engines.facts.json` — the engines figure.

Hold each against the built SVG for the slide it belongs to, and make it pass:

```sh
node .claude/skills/d2-diagram/assets/d2-facts.mjs --from-svg built/slide-NN.svg \
  --expect fixtures/d2-slides-scenario/briefs/facts/tala-talk-phantom.facts.json
```

Both are part of the done condition.

## Hand in

`deck.md` and the built deck in your own attempt directory, plus `log.md`.
