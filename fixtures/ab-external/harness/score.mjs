#!/usr/bin/env node
// A/B experiment harness: fixed scorer. Compares two capture dirs
// (produced by capture.mjs) with pixelmatch and prints per-viewport
// diff ratios as JSON. Size mismatches are padded with white; padded
// area counts as diff, so "the page got shorter" is penalized.
//
// Usage:
//   node score.mjs --baseline-dir baselines/ --current-dir current/

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

function parseArgs(argv) {
  const args = { baselineDir: null, currentDir: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--baseline-dir") args.baselineDir = argv[++i];
    else if (a === "--current-dir") args.currentDir = argv[++i];
  }
  return args;
}

function padTo(png, width, height) {
  if (png.width === width && png.height === height) return png;
  const out = new PNG({ width, height });
  out.data.fill(255);
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

const args = parseArgs(process.argv);
if (!args.baselineDir || !args.currentDir) {
  console.error("--baseline-dir and --current-dir are required");
  process.exit(1);
}

const result = { viewports: {}, mean: 0, max: 0 };
const files = readdirSync(args.baselineDir).filter((f) => f.endsWith(".png"));
let sum = 0;
for (const f of files) {
  const base = PNG.sync.read(readFileSync(join(args.baselineDir, f)));
  const curr = PNG.sync.read(readFileSync(join(args.currentDir, f)));
  const w = Math.max(base.width, curr.width);
  const h = Math.max(base.height, curr.height);
  const a = padTo(base, w, h);
  const b = padTo(curr, w, h);
  const diff = pixelmatch(a.data, b.data, null, w, h, { threshold: 0.1 });
  const ratio = diff / (w * h);
  result.viewports[f.replace(".png", "")] = Number(ratio.toFixed(6));
  sum += ratio;
  if (ratio > result.max) result.max = Number(ratio.toFixed(6));
}
result.mean = Number((sum / files.length).toFixed(6));
console.log(JSON.stringify(result, null, 2));
