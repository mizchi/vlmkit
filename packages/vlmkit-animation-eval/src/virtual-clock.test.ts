/**
 * `check animation --virtual-time`: the page clock held from document start and driven by the
 * evaluator (`virtual-clock.ts`). Ground truth is the page's own script — a 600ms rAF entrance
 * ends at 600ms of virtual time, a loop with no exit never does.
 *
 * Without the clock, every page below came back as `uncontrolled-motion` ("mask the region or
 * stub the ticker") or, for the timer carousel, as nothing at all.
 */
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";
import { clockSettledAt, deriveAnimationIssues, runAnimationEval } from "./animation-eval.ts";
import { VIRTUAL_CLOCK_SCRIPT } from "./virtual-clock.ts";

async function scriptPage(script: string, extraCss = ""): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-clock-"));
  const path = join(dir, "page.html");
  await writeFile(path, `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; padding: 20px; background: #fff; }
    #a { width: 120px; height: 60px; background: #2255cc; }
    ${extraCss}
  </style></head><body><div id="a"></div><script>const a = document.getElementById("a");${script}</script></body></html>`);
  return path;
}

const ENTRANCE = `const t0 = performance.now();
  (function loop(now) { const p = Math.min(1, (now - t0) / 600); a.style.transform = "translateX(" + 300 * p + "px)"; if (p < 1) requestAnimationFrame(loop); })(t0);`;
const SPINNER = `(function loop(now) { a.style.transform = "rotate(" + (now / 5) % 360 + "deg)"; requestAnimationFrame(loop); })(0);`;

test("clockSettledAt: the last moving instant, or null when the final interval still moved", () => {
  const f = (n: number) => ({ changedPixels: n, ratio: 0, bbox: null });
  assert.equal(clockSettledAt([250, 500, 750, 1000], [f(900), f(900), f(0), f(0)], 12), 500);
  assert.equal(clockSettledAt([250, 500, 750, 1000], [f(0), f(0), f(0), f(900)], 12), null);
  assert.equal(clockSettledAt([250, 500], [f(0), f(5)], 12), 0, "below the pixel floor is not motion");
});

test("clock-motion-unsettled fires for an endless loop; a settled one past the threshold is long-settle", () => {
  const base = { evaluated: [], settleMs: 0, infinite: [], virtualTime: true };
  const clock = { windowMs: 2000, times: [1000, 2000], frames: [], motionBbox: { x: 1, y: 2, width: 3, height: 4 }, visible: true, errors: [] };
  assert.deepEqual(
    deriveAnimationIssues({ ...base, clockMotion: { ...clock, settledAtMs: null } }).map((i) => i.kind),
    ["clock-motion-unsettled"],
  );
  assert.deepEqual(
    deriveAnimationIssues({ ...base, clockMotion: { ...clock, settledAtMs: 3500 } }, { settleThresholdMs: 3000 }).map((i) => i.kind),
    ["long-settle"],
  );
  assert.deepEqual(deriveAnimationIssues({ ...base, clockMotion: { ...clock, settledAtMs: 600 } }), []);
});

test("uncontrolled-motion points at --virtual-time without it, and names what is left with it", () => {
  const moved = { changedPixels: 500, ratio: 0.01, bbox: { x: 0, y: 0, width: 10, height: 10 } };
  const off = deriveAnimationIssues({ evaluated: [], settleMs: 0, infinite: [], uncontrolledMotion: moved });
  assert.match(off[0]!.message, /--virtual-time/);
  const on = deriveAnimationIssues({ evaluated: [], settleMs: 0, infinite: [], uncontrolledMotion: moved, virtualTime: true });
  assert.match(on[0]!.message, /page clock held/);
  assert.doesNotMatch(on[0]!.message, /Re-run with/);
});

test("the clock is held: Date, performance.now and rAF only move when the evaluator advances them", { timeout: 60_000 }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript(VIRTUAL_CLOCK_SCRIPT);
    // A navigation, not `setContent`: init scripts run per new document, and setContent
    // writes into the existing about:blank one, so the page would see the real clock.
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-clock-"));
    await writeFile(join(dir, "held.html"), `<script>
      window.log = [];
      window.startDate = Date.now();
      requestAnimationFrame((t) => log.push("raf@" + Math.round(t)));
      setTimeout(() => log.push("timeout@" + Math.round(performance.now())), 100);
      let n = 0; const id = setInterval(() => { if (++n === 3) clearInterval(id); log.push("interval@" + Math.round(performance.now())); }, 40);
    </script>`);
    await page.goto(`file://${join(dir, "held.html")}`);
    await page.waitForTimeout(300);
    const held = await page.evaluate(() => ({ now: performance.now(), date: Date.now() - (window as any).startDate, log: [...(window as any).log] }));
    assert.deepEqual(held, { now: 0, date: 0, log: [] }, "300ms of real time moved nothing");
    await page.evaluate(() => (window as any).__vlmkitClock.advanceTo(200));
    const after = await page.evaluate(() => ({ now: performance.now(), date: Date.now() - (window as any).startDate, log: [...(window as any).log] }));
    assert.equal(after.now, 200);
    assert.equal(after.date, 200);
    assert.deepEqual(after.log, ["raf@17", "interval@40", "interval@80", "timeout@100", "interval@120"]);
    assert.ok(await page.evaluate(() => new Date() instanceof Date), "a held Date is still a Date");
  } finally {
    await browser.close();
  }
});

test("--virtual-time: a rAF entrance is measured and settles, instead of reading as uncontrolled", { timeout: 120_000 }, async () => {
  const source = await scriptPage(ENTRANCE);
  const report = await runAnimationEval({ source, virtualTime: true, skipReducedMotion: true });
  assert.equal(report.uncontrolledMotion, undefined, "with the clock held nothing moves between the rest captures");
  assert.ok(report.clockMotion?.visible, "the entrance moved 300px");
  assert.ok(report.clockMotion!.settledAtMs !== null && report.clockMotion!.settledAtMs <= 1000, `settled at ${report.clockMotion!.settledAtMs}`);
  assert.deepEqual(report.issues, []);
});

test("--virtual-time: an endless rAF loop is clock-motion-unsettled, not uncontrolled-motion", { timeout: 120_000 }, async () => {
  const report = await runAnimationEval({ source: await scriptPage(SPINNER), virtualTime: true, skipReducedMotion: true });
  assert.deepEqual(report.issues.map((i) => i.kind), ["clock-motion-unsettled"]);
});

test("--virtual-time: a setInterval carousel, which the real-clock rest probe missed, is measured", { timeout: 120_000 }, async () => {
  const source = await scriptPage(`let i = 0; setInterval(() => { i = (i + 1) % 3; a.style.background = ["#2255cc", "#cc5522", "#22aa55"][i]; }, 500);`);
  const real = await runAnimationEval({ source, skipReducedMotion: true });
  assert.deepEqual(real.issues, [], "the back-to-back rest captures fall between two ticks");
  const held = await runAnimationEval({ source, virtualTime: true, skipReducedMotion: true });
  assert.ok(held.clockMotion?.visible);
  assert.ok(held.issues.some((i) => i.kind === "clock-motion-unsettled"));
});

test("--virtual-time: script motion that ignores prefers-reduced-motion is reported; one that reads it is not", { timeout: 180_000 }, async () => {
  const ignores = await runAnimationEval({ source: await scriptPage(SPINNER), virtualTime: true });
  assert.ok(ignores.reducedMotion && ignores.reducedMotion.remainingCount === 1, JSON.stringify(ignores.reducedMotion));
  const issue = ignores.issues.find((i) => i.kind === "reduced-motion-ignored");
  assert.match(issue?.message ?? "", /matchMedia/);

  const honours = await runAnimationEval({
    source: await scriptPage(`const rm = matchMedia("(prefers-reduced-motion: reduce)").matches;
      (function loop(now) { a.style.transform = "rotate(" + (now / 5) % 360 + "deg)"; if (!rm) requestAnimationFrame(loop); })(0);`),
    virtualTime: true,
  });
  assert.equal(honours.reducedMotion?.remainingCount, 0);
});

test("--virtual-time: a page that draws on vlmkit:seek is sampled at the instants it is given", { timeout: 120_000 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-clock-"));
  const source = join(dir, "canvas.html");
  await writeFile(source, `<!doctype html><html><body style="margin:0;background:#fff"><canvas id="c" width="400" height="100"></canvas><script>
    const c = document.getElementById("c").getContext("2d");
    const draw = (t) => { c.clearRect(0, 0, 400, 100); c.fillStyle = "#2255cc"; c.fillRect(Math.min(300, t / 5), 20, 80, 60); };
    addEventListener("vlmkit:seek", (e) => e.detail.waitUntil(Promise.resolve().then(() => draw(e.detail.timeMs))));
    draw(0);
  </script></body></html>`);
  const report = await runAnimationEval({ source, virtualTime: true, skipReducedMotion: true });
  assert.ok(report.clockMotion?.visible);
  assert.equal(report.clockMotion?.settledAtMs, 1500, "it stops at x=300, i.e. t=1500ms");
});

test("--virtual-time: a ticker over a CSS animation no longer makes the animation seek-ineffective", { timeout: 120_000 }, async () => {
  const source = await scriptPage(
    `let h = 0; (function loop() { h = (h + 7) % 360; a.style.background = "hsl(" + h + ",70%,45%)"; requestAnimationFrame(loop); })();`,
    `@keyframes slide { from { transform: translateX(0); } to { transform: translateX(300px); } }
     #a { animation: slide 2000ms linear 1 forwards; }`,
  );
  const real = await runAnimationEval({ source, skipReducedMotion: true });
  assert.equal(real.evaluated[0]?.seekIneffective?.reason, "replay");
  const held = await runAnimationEval({ source, virtualTime: true, skipReducedMotion: true });
  assert.equal(held.evaluated[0]?.seekIneffective, undefined);
  assert.equal(held.evaluated[0]?.visible, true);
});
