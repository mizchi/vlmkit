#!/usr/bin/env node
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const toolsDir = dirname(fileURLToPath(import.meta.url));
const entryDir = dirname(resolve(process.argv[1] ?? fileURLToPath(import.meta.url)));
const defaultViewer = join(toolsDir, "animation-viewer.html");
const ALL_VIEWS = ["front", "side", "iso"];
const DEFAULT_TIMES = [0, 0.25, 0.5, 0.75];

function usage() {
  console.log(`Usage:
  node design-runs/game-assets-20260520/tools/render-animation.mjs --input <model.glb> [options]

Options:
  --input <path>             GLB model path (default: <entry-dir>/<entry-dir-name>.glb)
  --clip <name>              Animation clip name (default: walk_cycle)
  --time <sec|all|csv>       Sample time or comma-separated times (default: all)
  --view <name|all>          front|side|iso|all (default: all)
  --mode <name>              material|geometry (default: material)
  --out <dir>                Output directory (default: <input-dir>/renders)
  --width <px>               Viewport width (default: 1024)
  --height <px>              Viewport height (default: 1024)
  --background <hex>         Opaque background (default: #e8e8e4)
  --viewer <path>            Viewer HTML path
  --help                     Show this help
`);
}

function parseArgs(argv) {
  const entryName = basename(entryDir);
  const args = {
    input: join(entryDir, `${entryName}.glb`),
    clip: "walk_cycle",
    times: DEFAULT_TIMES,
    view: "all",
    mode: "material",
    outDir: "",
    width: 1024,
    height: 1024,
    background: "#e8e8e4",
    viewer: defaultViewer,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input") args.input = resolve(required(argv, ++i, arg));
    else if (arg === "--clip") args.clip = required(argv, ++i, arg);
    else if (arg === "--time") args.times = parseTimes(required(argv, ++i, arg), arg);
    else if (arg === "--view") args.view = required(argv, ++i, arg);
    else if (arg === "--mode") args.mode = required(argv, ++i, arg);
    else if (arg === "--out") args.outDir = resolve(required(argv, ++i, arg));
    else if (arg === "--width") args.width = positiveInt(required(argv, ++i, arg), arg);
    else if (arg === "--height") args.height = positiveInt(required(argv, ++i, arg), arg);
    else if (arg === "--background") args.background = required(argv, ++i, arg);
    else if (arg === "--viewer") args.viewer = resolve(required(argv, ++i, arg));
    else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.outDir) args.outDir = join(dirname(args.input), "renders");
  if (!["material", "geometry"].includes(args.mode)) throw new Error("--mode must be material or geometry");
  return args;
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function positiveInt(value, flag) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${flag} must be a positive integer`);
  return n;
}

function parseTimes(value, flag) {
  if (value === "all") return DEFAULT_TIMES;
  const times = value.split(",").map((item) => Number(item.trim()));
  if (times.length === 0 || times.some((time) => !Number.isFinite(time) || time < 0)) {
    throw new Error(`${flag} must be a non-negative number, "all", or a comma-separated list`);
  }
  return times;
}

function outputName(input, clip, view, mode, time) {
  const stem = basename(input).replace(/\.[^.]+$/, "");
  return `${stem}-${clip}-${mode}-${view}-t${timeLabel(time)}.png`;
}

function timeLabel(time) {
  return time.toFixed(2).replace(".", "p");
}

function toServerPath(path) {
  const rel = relative(repoRoot, path).split(/[/\\]/).map(encodeURIComponent).join("/");
  if (rel.startsWith("..")) throw new Error(`Path is outside repo root: ${path}`);
  return `/${rel}`;
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function startStaticServer(root) {
  const server = createServer(async (req, res) => {
    try {
      const rawPath = new URL(req.url ?? "/", "http://127.0.0.1").pathname;
      const decoded = decodeURIComponent(rawPath);
      const file = resolve(root, `.${decoded}`);
      if (!file.startsWith(root)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      const st = await stat(file);
      if (!st.isFile()) {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "Content-Type": mimeType(file) });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("failed to start server");
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolveClose) => server.close(resolveClose)),
  };
}

function mimeType(path) {
  const ext = extname(path).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js" || ext === ".mjs") return "text/javascript; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".glb") return "model/gltf-binary";
  return "application/octet-stream";
}

async function renderOne(page, server, args, view, time) {
  const params = new URLSearchParams({
    model: toServerPath(args.input),
    clip: args.clip,
    time: String(time),
    view,
    mode: args.mode,
    background: args.background,
  });
  const url = `${server.origin}${toServerPath(args.viewer)}?${params}`;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => {
    const status = window.__animationRenderState?.status;
    return status === "ready" || status === "error";
  }, null, { timeout: 30_000 });
  const state = await page.evaluate(() => window.__animationRenderState);
  if (state?.status === "error") {
    throw new Error(`animation viewer failed for ${view} t=${time}: ${state.message}`);
  }
  const outPath = join(args.outDir, outputName(args.input, args.clip, view, args.mode, time));
  await page.screenshot({ path: outPath, animations: "disabled", caret: "hide" });
  const metadataPath = outPath.replace(/\.png$/, ".metadata.json");
  await writeFile(metadataPath, `${JSON.stringify({
    input: relative(repoRoot, args.input),
    clip: args.clip,
    sampleTime: time,
    view,
    mode: args.mode,
    width: args.width,
    height: args.height,
    background: args.background,
    renderer: "three-playwright-animation",
    state,
    output: relative(repoRoot, outPath),
  }, null, 2)}\n`);
  return { outPath, metadataPath, state };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!(await pathExists(args.input))) throw new Error(`input not found: ${args.input}`);
  if (!(await pathExists(args.viewer))) throw new Error(`viewer not found: ${args.viewer}`);
  const views = args.view === "all" ? ALL_VIEWS : [args.view];
  await mkdir(args.outDir, { recursive: true });
  const server = await startStaticServer(repoRoot);
  const browser = await chromium.launch({
    args: [
      "--use-gl=swiftshader",
      "--enable-unsafe-swiftshader",
      "--ignore-gpu-blocklist",
      "--disable-gpu-sandbox",
    ],
  });
  try {
    const page = await browser.newPage({ viewport: { width: args.width, height: args.height }, deviceScaleFactor: 1 });
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        console.error(`animation viewer ${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      console.error(`animation viewer pageerror: ${error.message}`);
    });
    for (const view of views) {
      for (const time of args.times) {
        const result = await renderOne(page, server, args, view, time);
        console.log(`Wrote ${relative(repoRoot, result.outPath)} (${result.state.clip} ${result.state.wrappedTime}s)`);
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
