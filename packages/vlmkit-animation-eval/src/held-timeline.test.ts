/**
 * `HOLD_TIMELINE_SCRIPT` and `openHeldTimeline` on real pages: what is seeked, what is left to the
 * page, and what survives a frame or a navigation. Every page is a file written to a temp dir and
 * navigated to — init scripts do not run for `setContent`.
 */
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, test } from "vite-plus/test";
import { openHeldTimeline, type HeldTimeline } from "./frames-capture.ts";

let browser: Browser;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

const SLIDE_CSS = `@keyframes slide { from { transform: translateX(0px); } to { transform: translateX(1000px); } }
  .box { width: 20px; height: 20px; background: #2255cc; }`;
const SLIDE_JS = `const slide = [{ transform: "translateX(0px)" }, { transform: "translateX(1000px)" }];`;

/** Files into a fresh dir; the URL of the first one. */
async function site(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "vlmkit-held-"));
  for (const [name, body] of Object.entries(files)) await writeFile(join(dir, name), body);
  return pathToFileURL(join(dir, Object.keys(files)[0]!)).href;
}

const doc = (body: string, css = "") =>
  `<!doctype html><html><head><meta charset="utf-8"><style>body { margin: 0; } ${SLIDE_CSS} ${css}</style></head><body>${body}</body></html>`;

async function held(html: string): Promise<{ page: Page; timeline: HeldTimeline }> {
  const page = await browser.newPage();
  const timeline = await openHeldTimeline(page, await site({ "page.html": html }));
  return { page, timeline };
}

/** The x of an element's transform, 0 for none. */
const shiftOf = (page: Page, selector: string) =>
  page.evaluate((s) => {
    const transform = getComputedStyle(document.querySelector(s)!).transform;
    return transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
  }, selector);

test("a held animation runs at its own playbackRate; one at rate 0 or below is the page's", async () => {
  const { page, timeline } = await held(
    doc(`<div id="a" class="box"></div><div id="b" class="box"></div><div id="c" class="box"></div>
    <script>${SLIDE_JS}
      const fast = a.animate(slide, { duration: 1000, fill: "forwards" });
      fast.playbackRate = 2;
      const still = b.animate(slide, { duration: 1000, fill: "forwards" });
      still.playbackRate = 0;
      const back = c.animate(slide, { duration: 1000, fill: "forwards" });
      back.currentTime = 800;
      back.playbackRate = -1;
      window.anims = { fast, still, back };
    </script>`),
  );
  try {
    await timeline.at(250);
    const at = await page.evaluate(() => {
      const anims = (window as unknown as { anims: Record<string, Animation> }).anims;
      return Object.fromEntries(Object.entries(anims).map(([k, a]) => [k, a.currentTime]));
    });
    assert.deepEqual(at, { fast: 500, still: 0, back: 800 });
    const listed = await timeline.animations();
    assert.deepEqual(listed[0], { startMs: 0, durationMs: 500, iterations: 1 }, "listed on the page's clock");
  } finally {
    await page.close();
  }
});

test("an animation the page pauses is the page's until it plays it, and then held again from where it was", async () => {
  const { page, timeline } = await held(
    doc(
      `<div id="a" class="box"></div><div id="b" class="box"></div><div id="c" class="box"></div>
    <script>${SLIDE_JS}
      const scrub = a.animate(slide, { duration: 1000, fill: "both" });
      scrub.pause();
      scrub.currentTime = 300;
      const resumed = c.animate(slide, { duration: 1000, fill: "both" });
      setTimeout(() => resumed.pause(), 200);
      setTimeout(() => resumed.play(), 400);
      window.anims = { scrub, resumed };
    </script>`,
      `#b { animation: slide 1000ms linear both; animation-play-state: paused; }`,
    ),
  );
  try {
    const read = () =>
      page.evaluate(() => {
        const anims = (window as unknown as { anims: Record<string, Animation> }).anims;
        return {
          scrub: anims.scrub!.currentTime,
          resumed: anims.resumed!.currentTime,
          css: document.getElementById("b")!.getAnimations()[0]!.currentTime,
        };
      });
    await timeline.at(100);
    assert.deepEqual(await read(), { scrub: 300, resumed: 100, css: 0 });
    await timeline.at(300);
    assert.deepEqual(await read(), { scrub: 300, resumed: 200, css: 0 }, "paused by the page at 200");
    await timeline.at(600);
    assert.deepEqual(await read(), { scrub: 300, resumed: 400, css: 0 }, "played at 400 from 200");
  } finally {
    await page.close();
  }
});

test("a cancelled animation, or a CSS one whose name its element dropped, is never revived by a seek", async () => {
  // `slide:in` is listed by computed style as `slide\:in`: still listed, so still seeked.
  const { page, timeline } = await held(
    doc(
      `<div id="a" class="box go"></div><div id="w" class="box"></div><div id="e" class="box"></div>
    <script>${SLIDE_JS}
      const wa = w.animate(slide, { duration: 1000, fill: "both" });
      setTimeout(() => a.classList.remove("go"), 300);
      setTimeout(() => wa.cancel(), 300);
      window.wa = wa;
    </script>`,
      `@keyframes slide\\:in { from { transform: translateX(0px); } to { transform: translateX(1000px); } }
      .go { animation: slide 1000ms linear both; }
      #e { animation: slide\\:in 1000ms linear both; }`,
    ),
  );
  try {
    await timeline.at(200);
    assert.deepEqual(
      [await shiftOf(page, "#a"), await shiftOf(page, "#w"), await shiftOf(page, "#e")],
      [200, 200, 200],
    );
    await timeline.at(500);
    await timeline.at(700);
    assert.deepEqual([await shiftOf(page, "#a"), await shiftOf(page, "#w"), await shiftOf(page, "#e")], [0, 0, 700]);
    const states = await page.evaluate(() => {
      const list = (window as unknown as { __vlmkitTimeline: { anim: Animation; cancelled?: boolean }[] })
        .__vlmkitTimeline;
      return list.map((h) => [(h.anim.effect as KeyframeEffect).target!.id, h.anim.playState, Boolean(h.cancelled)]);
    });
    assert.deepEqual(
      states.sort(),
      [
        ["a", "idle", true],
        ["e", "paused", false],
        ["w", "idle", true],
      ],
      "kept in the held list, marked",
    );
  } finally {
    await page.close();
  }
});

test("animations inside open shadow roots are held, from a declarative root and an attached one", async () => {
  const inner = `<style>${SLIDE_CSS} .in { width: 20px; height: 20px; animation: slide 1000ms linear both; }</style><div class="in"></div>`;
  const { page, timeline } = await held(
    doc(`<div id="decl"><template shadowrootmode="open">${inner}</template></div><div id="host"></div>
    <script>
      const root = host.attachShadow({ mode: "open" });
      root.innerHTML = ${JSON.stringify(inner)};
      setTimeout(() => {
        const late = document.createElement("div");
        late.className = "in";
        root.appendChild(late);
      }, 300);
    </script>`),
  );
  try {
    await timeline.at(300);
    await timeline.at(500);
    const times = await page.evaluate(() =>
      ["decl", "host"].map((id) =>
        [...document.getElementById(id)!.shadowRoot!.querySelectorAll(".in")].map(
          (el) => el.getAnimations()[0]?.currentTime ?? null,
        ),
      ),
    );
    assert.deepEqual(times, [[500], [500, 200]]);
  } finally {
    await page.close();
  }
});

test("SMIL runs on each outermost svg's own timeline: paused and seeked with the page, and listed", async () => {
  const { page, timeline } = await held(
    doc(`<svg id="s1" width="300" height="20"><rect id="r1" width="10" height="10"><animate attributeName="x" from="0" to="1000" dur="1s" begin="0s" fill="freeze"/></rect></svg>
    <svg id="s2" width="40" height="40"><circle r="5" cx="20" cy="20"><animate attributeName="r" values="5;15;5" dur="2s" repeatCount="indefinite"/></circle>
      <svg><rect width="5" height="5"><set attributeName="fill" to="red" begin="click"/></rect></svg></svg>
    <svg id="plain" width="10" height="10"><rect width="5" height="5"/></svg>
    <script>
      setTimeout(() => document.body.insertAdjacentHTML("beforeend",
        '<svg id="s3" width="300" height="20"><rect id="r3" width="10" height="10"><animate attributeName="x" from="0" to="1000" dur="1s" fill="freeze"/></rect></svg>'), 300);
    </script>`),
  );
  try {
    await timeline.at(250);
    const svg = (id: string) =>
      page.evaluate((i) => {
        const el = document.getElementById(i) as unknown as SVGSVGElement;
        return { time: Math.round(el.getCurrentTime() * 1000), paused: el.animationsPaused() };
      }, id);
    assert.deepEqual(await svg("s1"), { time: 250, paused: true });
    assert.deepEqual(await svg("s2"), { time: 250, paused: true });
    assert.equal(
      await page.evaluate(() => (document.getElementById("r1") as unknown as SVGRectElement).x.animVal.value),
      250,
    );
    assert.equal((await svg("plain")).paused, false, "an svg with no SMIL is left alone");
    const listed = await timeline.animations();
    assert.deepEqual(listed, [
      { startMs: 0, durationMs: 1000, iterations: 1 },
      { startMs: 0, durationMs: 2000, iterations: null },
      { startMs: 0, durationMs: 0, iterations: null },
    ]);
    await timeline.at(300);
    await timeline.at(500);
    assert.deepEqual(await svg("s3"), { time: 200, paused: true }, "an svg added at 300 begins there");
  } finally {
    await page.close();
  }
});

test("openHeldTimeline advances and seeks every frame, not only the main one", async () => {
  const page = await browser.newPage();
  try {
    const url = await site({
      "main.html": doc(`<iframe src="child.html" width="300" height="80"></iframe>`),
      "child.html": doc(
        `<div class="box" style="animation: slide 1000ms linear both"></div>
        <script>window.ticks = 0; (function tick() { ticks++; requestAnimationFrame(tick); })();</script>`,
      ),
    });
    const timeline = await openHeldTimeline(page, url);
    await timeline.at(500);
    const child = page.frames().find((f) => f !== page.mainFrame())!;
    const state = await child.evaluate(() => ({
      now: performance.now(),
      ticks: (window as unknown as { ticks: number }).ticks,
      css: document.querySelector(".box")!.getAnimations()[0]!.currentTime,
    }));
    assert.deepEqual(state, { now: 500, ticks: 1 + 30, css: 500 });
  } finally {
    await page.close();
  }
});

test("a page that navigates during the sweep: the new document starts its time where it left", async () => {
  const page = await browser.newPage();
  try {
    const url = await site({
      "a.html": doc(`<script>setTimeout(() => { location.href = "b.html"; }, 300);</script>`),
      "b.html": doc(`<div class="box" style="animation: slide 1000ms linear both"></div>`),
    });
    const timeline = await openHeldTimeline(page, url);
    for (let t = 0; t <= 1000; t += 100) await timeline.at(t);
    assert.equal(timeline.navigations(), 1);
    assert.match(page.url(), /b\.html$/);
    assert.deepEqual(
      await page.evaluate(() => ({
        now: performance.now(),
        css: document.querySelector(".box")!.getAnimations()[0]!.currentTime,
      })),
      { now: 700, css: 700 },
    );
    assert.deepEqual(await timeline.animations(), [{ startMs: 300, durationMs: 1000, iterations: 1 }]);
  } finally {
    await page.close();
  }
});

test("a page that keeps navigating is refused with a clear error after five navigations", async () => {
  const page = await browser.newPage();
  try {
    const url = await site({ "loop.html": doc(`<script>setTimeout(() => location.reload(), 0);</script>`) });
    await assert.rejects(openHeldTimeline(page, url), /page navigated more than 5 times during the sweep/);
  } finally {
    await page.close();
  }
});
