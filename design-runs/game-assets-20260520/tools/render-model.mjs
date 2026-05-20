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
const defaultViewer = join(toolsDir, "model-viewer.html");
const ALL_VIEWS = ["front", "side", "back", "iso"];

function usage() {
  console.log(`Usage:
  node design-runs/game-assets-20260520/tools/render-model.mjs --input <model> [options]

Options:
  --input <path>             GLB/GLTF/OBJ model path
  --format <fmt>             glb|gltf|obj (default: infer from extension)
  --mtl <path>               MTL path for OBJ
  --view <name|all>          front|side|back|left|top|iso|all (default: iso)
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
  const args = {
    input: "",
    format: "",
    mtl: "",
    view: "iso",
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
    else if (arg === "--format") args.format = required(argv, ++i, arg);
    else if (arg === "--mtl") args.mtl = resolve(required(argv, ++i, arg));
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
  if (!args.input) throw new Error("--input is required");
  if (!args.outDir) args.outDir = join(dirname(args.input || entryDir), "renders");
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

function inferFormat(input) {
  const ext = extname(input).toLowerCase();
  if (ext === ".obj") return "obj";
  if (ext === ".gltf") return "gltf";
  return "glb";
}

function outputName(input, format, view, mode) {
  return `${basename(input).replace(/\.[^.]+$/, "")}-${format}-${mode}-${view}.png`;
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
  if (ext === ".gltf") return "model/gltf+json";
  if (ext === ".obj") return "model/obj";
  if (ext === ".mtl") return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

async function renderOne(page, server, args, view) {
  const format = args.format || inferFormat(args.input);
  const params = new URLSearchParams({
    model: toServerPath(args.input),
    format,
    view,
    mode: args.mode,
    background: args.background,
  });
  if (args.mtl) params.set("mtl", toServerPath(args.mtl));
  const url = `${server.origin}${toServerPath(args.viewer)}?${params}`;
  await page.goto(url, { waitUntil: "load" });
  await page.waitForFunction(() => {
    const status = window.__modelRenderState?.status;
    return status === "ready" || status === "error";
  }, null, { timeout: 30_000 });
  const state = await page.evaluate(() => window.__modelRenderState);
  if (state?.status === "error") {
    throw new Error(`viewer failed for ${view}: ${state.message}`);
  }
  const outPath = join(args.outDir, outputName(args.input, format, view, args.mode));
  await page.screenshot({ path: outPath, animations: "disabled", caret: "hide" });
  const metadataPath = outPath.replace(/\.png$/, ".metadata.json");
  await writeFile(metadataPath, `${JSON.stringify({
    input: relative(repoRoot, args.input),
    format,
    view,
    mode: args.mode,
    width: args.width,
    height: args.height,
    background: args.background,
    renderer: "three-playwright-model",
    state,
    output: relative(repoRoot, outPath),
  }, null, 2)}\n`);
  return { outPath, metadataPath, state };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!(await pathExists(args.input))) throw new Error(`input not found: ${args.input}`);
  if (!(await pathExists(args.viewer))) throw new Error(`viewer not found: ${args.viewer}`);
  if (args.mtl && !(await pathExists(args.mtl))) throw new Error(`mtl not found: ${args.mtl}`);
  if (!args.mtl && inferFormat(args.input) === "obj") {
    const candidate = args.input.replace(/\.obj$/i, ".mtl");
    if (await pathExists(candidate)) args.mtl = candidate;
  }

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
        console.error(`viewer ${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      console.error(`viewer pageerror: ${error.message}`);
    });
    for (const view of views) {
      const result = await renderOne(page, server, args, view);
      console.log(`Wrote ${relative(repoRoot, result.outPath)} (${result.state.meshCount} mesh nodes)`);
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
