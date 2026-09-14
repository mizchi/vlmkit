/**
 * The `d2-slides` builder's contract, checked without `d2` and without a browser.
 *
 * The deck's real gates are page gates — `check integrity`, `check copy --manifest`,
 * `check a11y contrast` — and they need Chromium, a built CLI and a `d2` that can lay
 * a figure out. That job is `.github/workflows/d2-slides.yml`. What is left over is
 * everything the builder decides BEFORE a figure is drawn: where a slide ends, which
 * layout a slide gets, what the manifest says, when the prose is too long for the
 * frame, and what happens when a figure does not compile. None of that needs `d2`, so
 * none of it should wait fifteen minutes to be told.
 *
 * `D2` is pointed at a stub: the builder already reads that variable, and a stub that
 * echoes a fixed SVG makes every decision above observable. The one thing a stub
 * cannot check is the layout itself, which is why the two halves exist.
 *
 * The last case is the staleness gate: `examples/d2-slides/built/` is committed so the
 * example can be opened without installing `d2`, and a committed build goes stale the
 * first time someone edits `deck.md`. Its manifest and its slide structure come from
 * the Markdown rather than from TALA, so they can be re-derived here with the stub and
 * compared — the figures' bytes are compared in the workflow, where the real `d2` is.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, it } from "vitest";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILDER = join(repoRoot, ".claude/skills/d2-slides/assets/build-deck.mjs");
const EXAMPLE = join(repoRoot, "examples/d2-slides/deck.md");
const COMMITTED = join(repoRoot, "examples/d2-slides/built");

let workspace;
let okStub;
let failStub;

/** A stub `d2`: reads the figure on stdin, discards it, writes one fixed SVG. */
function writeStub(path, body) {
  writeFileSync(path, body);
  chmodSync(path, 0o755);
  return path;
}

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), "d2-slides-"));
  okStub = writeStub(
    join(workspace, "d2-ok"),
    '#!/bin/sh\ncat >/dev/null\nprintf \'%s\' \'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="100" height="60" viewBox="0 0 100 60"><rect width="100" height="60" fill="#eef"/></svg>\'\n',
  );
  // stderr and a non-zero exit, the way `d2` reports a file it cannot compile.
  failStub = writeStub(
    join(workspace, "d2-fail"),
    '#!/bin/sh\ncat >/dev/null\necho "err: reserved keywords are prohibited in edges" >&2\nexit 1\n',
  );
});

let nth = 0;
/** Build `markdown` as a deck; returns the process result plus the output directory. */
function build(markdown, { d2 = okStub, args = [] } = {}) {
  const dir = join(workspace, `case-${(nth += 1)}`);
  mkdirSync(dir, { recursive: true });
  const deck = join(dir, "deck.md");
  writeFileSync(deck, markdown);
  const out = join(dir, "built");
  const result = spawnSync(process.execPath, [BUILDER, deck, "--out", out, ...args], {
    encoding: "utf8",
    env: { ...process.env, D2: d2 },
  });
  return { ...result, out, read: (name) => readFileSync(join(out, name), "utf8") };
}

/** The `<section class="slide …">` rows: slide count, layout per slide, order, titles. */
function structure(html) {
  return [...html.matchAll(/<section class="slide ([a-z-]+)" data-index="(\d+)" aria-label="([^"]*)"/g)].map(
    (m) => `${m[2]} ${m[1]} ${m[3]}`,
  );
}

const DECK = `---
title: A deck
subtitle: built by a test
---

# A deck

---

## A slide with both

- a bullet with \`code\` and **bold**
- a second bullet

\`\`\`d2
a -> b
\`\`\`

<!-- notes: said out loud, never on screen -->

---

\`\`\`d2
direction: right
c -> d
\`\`\`
`;

describe("d2-slides: build-deck", () => {
  it("writes the deck, the print view, the manifest and one SVG per figure", () => {
    const r = build(DECK);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /3 slides, 2 figure\(s\) laid out by tala, 4 copy lines/);
    const index = r.read("index.html");
    assert.match(index, /<body>/);
    assert.doesNotMatch(index, /<body class="print">/);
    // The print view is the same content stacked — the only form in which a page gate
    // reads every slide, since the deck shows one at a time.
    assert.match(r.read("print.html"), /<body class="print">/);
    for (const name of ["slide-02.svg", "slide-03.svg"]) {
      assert.match(r.read(name), /^<\?xml version="1\.0" encoding="utf-8"\?>\n<svg /);
      // The stage sizes a figure; a width/height on the element would fight it.
      assert.doesNotMatch(r.read(name), /<svg[^>]*\s(?:width|height)=/);
    }
  });

  it("chooses the layout from the slide's content", () => {
    assert.deepEqual(structure(build(DECK).read("index.html")), [
      "0 title A deck",
      "1 split A slide with both",
      "2 figure-only A deck",
    ]);
  });

  it("does not split a slide on a `---` inside a fence", () => {
    const r = build(`## One slide

\`\`\`d2
a -> b
---
c -> d
\`\`\`

- still the same slide
`);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /1 slides, 1 figure\(s\)/);
  });

  it("takes the manifest from the rendered text, not from the Markdown with its markers stripped", () => {
    const r = build(`## Heading

- a bullet with \`code\` and **bold**
- a <div> & an "attribute"
`);
    assert.equal(r.status, 0, r.stderr);
    // What the DOM will hold: markers gone, entities decoded, the words intact. A
    // manifest built by stripping Markdown instead reported lines the page never says.
    assert.equal(
      r.read("copy.txt"),
      'Heading\na bullet with code and bold\na <div> & an "attribute"\n',
    );
  });

  /**
   * Writer e, d2-slides v1, grepping its own deck for a string the brief
   * required: `sed -n '15,22p' built/copy.txt` showed "…D2 creates a new" /
   * "The fix is always a full path from the root" / "shape, so the picture…".
   * A bullet wrapped at 80 columns had become a PARAGRAPH, and paragraphs
   * render before the list, so the continuation appeared above its own bullet
   * and split one sentence across two manifest lines. All four page gates
   * passed: every fragment was visible somewhere on the slide.
   */
  it("rejoins a bullet wrapped over several lines instead of making it a paragraph", () => {
    const r = build(`## Wrapping

- A reference to an id not in scope does not error — D2 creates a new
  shape, so the picture silently gains boxes.
- The fix is always a full path from the root.
`);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(
      r.read("copy.txt"),
      "Wrapping\n"
        + "A reference to an id not in scope does not error — D2 creates a new shape, so the picture silently gains boxes.\n"
        + "The fix is always a full path from the root.\n",
    );
    const index = r.read("index.html");
    // No stray paragraph, and the two bullets in the order they were written.
    assert.doesNotMatch(index, /<p>shape, so the picture/);
    assert.match(
      index,
      /<li>A reference to an id not in scope does not error — D2 creates a new shape, so the picture silently gains boxes\.<\/li><li>The fix is always a full path from the root\.<\/li>/,
    );
  });

  it("rejoins a wrapped paragraph and a wrapped quote, and a blank line ends the block", () => {
    const r = build(`## Wrapping everything

A paragraph that runs
over two lines.

> a quote that also
> wraps

- and a bullet

  which continues after a blank line, so it is a paragraph of its own
`);
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(r.read("copy.txt").trim().split("\n"), [
      "Wrapping everything",
      "and a bullet",
      "a quote that also wraps",
      "A paragraph that runs over two lines.",
      "which continues after a blank line, so it is a paragraph of its own",
    ]);
  });

  it("keeps speaker notes off the slide and out of the manifest", () => {
    const r = build(`## Heading

- a bullet

<!-- notes: only the presenter hears this -->
`);
    assert.equal(r.status, 0, r.stderr);
    assert.doesNotMatch(r.read("copy.txt"), /presenter/);
    assert.match(r.read("index.html"), /<aside class="notes"><p>only the presenter hears this<\/p><\/aside>/);
    assert.match(r.read("index.html"), /\.notes \{ display: none; \}/);
  });

  it("warns, naming the slide, when the prose is past the frame's budget", () => {
    const long = "word ".repeat(120).trim(); // ~600 chars
    const beside = build(`## Beside a figure

- ${long}

\`\`\`d2
a -> b
\`\`\`
`);
    assert.equal(beside.status, 0, beside.stderr);
    assert.match(beside.stderr, /⚠ slide 1 \(Beside a figure\): \d+ characters of prose beside a figure/);
    assert.match(beside.stderr, /the frame holds about 430/);

    // The same prose without a figure has the whole stage, and must not warn.
    const alone = build(`## On its own\n\n- ${long}\n`);
    assert.equal(alone.status, 0, alone.stderr);
    assert.equal(alone.stderr.trim(), "");
  });

  it("fails on a figure that does not compile, naming the slide and passing d2's own message on", () => {
    const r = build(DECK, { d2: failStub });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /✗ slide 2-1: the d2 figure does not compile/);
    assert.match(r.stderr, /reserved keywords are prohibited in edges/);
  });

  it("fails on a file with no slides rather than writing an empty deck", () => {
    const r = build("---\ntitle: nothing else\n---\n");
    assert.equal(r.status, 1);
    assert.match(r.stderr, /✗ no slides found/);
  });

  // The staleness gate. `pnpm deck:example` regenerates the committed build.
  it("keeps the committed example build in sync with its deck", () => {
    const fresh = build(readFileSync(EXAMPLE, "utf8"));
    assert.equal(fresh.status, 0, fresh.stderr);
    assert.equal(fresh.stderr.trim(), "", "the committed example must build without an overflow warning");

    const committed = (name) => readFileSync(join(COMMITTED, name), "utf8");
    assert.equal(
      fresh.read("copy.txt"),
      committed("copy.txt"),
      "examples/d2-slides/deck.md changed without rebuilding built/ — run `pnpm deck:example`",
    );
    assert.deepEqual(
      structure(fresh.read("index.html")),
      structure(committed("index.html")),
      "the example's slide count / layouts / titles no longer match its committed build — run `pnpm deck:example`",
    );
  });
});
