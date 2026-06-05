#!/usr/bin/env node
// A/B experiment harness: deterministic multi-viewport full-page capture.
// Plain Playwright only — intentionally NOT vlmkit, so the same scorer is
// neutral for both arms.
//
// Usage:
//   node capture.mjs --url http://localhost:4310/ --out-dir baselines/
//   node capture.mjs --url ... --out-dir ... --viewports 1280x800,375x700

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

function parseArgs(argv) {
  const args = {
    url: null,
    outDir: null,
    viewports: [
      { w: 1280, h: 800 },
      { w: 768, h: 900 },
      { w: 375, h: 700 },
    ],
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--url") args.url = argv[++i];
    else if (a === "--out-dir") args.outDir = argv[++i];
    else if (a === "--viewports")
      args.viewports = argv[++i].split(",").map((s) => {
        const [w, h] = s.split("x").map(Number);
        return { w, h };
      });
  }
  return args;
}

const args = parseArgs(process.argv);
if (!args.url || !args.outDir) {
  console.error("--url and --out-dir are required");
  process.exit(1);
}
mkdirSync(args.outDir, { recursive: true });

const browser = await chromium.launch();
try {
  for (const vp of args.viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
    });
    await page.goto(args.url, { waitUntil: "networkidle", timeout: 30000 });
    // Freeze animations/transitions/carets for deterministic pixels.
    await page.addStyleTag({
      content:
        "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }",
    });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const file = join(args.outDir, `${vp.w}x${vp.h}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`captured ${file}`);
    await page.close();
  }
} finally {
  await browser.close();
}
