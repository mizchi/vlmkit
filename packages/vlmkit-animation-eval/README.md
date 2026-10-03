# @mizchi/vlmkit-animation-eval

Frame-sampled animation evaluation for a web page. Every Web Animation on the
page is paused and seeked through deterministic sample points; each sample is
screenshotted and compared, and the report says whether the animation moves
any pixels at all, when the page settles, whether `prefers-reduced-motion`
is honoured behaviourally, and whether something outside the Web Animations
API (rAF, video, GIF) is moving the page on its own.

It is the measurement behind `vlmkit check animation page.html` — the gate,
with rule settings, `--json`, `--strip` filmstrips and the run ledger (package
`@mizchi/vlmkit-markup`) — and its clock holds `check integrity --timeline`.
Use it directly to get the same report without the rest of vlmkit.

```ts
import { runAnimationEval, formatAnimationEvalReport } from "@mizchi/vlmkit-animation-eval";

const report = await runAnimationEval({ source: "page.html", samples: 4 });
console.log(formatAnimationEvalReport(report));
report.issues; // [{ kind: "no-visible-effect" | "infinite-animation" | "reduced-motion-ignored" | "long-settle" | "uncontrolled-motion" | "seek-ineffective" | "clock-motion-unsettled", severity, message, selector? }]
```

`virtualTime: true` (`--virtual-time` on the gate) holds the page clock —
`requestAnimationFrame`, `performance.now`, `Date`, `setTimeout`,
`setInterval` — from document start and advances it from the evaluator, so
script-driven motion is sampled as `report.clockMotion` instead of being
reported as uncontrolled. A page that renders from an explicit time can listen
for `vlmkit:seek` (`detail.timeMs`, `detail.waitUntil(promise)`). The clock is
exported on its own as `VIRTUAL_CLOCK_SCRIPT` (`virtual-clock.ts`).

`playwright` is a required peer: the whole job is driving a browser. Depends
on `@mizchi/vlmkit-core` for page loading, browser launch and PNG utilities,
and on nothing else in the workspace.
