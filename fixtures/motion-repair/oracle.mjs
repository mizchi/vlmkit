// Hidden from the agents: judges a repaired page against its brief.
// node fixtures/motion-repair/oracle.mjs <notify|menu|toast|drawer|popover|stagger|tooltip|tiles|chips|banner|badge|sheet|slidein|progress|accordion|dialog|hover|reveal|flip|interrupt|reduced|push|seam|draw|gradient|quote|dismiss|reading|gear|label> <page.html>
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [kind, file] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
if (kind === "reduced") await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(pathToFileURL(resolve(file)).href);
const at = (t) =>
  page.evaluate((t) => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = t;
    }
  }, t);
const probe = (sel) =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const style = document.createElement("style");
    style.textContent = "[data-o],[data-o] *{pointer-events:auto!important}";
    document.head.append(style);
    el.setAttribute("data-o", "");
    const r = el.getBoundingClientRect();
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
    let op = 1;
    for (let e = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
    return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom, visible: hits / n, opacity: op };
  }, sel);
const rect = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round); }, sel);
const checks = [];
const ok = (name, pass, detail) => checks.push({ name, pass: !!pass, detail });

if (kind === "notify") {
  await at(2000);
  const n = await probe(".notice");
  ok("notice fully visible at rest (2000ms)", n && n.visible >= 0.96 && n.opacity > 0.95, n);
  ok("notice at the top bar's right edge, below it", n && Math.abs(n.right - 1248) <= 2 && n.y >= 64 && n.y <= 90, n);
  ok("top bar still 64px", (await rect(".topbar"))[3] === 64, await rect(".topbar"));
  await at(200 + 210);
  const mid = await probe(".notice");
  ok("mid-drop: moved most of the way (ease-out), partly faded", mid && mid.opacity > 0.5 && mid.opacity < 0.95, mid);
} else if (kind === "menu") {
  const heroBefore = await rect(".hero");
  await at(2000);
  const m = await probe(".menu");
  ok("menu fully visible over the banner at rest", m && m.visible >= 0.96 && m.opacity > 0.95, m);
  ok("menu anchored under the button at the right", m && Math.abs(m.right - 1240) <= 3, m);
  ok("banner unchanged", JSON.stringify(await rect(".hero")) === JSON.stringify(heroBefore), heroBefore);
  await at(300 + 120);
  const mid = await probe(".menu");
  ok("mid-open: scaling and fading", mid && mid.opacity > 0.4 && mid.opacity < 0.98, mid);
} else if (kind === "toast") {
  await at(1500);
  const held = await probe(".toast");
  ok("toast fully visible in the corner during the hold (1500ms)", held && held.visible >= 0.96 && held.opacity > 0.95, held);
  ok("toast at bottom-right (24px insets)", held && Math.abs(held.right - 1256) <= 2 && Math.abs(held.bottom - 776) <= 2, held);
  await at(2600);
  const late = await probe(".toast");
  ok("still visible just before the exit (2600ms)", late && late.visible >= 0.96 && late.opacity > 0.95, late);
  await at(3400);
  const gone = await probe(".toast");
  ok("gone after the exit (3400ms)", gone && (gone.opacity < 0.05 || gone.visible === 0), gone);
  // Ease-out entrance: halfway through the time, well past halfway through the travel.
  await at(300);
  const a0 = await probe(".toast");
  await at(300 + 180);
  const a1 = await probe(".toast");
  const frac = (a0.x - a1.x) / (a0.x - held.x);
  ok("entrance decelerates (ease-out: >60% of travel at half time)", frac > 0.6, { frac });
} else if (kind === "drawer") {
  await at(2000);
  const d = await probe(".drawer");
  ok("drawer fully visible at rest (2000ms)", d && d.visible >= 0.96 && d.opacity > 0.95, d);
  ok("drawer at the left edge under the header, 280px wide", d && Math.abs(d.x) <= 1 && Math.abs(d.y - 56) <= 1 && Math.abs(d.w - 280) <= 1, d);
  const f = await probe(".file");
  ok("file list visible at rest", f && f.visible >= 0.96 && f.opacity > 0.95, f);
  ok("main column unchanged", JSON.stringify(await rect("main")) === JSON.stringify([280, 56, 1000, (await rect("main"))[3]]), await rect("main"));
  await at(200);
  const fade = await probe(".file");
  ok("page mid-fade at 200ms", fade && fade.opacity > 0.3 && fade.opacity < 0.98, fade);
  await at(300);
  const before = await probe(".drawer");
  ok("drawer still off-screen before 400ms", before && before.right <= 1, before);
  await at(400 + 190);
  const mid = await probe(".drawer");
  const frac = mid ? (mid.x + 280) / 280 : 0;
  ok("slide decelerates (ease-out: >60% of travel at half time)", frac > 0.6 && frac < 0.99, { frac });
} else if (kind === "popover") {
  await at(2000);
  const r = await probe(".pop");
  ok("popover fully visible at rest", r && r.visible >= 0.96 && r.opacity > 0.95, r);
  ok("popover just above the button at the left (rest box unchanged)", r && Math.abs(r.x - 32) <= 1 && Math.abs(r.bottom - 716) <= 1 && Math.abs(r.w - 260) <= 1, r);
  await at(300 + 60);
  const mid = await probe(".pop");
  ok("mid-open: scaled down", mid && mid.w < r.w * 0.95, mid);
  ok("grows from its bottom-left corner (that corner stays put)", mid && Math.abs(mid.x - r.x) <= 2 && Math.abs(mid.bottom - r.bottom) <= 2, { mid, rest: r });
} else if (kind === "stagger") {
  await at(2000);
  const rest = [];
  for (let i = 1; i <= 4; i++) rest.push(await probe(`li.a${i}`));
  ok("all four entries visible at rest", rest.every((e) => e && e.visible >= 0.96 && e.opacity > 0.95), rest);
  const op = async (t) => { await at(t); const o = []; for (let i = 1; i <= 4; i++) o.push((await probe(`li.a${i}`)).opacity); return o; };
  for (const [i, start] of [[1, 200], [2, 280], [3, 360], [4, 440]]) {
    const pre = await op(start - 20), post = await op(start + 60);
    ok(`entry ${i} starts at ${start}ms`, pre[i - 1] < 0.02 && post[i - 1] > 0.05, { pre, post });
  }
  const end = await op(440 + 320 + 10);
  ok("the last entry is done by 770ms (320ms each)", end[3] > 0.98, end);
  await at(200 + 160);
  const m = await probe("li.a1");
  const frac = 1 - (m.y - rest[0].y) / 16;
  ok("rise decelerates (ease-out: >60% of travel at half time)", frac > 0.6 && frac < 0.99, { frac });
} else if (kind === "tooltip") {
  await at(2000);
  const r = await probe(".tip");
  ok("hint fully visible at rest", r && r.visible >= 0.96 && r.opacity > 0.95, r);
  const btn = await rect(".filter button");
  ok("hint hangs 6px under the Filter button, left-aligned (rest box unchanged)", r && Math.abs(r.x - btn[0]) <= 1 && Math.abs(r.y - (btn[1] + btn[3] + 6)) <= 1.5 && Math.abs(r.w - 300) <= 1, { r, btn });
  await at(350 + 60);
  const mid = await probe(".tip");
  ok("mid-unfold: shorter than at rest", mid && mid.h < r.h * 0.95, mid);
  ok("unfolds downward: its top edge stays put", mid && Math.abs(mid.y - r.y) <= 1.5, { mid, rest: r });
} else if (kind === "tiles") {
  await at(2000);
  const rest = [];
  for (let i = 1; i <= 4; i++) rest.push(await probe(`.t${i}`));
  ok("all four tiles visible at rest", rest.every((e) => e && e.visible >= 0.96 && e.opacity > 0.95), rest);
  const op = async (t) => { await at(t); const o = []; for (let i = 1; i <= 4; i++) o.push((await probe(`.t${i}`)).opacity); return o; };
  for (const [i, start] of [[1, 240], [2, 300], [3, 360], [4, 420]]) {
    const pre = await op(start - 20), post = await op(start + 40);
    ok(`tile ${i} starts at ${start}ms`, pre[i - 1] < 0.02 && post[i - 1] > 0.05, { pre, post });
  }
  const end = await op(420 + 300 + 10);
  ok("the last tile is done by 730ms (300ms each)", end[3] > 0.98, end);
  await at(240 + 150);
  const m = await probe(".t1");
  const frac = 1 - (m.y - rest[0].y) / 12;
  ok("lift decelerates (ease-out: >60% of travel at half time)", frac > 0.6 && frac < 0.99, { frac });
} else if (kind === "chips") {
  await at(2000);
  const r = await probe(".chips");
  ok("chips fully visible at rest", r && r.visible >= 0.96 && r.opacity > 0.95, r);
  await at(100);
  const mid = await probe(".chips");
  ok("mid-fade at 100ms: the fade starts at load", mid && mid.opacity > 0.3 && mid.opacity < 0.98, mid);
  await at(260);
  const done = await probe(".chips");
  ok("fully in by 260ms (200ms fade)", done && done.opacity > 0.98, done);
} else if (kind === "banner") {
  await at(1000);
  const shown = await probe(".banner");
  ok("banner fully visible at the top before it leaves (1000ms)", shown && shown.visible >= 0.96 && Math.abs(shown.y) <= 1, shown);
  await at(2000 + 150);
  const mid = await probe(".banner");
  const frac = mid ? -mid.y / 48 : 0;
  ok("leaving at 2150ms, accelerating (ease-in: under 40% of the way at half time)", frac > 0.02 && frac < 0.4, { frac });
  for (const t of [2400, 3000, 6000]) {
    await at(t);
    const g = await probe(".banner");
    ok(`gone at ${t}ms`, g && (g.visible === 0 || g.bottom <= 1), g);
  }
  ok("inbox unchanged", JSON.stringify(await rect("main")) === JSON.stringify([280, 80, 720, (await rect("main"))[3]]), await rect("main"));
} else if (kind === "badge") {
  const scale = () => page.evaluate(() => { const m = new DOMMatrixReadOnly(getComputedStyle(document.querySelector(".badge")).transform); return Math.hypot(m.a, m.b); });
  await at(300);
  ok("still before it starts (300ms)", Math.abs((await scale()) - 1) < 0.01, await scale());
  for (const [n, t] of [[1, 800], [2, 1400], [3, 2000]]) {
    await at(t);
    const sc = await scale();
    ok(`throb ${n} swells (${t}ms)`, sc > 1.25, sc);
  }
  for (const t of [2600, 3650, 8000]) {
    await at(t);
    const sc = await scale();
    ok(`still at ${t}ms, after three throbs`, Math.abs(sc - 1) < 0.01, sc);
  }
  const b = await probe(".badge");
  ok("badge visible at rest (its rounded corners miss the hit-test)", b && b.visible >= 0.8 && b.opacity > 0.95, b);
} else if (kind === "sheet") {
  await at(2000);
  const r = await probe(".sheet");
  ok("sheet fully up at rest, its place unchanged", r && r.visible >= 0.96 && Math.abs(r.bottom - 800) <= 1 && Math.abs(r.y - 520) <= 1, r);
  await at(200 + 280 + 10);
  const up = await probe(".sheet");
  ok("fully up by 490ms (280ms rise)", up && Math.abs(up.y - 520) <= 1, up);
  await at(200 + 140);
  const mid = await probe(".sheet");
  const frac = mid ? (800 - mid.y) / 280 : 0;
  ok("mid-rise at 340ms, decelerating (ease-out: over 60% up at half time)", frac > 0.6 && frac < 0.99, { frac });
  await at(150);
  const before = await probe(".sheet");
  ok("below the screen before 200ms", before && before.y >= 799, before);
} else if (kind === "slidein") {
  await at(2000);
  const r = await probe(".panel");
  ok("panel docked at the right at rest", r && r.visible >= 0.96 && Math.abs(r.x - 920) <= 1 && Math.abs(r.right - 1280) <= 1, r);
  await at(100);
  const before = await probe(".panel");
  ok("outside the right edge before 250ms", before && before.x >= 1279, before);
  await at(250 + 160);
  const mid = await probe(".panel");
  const frac = mid ? (1280 - mid.x) / 360 : 0;
  ok("mid-slide at 410ms: right of its place, moving leftwards, decelerating (>60% in at half time)", mid && mid.x > 921 && frac > 0.6 && frac < 0.99, { mid, frac });
} else if (kind === "progress") {
  await page.waitForFunction(() => document.querySelector("main")?.classList.contains("loaded"));
  const t = await page.evaluate(() => {
    const bar = document.querySelector(".bar");
    const tr = bar.getAnimations().find((a) => a.transitionProperty === "width");
    if (!tr) return null;
    tr.pause();
    const track = document.querySelector(".track").getBoundingClientRect().width;
    tr.currentTime = 300;
    const mid = bar.getBoundingClientRect().width / track;
    tr.finish();
    return { mid, end: bar.getBoundingClientRect().width / track };
  });
  ok("a width transition runs when the page is marked loaded", t !== null, t);
  ok("half way through (300ms) the bar is past half of its 70% (ease-out) and not there yet", t && t.mid > 0.7 * 0.6 && t.mid < 0.7 * 0.98, t);
  ok("it ends at 70%", t && Math.abs(t.end - 0.7) < 0.01, t);
} else if (kind === "accordion") {
  const closed = await rect(".panel");
  ok("closed at load", closed[3] === 0, closed);
  const afterTop = (await rect(".after"))[1];
  await page.click(".toggle");
  const t = await page.evaluate(() => {
    const panel = document.querySelector(".panel");
    const tr = panel.getAnimations().find((a) => a.transitionProperty === "height");
    if (!tr) return null;
    tr.pause();
    tr.currentTime = 125;
    const mid = panel.getBoundingClientRect().height;
    tr.finish();
    return { mid, full: panel.getBoundingClientRect().height };
  });
  ok("clicking it starts a height transition", t !== null, t);
  ok("half way (125ms) it is part open, more than half (ease-out)", t && t.mid > t.full * 0.6 && t.mid < t.full * 0.98, t);
  ok("fully open shows all three lines", t && t.full > 90, t);
  ok("the total moved down by the panel's height", Math.abs((await rect(".after"))[1] - afterTop - (t?.full ?? 0)) <= 2, await rect(".after"));
  await page.click(".toggle");
  const back = await page.evaluate(() => {
    const tr = document.querySelector(".panel").getAnimations().find((a) => a.transitionProperty === "height");
    if (!tr) return null;
    tr.finish();
    return document.querySelector(".panel").getBoundingClientRect().height;
  });
  ok("clicking again closes it with a transition, back to 0", back === 0, back);
} else if (kind === "dialog") {
  await page.click(".delete");
  const pop = await page.evaluate(() => {
    const a = document.querySelector(".dialog").getAnimations()[0];
    if (!a) return null;
    const t = a.effect.getComputedTiming();
    return { duration: t.duration };
  });
  ok("opening the dialog runs an animation of 200ms", pop && Math.abs(pop.duration - 200) <= 1, pop);
  const centre = (r) => r && { cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
  for (const t of [0, 60, 100, 160]) {
    await at(t);
    const r = await probe(".dialog");
    const c = centre(r);
    ok(`centred at ${t}ms of the opening`, c && Math.abs(c.cx - 640) <= 2 && Math.abs(c.cy - 400) <= 2, { ...r, ...c });
  }
  await at(100);
  const mid = await probe(".dialog");
  ok("mid-opening (100ms): part faded in and a little smaller", mid && mid.opacity > 0.3 && mid.opacity < 0.98 && mid.w < 400 && mid.w > 380, mid);
  await at(2000);
  const rest = await probe(".dialog");
  ok("open at rest: 400px wide, centred, fully visible", rest && Math.abs(rest.w - 400) <= 1 && Math.abs(rest.x + rest.w / 2 - 640) <= 1 && Math.abs(rest.y + rest.h / 2 - 400) <= 1 && rest.visible >= 0.96 && rest.opacity > 0.95, rest);
} else if (kind === "hover") {
  const restY = (await rect("#c2"))[1];
  const box = await rect("#c2");
  const lift = async (t) =>
    page.evaluate((t) => {
      const el = document.querySelector("#c2");
      const a = el.getAnimations().find((x) => x.transitionProperty === "transform");
      if (!a) return null;
      const d = a.effect.getComputedTiming().duration;
      a.pause();
      a.currentTime = t;
      const y = el.getBoundingClientRect().y;
      return { d, y };
    }, t);
  const finish = () => page.evaluate(() => document.querySelector("#c2").getAnimations().forEach((a) => a.finish()));
  await page.mouse.move(box[0] + box[2] / 2, box[1] + box[3] / 2);
  const up = await lift(75);
  ok("pointer over: a 150ms transform transition runs", up && Math.abs(up.d - 150) <= 1, up);
  ok("lifting at 75ms: more than half way up (ease-out)", up && (restY - up.y) / 4 > 0.6 && restY - up.y < 3.98, { restY, up });
  await finish();
  ok("lifted 4px while over it", Math.abs((await rect("#c2"))[1] - (restY - 4)) <= 0.5, await rect("#c2"));
  await page.mouse.move(5, 5);
  const down = await lift(75);
  ok("pointer off: a 150ms transform transition runs back", down && Math.abs(down.d - 150) <= 1, down);
  ok("settling at 75ms: more than half way down (ease-out)", down && (down.y - (restY - 4)) / 4 > 0.6 && down.y < restY - 0.02, { restY, down });
  await finish();
  ok("back at rest", (await rect("#c2"))[1] === restY, await rect("#c2"));
} else if (kind === "reveal") {
  const hidden = await probe(".team");
  ok("a section far below the fold is hidden at load", hidden && hidden.opacity < 0.05, hidden);
  for (const sel of [".what", ".studio", ".team", ".contact"]) {
    await page.evaluate((sel) => document.querySelector(sel).scrollIntoView({ block: "start" }), sel);
    await page.waitForTimeout(150);
    const tr = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const a = el.getAnimations().find((x) => x.transitionProperty === "opacity");
      if (!a) return { opacity: Number(getComputedStyle(el).opacity) };
      a.pause();
      const d = a.effect.getComputedTiming().duration;
      a.currentTime = d / 2;
      const r = { d, mid: Number(getComputedStyle(el).opacity) };
      el.getAnimations().forEach((x) => x.finish());
      return r;
    }, sel);
    if (sel !== ".contact" || tr.d !== undefined)
      ok(`${sel} fades in over 400ms when scrolled to (mid-fade at 200ms)`, tr.d !== undefined && Math.abs(tr.d - 400) <= 1 && tr.mid > 0.3 && tr.mid < 0.98, tr);
    await page.waitForTimeout(50);
    const o = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return { opacity: Number(getComputedStyle(el).opacity), transform: getComputedStyle(el).transform };
    }, sel);
    ok(`${sel} fully visible once scrolled to`, o.opacity > 0.98 && (o.transform === "none" || o.transform === "matrix(1, 0, 0, 1, 0, 0)"), o);
  }
} else if (kind === "flip") {
  // Who is seen at the card's centre: hit-testing skips a hidden backface, as painting does.
  const seen = () =>
    page.evaluate(() => {
      const r = document.querySelector(".card").getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return top?.closest(".face")?.classList.contains("back") ? "back" : top?.closest(".face") ? "front" : "none";
    });
  ok("question side faces you at load", (await seen()) === "front", await seen());
  await page.click(".flip");
  const tr = await page.evaluate(() => {
    const a = document.querySelector(".card").getAnimations().find((x) => x.transitionProperty === "transform");
    return a ? a.effect.getComputedTiming().duration : null;
  });
  ok("clicking turns the card with a 500ms transform transition", tr !== null && Math.abs(tr - 500) <= 1, tr);
  for (const t of [350, 450]) {
    await at(t);
    ok(`past edge-on (${t}ms): the answer side, not the question mirrored`, (await seen()) === "back", await seen());
  }
  await at(2000);
  ok("turned over at rest: the answer side", (await seen()) === "back", await seen());
  await page.click(".flip");
  await at(2000);
  ok("turned back: the question side again", (await seen()) === "front", await seen());
} else if (kind === "interrupt") {
  const full = async () => {
    const h = await page.evaluate(() => {
      const m = document.querySelector(".menu");
      return { h: m.getBoundingClientRect().height, op: Number(getComputedStyle(m).opacity) };
    });
    return h;
  };
  // The menu's laid-out height (scale 1), for fractions.
  const layoutH = await page.evaluate(() => document.querySelector(".menu").offsetHeight);
  await page.click(".filters");
  const dur = await page.evaluate(() =>
    document.querySelector(".menu").getAnimations().map((a) => a.effect.getComputedTiming().duration),
  );
  ok("opening runs 300ms", dur.length > 0 && dur.every((d) => Math.abs(d - 300) <= 1), dur);
  await at(100);
  const mid = await full();
  ok("part open at 100ms (ease-out: past a third)", mid.h / layoutH > 0.35 && mid.h / layoutH < 0.95, { ...mid, layoutH });
  // A second click while it unfolds: what the page does next must start where it is.
  await page.click(".filters");
  await page.evaluate(() => document.querySelector(".menu").getAnimations().forEach((a) => a.pause()));
  const after = await full();
  ok("clicked again at 100ms: it does not jump (height within 15% of where it was)", Math.abs(after.h - mid.h) / layoutH < 0.15, { before: mid, after, layoutH });
  await page.evaluate(() => document.querySelector(".menu").getAnimations().forEach((a) => a.finish()));
  const shut = await full();
  ok("and folds up to closed", shut.h < 1 && shut.op < 0.05, shut);
  await page.click(".filters");
  await page.evaluate(() => document.querySelector(".menu").getAnimations().forEach((a) => a.finish()));
  const open = await full();
  ok("opened again: fully open", Math.abs(open.h - layoutH) <= 1 && open.op > 0.98, { ...open, layoutH });
  const m = await probe(".menu");
  ok("menu under the button, 280px wide", m && Math.abs(m.w - 280) <= 1 && m.visible >= 0.96, m);
} else if (kind === "reduced") {
  await page.waitForTimeout(100);
  const moving = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
  ok("under reduced motion nothing animates", moving === 0, moving);
  for (let i = 1; i <= 3; i++) {
    const t = await probe(`.tile:nth-child(${i})`);
    ok(`tile ${i} is there at once, in place, under reduced motion`, t && t.opacity > 0.98 && t.visible >= 0.9, t);
  }
  // Without the preference: still the staggered rise.
  const plain = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await plain.goto(pathToFileURL(resolve(file)).href);
  const r = await plain.evaluate(() =>
    [...document.querySelectorAll(".tile")].map((el) => {
      const a = el.getAnimations()[0];
      if (!a) return null;
      const t = a.effect.getComputedTiming();
      a.pause();
      a.currentTime = t.delay + 200;
      const mid = Number(getComputedStyle(el).opacity);
      return { d: t.duration, delay: t.delay, mid };
    }),
  );
  ok("without the preference the tiles still rise in, 400ms each, 80ms apart", r.every((x, i) => x && Math.abs(x.d - 400) <= 1 && Math.abs(x.delay - 80 * i) <= 1 && x.mid > 0.3 && x.mid < 0.98), r);
} else if (kind === "push") {
  const y = () => page.evaluate(() => document.querySelector("article h1").getBoundingClientRect().y);
  const ys = [];
  for (const t of [0, 100, 150, 250, 2000]) {
    await at(t);
    ys.push(await y());
  }
  ok("the article never moves (0 to rest)", Math.max(...ys) - Math.min(...ys) <= 0.5, ys);
  // The brief says both "lying over the top of the article" and "without changing how … the article
  // look[s] once everything is still", and the broken page's rest has the notice above the article:
  // under the bar with the notice laid over it (104) or below the notice's own room (160) both hold.
  ok("the article sits under the top bar (over-laid, 104) or under the notice's room (160)", Math.abs(ys[0] - 104) <= 1 || Math.abs(ys[0] - 160) <= 1, ys[0]);
  const rest = await probe(".notice");
  ok("notice pinned under the top bar at rest, full width, fully visible", rest && Math.abs(rest.y - 64) <= 1 && Math.abs(rest.h - 56) <= 1 && rest.w >= 1279 && rest.visible >= 0.96, rest);
  const dur = await page.evaluate(() => document.querySelector(".notice").getAnimations().map((a) => a.effect.getComputedTiming().duration));
  ok("the notice arrives over 300ms", dur.some((d) => Math.abs(d - 300) <= 1), dur);
  await at(150);
  const mid = await probe(".notice");
  ok("mid-way (150ms): coming down from behind the bar, past half (ease-out)", mid && mid.y < 63 && mid.y > 64 - 56 * 0.4, mid);
  await at(2000);
  const front = await page.evaluate(() => {
    const n = document.querySelector(".notice").getBoundingClientRect();
    const top = document.elementFromPoint(n.x + n.width / 2, n.y + n.height / 2);
    return top?.closest(".notice") ? "notice" : top?.tagName;
  });
  ok("the notice is in front at rest, nothing over it", front === "notice", front);
} else if (kind === "seam") {
  const angle = (t) =>
    page.evaluate((t) => {
      const el = document.querySelector(".spinner");
      const a = el.getAnimations()[0];
      if (!a) return null;
      a.pause();
      a.currentTime = t;
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      return (Math.atan2(m.b, m.a) * 180) / Math.PI;
    }, t);
  const timing = await page.evaluate(() => {
    const a = document.querySelector(".spinner").getAnimations()[0];
    const t = a?.effect.getComputedTiming();
    return t ? { d: t.duration, it: t.iterations, easing: t.easing } : null;
  });
  ok("one turn a second, forever", timing && Math.abs(timing.d - 1000) <= 1 && timing.it === Infinity, timing);
  // Every 1/60s step the same, across the loop's seam too: 6 degrees a frame.
  const steps = [];
  for (const t of [100, 500, 983, 1000, 1017, 1983, 2017]) {
    const a0 = await angle(t - 1000 / 60), a1 = await angle(t);
    steps.push(((a1 - a0 + 540) % 360) - 180);
  }
  ok("steady speed, no hitch at the seam (each 16.7ms step is 6 degrees clockwise)", steps.every((d) => Math.abs(d - 6) <= 0.4), steps);
  const r = await probe(".spinner");
  const w = await page.evaluate(() => document.querySelector(".spinner").offsetWidth);
  ok("spinner visible, 56px (its own box; a turned box's bounds are wider)", r && w === 56 && r.visible >= 0.8, { ...r, w });
} else if (kind === "draw") {
  const state = (t) =>
    page.evaluate((t) => {
      const p = document.querySelector(".tick path");
      for (const a of p.getAnimations()) { a.pause(); a.currentTime = t; }
      const cs = getComputedStyle(p);
      const dash = cs.strokeDasharray === "none" ? [Infinity] : cs.strokeDasharray.split(/[ ,]+/).map(parseFloat);
      const len = p.getTotalLength();
      const off = parseFloat(cs.strokeDashoffset) || 0;
      // Drawn length: with dash d (on) and gap g, offset o, the stroke visible over [0, len].
      const on = dash[0], gap = dash.length > 1 ? dash[1] : dash[0];
      let drawn = 0;
      if (!Number.isFinite(on)) drawn = len;
      else for (let x = 0; x < len; x += 0.25) { const ph = (((x + off) % (on + gap)) + (on + gap)) % (on + gap); if (ph < on) drawn += 0.25; }
      // One continuous run from the start?
      let firstGap = len;
      if (Number.isFinite(on)) for (let x = 0; x < len; x += 0.25) { const ph = (((x + off) % (on + gap)) + (on + gap)) % (on + gap); if (ph >= on) { firstGap = x; break; } }
      return { len, drawn, firstGap, visibleFromStart: Number.isFinite(on) ? ((((0 + off) % (on + gap)) + (on + gap)) % (on + gap)) < on : true };
    }, t);
  const dur = await page.evaluate(() => document.querySelector(".tick path").getAnimations().map((a) => { const t = a.effect.getComputedTiming(); return { d: t.duration, delay: t.delay }; }));
  ok("draws over 600ms, starting 200ms in", dur.length === 1 && Math.abs(dur[0].d - 600) <= 1 && Math.abs(dur[0].delay - 200) <= 1, dur);
  const before = await state(100);
  ok("nothing drawn before 200ms", before.drawn < 1, before);
  const mid = await state(200 + 300);
  ok("half way (500ms): one stroke from the short end, past half (ease-out), not done", mid.visibleFromStart && Math.abs(mid.firstGap - mid.drawn) < 1 && mid.drawn > mid.len * 0.55 && mid.drawn < mid.len - 1, mid);
  const end = await state(2000);
  ok("at rest the whole check mark is drawn", end.drawn >= end.len - 0.5, end);
} else if (kind === "gradient") {
  // Colours come from the pixels: whatever drives the gradient (registered custom properties, a
  // layer cross-faded on top), a point of the button must pass through colours between its two looks.
  const sample = async (p) => {
    const b = await p.evaluate(() => { const r = document.querySelector(".upgrade").getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
    const shot = await p.screenshot({ clip: { x: b.x, y: b.y, width: b.w, height: b.h } });
    const { PNG } = await import("pngjs");
    const img = PNG.sync.read(shot);
    const px = (fx) => { const x = Math.round(img.width * fx), y = Math.round(img.height * 0.2), i = (y * img.width + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
    return { left: px(0.12), right: px(0.88), box: b };
  };
  const dist = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  const hold = (t) => page.evaluate((t) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; } }, t);
  const want = { restLeft: [0x25, 0x63, 0xeb], restRight: [0x4f, 0x46, 0xe5], hoverLeft: [0x93, 0x33, 0xea], hoverRight: [0xdb, 0x27, 0x77] };
  await page.mouse.move(10, 10);
  const rest = await sample(page);
  ok("at rest: blue on the left, indigo on the right (as before)", dist(rest.left, want.restLeft) <= 24 && dist(rest.right, want.restRight) <= 24, rest);
  const c = rest.box;
  await page.mouse.move(c.x + c.w / 2, c.y + c.h / 2);
  const n = await page.evaluate(() => document.getAnimations().length);
  const durs = await page.evaluate(() => document.getAnimations().map((a) => a.effect.getComputedTiming().duration));
  await hold(100);
  const mid = await sample(page);
  await hold(10000);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r())));
  const end = await sample(page);
  ok("under the pointer: purple on the left, pink on the right (as before)", dist(end.left, want.hoverLeft) <= 24 && dist(end.right, want.hoverRight) <= 24, end);
  ok("a third of the way (100ms in) the colours are between the two looks", n > 0 && dist(mid.left, want.restLeft) > 20 && dist(mid.left, want.hoverLeft) > 20 && dist(mid.right, want.restRight) > 20 && dist(mid.right, want.hoverRight) > 20, { n, mid });
  ok("the shift takes 300ms", durs.length > 0 && durs.every((d) => Math.abs(d - 300) <= 1), durs);
  // And back when the pointer leaves.
  await page.evaluate(() => { for (const a of document.getAnimations()) a.finish(); });
  await page.mouse.move(10, 10);
  const back = await page.evaluate(() => document.getAnimations().length);
  await hold(100);
  const midBack = await sample(page);
  ok("leaving, it shifts back over time too", back > 0 && dist(midBack.left, want.restLeft) > 20 && dist(midBack.left, want.hoverLeft) > 20, { back, midBack });
} else if (kind === "quote") {
  const entrance = await page.evaluate(() => {
    const p = document.querySelector(".price");
    const cs = getComputedStyle(p);
    return { name: cs.animationName, duration: cs.animationDuration, easing: cs.animationTimingFunction };
  });
  ok("the price still has its 400ms ease-out entrance", entrance.name !== "none" && entrance.duration === "0.4s" && entrance.easing === "ease-out", entrance);
  // On the real clock: from 0.6s to 3.6s, sampled every ~30ms.
  await page.waitForTimeout(600);
  const samples = [];
  const t0 = Date.now();
  while (Date.now() - t0 < 3000) {
    samples.push(await page.evaluate(() => {
      const p = document.querySelector(".price");
      let op = 1;
      for (let e = p; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
      const r = p.getBoundingClientRect();
      return { op, y: r.y, text: p.textContent };
    }));
    await page.waitForTimeout(30);
  }
  const minOp = Math.min(...samples.map((s) => s.op));
  const ys = samples.map((s) => s.y);
  ok("after the entrance the price never fades again", minOp >= 0.99, { minOp, n: samples.length });
  ok("after the entrance the price never moves", Math.max(...ys) - Math.min(...ys) <= 0.5, [Math.min(...ys), Math.max(...ys)]);
  const texts = new Set(samples.map((s) => s.text));
  ok("the price updates every second", texts.size >= 3 && [...texts].every((t) => /^\$18\d\.\d\d$/.test(t)), [...texts]);
  const change = await page.evaluate(() => document.querySelector(".change")?.textContent);
  ok("the change line still updates beside it", /^\+\d+\.\d\d today$/.test(change ?? ""), change);
} else if (kind === "dismiss") {
  const before = await probe(".consent");
  ok("the message is shown at the bottom before Dismiss", before && before.visible >= 0.9 && Math.abs(before.bottom - 776) <= 1, before);
  // Click and hold whatever animation the click starts, in the same task.
  const states = await page.evaluate(() => {
    const c = document.querySelector(".consent");
    document.querySelector(".dismiss").click();
    const anims = document.getAnimations();
    const read = () => {
      const cs = getComputedStyle(c);
      const r = c.getBoundingClientRect();
      return { display: cs.display, opacity: Number(cs.opacity), y: r.y, hidden: c.hidden };
    };
    const out = { n: anims.length, durations: anims.map((a) => a.effect.getComputedTiming().duration) };
    for (const a of anims) { a.pause(); a.currentTime = 0; }
    out.start = read();
    for (const a of anims) a.currentTime = 125;
    out.mid = read();
    return out;
  });
  ok("clicking starts a 250ms leave", states.n > 0 && states.durations.every((d) => Math.abs(d - 250) <= 1), states);
  ok("half way (125ms) it is still on screen, part faded and part sunk", states.mid.display !== "none" && states.mid.opacity > 0.1 && states.mid.opacity < 0.9 && states.mid.y - states.start.y > 1 && states.mid.y - states.start.y < 15, states);
  await page.evaluate(() => { for (const a of document.getAnimations()) a.play(); });
  await page.waitForTimeout(800);
  const gone = await page.evaluate(() => {
    const c = document.querySelector(".consent");
    const top = document.elementFromPoint(640, 740);
    return { display: getComputedStyle(c).display, through: !(top && c.contains(top)), opacity: Number(getComputedStyle(c).opacity) };
  });
  ok("then it is gone and nothing is in the way of a click there", (gone.display === "none" || gone.opacity < 0.02) && gone.through, gone);
} else if (kind === "reading") {
  // Whatever drives it (a scroll timeline, a scroll listener), the bar's painted width follows the
  // scroll position: empty at the top, half at the middle, full at the end, and back again.
  const width = async (f) => {
    await page.evaluate((f) => scrollTo(0, f * (document.documentElement.scrollHeight - innerHeight)), f);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(50);
    return page.evaluate(() => document.querySelector(".progress").getBoundingClientRect().width);
  };
  const tall = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  ok("the article still scrolls (it is long)", tall > 2000, tall);
  const w = [];
  for (const f of [0, 0.25, 0.5, 0.75, 1, 0.5, 0]) w.push(await width(f));
  const want = [0, 320, 640, 960, 1280, 640, 0];
  ok("the bar's width follows the scroll (0, 1/4, 1/2, 3/4, all, and back)", w.every((x, i) => Math.abs(x - want[i]) <= 16), w.map(Math.round));
  const bar = await page.evaluate(() => { const r = document.querySelector(".progress").getBoundingClientRect(); const cs = getComputedStyle(document.querySelector(".progress")); return { y: r.y, h: r.height, x: r.x, bg: cs.backgroundColor, pos: cs.position }; });
  ok("the bar is the same red 4px line at the top, from the left", Math.abs(bar.y) <= 0.5 && Math.abs(bar.h - 4) <= 0.5 && Math.abs(bar.x) <= 0.5 && bar.bg === "rgb(225, 29, 72)", bar);
} else if (kind === "gear") {
  const pose = (t) =>
    page.evaluate((t) => {
      const g = document.querySelector(".gear");
      for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; }
      const r = g.getBoundingClientRect();
      const m = new DOMMatrixReadOnly(getComputedStyle(g).transform === "none" ? undefined : getComputedStyle(g).transform);
      return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, deg: (Math.atan2(m.b, m.a) * 180) / Math.PI };
    }, t);
  const poses = [];
  for (const t of [0, 250, 500, 750, 1000, 1500, 1999]) poses.push(await pose(t));
  const cx = poses.map((p) => p.cx), cy = poses.map((p) => p.cy);
  ok("the gear stays where it is drawn: its centre moves under 1px", Math.max(...cx) - Math.min(...cx) < 1 && Math.max(...cy) - Math.min(...cy) < 1, poses.map((p) => [Math.round(p.cx * 10) / 10, Math.round(p.cy * 10) / 10]));
  const timing = await page.evaluate(() => { const a = document.querySelector(".gear").getAnimations()[0]; const t = a?.effect.getComputedTiming(); return t ? { d: t.duration, it: t.iterations } : null; });
  ok("one turn every 2s, forever", timing && Math.abs(timing.d - 2000) <= 1 && timing.it === Infinity, timing);
  const d500 = ((poses[2].deg - poses[0].deg + 360) % 360);
  ok("clockwise, a quarter turn at 500ms", Math.abs(d500 - 90) <= 3, poses.map((p) => Math.round(p.deg)));
  const svg = await page.evaluate(() => { const r = document.querySelector(".sync svg").getBoundingClientRect(); return [r.width, r.height]; });
  ok("the status pill is unchanged (120x48 icon)", svg[0] === 120 && svg[1] === 48, svg);
  const inPill = await page.evaluate(() => { const g = document.querySelector(".gear").getBoundingClientRect(); const s = document.querySelector(".sync svg").getBoundingClientRect(); return g.x >= s.x - 1 && g.y >= s.y - 1 && g.right <= s.right + 1 && g.bottom <= s.bottom + 1; });
  ok("the gear lies inside its pill", inPill, inPill);
} else if (kind === "label") {
  const before = await page.evaluate(() => { const a = document.querySelector(".add"); const r = a.getBoundingClientRect(); const cs = getComputedStyle(a); return { w: r.width, h: r.height, bg: cs.backgroundColor, text: a.textContent.trim() }; });
  ok("before the click: 'Add to cart', 150px wide, 44px high, dark", before.text === "Add to cart" && Math.abs(before.w - 150) <= 1 && Math.abs(before.h - 44) <= 1 && before.bg === "rgb(28, 25, 23)", before);
  const run = await page.evaluate(() => {
    const a = document.querySelector(".add");
    a.click();
    const anims = document.getAnimations();
    const lines = () => {
      // Lines of its text, from the text's own boxes: one line is one distinct top.
      const range = document.createRange();
      range.selectNodeContents(a);
      return new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
    };
    const durs = anims.map((x) => x.effect.getComputedTiming().duration);
    const out = [];
    for (const t of [0, 16, 50, 100, 150, 200, 250, 299]) {
      for (const x of anims) { x.pause(); x.currentTime = t; }
      const r = a.getBoundingClientRect();
      out.push({ t, w: Math.round(r.width), h: Math.round(r.height * 10) / 10, lines: lines() });
    }
    return { durs, out, text: a.textContent.trim() };
  });
  ok("clicking widens it over 300ms", run.durs.some((d) => Math.abs(d - 300) <= 1) && run.out[0].w < 170 && run.out[3].w > 170 && run.out[3].w < 255, run);
  ok("all through, the button keeps its 44px height", run.out.every((x) => Math.abs(x.h - 44) <= 0.5), run.out);
  ok("all through, the label is one line", run.out.every((x) => x.lines === 1), run.out);
  await page.evaluate(() => { for (const x of document.getAnimations()) x.finish(); });
  const after = await page.evaluate(() => { const a = document.querySelector(".add"); const r = a.getBoundingClientRect(); const cs = getComputedStyle(a); return { w: r.width, h: r.height, bg: cs.backgroundColor, text: a.textContent.trim(), clipped: a.scrollWidth > a.clientWidth + 1 }; });
  ok("after: 'Added ✓ — View cart', 260px wide, 44px high, green, nothing cut off", after.text === "Added ✓ — View cart" && Math.abs(after.w - 260) <= 1 && Math.abs(after.h - 44) <= 1 && after.bg === "rgb(21, 128, 61)" && !after.clipped, after);
}
await browser.close();
const failed = checks.filter((c) => !c.pass);
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.pass ? "" : ` ${JSON.stringify(c.detail)}`}`);
console.log(failed.length === 0 ? "ORACLE: PASS" : `ORACLE: FAIL (${failed.length})`);
process.exitCode = failed.length ? 1 : 0;
