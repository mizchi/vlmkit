/**
 * `scan component` option plumbing + the game-UI preset measurement.
 *
 * The preset numbers quoted in `EXTRACT_PRESETS` were measured on a synthetic
 * 16-element pixel-art HUD. `buildHud` below *is* that HUD, so the claims stay
 * checkable: if the extractor changes, these assertions move with it instead of
 * the comment quietly going stale.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { runComponentExtract } from "./component-extract.ts";
import {
  extractComponentsFromRgba,
  EXTRACT_PRESETS,
  isExtractPresetName,
  type ComponentBbox,
} from "./component-bbox.ts";

const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const BG: [number, number, number] = [16, 24, 32];

interface HudElement {
  name: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * A 16-element game HUD laid out in 320x240 design units and scaled by `s`:
 * three status bars, a portrait, a coin icon + numeric label, a minimap, three
 * status icons, a crosshair, a dialog box, two buttons, a weapon icon and an
 * ammo label. Elements are separated by background so each is one connected
 * blob — except the two labels, which are glyph runs on purpose (4-connectivity
 * cannot merge separated glyphs, so they cap the achievable score at 14/16).
 */
function buildHud(W: number, H: number, s: number): { png: PNG; elements: HudElement[] } {
  const png = new PNG({ width: W, height: H });
  for (let i = 0; i < W * H; i++) {
    png.data[i * 4] = BG[0];
    png.data[i * 4 + 1] = BG[1];
    png.data[i * 4 + 2] = BG[2];
    png.data[i * 4 + 3] = 255;
  }
  const S = (n: number) => Math.round(n * s);
  const rect = (x: number, y: number, w: number, h: number, c: [number, number, number]) => {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const i = (yy * W + xx) * 4;
        png.data[i] = c[0]; png.data[i + 1] = c[1]; png.data[i + 2] = c[2]; png.data[i + 3] = 255;
      }
    }
  };
  const frame = (x: number, y: number, w: number, h: number, c: [number, number, number], t: number) => {
    rect(x, y, w, t, c); rect(x, y + h - t, w, t, c);
    rect(x, y, t, h, c); rect(x + w - t, y, t, h, c);
  };
  const elements: HudElement[] = [];
  const add = (name: string, left: number, top: number, width: number, height: number) =>
    elements.push({ name, left, top, width, height });

  const L = S(8), T = S(8);
  rect(L, T, S(120), S(10), [60, 20, 24]);
  rect(L, T, S(84), S(10), [220, 60, 60]);
  add("hp-bar", L, T, S(120), S(10));
  const mpY = T + S(14);
  rect(L, mpY, S(120), S(6), [20, 28, 60]);
  rect(L, mpY, S(52), S(6), [70, 130, 240]);
  add("mp-bar", L, mpY, S(120), S(6));
  const xpY = mpY + S(10);
  rect(L, xpY, S(120), S(4), [40, 50, 30]);
  rect(L, xpY, S(30), S(4), [190, 220, 90]);
  add("xp-bar", L, xpY, S(120), S(4));

  const stY = xpY + S(24);
  ([[200, 90, 200], [90, 200, 120], [200, 180, 80]] as Array<[number, number, number]>)
    .forEach((c, i) => {
      const x = L + i * S(18);
      rect(x, stY, S(12), S(12), c);
      add(`status-${i + 1}`, x, stY, S(12), S(12));
    });

  const pX = L + S(128);
  frame(pX, T - S(2), S(28), S(28), [230, 220, 180], Math.max(1, S(2)));
  rect(pX + S(6), T + S(4), S(16), S(16), [180, 140, 110]);
  add("portrait", pX, T - S(2), S(28), S(28));

  const cX = pX + S(40);
  rect(cX, T + S(2), S(10), S(10), [240, 200, 60]);
  add("coin-icon", cX, T + S(2), S(10), S(10));
  const lX = cX + S(16), glyphW = Math.max(1, S(5)), glyphAdv = Math.max(2, S(7));
  for (let g = 0; g < 4; g++) rect(lX + g * glyphAdv, T + S(3), glyphW, Math.max(1, S(7)), [240, 240, 230]);
  add("coin-label", lX, T + S(3), 3 * glyphAdv + glyphW, Math.max(1, S(7)));

  const mm = S(60), mmX = W - S(8) - mm;
  frame(mmX, T, mm, mm, [120, 200, 200], Math.max(1, S(2)));
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let d = 0; d < 40; d++) {
    rect(mmX + S(2) + Math.floor(rnd() * (mm - S(6))), T + S(2) + Math.floor(rnd() * (mm - S(6))),
      Math.max(1, S(2)), Math.max(1, S(2)), [90, 160, 160]);
  }
  add("minimap", mmX, T, mm, mm);

  const chW = S(12), chT = Math.max(1, S(2));
  const chX = Math.round(W / 2 - chW / 2), chY = Math.round(H / 2 - chW / 2);
  rect(chX, chY + Math.round((chW - chT) / 2), chW, chT, [240, 240, 240]);
  rect(chX + Math.round((chW - chT) / 2), chY, chT, chW, [240, 240, 240]);
  add("crosshair", chX, chY, chW, chW);

  const dW = S(200), dH = S(40), dX = S(16), dY = H - S(60) - dH;
  frame(dX, dY, dW, dH, [220, 220, 210], Math.max(1, S(2)));
  rect(dX + S(8), dY + S(10), S(150), Math.max(1, S(4)), [200, 200, 190]);
  rect(dX + S(8), dY + S(20), S(120), Math.max(1, S(4)), [200, 200, 190]);
  add("dialog-box", dX, dY, dW, dH);

  const bY = H - S(40);
  rect(S(16), bY, S(36), S(14), [70, 110, 200]);
  rect(S(30), bY + S(4), S(6), S(6), [255, 255, 255]);
  add("btn-a", S(16), bY, S(36), S(14));
  rect(S(60), bY, S(36), S(14), [200, 110, 70]);
  rect(S(74), bY + S(4), S(6), S(6), [255, 255, 255]);
  add("btn-b", S(60), bY, S(36), S(14));

  const wX = W - S(104);
  rect(wX, bY - S(4), S(24), S(16), [150, 150, 160]);
  add("weapon-icon", wX, bY - S(4), S(24), S(16));
  const aX = wX + S(34), agW = Math.max(1, S(6)), agAdv = Math.max(2, S(10));
  for (let g = 0; g < 3; g++) rect(aX + g * agAdv, bY, agW, Math.max(1, S(8)), [240, 240, 230]);
  add("ammo-label", aX, bY, 2 * agAdv + agW, Math.max(1, S(8)));

  return { png, elements };
}

function iou(a: { left: number; top: number; width: number; height: number }, b: HudElement): number {
  const ix = Math.max(a.left, b.left), iy = Math.max(a.top, b.top);
  const ax = Math.min(a.left + a.width, b.left + b.width);
  const ay = Math.min(a.top + a.height, b.top + b.height);
  const inter = Math.max(0, ax - ix) * Math.max(0, ay - iy);
  const uni = a.width * a.height + b.width * b.height - inter;
  return uni > 0 ? inter / uni : 0;
}

/** Elements matched at bbox IoU >= 0.5 by at least one returned component. */
function detected(components: ComponentBbox[], elements: HudElement[]): number {
  return elements.filter((el) => components.some((c) => iou(c, el) >= 0.5)).length;
}

describe("game-ui preset (vlmkit#118 §4)", () => {
  it("pins the thresholds the doc comment quotes", () => {
    assert.deepEqual(EXTRACT_PRESETS["game-ui"], { minArea: 24, topN: 24 });
  });

  it("recovers 14 of 16 HUD elements at 320x240 where the defaults find 6", () => {
    const { png, elements } = buildHud(320, 240, 1);
    assert.equal(elements.length, 16);
    const base = extractComponentsFromRgba(png.data, 320, 240);
    const preset = extractComponentsFromRgba(png.data, 320, 240, EXTRACT_PRESETS["game-ui"]);
    assert.equal(detected(base, elements), 6);
    assert.equal(detected(preset, elements), 14);
  });

  it("holds up across frame sizes from 240x160 to 1280x720", () => {
    // The defaults find 6-7 at every size — topN, not minArea, is what binds —
    // and the preset reaches the 4-connectivity ceiling at each.
    const cases: Array<[number, number, number, number, number]> = [
      // W, H, scale, expected detected with defaults, expected with the preset
      [240, 160, 0.75, 7, 13],
      [320, 240, 1, 6, 14],
      [640, 360, 1.5, 6, 14],
      [1280, 720, 3, 6, 14],
    ];
    for (const [W, H, s, expectBase, expectPreset] of cases) {
      const { png, elements } = buildHud(W, H, s);
      const base = extractComponentsFromRgba(png.data, W, H);
      const preset = extractComponentsFromRgba(png.data, W, H, EXTRACT_PRESETS["game-ui"]);
      assert.equal(detected(base, elements), expectBase, `${W}x${H} defaults`);
      assert.equal(detected(preset, elements), expectPreset, `${W}x${H} preset`);
    }
  });

  it("minArea alone changes nothing — the cap is what binds", () => {
    // This is the finding that makes the preset a bundle rather than one number:
    // the threshold the issue names is inert until topN is raised.
    const { png, elements } = buildHud(320, 240, 1);
    const areaOnly = extractComponentsFromRgba(png.data, 320, 240, { minArea: 24 });
    const capOnly = extractComponentsFromRgba(png.data, 320, 240, { topN: 24 });
    assert.equal(detected(areaOnly, elements), 6);
    assert.equal(detected(capOnly, elements), 9);
  });

  it("raising topN only appends — it never displaces a component the old cap returned", () => {
    // Why the preset is safe for every caller that keeps the default cap: the
    // list is sorted by area descending, so a lower floor can only add smaller
    // entries below the existing ones.
    const { png } = buildHud(640, 360, 1.5);
    const narrow = extractComponentsFromRgba(png.data, 640, 360, { minArea: 24, topN: 8 });
    const wide = extractComponentsFromRgba(png.data, 640, 360, { minArea: 24, topN: 24 });
    assert.deepEqual(wide.slice(0, narrow.length), narrow);
  });
});

describe("large-image non-regression", () => {
  const pageShot = join(REPO_ROOT, "fixtures/auto-markup-proof/dashboard/target-desktop.png");

  it("leaves a page screenshot's component set exactly as it was", async () => {
    // The preset must be opt-in, not adaptive: on a page render the extra
    // components are individual glyphs (measured on a real 480x240 card render:
    // minArea 50 adds 4 blobs that are all letters of the word "Dashboard").
    // So the *default* path has to stay byte-identical on large images.
    const png = PNG.sync.read(await readFile(pageShot));
    assert.ok(Math.max(png.width, png.height) > 640, "fixture must be a large frame");
    const before = extractComponentsFromRgba(png.data, png.width, png.height);
    const after = extractComponentsFromRgba(png.data, png.width, png.height, {});
    assert.deepEqual(after, before);
    assert.equal(before.length, 8);
  });

  it("does not attach a small-frame hint to a large frame", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-extract-large-"));
    try {
      const r = await runComponentExtract({ source: pageShot, outputDir: dir });
      assert.equal(r.smallFrameHint, undefined);
      assert.deepEqual(r.settings, { minArea: 200, topN: 8 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("runComponentExtract option resolution", () => {
  let dir = "";
  let hudPath = "";

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "vlmkit-extract-"));
    hudPath = join(dir, "hud.png");
    await writeFile(hudPath, PNG.sync.write(buildHud(320, 240, 1).png));
  });
  after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("reports the applied thresholds and defaults to 200/8", async () => {
    const r = await runComponentExtract({ source: hudPath, outputDir: dir });
    assert.deepEqual(r.settings, { minArea: 200, topN: 8 });
    assert.equal(r.components.length, 8);
  });

  it("applies the preset", async () => {
    const r = await runComponentExtract({ source: hudPath, outputDir: dir, preset: "game-ui" });
    assert.deepEqual(r.settings, { minArea: 24, topN: 24, preset: "game-ui" });
    assert.equal(r.components.length, 24);
  });

  it("lets an explicit flag widen the preset it was combined with", async () => {
    const r = await runComponentExtract({
      source: hudPath, outputDir: dir, preset: "game-ui", topN: 40,
    });
    assert.deepEqual(r.settings, { minArea: 24, topN: 40, preset: "game-ui" });
  });

  it("hints at the preset on a small frame, with measured numbers", async () => {
    const r = await runComponentExtract({ source: hudPath, outputDir: dir });
    assert.ok(r.smallFrameHint, "expected a hint on a 320x240 frame");
    assert.equal(r.smallFrameHint.preset, "game-ui");
    assert.equal(r.smallFrameHint.extraComponents, 16);
    // A 12x12 status icon fills 144px — the largest thing minArea 200 drops here.
    assert.equal(r.smallFrameHint.largestExcludedArea, 144);
    const md = await readFile(r.reportPath, "utf8");
    assert.match(md, /## Small frame/);
    assert.match(md, /--min-area 24 --top-n 24/);
  });

  it("stops hinting once the frame is already scanned at preset settings", async () => {
    const r = await runComponentExtract({ source: hudPath, outputDir: dir, preset: "game-ui" });
    assert.equal(r.smallFrameHint, undefined);
  });

  it("names the valid presets", () => {
    assert.equal(isExtractPresetName("game-ui"), true);
    assert.equal(isExtractPresetName("gameui"), false);
  });
});
