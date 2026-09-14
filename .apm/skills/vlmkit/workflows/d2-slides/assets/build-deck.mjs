#!/usr/bin/env node
/**
 * build-deck — a slide deck from one Markdown file, its figures laid out by TALA.
 *
 *   node build-deck.mjs deck.md --out dist
 *   node build-deck.mjs deck.md --out dist --theme 3 --pad 16 --layout tala
 *
 * The deck is text: prose in Markdown, every figure a ```d2 fence rendered by
 * `d2 --layout=tala`. The output is ONE self-contained HTML file (inline SVG,
 * inline CSS and script, no network) plus each figure as its own `.svg` and a
 * `copy.txt` manifest of every word on the slides — which is what makes the
 * deck checkable: it is a page, so vlmkit's own gates read it.
 *
 * Deck format
 * -----------
 *   ---
 *   title: What TALA changed
 *   subtitle: three rounds, measured
 *   author: …            (optional)
 *   date: 2026-09-14     (optional)
 *   ---
 *
 *   # What TALA changed            ← a slide whose only content is a heading is a title slide
 *
 *   ---
 *
 *   ## The loop                    ← every other `#`/`##` is that slide's heading
 *
 *   - write the `.d2`              ← bullets
 *   - read it in the terminal
 *
 *   ```d2                          ← a figure, rendered with --layout=tala
 *   direction: right
 *   write -> check -> facts
 *   ```
 *
 *   <!-- notes: what to say out loud -->   ← speaker notes; printed, never on screen
 *
 * A slide with both bullets and a figure is laid out side by side; a slide with
 * only a figure gives it the whole stage. `> quote` becomes a pull quote and a
 * fenced block in any other language stays code.
 *
 * Keys in the deck: → ← space for next / previous, Home / End, `o` for the
 * overview grid, `p` for the print view (one slide per page), `f` fullscreen.
 * The URL carries `#/4`, so a slide can be linked.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

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
const source = positional[0];
if (!source) {
  console.error("usage: build-deck.mjs deck.md --out dist [--theme 0] [--pad 20] [--layout tala]");
  process.exit(2);
}
const outDir = resolve(flag("out", "dist"));
const layout = flag("layout", "tala");
const theme = flag("theme", "0");
const pad = flag("pad", "20");
const d2 = process.env.D2 || "d2";

/* ---------- read the deck ---------- */

const text = readFileSync(source, "utf8").replace(/\r\n/g, "\n");
let meta = {};
let body = text;
const front = text.match(/^---\n([\s\S]*?)\n---\n/);
if (front) {
  for (const line of front[1].split("\n")) {
    const m = line.match(/^([a-z][a-z0-9-]*):\s*(.*)$/i);
    if (m) meta[m[1].toLowerCase()] = m[2].trim();
  }
  body = text.slice(front[0].length);
}

// Slides split on a line that is exactly `---`. A `---` inside a fence is not a separator.
const slides = [];
let current = [];
let inFence = false;
for (const line of body.split("\n")) {
  if (/^```/.test(line)) inFence = !inFence;
  if (!inFence && /^---\s*$/.test(line)) {
    slides.push(current);
    current = [];
    continue;
  }
  current.push(line);
}
slides.push(current);

/* ---------- parse one slide ---------- */

const escape = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// `code`, **bold**, *italic* — the only inline markup a slide needs.
const inline = (s) =>
  escape(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\s)\*([^*]+)\*/g, "$1<em>$2</em>");

function parseSlide(lines) {
  const slide = { heading: null, level: 2, bullets: [], figures: [], code: [], quotes: [], notes: [], paras: [] };
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fence = line.match(/^```(\S*)\s*$/);
    if (fence) {
      const lang = fence[1];
      const block = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) block.push(lines[i++]);
      if (lang === "d2") slide.figures.push(block.join("\n"));
      else slide.code.push({ lang, text: block.join("\n") });
      continue;
    }
    const note = line.match(/^<!--\s*notes?:\s*([\s\S]*?)\s*-->\s*$/);
    if (note) {
      slide.notes.push(note[1]);
      continue;
    }
    const head = line.match(/^(#{1,3})\s+(.*)$/);
    if (head && !slide.heading) {
      slide.level = head[1].length;
      slide.heading = head[2].trim();
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      slide.bullets.push(bullet[1].trim());
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      slide.quotes.push(quote[1].trim());
      continue;
    }
    if (line.trim()) slide.paras.push(line.trim());
  }
  return slide;
}

/* ---------- render the figures ---------- */

function renderFigure(d2Source, salt) {
  let svg;
  try {
    svg = execFileSync(
      d2,
      [`--layout=${layout}`, `--theme=${theme}`, `--pad=${pad}`, `--salt=s${salt}`, "-", "-", "--stdout-format", "svg"],
      { input: d2Source, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
    );
  } catch (error) {
    const detail = String(error.stderr || error.message).trim();
    console.error(`✗ slide ${salt}: the d2 figure does not compile\n${detail}`);
    process.exit(1);
  }
  return (
    svg
      .replace(/<\?xml[^>]*\?>/, "")
      // The stage sizes the figure; a fixed width/height would fight it. The viewBox stays,
      // so the aspect ratio is the layout's.
      .replace(/(<svg[^>]*?)\swidth="[^"]*"/, "$1")
      .replace(/(<svg[^>]*?)\sheight="[^"]*"/, "$1")
      .replace(/<svg /, '<svg class="figure" ')
      .trim()
  );
}

/* ---------- build ---------- */

mkdirSync(outDir, { recursive: true });
const copy = [];
const built = [];
slides.forEach((lines, index) => {
  const slide = parseSlide(lines);
  if (!slide.heading && !slide.bullets.length && !slide.figures.length && !slide.paras.length && !slide.quotes.length && !slide.code.length)
    return;
  const svgs = slide.figures.map((fig, n) => {
    const svg = renderFigure(fig, `${index + 1}-${n + 1}`);
    const name = `slide-${String(built.length + 1).padStart(2, "0")}${slide.figures.length > 1 ? `-${n + 1}` : ""}.svg`;
    writeFileSync(join(outDir, name), `<?xml version="1.0" encoding="utf-8"?>\n${svg.replace(' class="figure"', "")}\n`);
    return { svg, name, source: fig };
  });
  built.push({ ...slide, svgs, index: built.length });
});

// A frame does not grow, so too much prose is cut. There is no browser here to measure with, so
// this is a character budget: roughly 38 characters a line in the split layout's column and 13
// lines of room under a heading. The gates measure it properly; this says it before they run.
const budget = (s) => (s.svgs.length ? 430 : 900);
for (const s of built) {
  const chars = [...s.bullets, ...s.paras, ...s.quotes].join(" ").length;
  if (chars > budget(s))
    console.warn(
      `⚠ slide ${s.index + 1} (${(s.heading || "untitled").slice(0, 40)}): ${chars} characters of prose` +
        `${s.svgs.length ? " beside a figure" : ""} — the frame holds about ${budget(s)}; the rest is cut, and` +
        " the copy gate reports the cut lines as copy a user cannot see",
    );
}

if (!built.length) {
  console.error("✗ no slides found: a deck is Markdown with slides separated by a line of `---`");
  process.exit(1);
}

const titleOf = (s) => s.heading || meta.title || "";
// The manifest has to be what the DOM will hold, so it is taken from the rendered markup rather
// than from the Markdown with its markers stripped: `a ```d2 fence` renders as one thing and
// strips to another, and the copy gate reported the difference as a missing line.
const rendered = (s) =>
  inline(s)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
for (const s of built) {
  if (s.heading) copy.push(rendered(s.heading));
  for (const b of s.bullets) copy.push(rendered(b));
  for (const q of s.quotes) copy.push(rendered(q));
  for (const p of s.paras) copy.push(rendered(p));
}

const slideHtml = (s) => {
  const kind =
    s.figures.length && !s.bullets.length && !s.paras.length && !s.quotes.length
      ? "figure-only"
      : s.figures.length
        ? "split"
        : s.level === 1
          ? "title"
          : "text";
  const parts = [];
  if (s.heading) parts.push(`<h${s.level === 1 ? 1 : 2}>${inline(s.heading)}</h${s.level === 1 ? 1 : 2}>`);
  if (s.level === 1 && meta.subtitle && s.index === 0) parts.push(`<p class="subtitle">${inline(meta.subtitle)}</p>`);
  const prose = [];
  for (const p of s.paras) prose.push(`<p>${inline(p)}</p>`);
  if (s.bullets.length) prose.push(`<ul>${s.bullets.map((b) => `<li>${inline(b)}</li>`).join("")}</ul>`);
  for (const q of s.quotes) prose.push(`<blockquote>${inline(q)}</blockquote>`);
  for (const c of s.code) prose.push(`<pre><code>${escape(c.text)}</code></pre>`);
  const figures = s.svgs.map((f) => `<div class="fig">${f.svg}</div>`).join("");
  if (kind === "split") parts.push(`<div class="cols"><div class="prose">${prose.join("")}</div><div class="figs">${figures}</div></div>`);
  else if (kind === "figure-only") parts.push(`<div class="figs full">${figures}</div>`);
  else parts.push(`<div class="prose">${prose.join("")}</div>`);
  const notes = s.notes.length ? `<aside class="notes">${s.notes.map((n) => `<p>${inline(n)}</p>`).join("")}</aside>` : "";
  return `<section class="slide ${kind}" data-index="${s.index}" aria-label="${escape(titleOf(s))}">
  <div class="body">${parts.join("\n  ")}</div>
  <footer><span class="deck-title">${escape(meta.title || "")}</span><span class="page">${s.index + 1} / ${built.length}</span></footer>
  ${notes}
</section>`;
};

const html = `<!doctype html>
<html lang="${meta.lang || "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(meta.title || basename(source))}</title>
<style>
:root {
  --ink: #14181f; --muted: #5b6472; --line: #d6dbe4; --bg: #ffffff; --stage: #ffffff;
  --accent: #0d32b2; --code: #f4f6fa;
  --stage-w: 1280px; --stage-h: 720px;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: #0d1117; color: var(--ink); }
body { font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans JP", sans-serif; overflow: hidden; }
#deck { position: fixed; inset: 0; }
.slide {
  width: var(--stage-w); height: var(--stage-h); background: var(--stage); color: var(--ink);
  display: none; padding: 64px 72px 56px;
  /* Centred by transform, not by the layout box: a 1280px stage is wider than a phone, and
     centring an over-sized grid item leaves the middle off-screen. The integrity gate caught
     that at 375px as "the DOM holds 4 text blocks but almost nothing painted". */
  position: absolute; left: 50%; top: 50%; transform-origin: center center;
  /* A slide is a fixed frame, so content that does not fit is CUT rather than spilling over the
     next slide — which is what makes overflow detectable: the integrity gate reads it as clipped
     text, and the copy gate reads the cut line as copy it cannot see. */
  overflow: hidden;
}
.slide.active { display: flex; flex-direction: column; }
/* The frame is a flex column and the body is the flexible child: a percentage height inside a
   padded, fixed box was 114px out on every slide, which the integrity gate reported as clipped
   content on slides whose text was well inside the frame. */
.slide .body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 20px; }
h1 { font-size: 58px; line-height: 1.1; margin: 0; letter-spacing: -0.02em; }
h2 { font-size: 38px; line-height: 1.15; margin: 0; letter-spacing: -0.01em; }
h2::after { content: ""; display: block; width: 56px; height: 4px; background: var(--accent); margin-top: 16px; }
.subtitle { font-size: 26px; color: var(--muted); margin: 0; }
.slide.title .body { justify-content: center; }
ul { margin: 0; padding-left: 26px; }
li { font-size: 25px; margin: 0 0 14px; }
li code, p code { background: var(--code); padding: 1px 6px; border-radius: 4px; font-size: 0.9em; }
p { font-size: 25px; margin: 0 0 10px; }
blockquote { margin: 0; padding-left: 20px; border-left: 4px solid var(--accent); font-size: 24px; color: var(--muted); }
pre { background: var(--code); padding: 14px 18px; border-radius: 8px; overflow: auto; margin: 0; }
pre code { font: 18px/1.45 ui-monospace, "SF Mono", Menlo, monospace; }
/* align-items is start, not center: prose taller than the frame then overflows DOWNWARD, where
   the clip is measurable, instead of being cut off at both ends. Centred, a long bullet list is
   silently trimmed top and bottom — the copy gate reads those lines as copy a user cannot see. */
.cols { flex: 1; display: grid; grid-template-columns: 1fr 1.1fr; gap: 40px; align-items: start; min-height: 0; height: 100%; }
.prose { min-height: 0; }
.figs { display: flex; flex-direction: column; gap: 16px; justify-content: center; align-items: center; min-height: 0; height: 100%; }
.figs.full { flex: 1; }
.fig { display: flex; min-height: 0; width: 100%; height: 100%; justify-content: center; align-items: center; }
svg.figure { max-width: 100%; max-height: 100%; height: auto; width: auto; }
footer {
  position: absolute; left: 72px; right: 72px; bottom: 22px; display: flex; justify-content: space-between;
  font-size: 15px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 10px;
}
.notes { display: none; }
#progress { position: fixed; left: 0; top: 0; height: 3px; background: var(--accent); transition: width .15s; z-index: 5; }
#overview { position: fixed; inset: 0; background: #0d1117; overflow: auto; padding: 28px; display: none; z-index: 10; }
#overview.on { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; align-content: start; }
#overview .thumb { background: #fff; border-radius: 6px; overflow: hidden; cursor: pointer; position: relative; aspect-ratio: 16 / 9; }
#overview .thumb .slide { display: block; transform: scale(0.234); transform-origin: top left; position: absolute; }
#overview .thumb span { position: absolute; right: 6px; bottom: 4px; font-size: 12px; color: var(--muted); z-index: 2; }
/* Every slide at once: what printing gives, and what a page gate has to read. One slide is on
   screen at a time in the deck, so the copy gate over index.html only ever sees the first one.
   print.html is the same content stacked, and that is the file the copy and contrast gates take. */
body.print { overflow: visible; background: #eef1f6; }
body.print #deck { position: static; }
body.print #progress, body.print #overview { display: none !important; }
body.print .slide {
  display: flex !important; flex-direction: column; position: relative; left: auto; top: auto; transform: none !important;
  margin: 0 auto 24px; box-shadow: 0 1px 4px rgba(20, 24, 31, .18); page-break-after: always; break-after: page;
}
body.print .notes { display: block; margin-top: 18px; border-top: 1px dashed var(--line); padding-top: 10px; font-size: 15px; color: var(--muted); }
@media print {
  html, body { background: #fff; overflow: visible; }
  #deck { position: static; display: block; }
  #progress, #overview { display: none !important; }
  .slide { display: flex !important; flex-direction: column; position: static; left: auto; top: auto; margin: 0; box-shadow: none; page-break-after: always; break-after: page; transform: none !important; }
  .notes { display: block; margin-top: 18px; border-top: 1px dashed var(--line); padding-top: 10px; font-size: 14px; color: var(--muted); }
}
</style>
</head>
<body>
<div id="progress"></div>
<div id="deck">
${built.map(slideHtml).join("\n")}
</div>
<div id="overview" aria-hidden="true"></div>
<script>
(() => {
  const slides = [...document.querySelectorAll("#deck .slide")];
  const deck = document.getElementById("deck");
  const progress = document.getElementById("progress");
  const overview = document.getElementById("overview");
  let at = 0;
  const fit = () => {
    // One fixed 1280x720 stage scaled to the viewport: nothing reflows between screens, so a
    // screenshot of slide N is the same picture on any display.
    const s = Math.min(innerWidth / 1280, innerHeight / 720) * 0.96;
    for (const el of slides) el.style.transform = "translate(-50%, -50%) scale(" + s + ")";
  };
  const show = (n) => {
    at = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach((el, i) => el.classList.toggle("active", i === at));
    progress.style.width = ((at + 1) / slides.length) * 100 + "%";
    if (location.hash !== "#/" + (at + 1)) history.replaceState(null, "", "#/" + (at + 1));
  };
  const buildOverview = () => {
    if (overview.childElementCount) return;
    slides.forEach((el, i) => {
      const thumb = document.createElement("div");
      thumb.className = "thumb";
      const clone = el.cloneNode(true);
      clone.classList.add("active");
      clone.style.transform = "scale(0.234)";
      thumb.append(clone, Object.assign(document.createElement("span"), { textContent: i + 1 }));
      thumb.addEventListener("click", () => { overview.classList.remove("on"); show(i); });
      overview.append(thumb);
    });
  };
  addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { show(at + 1); e.preventDefault(); }
    else if (e.key === "ArrowLeft" || e.key === "PageUp") show(at - 1);
    else if (e.key === "Home") show(0);
    else if (e.key === "End") show(slides.length - 1);
    else if (e.key === "o") { buildOverview(); overview.classList.toggle("on"); }
    else if (e.key === "p") print();
    else if (e.key === "f") document.documentElement.requestFullscreen?.();
    else if (e.key === "Escape") overview.classList.remove("on");
  });
  deck.addEventListener("click", (e) => show(at + (e.clientX < innerWidth / 3 ? -1 : 1)));
  addEventListener("resize", fit);
  addEventListener("hashchange", () => show((parseInt(location.hash.slice(2), 10) || 1) - 1));
  fit();
  show((parseInt(location.hash.slice(2), 10) || 1) - 1);
})();
</script>
</body>
</html>
`;

writeFileSync(join(outDir, "index.html"), html);
// The same deck with every slide stacked and the speaker notes visible: the print view, and the
// only form in which a page gate can read all of the copy.
writeFileSync(join(outDir, "print.html"), html.replace("<body>", '<body class="print">'));
writeFileSync(join(outDir, "copy.txt"), `${copy.join("\n")}\n`);
const figures = built.reduce((n, s) => n + s.svgs.length, 0);
console.log(
  `✓ ${join(outDir, "index.html")}: ${built.length} slides, ${figures} figure(s) laid out by ${layout}, ` +
    `${copy.length} copy lines → ${join(outDir, "copy.txt")}`,
);
console.log(`  the deck:   ${join(outDir, "index.html")}     → vlmkit check integrity`);
console.log(`  all slides: ${join(outDir, "print.html")}     → vlmkit check copy --manifest, check a11y contrast, print to PDF`);
