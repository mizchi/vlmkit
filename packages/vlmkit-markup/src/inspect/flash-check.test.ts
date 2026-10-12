/**
 * `check flash` on `fixtures/flash/`: one page per known answer (`expected.json` holds them),
 * captured on the held clock at 400x300 — the 341x256 field fits, and a 1.5s window is enough for
 * 7 transitions of a 4 Hz strobe. Then what only a sequence on disk can show: the saved frames
 * judged again give the same answer, thinned frames say what they can no longer back, and the
 * strip is one still image.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, test } from "vite-plus/test";
import type { FramesManifest } from "@mizchi/vlmkit-judge/frames.ts";
import { chooseWindow, manifestComplete, mergeUncontrolled, runFlashCheck, type FlashReport } from "./flash-check.ts";

const fixtures = join(import.meta.dirname, "../../../../fixtures/flash");
interface Expected {
  general: string;
  red: string;
  classification?: string;
  redClassification?: string;
  reason?: string;
  areaCss2?: number;
  redAreaCss2?: number;
  largestBelowCss2?: number;
  peakTransitions?: number;
  still?: boolean;
  unmeasured?: string[];
  /** "default": the sweep chooses (a still page is only found then). */
  windowMs?: number | "default";
  navigations?: number;
}
const expected = JSON.parse(await readFile(join(fixtures, "expected.json"), "utf8")) as {
  viewport: { width: number; height: number };
  windowMs: number;
  pages: Record<string, Expected>;
};

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

const check = (name: string, extra: Partial<Parameters<typeof runFlashCheck>[0]> = {}) => {
  const own = expected.pages[name]?.windowMs;
  return runFlashCheck({
    source: join(fixtures, `${name}.html`),
    browser,
    viewport: expected.viewport,
    ...(own === "default" ? {} : { windowMs: own ?? expected.windowMs }),
    ...extra,
  });
};

describe("check flash: the known answers", () => {
  for (const [name, want] of Object.entries(expected.pages)) {
    test(`${name}: general ${want.general}, red ${want.red}`, { timeout: 120_000 }, async () => {
      const r = await check(name);
      const why = JSON.stringify({ general: r.general, red: r.red, sampling: r.sampling, unmeasured: r.unmeasured });
      assert.equal(r.general.verdict, want.general, why);
      assert.equal(r.red.verdict, want.red, why);
      if (want.classification) assert.equal(r.general.classification, want.classification, why);
      if (want.redClassification) assert.equal(r.red.classification, want.redClassification, why);
      if (want.reason) assert.equal(r.general.reason, want.reason, why);
      if (want.areaCss2 !== undefined) assert.equal(r.general.worst?.areaCss2, want.areaCss2, why);
      if (want.redAreaCss2 !== undefined) assert.equal(r.red.worst?.areaCss2, want.redAreaCss2, why);
      if (want.largestBelowCss2 !== undefined) assert.equal(r.general.largestBelowCss2, want.largestBelowCss2, why);
      if (want.peakTransitions !== undefined) assert.equal(r.general.peakTransitions, want.peakTransitions, why);
      assert.equal(r.sampling.still, want.still ?? false, why);
      for (const reason of want.unmeasured ?? []) {
        assert.ok(
          r.unmeasured.some((u) => u.reason === reason),
          why,
        );
      }
      if (!want.unmeasured) assert.deepEqual(r.unmeasured, [], why);
      assert.equal(r.sampling.navigations, want.navigations ?? 0, why);
      if (!want.still) {
        assert.equal(r.sampling.frames, Math.round((r.sampling.windowMs * 60) / 1000) + 1, why);
        if (!want.unmeasured) assert.equal(r.sampling.complete, true, why);
      }
    });
  }
});

describe("check flash: a sequence on disk", () => {
  let dir: string;
  let live: FlashReport;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "flash-test-"));
    live = await check("strobe-4hz", { framesDir: join(dir, "frames"), stripPath: join(dir, "strip.png") });
  }, 120_000);
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("the saved frames, judged again with no browser, give the live answer", { timeout: 120_000 }, async () => {
    const again = await runFlashCheck({ source: join(dir, "frames", "frames.json") });
    assert.equal(again.source.kind, "frames");
    assert.equal(again.sampling.complete, true);
    for (const track of ["general", "red"] as const) {
      assert.equal(again[track].verdict, live[track].verdict);
      assert.deepEqual(again[track].worst, live[track].worst);
      assert.equal(again[track].peakTransitions, live[track].peakTransitions);
    }
  });

  test("the strip is one still PNG: the frame before the first transition, then each one", async () => {
    const png = await readFile(join(dir, "strip.png"));
    assert.equal(png.subarray(1, 4).toString("latin1"), "PNG");
    assert.ok(!png.includes(Buffer.from("acTL")), "an animated PNG of a failing window would itself strobe");
    assert.equal(live.strip, join(dir, "strip.png"));
  });

  const thinned = async (keep: (i: number) => boolean, name: string) => {
    const manifest = JSON.parse(await readFile(join(dir, "frames", "frames.json"), "utf8")) as FramesManifest;
    manifest.frames = manifest.frames.filter((_, i) => keep(i));
    const path = join(dir, "frames", `${name}.json`);
    await writeFile(path, JSON.stringify(manifest));
    return { manifest, report: await runFlashCheck({ source: path }) };
  };

  test("every other frame still fails: sampling only removes transitions", { timeout: 120_000 }, async () => {
    const { manifest, report } = await thinned((i) => i % 2 === 0, "half");
    assert.equal(manifestComplete(manifest), false);
    assert.equal(report.sampling.complete, false);
    assert.equal(report.general.verdict, "fail");
  });

  test(
    "frames 200ms apart cannot hold 7 transitions in a second: not judgeable, never a pass",
    { timeout: 120_000 },
    async () => {
      const { report } = await thinned((i) => i % 12 === 0, "sparse");
      assert.equal(report.sampling.judgeable, false);
      assert.equal(report.general.verdict, "not-judgeable");
    },
  );
});

describe("check flash: what the held clock does not hold", () => {
  test("boxes that touch are one region; boxes apart stay apart", () => {
    const at = (x: number, y: number, w = 20, h = 20) => ({
      reason: "uncontrolled" as const,
      rect: { x, y, width: w, height: h },
    });
    // Two spinners at opposite corners: two small regions, not one the size of the viewport.
    assert.deepEqual(
      mergeUncontrolled([at(0, 0), at(1000, 600)]).map((r) => r.rect),
      [
        { x: 0, y: 0, width: 20, height: 20 },
        { x: 1000, y: 600, width: 20, height: 20 },
      ],
    );
    // One thing seen at two moments, a few pixels apart.
    assert.deepEqual(
      mergeUncontrolled([at(0, 0), at(24, 4)]).map((r) => r.rect),
      [{ x: 0, y: 0, width: 44, height: 24 }],
    );
    const video = { reason: "video" as const, rect: { x: 0, y: 0, width: 10, height: 10 } };
    assert.deepEqual(mergeUncontrolled([video, at(5, 5)])[0], video, "media regions are kept as they are");
  });
});

describe("check flash: the window", () => {
  const ms = (...args: Parameters<typeof chooseWindow>) => chooseWindow(...args).windowMs;
  test("from the page's animations: each finite end, 3s for what repeats or runs by script, 2s to 10s", () => {
    assert.equal(ms([], false), 2000);
    assert.equal(ms([], true), 3000);
    assert.equal(ms([{ startMs: 0, durationMs: 400, iterations: 3 }], false), 2000);
    assert.equal(ms([{ startMs: 1000, durationMs: 2000, iterations: 2 }], false), 5000);
    assert.equal(ms([{ startMs: 0, durationMs: 250, iterations: null }], false), 3000);
  });
  test("what repeats forever is swept one period past its start and a second more: every second of its cycle", () => {
    assert.equal(ms([{ startMs: 2508.3, durationMs: 250, iterations: null }], false), 3800);
    assert.equal(ms([{ startMs: 0, durationMs: 4000, iterations: null }], false), 5000);
  });
  test("a timer pending at load is followed two seconds past it", () => {
    assert.equal(ms([], true, 2500), 4500);
    assert.equal(ms([], true, 100), 3000);
  });
  test("past the 10s cap the window is cut, and says so", () => {
    assert.deepEqual(chooseWindow([{ startMs: 0, durationMs: 60_000, iterations: 1 }], false), {
      windowMs: 10_000,
      truncated: true,
    });
    assert.deepEqual(chooseWindow([], false), { windowMs: 2000, truncated: false });
  });
});

test(
  "the solitaire deal flickers per pixel and is motion: cards sliding, turning and fading in",
  { timeout: 300_000 },
  async () => {
    const r = await runFlashCheck({
      source: join(import.meta.dirname, "../../../../examples/solitaire/index.html"),
      browser,
    });
    assert.equal(r.general.verdict, "pass", JSON.stringify(r.general));
    assert.equal(r.general.classification, "motion", JSON.stringify(r.general));
    assert.ok(r.general.worst!.areaCss2 > 21_824, "per-pixel counting alone fails it");
    assert.ok(r.general.animations!.length > 0, "the cards' animations are named");
  },
);
