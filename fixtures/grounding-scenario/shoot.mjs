#!/usr/bin/env node
/**
 * Regenerate `shots/<page>.png` — the one artifact both arms of the scenario get.
 *
 * It is the frame a computer-use harness would hand a model, not a full-size
 * capture: the viewport is shot at 1280x720 and reduced to the resolution
 * `check grounding` reports by default for that width (`medium`, so 640x360 at
 * scale 0.5), with the same nearest-neighbour resampling `image-resize.ts` uses.
 * That is what makes the scenario fair — an attempt's coordinates and the
 * gate's action map are denominated in the same pixels.
 *
 *   node fixtures/grounding-scenario/shoot.mjs [console]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// The first frame is a replay of no actions, made by the same `frame` as every
// frame after it — so the picture an attempt starts from and the coordinates it
// sends back cannot be denominated in two different frame sizes.
import { frame, replay } from "./act.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const pageName = process.argv[2] ?? "console";

const { browser, page } = await replay([], { pageName });
const png = await frame(page);
await browser.close();

const out = join(HERE, "shots", `${pageName}.png`);
await mkdir(dirname(out), { recursive: true });
await writeFile(out, png);
console.log(`wrote ${out}`);
