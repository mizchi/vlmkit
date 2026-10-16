/**
 * `click` with `describe`: a target found on a screenshot, for a UI whose DOM is not what is
 * drawn. The page is a canvas with one painted button and no element to select. Jev's HTTP
 * endpoint is faked at `fetch`, so the test runs the real path from `executeStep` through
 * `locateByDescription` and `askJev` to `page.mouse.click`, with no key spent.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "vite-plus/test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import { runInteract } from "./interact.ts";

const dir = mkdtempSync(join(tmpdir(), "vlmkit-interact-describe-"));
const VIEW = { width: 800, height: 600 };
/** The painted button, CSS px. */
const BUTTON = { x: 300, y: 260, width: 200, height: 80 };

const page = join(dir, "canvas.html");
writeFileSync(
  page,
  `<!doctype html><meta charset="utf-8"><title>canvas app</title>
<style>body { margin: 0 } canvas { display: block }</style>
<canvas id="c" width="${VIEW.width}" height="${VIEW.height}"></canvas>
<script>
  const c = document.getElementById("c"), g = c.getContext("2d");
  const B = ${JSON.stringify(BUTTON)};
  let saved = false;
  function draw() {
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = saved ? "#1a7f37" : "#2d6cdf"; g.fillRect(B.x, B.y, B.width, B.height);
    g.fillStyle = "#fff"; g.font = "24px sans-serif"; g.fillText(saved ? "Saved" : "Save", B.x + 70, B.y + 48);
  }
  c.addEventListener("click", (e) => {
    const r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (x >= B.x && x < B.x + B.width && y >= B.y && y < B.y + B.height) { saved = true; draw(); }
    window.__clicks = (window.__clicks || []).concat([[x, y]]);
  });
  draw();
</script>`,
);

function sequence(name: string, steps: unknown[]): string {
  const file = join(dir, `${name}.json`);
  writeFileSync(file, JSON.stringify({ viewport: VIEW, steps }));
  return file;
}

type Asked = { questions: string[]; size: { width: number; height: number } };

/**
 * A fake Jev at `fetch`. The first look's `box` is the painted button in fractions of the image it
 * was sent; the crop's is its middle fifth, which the crop is centred on. `noul` is `presence`.
 */
function fakeJev(presence: number) {
  const asked: Asked[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const form = init!.body as FormData;
    const req = JSON.parse(await (form.get("request") as Blob).text());
    const img = PNG.sync.read(Buffer.from(await (form.get("a0") as Blob).arrayBuffer()));
    const first = asked.length === 0;
    asked.push({ questions: Object.keys(req.questions), size: { width: img.width, height: img.height } });
    const box = first
      ? {
          left: BUTTON.x / VIEW.width,
          right: (BUTTON.x + BUTTON.width) / VIEW.width,
          top: BUTTON.y / VIEW.height,
          bottom: (BUTTON.y + BUTTON.height) / VIEW.height,
        }
      : { left: 0.4, right: 0.6, top: 0.4, bottom: 0.6 };
    const answers: Record<string, unknown> = {};
    for (const [k, q] of Object.entries(req.questions as Record<string, { type: string }>)) {
      answers[k] = q.type === "box" ? { type: "box", box, confidence: 0.8 } : { type: "noul", noul: presence };
    }
    return Response.json({ model: "jev-fake", answers, usage: { input_tokens: 3000, output_tokens: 2 } });
  }) as typeof fetch;
  return { asked, restore: () => (globalThis.fetch = real) };
}

describe("inspect interact: click with describe", () => {
  const saved = { a: process.env.TYPESAFEAI_API_KEY, b: process.env.TYPESAFE_API_KEY };
  let restore = () => {};
  beforeEach(() => {
    process.env.TYPESAFEAI_API_KEY = "test-key";
  });
  afterEach(() => {
    restore();
    for (const [k, v] of [
      ["TYPESAFEAI_API_KEY", saved.a],
      ["TYPESAFE_API_KEY", saved.b],
    ] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("clicks a painted button no selector can reach, at the centre of the located box", async () => {
    const jev = fakeJev(0.97);
    restore = jev.restore;
    const report = await runInteract({
      source: page,
      sequencePath: sequence("found", [
        { action: "snapshot", name: "before" },
        { action: "click", describe: 'the "Save" button' },
        { action: "snapshot", name: "after" },
      ]),
      outputDir: join(dir, "out-found"),
    });
    assert.deepEqual(report.stepFailures, []);
    assert.equal(report.locatedClicks?.length, 1);
    const c = report.locatedClicks![0]!;
    assert.equal(c.describe, 'the "Save" button');
    assert.equal(c.presence, 0.97);
    // On the button: the crop is centred on the first box, and its middle fifth is the centre.
    assert.ok(Math.abs(c.point.x - (BUTTON.x + BUTTON.width / 2)) <= 1, JSON.stringify(c.point));
    assert.ok(Math.abs(c.point.y - (BUTTON.y + BUTTON.height / 2)) <= 1, JSON.stringify(c.point));
    // Asked as the locator asks: presence and where on the viewport (CSS scale), then where on the crop.
    assert.deepEqual(
      jev.asked.map((a) => a.questions),
      [["where", "present"], ["where"]],
    );
    assert.deepEqual(jev.asked[0]!.size, VIEW);
    // The click landed: the canvas redrew the button green.
    assert.ok(report.transitions[0]!.diffPixels > 0);
  });

  it("reports a step failure naming Jev's answer when the description is not on screen, and clicks nothing", async () => {
    const jev = fakeJev(0.02);
    restore = jev.restore;
    const report = await runInteract({
      source: page,
      sequencePath: sequence("missing", [
        { action: "snapshot", name: "before" },
        { action: "click", describe: "the Delete account link" },
        { action: "snapshot", name: "after" },
      ]),
      outputDir: join(dir, "out-missing"),
    });
    assert.equal(report.locatedClicks, undefined);
    assert.equal(report.stepFailures.length, 1);
    assert.match(
      report.stepFailures[0]!.message,
      /nothing on screen matches "the Delete account link" \(Jev presence 0\.02\)/,
    );
    assert.equal(report.stepFailures[0]!.suggestions, undefined);
    assert.equal(report.transitions[0]!.diffPixels, 0);
    assert.equal(jev.asked.length, 1);
  });

  it("refuses before the browser starts: no key, or a click with both or neither target", async () => {
    delete process.env.TYPESAFEAI_API_KEY;
    await assert.rejects(
      runInteract({
        source: page,
        sequencePath: sequence("nokey", [
          { action: "snapshot", name: "s" },
          { action: "click", describe: "the Save button" },
        ]),
        outputDir: join(dir, "out-nokey"),
      }),
      (e: Error) => e.name === "UsageError" && /step 1: .*TYPESAFEAI_API_KEY/.test(e.message),
    );
    process.env.TYPESAFEAI_API_KEY = "k";
    for (const [name, step, word] of [
      ["both", { action: "click", selector: "#c", describe: "the Save button" }, "both"],
      ["neither", { action: "click" }, "neither"],
    ] as const) {
      await assert.rejects(
        runInteract({
          source: page,
          sequencePath: sequence(name, [{ action: "snapshot", name: "s" }, step]),
          outputDir: join(dir, `out-${name}`),
        }),
        (e: Error) => e.name === "UsageError" && e.message.includes(`not ${word}`),
      );
    }
  });
});
