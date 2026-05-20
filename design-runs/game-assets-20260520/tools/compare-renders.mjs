#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const entryDir = dirname(resolve(process.argv[1] ?? new URL(".", import.meta.url).pathname));
const VIEWS = ["front", "side", "back", "iso"];

function parseArgs(argv) {
  const defaultBase = basenameNoExt(entryDir) === "tools" ? "asset" : basenameNoExt(entryDir);
  const args = { dir: join(entryDir, "renders"), mode: "geometry", threshold: 0.1, base: defaultBase };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dir") args.dir = resolve(required(argv, ++i, arg));
    else if (arg === "--mode") args.mode = required(argv, ++i, arg);
    else if (arg === "--base") args.base = required(argv, ++i, arg);
    else if (arg === "--threshold") args.threshold = Number(required(argv, ++i, arg));
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: node compare-renders.mjs [--dir renders] [--base name] [--mode geometry|material] [--threshold 0.1]");
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

async function readPng(path) {
  return PNG.sync.read(await readFile(path));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await mkdir(args.dir, { recursive: true });
  const rows = [];
  for (const view of VIEWS) {
    const glbPath = join(args.dir, `${args.base}-glb-${args.mode}-${view}.png`);
    const objPath = join(args.dir, `${args.base}-obj-${args.mode}-${view}.png`);
    const glb = await readPng(glbPath);
    const obj = await readPng(objPath);
    if (glb.width !== obj.width || glb.height !== obj.height) {
      throw new Error(`size mismatch for ${view}: ${glb.width}x${glb.height} vs ${obj.width}x${obj.height}`);
    }
    const diff = new PNG({ width: glb.width, height: glb.height });
    const diffPixels = pixelmatch(glb.data, obj.data, diff.data, glb.width, glb.height, { threshold: args.threshold });
    const diffRatio = diffPixels / (glb.width * glb.height);
    const diffPath = join(args.dir, `glb-vs-obj-${args.mode}-${view}.png`);
    await writeFile(diffPath, PNG.sync.write(diff));
    rows.push({ view, diffPixels, diffRatio: round(diffRatio), diffPath: relative(repoRoot, diffPath) });
  }
  const reportPath = join(args.dir, `glb-vs-obj-${args.mode}.json`);
  await writeFile(reportPath, `${JSON.stringify({ base: args.base, mode: args.mode, threshold: args.threshold, rows }, null, 2)}\n`);
  for (const row of rows) {
    console.log(`${row.view}: ${(row.diffRatio * 100).toFixed(2)}% (${row.diffPixels} px) -> ${row.diffPath}`);
  }
  console.log(`Wrote ${relative(repoRoot, reportPath)}`);
}

function round(value) {
  return Math.round(value * 1000000) / 1000000;
}

function basenameNoExt(path) {
  const base = path.split(/[/\\]/).filter(Boolean).at(-1) ?? "asset";
  return base.replace(/\.[^.]+$/, "");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
