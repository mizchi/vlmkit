// Hidden from the agents: judges a repaired page against its brief.
// node fixtures/motion-repair/oracle.mjs <notify|menu|toast|drawer|popover|stagger|tooltip|tiles|chips|banner|badge|sheet|slidein|progress|accordion|dialog|hover|reveal|flip|interrupt|reduced|push|seam|draw|gradient|quote|dismiss|reading|gear|label|popin|rise|ring|hint|ticket|nudge|focus|fadeup|queue|lift|turn|boot|stepper|meter|guard|combo|tokens|upright> <page.html>
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [kind, file] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
if (kind === "reduced") await page.emulateMedia({ reducedMotion: "reduce" });
else await page.emulateMedia({ reducedMotion: "no-preference" });
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
} else if (kind === "popin") {
  // Pauses whatever runs on the panel at t and reads it. A transition, a @keyframes entrance or a Web
  // Animation all pass: the brief is about what is seen.
  const panelAt = (t) =>
    page.evaluate((t) => {
      const el = document.querySelector(".panel");
      const anims = el.getAnimations();
      const d = Math.max(0, ...anims.map((a) => a.effect.getComputedTiming().endTime));
      for (const a of anims) { a.pause(); a.currentTime = t; }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { d, n: anims.length, op: Number(cs.opacity), display: cs.display, y: r.y, right: r.right, w: r.width };
    }, t);
  const finish = () => page.evaluate(() => document.querySelector(".panel").getAnimations().forEach((a) => a.finish()));
  const closed = await panelAt(0);
  ok("closed at load: the panel is not shown", closed.display === "none" || closed.op < 0.05, closed);
  await page.click(".share-btn");
  const o0 = await panelAt(0);
  const o100 = await panelAt(100);
  ok("opening: something animates it over about 200ms", o100.n > 0 && Math.abs(o100.d - 200) <= 20, o100);
  ok("opening starts transparent and 8px higher", o0.op < 0.1 && o0.display !== "none", { o0 });
  await finish();
  const open = await panelAt(0);
  ok("open: fully shown, 280px wide, right edge under the button's", open.op > 0.99 && Math.abs(open.w - 280) <= 1 && Math.abs(open.right - 1248) <= 2, open);
  ok("opening at 100ms: past half faded in, past half the drop (ease-out)", o100.op > 0.5 && o100.op < 0.99 && open.y - o100.y > -4 && o100.y < open.y, { o100, open, o0 });
  ok("opening drops 8px into place", Math.abs(open.y - o0.y - 8) <= 1, { o0, open });
  await page.click(".share-btn");
  const c100 = await panelAt(100);
  ok("closing: it fades out over about 200ms", c100.n > 0 && Math.abs(c100.d - 200) <= 20 && c100.op > 0.01 && c100.op < 0.5 && c100.display !== "none", c100);
  await finish();
  const gone = await panelAt(0);
  ok("closed again: gone", gone.display === "none" || (gone.op < 0.05 && !(await page.evaluate(() => document.elementFromPoint(1200, 140)?.closest(".panel")))), gone);
} else if (kind === "rise") {
  const ids = ["#p1", "#p2", "#p3"];
  const entrance = await page.evaluate((ids) =>
    ids.map((id) => {
      const el = document.querySelector(id);
      const a = el.getAnimations().find((x) => !x.transitionProperty);
      if (!a) return null;
      const t = a.effect.getComputedTiming();
      return { delay: t.delay, d: t.duration };
    }), ids);
  ok("entrance: each card 400ms, 100ms after the one before", entrance.every((e, i) => e && Math.abs(e.d - 400) <= 1 && Math.abs(e.delay - i * 100) <= 1), entrance);
  const mid = await page.evaluate(() => {
    const el = document.querySelector("#p2");
    const a = el.getAnimations().find((x) => !x.transitionProperty);
    a.pause(); a.currentTime = 100 + 200;
    const r = el.getBoundingClientRect();
    const out = { op: Number(getComputedStyle(el).opacity), y: r.y };
    a.play();
    return out;
  });
  // Let the entrance end the way a visitor sees it, in real time.
  await page.waitForTimeout(900);
  const rest = await rect("#p2");
  ok("mid-entrance: rising and fading in", mid.op > 0.3 && mid.op < 0.99 && mid.y > rest[1] + 0.5 && mid.y < rest[1] + 16, { mid, rest });
  const box = rest;
  await page.mouse.move(box[0] + box[2] / 2, box[1] + box[3] / 2);
  const up = await page.evaluate(() => {
    const el = document.querySelector("#p2");
    const a = el.getAnimations().find((x) => x.transitionProperty === "transform" || x.transitionProperty === "translate");
    if (!a) return null;
    const d = a.effect.getComputedTiming().duration;
    a.pause(); a.currentTime = 75;
    const y = el.getBoundingClientRect().y;
    a.play();
    return { d, y };
  });
  ok("pointer over: a 150ms transition moves it", up && Math.abs(up.d - 150) <= 1, up);
  ok("lifting at 75ms: more than half way up (ease-out)", up && (rest[1] - up.y) / 4 > 0.6 && rest[1] - up.y < 3.98, { rest, up });
  await page.waitForTimeout(400);
  ok("lifted 4px while over it", Math.abs((await rect("#p2"))[1] - (rest[1] - 4)) <= 0.5, await rect("#p2"));
  const shadow = await page.evaluate(() => getComputedStyle(document.querySelector("#p2")).boxShadow);
  ok("its shadow deepens", /14px 28px/.test(shadow), shadow);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  ok("back at rest after the pointer leaves", JSON.stringify(await rect("#p2")) === JSON.stringify(rest), { now: await rect("#p2"), rest });
} else if (kind === "ring") {
  // The arc's end read from the pixels: the blue share of 360 points just inside the ring's edge.
  const share = () =>
    page.evaluate(async () => {
      const r = document.querySelector(".ring").getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
  const box = await share();
  const arc = async () => {
    const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
    return page.evaluate(async (b64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = new OffscreenCanvas(img.width, img.height);
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const { data, width, height } = g.getImageData(0, 0, img.width, img.height);
      let blue = 0;
      for (let i = 0; i < 360; i++) {
        const a = ((i + 0.5) / 360) * 2 * Math.PI;
        const x = Math.round(width / 2 + Math.sin(a) * width * 0.44), y = Math.round(height / 2 - Math.cos(a) * height * 0.44);
        const k = (y * width + x) * 4;
        if (data[k + 2] > 200 && data[k] < 80) blue++;
      }
      return blue / 360;
    }, png.toString("base64"));
  };
  const hold = (t) => page.evaluate((t) => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; } return document.getAnimations().length; }, t);
  ok("before it starts: empty", (await arc()) < 0.02, await arc());
  await page.waitForTimeout(400);
  const n = await hold(0);
  ok("once it starts, something animates the ring", n > 0, n);
  const durs = await page.evaluate(() => document.getAnimations().map((a) => a.effect.getComputedTiming().endTime));
  ok("over about one second", durs.some((d) => Math.abs(d - 1000) <= 50), durs);
  const s = [];
  for (const t of [0, 100, 250, 500, 750, 999]) { await hold(t); s.push(Math.round((await arc()) * 1000) / 10); }
  ok("it fills a little at a time (0 → 72%, never jumping more than 30 points between samples)", s.every((v, i) => i === 0 || (v >= s[i - 1] - 0.5 && v - s[i - 1] < 30)) && s[0] < 10, s);
  ok("slowing at the end: past half its way at half its time", s[3] > 36 && s[3] < 71, s);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  const end = await arc();
  ok("filled: 72% blue", Math.abs(end - 0.72) <= 0.02, end);
  const label = await page.evaluate(() => document.querySelector(".ring span").textContent.trim());
  ok("the number says 72%", label === "72%", label);
  const size = await rect(".ring");
  ok("the ring is still 140px", size[2] === 140 && size[3] === 140, size);
} else if (kind === "hint") {
  const help = await rect(".help");
  const bubbleAt = (t) =>
    page.evaluate((t) => {
      const el = document.querySelector(".bubble");
      const anims = el.getAnimations();
      const d = Math.max(0, ...anims.map((a) => a.effect.getComputedTiming().endTime));
      for (const a of anims) { a.pause(); a.currentTime = t; }
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { d, n: anims.length, op: Number(cs.opacity), vis: cs.visibility, display: cs.display, x: r.x, y: r.y, w: r.width, bottom: r.bottom };
    }, t);
  const finish = () => page.evaluate(() => document.querySelector(".bubble").getAnimations().forEach((a) => a.finish()));
  const shown = (b) => b.display !== "none" && b.vis === "visible" && b.op > 0.02;
  const before = await bubbleAt(0);
  ok("before the pointer: the bubble is not shown", !shown(before), before);
  await page.mouse.move(help[0] + help[2] / 2, help[1] + help[3] / 2);
  const in100 = await bubbleAt(100);
  ok("pointer over: it fades in over about 200ms", in100.n > 0 && Math.abs(in100.d - 200) <= 20 && shown(in100) && in100.op > 0.3 && in100.op < 0.98, in100);
  await finish();
  const open = await bubbleAt(0);
  ok("shown above the icon, 240px wide, fully opaque", shown(open) && open.op > 0.99 && Math.abs(open.w - 240) <= 1 && open.bottom <= help[1] - 8 && open.bottom >= help[1] - 12, { open, help });
  await page.mouse.move(5, 5);
  const out100 = await bubbleAt(100);
  ok("pointer off: it fades out over about 200ms, still shown at 100ms", out100.n > 0 && Math.abs(out100.d - 200) <= 20 && shown(out100) && out100.op > 0.2 && out100.op < 0.8, out100);
  await finish();
  const gone = await bubbleAt(0);
  ok("then gone", !shown(gone), gone);
} else if (kind === "ticket" || kind === "nudge") {
  // A finished entrance with a fill other than forwards is off its element (and out of
  // getAnimations), so it is played again from its start and paused there before it is sampled.
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    window.__oAnims = document.getAnimations();
    for (const a of window.__oAnims) a.pause();
  }, kind === "ticket" ? ".ticket" : ".notice");
}
if (kind === "ticket") {
  const poseAt = (t) =>
    page.evaluate((t) => {
      const el = document.querySelector(".ticket");
      for (const a of window.__oAnims) { a.pause(); a.currentTime = t; }
      const r = el.getBoundingClientRect();
      const tf = getComputedStyle(el).transform;
      const m = new DOMMatrixReadOnly(tf === "none" ? undefined : tf);
      return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, deg: (Math.atan2(m.b, m.a) * 180) / Math.PI, op: Number(getComputedStyle(el).opacity) };
    }, t);
  const timing = await page.evaluate(() => { const a = window.__oAnims[0]; const t = a?.effect.getComputedTiming(); return t ? { d: t.duration, delay: t.delay } : null; });
  ok("one 500ms entrance at load", timing && Math.abs(timing.d - 500) <= 1 && timing.delay === 0, timing);
  const rest = await poseAt(500);
  const p = [];
  for (const t of [0, 100, 200, 300, 400, 499]) p.push(await poseAt(t));
  ok("at rest: in place, upright, opaque", Math.abs(rest.deg) < 0.5 && rest.op > 0.99 && Math.abs(rest.cx - 640) <= 2 && Math.abs(rest.cy - 400) <= 2, rest);
  ok("starts 200px to the left, tilted 20° anticlockwise, transparent", Math.abs(p[0].cx - (rest.cx - 200)) <= 3 && Math.abs(p[0].deg + 20) <= 1 && p[0].op < 0.05, p[0]);
  ok("travels horizontally the whole way: its centre stays within 2px of its resting height", p.every((x) => Math.abs(x.cy - rest.cy) <= 2), p.map((x) => [Math.round(x.cx), Math.round(x.cy)]));
  ok("slowing at the end: past half its way at 200ms of 500", (p[2].cx - p[0].cx) / 200 > 0.55 && p[2].cx < rest.cx, p.map((x) => Math.round(x.cx)));
} else if (kind === "nudge") {
  const at2 = (t) =>
    page.evaluate((t) => {
      const el = document.querySelector(".notice");
      for (const a of window.__oAnims) { a.pause(); a.currentTime = t; }
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, op: Number(getComputedStyle(el).opacity) };
    }, t);
  const timing = await page.evaluate(() => { const a = window.__oAnims[0]; const t = a?.effect.getComputedTiming(); return t ? { d: t.duration } : null; });
  ok("a 400ms entrance at load", timing && Math.abs(timing.d - 400) <= 1, timing);
  const rest = await at2(400);
  const s0 = await at2(0);
  const s1 = await at2(160);
  ok("at rest: in its place in the column, opaque", rest.op > 0.99 && Math.abs(rest.x - 304) <= 2, rest);
  ok("starts 360px to the left of its place, transparent", Math.abs(s0.x - (rest.x - 360)) <= 3 && s0.op < 0.05 && Math.abs(s0.y - rest.y) <= 1, { s0, rest });
  ok("slowing at the end: past half its way at 160ms of 400", (s1.x - s0.x) / 360 > 0.55 && s1.x < rest.x - 1, { s0, s1, rest });
  const list = await rect("ul");
  ok("the list below stays where it is", Math.abs(list[1] - (rest.y + 56 + 24)) <= 30, { list, rest });
} else if (kind === "focus" || kind === "fadeup" || kind === "queue") {
  // Each entrance played again from its start and its handles kept: a finished animation with a
  // fill other than forwards is off its element.
  const sel = { focus: ".hero", fadeup: ".note", queue: ".row" }[kind];
  await page.evaluate((sel) => {
    for (const el of document.querySelectorAll(sel)) {
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "";
    }
    window.__oAnims = document.getAnimations();
    for (const a of window.__oAnims) a.pause();
  }, sel);
  const at = (t) =>
    page.evaluate(
      ({ t, sel }) => {
        for (const a of window.__oAnims) { a.pause(); a.currentTime = t; }
        return [...document.querySelectorAll(sel)].map((el) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const blur = /blur\(([\d.]+)px\)/.exec(cs.filter);
          return { y: r.y, op: Number(cs.opacity), blur: blur ? Number(blur[1]) : 0, filter: cs.filter };
        });
      },
      { t, sel },
    );
  const rest = await at(2000);
  if (kind === "focus") {
    const [s0] = await at(0), [s1] = await at(300), [r] = rest;
    ok("at rest: fully opaque and perfectly sharp (no blur left)", r.op > 0.99 && r.blur === 0, r);
    ok("starts blurred (6px or more) and transparent", s0.blur >= 6 && s0.op < 0.05, s0);
    ok("half way: still a little blurred and fading in", s1.blur > 0.3 && s1.op > 0.3 && s1.op < 0.99, s1);
    const d = await page.evaluate(() => Math.max(...window.__oAnims.map((a) => a.effect.getComputedTiming().endTime)));
    ok("over about 600ms", Math.abs(d - 600) <= 20, d);
  } else if (kind === "fadeup") {
    for (const [i, delay] of [0, 60, 120].entries()) {
      const s0 = (await at(delay))[i], s1 = (await at(delay + 120))[i], r = rest[i];
      ok(`note ${i + 1}: starts 12px below its place, transparent, at ${delay}ms`, Math.abs(s0.y - (r.y + 12)) <= 1 && s0.op < 0.05, { s0, r });
      ok(`note ${i + 1}: rising and fading in at ${delay + 120}ms`, s1.y < r.y + 11 && s1.y > r.y + 0.5 && s1.op > 0.2 && s1.op < 0.99, { s1, r });
      ok(`note ${i + 1}: in place at rest`, r.op > 0.99, r);
    }
  } else {
    for (let k = 0; k < 4; k++) {
      const before = k > 0 ? (await at(k * 80 - 10))[k] : null;
      const mid = (await at(k * 80 + 100))[k];
      const r = rest[k];
      if (before) ok(`row ${k + 1}: not visible before its turn (${k * 80 - 10}ms)`, before.op < 0.05, before);
      ok(`row ${k + 1}: rising and fading in at ${k * 80 + 100}ms`, mid.op > 0.2 && mid.op < 0.99 && mid.y > r.y + 0.5 && mid.y < r.y + 12, { mid, r });
      ok(`row ${k + 1}: settled at rest`, r.op > 0.99, r);
    }
  }
}
if (kind === "lift") {
  const base = await rect("#p2");
  const finish = () => page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  const covered = (sel) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const r = el.getBoundingClientRect();
      const out = [];
      for (let i = 0; i <= 10; i++)
        for (const fx of [0.01, 0.5, 0.99]) {
          const x = r.x + fx * r.width, y = r.y + 8 + (i / 10) * (r.height - 16);
          const top = document.elementFromPoint(x, y);
          if (!top || !el.contains(top)) out.push([Math.round(x), Math.round(y), top?.id || top?.tagName]);
        }
      return { w: r.width, h: r.height, covered: out };
    }, sel);
  for (const id of ["#p1", "#p2", "#p3"]) {
    const r0 = await rect(id);
    await page.mouse.move(r0[0] + r0[2] / 2, r0[1] + r0[3] / 2);
    if (id === "#p2") {
      const t = await page.evaluate(() => {
        const a = document.querySelector("#p2").getAnimations().find((x) => x.transitionProperty === "transform");
        if (!a) return null;
        a.pause();
        a.currentTime = 100;
        const w = document.querySelector("#p2").getBoundingClientRect().width;
        return { d: a.effect.getComputedTiming().duration, w };
      });
      ok("hover: the lift takes about 200ms and is past half way at 100ms", t && Math.abs(t.d - 200) <= 10 && t.w > base[2] * 1.055 && t.w < base[2] * 1.099, { t, base });
    }
    await finish();
    const c = await covered(id);
    ok(`${id} lifted: 110% of its size`, Math.abs(c.w - r0[2] * 1.1) <= 2, { c: c.w, r0 });
    ok(`${id} lifted: no part of it is covered`, c.covered.length === 0, c.covered.slice(0, 6));
  }
  // Settling back it is still raised: covered as it shrinks is the same defect (both round 16
  // agents kept it on top until it had settled).
  const r2 = await rect("#p2");
  await page.mouse.move(r2[0] + r2[2] / 2, r2[1] + r2[3] / 2);
  await finish();
  await page.mouse.move(5, 5);
  await page.evaluate(() => {
    for (const a of document.querySelector("#p2").getAnimations()) { a.pause(); a.currentTime = 40; }
  });
  const leaving = await covered("#p2");
  ok("settling back (40ms after the pointer leaves): still not covered", leaving.covered.length === 0 && leaving.w > base[2] * 1.01, leaving.covered.slice(0, 4));
  await finish();
  const back = await rect("#p2");
  ok("pointer away: it settles back", JSON.stringify(back) === JSON.stringify(base), { back, base });
} else if (kind === "turn") {
  const r0 = await rect("#card");
  ok("card 360x240 at rest, centred", r0[2] === 360 && r0[3] === 240 && Math.abs(r0[0] + 180 - 640) <= 1, r0);
  const topIs = (cls) => page.evaluate((cls) => { const t = document.elementFromPoint(640, 400); return !!t?.closest(cls); }, cls);
  ok("front face up at rest", await topIs(".front"), null);
  await page.mouse.click(640, 400);
  const pose = (t) =>
    page.evaluate((t) => {
      const el = document.querySelector("#card");
      const a = el.getAnimations().find((x) => x.transitionProperty === "transform");
      if (!a) return null;
      a.pause();
      a.currentTime = t;
      const r = el.getBoundingClientRect();
      return { d: a.effect.getComputedTiming().duration, x: r.x, w: r.width, h: r.height };
    }, t);
  const p = [];
  for (const t of [200, 300, 400]) p.push(await pose(t));
  ok("one 600ms turn", p[0] && Math.abs(p[0].d - 600) <= 10, p[0]);
  ok("in depth: on the way the near edge is taller than the card (perspective about 900px)", p[0] && p[0].h > 252 && p[0].h < 300 && p[2].h > 252 && p[2].h < 300, p);
  ok("edge on half way", p[1] && p[1].w < 40, p[1]);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  const r1 = await rect("#card");
  ok("turned over: flat and upright, the answer up", JSON.stringify(r1) === JSON.stringify(r0) && (await topIs(".back")), r1);
  await page.mouse.click(640, 400);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  ok("a second click turns it back", await topIs(".front"), null);
} else if (kind === "boot") {
  const { readFile } = await import("node:fs/promises");
  const src = await readFile(file, "utf8");
  ok("the boot utility stays: animations held while the fonts load, then released", /animation-play-state:\s*paused/.test(src) && /fonts\.ready/.test(src) && /is-booting/.test(src), null);
  await page.waitForTimeout(1200);
  const real = await page.evaluate(() =>
    [...document.querySelectorAll(".result")].map((el) => ({ op: Number(getComputedStyle(el).opacity), paused: el.getAnimations().some((a) => a.playState === "paused") })),
  );
  ok("by real time 1.2s after load every result is fully shown, nothing held", real.length === 4 && real.every((r) => r.op > 0.99 && !r.paused), real);
  await page.evaluate(() => {
    for (const el of document.querySelectorAll(".result")) { el.style.animation = "none"; void el.offsetWidth; el.style.animation = ""; }
    window.__oAnims = document.getAnimations();
    for (const a of window.__oAnims) a.pause();
  });
  const at2 = (t) =>
    page.evaluate((t) => {
      for (const a of window.__oAnims) { a.pause(); a.currentTime = t; }
      return [...document.querySelectorAll(".result")].map((el) => ({ y: el.getBoundingClientRect().y, op: Number(getComputedStyle(el).opacity) }));
    }, t);
  const rest = await at2(2000);
  for (let k = 0; k < 4; k++) {
    const s0 = (await at2(k * 80))[k], s1 = (await at2(k * 80 + 160))[k];
    ok(`result ${k + 1}: starts 16px below and transparent at ${k * 80}ms`, Math.abs(s0.y - (rest[k].y + 16)) <= 1 && s0.op < 0.05, { s0, r: rest[k] });
    ok(`result ${k + 1}: rising and fading in at ${k * 80 + 160}ms`, s1.op > 0.3 && s1.op < 0.99 && s1.y > rest[k].y + 0.3 && s1.y < rest[k].y + 12, { s1, r: rest[k] });
  }
}
if (kind === "stepper" || kind === "meter" || kind === "guard") {
  const sel = { stepper: "#panel", meter: "#fill", guard: "#hero" }[kind];
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    window.__oAnims = el.getAnimations();
    for (const a of window.__oAnims) a.pause();
  }, sel);
  const at3 = (t) =>
    page.evaluate(
      ({ t, sel }) => {
        for (const a of window.__oAnims) { a.pause(); a.currentTime = t; }
        const el = document.querySelector(sel);
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height, op: Number(getComputedStyle(el).opacity), n: window.__oAnims.length };
      },
      { t, sel },
    );
  const d = await page.evaluate(() => Math.max(0, ...window.__oAnims.map((a) => a.effect.getComputedTiming().endTime)));
  if (kind === "stepper") {
    ok("one 600ms entrance", Math.abs(d - 600) <= 10, d);
    const xs = [];
    for (const t of [0, 40, 80, 120, 160, 200, 300, 599]) xs.push(await at3(t));
    const rest = await at3(600);
    ok("at rest: flush with the left edge, opaque, 320px wide", Math.abs(rest.x) <= 1 && rest.op > 0.99 && Math.abs(rest.w - 320) <= 1, rest);
    ok("starts 320px beyond the left edge, transparent", Math.abs(xs[0].x + 320) <= 2 && xs[0].op < 0.05, xs[0]);
    ok("glides: a different place at every 40ms of the first 200ms (no steps)", xs.slice(0, 6).every((p, i) => i === 0 || p.x > xs[i - 1].x + 0.5), xs.map((p) => Math.round(p.x)));
    ok("slowing as it arrives: a third of the way at 160ms of 600 (ease-out, not linear)", xs[4].x > -320 + 0.33 * 320 && xs[4].x < -1, xs[4]);
  } else if (kind === "meter") {
    const track = await rect(".track");
    ok("one 800ms fill", Math.abs(d - 800) <= 10, d);
    const r0 = await at3(0), r1 = await at3(260), rest = await at3(800);
    ok("at rest: the bar is 72% of the track and as tall as it", Math.abs(rest.w - 0.72 * track[2]) <= 2 && Math.abs(rest.h - track[3]) <= 1, { rest, track });
    ok("starts empty", r0.w <= 1, r0);
    ok("slowing as it arrives: past 40% of its fill at 260ms of 800 (ease-out, not linear)", r1.w > 0.4 * 0.72 * track[2] && r1.w < 0.72 * track[2] - 1, { r1, track });
    const color = await page.evaluate(() => getComputedStyle(document.querySelector("#fill")).backgroundColor);
    ok("still blue", color === "rgb(37, 99, 235)", color);
  } else {
    ok("one 500ms entrance for people without reduced motion", Math.abs(d - 500) <= 10, d);
    const s0 = await at3(0), s1 = await at3(150), rest = await at3(500);
    ok("starts 24px below its place, transparent", Math.abs(s0.y - (rest.y + 24)) <= 1 && s0.op < 0.05, { s0, rest });
    ok("slowing as it arrives: past 38% of its rise at 150ms of 500 (ease-out, not linear)", s1.y < rest.y + 24 * 0.62 && s1.y > rest.y + 0.3, { s1, rest });
    ok("at rest: in place, opaque", rest.op > 0.99, rest);
    const rm = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await rm.emulateMedia({ reducedMotion: "reduce" });
    await rm.goto(pathToFileURL(resolve(file)).href);
    const calm = await rm.evaluate(() => {
      const el = document.querySelector("#hero");
      return { n: el.getAnimations().length, op: Number(getComputedStyle(el).opacity), y: el.getBoundingClientRect().y };
    });
    ok("reduced motion: no animation, in place and opaque", calm.n === 0 && calm.op > 0.99 && Math.abs(calm.y - rest.y) <= 1, { calm, rest });
  }
}
if (kind === "combo") {
  await page.evaluate(() => {
    const el = document.querySelector("#toast");
    el.style.animation = "none";
    void el.offsetWidth;
    el.style.animation = "";
    window.__oAnims = el.getAnimations();
    for (const a of window.__oAnims) a.pause();
  });
  const pose = (t) =>
    page.evaluate((t) => {
      for (const a of window.__oAnims) { a.pause(); a.currentTime = t; }
      const el = document.querySelector("#toast");
      const r = el.getBoundingClientRect();
      return { y: r.y, w: r.width, op: Number(getComputedStyle(el).opacity), n: window.__oAnims.length };
    }, t);
  const rest = await pose(400);
  const s0 = await pose(0), s1 = await pose(120);
  const pulseMid = await pose(400 + 800), pulseEnd = await pose(400 + 1600);
  ok("two animations: the entrance and the pulse", s0.n === 2, s0);
  ok("starts 24px below its place, transparent", Math.abs(s0.y - (rest.y + 24)) <= 1 && s0.op < 0.05, { s0, rest });
  ok("rising and fading in at 120ms, slowing as it arrives", s1.y < rest.y + 24 * 0.62 && s1.y > rest.y + 0.3 && s1.op > 0.2 && s1.op < 0.99, { s1, rest });
  ok("in place at the bottom-right corner, opaque", Math.abs(rest.y + 58 - 776) <= 30 && rest.op > 0.99, rest);
  ok("pulses: 104% half way through a 1.6s pulse, 100% at its end", Math.abs(pulseMid.w / rest.w - 1.04) <= 0.006 && Math.abs(pulseEnd.w / rest.w - 1) <= 0.003, { pulseMid, pulseEnd, rest });
  const inf = await page.evaluate(() => window.__oAnims.some((a) => a.effect.getComputedTiming().iterations === Infinity));
  ok("the pulse repeats forever", inf, inf);
} else if (kind === "tokens") {
  const closed = await rect("#drawer");
  ok("closed: the drawer is off the right edge", closed[0] >= 1279, closed);
  await page.click("#open");
  const slide = (t) =>
    page.evaluate((t) => {
      const el = document.querySelector("#drawer");
      const a = el.getAnimations().find((x) => x.transitionProperty === "transform");
      if (!a) return null;
      a.pause();
      a.currentTime = t;
      return { d: a.effect.getComputedTiming().duration, x: el.getBoundingClientRect().x };
    }, t);
  const m = await slide(60);
  ok("a click slides it in over about 180ms", m && Math.abs(m.d - 180) <= 5, m);
  ok("slowing as it arrives: past 40% of its way at 60ms of 180", m && m.x < 1280 - 0.4 * 360 && m.x > 920 + 1, m);
  await page.evaluate(() => document.getAnimations().forEach((a) => a.finish()));
  const open = await rect("#drawer");
  ok("open: flush with the right edge, 360px wide", open[0] === 920 && open[2] === 360, open);
  await page.click("#open");
  const back = await slide(60);
  ok("another click slides it back out the same way", back && Math.abs(back.d - 180) <= 5 && back.x > 920 + 1 && back.x < 1279, back);
} else if (kind === "upright") {
  const at4 = (t) =>
    page.evaluate((t) => {
      for (const a of document.getAnimations()) { a.pause(); a.currentTime = t; }
      const deg = (el) => {
        let m = new DOMMatrix();
        for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
          const tf = getComputedStyle(n).transform;
          if (tf && tf !== "none") m = new DOMMatrix(tf).multiply(m);
        }
        return (Math.atan2(m.b, m.a) * 180) / Math.PI;
      };
      return { dial: deg(document.querySelector("#dial")), label: deg(document.querySelector("#label")) };
    }, t);
  const ts = [500, 1300, 2200, 3100, 3900, 5700, 8900];
  const poses = [];
  for (const t of ts) poses.push(await at4(t));
  ok("the dial turns clockwise once every 4s", Math.abs((((poses[0].dial % 360) + 360) % 360) - 45) <= 1 && Math.abs((((poses[2].dial % 360) + 360) % 360) - 198) <= 1, poses.slice(0, 3));
  ok("the word stays upright at every instant (within 0.5°)", poses.every((p) => Math.abs(p.label) <= 0.5 || Math.abs(Math.abs(p.label) - 360) <= 0.5), poses.map((p) => Math.round(p.label * 10) / 10));
}
await browser.close();
const failed = checks.filter((c) => !c.pass);
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.pass ? "" : ` ${JSON.stringify(c.detail)}`}`);
console.log(failed.length === 0 ? "ORACLE: PASS" : `ORACLE: FAIL (${failed.length})`);
process.exitCode = failed.length ? 1 : 0;
