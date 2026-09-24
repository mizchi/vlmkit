#!/usr/bin/env node
/**
 * Writes `examples/sites/index.html`, the gallery at <https://mizchi.github.io/vlmkit/sites/>:
 * every page the Pages site publishes, each next to the log of how it was judged.
 *
 *   node examples/sites/gallery.mjs
 *
 * Nothing on the page is typed by hand. The list is the Pages manifest (`siteSections` in
 * `scripts/build-pages.mjs`), and every number, title and thumbnail is read out of that section's
 * `judgment.sqlite` — the same summary its log page prints. A gallery of claims about logs would
 * go stale the first time a log grew a round; this one is regenerated, and `sites.test.mjs` fails
 * when the committed page and the logs disagree.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { siteSections } from "../../scripts/build-pages.mjs";
import { keptShots, landing, logPaths, readLog, summarize, tileFile } from "./judge.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
/** Where the gallery itself is published; every link on it is relative to this. */
export const GALLERY_BASE = "sites";

/**
 * Published pages that were judged before the judgment log existed. They get a card, and the card
 * says where their record is instead of inventing numbers for them.
 */
const UNLOGGED = Object.freeze({
  solitaire: Object.freeze({
    title: "Klondike solitaire",
    pattern: "game — drag and drop and animation",
    lang: "en",
    still: { section: "intro", file: "demo-solitaire.png", w: 1024, h: 660 },
    record: "https://github.com/mizchi/vlmkit/tree/main/examples/solitaire#what-the-gates-found",
    note: "Judged before the judgment log existed. Its README's table records which defects the gates, the tests and screenshots found — without the pictures.",
  }),
});

const href = (basePath, file = "") => {
  const rel = posix.relative(GALLERY_BASE, basePath);
  const dir = rel === "" ? "./" : rel.startsWith("..") ? `${rel}/` : `./${rel}/`;
  return `${dir}${file}`.replace(/\/\/$/, "/");
};

function pageLang(sourceDir) {
  const index = join(REPO, sourceDir, "index.html");
  if (!existsSync(index)) return null;
  return /<html[^>]*\blang="([^"]+)"/.exec(readFileSync(index, "utf8"))?.[1] ?? null;
}

/**
 * The picture for a card: the site as a visitor lands on it (judge.mjs's `landing`), as its log
 * last saw it — the last full-page desktop walk the log keeps. Taking simply the last desktop shot
 * put checkout's confirmation screen and the landing page's dark theme on their cards.
 */
function finalStill(events) {
  const kept = keptShots(events);
  const desktop = events.filter((e) => e.kind === "shot" && e.mode === "full" && e.viewport.width >= 1024 && kept.has(e.id));
  const shot = (desktop.some(landing) ? desktop.filter(landing) : desktop.filter((e) => !e.dark)).at(-1);
  return shot ? { file: `judgment/${tileFile(events, shot.tiles[0].file)}`, w: shot.tiles[0].w, h: shot.tiles[0].h } : null;
}

export function galleryEntries(sections = siteSections) {
  const entries = [];
  for (const section of sections) {
    if (section.id === "sites") continue;
    const siteDir = join(REPO, section.sourceDir);
    const logged = existsSync(logPaths(siteDir).db);
    if (logged) {
      const events = readLog(siteDir);
      const s = summarize(events);
      const still = finalStill(events);
      entries.push({
        id: section.id,
        title: s.init?.title ?? section.id,
        pattern: s.init?.pattern ?? "",
        lang: pageLang(section.sourceDir),
        site: href(section.basePath),
        log: href(section.basePath, "judgment/"),
        still: still && { ...still, src: href(section.basePath, still.file) },
        summary: s,
      });
    } else if (UNLOGGED[section.id]) {
      const u = UNLOGGED[section.id];
      const stillSection = sections.find((x) => x.id === u.still.section);
      entries.push({
        id: section.id,
        title: u.title,
        pattern: u.pattern,
        lang: u.lang,
        site: href(section.basePath),
        record: u.record,
        note: u.note,
        still: { ...u.still, src: href(stillSection.basePath, u.still.file) },
        summary: null,
      });
    }
  }
  return entries;
}

const escapeHtml = (text) =>
  String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const LANG_NAME = { en: "English", ja: "Japanese" };

const STYLE = `
:root { color-scheme: light dark; --bg:#f6f5f1; --panel:#ffffff; --ink:#1d1d1b; --muted:#5d5b55; --line:#dcd9d0;
  --eye:#7a3fb0; --gate:#1f5f8b; --accent:#1f5f8b; }
@media (prefers-color-scheme: dark) { :root { --bg:#161614; --panel:#1f1f1c; --ink:#ecebe6; --muted:#a9a69c; --line:#3a3934;
  --eye:#d2a8f5; --gate:#8cc4ea; --accent:#8cc4ea; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif; }
main { max-width: 76rem; margin: 0 auto; padding: 2.5rem 1rem 4rem; }
a { color: inherit; text-underline-offset: 0.15em; }
.kicker { margin: 0 0 0.25rem; color: var(--muted); font-size: 0.9375rem; }
h1 { margin: 0 0 0.75rem; font-size: clamp(1.75rem, 4vw, 2.75rem); line-height: 1.15; max-width: 22ch; }
.lede { margin: 0 0 1.5rem; color: var(--muted); max-width: 44rem; font-size: 1.0625rem; }
.totals { display: flex; flex-wrap: wrap; gap: 0.5rem 1.5rem; margin: 0 0 2.5rem; padding: 0; list-style: none; color: var(--muted); }
.totals b { color: var(--ink); font-size: 1.25rem; margin-right: 0.25rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 21rem), 1fr)); gap: 1.25rem; margin: 0; padding: 0; list-style: none; }
.card { display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
.card img { display: block; width: 100%; height: auto; aspect-ratio: 16 / 10; object-fit: cover; object-position: top; border-bottom: 1px solid var(--line); }
.card .body { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem 1.125rem 1.125rem; flex: 1; }
.card h2 { margin: 0; font-size: 1.1875rem; line-height: 1.3; }
.card h2 a { text-decoration: none; } .card h2 a:hover { text-decoration: underline; }
.pattern { margin: 0; color: var(--muted); font-size: 0.9375rem; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin: 0.25rem 0 0; }
/* Label on top, number at the foot of its cell: when "found by a gate" wraps, the three numbers
   in a row still share a line. */
.stats div { margin: 0; display: flex; flex-direction: column; justify-content: space-between; }
.stats dt { color: var(--muted); font-size: 0.8125rem; } .stats dd { margin: 0; font-size: 1.125rem; font-weight: 650; }
.stats .eye dd { color: var(--eye); } .stats .gate dd { color: var(--gate); }
.note { margin: 0; color: var(--muted); font-size: 0.9375rem; }
.links { display: flex; flex-wrap: wrap; gap: 0 1.25rem; margin: auto 0 0; padding-top: 0.5rem; font-weight: 600; }
/* 44px tall, like every text link on the landing page (AAA), and never broken inside: a link that
   wraps leaves a word alone on its own line. A card's title link is left its own height: it goes
   where "Open the site" goes, which is the 44px target (WCAG's "equivalent" exception), and a
   44px box around a one-line title set it further from its subtitle than a two-line one. */
.links a, .kicker a { display: inline-flex; align-items: center; min-height: 44px; }
/* A ring around the target, clear of its text, in the accent both schemes already carry. */
a:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 2px; }
.links a, footer a { white-space: nowrap; }
/* The Japanese titles carry lang="ja", so they break between phrases, not inside a word. */
:lang(ja) { word-break: auto-phrase; }
.method { margin-top: 3.5rem; max-width: 46rem; }
.method h2 { font-size: 1.375rem; margin: 0 0 0.75rem; }
.method p, .method li { color: var(--muted); }
footer { margin-top: 3rem; color: var(--muted); font-size: 0.875rem; }
`;

export function renderGallery(entries) {
  const logged = entries.filter((e) => e.summary);
  const total = (key) => logged.reduce((n, e) => n + e.summary[key], 0);
  const card = (e) => {
    const img = e.still
      ? `<a href="${e.site}" tabindex="-1" aria-hidden="true"><img src="${e.still.src}" width="${e.still.w}" height="${e.still.h}" alt="" loading="lazy"></a>`
      : "";
    const lang = LANG_NAME[e.lang] ?? e.lang;
    const stats = e.summary
      ? `<dl class="stats"><div><dt>rounds</dt><dd>${e.summary.rounds}</dd></div><div><dt>gate runs</dt><dd>${e.summary.gates}</dd></div><div><dt>screens seen</dt><dd>${e.summary.screens}</dd></div><div class="eye"><dt>found by eye</dt><dd>${e.summary.byEye}</dd></div><div class="gate"><dt>found by a gate</dt><dd>${e.summary.byGate}</dd></div><div><dt>looks</dt><dd>${e.summary.looks}</dd></div></dl>`
      : `<p class="note">${escapeHtml(e.note)}</p>`;
    const record = e.summary
      ? `<a href="${e.log}">How it was judged</a>`
      : `<a href="${e.record}">How it was judged</a>`;
    const titleLang = e.lang && e.lang !== "en" ? ` lang="${escapeHtml(e.lang)}"` : "";
    return `<li class="card">${img}<div class="body"><h2${titleLang}><a href="${e.site}">${escapeHtml(e.title)}</a></h2><p class="pattern">${escapeHtml(e.pattern)}${lang ? ` · ${escapeHtml(lang)}` : ""}</p>${stats}<p class="links"><a href="${e.site}">Open the site</a>${record}</p></div></li>`;
  };
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>vlmkit demo sites</title>
<meta name="description" content="Sites built by agents with vlmkit, each published next to the log of how it was judged.">
<style>${STYLE}</style>
</head>
<body>
<main>
<p class="kicker"><a href="../">vlmkit</a> · demo sites</p>
<h1>Sites built by agents, and how each one was judged</h1>
<p class="lede">Each demo site was built from a one-page brief by an agent using vlmkit's gates and its own eyes, and the landing page was reviewed the same way. Next to each page is its judgment log: every gate run with its whole output, every screenshot that was looked at with what was seen in it, and whether each defect was found by a gate or only by looking.</p>
<ul class="totals"><li><b>${logged.length}</b>logged pages</li><li><b>${total("gates")}</b>gate runs</li><li><b>${total("screens")}</b>screens looked at</li><li><b>${total("byEye")}</b>defects found by eye</li><li><b>${total("byGate")}</b>defects found by a gate</li></ul>
<ul class="grid">${entries.map(card).join("")}</ul>
<section class="method" aria-labelledby="method-title">
<h2 id="method-title">How the logs were kept</h2>
<p>Every log was written by <a href="https://github.com/mizchi/vlmkit/blob/main/examples/sites/judge.mjs">one small tool</a> as the work happened, under <a href="https://github.com/mizchi/vlmkit/blob/main/examples/sites/PROTOCOL.md">one protocol</a>:</p>
<ul>
<li>a gate runs through it, so its exit code and its whole output are kept rather than a summary of them;</li>
<li>a screenshot is taken through it, one screen per image, and a look is recorded against the image it describes; each finished round keeps the pictures of one full-page walk per width, so you can open them and disagree;</li>
<li>a defect must name the look or the gate run that found it, and a fix must be checked by a later look or run before the log can be marked done.</li>
</ul>
</section>
<footer>Generated by <code>examples/sites/gallery.mjs</code> from each page's <code>judgment.sqlite</code>. <a href="./judgment/">How this page was judged</a>.</footer>
</main>
</body>
</html>
`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const out = join(HERE, "index.html");
  writeFileSync(out, renderGallery(galleryEntries()));
  console.log(`wrote ${out}`);
}
