# @mizchi/vlmkit-animation-eval

Frame-sampled animation evaluation for a web page. Every Web Animation on the
page is paused and seeked through deterministic sample points; each sample is
screenshotted and compared, and the report says whether the animation moves
any pixels at all, when the page settles, whether `prefers-reduced-motion`
is honoured behaviourally, and whether something outside the Web Animations
API (rAF, video, GIF) is moving the page on its own.

It is the measurement behind two commands that live in different tools:

- `vlmkit check animation page.html` — the gate, with rule settings, `--json`,
  `--strip` filmstrips and the run ledger (package `@mizchi/vlmkit-markup`).
- `vlmkit-anim eval page.html` — the same report from the animation authoring
  tool, on the pages it emits (package `@mizchi/vlmkit-anim`).

```ts
import { runAnimationEval, formatAnimationEvalReport } from "@mizchi/vlmkit-animation-eval";

const report = await runAnimationEval({ source: "page.html", samples: 4 });
console.log(formatAnimationEvalReport(report));
report.issues; // [{ kind: "no-visible-effect" | "infinite-animation" | "reduced-motion-ignored" | "long-settle" | "uncontrolled-motion", severity, message, selector? }]
```

`playwright` is a required peer: the whole job is driving a browser. Depends
on `@mizchi/vlmkit-core` for page loading, browser launch and PNG utilities,
and on nothing else in the workspace.
