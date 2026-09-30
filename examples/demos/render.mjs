/**
 * The demo gallery as HTML: `index.html` (every demo, by group) and `<id>/index.html` (one demo:
 * the page under test, the command, the screenshots, the whole output). Pure — it reads the
 * manifest and each demo's `result.json` and nothing else, so `demos.test.mjs` can hold the
 * committed pages to a fresh render without a browser.
 *
 *     node examples/demos/render.mjs     # after editing prose in demos.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMOS, GROUPS } from "./demos.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const REPO_URL = "https://github.com/mizchi/vlmkit";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Prose from the manifest: escaped, with `code` spans. */
const prose = (s) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

export function readResult(id, dir = here) {
  const path = join(dir, id, "result.json");
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
}

const head = (title, description, css) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="stylesheet" href="${css}" />
</head>`;

/** The images a demo shows: what its run produced, then any extra that carries a caption. */
export function figuresOf(demo, result) {
  return [
    ...(result?.images ?? []),
    ...(demo.extras ?? []).filter((e) => e.caption).map((e) => ({ file: e.as, caption: e.caption, kind: "evidence" })),
  ];
}

const exitNote = (code) => (code === 0 ? "exit 0" : `exit ${code} — the command fails, as a gate in CI would`);

function figure(img, prefix = "") {
  return `      <figure class="${img.kind === "evidence" ? "evidence" : "shot"}">
        <a href="${prefix}${img.file}"><img src="${prefix}${img.file}"${img.width ? ` width="${img.width}" height="${img.height}"` : ""} alt="${esc(img.caption)}" loading="lazy" /></a>
        <figcaption>${prose(img.caption)}</figcaption>
      </figure>`;
}

export function renderDemo(demo, result, neighbours = {}) {
  const group = GROUPS.find((g) => g.id === demo.group);
  const pageAs = demo.pageAs ?? "page.html";
  const images = figuresOf(demo, result);
  const zoomPair = demo.special === "zoom" && images.length === 3;
  const figures = zoomPair
    ? `${figure(images[0])}\n      <div class="pair">\n${figure(images[1])}\n${figure(images[2])}\n      </div>`
    : images.map((img) => figure(img)).join("\n");
  const commands = demo.special === "zoom"
    ? `import { prepareZoomSource, zoomInto } from "@mizchi/vlmkit-ai/zoom.ts";\n// or the whole loop, with any provider's model:\n// analyzeWithZoom(model, [{ png: baseline, label: "Baseline" }, { png: current, label: "Current" }], "What changed?", { maxZooms: 4 })`
    : [result?.command, result?.thenCommand].filter(Boolean).join("\n");
  const outputs = [
    { cmd: result?.command, out: result?.output, exit: result?.exit },
    ...(result?.thenOutput ? [{ cmd: result.thenCommand, out: result.thenOutput, exit: result.thenExit }] : []),
  ];
  const nav = [
    neighbours.prev ? `<a href="../${neighbours.prev.id}/">← ${esc(neighbours.prev.title)}</a>` : "<span></span>",
    neighbours.next ? `<a href="../${neighbours.next.id}/">${esc(neighbours.next.title)} →</a>` : "<span></span>",
  ].join("\n      ");
  return `${head(`${demo.title} · vlmkit demos`, demo.lead.replace(/`/g, ""), "../demos.css")}
<body>
<header class="bar"><a href="../">vlmkit demos</a><span><img class="icon" src="../../icons/${group.icon}.webp" width="20" height="20" alt="" /> ${esc(group.title)}</span></header>
<main class="demo">
  <p class="command"><code>${esc(demo.command)}</code></p>
  <h1>${esc(demo.title)}</h1>
  <p class="lead">${prose(demo.lead)}</p>
  <p class="links"><a href="./${pageAs}">Open the ${demo.special === "zoom" ? "fixture" : pageAs.endsWith(".json") ? "scene" : "page under test"}</a> · <a href="${REPO_URL}/blob/main/${demo.page}">${esc(demo.page)}</a>${(demo.extras ?? []).map((e) => ` · <a href="./${e.as}">${esc(e.as)}</a>`).join("")}</p>

  <section>
    <h2>Run it</h2>
    <pre class="cmd"><code>${esc(commands)}</code></pre>
  </section>

  <section class="figures">
${figures}
  </section>

  <section>
    <h2>What to look at</h2>
    <p>${prose(demo.look)}</p>
    <h2>The fix</h2>
    <p>${prose(demo.fix)}</p>
  </section>

  <section>
    <h2>${demo.special === "zoom" ? "What the code returned" : "What vlmkit printed"}</h2>
${outputs.map((o) => `    ${o.cmd ? `<p class="exit"><code>${esc(o.cmd)}</code> · ${esc(exitNote(o.exit))}</p>` : ""}\n    <pre class="output">${esc(o.out ?? "(not captured yet — run capture.mjs)")}</pre>`).join("\n")}
${result?.report ? `    <details><summary>The markdown report it wrote</summary><pre class="output">${esc(result.report)}</pre></details>` : ""}
  </section>

  <nav class="pager">
      ${nav}
  </nav>
</main>
<footer class="foot"><a href="../">All demos</a> · <a href="../../">vlmkit</a> · <a href="../../sites/">Demo sites and how each was judged</a> · <a href="${REPO_URL}">GitHub</a></footer>
</body>
</html>
`;
}

export function renderIndex(results) {
  const cards = (group) => DEMOS.filter((d) => d.group === group.id).map((d) => {
    const thumb = figuresOf(d, results[d.id])[0];
    return `      <li class="card">
        <a href="./${d.id}/">
          ${thumb ? `<img src="./${d.id}/${thumb.file}"${thumb.width ? ` width="${thumb.width}" height="${thumb.height}"` : ""} alt="" loading="lazy" />` : ""}
          <span class="command"><code>${esc(d.command)}</code></span>
          <strong>${esc(d.title)}</strong>
        </a>
      </li>`;
  }).join("\n");
  return `${head("vlmkit demos", "Every vlmkit feature on a page with a known defect: the command, the screenshots, and the whole output.", "./demos.css")}
<body>
<header class="bar"><a href="../">vlmkit</a><span>Demos</span></header>
<main class="index">
  <h1>vlmkit, one defect at a time</h1>
  <p class="lead">Each demo is a page with something wrong in it and the command that finds it. The output on every page is what the command printed. The screenshots are from the same run, and the outlines mark only elements the tool itself named. Most pages are the repository's own test fixtures, so the same commands work from a clone.</p>
  <pre class="cmd"><code>npm install -D @mizchi/vlmkit
npx playwright install chromium
npx vlmkit check integrity http://localhost:3000/</code></pre>
${GROUPS.map((g) => `  <section>
    <h2><img class="icon" src="../icons/${g.icon}.webp" width="28" height="28" alt="" /> ${esc(g.title)}</h2>
    <p>${prose(g.blurb)}</p>
    <ul class="cards">
${cards(g)}
    </ul>
  </section>`).join("\n")}
  <p class="more">Whole sites built by agents, each with the log of how it was judged: <a href="../sites/">demo sites</a>. A playable card game used as a drag-and-drop target: <a href="../solitaire/">solitaire</a>.</p>
</main>
<footer class="foot"><a href="../">vlmkit</a> · <a href="${REPO_URL}">GitHub</a> · regenerate with <code>node --experimental-strip-types examples/demos/capture.mjs</code></footer>
</body>
</html>
`;
}

const PAGES = "https://mizchi.github.io/vlmkit/demos/";
export const README_START = "<!-- demos:start — generated by examples/demos/render.mjs -->";
export const README_END = "<!-- demos:end -->";

/**
 * The README's demo table: one row per demo, a thumbnail from its capture, a link to its page.
 * Written into README.md between the markers by `node examples/demos/render.mjs`.
 */
export function renderReadmeBlock(dir = here) {
  const rows = DEMOS.map((d) => {
    const thumb = figuresOf(d, readResult(d.id, dir))[0];
    const img = thumb ? `<a href="${PAGES}${d.id}/"><img src="examples/demos/${d.id}/${thumb.file}" width="220" alt="" /></a>` : "";
    const group = GROUPS.find((g) => g.id === d.group);
    const icon = `<img src="docs/assets/icons/${group.icon}.webp" width="20" height="20" alt="${esc(group.title)}" />`;
    return `| ${img} | ${icon} [${d.title}](${PAGES}${d.id}/) | \`${d.command.replace(/\|/g, "\\|")}\` |`;
  });
  return [
    README_START,
    "| | Demo | Command |",
    "|---|---|---|",
    ...rows,
    README_END,
  ].join("\n");
}

export function writeReadme(readmePath = resolve(here, "../../README.md")) {
  const readme = readFileSync(readmePath, "utf8");
  const a = readme.indexOf(README_START);
  const b = readme.indexOf(README_END);
  if (a < 0 || b < 0) throw new Error(`README.md has no ${README_START} … ${README_END} block`);
  writeFileSync(readmePath, readme.slice(0, a) + renderReadmeBlock() + readme.slice(b + README_END.length));
}

/** Every page of the gallery, by path relative to this directory. */
export function renderGallery(dir = here) {
  const results = Object.fromEntries(DEMOS.map((d) => [d.id, readResult(d.id, dir)]));
  const pages = { "index.html": renderIndex(results) };
  DEMOS.forEach((d, i) => {
    pages[`${d.id}/index.html`] = renderDemo(d, results[d.id], { prev: DEMOS[i - 1], next: DEMOS[i + 1] });
  });
  return pages;
}

export function writeGallery(dir = here) {
  for (const [path, html] of Object.entries(renderGallery(dir))) writeFileSync(join(dir, path), html);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeGallery();
  writeReadme();
}
