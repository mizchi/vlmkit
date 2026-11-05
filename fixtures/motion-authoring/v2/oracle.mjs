// Hidden from the agents: judges an authored page against its brief.
// node fixtures/motion-authoring/v2/oracle.mjs <lift|badge|gauge|menu|label|reveal> <page.html> [--json]
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
// Share of 48 points 2px inside an element's box (its edges) where it, or what is inside it, is topmost.
// Share of a 7x7 grid inside an element's own rounded shape where it is topmost, and whether any
// ancestor that clips cuts its box.
const shapeShown = (page, sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const style = document.createElement("style");
    style.textContent = "*{pointer-events:auto!important}";
    document.head.append(style);
    const r = el.getBoundingClientRect();
    const rad = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, r.height / 2, r.width / 2) * (r.width / (el.offsetWidth || r.width));
    const inside = (x, y) => {
      const cx = Math.min(Math.max(x, r.x + rad), r.right - rad), cy = Math.min(Math.max(y, r.y + rad), r.bottom - rad);
      return Math.hypot(x - cx, y - cy) <= rad - 1 || rad === 0;
    };
    let n = 0, hit = 0;
    for (let i = 0; i < 7; i++) for (let j = 0; j < 7; j++) {
      const x = r.x + ((i + 0.5) / 7) * r.width, y = r.y + ((j + 0.5) / 7) * r.height;
      if (!inside(x, y)) continue;
      n++;
      const top = document.elementFromPoint(x, y);
      if (top && el.contains(top)) hit++;
    }
    style.remove();
    let cut = null;
    for (let a = el.parentElement; a && !cut; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === "visible" && cs.overflowY === "visible" && cs.clipPath === "none") continue;
      const q = a.getBoundingClientRect();
      const radius = parseFloat(cs.borderTopLeftRadius) || 0;
      const within = r.x >= q.x - 0.5 && r.y >= q.y - 0.5 && r.right <= q.right + 0.5 && r.bottom <= q.bottom + 0.5;
      if (!within || radius > 0) cut = a.className || a.tagName;
    }
    return { shown: n ? hit / n : 0, cut };
  }, sel);

const edgeShown = (page, sel, index = 0) =>
  page.evaluate(
    ({ sel, index }) => {
      const el = document.querySelectorAll(sel)[index];
      const style = document.createElement("style");
      style.textContent = "*{pointer-events:auto!important}";
      document.head.append(style);
      const r = el.getBoundingClientRect();
      let n = 0, hit = 0;
      const pts = [];
      for (let k = 0; k < 12; k++) {
        const f = 0.1 + (0.8 * k) / 11;
        pts.push([r.x + 2, r.y + f * r.height], [r.right - 2, r.y + f * r.height], [r.x + f * r.width, r.y + 2], [r.x + f * r.width, r.bottom - 2]);
      }
      for (const [x, y] of pts) {
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        n++;
        const top = document.elementFromPoint(x, y);
        if (top && el.contains(top)) hit++;
      }
      style.remove();
      return n ? hit / n : 0;
    },
    { sel, index },
  );

if (kind === "lift") {
  const { page, errors } = await open();
  const cards0 = [];
  for (let i = 0; i < 3; i++) cards0.push(await probe(page, "div.plan", i));
  ok("three 300x380 cards in a row at (80, 120), 8px apart", cards0.every(Boolean) &&
    cards0.every((c, i) => near(c.x, 80 + i * 308, 1) && near(c.y, 120, 1) && near(c.w, 300, 1) && near(c.h, 380, 1)), cards0.map((c) => c && [r1(c.x), r1(c.y), r1(c.w), r1(c.h)]));
  await mark(page);
  await page.mouse.move(cards0[1].cx, cards0[1].cy);
  await page.waitForTimeout(30);
  await atNew(page, 100);
  const mid = await probe(page, "div.plan", 1);
  ok("ease-out: past 60% of the growth at 100ms", mid && (mid.w - 300) / 24 > 0.6 && (mid.w - 300) / 24 < 0.999, mid && r1((mid.w - 300) / 24));
  ok("mid-lift: no part of it covered", (await edgeShown(page, "div.plan", 1)) >= 0.99, await edgeShown(page, "div.plan", 1));
  const end = await newEnd(page);
  await atNew(page, 1000);
  const up = await probe(page, "div.plan", 1);
  ok("lifted: 108% about its own centre", up && near(up.w, 324, 1.5) && near(up.h, 410.4, 1.5) && near(up.cx, cards0[1].cx, 1) && near(up.cy, cards0[1].cy, 1), up);
  ok("lifted: on top, its edges included (nothing covers any part of it)", (await edgeShown(page, "div.plan", 1)) >= 0.99, await edgeShown(page, "div.plan", 1));
  ok("lifts over 200ms", near(end, 200, 5), end);
  const shadow = await page.evaluate(() => getComputedStyle(document.querySelectorAll("div.plan")[1]).boxShadow);
  ok("casts a shadow", shadow && shadow !== "none", shadow);
  const side = [await probe(page, "div.plan", 0), await probe(page, "div.plan", 2)];
  ok("the cards beside it do not move", near(side[0].x, cards0[0].x, 0.5) && near(side[1].x, cards0[2].x, 0.5) && near(side[0].w, 300, 0.5), side.map((c) => [r1(c.x), r1(c.w)]));
  await mark(page);
  await page.mouse.move(640, 760);
  await page.waitForTimeout(30);
  const back = await newEnd(page);
  await atNew(page, 1000);
  const rest = await probe(page, "div.plan", 1);
  ok("settles back over 200ms", near(back, 200, 5) && near(rest.w, 300, 0.5), { back, w: rest.w });
  ok("no script errors", errors.length === 0, errors);
} else if (kind === "badge") {
  const { page, errors } = await open();
  await at(page, 3000);
  const av = await probe(page, "div.avatar");
  const b = await probe(page, "span.badge");
  ok("avatar 64x64 at (100, 100)", av && near(av.x, 100, 1) && near(av.y, 100, 1) && near(av.w, 64, 1) && near(av.h, 64, 1), av);
  const round = await page.evaluate(() => getComputedStyle(document.querySelector("div.avatar")).borderTopLeftRadius);
  ok("avatar is a circle", parseFloat(round) >= 31 || /50%/.test(round), round);
  ok("badge 22px tall, its centre on the avatar's top right corner", b && near(b.h, 22, 1) && near(b.cx, 164, 2) && near(b.cy, 100, 2), b);
  const restShown = await shapeShown(page, "span.badge");
  ok("at rest the whole badge is seen (nothing clips it, nothing covers it)", b && restShown.shown >= 0.97 && !restShown.cut && b.opacity > 0.98, restShown);
  await at(page, 990);
  const pre = await probe(page, "span.badge");
  ok("not seen before 1000ms", pre && (pre.w < 1 || pre.opacity < 0.03), pre && [r1(pre.w), r1(pre.opacity)]);
  let peak = 0, peakAt = 0;
  for (let t = 1000; t <= 1400; t += 20) {
    await at(page, t);
    const p = await probe(page, "span.badge");
    if (p.h > peak) { peak = p.h; peakAt = t; }
  }
  ok("pops past full size (to about 115%) and settles", peak / 22 > 1.1 && peak / 22 < 1.2, r1(peak / 22));
  await at(page, peakAt);
  const big = await probe(page, "span.badge");
  const bigShown = await shapeShown(page, "span.badge");
  ok("at its largest the whole badge is seen", big && bigShown.shown >= 0.97 && !bigShown.cut, bigShown);
  ok("grows about its own centre", near(big.cx, b.cx, 1) && near(big.cy, b.cy, 1), [r1(big.cx - b.cx), r1(big.cy - b.cy)]);
  await at(page, 1410);
  const done = await probe(page, "span.badge");
  ok("done by 1400ms (400ms)", near(done.h, 22, 0.5), r1(done.h));
  ok("no script errors", errors.length === 0, errors);
} else if (kind === "gauge") {
  const { page, errors } = await open();
  const svg = await probe(page, "svg.gauge");
  ok("gauge 320x200 at (80, 80)", svg && near(svg.x, 80, 1) && near(svg.y, 80, 1) && near(svg.w, 320, 1) && near(svg.h, 200, 1), svg);
  const vb = await page.getAttribute("svg.gauge", "viewBox");
  ok('viewBox "0 0 320 200"', vb && vb.trim().split(/[\s,]+/).map(Number).join(" ") === "0 0 320 200", vb);
  // The needle's screen matrix and its local box corners, at a page time.
  const needleAt = async (t) => {
    await at(page, t);
    return page.evaluate(() => {
      const el = document.querySelector(".needle");
      const m = el.getScreenCTM();
      const b = el.getBBox();
      const pts = [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]].map(([x, y]) => {
        const p = new DOMPoint(x, y).matrixTransform(m);
        return [p.x, p.y];
      });
      return { m: [m.a, m.b, m.c, m.d, m.e, m.f], pts };
    });
  };
  const centre = { x: 80 + 160, y: 80 + 170 };
  const n0 = await needleAt(0);
  const angleOf = (n) => (Math.atan2(n.m[1], n.m[0]) * 180) / Math.PI;
  const tip = (n) => n.pts.reduce((a, b) => (Math.hypot(b[0] - centre.x, b[1] - centre.y) > Math.hypot(a[0] - centre.x, a[1] - centre.y) ? b : a));
  const t0 = tip(n0);
  ok("starts pointing straight left from the dial's centre, 120 long", near(t0[0] - centre.x, -120, 4) && near(t0[1] - centre.y, 0, 4), [r1(t0[0] - centre.x), r1(t0[1] - centre.y)]);
  // The fixed point of the move from the first frame to this one: where it turns about.
  // 2D affine [a b c d e f] products, by hand (no DOMMatrix in Node).
  const mul = (p, q) => [p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1], p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3], p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5]];
  const inv = (m) => {
    const det = m[0] * m[3] - m[1] * m[2];
    const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
    return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
  };
  const pivot = (a, b) => {
    const A = mul(b.m, inv(a.m));
    const a11 = 1 - A[0], a12 = -A[2], a21 = -A[1], a22 = 1 - A[3], det = a11 * a22 - a12 * a21;
    return { x: (A[4] * a22 - a12 * A[5]) / det, y: (a11 * A[5] - a21 * A[4]) / det };
  };
  const series = [];
  for (const t of [300, 600, 900, 1199, 1300, 3000]) series.push({ t, n: await needleAt(t) });
  const turn = (n) => ((angleOf(n) - angleOf(n0) + 540) % 360) - 180;
  const turns = series.map((s) => r1(turn(s.n)));
  ok("sweeps clockwise to 120° and stays", near(turn(series[4].n), 120, 1.5) && near(turn(series[5].n), 120, 1.5), turns);
  ok("ease-out: past 60% of the sweep half way (600ms)", turn(series[1].n) > 72 && turn(series[1].n) < 119, turns);
  ok("takes 1200ms", turn(series[3].n) > 118 && turn(series[3].n) <= 120.01 && turn(series[2].n) < 119, turns);
  const ps = series.slice(0, 5).map((s) => pivot(n0, s.n));
  ok("turns about the dial's centre (its base stays put, within 2px)", ps.every((p) => Math.hypot(p.x - centre.x, p.y - centre.y) < 2), ps.map((p) => [r1(p.x), r1(p.y)]));
  ok("no script errors", errors.length === 0, errors);
} else if (kind === "menu") {
  const first = await open();
  const btn = await probe(first.page, "button.menu-button");
  ok("Menu button at (40, 40)", btn && near(btn.x, 40, 1) && near(btn.y, 40, 1), btn);
  const closed = await probe(first.page, "div.menu");
  ok("closed at first: not seen", !closed || closed.opacity < 0.03 || closed.h < 1 || closed.visibility === "hidden" || closed.display === "none", closed);
  await mark(first.page);
  await must("the Menu button can be clicked", () => first.page.click("button.menu-button", { timeout: 2000 }));
  const openEnd = await newEnd(first.page);
  await atNew(first.page, 125);
  const half = await probe(first.page, "div.menu");
  await atNew(first.page, 2000);
  const full = await probe(first.page, "div.menu");
  ok("open: 220px wide, below the button, its left edge on the button's", full && near(full.w, 220, 1) && near(full.x, btn.x, 1) && full.y >= btn.bottom - 1 && full.y <= btn.bottom + 16 && full.opacity > 0.98, full);
  ok("opens over 250ms", near(openEnd, 250, 5), openEnd);
  ok("unfolds from its top edge (top stays put, half height half way, fading)", half && near(half.y, full.y, 1) && half.h > full.h * 0.3 && half.h < full.h * 0.95 && half.opacity < 0.99, half && { y: r1(half.y), h: r1(half.h), full: r1(full.h), op: r1(half.opacity) });
  // Change of mind: open, paused half way, click again.
  const second = await open();
  await mark(second.page);
  await second.page.click("button.menu-button");
  await atNew(second.page, 125);
  const before = await probe(second.page, "div.menu");
  await mark(second.page);
  await must("the Menu button can be clicked while it opens", () => second.page.click("button.menu-button", { timeout: 2000 }));
  // A CSS animation paused through the API outlives its animation-name: the one the oracle paused
  // is cancelled once its element no longer lists it, as the browser would have dropped it.
  await second.page.evaluate(() => {
    for (const a of window.__pre ?? []) {
      if (typeof CSSAnimation === "undefined" || !(a instanceof CSSAnimation)) continue;
      const el = a.effect?.target;
      const names = el ? getComputedStyle(el).animationName.split(",").map((x) => x.trim()) : [];
      if (!names.includes(a.animationName)) a.cancel();
    }
  });
  await atNew(second.page, 0);
  const turned = await probe(second.page, "div.menu");
  await atNew(second.page, 40);
  const going = await probe(second.page, "div.menu");
  await atNew(second.page, 2000);
  const after = await probe(second.page, "div.menu");
  ok("clicked again mid-opening: it turns round from where it is (no jump)", before && turned && near(turned.h, before.h, 3) && near(turned.opacity, before.opacity, 0.08), { before: before && [r1(before.h), r1(before.opacity)], turned: turned && [r1(turned.h), r1(turned.opacity)] });
  ok("…and goes back towards closed", going && going.h < turned.h - 0.5, { turned: r1(turned?.h), going: r1(going?.h) });
  ok("…and ends closed", !after || after.opacity < 0.03 || after.h < 1 || after.visibility === "hidden" || after.display === "none", after);
  ok("no script errors", first.errors.length === 0 && second.errors.length === 0, [...first.errors, ...second.errors]);
} else if (kind === "label") {
  const { page, errors } = await open();
  const b0 = await probe(page, "button.add");
  ok("a round 44x44 button at (40, 40)", b0 && near(b0.x, 40, 1) && near(b0.y, 40, 1) && near(b0.w, 44, 1) && near(b0.h, 44, 1), b0);
  const others0 = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => !e.closest("button.add") && !e.contains(document.querySelector("button.add"))).map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
  await mark(page);
  await must("the button can be clicked", () => page.click("button.add", { timeout: 2000 }));
  const end = await newEnd(page);
  // The label's lines and the button's box at every 10ms of the widening.
  const lines = () => page.evaluate(() => {
    const btn = document.querySelector("button.add");
    const walker = document.createTreeWalker(btn, NodeFilter.SHOW_TEXT);
    let node, tops = new Set();
    while ((node = walker.nextNode())) {
      if (!/Added/.test(node.nodeValue) && !/cart/.test(node.nodeValue)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (r.width > 1 && r.height > 1) tops.add(Math.round(r.top));
    }
    return tops.size;
  });
  const frames = [];
  for (let t = 0; t <= 300; t += 10) {
    await atNew(page, t);
    frames.push({ t, b: await probe(page, "button.add"), lines: await lines() });
  }
  await atNew(page, 2000);
  const rest = await probe(page, "button.add");
  const label = await page.evaluate(() => document.querySelector("button.add").textContent.replace(/\s+/g, " ").trim());
  ok('reads "Added to cart" once open', /Added to cart/.test(label), label);
  ok("widens over 300ms", near(end, 300, 5), end);
  ok("at rest a pill 44px tall, its left edge put, wider than its label needs", near(rest.h, 44, 0.5) && near(rest.x, 40, 0.5) && rest.w > 120, rest);
  ok("never taller than 44px, at any moment", frames.every((f) => f.b.h <= 44.5), frames.filter((f) => f.b.h > 44.5).map((f) => [f.t, r1(f.b.h)]));
  ok("the label is on one line at every moment", frames.every((f) => f.lines <= 1), frames.filter((f) => f.lines > 1).map((f) => [f.t, f.lines]));
  ok("left edge stays put while it widens", frames.every((f) => near(f.b.x, 40, 0.5)), frames.map((f) => r1(f.b.x)).slice(0, 5));
  const mid = frames.find((f) => f.t === 150).b;
  ok("ease-out: past 60% of the widening at 150ms", (mid.w - 44) / (rest.w - 44) > 0.6, r1((mid.w - 44) / (rest.w - 44)));
  const others1 = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => !e.closest("button.add") && !e.contains(document.querySelector("button.add"))).map((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }));
  ok("nothing else on the card moves", others0.length === others1.length && others0.every((r, i) => r.every((v, k) => near(v, others1[i][k], 0.5))), others0.length);
  ok("no script errors", errors.length === 0, errors);
} else if (kind === "reveal") {
  const { page, errors } = await open();
  const n = await page.evaluate(() => document.querySelectorAll("div.feature").length);
  ok("six feature boxes", n === 6, n);
  await at(page, 5000);
  const rest = [];
  for (let i = 0; i < 6; i++) rest.push(await probe(page, "div.feature", i));
  ok("at rest: each 360x160 in its grid place, fully shown", rest.every((p, i) => p && near(p.x, 40 + (i % 3) * 384, 1) && near(p.y, 120 + Math.floor(i / 3) * 184, 1) && near(p.w, 360, 1) && near(p.h, 160, 1) && p.opacity > 0.98), rest.map((p) => p && [r1(p.x), r1(p.y), r1(p.opacity)]));
  for (let i = 0; i < 6; i++) {
    const s = i * 100;
    if (s > 0) { await at(page, s - 10); const pre = await probe(page, "div.feature", i); ok(`box ${i + 1}: not seen before ${s}ms`, pre.opacity < 0.03, r1(pre.opacity)); }
    await at(page, s + 1);
    const p0 = await probe(page, "div.feature", i);
    ok(`box ${i + 1}: starts 32px below at ${s}ms`, near(p0.y - rest[i].y, 32, 1.5), r1(p0.y - rest[i].y));
    await at(page, s + 250);
    const ph = await probe(page, "div.feature", i);
    ok(`box ${i + 1}: ease-out (past 60% of the rise half way)`, (p0.y - ph.y) / 32 > 0.6 && ph.y > rest[i].y - 0.01, r1((p0.y - ph.y) / 32));
    await at(page, s + 501);
    const pe = await probe(page, "div.feature", i);
    ok(`box ${i + 1}: in place and shown by ${s + 500}ms`, near(pe.y, rest[i].y, 0.5) && pe.opacity > 0.98, [r1(pe.y - rest[i].y), r1(pe.opacity)]);
  }
  ok("no script errors", errors.length === 0, errors);
  const red = await open({ reduce: true });
  await red.page.waitForTimeout(50);
  const a = [];
  for (let i = 0; i < 6; i++) a.push(await probe(red.page, "div.feature", i));
  await red.page.waitForTimeout(250);
  const b = [];
  for (let i = 0; i < 6; i++) b.push(await probe(red.page, "div.feature", i));
  ok("reduced motion: all six in place and fully shown from the start", a.every((p, i) => near(p.x, rest[i].x, 0.5) && near(p.y, rest[i].y, 0.5) && p.opacity > 0.98), a.map((p) => [r1(p.y), r1(p.opacity)]));
  ok("reduced motion: nothing moves or fades", a.every((p, i) => near(p.y, b[i].y, 0.3) && near(p.opacity, b[i].opacity, 0.01)), null);
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
