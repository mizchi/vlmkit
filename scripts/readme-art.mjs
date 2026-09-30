#!/usr/bin/env node
/**
 * Generates the README / examples / demo-gallery art listed in `readme-art.manifest.mjs` with the
 * default image model, and records what made each file in `docs/assets/art.lock.json`.
 *
 *     node --experimental-strip-types scripts/readme-art.mjs              # whatever is missing or stale
 *     node --experimental-strip-types scripts/readme-art.mjs wrench hero  # these, regardless
 *     … --chromium /path/to/chrome                                        # when Playwright's own build is absent
 *
 * Needs OPENROUTER_API_KEY. The anchor icon is drawn first and handed to every other icon as a
 * reference image, so regenerating the anchor means regenerating the set. A browser does the
 * resizing (canvas, the same encoder the demo captures use), and drops the faint halo the model
 * leaves around a transparent tile: any pixel under ALPHA_FLOOR becomes fully transparent.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createImageGenClient } from "../packages/vlmkit-ai/src/image-gen-client.ts";
import { ANCHOR_ICON, HERO, HERO_FILE, ICON_PX, ICONS, LOCK_FILE, artHash, iconFile, iconPrompt } from "./readme-art.manifest.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ALPHA_FLOOR = 48;

const args = process.argv.slice(2);
const flag = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const chromiumPath = flag("chromium");
const named = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--chromium");

const lockPath = join(repoRoot, LOCK_FILE);
const lock = existsSync(lockPath) ? JSON.parse(readFileSync(lockPath, "utf8")) : { entries: {} };

const entries = [...ICONS.map((i) => ({ ...i, file: iconFile(i.id) })), { ...HERO, file: HERO_FILE }];
const stale = (e) => !existsSync(join(repoRoot, e.file)) || lock.entries[e.id]?.hash !== artHash(e);
const todo = named.length
  ? entries.filter((e) => named.includes(e.id) || (named.includes("hero") && e.id === HERO.id))
  : entries.filter(stale);
// The anchor goes first: the rest are drawn against it.
todo.sort((a, b) => (b.id === ANCHOR_ICON) - (a.id === ANCHOR_ICON));
if (!todo.length) {
  console.log("all art is current");
  process.exit(0);
}

const client = createImageGenClient();
const browser = await chromium.launch(chromiumPath ? { executablePath: chromiumPath } : {});
const page = await browser.newPage();

/** Scale to `width` in a canvas and encode; icons also lose their sub-floor halo. */
async function finish(bytes, { width, type, alphaFloor }) {
  const src = `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
  const dataUrl = await page.evaluate(async ({ src, width, type, alphaFloor }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const full = document.createElement("canvas");
    full.width = img.naturalWidth;
    full.height = img.naturalHeight;
    const fctx = full.getContext("2d");
    fctx.drawImage(img, 0, 0);
    if (alphaFloor) {
      const data = fctx.getImageData(0, 0, full.width, full.height);
      for (let i = 3; i < data.data.length; i += 4) if (data.data[i] < alphaFloor) data.data[i] = 0;
      fctx.putImageData(data, 0, 0);
    }
    const out = document.createElement("canvas");
    out.width = width;
    out.height = Math.round((img.naturalHeight * width) / img.naturalWidth);
    const ctx = out.getContext("2d");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(full, 0, 0, out.width, out.height);
    return out.toDataURL(type, 0.86);
  }, { src, width, type, alphaFloor });
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

let spent = 0;
try {
  for (const e of todo) {
    const isHero = e.id === HERO.id;
    const reference = !isHero && e.id !== ANCHOR_ICON ? join(repoRoot, iconFile(ANCHOR_ICON)) : null;
    if (reference && !existsSync(reference)) throw new Error(`${e.id} is drawn against ${iconFile(ANCHOR_ICON)}, which does not exist yet`);
    const res = await client.generate({
      prompt: isHero ? HERO.prompt : iconPrompt(e),
      aspectRatio: isHero ? HERO.aspectRatio : "1:1",
      quality: "medium",
      ...(isHero ? {} : { background: "transparent" }),
      ...(reference ? { inputReferences: [`data:image/webp;base64,${readFileSync(reference).toString("base64")}`] } : {}),
    });
    if (!res.images[0]) throw new Error(`${e.id}: no image in the response`);
    const out = await finish(res.images[0], isHero
      ? { width: HERO.width, type: "image/webp" }
      : { width: ICON_PX, type: "image/webp", alphaFloor: ALPHA_FLOOR });
    mkdirSync(dirname(join(repoRoot, e.file)), { recursive: true });
    writeFileSync(join(repoRoot, e.file), out);
    lock.entries[e.id] = { hash: artHash(e), costUsd: res.costUsd, date: new Date().toISOString().slice(0, 10) };
    lock.model = client.model.id;
    spent += res.costUsd;
    console.log(`  ${e.file}  $${res.costUsd.toFixed(3)}  ${(res.latencyMs / 1000).toFixed(1)}s`);
    // Written after every image: a failure half way keeps what was paid for.
    writeFileSync(lockPath, `${JSON.stringify({ model: lock.model, entries: Object.fromEntries(Object.entries(lock.entries).sort()) }, null, 2)}\n`);
  }
} finally {
  await browser.close();
}
console.log(`${todo.length} generated, $${spent.toFixed(2)} — look at every one before committing`);
