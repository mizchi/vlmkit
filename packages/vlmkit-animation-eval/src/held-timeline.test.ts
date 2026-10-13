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
import { chromium, type Browser, type Frame, type Page } from "playwright";
import { afterAll, beforeAll, test } from "vite-plus/test";
import { openHeldTimeline, type HeldTimeline } from "./frames-capture.ts";
import { HOLD_TIMELINE_SCRIPT, VIRTUAL_CLOCK_SCRIPT } from "./virtual-clock.ts";

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

test("a held animation runs at its own playbackRate, backwards too; one at rate 0 is the page's", async () => {
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
    // back: set to 800 and reversed at page time 0, so 250ms later it is at 550. Before, the hold
    // left a negative rate alone, and its own pause froze it at 800.
    assert.deepEqual(at, { fast: 500, still: 0, back: 550 });
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

const FADE_JS = `const fade = [{ opacity: 0.2 }, { opacity: 1 }];`;
type Win = Window & Record<string, unknown>;

test("a seek past a held animation's end finishes it: finished and onfinish run once, and what they start begins at that end", async () => {
  // Before, a held animation was only ever paused and had its currentTime written, so its finished
  // promise never resolved and its finish event never fired: none of the next stages below existed.
  const { page, timeline } = await held(
    doc(
      `<div id="a" class="box"></div><div id="b" class="box"></div><div id="c" class="box"></div><div id="d" class="box"></div>
    <script>${SLIDE_JS} ${FADE_JS}
      window.log = [];
      (async () => {
        await a.animate(fade, { duration: 300 }).finished;
        log.push("a finished");
        window.second = a.animate(slide, { duration: 1000, iterations: Infinity });
      })();
      window.intro = b.animate(fade, { duration: 300 });
      intro.onfinish = () => {
        log.push("b onfinish");
        window.third = b.animate(slide, { duration: 1000, iterations: Infinity });
      };
      // Two stages that both end before one coarse instant: the second is started at the first's
      // end and ended at its own (400), and what follows it begins there.
      (async () => {
        await d.animate(fade, { duration: 300 }).finished;
        await d.animate(fade, { duration: 100 }).finished;
        window.chained = d.animate(slide, { duration: 1000, iterations: Infinity });
      })();
      c.addEventListener("animationend", () => log.push("c animationend"));
      c.getAnimations()[0].finished.then(() => log.push("c finished"));
    </script>`,
      `#c { animation: slide 300ms linear 2 both; }`,
    ),
  );
  try {
    const read = () =>
      page.evaluate(() => {
        const w = window as unknown as Win;
        const time = (name: string) => (w[name] ? (w[name] as Animation).currentTime : null);
        return {
          second: time("second"),
          third: time("third"),
          chained: time("chained"),
          intro: [(w.intro as Animation).playState, (w.intro as Animation).currentTime],
          log: [...(w.log as string[])].sort(),
        };
      });
    await timeline.at(250);
    assert.deepEqual(await read(), { second: null, third: null, chained: null, intro: ["paused", 250], log: [] });
    // A coarse step past the end: the next stages begin at 300 (the intro's end), not at 500.
    await timeline.at(500);
    assert.deepEqual(await read(), {
      second: 200,
      third: 200,
      chained: 100,
      intro: ["finished", 300],
      log: ["a finished", "b onfinish"],
    });
    for (const t of [700, 1000, 1200]) await timeline.at(t);
    assert.deepEqual(await read(), {
      second: 900,
      third: 900,
      chained: 800,
      intro: ["finished", 300],
      // The CSS animation's end is the phase change, once; finish() on it adds no second animationend.
      log: ["a finished", "b onfinish", "c animationend", "c finished"],
    });
    const listed = await timeline.animations();
    assert.deepEqual(
      listed.filter((a) => a.iterations === null).map((a) => a.startMs),
      [300, 300, 400],
      "listed from the ends they began at",
    );
    // check flash attributes a window by seeking back to its middle: the ended intro is paused and
    // put back there, not left to run on the real clock.
    await page.evaluate(() =>
      (window as unknown as { __vlmkitSeekTimeline(t: number): number }).__vlmkitSeekTimeline(150),
    );
    await page.waitForTimeout(150);
    const back = await page.evaluate(() => {
      const intro = (window as unknown as Win).intro as Animation;
      return [intro.playState, intro.currentTime];
    });
    assert.deepEqual(back, ["paused", 150]);
  } finally {
    await page.close();
  }
});

test("an iframe inserted later starts at its own 0 where it is first seen, and again when it navigates", async () => {
  // Before, every frame was advanced to the main document's time, so an iframe inserted at 1000ms
  // ran its first second in one step: all ten toggles of its interval at once.
  const page = await browser.newPage();
  try {
    const url = await site({
      "main.html": doc(`<script>setTimeout(() => {
        const frame = document.createElement("iframe");
        frame.src = "child.html";
        document.body.appendChild(frame);
      }, 1000);</script>`),
      "child.html": doc(`<script>window.toggles = 0; setInterval(() => toggles++, 100);
        setTimeout(() => { location.href = "child2.html"; }, 500);</script>`),
      "child2.html": doc(`<script>window.toggles = 0; setInterval(() => toggles++, 100);</script>`),
    });
    const timeline = await openHeldTimeline(page, url);
    const seen: { t: number; doc: string; now: number; toggles: number }[] = [];
    for (let k = 0; k <= 150; k++) {
      const t = (k * 1000) / 60;
      await timeline.at(t);
      const child = page.frames().find((f) => f !== page.mainFrame());
      if (!child) continue;
      const state = await child
        .evaluate(() => ({
          doc: location.pathname.split("/").pop() ?? "",
          now: performance.now(),
          toggles: (window as unknown as { toggles?: number }).toggles ?? -1,
        }))
        .catch(() => null);
      if (state && state.toggles >= 0) seen.push({ t, ...state });
    }
    for (const name of ["child.html", "child2.html"]) {
      const runs = seen.filter((s) => s.doc === name);
      assert.ok(runs.length > 10, `${name} was seen (${runs.length})`);
      // The read after an instant can find a document that committed since it, before any instant
      // has put it at its 0: the last of its leading zeros is the instant that did.
      const zeros = runs.filter((s) => s.now === 0);
      assert.ok(zeros.length >= 1 && zeros.length <= 2, `${name} at 0 at ${zeros.map((s) => s.t).join(", ")}`);
      const begun = zeros[zeros.length - 1]!;
      assert.ok(begun.t >= 1000 && begun.toggles === 0, `${name} begins at its own 0 (${JSON.stringify(begun)})`);
      // From then on it is stepped with the sweep: its time is the sweep's less the instant it began.
      const drift = runs.filter((s) => s.t >= begun.t && Math.abs(s.now - (s.t - begun.t)) > 1e-6);
      assert.deepEqual(drift, [], `${name} stepped with the sweep`);
      const later = runs.find((s) => s.now >= 300)!;
      assert.equal(later.toggles, 3, `${name} toggled three times in its first 300ms`);
    }
  } finally {
    await page.close();
  }
});

test("an animation found finished while the clock is at 0 ran out during load, and is held from 0", async () => {
  // A declarative shadow root's animationstart is not composed, and a page can stop one before the
  // document hears it: either animation is found by the first sweep, after the real time load
  // took. Before, both were left frozen at their ends. (A long task at load does not do it on
  // Chromium 141: the start time resolves after the task.) One the page finished itself stays the
  // page's.
  const inner = `<style>${SLIDE_CSS} .in { animation: slide 100ms linear 4 both; }</style><div class="in box"></div>`;
  const page = await browser.newPage();
  try {
    await page.addInitScript(VIRTUAL_CLOCK_SCRIPT);
    await page.addInitScript(HOLD_TIMELINE_SCRIPT);
    await page.goto(
      await site({
        "page.html": doc(
          `<div id="host"><template shadowrootmode="open">${inner}</template></div>
          <div id="long" class="box"></div><div id="done" class="box"></div>
          <script>${SLIDE_JS}
            window.done = document.getElementById("done").animate(slide, { duration: 300, fill: "forwards" });
            done.finish();
            window.addEventListener("animationstart", (event) => event.stopPropagation(), true);
          </script>`,
          `#long { animation: slide 100ms linear 4 both; }`,
        ),
      }),
    );
    // More real time than the 400ms the animations last, before the first sweep finds them.
    await page.waitForTimeout(600);
    const at = (t: number) =>
      page.evaluate(async (ms) => {
        const w = window as unknown as {
          __vlmkitClock: { advanceTo(ms: number): Promise<number> };
          __vlmkitSeekTimeline(t: number): number;
          done: Animation;
        };
        await w.__vlmkitClock.advanceTo(ms);
        w.__vlmkitSeekTimeline(ms);
        const one = (a: Animation) => [a.playState, a.currentTime];
        return {
          shadow: one(document.getElementById("host")!.shadowRoot!.querySelector(".in")!.getAnimations()[0]!),
          long: one(document.getElementById("long")!.getAnimations()[0]!),
          done: one(w.done),
        };
      }, t);
    assert.deepEqual(await at(0), { shadow: ["paused", 0], long: ["paused", 0], done: ["finished", 300] });
    assert.deepEqual(await at(250), { shadow: ["paused", 250], long: ["paused", 250], done: ["finished", 300] });
    assert.deepEqual(await at(500), { shadow: ["finished", 400], long: ["finished", 400], done: ["finished", 300] });
  } finally {
    await page.close();
  }
});

test("a negative playbackRate is held: set and reversed, reverse(), updatePlaybackRate()", async () => {
  // Before, the hold left a rate below 0 alone, but its own pause had already frozen it.
  const { page, timeline } = await held(
    doc(`<div id="a" class="box"></div><div id="b" class="box"></div><div id="c" class="box"></div>
    <script>${SLIDE_JS}
      const set = a.animate(slide, { duration: 200, iterations: 10 });
      set.currentTime = 2000;
      set.playbackRate = -1;
      const rev = b.animate(slide, { duration: 200, iterations: 10 });
      rev.reverse();
      const upd = c.animate(slide, { duration: 1000, fill: "both" });
      upd.currentTime = 600;
      upd.updatePlaybackRate(-0.5);
      window.anims = { set, rev, upd };
    </script>`),
  );
  try {
    const read = () =>
      page.evaluate(() => {
        const anims = (window as unknown as { anims: Record<string, Animation> }).anims;
        return Object.fromEntries(Object.entries(anims).map(([k, a]) => [k, [a.playState, a.currentTime]]));
      });
    await timeline.at(500);
    assert.deepEqual(await read(), { set: ["paused", 1500], rev: ["paused", 1500], upd: ["paused", 350] });
    await page.waitForTimeout(100);
    assert.deepEqual(await read(), { set: ["paused", 1500], rev: ["paused", 1500], upd: ["paused", 350] }, "held");
    await timeline.at(2500);
    assert.deepEqual(await read(), { set: ["finished", 0], rev: ["finished", 0], upd: ["finished", 0] });
    assert.deepEqual((await timeline.animations()).slice(0, 2), [
      { startMs: 0, durationMs: 200, iterations: 10 },
      { startMs: 0, durationMs: 200, iterations: 10 },
    ]);
  } finally {
    await page.close();
  }
});

test("animations() and pending() read every frame, each on the sweep's clock", async () => {
  // Before, both read the main frame only (pending() was the caller's page.evaluate): check flash
  // chose its window without a delayed strobe inside an iframe, or the iframe's timers.
  const page = await browser.newPage();
  try {
    const url = await site({
      "main.html": doc(`<iframe src="child.html" width="200" height="60"></iframe>
        <script>setTimeout(() => {}, 700);
          setTimeout(() => {
            const frame = document.createElement("iframe");
            frame.src = "late.html";
            document.body.appendChild(frame);
          }, 1000);</script>`),
      "child.html": doc(
        `<div class="box" style="animation: slide 200ms linear 2500ms infinite"></div>
        <script>setTimeout(() => {}, 1200); setInterval(() => {}, 100);</script>`,
      ),
      "late.html": doc(
        `<div class="box" style="animation: slide 300ms linear 200ms both"></div><script>setTimeout(() => {}, 800);</script>`,
      ),
    });
    const timeline = await openHeldTimeline(page, url);
    assert.deepEqual(await timeline.animations(), [{ startMs: 2500, durationMs: 200, iterations: null }]);
    assert.deepEqual(await timeline.pending(), {
      timers: 4,
      frames: 0,
      intervals: 1,
      seekListeners: 0,
      latestTimerMs: 1200,
    });
    await timeline.at(1000);
    let late: Frame | undefined;
    for (let i = 0; i < 200 && !late; i++) {
      late = page.frames().find((f) => f.url().endsWith("late.html"));
      if (!late) await page.waitForTimeout(10);
    }
    assert.ok(late, "late.html attached");
    await late.waitForLoadState("load");
    await timeline.at(1100);
    // It begins at the instant it was first seen: the 1000ms step that inserted it when its file
    // committed within that step, else 1100.
    const begun = 1100 - (await late.evaluate(() => performance.now()));
    assert.ok(begun === 1000 || begun === 1100, `late.html began at ${begun}`);
    assert.deepEqual(
      (await timeline.animations()).sort((a, b) => a.startMs - b.startMs),
      [
        { startMs: begun + 200, durationMs: 300, iterations: 1 },
        { startMs: 2500, durationMs: 200, iterations: null },
      ],
    );
    assert.deepEqual(await timeline.pending(), {
      timers: 3,
      frames: 0,
      intervals: 1,
      seekListeners: 0,
      latestTimerMs: begun + 800,
    });
  } finally {
    await page.close();
  }
});
