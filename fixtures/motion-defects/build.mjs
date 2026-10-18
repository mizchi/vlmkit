#!/usr/bin/env node
/**
 * Known answers for `inspect motion`: seven animations an author gets wrong, each as an intact
 * page and a broken one that differs by the mistake alone. `cases.json` says what each page is
 * and which rule a correct check must report (none for intact). Run to regenerate both.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const page = (title, css, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>
*{box-sizing:border-box}
html,body{margin:0;background:#f8fafc;color:#0f172a;font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header{height:64px;display:flex;align-items:center;gap:24px;padding:0 32px;background:#fff;border-bottom:1px solid #e2e8f0}
header strong{font-size:18px}
main{max-width:880px;margin:32px auto;padding:0 24px}
h1{font-size:28px;margin:0 0 12px}
p{margin:0 0 12px;color:#334155}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:24px}
${css}
@media (prefers-reduced-motion: reduce){*{animation-duration:1ms!important}}
</style></head><body>
<header><strong>Acme</strong><span>Projects</span><span>Billing</span></header>
<main>
${body}
</main></body></html>
`;

const PARAGRAPHS = `<p>Your workspace keeps every project, its members and its billing in one place. Invite a teammate to share a board, or archive a project you no longer use.</p>
<p>Changes are saved automatically. The activity log below lists what changed and who changed it, for the last thirty days.</p>`;

/** Each case: what moves (words for Jev, selector for the DOM), the CSS that differs, and the answer. */
const CASES = [
  {
    id: "snap-back",
    target: "the green dot on the progress track",
    selector: ".dot",
    expectEasing: "ease-in-out",
    rule: "snap-back",
    note: "the final keyframe is not held: animation-fill-mode is missing",
    css: (broken) => `.track{position:relative;height:40px;margin:24px 0;border-radius:20px;background:#e2e8f0}
.dot{position:absolute;left:4px;top:4px;width:32px;height:32px;border-radius:50%;background:#16a34a;animation:go 900ms ease-in-out${broken ? "" : " forwards"}}
@keyframes go{to{transform:translateX(560px)}}`,
    body: () => `<section class="card"><h1>Upload progress</h1><p>Step 3 of 4: checking files.</p><div class="track"><div class="dot"></div></div></section>${PARAGRAPHS}`,
  },
  {
    id: "keyframe-gap",
    target: "the 'Upgrade to Pro' card",
    selector: ".promo",
    rule: "jump",
    note: "two keyframes 1% apart carry the card 100px in one frame",
    css: (broken) => `.promo{background:#1e3a8a;color:#fff;border-radius:12px;padding:24px;width:360px;animation:rise 1000ms linear both}
.promo h2{margin:0 0 8px;font-size:22px}.promo p{color:#dbeafe;margin:0}
@keyframes rise{${broken ? "0%{transform:translateY(240px)}60%{transform:translateY(160px)}61%{transform:translateY(40px)}100%{transform:none}" : "from{transform:translateY(240px)}to{transform:none}"}}`,
    body: () => `${PARAGRAPHS}<div class="promo"><h2>Upgrade to Pro</h2><p>Unlimited projects and members.</p></div>`,
  },
  {
    id: "clipped",
    target: "the 'Design review' task card",
    selector: ".task",
    rule: "absent-at-rest",
    note: "the card moves to the Done column but stays a child of an overflow: hidden column",
    css: (broken) => `.board{display:flex;gap:24px}
.col{width:300px;min-height:260px;background:#e2e8f0;border-radius:12px;padding:16px;position:relative${broken ? ";overflow:hidden" : ""}}
.col h2{font-size:16px;margin:0 0 12px}
.task{position:absolute;left:16px;top:52px;width:268px;background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:12px;z-index:1;animation:move 800ms ease-in-out both}
@keyframes move{to{transform:translateX(324px)}}`,
    body: () => `<h1>Sprint board</h1><div class="board"><div class="col"><h2>In progress</h2><div class="task"><strong>Design review</strong><br>Due Friday</div></div><div class="col"><h2>Done</h2></div></div>`,
  },
  {
    id: "covered",
    target: "the account dropdown menu with 'Sign out'",
    selector: ".menu",
    rule: "absent-at-rest",
    note: "the menu opens beneath the next card: it has no stacking order above it",
    css: (broken) => `.wrap{position:relative;height:40px}
.menu{position:absolute;right:0;top:0;width:260px;background:#fff;border:1px solid #cbd5e1;border-radius:10px;padding:8px 0;box-shadow:0 8px 24px rgba(15,23,42,.15);${broken ? "z-index:0" : "z-index:10"};animation:drop 500ms ease-out both}
.menu div{padding:8px 16px}
@keyframes drop{from{transform:translateY(-120px);opacity:0}to{transform:translateY(48px);opacity:1}}
.panel{position:relative;z-index:${broken ? "1" : "auto"};background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;height:280px}`,
    body: () => `<div class="wrap"><div class="menu"><div>Profile</div><div>Settings</div><div>Sign out</div></div></div><section class="panel"><h1>Account</h1>${PARAGRAPHS}</section>`,
  },
  {
    id: "overlap-rest",
    target: "the 'Welcome back, Alice' heading",
    selector: ".hello",
    rule: "forbid-at-rest",
    note: "the heading's end keyframe lands it on the paragraph",
    css: (broken) => `.hello{display:inline-block;font-size:32px;font-weight:700;margin:0 0 16px;animation:slide 700ms ease-out both}
@keyframes slide{from{transform:translateX(-420px);opacity:0}to{transform:translate(0,${broken ? "62px" : "0"});opacity:1}}`,
    body: () => `<section class="card"><div class="hello">Welcome back, Alice</div>${PARAGRAPHS}</section>`,
  },
  {
    id: "fade-reversed",
    target: "the yellow 'Trial ends in 3 days' notice",
    selector: ".notice",
    rule: "absent-at-rest",
    note: "a fade-in written as a fade-out: the keyframes run 1 → 0 and are held",
    css: (broken) => `.notice{background:#fef3c7;border:1px solid #f59e0b;color:#78350f;border-radius:10px;padding:16px 20px;margin-bottom:24px;font-weight:600;animation:fade 600ms ease-out both}
@keyframes fade{${broken ? "from{opacity:1;transform:none}to{opacity:0;transform:translateY(-12px)}" : "from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:none}"}}`,
    body: () => `<div class="notice">Trial ends in 3 days</div><section class="card"><h1>Overview</h1>${PARAGRAPHS}</section>`,
  },
  {
    id: "easing-wrong",
    target: "the blue slider handle",
    selector: ".handle",
    expectEasing: "ease-out",
    rule: "easing-mismatch",
    note: "the spec says ease-out; the CSS says ease-in",
    css: (broken) => `.rail{position:relative;height:8px;margin:40px 0;border-radius:4px;background:#cbd5e1}
.handle{position:absolute;left:0;top:-16px;width:40px;height:40px;border-radius:50%;background:#2563eb;animation:to 1000ms ${broken ? "ease-in" : "ease-out"} forwards}
@keyframes to{to{transform:translateX(600px)}}`,
    body: () => `<section class="card"><h1>Volume</h1><p>Drag the handle to set the level.</p><div class="rail"><div class="handle"></div></div></section>${PARAGRAPHS}`,
  },
];

const out = [];
for (const c of CASES) {
  for (const broken of [false, true]) {
    const file = `${c.id}--${broken ? "broken" : "intact"}.html`;
    writeFileSync(join(here, file), page(`${c.id} ${broken ? "broken" : "intact"}`, c.css(broken), c.body()));
    out.push({
      file,
      id: c.id,
      broken,
      target: c.target,
      selector: c.selector,
      ...(c.expectEasing ? { expectEasing: c.expectEasing } : {}),
      expect: broken ? c.rule : null,
      ...(broken ? { note: c.note } : {}),
    });
  }
}
writeFileSync(join(here, "cases.json"), `${JSON.stringify(out, null, 2)}\n`);
console.log(`${out.length} pages`);
