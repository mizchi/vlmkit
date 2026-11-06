// Hidden from the agents: judges an authored page against its brief.
// node fixtures/motion-authoring/oracle.mjs <tabs|skeleton|bell|modal|grid|marquee> <page.html> [--json]
// Measured with plain Playwright and the Web Animations API only: no vlmkit code.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [kind, file, flag] = process.argv.slice(2);
const url = pathToFileURL(resolve(file)).href;
const browser = await chromium.launch();
const checks = [];
const ok = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

async function open({ reduce = false } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.emulateMedia({ reducedMotion: reduce ? "reduce" : "no-preference" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  return { page, errors };
}

// Every animation paused at time t of its own clock (delay included), on the document and in open shadow roots.
// Every animation ever seen is kept: one sought past its end with no forwards fill leaves
// getAnimations(), and a later seek back must still reach it.
const at = (page, t) =>
  page.evaluate((t) => {
    window.__seen ??= new Set();
    for (const a of document.getAnimations()) window.__seen.add(a);
    for (const a of window.__seen) {
      if (a.playState === "idle" && a.__cancelled) continue;
      a.pause();
      a.currentTime = t;
    }
  }, t);

// Geometry of an element as drawn: box, opacity through its ancestors, the composed 2D matrix of its own
// translate / rotate / scale / transform, and the share of a 5x5 grid of its box where it is topmost.
const probe = (page, sel, index = 0) =>
  page.evaluate(
    ({ sel, index }) => {
      const el = document.querySelectorAll(sel)[index];
      if (!el) return null;
      const cs = getComputedStyle(el);
      let m = new DOMMatrix();
      if (cs.translate && cs.translate !== "none") {
        const [x = "0", y = "0"] = cs.translate.split(" ");
        m = m.translate(parseFloat(x), parseFloat(y));
      }
      if (cs.rotate && cs.rotate !== "none") {
        const parts = cs.rotate.split(" ");
        const deg = parseFloat(parts[parts.length - 1]) * (parts[parts.length - 1].endsWith("rad") ? 180 / Math.PI : 1);
        m = m.rotate(deg);
      }
      if (cs.scale && cs.scale !== "none") {
        const [sx, sy = sx] = cs.scale.split(" ").map(parseFloat);
        m = m.scale(sx, sy);
      }
      if (cs.transform && cs.transform !== "none") m = m.multiply(new DOMMatrix(cs.transform));
      const [ox, oy] = cs.transformOrigin.split(" ").map(parseFloat);
      const w = el.offsetWidth || el.getBoundingClientRect().width;
      const h = el.offsetHeight || el.getBoundingClientRect().height;
      // Where the element's top centre lands under its own transform (local px).
      const px = w / 2 - ox, py = 0 - oy;
      const topCentre = { dx: ox + m.a * px + m.c * py + m.e - w / 2, dy: oy + m.b * px + m.d * py + m.f - 0 };
      const r = el.getBoundingClientRect();
      let op = 1;
      for (let e = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
      const style = document.createElement("style");
      style.textContent = "[data-o],[data-o] *{pointer-events:auto!important}";
      document.head.append(style);
      el.setAttribute("data-o", "");
      let hits = 0, n = 0;
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 5; j++) {
          const x = r.x + ((i + 0.5) / 5) * r.width, y = r.y + ((j + 0.5) / 5) * r.height;
          n++;
          if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
          const top = document.elementFromPoint(x, y);
          if (top && el.contains(top)) hits++;
        }
      el.removeAttribute("data-o");
      style.remove();
      return {
        x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom,
        cx: r.x + r.width / 2, cy: r.y + r.height / 2,
        opacity: op, visible: r.width > 0 && r.height > 0 ? hits / n : 0,
        angle: (Math.atan2(m.b, m.a) * 180) / Math.PI, scale: Math.hypot(m.a, m.b),
        topCentre, display: cs.display, visibility: cs.visibility,
      };
    },
    { sel, index },
  );
// Before an action: remember what is already animating, so only what the action starts is seeked.
const mark = (page) => page.evaluate(() => { window.__pre = new Set(document.getAnimations()); window.__seenNew = new Set(); });
const atNew = (page, t) =>
  page.evaluate((t) => {
    window.__seenNew ??= new Set();
    for (const a of document.getAnimations()) if (!window.__pre?.has(a)) window.__seenNew.add(a);
    for (const a of window.__seenNew) {
      if (window.__pre?.has(a)) continue;
      a.pause();
      a.currentTime = t;
    }
  }, t);
// A CSS animation paused through the API outlives its animation-name: one the oracle paused is
// cancelled once its element no longer lists it, as the browser would have dropped it.
const dropStale = (page) =>
  page.evaluate(() => {
    for (const a of window.__pre ?? []) {
      if (typeof CSSAnimation === "undefined" || !(a instanceof CSSAnimation)) continue;
      const el = a.effect?.target;
      const names = el ? getComputedStyle(el).animationName.split(",").map((x) => x.trim()) : [];
      if (!names.includes(a.animationName)) a.cancel();
    }
  });
const newEnd = (page) =>
  page.evaluate(() => Math.max(0, ...document.getAnimations().filter((a) => !window.__pre?.has(a)).map((a) => a.effect.getComputedTiming().endTime)));
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const r1 = (v) => Math.round(v * 100) / 100;

// A step the page can block (a click under a cover) fails the check and ends the run, never crashes it.
class Stop extends Error {}
const must = async (name, fn) => {
  try { await fn(); } catch (e) { ok(name, false, String(e).split("\n")[0]); throw new Stop(); }
};
try {
if (kind === "tabs") {
  const { page, errors } = await open();
  // What runs at load (a first placement) is over before the page is read.
  await page.evaluate(() => document.getAnimations().forEach((a) => { if (a.effect.getComputedTiming().iterations !== Infinity) a.finish(); }));
  const tabs0 = [];
  for (let i = 0; i < 4; i++) tabs0.push(await probe(page, "button.tab", i));
  const ind0 = await probe(page, "span.indicator");
  ok("four tabs in a row at (40, 40)", tabs0.every(Boolean) && near(tabs0[0].x, 40, 1) && near(tabs0[0].y, 40, 1) &&
    tabs0.every((t, i) => i === 0 || near(t.x, tabs0[i - 1].right, 1)), tabs0.map((t) => t && [r1(t.x), r1(t.y), r1(t.w)]));
  ok("tabs have different widths", new Set(tabs0.map((t) => Math.round(t?.w ?? 0))).size >= 3, tabs0.map((t) => t && r1(t.w)));
  ok("indicator under Overview, its width, 3px, on the tabs' bottom", ind0 && near(ind0.x, tabs0[0].x, 1) && near(ind0.w, tabs0[0].w, 1) &&
    near(ind0.h, 3, 0.5) && near(ind0.bottom, tabs0[0].bottom, 1), ind0);
  ok("Overview selected", (await page.getAttribute("button.tab >> nth=0", "aria-selected")) === "true", null);
  await mark(page);
  await must("a tab can be clicked", () => page.click("button.tab >> nth=3", { timeout: 2000 }));
  const curve = [];
  for (const t of [0, 75, 150, 225, 299]) {
    await atNew(page, t);
    const p = await probe(page, "span.indicator");
    curve.push({ t, x: p.x, w: p.w });
  }
  await atNew(page, 1000);
  const rest = await probe(page, "span.indicator");
  const tabs1 = [];
  for (let i = 0; i < 4; i++) tabs1.push(await probe(page, "button.tab", i));
  const target = tabs1[3];
  ok("indicator ends under Billing and invoices, its width", near(rest.x, target.x, 1) && near(rest.w, target.w, 1) && near(rest.bottom, target.bottom, 1), { rest, target });
  ok("Billing and invoices selected, Overview not", (await page.getAttribute("button.tab >> nth=3", "aria-selected")) === "true" &&
    (await page.getAttribute("button.tab >> nth=0", "aria-selected")) === "false", null);
  const frac = (p) => (p.x - ind0.x) / (rest.x - ind0.x);
  const fw = (p) => (p.w - ind0.w) / (rest.w - ind0.w);
  const f = curve.map(frac), g = curve.map(fw);
  ok("slides: starts at Overview at 0ms", near(f[0], 0, 0.02), f.map(r1));
  ok("ease-in-out: slow start (<25% at 75ms), half way at 150ms (40-60%), slow end (>75% at 225ms)", f[1] < 0.25 && f[1] > 0 && f[2] > 0.4 && f[2] < 0.6 && f[3] > 0.75 && f[3] < 1, f.map(r1));
  ok("takes 300ms: not yet there at 299ms... and there by 1000ms", f[4] > 0.97 && f[4] <= 1.0001, f.map(r1));
  ok("width changes over the same 300ms (40-60% at 150ms)", g[2] > 0.4 && g[2] < 0.6 && g[1] < 0.25, g.map(r1));
  ok("tabs never move or change size", tabs1.every((t, i) => near(t.x, tabs0[i].x, 0.5) && near(t.w, tabs0[i].w, 0.5) && near(t.y, tabs0[i].y, 0.5)), null);
  ok("no script errors", errors.length === 0, errors);
  const red = await open({ reduce: true });
  await must("reduced motion: a tab can be clicked", () => red.page.click("button.tab >> nth=2", { timeout: 2000 }));
  await red.page.waitForTimeout(30);
  const ri = await probe(red.page, "span.indicator");
  const rt = await probe(red.page, "button.tab", 2);
  ok("reduced motion: the indicator is under the new tab at once", near(ri.x, rt.x, 1) && near(ri.w, rt.w, 1), { ri, rt });
} else if (kind === "skeleton") {
  const { page, errors } = await open();
  const card = await probe(page, "div.card");
  ok("card 360px wide at (40, 40)", card && near(card.x, 40, 1) && near(card.y, 40, 1) && near(card.w, 360, 1), card);
  const shimmerAnims = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.effect?.target?.matches?.("span.shimmer")).map((a) => ({
      duration: a.effect.getComputedTiming().duration, iterations: a.effect.getComputedTiming().iterations, easing: a.effect.getComputedTiming().easing,
    })));
  ok("the shimmer runs 1200ms, forever", shimmerAnims.some((a) => near(a.duration, 1200, 1) && a.iterations === Infinity), shimmerAnims);
  await at(page, 0);
  const sk = await probe(page, "div.skeleton");
  const s0 = await probe(page, "span.shimmer");
  await at(page, 300); const s3 = await probe(page, "span.shimmer");
  await at(page, 600); const s6 = await probe(page, "span.shimmer");
  await at(page, 900); const s9 = await probe(page, "span.shimmer");
  await at(page, 1199); const s12 = await probe(page, "span.shimmer");
  ok("shimmer 80px wide", s6 && near(s6.w, 80, 1), s6);
  ok("starts wholly left of the bars and ends wholly right of them", s0 && s12 && s0.right <= sk.x + 1 && s12.x >= sk.right - 2, { start: s0 && r1(s0.right), end: s12 && r1(s12.x), skeleton: [r1(sk.x), r1(sk.right)] });
  const d1 = s3.x - s0.x, d2 = s6.x - s3.x, d3 = s9.x - s6.x;
  ok("left to right at a constant speed (equal steps within 3%)", d1 > 0 && Math.max(d1, d2, d3) / Math.min(d1, d2, d3) < 1.03, [d1, d2, d3].map(r1));
  const clips = await page.evaluate(() => {
    for (let e = document.querySelector("span.shimmer").parentElement; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.overflow !== "visible" || cs.overflowX !== "visible" || cs.clipPath !== "none" || cs.contain.includes("paint")) {
        const r = e.getBoundingClientRect(), k = document.querySelector("div.skeleton").getBoundingClientRect();
        return { tag: e.className, within: r.x >= k.x - 1 && r.right <= k.right + 1 };
      }
    }
    return null;
  });
  ok("the highlight is clipped to the skeleton", clips && clips.within, clips);
  await at(page, 1450);
  const c14 = await probe(page, "div.content"), k14 = await probe(page, "div.skeleton");
  ok("before 1500ms: skeleton shown, content not", c14 && k14 && c14.opacity < 0.05 && k14.opacity > 0.95, { content: c14?.opacity, skeleton: k14?.opacity });
  await at(page, 1650);
  const c16 = await probe(page, "div.content"), k16 = await probe(page, "div.skeleton");
  ok("1650ms: content half faded in, skeleton half faded out", c16 && k16 && c16.opacity > 0.15 && c16.opacity < 0.85 && k16.opacity > 0.15 && k16.opacity < 0.85, { content: c16?.opacity, skeleton: k16?.opacity });
  await at(page, 1790);
  const c17 = await probe(page, "div.content");
  await at(page, 3000);
  const c30 = await probe(page, "div.content"), k30 = await probe(page, "div.skeleton");
  ok("over by 1800ms: the fade takes 300ms", c17 && c17.opacity > 0.9 && c17.opacity < 1.0001, c17?.opacity);
  ok("at rest only the content is seen, in the skeleton's place", c30 && c30.opacity > 0.98 && c30.visible >= 0.96 && k30.opacity < 0.02 &&
    near(c30.x, sk.x, 24) && near(c30.y, sk.y, 24), { content: c30, skeleton: k30?.opacity });
  ok("no script errors", errors.length === 0, errors);
  const red = await open({ reduce: true });
  await at(red.page, 0); const r0 = await probe(red.page, "span.shimmer");
  await at(red.page, 600); const r6 = await probe(red.page, "span.shimmer");
  ok("reduced motion: the highlight stays still", !r0 || !r6 || near(r0.x, r6.x, 0.5) || r6.opacity < 0.02, { r0: r0 && r1(r0.x), r6: r6 && r1(r6.x) });
  await at(red.page, 3000);
  const rc = await probe(red.page, "div.content");
  ok("reduced motion: the content still arrives", rc && rc.opacity > 0.98, rc?.opacity);
} else if (kind === "bell") {
  const { page, errors } = await open();
  const b = await probe(page, "button.bell");
  ok("button 48x48, right edge 32px from the right, top at 24px", b && near(b.w, 48, 1) && near(b.h, 48, 1) && near(b.right, 1248, 1) && near(b.y, 24, 1), b);
  await at(page, 0);
  const i0 = await probe(page, ".bell-icon");
  ok("icon 28x28 centred in the button", i0 && near(i0.w, 28, 1) && near(i0.h, 28, 1) && near(i0.cx, b.cx, 1) && near(i0.cy, b.cy, 1), i0);
  const timing = await page.evaluate(() =>
    document.getAnimations().filter((a) => a.effect?.target?.closest?.("button.bell")).map((a) => ({ target: a.effect?.target?.className?.baseVal ?? a.effect?.target?.className, it: a.effect.getComputedTiming().iterations })));
  const series = [];
  for (let t = 0; t <= 1700; t += 10) {
    await at(page, t);
    const p = await probe(page, ".bell-icon");
    series.push({ t, a: p.angle, d: Math.hypot(p.topCentre.dx, p.topCentre.dy) });
  }
  const before = series.filter((s) => s.t <= 790), during = series.filter((s) => s.t >= 800 && s.t <= 1500), after = series.filter((s) => s.t >= 1510);
  ok("still until 800ms", before.every((s) => Math.abs(s.a) < 0.5), before.filter((s) => Math.abs(s.a) >= 0.5).slice(0, 3));
  // Extremes in order: each a local max of |angle| with a sign change between them.
  const ext = [];
  for (let i = 1; i < during.length - 1; i++) {
    const p = during[i - 1].a, c = during[i].a, n = during[i + 1].a;
    if (Math.abs(c) > 1 && ((c > p && c >= n) || (c < p && c <= n))) ext.push({ t: during[i].t, a: r1(c) });
  }
  const want = [14, -12, 8, -4];
  ok("swings right 14°, left 12°, right 8°, left 4° (±1.5°), in that order", ext.length === 4 && ext.every((e, i) => near(e.a, want[i], 1.5)), ext);
  ok("first swing is to the right (clockwise)", during.find((s) => Math.abs(s.a) > 1)?.a > 0, during.find((s) => Math.abs(s.a) > 1));
  ok("at rest upright by 1500ms (700ms after it starts), and not before 1400ms", after.every((s) => Math.abs(s.a) < 0.5) &&
    series.filter((s) => s.t >= 1300 && s.t <= 1390).some((s) => Math.abs(s.a) > 0.3), { last: series.filter((s) => s.t >= 1300 && s.t <= 1500).map((s) => r1(s.a)) });
  ok("swings about its top centre (that point moves under 1.5px)", during.every((s) => s.d < 1.5), r1(Math.max(...during.map((s) => s.d))));
  ok("rings once (no repeating animation)", timing.length > 0 && timing.every((t) => t.it !== Infinity && t.it <= 1), timing);
  await at(page, 1100);
  const bMid = await probe(page, "button.bell");
  ok("the button never moves", near(bMid.x, b.x, 0.5) && near(bMid.y, b.y, 0.5) && near(bMid.w, b.w, 0.5) && Math.abs(bMid.angle) < 0.1, bMid);
  ok("no script errors", errors.length === 0, errors);
} else if (kind === "modal") {
  const { page, errors } = await open();
  const del0 = await probe(page, "button.delete");
  ok("Delete button at (40, 40)", del0 && near(del0.x, 40, 1) && near(del0.y, 40, 1), del0);
  const shut = async () => {
    const bd = await probe(page, "div.backdrop"), dl = await probe(page, "div.dialog");
    return { bd, dl };
  };
  const before = await shut();
  ok("closed at first: no dialog or backdrop seen", (!before.bd || before.bd.opacity < 0.02 || before.bd.w === 0 || before.bd.visibility === "hidden") &&
    (!before.dl || before.dl.opacity < 0.02 || before.dl.w === 0 || before.dl.visibility === "hidden"), before);
  await mark(page);
  await must("the Delete button can be clicked when the page opens", () => page.click("button.delete", { timeout: 2000 }));
  const anims = await page.evaluate(() => document.getAnimations().filter((a) => !window.__pre?.has(a)).map((a) => {
    const kf = a.effect.getKeyframes?.() ?? [];
    return [...new Set(kf.flatMap((k) => Object.keys(k).filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p))))].concat(a.transitionProperty ? [a.transitionProperty] : []);
  }).flat());
  const sample = async (t) => { await atNew(page, t); return { bd: await probe(page, "div.backdrop"), dl: await probe(page, "div.dialog") }; };
  const s0 = await sample(0), s40 = await sample(40), s100 = await sample(100), s175 = await sample(175), rest = await sample(2000);
  ok("backdrop covers the viewport", rest.bd && near(rest.bd.x, 0, 1) && near(rest.bd.y, 0, 1) && rest.bd.w >= 1279 && rest.bd.h >= 799, rest.bd);
  ok("backdrop at 50% at rest", rest.bd && near(rest.bd.opacity, 0.5, 0.02), rest.bd?.opacity);
  ok("backdrop fades at a constant rate over 200ms (≈25% at 100ms, 0 at 0)", s0.bd && s0.bd.opacity < 0.02 && near(s100.bd.opacity, 0.25, 0.03), { t0: s0.bd?.opacity, t100: s100.bd?.opacity });
  ok("dialog 400x220, centred", rest.dl && near(rest.dl.w, 400, 1) && near(rest.dl.h, 220, 1) && near(rest.dl.cx, 640, 1) && near(rest.dl.cy, 400, 1), rest.dl);
  ok("dialog fully seen at rest, at full size", rest.dl && rest.dl.opacity > 0.98 && rest.dl.visible >= 0.96 && near(rest.dl.scale, 1, 0.005), rest.dl);
  ok("dialog has not begun at 40ms (it starts 50ms after the click)", s40.dl && s40.dl.opacity < 0.05, s40.dl?.opacity);
  const rise = (s) => (s.dl.cy - rest.dl.cy) / 24;
  ok("dialog starts 24px below, at 95%", s40.dl && near(s40.dl.cy - rest.dl.cy, 24, 1.5) && near(s40.dl.w / rest.dl.w, 0.95, 0.01), { dy: s40.dl && r1(s40.dl.cy - rest.dl.cy), scale: s40.dl && r1(s40.dl.w / rest.dl.w) });
  ok("ease-out: past 60% of the rise half way through (175ms)", s175.dl && rise(s175) < 0.4 && rise(s175) > 0, s175.dl && r1(rise(s175)));
  ok("fades in as it rises", s175.dl && s175.dl.opacity > 0.3 && s175.dl.opacity < 0.999, s175.dl?.opacity);
  // Discrete switches (visibility, display, pointer-events) that hide or show at an end are not motion.
  const allowed = ["transform", "opacity", "translate", "scale", "rotate", "visibility", "display", "pointer-events", "pointerEvents", "overlay", "content-visibility", "contentVisibility"];
  ok("only transform and opacity animate", anims.length > 0 && anims.every((p) => allowed.includes(p)), anims);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  const del1 = await probe(page, "button.delete");
  ok("nothing else moves", near(del1.x, del0.x, 0.5) && near(del1.y, del0.y, 0.5), del1);
  await mark(page);
  await must("Cancel can be clicked", () => page.click("button.cancel", { timeout: 2000 }));
  await dropStale(page);
  const closeEnd = await newEnd(page);
  const c75 = await sample(75);
  ok("closing: both half faded at 75ms", c75.dl && c75.bd && c75.dl.opacity > 0.2 && c75.dl.opacity < 0.85 && c75.bd.opacity > 0.1 && c75.bd.opacity < 0.45, { dialog: c75.dl?.opacity, backdrop: c75.bd?.opacity });
  ok("the close takes 150ms", near(closeEnd, 150, 5), closeEnd);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  await page.waitForTimeout(50);
  const closed = await shut();
  const gone = (p) => !p || p.opacity < 0.02 || p.w === 0 || p.visibility === "hidden" || p.display === "none";
  ok("closed: nothing of them on screen", gone(closed.bd) && gone(closed.dl), closed);
  const top = await page.evaluate(() => {
    const r = document.querySelector("button.delete").getBoundingClientRect();
    const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return e && document.querySelector("button.delete").contains(e);
  });
  ok("closed: the Delete button can be clicked again (nothing over it)", top, top);
  let reopened = false;
  try { await page.click("button.delete", { timeout: 1000 }); reopened = true; } catch {}
  ok("it opens again", reopened, reopened);
  ok("no script errors", errors.length === 0, errors);
} else if (kind === "grid") {
  const { page, errors } = await open();
  const n = await page.evaluate(() => document.querySelectorAll("div.tile").length);
  ok("nine tiles", n === 9, n);
  await at(page, 5000);
  const rest = [];
  for (let i = 0; i < 9; i++) rest.push(await probe(page, "div.tile", i));
  ok("at rest: each tile 120x120 in its grid place, fully shown", rest.every((p, i) => p && near(p.x, 40 + (i % 3) * 136, 1) && near(p.y, 40 + Math.floor(i / 3) * 136, 1) &&
    near(p.w, 120, 1) && near(p.h, 120, 1) && p.opacity > 0.98 && p.visible >= 0.96), rest.map((p) => p && [r1(p.x), r1(p.y), r1(p.w), r1(p.opacity)]));
  const colours = await page.evaluate(() => [...document.querySelectorAll("div.tile")].map((e) => getComputedStyle(e).backgroundColor + getComputedStyle(e).backgroundImage));
  ok("tiles have different colours", new Set(colours).size >= 5, colours.length);
  const start = (i) => (i === 4 ? 0 : [1, 3, 5, 7].includes(i) ? 100 : 200);
  for (const group of [[4], [1, 3, 5, 7], [0, 2, 6, 8]]) {
    const s = start(group[0]);
    const pre = [], early = [], half = [], done = [];
    for (const i of group) {
      if (s > 0) { await at(page, s - 10); pre.push(await probe(page, "div.tile", i)); }
      await at(page, s + 30); early.push(await probe(page, "div.tile", i));
      await at(page, s + 150); half.push(await probe(page, "div.tile", i));
      await at(page, s + 295); done.push(await probe(page, "div.tile", i));
    }
    const label = s === 0 ? "the centre tile" : s === 100 ? "the four beside the centre" : "the four corners";
    if (s > 0) ok(`${label}: not seen before ${s}ms`, pre.every((p) => p.opacity < 0.03 || p.w < 1), pre.map((p) => r1(p.opacity)));
    ok(`${label}: begin at ${s}ms (fading in at ${s + 30}ms, smaller than full)`, early.every((p) => p.opacity > 0.02 && p.opacity < 0.9 && p.w < 117), early.map((p) => [r1(p.opacity), r1(p.w / 120)]));
    ok(`${label}: start from 80%`, early.every((p) => p.w / 120 > 0.79 && p.w / 120 < 0.95), early.map((p) => r1(p.w / 120)));
    // ease-out: at half time, past 60% of the growth (scale > 0.92).
    ok(`${label}: ease-out (past 60% of the growth at half time)`, half.every((p) => p.w / 120 > 0.92 && p.w / 120 < 0.999), half.map((p) => r1(p.w / 120)));
    ok(`${label}: done in 300ms`, done.every((p) => p.w / 120 > 0.995 && p.opacity > 0.97), done.map((p) => [r1(p.w / 120), r1(p.opacity)]));
    ok(`${label}: grow about their own centre`, half.every((p, k) => near(p.cx, rest[group[k]].cx, 1) && near(p.cy, rest[group[k]].cy, 1)), half.map((p, k) => [r1(p.cx - rest[group[k]].cx), r1(p.cy - rest[group[k]].cy)]));
  }
  ok("no script errors", errors.length === 0, errors);
} else if (kind === "marquee") {
  const { page, errors } = await open();
  const strip = await probe(page, "div.strip");
  ok("strip 1200x80 at (40, 40)", strip && near(strip.x, 40, 1) && near(strip.y, 40, 1) && near(strip.w, 1200, 1) && near(strip.h, 80, 1), strip);
  const logos = await page.evaluate(() => [...document.querySelectorAll("span.logo")].map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.width, r.height]; }));
  ok("sixteen logos, 140x60, 160px apart", logos.length === 16 && logos.every((l, i) => near(l[1], 140, 1) && near(l[2], 60, 1) && (i === 0 || near(l[0] - logos[i - 1][0], 160, 1))), logos.length);
  const timing = await page.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.matches?.("div.track")).map((a) => a.effect.getComputedTiming()));
  ok("the track moves forever", timing.some((t) => t.iterations === Infinity), timing.map((t) => [t.duration, t.iterations]));
  const dur = timing.find((t) => t.iterations === Infinity)?.duration ?? 16000;
  const xs = [];
  for (const t of [0, 500, 1000, 2000]) { await at(page, t); xs.push((await probe(page, "div.track")).x); }
  ok("to the left at 80px per second, steadily (±2px)", near(xs[1] - xs[0], -40, 2) && near(xs[2] - xs[0], -80, 2) && near(xs[3] - xs[0], -160, 2), xs.map((x) => r1(x - xs[0])));
  await at(page, dur - 1);
  const end = (await probe(page, "div.track")).x;
  ok("seamless: one run moves exactly one set (1280px), so the pose repeats", near(xs[0] - end, 1280 - 0.08, 2), { run: dur, moved: r1(xs[0] - end) });
  await at(page, 7000);
  const outside = await page.evaluate(() => {
    for (const y of [60, 80, 100]) for (const x of [10, 30, 1250, 1270]) {
      const e = document.elementFromPoint(x, y);
      if (e && e.closest("span.logo")) return [x, y];
    }
    return null;
  });
  const clipped = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector("div.strip")); return cs.overflow !== "visible" || cs.clipPath !== "none"; });
  ok("no logo seen outside the strip", !outside && clipped, { outside, clipped });
  ok("no script errors", errors.length === 0, errors);
  // Hover, on the real clock.
  const live = await open();
  await live.page.waitForTimeout(300);
  await live.page.mouse.move(640, 80);
  await live.page.waitForTimeout(100);
  const h0 = (await probe(live.page, "div.track")).x;
  await live.page.waitForTimeout(500);
  const h1 = (await probe(live.page, "div.track")).x;
  ok("stops while the pointer is over the strip", near(h0, h1, 0.5), [r1(h0), r1(h1)]);
  await live.page.mouse.move(640, 600);
  await live.page.waitForTimeout(500);
  const l1 = (await probe(live.page, "div.track")).x;
  ok("carries on from there when the pointer leaves (no jump: 20-60px on in 0.5s)", h1 - l1 > 20 && h1 - l1 < 60, r1(h1 - l1));
  const red = await open({ reduce: true });
  const q0 = (await probe(red.page, "div.track")).x;
  await red.page.waitForTimeout(600);
  const q1 = (await probe(red.page, "div.track")).x;
  ok("reduced motion: the logos do not move", near(q0, q1, 0.5), [r1(q0), r1(q1)]);
} else {
  console.error(`unknown kind ${kind}`);
  process.exit(2);
}
} catch (e) {
  if (!(e instanceof Stop)) ok("the oracle could run the page to the end", false, String(e).split("\n")[0]);
}
await browser.close();
const failed = checks.filter((c) => !c.pass);
if (flag === "--json") console.log(JSON.stringify({ kind, file, passed: checks.length - failed.length, total: checks.length, checks }, null, 1));
else {
  for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.pass ? "" : `  ${JSON.stringify(c.detail)?.slice(0, 300)}`}`);
  console.log(`${failed.length ? "FAIL" : "PASS"} ${kind}: ${checks.length - failed.length}/${checks.length}`);
}
process.exit(failed.length ? 1 : 0);
