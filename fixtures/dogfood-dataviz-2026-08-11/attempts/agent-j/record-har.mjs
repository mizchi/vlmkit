// Records fixtures/dashboard.har for `--har` replay.
//
// vlmkit documents `--har` as the way to make third-party responses
// reproducible ("record a HAR with Playwright and replay it during the gate")
// but ships no recorder, so this is that missing step, committed next to the
// page instead of living in somebody's shell history.
//
//   node serve.mjs 5202 &
//   node record-har.mjs http://localhost:5202/ dashboard.har
import { chromium } from "playwright";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const url = process.argv[2] ?? "http://localhost:5202/";
const out = resolve(here, process.argv[3] ?? "dashboard.har");

const browser = await chromium.launch();
const ctx = await browser.newContext({ recordHar: { path: out, mode: "full", content: "embed" } });
const page = await ctx.newPage();
// domcontentloaded, not networkidle: /api/live never ends.
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
await page.waitForTimeout(1500); // let /api/metrics land so its response is in the recording
await ctx.close();
await browser.close();
console.log(`wrote ${out}`);
