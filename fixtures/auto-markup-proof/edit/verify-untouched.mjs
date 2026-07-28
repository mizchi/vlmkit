// S8 edit-mode verifier: the attempt must be pixel-identical to BASE in
// every row the redesign did not touch. Ground truth for "touched rows"
// comes from diffing base-render.png against target-desktop.png; the
// attempt render is then compared to base-render.png on the complement.
// Usage: node fixtures/auto-markup-proof/edit/verify-untouched.mjs <attempt.html>
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pkg from "pngjs";
const { PNG } = pkg;
import { chromium } from "playwright";

const DIR = "fixtures/auto-markup-proof/edit";
const attempt = process.argv[2];
if (!attempt) { console.error("usage: verify-untouched.mjs <attempt.html>"); process.exit(2); }

const base = PNG.sync.read(readFileSync(`${DIR}/base-render.png`));
const target = PNG.sync.read(readFileSync(`${DIR}/target-desktop.png`));

const rowDiffers = (a, b, y) => {
  for (let x = 0; x < Math.min(a.width, b.width); x++) {
    const i = (y * a.width + x) * 4, j = (y * b.width + x) * 4;
    if (Math.abs(a.data[i] - b.data[j]) > 6 || Math.abs(a.data[i+1] - b.data[j+1]) > 6 || Math.abs(a.data[i+2] - b.data[j+2]) > 6) return true;
  }
  return false;
};

// Touched rows per the fixture itself (base vs target), padded by 2px.
const touched = new Set();
for (let y = 0; y < Math.min(base.height, target.height); y++) {
  if (rowDiffers(base, target, y)) for (let d = -2; d <= 2; d++) touched.add(y + d);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(pathToFileURL(resolve(attempt)).href, { waitUntil: "networkidle" });
const shotBuf = await page.screenshot({ fullPage: true, animations: "disabled" });
await browser.close();
const shot = PNG.sync.read(shotBuf);

if (shot.height !== base.height) {
  console.log(`FAIL: attempt height ${shot.height}px != base ${base.height}px — untouched sections shifted`);
  process.exit(1);
}
const violations = [];
for (let y = 0; y < base.height; y++) {
  if (!touched.has(y) && rowDiffers(base, shot, y)) violations.push(y);
}
if (violations.length === 0) {
  console.log(`PASS: all ${base.height - touched.size} untouched rows are pixel-identical to base (touched band: ${touched.size} rows)`);
} else {
  const ranges = [];
  let s = violations[0], p = violations[0];
  for (const y of violations.slice(1)) { if (y === p + 1) { p = y; continue; } ranges.push([s, p]); s = p = y; }
  ranges.push([s, p]);
  console.log(`FAIL: ${violations.length} untouched rows differ from base: ${ranges.slice(0, 10).map(([a, b]) => a === b ? `y=${a}` : `y=${a}-${b}`).join(", ")}`);
  process.exit(1);
}
