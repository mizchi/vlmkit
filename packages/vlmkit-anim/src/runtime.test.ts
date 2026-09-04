/**
 * The `<vlm-anim>` runtime in a real browser, and the same page through
 * vlmkit's own `check animation` gate — the point of building on SVG + Web
 * Animations rather than a canvas loop is that the existing frame-sampling
 * tooling sees the animation as ordinary page motion.
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, it } from "vitest";
import { runAnimationEval } from "@mizchi/vlmkit-animation-eval/animation-eval.ts";
import { compileScene } from "./compile/index.ts";
import { renderFrameSvg } from "./render-svg.ts";
import { renderEmbedHtml } from "./runtime.ts";
import { EXAMPLES } from "./schema-sheet.ts";
import { sampleFrame, worldPos } from "./timeline.ts";

const dir = mkdtempSync(join(tmpdir(), "vlm-anim-"));
let browser: Browser;

beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  rmSync(dir, { recursive: true, force: true });
});

async function open(file: string, opts: { reducedMotion?: "reduce" | "no-preference" } = {}) {
  const context = await browser.newContext({ viewport: { width: 800, height: 600 }, reducedMotion: opts.reducedMotion ?? "no-preference" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`file://${file}`);
  await page.waitForSelector("vlm-anim svg");
  return { page, context, errors };
}

describe("<vlm-anim> runtime", () => {
  const tl = compileScene(EXAMPLES.sort);
  const file = join(dir, "sort.html");
  writeFileSync(file, renderEmbedHtml(tl, { autoplay: false }));

  it("builds the SVG from the inline timeline, one paused WAAPI animation per continuous track", async () => {
    const { page, context, errors } = await open(file);
    const info = await page.evaluate(() => {
      const el = document.querySelector("vlm-anim") as HTMLElement & { duration: number; playing: boolean; ir: { tracks: { prop: string }[] } };
      const anims = document.getAnimations();
      return {
        duration: el.duration,
        playing: el.playing,
        animations: anims.length,
        allPaused: anims.every((a) => a.playState === "paused"),
        groups: document.querySelectorAll("vlm-anim svg g[id]").length,
        continuousTracks: el.ir.tracks.filter((t) => t.prop !== "text" && t.prop !== "size").length,
      };
    });
    assert.deepEqual(errors, []);
    assert.equal(info.duration, tl.duration);
    assert.equal(info.playing, false);
    assert.equal(info.groups, tl.nodes.length);
    assert.equal(info.animations, info.continuousTracks);
    assert.ok(info.allPaused);
    await context.close();
  });

  it("seek() lands where the headless sampler says, and steps update the caption", async () => {
    const { page, context } = await open(file);
    const lastStep = tl.steps![tl.steps!.length - 1];
    const measured = await page.evaluate(
      async ({ t, id }) => {
        const el = document.querySelector("vlm-anim") as HTMLElement & { seek(ms: number): void; stepIndex: number };
        el.seek(t);
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const g = document.getElementById(id)!;
        const translate = getComputedStyle(g).translate;
        return { translate, caption: el.querySelector(".vlm-caption")!.textContent, stepIndex: el.stepIndex, dataTime: el.getAttribute("data-time") };
      },
      { t: lastStep.t, id: "bar-0" },
    );
    const frame = sampleFrame(tl, lastStep.t);
    const [x, y] = worldPos(frame, "bar-0");
    const m = /^(-?[\d.]+)px\s+(-?[\d.]+)px$/.exec(measured.translate);
    assert.ok(m, `translate was ${measured.translate}`);
    assert.ok(Math.abs(Number(m[1]) - x) < 1.5 && Math.abs(Number(m[2]) - y) < 1.5, `runtime ${measured.translate} vs sampler ${x},${y}`);
    assert.equal(measured.caption, lastStep.caption);
    assert.equal(measured.stepIndex, tl.steps!.length - 1);
    assert.equal(measured.dataTime, String(Math.round(lastStep.t)));
    await context.close();
  });

  it("next()/prev() walk the step markers; play() advances and fires `ended`", async () => {
    const { page, context } = await open(file);
    const r = await page.evaluate(async () => {
      const el = document.querySelector("vlm-anim") as HTMLElement & { next(): void; prev(): void; play(): void; seek(ms: number): void; time: number; duration: number; playing: boolean };
      el.next();
      const afterNext = el.time;
      el.next();
      el.prev();
      const afterPrev = el.time;
      el.seek(el.duration - 40);
      const ended = new Promise<boolean>((resolve) => el.addEventListener("ended", () => resolve(true), { once: true }));
      el.play();
      const wasPlaying = el.playing;
      const got = await Promise.race([ended, new Promise<boolean>((r) => setTimeout(() => r(false), 3000))]);
      return { afterNext, afterPrev, wasPlaying, got, finalTime: el.time, playing: el.playing };
    });
    assert.equal(r.afterNext, tl.steps![1].t);
    assert.equal(r.afterPrev, tl.steps![1].t);
    assert.ok(r.wasPlaying);
    assert.ok(r.got, "ended did not fire");
    assert.equal(r.finalTime, tl.duration);
    assert.equal(r.playing, false);
    await context.close();
  });

  it("under prefers-reduced-motion it shows the final frame and does not autoplay", async () => {
    const auto = join(dir, "auto.html");
    writeFileSync(auto, renderEmbedHtml(tl, { autoplay: true }));
    const { page, context } = await open(auto, { reducedMotion: "reduce" });
    const r = await page.evaluate(() => {
      const el = document.querySelector("vlm-anim") as HTMLElement & { time: number; duration: number; playing: boolean };
      return { time: el.time, duration: el.duration, playing: el.playing };
    });
    assert.equal(r.playing, false);
    assert.equal(r.time, r.duration);
    await context.close();
    const { page: p2, context: c2 } = await open(auto);
    await p2.waitForTimeout(150);
    const playing = await p2.evaluate(() => (document.querySelector("vlm-anim") as HTMLElement & { playing: boolean; time: number }).playing);
    assert.equal(playing, true, "autoplay should run without the reduced-motion preference");
    await c2.close();
  });

  it("the headless SVG frame and the live DOM agree on every node's position at a step", async () => {
    const dist = compileScene(EXAMPLES.distributed);
    const f = join(dir, "dist.html");
    writeFileSync(f, renderEmbedHtml(dist, { autoplay: false }));
    const { page, context } = await open(f);
    const t = dist.steps![2].t;
    const live = await page.evaluate(async (ms) => {
      const el = document.querySelector("vlm-anim") as HTMLElement & { seek(ms: number): void };
      el.seek(ms);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return [...document.querySelectorAll<SVGGElement>("vlm-anim svg > g[id]")].map((g) => [g.id, getComputedStyle(g).translate, getComputedStyle(g).opacity]);
    }, t);
    const frame = sampleFrame(dist, t);
    for (const [id, translate, opacity] of live) {
      const st = frame.get(id)!;
      const m = /^(-?[\d.]+)px\s+(-?[\d.]+)px$/.exec(translate) ?? [, "0", "0"];
      assert.ok(Math.abs(Number(m[1]) - st.pos[0]) < 1.5 && Math.abs(Number(m[2]) - st.pos[1]) < 1.5, `${id}: ${translate} vs ${st.pos}`);
      assert.ok(Math.abs(Number(opacity) - st.opacity) < 0.05, `${id}: opacity ${opacity} vs ${st.opacity}`);
    }
    // And the static render of the same instant names the same caption.
    assert.match(renderFrameSvg(dist, t), new RegExp(dist.steps![2].caption!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    await context.close();
  });
});

describe("contact sheet", () => {
  it("renders every step as a tile and screenshots to one PNG at the sheet's own width", async () => {
    const { renderSheetHtml } = await import("./sheet.ts");
    const { sampleTimes } = await import("./render-svg.ts");
    const tl = compileScene(EXAMPLES.heap);
    const times = sampleTimes(tl, 0);
    const html = renderSheetHtml(tl, times, { cols: 3, tileWidth: 240 });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.setContent(html);
    const info = await page.evaluate(() => ({ tiles: document.querySelectorAll("figure").length, width: document.body.getBoundingClientRect().width, svgs: document.querySelectorAll("figure svg").length }));
    assert.equal(info.tiles, times.length);
    assert.equal(info.svgs, times.length);
    assert.equal(info.width, 3 * 240 + 4 * 12);
    const png = join(dir, "sheet.png");
    await page.screenshot({ path: png, fullPage: true });
    assert.ok((await import("node:fs")).statSync(png).size > 5000);
    await context.close();
  });
});

describe("vlmkit check animation on an embedded page", () => {
  it("sees the runtime's animations as page motion: visible effect, settles, honours reduced motion", async () => {
    const tl = compileScene(EXAMPLES.vector);
    const file = join(dir, "vector.html");
    writeFileSync(file, renderEmbedHtml(tl, { autoplay: true }));
    const report = await runAnimationEval({ source: file, viewport: { width: 600, height: 400 }, samples: 4, maxAnimations: 8 });
    assert.ok(report.animationCount > 0, "gate found no animations");
    assert.ok(report.evaluated.length > 0, "gate evaluated no animation frame by frame");
    const suspects = report.issues.filter((f) => f.severity === "suspect");
    assert.deepEqual(suspects.map((f) => f.kind), [], JSON.stringify(report.issues, null, 2));
    assert.equal(report.reducedMotion?.remainingCount ?? 0, 0, "motion still running under prefers-reduced-motion");
  }, 120_000);
});
