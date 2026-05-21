#!/usr/bin/env node
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, relative, resolve } from "node:path";
import { PNG } from "pngjs";
import { chromium } from "playwright";

const repoRoot = resolve(new URL("../../..", import.meta.url).pathname);
const defaultKaguraRepo = resolve(repoRoot, "..", "kagura");

function parseArgs(argv) {
  const args = {
    contract: "",
    out: "",
    screenshot: "",
    kaguraRepo: process.env.KAGURA_REPO ? resolve(process.env.KAGURA_REPO) : defaultKaguraRepo,
    port: 8765,
    timeoutMs: 90_000,
    minChangedPixelRatio: 0.01,
    minVisiblePixelRatio: 0.03,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--contract") args.contract = resolve(required(argv, ++i, arg));
    else if (arg === "--out") args.out = resolve(required(argv, ++i, arg));
    else if (arg === "--screenshot") args.screenshot = resolve(required(argv, ++i, arg));
    else if (arg === "--kagura-repo") args.kaguraRepo = resolve(required(argv, ++i, arg));
    else if (arg === "--port") args.port = Number(required(argv, ++i, arg));
    else if (arg === "--timeout-ms") args.timeoutMs = Number(required(argv, ++i, arg));
    else if (arg === "--min-changed-pixel-ratio") {
      args.minChangedPixelRatio = Number(required(argv, ++i, arg));
    } else if (arg === "--min-visible-pixel-ratio") {
      args.minVisiblePixelRatio = Number(required(argv, ++i, arg));
    }
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage:
  node design-runs/game-assets-20260520/tools/run-kagura-runtime-smoke.mjs --contract <path> [options]

Options:
  --contract <path>                  Kagura handoff JSON contract
  --out <path>                       JSON report path
  --screenshot <path>                Optional canvas screenshot path
  --kagura-repo <path>               Local mizchi/kagura repo (default: sibling ghq checkout)
  --port <n>                         Kagura dev server port (default: 8765)
  --timeout-ms <n>                   Startup/browser timeout (default: 90000)
  --min-changed-pixel-ratio <n>      Minimum non-flat canvas ratio (default: 0.01)
  --min-visible-pixel-ratio <n>      Minimum non-dark canvas ratio (default: 0.03)
`);
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.contract) throw new Error("--contract is required");
  if (!args.out) args.out = args.contract.replace(/\.json$/, ".kagura-runtime-smoke.json");
  return args;
}

function required(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = await runKaguraRuntimeSmoke(args);
  await writeFile(args.out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${report.ok ? "OK" : "FAIL"} ${relative(repoRoot, args.out)}`);
  if (!report.ok) process.exit(1);
}

async function runKaguraRuntimeSmoke(args) {
  const contract = JSON.parse(await readFile(args.contract, "utf8"));
  const contractDir = dirname(args.contract);
  const handoff = contract.kaguraHandoff;
  const failures = [];
  const warnings = [];
  const checks = [];
  if (!handoff || typeof handoff !== "object") {
    failures.push({ path: "kaguraHandoff", reason: "expected object" });
    return buildReport(args, contract, checks, warnings, failures);
  }
  const modelPath = resolve(contractDir, handoff.modelPath ?? "");
  if (!existsSync(modelPath)) failures.push({ path: "kaguraHandoff.modelPath", reason: "model file is missing" });
  if (!existsSync(resolve(args.kaguraRepo, "scripts/dev-server.mjs"))) {
    failures.push({ path: "kaguraRepo", reason: "missing scripts/dev-server.mjs" });
  }
  if (failures.length > 0) return buildReport(args, contract, checks, warnings, failures);

  let assetServer;
  let kaguraProc;
  let browser;
  const serverLogs = [];
  const consoleMessages = [];
  const pageErrors = [];
  try {
    assetServer = await startAssetServer(modelPath);
    kaguraProc = startKaguraDevServer(args.kaguraRepo, args.port, serverLogs);
    const baseUrl = `http://127.0.0.1:${args.port}/`;
    await waitForHttp(baseUrl, args.timeoutMs);

    browser = await chromium.launch({
      headless: true,
      args: [
        "--enable-unsafe-webgpu",
        "--enable-unsafe-swiftshader",
        "--enable-features=Vulkan",
        "--enable-webgl",
        "--use-angle=vulkan",
        "--use-gl=swiftshader",
        "--use-vulkan=swiftshader",
      ],
    });
    const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
    page.on("console", (msg) => {
      const text = msg.text();
      if (["error", "warning", "warn"].includes(msg.type())) consoleMessages.push({ type: msg.type(), text });
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const assetUrl = assetServer.url;
    const viewerUrl = `${baseUrl}?asset=${encodeURIComponent(assetUrl)}&hud=false`;
    await page.goto(viewerUrl, { waitUntil: "domcontentloaded", timeout: args.timeoutMs });
    await page.waitForFunction(
      () => globalThis.__kaguraWebRuntime?.webgpu?.presentScheduled !== undefined,
      undefined,
      { timeout: args.timeoutMs },
    );
    const frameSignal = await waitForFrameSignal(page, Math.min(5_000, args.timeoutMs));
    await waitForAnimationFrames(page, 2);
    const canvasInfo = await page.locator("#app").evaluate((canvas) => ({
      tagName: canvas.tagName,
      width: canvas.width,
      height: canvas.height,
      clientWidth: canvas.clientWidth,
      clientHeight: canvas.clientHeight,
    }));
    const screenshot = await page.locator("#app").screenshot({ path: args.screenshot || undefined });
    const frame = analyzePngFrame(screenshot);

    checks.push({
      id: "kagura-dev-server",
      status: "pass",
      example: "gltf_viewer",
    });
    checks.push({
      id: "runtime-load",
      status: "pass",
      canvas: canvasInfo,
    });
    checks.push({
      id: "runtime-frame-signal",
      status: frameSignal.ok ? "pass" : "fail",
      lastCompletedFrameMs: frameSignal.lastCompletedFrameMs,
      lastRenderCpuMs: frameSignal.lastRenderCpuMs,
      lastRenderSubmitCpuMs: frameSignal.lastRenderSubmitCpuMs,
    });
    if (!frameSignal.ok) {
      failures.push({
        path: "runtime-frame-signal",
        reason: "Kagura did not report a completed or submitted render frame",
      });
    }
    checks.push({
      id: "runtime-frame",
      status: frame.nonDominantPixelRatio >= args.minChangedPixelRatio &&
        frame.visiblePixelRatio >= args.minVisiblePixelRatio
        ? "pass"
        : "fail",
      nonDominantPixelRatio: round(frame.nonDominantPixelRatio),
      visiblePixelRatio: round(frame.visiblePixelRatio),
      dominantPixelRatio: round(frame.dominantPixelRatio),
      width: frame.width,
      height: frame.height,
    });
    if (frame.nonDominantPixelRatio < args.minChangedPixelRatio) {
      failures.push({
        path: "runtime-frame",
        reason: `canvas is too flat: nonDominantPixelRatio=${round(frame.nonDominantPixelRatio)}`,
      });
    }
    if (frame.visiblePixelRatio < args.minVisiblePixelRatio) {
      failures.push({
        path: "runtime-frame",
        reason: `canvas is too dark/empty: visiblePixelRatio=${round(frame.visiblePixelRatio)}`,
      });
    }
    if ((handoff.animationClips ?? []).length > 0) {
      warnings.push({
        path: "kaguraHandoff.animationClips",
        reason: "Kagura gltf_viewer load/render smoke does not expose clip playback yet",
      });
    }
  } catch (error) {
    failures.push({ path: "runtime", reason: error instanceof Error ? error.message : String(error) });
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (kaguraProc) stopChild(kaguraProc);
    if (assetServer) await assetServer.close();
  }
  if (serverLogs.length > 0) {
    checks.push({ id: "kagura-server-log-tail", status: "info", lines: serverLogs.slice(-10) });
  }
  if (pageErrors.length > 0) {
    failures.push({ path: "pageerror", reason: pageErrors.join("\n") });
  }
  if (consoleMessages.length > 0) {
    warnings.push({
      path: "browser-console",
      reason: `${consoleMessages.length} warning/error console messages`,
      messages: consoleMessages,
    });
    const gpuValidationWarnings = consoleMessages.filter((message) => isGpuValidationWarning(message.text));
    if (gpuValidationWarnings.length > 0) {
      failures.push({
        path: "browser-console",
        reason: `${gpuValidationWarnings.length} WebGPU validation warning(s)`,
      });
    }
  }
  return buildReport(args, contract, checks, warnings, failures);
}

function buildReport(args, contract, checks, warnings, failures) {
  const handoff = contract.kaguraHandoff;
  return {
    ok: failures.length === 0,
    contract: relative(repoRoot, args.contract),
    assetId: contract.asset?.id ?? null,
    kaguraRepo: relative(repoRoot, args.kaguraRepo),
    runtime: {
      example: "gltf_viewer",
      model: handoff?.modelPath ?? null,
      animationClips: handoff?.animationClips ?? [],
      clipPlayback: (handoff?.animationClips ?? []).length > 0 ? "pending-viewer-support" : "not-applicable",
    },
    checks,
    warnings,
    failures,
  };
}

function startAssetServer(modelPath) {
  return new Promise((resolvePromise, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        if (url.pathname !== "/asset.glb") {
          res.writeHead(404).end("not found");
          return;
        }
        const body = await readFile(modelPath);
        res.writeHead(200, {
          "content-type": "model/gltf-binary",
          "access-control-allow-origin": "*",
          "cache-control": "no-store",
        });
        res.end(body);
      } catch (error) {
        res.writeHead(500).end(error instanceof Error ? error.message : String(error));
      }
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("failed to bind asset server"));
        return;
      }
      resolvePromise({
        url: `http://127.0.0.1:${address.port}/asset.glb`,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

function startKaguraDevServer(kaguraRepo, port, logs) {
  const child = spawn(process.execPath, ["scripts/dev-server.mjs", "gltf_viewer"], {
    cwd: kaguraRepo,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.on("data", (chunk) => collectLogLines(logs, chunk));
  child.stderr.on("data", (chunk) => collectLogLines(logs, chunk));
  return child;
}

function collectLogLines(logs, chunk) {
  const text = chunk.toString("utf8");
  for (const line of text.split(/\r?\n/)) {
    if (line.trim()) logs.push(line);
  }
  while (logs.length > 30) logs.shift();
}

function stopChild(child) {
  if (child.exitCode != null || child.signalCode != null) return;
  child.kill("SIGTERM");
}

async function waitForHttp(url, timeoutMs) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }
  throw new Error(`timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

async function waitForFrameSignal(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastState = await readFrameSignal(page);
  while (Date.now() < deadline) {
    if (lastState.ok) return lastState;
    await page.waitForTimeout(100);
    lastState = await readFrameSignal(page);
  }
  return lastState;
}

async function readFrameSignal(page) {
  return page.evaluate(() => {
    const gfx = globalThis.__kaguraGfx;
    const lastGpu = globalThis.__kaguraLastGpu;
    const lastCompletedFrameMs = Number(gfx?.lastCompletedFrameMs?.() ?? lastGpu?._lastCompletedFrameMs ?? 0);
    const lastRenderCpuMs = Number(gfx?.lastRenderCpuMs?.() ?? lastGpu?._lastRenderCpuMs ?? 0);
    const lastRenderSubmitCpuMs = Number(gfx?.lastRenderSubmitCpuMs?.() ?? lastGpu?._lastRenderSubmitCpuMs ?? 0);
    return {
      ok: lastCompletedFrameMs > 0 || lastRenderSubmitCpuMs > 0 || lastRenderCpuMs > 0,
      lastCompletedFrameMs,
      lastRenderCpuMs,
      lastRenderSubmitCpuMs,
    };
  });
}

async function waitForAnimationFrames(page, count) {
  await page.evaluate((frameCount) => new Promise((resolvePromise) => {
    let remaining = Math.max(0, frameCount | 0);
    const tick = () => {
      remaining -= 1;
      if (remaining <= 0) resolvePromise(undefined);
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), count);
}

function analyzePngFrame(buffer) {
  const image = PNG.sync.read(buffer);
  const buckets = new Map();
  let visible = 0;
  const total = image.width * image.height;
  for (let i = 0; i < image.data.length; i += 4) {
    const r = image.data[i];
    const g = image.data[i + 1];
    const b = image.data[i + 2];
    const a = image.data[i + 3];
    const key = `${r >> 3},${g >> 3},${b >> 3},${a >> 3}`;
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
    if (a > 0 && r + g + b > 72) visible++;
  }
  const dominant = Math.max(...buckets.values());
  const dominantPixelRatio = dominant / total;
  return {
    width: image.width,
    height: image.height,
    dominantPixelRatio,
    nonDominantPixelRatio: 1 - dominantPixelRatio,
    visiblePixelRatio: visible / total,
  };
}

function isGpuValidationWarning(text) {
  return /\[Invalid (Texture|TextureView|CommandBuffer)\]|startup error|No available adapters/i.test(text);
}

function round(value) {
  return Math.round(value * 10000) / 10000;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
