#!/usr/bin/env node
/**
 * deck-review — hand a slide to a reader, then score what they read back.
 *
 *   node deck-review.mjs built --out review              # shoot the slides + write the brief
 *   node deck-review.mjs built --answers answers.json    # score a reading
 *   node deck-review.mjs old-build --answers a.json --sheet new-build/slides.json
 *
 * Why this exists. Every other check in the `d2-slides` loop reads the page or
 * the figure's geometry: `check integrity` measures boxes, `check copy` looks
 * each manifest line up as a SET, `d2-facts` reads the SVG's ids. Two defects
 * still reached a delivered deck in the v1/v2 validation rounds — a sentence
 * split across two blocks, and a fragment rendered above its own bullet — and
 * both were *visible on the slide* while every gate passed, because every gate
 * was blind to reading order. A reader is the measurement that is not.
 *
 * The reader can be a vision model or an agent looking at the PNGs; either way
 * its answer is JSON and the scoring is deterministic, against the
 * `slides.json` the build already writes:
 *
 *   { "slides": [ { "index": 0, "lines": ["read this", "then this"],
 *                   "issues": [ { "kind": "split", "what": "…" } ] } ] }
 *
 * Issue kinds: `split` (one sentence broken across two blocks), `out-of-order`
 * (text above what it belongs to), `clipped`, `overlap`, `illegible`, `other`.
 *
 * Scoring, in the vocabulary `vlmkit-anim review` uses for a still figure:
 *   read      a sheet line the reader read (matched loosely — see `near`)
 *   missed    a sheet line no read line covers
 *   invented  a read line no sheet line covers
 *   fidelity  read / (sheet lines + invented) — 1.0 is "the slide, nothing more"
 *   order     Kendall-ish: pairs of read lines whose order disagrees with the sheet
 *
 * Playwright is required for the shooting half (`--out`); the scoring half is
 * dependency-free, so a reading can be re-scored anywhere.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  if (i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--")) return argv[i + 1];
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  return eq ? eq.slice(name.length + 3) : fallback;
};
const positional = [];
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a.startsWith("--")) {
    if (!a.includes("=") && argv[i + 1] && !argv[i + 1].startsWith("--")) i += 1;
    continue;
  }
  positional.push(a);
}
const builtDir = positional[0];
if (!builtDir) {
  console.error(
    "usage: deck-review.mjs <built-dir> --out <dir>        # shoot the slides and write the brief\n" +
      "       deck-review.mjs <built-dir> --answers <json>  # score a reading",
  );
  process.exit(2);
}
const outDir = flag("out");
const answersPath = flag("answers");
const width = Number(flag("width", "1280"));
if (!outDir && !answersPath) {
  console.error("deck-review: pass --out to shoot the slides, or --answers to score a reading");
  process.exit(2);
}

// `--sheet` scores one render against ANOTHER build's sheet. That is the A/B
// primitive: the sheet says what the deck should say, so two renders of the
// same `deck.md` — before and after a builder change — are comparable against
// one ground truth, and a render from a builder too old to write a sheet is
// still scorable.
const sheetPath = flag("sheet", join(builtDir, "slides.json"));
let sheet;
try {
  sheet = JSON.parse(readFileSync(sheetPath, "utf8"));
} catch (error) {
  console.error(`✗ ${sheetPath} is not readable: ${error.message}`);
  console.error("  It is written by build-deck.mjs — rebuild the deck with a current builder.");
  process.exit(1);
}

/* ---------- normalise, and decide when two lines are the same line ---------- */

const norm = (s) =>
  s
    .toLowerCase()
    .replace(/[‘’“”]/g, "'")
    .replace(/[—–]/g, "-")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * A reader retypes a slide; it does not transcribe it. So a line counts as read
 * when most of its words are there, in one of the reader's lines — deliberately
 * generous, because the round is about ORDER and COMPLETENESS, not about
 * whether a reader kept a comma. The one thing generosity must not hide is a
 * SPLIT: half a sentence matching at 0.5 has to stay unread, or the defect this
 * tool exists to find would score as a pass.
 */
const COVER = 0.7;
const coverage = (want, got) => {
  const w = norm(want).split(" ").filter((x) => x.length > 2);
  if (!w.length) return norm(want) && norm(got).includes(norm(want)) ? 1 : 0;
  const g = norm(got);
  return w.filter((word) => g.includes(word)).length / w.length;
};

/* ---------- shoot ---------- */

async function shoot() {
  const { chromium } = await import("playwright");
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height: Math.round((width * 9) / 16) } });
  const files = [];
  const url = `file://${resolve(join(builtDir, "index.html"))}`;
  for (const s of sheet.slides) {
    // The deck's own navigation, not a hand-rolled one: `#/N` is what a viewer
    // links, so a shot taken through it is the slide a viewer sees.
    await page.goto(`${url}#/${s.index + 1}`, { waitUntil: "load" });
    await page.waitForFunction(
      (i) => document.querySelector(`.slide[data-index="${i}"]`)?.classList.contains("active"),
      s.index,
    );
    const name = `slide-${String(s.index + 1).padStart(2, "0")}.png`;
    await page.locator(`.slide[data-index="${s.index}"]`).screenshot({ path: join(outDir, name) });
    files.push(name);
  }
  await browser.close();

  const brief = [
    `# Read these slides back`,
    ``,
    `${files.length} PNG(s) in this directory, one per slide, in order. Look at each one and`,
    `write down what it says — you are a reader, not a spell-checker.`,
    ``,
    `Answer as JSON, and nothing else:`,
    ``,
    "```json",
    `{ "slides": [ { "index": 0, "lines": ["the first line you read", "the next one"], "issues": [] } ] }`,
    "```",
    ``,
    `- \`index\` is the slide's number minus one, matching the file name.`,
    `- \`lines\`: every piece of text you can read on the slide, **in the order you`,
    `  meet it reading top to bottom, left to right**. Order is the point of this`,
    `  exercise — do not tidy it. Transcribe what is there, including a line that`,
    `  looks like it is in the wrong place. Skip the footer (deck title, page number).`,
    `- \`issues\`: anything wrong with the slide AS A SLIDE, each as`,
    `  \`{ "kind": …, "what": … }\`. Kinds: \`split\` (one sentence broken across two`,
    `  separate blocks of text), \`out-of-order\` (text sitting above or before what it`,
    `  belongs to), \`clipped\` (cut off by an edge), \`overlap\` (text on top of text),`,
    `  \`illegible\` (too small or too crowded to read), \`other\`. Say what and where.`,
    `  An empty list is a fine answer for a slide that reads cleanly.`,
    ``,
    `Do not read the deck's source, its \`copy.txt\`, its \`slides.json\` or any other`,
    `file in the build: the whole measurement is what the PICTURE says.`,
    ``,
    `## Files`,
    ``,
    ...files.map((f) => `- ${f}`),
    ``,
  ].join("\n");
  writeFileSync(join(outDir, "review-brief.md"), brief);
  console.log(`✓ ${files.length} slide(s) → ${outDir}`);
  console.log(`  brief: ${join(outDir, "review-brief.md")}`);
  console.log(`  score a reading: node deck-review.mjs ${builtDir} --answers <answers.json>`);
}

/* ---------- score ---------- */

function score() {
  const answers = JSON.parse(readFileSync(answersPath, "utf8"));
  if (!Array.isArray(answers.slides)) {
    console.error('✗ answers need {"slides": [{"index": 0, "lines": [...]}]}');
    process.exit(2);
  }
  const byIndex = new Map(answers.slides.map((s) => [s.index, s]));
  const rows = [];
  let totals = { want: 0, read: 0, invented: 0, swapped: 0, pairs: 0 };

  for (const want of sheet.slides) {
    const got = byIndex.get(want.index);
    const readLines = (got?.lines ?? []).map((l) => String(l));
    const issues = got?.issues ?? [];
    const hit = new Map(); // sheet line index → first reader line index that covers it
    const usedBy = new Map(); // reader line index → sheet line index
    want.lines.forEach((line, wi) => {
      for (let ri = 0; ri < readLines.length; ri += 1) {
        if (usedBy.has(ri)) continue;
        if (coverage(line, readLines[ri]) >= COVER) {
          hit.set(wi, ri);
          usedBy.set(ri, wi);
          return;
        }
      }
    });
    const missed = want.lines.filter((_, wi) => !hit.has(wi));
    // A reader line that matched no prose line may still be on the slide: the
    // figure's own box labels are words too, and a reader reads them. They are
    // counted separately — as the only record of whether a label was legible at
    // slide size — so that reading the figure cannot look like inventing text.
    const figureWords = want.figureText ?? [];
    const leftover = readLines.filter((_, ri) => !usedBy.has(ri));
    const figureRead = [];
    const invented = [];
    for (const line of leftover) {
      if (figureWords.some((w) => coverage(w, line) >= COVER || coverage(line, w) >= COVER)) figureRead.push(line);
      else invented.push(line);
    }
    // Order: every pair of sheet lines both read, counted as agreeing or not.
    const order = [...hit.entries()].sort((a, b) => a[0] - b[0]).map(([, ri]) => ri);
    let swapped = 0;
    let pairs = 0;
    for (let i = 0; i < order.length; i += 1) {
      for (let j = i + 1; j < order.length; j += 1) {
        pairs += 1;
        if (order[i] > order[j]) swapped += 1;
      }
    }
    /**
     * The diagnosis the reader does not have to make.
     *
     * A missed sheet line whose words are all present ACROSS two or more
     * invented lines is not missing copy — it is one sentence rendered as two
     * blocks. Both v3 readers of the broken arm saw it; only the larger one
     * named it, the other called it "clipped at the right edge" (right slide,
     * wrong mechanism). So the scorer says it: the reader supplies the reading,
     * this supplies the word for what the reading shows.
     */
    const splits = [];
    for (const line of missed) {
      const parts = invented.filter((i) => coverage(i, line) >= 0.5 || coverage(line, i) > 0);
      if (parts.length < 2) continue;
      if (coverage(line, parts.join(" ")) >= COVER) splits.push({ line, parts });
    }
    rows.push({
      index: want.index,
      heading: want.heading ?? `slide ${want.index + 1}`,
      splits,
      want: want.lines.length,
      read: hit.size,
      missed,
      invented,
      figureRead: figureRead.length,
      figureWords: figureWords.length,
      swapped,
      pairs,
      issues,
      answered: got !== undefined,
    });
    totals = {
      want: totals.want + want.lines.length,
      read: totals.read + hit.size,
      invented: totals.invented + invented.length,
      figureRead: (totals.figureRead ?? 0) + figureRead.length,
      figureWords: (totals.figureWords ?? 0) + figureWords.length,
      swapped: totals.swapped + swapped,
      pairs: totals.pairs + pairs,
    };
  }

  const fidelity = totals.want + totals.invented === 0 ? 1 : totals.read / (totals.want + totals.invented);
  const orderScore = totals.pairs === 0 ? 1 : 1 - totals.swapped / totals.pairs;
  const unanswered = rows.filter((r) => !r.answered).map((r) => r.index + 1);

  console.log(`deck: ${sheet.title || basename(builtDir)} — ${sheet.slides.length} slide(s), reading by ${basename(answersPath)}`);
  console.log("");
  for (const r of rows) {
    const flags = [];
    if (r.missed.length) flags.push(`${r.missed.length} missed`);
    if (r.splits.length) flags.push(`${r.splits.length} SPLIT`);
    if (r.invented.length) flags.push(`${r.invented.length} invented`);
    if (r.figureRead) flags.push(`${r.figureRead} figure label(s) read`);
    if (r.swapped) flags.push(`${r.swapped}/${r.pairs} pairs out of order`);
    if (r.issues.length) flags.push(`${r.issues.length} issue(s) reported`);
    console.log(
      `slide ${String(r.index + 1).padStart(2)}  ${r.read}/${r.want} read` +
        (flags.length ? `  — ${flags.join(", ")}` : "  — clean") +
        (r.answered ? "" : "  (NOT ANSWERED)"),
    );
    for (const m of r.missed) {
      const split = r.splits.find((s) => s.line === m);
      if (split) {
        console.log(`    ⚠ SPLIT:    "${m}"`);
        console.log(`      every word is on the slide, the sentence is not — read back as ${split.parts.length} blocks:`);
        for (const part of split.parts) console.log(`        · "${part}"`);
      } else {
        console.log(`    ✗ missed:   "${m}"`);
      }
    }
    for (const i of r.invented) console.log(`    ? invented: "${i}"`);
    for (const i of r.issues) console.log(`    ! ${i.kind}: ${i.what}`);
  }
  console.log("");
  console.log(
    `read ${totals.read}/${totals.want}, invented ${totals.invented}, ` +
      `fidelity ${fidelity.toFixed(2)}, order ${orderScore.toFixed(2)} (${totals.swapped}/${totals.pairs} pairs swapped)`,
  );
  if (totals.figureWords) {
    console.log(
      `figures: ${totals.figureRead} label(s) read of ${totals.figureWords} drawn` +
        " — a reader that transcribes none of them is not evidence they are illegible, only that it read prose",
    );
  }
  if (unanswered.length) console.log(`slides the reader did not answer: ${unanswered.join(", ")}`);
  const splitCount = rows.reduce((n, r) => n + r.splits.length, 0);
  if (splitCount) {
    console.log(
      `${splitCount} sentence(s) rendered as two or more blocks — the defect no page gate sees,` +
        " because every fragment is visible text and nothing overflows",
    );
  }
  const reported = rows.reduce((n, r) => n + r.issues.length, 0);
  if (reported) console.log(`reader reported ${reported} issue(s) — read them above; none of them is in any gate`);
  // A reading is a measurement, not a gate: it exits 0 and the numbers are the
  // output. What to do about a 0.6 fidelity is the deck author's call.
  process.exit(0);
}

if (outDir) await shoot();
if (answersPath) score();
