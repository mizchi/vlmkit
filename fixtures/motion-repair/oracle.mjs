// Hidden from the agents: judges a repaired page against its brief.
// node fixtures/motion-repair/oracle.mjs <notify|menu|toast|drawer|popover|stagger> <page.html>
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
}
await browser.close();
const failed = checks.filter((c) => !c.pass);
for (const c of checks) console.log(`${c.pass ? "PASS" : "FAIL"} ${c.name}${c.pass ? "" : ` ${JSON.stringify(c.detail)}`}`);
console.log(failed.length === 0 ? "ORACLE: PASS" : `ORACLE: FAIL (${failed.length})`);
process.exitCode = failed.length ? 1 : 0;
