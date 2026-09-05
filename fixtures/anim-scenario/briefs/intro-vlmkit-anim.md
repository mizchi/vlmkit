# Brief: introduce `vlmkit-anim` itself

Produce the animation that would sit at the top of `vlmkit-anim`'s README: an
**introduction** for a developer who has ten seconds and has never heard of
it. You know what the tool is from the writing guide you were given; say it
in at most ten beats.

What a newcomer must come away with:

- A short JSON file describes *what is being explained* (a `kind`), not
  shapes and coordinates.
- It compiles to a timeline that plays in the browser, renders to frames /
  GIF, and is **checked**: the tool reads the result back and tells you when
  the animation does not say what the file claims.
- The loop is write → `check` → read the hint → edit.

This is a *presentation*, not a walkthrough of one data structure: show the
pieces (scene file, compiler, timeline, the three outputs, the check) and how
they connect, with the file's smallness and the check's feedback as the two
things to remember. Give it a title and a last beat that states the one-line
pitch.

Use whichever kind or kinds say this best; if no single kind does, write
several scenes (`scene-1.json`, `scene-2.json`, …) with an `index.md` giving
their order and one line each on what each shows.

Success: every scene passes `vlmkit-anim check` with no ✗ and no ⚠; `explain`
reads as a pitch a newcomer could follow without the picture.

Also record in `log.md`: which kinds you used and why; every place you had to
write a coordinate or a colour by hand; what you wanted to put on screen (a
code snippet, a callout, a logo, an arrow between two pictures, …) and could
not; and how free you felt compared with making a slide by hand.
