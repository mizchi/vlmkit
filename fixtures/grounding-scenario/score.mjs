#!/usr/bin/env node
/**
 * Score one attempt at the grounding scenario.
 *
 * The attempt is a JSON file of `{ "<task-id>": { "x": <n>, "y": <n> } }` in the
 * SCREENSHOT pixel space of `shots/console.png`. Scoring does not compare those
 * numbers to an expected coordinate — an expected coordinate would be a second
 * guess, and there is rarely one right answer. It dispatches the point at the
 * live page and asks the browser which element receives it:
 *
 *   screenshot px --(/ scale)--> CSS px --> document.elementFromPoint
 *
 * A task is HIT when the element that takes the click is the expected one or a
 * descendant of it — the same test `check grounding` runs, which is the same
 * question the browser answers when a real agent sends the click. Anything else
 * is a MISS and the row names what the click would have activated instead, so a
 * report can say "it opened Acme's settings, not Globex's".
 *
 *   node fixtures/grounding-scenario/score.mjs attempts/a/answers.json
 */
import { readFile } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

const answersPath = process.argv[2];
if (!answersPath) {
  console.error("usage: node score.mjs <attempt-answers.json> [--page console] [--json]");
  process.exit(1);
}
const pageName = process.argv.includes("--page")
  ? process.argv[process.argv.indexOf("--page") + 1]
  : "console";
const asJson = process.argv.includes("--json");

const expect = JSON.parse(await readFile(join(HERE, "briefs/answers", `${pageName}.expect.json`), "utf8"));
const answers = JSON.parse(await readFile(resolve(answersPath), "utf8"));

const { chromium } = await import("playwright");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: expect.viewport });
await page.goto(pathToFileURL(join(HERE, "pages", `${pageName}.html`)).href, { waitUntil: "networkidle" });

const rows = [];
for (const task of expect.tasks) {
  const given = answers[task.id];
  if (!given || typeof given.x !== "number" || typeof given.y !== "number") {
    rows.push({ id: task.id, verdict: "NO ANSWER", want: task.selector, got: null });
    continue;
  }
  // The attempt's coordinates are in the screenshot the brief handed over; the
  // page is driven in CSS px. One divide, stated in the brief, so a wrong scale
  // is the attempt's error and not the scorer's.
  const cx = given.x / expect.scale;
  const cy = given.y / expect.scale;
  const hit = await page.evaluate(
    ([x, y, want]) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return { got: null, ok: false };
      const target = document.querySelector(want);
      const describe = (n) => {
        if (!n) return null;
        if (n.id) return `#${n.id}`;
        const cls = n.classList?.length ? `.${[...n.classList].join(".")}` : "";
        const text = (n.innerText || n.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30);
        return `${n.tagName.toLowerCase()}${cls}${text ? ` "${text}"` : ""}`;
      };
      return {
        got: describe(el),
        ok: !!target && (el === target || target.contains(el)),
        outside: x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight,
      };
    },
    [cx, cy, task.selector],
  );
  rows.push({
    id: task.id,
    verdict: hit.outside ? "OFF-SCREEN" : hit.ok ? "HIT" : "MISS",
    want: task.selector,
    got: hit.got,
    at: { x: given.x, y: given.y },
  });
}
await browser.close();

const hits = rows.filter((r) => r.verdict === "HIT").length;
if (asJson) {
  console.log(JSON.stringify({ page: pageName, hits, total: rows.length, rows }, null, 2));
} else {
  const pad = Math.max(...expect.tasks.map((t) => t.id.length));
  for (const r of rows) {
    const mark = r.verdict === "HIT" ? "✓" : "✗";
    const at = r.at ? ` @(${r.at.x},${r.at.y})` : "";
    const got = r.verdict === "HIT" ? "" : `  got ${r.got ?? "nothing"}`;
    console.log(`${mark} ${r.id.padEnd(pad)} ${r.verdict.padEnd(10)}${at}  want ${r.want}${got}`);
  }
  console.log(`\n${hits}/${rows.length} tasks reached their target.`);
}
process.exit(hits === rows.length ? 0 : 1);
