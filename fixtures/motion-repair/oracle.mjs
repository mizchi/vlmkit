// Hidden from the agents: judges a repaired page against its brief.
// node fixtures/motion-repair/oracle.mjs <notify|menu|toast|drawer|popover|stagger|tooltip|tiles|chips|banner|badge|sheet|slidein|progress|accordion|dialog|hover|reveal> <page.html>
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [kind, file] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
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
}
await browser.close();
const failed = checks.filter((c) => !c.pass);
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.pass ? "" : ` ${JSON.stringify(c.detail)}`}`);
console.log(failed.length === 0 ? "ORACLE: PASS" : `ORACLE: FAIL (${failed.length})`);
process.exitCode = failed.length ? 1 : 0;
