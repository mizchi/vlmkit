// Feasibility probe for deterministic "design policy" metrics.
//
//   node --experimental-strip-types src/util/design-policy-probe.mjs <page.html|url> ...
//
// Findings and the resulting gate proposal:
// docs/design/design-policy-metrics.md
//
// The question is not "is this beautiful" — it is whether a page's de-facto
// design system is RECOVERABLE from the render. If designed pages show
// concentrated distributions and sloppy ones show smears, the metrics
// discriminate and can become gates. If everything is a smear, the idea dies.
import { chromium } from "playwright";

const PROBE = `(() => {
  const vis = (el) => {
    if (typeof el.checkVisibility === "function") {
      return el.checkVisibility({ visibilityProperty: true, opacityProperty: true, contentVisibilityAuto: true });
    }
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden";
  };
  const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0; };
  const spacing = [], lefts = [], fontSizes = [], radii = [];
  const byRole = {};
  let considered = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    considered++;
    const cs = getComputedStyle(el);
    for (const p of ["paddingTop","paddingBottom","paddingLeft","paddingRight","marginTop","marginBottom","rowGap","columnGap"]) {
      const v = px(cs[p]);
      if (v > 0) spacing.push(v);
    }
    lefts.push(Math.round(r.left));
    fontSizes.push(px(cs.fontSize));
    radii.push(px(cs.borderTopLeftRadius));
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role")
      || (tag === "button" || (tag === "input" && /^(button|submit)$/.test(el.type)) ? "button"
      : /^h[1-6]$/.test(tag) ? tag
      : null);
    if (role) {
      (byRole[role] ??= []).push([
        px(cs.paddingTop), px(cs.paddingRight), px(cs.paddingBottom), px(cs.paddingLeft),
        px(cs.borderTopLeftRadius), px(cs.fontSize), Math.round(r.height),
      ].join("/"));
    }
  }
  return { considered, spacing, lefts, fontSizes, radii, byRole };
})()`;

const hist = (arr) => {
  const m = new Map();
  for (const v of arr) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const coverage = (arr, topN) => {
  if (arr.length === 0) return 0;
  const top = hist(arr).slice(0, topN).reduce((s, [, n]) => s + n, 0);
  return +(top / arr.length).toFixed(3);
};
// "Best fit" is a trap: base 2 fits every even value, so it always wins and
// says nothing. Test a fixed set of real design bases and prefer the LARGEST
// base that still explains the page — that is the informative claim.
const gridFit = (arr) => {
  if (arr.length === 0) return { base: 0, fit: 0 };
  let best = { base: 0, fit: 0 };
  for (const base of [4, 8]) {
    const fit = arr.filter((v) => Math.abs(v / base - Math.round(v / base)) * base <= 0.6).length / arr.length;
    if (fit >= 0.8 && base > best.base) best = { base, fit: +fit.toFixed(3) };
    if (best.base === 0 && fit > best.fit) best = { base, fit: +fit.toFixed(3) };
  }
  return best;
};

const targets = process.argv.slice(2);
const b = await chromium.launch();
console.log(["page", "els", "spcVals", "spcTop6", "gridBase", "gridFit", "leftTop8", "fontVals", "fontTop5", "radiiVals", "btnSigs", "h2Sigs"].join("\t"));
for (const t of targets) {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await p.goto(t.startsWith("http") ? t : `file://${t}`, { waitUntil: "load", timeout: 30000 });
    await p.evaluate(() => document.fonts?.ready).catch(() => {});
    const d = await p.evaluate(PROBE);
    const g = gridFit(d.spacing);
    const sig = (role) => {
      const list = d.byRole[role] ?? [];
      return list.length ? `${new Set(list).size}/${list.length}` : "-";
    };
    console.log([
      t.split("/").pop(), d.considered, new Set(d.spacing).size, coverage(d.spacing, 6),
      g.base, g.fit, coverage(d.lefts, 8),
      new Set(d.fontSizes).size, coverage(d.fontSizes, 5),
      new Set(d.radii).size, sig("button"), sig("h2"),
    ].join("\t"));
  } catch (e) {
    console.log(`${t.split("/").pop()}\tERROR ${String(e.message).slice(0, 40)}`);
  }
  await p.close();
}
await b.close();
