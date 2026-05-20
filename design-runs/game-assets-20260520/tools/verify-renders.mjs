#!/usr/bin/env node
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { PNG } from "pngjs";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const entryDir = dirname(resolve(process.argv[1] ?? new URL(".", import.meta.url).pathname));
const defaultBackground = [0xe8, 0xe8, 0xe4];

function parseArgs(argv) {
  const args = {
    dir: join(entryDir, "renders"),
    out: join(entryDir, `${basenameNoExt(entryDir)}.render-verify.json`),
    frames: [],
    background: defaultBackground,
    minForegroundRatio: 0.03,
    requireFiniteBounds: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dir") args.dir = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--frame") args.frames.push(required(argv, ++i, arg));
    else if (arg === "--frames") args.frames.push(...csv(required(argv, ++i, arg)));
    else if (arg === "--background") args.background = parseHexColor(required(argv, ++i, arg));
    else if (arg === "--min-foreground-ratio") args.minForegroundRatio = Number(required(argv, ++i, arg));
    else if (arg === "--allow-missing-bounds") args.requireFiniteBounds = false;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/verify-renders.mjs [options]

Options:
  --dir <path>                    Render directory (default: <entry-dir>/renders)
  --out <path>                    Verification JSON path
  --frame <file>                  Required frame filename, repeatable
  --frames <csv>                  Required frame filenames
  --background <hex>              Opaque background (default: #e8e8e4)
  --min-foreground-ratio <n>      Minimum non-background pixels (default: 0.03)
  --allow-missing-bounds          Do not require finite render metadata bounds
`);
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

function csv(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const frameNames = args.frames.length > 0 ? args.frames : await discoverFrames(args.dir);
  const frames = [];
  const failures = [];
  for (const name of frameNames) {
    const pngPath = join(args.dir, name);
    const metadataPath = pngPath.replace(/\.png$/, ".metadata.json");
    try {
      const image = PNG.sync.read(await readFile(pngPath));
      const foregroundRatio = foregroundPixelRatio(image, args.background);
      const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
      const bounds = metadata.state?.animatedBounds ?? metadata.state?.normalizedBounds ?? metadata.state?.sourceBounds;
      const finiteBounds = hasFiniteBounds(bounds);
      const finiteGround = metadata.state?.minGroundY === undefined || Number.isFinite(metadata.state.minGroundY);
      frames.push({
        file: relative(repoRoot, pngPath),
        foregroundRatio: round(foregroundRatio),
        finiteBounds,
        minGroundY: metadata.state?.minGroundY ?? null,
      });
      if (foregroundRatio < args.minForegroundRatio) {
        failures.push({ file: relative(repoRoot, pngPath), reason: "foreground ratio below threshold", foregroundRatio: round(foregroundRatio) });
      }
      if (args.requireFiniteBounds && !finiteBounds) {
        failures.push({ file: relative(repoRoot, pngPath), reason: "render bounds are not finite" });
      }
      if (!finiteGround) {
        failures.push({ file: relative(repoRoot, pngPath), reason: "minGroundY is not finite" });
      }
    } catch (error) {
      failures.push({ file: relative(repoRoot, pngPath), reason: error instanceof Error ? error.message : String(error) });
    }
  }

  const ok = failures.length === 0;
  const result = {
    ok,
    minForegroundRatio: args.minForegroundRatio,
    checkedFrameCount: frameNames.length,
    frames,
    failures,
  };
  await writeFile(args.out, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`${ok ? "OK" : "FAIL"} ${relative(repoRoot, args.out)}`);
  if (!ok) process.exit(1);
}

async function discoverFrames(dir) {
  const files = await readdir(dir);
  return files
    .filter((file) => file.endsWith(".png"))
    .filter((file) => !file.startsWith("glb-vs-obj-"))
    .filter((file) => files.includes(file.replace(/\.png$/, ".metadata.json")))
    .sort();
}

function foregroundPixelRatio(image, background) {
  let foreground = 0;
  const total = image.width * image.height;
  for (let i = 0; i < image.data.length; i += 4) {
    const distance =
      Math.abs(image.data[i] - background[0]) +
      Math.abs(image.data[i + 1] - background[1]) +
      Math.abs(image.data[i + 2] - background[2]);
    if (distance > 18 && image.data[i + 3] > 0) foreground++;
  }
  return foreground / total;
}

function hasFiniteBounds(bounds) {
  if (!bounds?.min || !bounds?.max) return false;
  return [...bounds.min, ...bounds.max].every(Number.isFinite);
}

function parseHexColor(value) {
  const match = /^#?([0-9a-f]{6})$/i.exec(value);
  if (!match) throw new Error(`invalid hex color: ${value}`);
  const hex = match[1];
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function basenameNoExt(path) {
  const base = path.split(/[/\\]/).filter(Boolean).at(-1) ?? "renders";
  return base.replace(/\.[^.]+$/, "");
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
