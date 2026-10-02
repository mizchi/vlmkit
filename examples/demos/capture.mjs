/**
 * Runs every demo in `demos.mjs` and records what happened: the command's whole output and exit
 * code, screenshots of the page under test, and the images the command itself wrote. Then renders
 * the gallery (`render.mjs`).
 *
 *     pnpm build                                                   # the CLI runs from dist/
 *     node --experimental-strip-types examples/demos/capture.mjs   # every demo
 *     node --experimental-strip-types examples/demos/capture.mjs integrity zoom
 *
 * `--experimental-strip-types` is for the zoom demo, which builds a known-answer case with the
 * zoom-accuracy bench's own planter (`src/experiments/benchmark/zoom-accuracy/cases.ts`).
 *
 * What lands in `examples/demos/<id>/`: `page.html` (a byte copy of the page under test), its
 * extras, `result.json` (output, exit code, the images and their captions) and the images as WebP.
 * Output is cleaned of colour codes and of this machine's paths, so a re-run on another machine
 * differs only where the tool's own output does (timings).
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEMOS } from "./demos.mjs";
import { writeGallery, writeReadme } from "./render.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const BINS = {
  vlmkit: join(repoRoot, "dist/vlmkit.mjs"),
};
const WEBP_QUALITY = 0.8;
const MARK_STYLE = "outline: 3px solid #e5484d !important; outline-offset: 2px !important;";

/** Colour codes out, this machine's paths out. */
export function cleanOutput(text, outDir) {
  return text
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, "")
    .replaceAll(outDir, "<out>")
    .replaceAll(`${repoRoot}/`, "")
    .replaceAll(repoRoot, ".")
    .replace(/[ \t]+$/gm, "")
    .trimEnd() + "\n";
}

function runCli(bin, args, outDir) {
  const argv = args.map((a) => a.replaceAll("{out}", outDir));
  const res = spawnSync(process.execPath, [BINS[bin], ...argv], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
    timeout: 300_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (res.error) throw res.error;
  return { exit: res.status, output: cleanOutput(`${res.stdout}${res.stderr}`, outDir) };
}

/** PNG → WebP by the browser's own encoder, optionally cropped and with boxes drawn on it. */
async function toWebp(browser, png, { clip, boxes = [], scale = 1 } = {}) {
  const page = await browser.newPage();
  try {
    const b64 = await page.evaluate(
      async ([data, q, clipBox, rects, s]) => {
        const img = new Image();
        img.src = `data:image/png;base64,${data}`;
        await img.decode();
        const c = clipBox ?? { x: 0, y: 0, width: img.naturalWidth, height: img.naturalHeight };
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(c.width * s);
        canvas.height = Math.round(c.height * s);
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, c.x, c.y, c.width, c.height, 0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = "#e5484d";
        ctx.lineWidth = 3;
        for (const r of rects) ctx.strokeRect((r.x - c.x) * s, (r.y - c.y) * s, r.width * s, r.height * s);
        const blob = await new Promise((done) => canvas.toBlob(done, "image/webp", q));
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let bin = "";
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return [btoa(bin), canvas.width, canvas.height];
      },
      [Buffer.from(png).toString("base64"), WEBP_QUALITY, clip ?? null, boxes, scale],
    );
    return { bytes: Buffer.from(b64[0], "base64"), width: b64[1], height: b64[2] };
  } finally {
    await page.close();
  }
}

async function shootPage(browser, file, shot, settlePage) {
  const page = await browser.newPage({ viewport: { width: shot.viewport[0], height: shot.viewport[1] } });
  try {
    await page.goto(pathToFileURL(join(repoRoot, file)).href, { waitUntil: "load" });
    if (shot.mark?.length) await page.addStyleTag({ content: `${shot.mark.join(",\n")} { ${MARK_STYLE} }` });
    await settlePage(page);
    return await page.screenshot({ fullPage: shot.full ?? false, animations: "disabled", caret: "hide" });
  } finally {
    await page.close();
  }
}

/**
 * The zoom demo: one known-answer case from the accuracy bench (an element moved a few px in a
 * full-page 2x capture), the view a model is sent, and what one zoom on the change returns.
 */
async function captureZoom(browser, demo, outDir, dir) {
  const { buildCases } = await import("../../src/experiments/benchmark/zoom-accuracy/cases.ts");
  const { prepareZoomSource, zoomInto, DEFAULT_IMAGE_BUDGET } = await import("@mizchi/vlmkit-ai/zoom.ts");
  const { cases, skipped } = await buildCases(browser, {
    fixtures: [join(repoRoot, demo.page)], kinds: ["offset"], seed: 1, deviceScaleFactor: 2, viewportWidth: 1440, outDir, variants: 1,
  });
  const c = cases[0];
  if (!c || c.expected.kind !== "offset" || !c.diffBox) throw new Error(`zoom demo: no offset case (${JSON.stringify(skipped)})`);
  const [base, cur] = [c.baselinePath, c.currentPath].map((p) => prepareZoomSource(readFileSync(p), DEFAULT_IMAGE_BUDGET));
  const k = (cur.view.width / cur.original.width) * c.deviceScaleFactor; // CSS px → view px
  const pad = 48;
  const d = c.diffBox;
  const box = {
    x1: Math.max(0, Math.floor((d.x1 - pad) * k)), y1: Math.max(0, Math.floor((d.y1 - pad) * k)),
    x2: Math.min(cur.view.width, Math.ceil((d.x2 + pad) * k)), y2: Math.min(cur.view.height, Math.ceil((d.y2 + pad) * k)),
  };
  const zb = zoomInto(base, box);
  const zc = zoomInto(cur, box);
  if (!zb.ok || !zc.ok) throw new Error(`zoom demo: ${zb.text} / ${zc.text}`);
  const rect = { x: box.x1, y: box.y1, width: box.x2 - box.x1, height: box.y2 - box.y1 };
  const images = [
    { file: "view.webp", caption: `Image 1 as the model is sent it: ${cur.view.width}x${cur.view.height}, about ${k.toFixed(2)}x of CSS size. The box is the zoom asked for below.`, ...(await toWebp(browser, cur.viewPng, { boxes: [rect] })) },
    { file: "zoom-baseline.webp", caption: "One zoom into Image 0 (baseline), cropped from the full-resolution original.", ...(await toWebp(browser, zb.png)) },
    { file: "zoom-current.webp", caption: "The same box in Image 1 (current).", ...(await toWebp(browser, zc.png)) },
  ];
  for (const img of images) writeFileSync(join(dir, img.file), img.bytes);
  const e = c.expected;
  const output = [
    `planted: ${c.target} moved dx=${e.dx}, dy=${e.dy} CSS px (the known answer; seed 1)`,
    `page: ${c.page.width}x${c.page.height} CSS px at ${c.deviceScaleFactor}x → original ${cur.original.width}x${cur.original.height}`,
    `view sent to the model (DEFAULT_IMAGE_BUDGET ${DEFAULT_IMAGE_BUDGET.maxEdge}px / ${DEFAULT_IMAGE_BUDGET.maxPixels / 1e6}MP): ${cur.view.width}x${cur.view.height}`,
    `pixel diff bounds: (${d.x1},${d.y1})-(${d.x2},${d.y2}) CSS px`,
    ``,
    `zoom Image 0 → ${zb.text}`,
    `zoom Image 1 → ${zc.text}`,
    `original box: (${zc.originalBox.x1},${zc.originalBox.y1})-(${zc.originalBox.x2},${zc.originalBox.y2})`,
  ].join("\n") + "\n";
  return { exit: 0, output, images: images.map(({ bytes, ...rest }) => rest) };
}

async function captureDemo(browser, demo, settlePage) {
  const dir = join(here, demo.id);
  mkdirSync(dir, { recursive: true });
  const outDir = mkdtempSync(join(tmpdir(), `vlmkit-demo-${demo.id}-`));
  try {
    const pageAs = demo.pageAs ?? "page.html";
    if (resolve(repoRoot, demo.page) !== join(dir, pageAs)) copyFileSync(join(repoRoot, demo.page), join(dir, pageAs));
    for (const e of demo.extras ?? []) if (resolve(repoRoot, e.from) !== join(dir, e.as)) copyFileSync(join(repoRoot, e.from), join(dir, e.as));

    let result;
    if (demo.special === "zoom") {
      result = await captureZoom(browser, demo, outDir, dir);
    } else {
      const bin = demo.bin ?? "vlmkit";
      const first = runCli(bin, demo.run, outDir);
      result = { exit: first.exit, output: first.output, images: [] };
      if (demo.then) {
        const second = runCli(bin, demo.then, outDir);
        result.thenExit = second.exit;
        result.thenOutput = second.output;
      }
      const said = `${result.output}${result.thenOutput ?? ""}`;
      for (const shot of demo.shots ?? []) {
        for (const sel of shot.mark ?? []) {
          if (!said.includes(sel)) throw new Error(`${demo.id}: marked selector "${sel}" is not in the command's output`);
        }
      }
      for (const [i, shot] of (demo.shots ?? []).entries()) {
        const img = await toWebp(browser, await shootPage(browser, demo.page, shot, settlePage), { clip: shot.clip });
        const file = `shot-${i + 1}.webp`;
        writeFileSync(join(dir, file), img.bytes);
        result.images.push({ file, caption: shot.caption, width: img.width, height: img.height, kind: "page" });
      }
      for (const [i, ev] of (demo.evidence ?? []).entries()) {
        const src = join(outDir, ev.file);
        if (!existsSync(src)) throw new Error(`${demo.id}: the command wrote no ${ev.file}`);
        const img = await toWebp(browser, readFileSync(src), { clip: ev.clip });
        const file = `evidence-${i + 1}.webp`;
        writeFileSync(join(dir, file), img.bytes);
        result.images.push({ file, caption: ev.caption, width: img.width, height: img.height, kind: "evidence" });
      }
      if (demo.report) result.report = cleanOutput(readFileSync(join(outDir, demo.report), "utf8"), outDir);
    }
    if (demo.run) result.command = [demo.bin ?? "vlmkit", ...demo.run].join(" ");
    if (demo.then) result.thenCommand = [demo.bin ?? "vlmkit", ...demo.then].join(" ");
    writeFileSync(join(dir, "result.json"), JSON.stringify(result, null, 2) + "\n");
    console.log(`  ${demo.id}: exit ${result.exit}${result.thenExit !== undefined ? ` / ${result.thenExit}` : ""}, ${result.images.length} image(s)`);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const only = process.argv.slice(2);
  const unknown = only.filter((id) => !DEMOS.some((d) => d.id === id));
  if (unknown.length) throw new Error(`no such demo: ${unknown.join(", ")}`);
  const { chromium } = await import("playwright");
  const { settlePage } = await import("@mizchi/vlmkit-core/page-open.ts");
  const browser = await chromium.launch();
  try {
    for (const demo of DEMOS) if (!only.length || only.includes(demo.id)) await captureDemo(browser, demo, settlePage);
  } finally {
    await browser.close();
  }
  writeGallery();
  writeReadme();
}
