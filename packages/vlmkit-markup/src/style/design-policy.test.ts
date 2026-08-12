import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type DesignPolicyInput,
  type DesignSample,
  type DesignSpacingSample,
  COLLECT_DESIGN_SAMPLES,
  buildDesignSampleScript,
  formatDesignReport,
  judgeDesignPolicy,
  runDesignPolicyCheck,
} from "./design-policy.ts";

const sample = (role: string, signature: string, selector = `.${role}-${signature}`): DesignSample => ({
  role,
  selector,
  signature,
  described: `style ${signature}`,
});

/** A styled element with the box and the font halves separable, as the collector emits them. */
const styled = (
  role: string,
  box: string,
  font: string,
  options: { textFree?: boolean; selector?: string } = {},
): DesignSample => ({
  role,
  selector: options.selector ?? `.${role}-${box}-${font}`,
  boxSignature: box,
  signature: `${box}|${font}`,
  ...(options.textFree ? { textFree: true } : {}),
  described: `box ${box}, ${options.textFree ? "icon-only" : font}`,
});

const spacing = (value: number, uses: number, property = "paddingTop"): DesignSpacingSample[] =>
  Array.from({ length: uses }, (_, i) => ({ selector: `.s${value}-${i}`, property, value }));

const input = (over: Partial<DesignPolicyInput> = {}): DesignPolicyInput => ({
  samples: [],
  spacing: [],
  skipped: 0,
  statefulSkipped: 0,
  exclusions: [],
  excludedElements: 0,
  ...over,
});

describe("judgeDesignPolicy — component drift", () => {
  it("states per-style counts instead of an average dressed as a per-style claim", () => {
    // The old wording was "each style reused only 1.5x", which contradicted its own
    // next sentence ("Dominant style, used 2x") and named a count no style had. v5's
    // repair agent: "No style is used 1.5 times. […] I could not tune the gate into
    // agreement with itself, and had to reverse-engineer the formula."
    const report = judgeDesignPolicy(input({
      samples: [
        styled("button", "10|18|10|18|8|1|white", "16|400", { selector: "#save" }),
        styled("button", "10|18|10|18|8|1|white", "16|400", { selector: "#snooze" }),
        styled("button", "10|18|10|18|8|1|blue", "16|400", { selector: "#acknowledge" }),
      ],
    }));
    const message = report.findings.find((f) => f.kind === "component-drift")!.message;
    assert.match(message, /used 2x, 1x/);
    assert.match(message, /this role averages 1\.5x/);
    assert.doesNotMatch(message, /each style reused only/);
  });

  it("names the property that actually differs, not just both fingerprints", () => {
    // "Both styles print `border 1`; the actual delta is `background` […] I opened the
    // stylesheet to learn whether the deviation was one property or two."
    const report = judgeDesignPolicy(input({
      samples: [
        styled("button", "10|18|10|18|8|1|rgb(255, 255, 255)", "16|400", { selector: "#save" }),
        styled("button", "10|18|10|18|8|1|rgb(255, 255, 255)", "16|400", { selector: "#snooze" }),
        styled("button", "10|18|10|18|8|1|rgb(34, 85, 204)", "16|400", { selector: "#acknowledge" }),
      ],
    }));
    const message = report.findings.find((f) => f.kind === "component-drift")!.message;
    assert.match(message, /differs in background-color rgb\(255, 255, 255\) → rgb\(34, 85, 204\)/);
    // One property, and the message says so — that was the whole question.
    assert.doesNotMatch(message, /and \d+ more/);
  });

  it("caps the differing-property list, since a style that differs in everything answers by count", () => {
    const report = judgeDesignPolicy(input({
      samples: [
        styled("button", "0|0|0|0|0|0|transparent", "16|400", { selector: "#a" }),
        styled("button", "0|0|0|0|0|0|transparent", "16|400", { selector: "#b" }),
        styled("button", "10|18|10|18|8|1|white", "20|700", { selector: "#c" }),
      ],
    }));
    const message = report.findings.find((f) => f.kind === "component-drift")!.message;
    assert.match(message, /and \d+ more/);
  });

  it("offers --exclude when the dominant style has the shape of vendor chrome", () => {
    // #112 item 4: three icon-only zoom buttons outvoted the app's own three, so the
    // app's buttons were reported as the deviants. Two agents found `--exclude` only
    // by opening `--help`; the gate has the evidence to mention it here.
    const report = judgeDesignPolicy(input({
      samples: [
        styled("button", "0|0|0|0|0|0|rgba(0, 0, 0, 0)", "12|400", { textFree: true, selector: ".vendor-zoom-in" }),
        styled("button", "0|0|0|0|0|0|rgba(0, 0, 0, 0)", "12|400", { textFree: true, selector: ".vendor-zoom-out" }),
        styled("button", "0|0|0|0|0|0|rgba(0, 0, 0, 0)", "12|400", { textFree: true, selector: ".vendor-reset" }),
        styled("button", "10|18|10|18|8|1|white", "16|400", { selector: "#save" }),
        styled("button", "10|18|10|18|8|1|blue", "16|400", { selector: "#acknowledge" }),
      ],
    }));
    const message = report.findings.find((f) => f.kind === "component-drift")!.message;
    assert.match(message, /--exclude/);
    assert.match(message, /third-party widget/);
  });

  it("does not offer --exclude when the dominant style is the page's own component", () => {
    // A false positive here costs a sentence, but it must not appear on every page.
    const report = judgeDesignPolicy(input({
      samples: [
        styled("button", "10|18|10|18|8|1|white", "16|400", { selector: "#save" }),
        styled("button", "10|18|10|18|8|1|white", "16|400", { selector: "#snooze" }),
        styled("button", "10|18|10|18|8|1|blue", "16|400", { selector: "#acknowledge" }),
      ],
    }));
    const message = report.findings.find((f) => f.kind === "component-drift")!.message;
    assert.doesNotMatch(message, /--exclude/);
  });

  it("reports a role whose styles are barely reused", () => {
    // Agent fixture shape: 6 buttons, 3 styles, reuse 2.0.
    const report = judgeDesignPolicy(input({
      samples: [
        sample("button", "a"), sample("button", "a"),
        sample("button", "b"), sample("button", "b"),
        sample("button", "c"), sample("button", "c"),
      ],
    }));
    assert.equal(report.verdict, "drift");
    const drift = report.findings.filter((f) => f.kind === "component-drift");
    assert.equal(drift.length, 1);
    assert.equal(drift[0]!.role, "button");
    assert.equal(drift[0]!.severity, "warn");
    assert.match(drift[0]!.message, /6 "button" elements render 3 distinct styles/);
    assert.equal(report.roles[0]!.reuse, 2);
    assert.equal(report.roles[0]!.singletons, 0);
  });

  it("stays quiet when one style carries the role", () => {
    // MDN shape: 8 buttons, 1 style, reuse 8.0.
    const report = judgeDesignPolicy(input({
      samples: Array.from({ length: 8 }, () => sample("button", "a")),
    }));
    assert.deepEqual(report.findings, []);
    assert.equal(report.verdict, "coherent");
    assert.equal(report.roles[0]!.reuse, 8);
  });

  it("refuses to judge a role below the instance floor", () => {
    // 2 buttons / 2 styles is reuse 1.0, but "every style is unique" is
    // trivially true at n=2 and says nothing about the design system.
    const report = judgeDesignPolicy(input({
      samples: [sample("button", "a"), sample("button", "b")],
    }));
    assert.deepEqual(report.findings, []);
    assert.equal(report.roles[0]!.instances, 2);
  });

  it("names the dominant style and the deviations, never a correct value", () => {
    const report = judgeDesignPolicy(input({
      samples: [
        ...Array.from({ length: 4 }, () => sample("button", "dom")),
        sample("button", "x", ".btn-ghost"),
        sample("button", "y", ".btn-link"),
        sample("button", "z", ".btn-icon"),
        sample("button", "w", ".btn-tiny"),
      ],
    }));
    const message = report.findings.find((f) => f.kind === "component-drift")!.message;
    assert.match(message, /Dominant style, used 4x/);
    assert.match(message, /\.btn-ghost/);
    assert.match(message, /and 1 more\./);
    assert.match(message, /reports inconsistency, not which style is correct/);
  });

  it("keeps roles independent", () => {
    const report = judgeDesignPolicy(input({
      samples: [
        ...Array.from({ length: 5 }, () => sample("h2", "h")),
        sample("button", "a"), sample("button", "b"), sample("button", "c"),
      ],
    }));
    const roles = report.findings.filter((f) => f.kind === "component-drift").map((f) => f.role);
    assert.deepEqual(roles, ["button"]);
  });

  it("honours thresholds passed by the caller", () => {
    const samples = [
      ...Array.from({ length: 4 }, () => sample("button", "a")),
      ...Array.from({ length: 2 }, () => sample("button", "b")),
    ];
    assert.equal(judgeDesignPolicy(input({ samples })).verdict, "coherent"); // reuse 3.0
    assert.equal(judgeDesignPolicy(input({ samples }), { minReuse: 4 }).verdict, "drift");
  });
});

describe("judgeDesignPolicy — scale outliers", () => {
  const established = [...spacing(16, 12), ...spacing(24, 9), ...spacing(32, 7)];

  it("reports a one-off value next to an established neighbour", () => {
    const report = judgeDesignPolicy(input({ spacing: [...established, ...spacing(23, 1)] }));
    const outlier = report.findings.find((f) => f.kind === "scale-outlier");
    assert.ok(outlier, "expected a scale-outlier finding");
    assert.match(outlier.message, /23px \(1x\) next to 24px \(9x\)/);
  });

  it("does not let a spacing straggler decide the verdict", () => {
    // Measured on MDN: one authored 43px padding against twelve 40px ones.
    // True, worth printing, and not evidence that the page is incoherent —
    // the study found spacing concentration overlaps between designed and
    // generated pages, so it cannot carry a verdict alone.
    const report = judgeDesignPolicy(input({ spacing: [...established, ...spacing(23, 1)] }));
    assert.equal(report.findings.find((f) => f.kind === "scale-outlier")!.severity, "info");
    assert.equal(report.verdict, "coherent");
  });

  it("ignores sub-pixel neighbours produced by rem arithmetic", () => {
    // web.dev tripped the first implementation with "21.4px, nearest common
    // 21.3px" — two rem-derived values, zero design content.
    const report = judgeDesignPolicy(input({
      spacing: [...spacing(21.3, 9), ...spacing(16, 12), ...spacing(32, 7), ...spacing(21.4, 2)],
    }));
    assert.equal(report.findings.filter((f) => f.kind === "scale-outlier").length, 0);
  });

  it("ignores values below the spacing-scale floor", () => {
    // MDN's only outlier rows were 2/2.5/5/6px paddings on inline <code>.
    const report = judgeDesignPolicy(input({
      spacing: [...spacing(4, 20), ...spacing(8, 12), ...spacing(16, 9), ...spacing(5, 2), ...spacing(6, 2)],
    }));
    assert.equal(report.findings.filter((f) => f.kind === "scale-outlier").length, 0);
  });

  it("treats a distant value as a separate scale step, not drift", () => {
    // 48 next to 32 is a second step; 33 next to 32 is drift.
    const far = judgeDesignPolicy(input({ spacing: [...established, ...spacing(48, 1)] }));
    assert.equal(far.findings.filter((f) => f.kind === "scale-outlier").length, 0);
    const near = judgeDesignPolicy(input({ spacing: [...established, ...spacing(33, 1)] }));
    assert.equal(near.findings.filter((f) => f.kind === "scale-outlier").length, 1);
  });

  it("scales the window with the value so large steps stay reportable", () => {
    const report = judgeDesignPolicy(input({
      spacing: [...spacing(64, 10), ...spacing(16, 9), ...spacing(24, 8), ...spacing(60, 1)],
    }));
    assert.match(report.findings.find((f) => f.kind === "scale-outlier")!.message, /60px \(1x\) next to 64px/);
  });

  it("requires the reference to be genuinely established", () => {
    // 2 uses vs 3 uses is not a majority worth snapping to.
    const report = judgeDesignPolicy(input({
      spacing: [...spacing(16, 3), ...spacing(24, 3), ...spacing(32, 3), ...spacing(23, 2)],
    }));
    assert.equal(report.findings.filter((f) => f.kind === "scale-outlier").length, 0);
  });

  it("stays quiet when the page has no vocabulary to deviate from", () => {
    const report = judgeDesignPolicy(input({ spacing: [...spacing(16, 12), ...spacing(23, 1)] }));
    assert.equal(report.findings.length, 0);
    assert.equal(report.spacingValues, 2);
  });
});

describe("judgeDesignPolicy — text-free elements", () => {
  // Issue #112: a vendor widget restyled its icon controls to match the app's
  // padding/radius/border/background exactly and the verdict stayed DRIFT,
  // because those buttons paint no text and inherit 12px/400 where the app's
  // buttons are 14px/600. No styling change converges them.
  const twoAppStyles = [
    styled("button", "boxA", "14|600"), styled("button", "boxA", "14|600"), styled("button", "boxA", "14|600"),
    styled("button", "boxB", "14|400"), styled("button", "boxB", "14|400"), styled("button", "boxB", "14|400"),
  ];

  it("folds an icon-only element into the established style its box matches", () => {
    const report = judgeDesignPolicy(input({
      samples: [
        ...twoAppStyles,
        styled("button", "boxA", "12|400", { textFree: true, selector: ".vendor .zoom-in" }),
        styled("button", "boxA", "12|400", { textFree: true, selector: ".vendor .zoom-out" }),
      ],
    }));
    const role = report.roles.find((r) => r.role === "button")!;
    assert.equal(role.instances, 8);
    assert.equal(role.signatures, 2, "the icon buttons must not add a third style");
    assert.equal(report.verdict, "coherent");
    assert.equal(report.textFreeFolded, 2);
    assert.equal(report.textFreeSamples, 2);
  });

  it("still counts an icon-only element whose box matches nothing", () => {
    // The fold forgives an unobservable font, never an unobservable box: a
    // 2px-padding vendor control against the app's 8/16 IS visible drift.
    const report = judgeDesignPolicy(input({
      samples: [
        ...twoAppStyles,
        styled("button", "boxVendor", "12|400", { textFree: true }),
        styled("button", "boxVendor", "12|400", { textFree: true }),
      ],
    }));
    assert.equal(report.roles.find((r) => r.role === "button")!.signatures, 3);
    assert.equal(report.textFreeFolded, 0);
    assert.equal(report.textFreeSamples, 2);
    assert.equal(report.verdict, "drift");
  });

  it("keeps font comparison for elements that DO paint text", () => {
    // The over-reach guard: same boxes, deviant fonts, text present. Folding
    // these would delete the signal the metric exists for.
    const report = judgeDesignPolicy(input({
      samples: [
        ...twoAppStyles,
        styled("button", "boxA", "10|300"), styled("button", "boxA", "9|200"),
      ],
    }));
    assert.equal(report.roles.find((r) => r.role === "button")!.signatures, 4);
    assert.equal(report.textFreeFolded, 0);
    assert.equal(report.verdict, "drift");
  });

  it("groups icon-only elements with each other by box when no text style hosts them", () => {
    const report = judgeDesignPolicy(input({
      samples: [
        styled("button", "boxIcon", "12|400", { textFree: true, selector: ".a" }),
        styled("button", "boxIcon", "16|700", { textFree: true, selector: ".b" }),
        styled("button", "boxIcon", "20|100", { textFree: true, selector: ".c" }),
      ],
    }));
    assert.equal(report.roles.find((r) => r.role === "button")!.signatures, 1);
    assert.equal(report.verdict, "coherent");
  });
});

describe("judgeDesignPolicy — coverage reporting", () => {
  it("carries skip counts through so coverage gaps are never silent", () => {
    const report = judgeDesignPolicy(input({ skipped: 1490, statefulSkipped: 4 }));
    assert.equal(report.skipped, 1490);
    assert.equal(report.statefulSkipped, 4);
  });
});

describe("design sample collector", () => {
  it("keeps the exported default script executable and safely injects exclusions", () => {
    assert.doesNotThrow(() => new Function(`return ${COLLECT_DESIGN_SAMPLES}`));
    const script = buildDesignSampleScript([`.vendor[data-owner="third-party"]`]);
    assert.doesNotThrow(() => new Function(`return ${script}`));
    assert.match(script, /third-party/);
  });
});

describe("formatDesignReport", () => {
  it("separates verdict-carrying findings from informational ones", () => {
    const judged = judgeDesignPolicy(input({
      samples: [sample("button", "a"), sample("button", "b"), sample("button", "c")],
      spacing: [...spacing(16, 12), ...spacing(24, 9), ...spacing(32, 7), ...spacing(23, 1)],
    }));
    const text = formatDesignReport({ source: "fixture.html", ...judged });
    assert.match(text, /DRIFT/);
    assert.match(text, /Findings/);
    assert.match(text, /Informational/);
    assert.match(text, /does not carry the verdict/);
    assert.ok(text.indexOf("component-drift") < text.indexOf("Informational"));
  });

  it("says so plainly when nothing drifted", () => {
    const judged = judgeDesignPolicy(input({ samples: Array.from({ length: 5 }, () => sample("button", "a")) }));
    const text = formatDesignReport({ source: "fixture.html", ...judged });
    assert.match(text, /COHERENT/);
    assert.match(text, /No design drift detected/);
  });

  it("keeps stale subtree exclusions visible", () => {
    const judged = judgeDesignPolicy(input({
      exclusions: [{ selector: ".removed-widget", matches: 0, elements: 0 }],
    }));
    assert.deepEqual(judged.unusedExcludes, [".removed-widget"]);
    const text = formatDesignReport({ source: "fixture.html", ...judged });
    assert.match(text, /\.removed-widget: 0 root match/);
    assert.match(text, /removed nothing/);
    // Integrity's nudge, verbatim in spirit: dead config gets deleted, not kept.
    assert.match(text, /widens the blind spot/);
  });

  it("reports how many elements each --exclude removed, next to the verdict", () => {
    const judged = judgeDesignPolicy(input({
      samples: Array.from({ length: 5 }, () => sample("button", "a")),
      exclusions: [
        { selector: ".maplibregl-ctrl", matches: 2, elements: 11 },
        { selector: ".chartjs-tooltip", matches: 1, elements: 3 },
      ],
      excludedElements: 14,
    }));
    assert.deepEqual(judged.unusedExcludes, []);
    const text = formatDesignReport({ source: "fixture.html", ...judged });
    // Mirrors `check integrity`'s `(2 fail, 1 warn, 5 exempted)`: the size of
    // the blind spot belongs on the verdict line, not in a footer.
    assert.match(text, /verdict:.*14 element\(s\) excluded/);
    assert.match(text, /\.maplibregl-ctrl: 2 root match\(es\), 11 element\(s\) removed/);
    assert.match(text, /\.chartjs-tooltip: 1 root match\(es\), 3 element\(s\) removed/);
  });

  it("says a text-free element was judged on its box alone", () => {
    const judged = judgeDesignPolicy(input({
      samples: [
        styled("button", "boxA", "14|600"), styled("button", "boxA", "14|600"), styled("button", "boxA", "14|600"),
        styled("button", "boxA", "12|400", { textFree: true }),
      ],
    }));
    const text = formatDesignReport({ source: "fixture.html", ...judged });
    assert.match(text, /text-free: 1 \(1 judged on box alone/);
    assert.match(text, /not observable without painted text/);
  });
});

const DIR = mkdtempSync(join(tmpdir(), "design-policy-"));

const page = (name: string, body: string, css = ""): string => {
  const file = join(DIR, `${name}.html`);
  writeFileSync(file, `<!doctype html><meta charset="utf-8"><title>${name}</title>
<style>body { margin: 0; font: 16px/1.5 sans-serif; }
button { padding: 12px 20px; border-radius: 8px; font-size: 14px; border: 1px solid #333; background: #fff; }
${css}</style>
${body}`);
  return file;
};

describe("runDesignPolicyCheck (browser collection)", () => {
  it("reports drift when buttons are styled three ways", async () => {
    const file = page(
      "drift",
      `<main>${Array.from({ length: 3 }, (_, i) => `<button class="a${i}">Buy</button>`).join("")}
       <button class="ghost">Ghost</button><button class="link">Link</button><button class="tiny">Tiny</button></main>`,
      `.ghost { padding: 10px 18px; border-radius: 6px; }
       .link { padding: 14px 22px; border-radius: 0; }
       .tiny { padding: 8px 12px; font-size: 12px; }`,
    );
    const report = await runDesignPolicyCheck({ source: file });
    const drift = report.findings.find((f) => f.kind === "component-drift");
    assert.ok(drift, `expected component-drift, got ${JSON.stringify(report.findings)}`);
    assert.equal(drift.role, "button");
    assert.equal(report.verdict, "drift");
    assert.match(drift.message, /6 "button" elements render 4 distinct styles/);
  });

  it("passes a page that reuses one button style", async () => {
    const file = page("uniform", `<main>${Array.from({ length: 6 }, () => "<button>Buy</button>").join("")}</main>`);
    const report = await runDesignPolicyCheck({ source: file });
    assert.deepEqual(report.findings, []);
    assert.equal(report.verdict, "coherent");
    assert.equal(report.roles.find((r) => r.role === "button")!.reuse, 6);
  });

  it("excludes non-resting states instead of counting them as drift", async () => {
    // A disabled or pressed button legitimately looks different. Without this
    // exclusion the S19 fixture read as 6 signatures where 3 were real.
    const file = page(
      "states",
      `<main>${Array.from({ length: 4 }, () => "<button>Buy</button>").join("")}
       <button disabled>Sold out</button><button aria-pressed="true">Pinned</button></main>`,
      `button:disabled { padding: 2px 4px; border-radius: 0; background: #eee; }
       button[aria-pressed="true"] { padding: 30px 40px; border-radius: 99px; background: #000; }`,
    );
    const report = await runDesignPolicyCheck({ source: file });
    assert.equal(report.statefulSkipped, 2);
    assert.equal(report.roles.find((r) => r.role === "button")!.instances, 4);
    assert.equal(report.verdict, "coherent");
  });

  it("keeps input, select and textarea as separate roles", async () => {
    // Grouping them as one "field" role produced a false drift signal in the
    // study: the browser styles them differently by design.
    const file = page(
      "fields",
      `<form>${Array.from({ length: 3 }, () => '<input type="text" value="x">').join("")}
       ${Array.from({ length: 3 }, () => "<select><option>a</option></select>").join("")}
       ${Array.from({ length: 3 }, () => "<textarea>y</textarea>").join("")}</form>`,
    );
    const report = await runDesignPolicyCheck({ source: file });
    const roles = report.roles.map((r) => r.role).sort();
    assert.deepEqual(roles, ["input:text", "select", "textarea"]);
    assert.equal(report.verdict, "coherent");
  });

  it("counts elements it could not classify rather than hiding them", async () => {
    const file = page("skips", `<main><div><span>a</span><p>b</p></div><button>Go</button></main>`);
    const report = await runDesignPolicyCheck({ source: file });
    assert.ok(report.skipped >= 3, `expected skipped >= 3, got ${report.skipped}`);
  });

  it("excludes a vendor-owned subtree before computing role reuse", async () => {
    const file = page(
      "vendor-subtree",
      `<main>${Array.from({ length: 4 }, () => '<button class="app">App</button>').join("")}
       <div class="vendor-map">
         <button class="zoom-in">+</button><button class="zoom-out">-</button><button class="locate">@</button>
       </div></main>`,
      `.vendor-map .zoom-in { padding: 2px; border-radius: 0; font-size: 10px; }
       .vendor-map .zoom-out { padding: 3px; border-radius: 2px; font-size: 11px; }
       .vendor-map .locate { padding: 4px; border-radius: 4px; font-size: 12px; }`,
    );

    const unscoped = await runDesignPolicyCheck({ source: file });
    assert.equal(unscoped.verdict, "drift");

    const scoped = await runDesignPolicyCheck({ source: file, exclude: [".vendor-map"] });
    assert.equal(scoped.verdict, "coherent");
    assert.deepEqual(scoped.exclusions, [{ selector: ".vendor-map", matches: 1, elements: 4 }]);
    assert.equal(scoped.excludedElements, 4);
    assert.deepEqual(scoped.unusedExcludes, []);
  });

  it("attributes each excluded element to exactly one selector when subtrees overlap", async () => {
    // Per-selector counts have to sum to the total, or "12 elements excluded"
    // and the rows under it disagree and neither can be trusted.
    const file = page(
      "overlapping-exclusions",
      `<main><button>App</button>
       <div class="widget"><div class="widget-inner"><button>a</button><button>b</button></div></div></main>`,
    );
    const report = await runDesignPolicyCheck({
      source: file,
      exclude: [".widget", ".widget-inner"],
    });
    assert.equal(report.exclusions[0]!.elements + report.exclusions[1]!.elements, report.excludedElements);
    // `.widget` is listed first, so it owns the whole subtree and the narrower
    // selector is left with nothing — which is exactly what gets reported.
    assert.deepEqual(report.unusedExcludes, [".widget-inner"]);
  });
});

describe("runDesignPolicyCheck — font properties on text-free elements", () => {
  /** The app's own system: `boxApp` at 14px/600, plus a second reused style. */
  const APP_CSS = `button { padding: 8px 16px; border-radius: 6px; border: 1px solid #333;
                            background: #fff; font-size: 14px; font-weight: 600; }
                   .secondary { padding: 6px 12px; border-radius: 4px; font-weight: 400; }`;

  it("no longer counts an unobservable inherited font as a distinct style", async () => {
    // Issue #112 reproduction. The vendor matched every visible property and
    // only the inherited 12px/400 differed; the buttons paint nothing but an
    // SVG icon, so there is no styling change that converges them.
    const file = page(
      "icon-only-vendor",
      `<main><button>Save</button><button>Cancel</button><button>Publish</button>
       <button class="secondary">Back</button><button class="secondary">Skip</button>
       <button class="secondary">More</button>
       <div class="vendor-ctrl">
         <button><svg viewBox="0 0 10 10"><title>Zoom in</title><rect width="10" height="10"/></svg></button>
         <button><svg viewBox="0 0 10 10"><title>Zoom out</title><rect width="10" height="10"/></svg></button>
       </div></main>`,
      `${APP_CSS}
       .vendor-ctrl button { padding: 8px 16px; border-radius: 6px; border: 1px solid #333;
                             background: #fff; font-size: 12px; font-weight: 400; }
       .vendor-ctrl svg { width: 14px; height: 14px; display: block; }`,
    );
    const report = await runDesignPolicyCheck({ source: file });
    const role = report.roles.find((r) => r.role === "button")!;
    assert.equal(role.instances, 8);
    assert.equal(role.signatures, 2, `expected 2 styles, got ${role.signatures}`);
    assert.equal(report.textFreeSamples, 2);
    assert.equal(report.textFreeFolded, 2);
    assert.equal(report.verdict, "coherent");
  });

  it("keeps judging the font of an input, whose text is its `value`", async () => {
    // The trap: `input[type=button]` paints its `value` and a text input paints
    // its value/placeholder, yet textContent is "" for both. Reading textContent
    // alone would drop font from exactly the elements whose whole box is text.
    const file = page(
      "input-value-text",
      `<main><button>Save</button><button>Cancel</button><button>Publish</button>
       <input type="button" class="tiny" value="Go">
       <input type="button" class="tiny" value="Stop"></main>`,
      `${APP_CSS}
       .tiny { padding: 8px 16px; border-radius: 6px; border: 1px solid #333;
               background: #fff; font-size: 9px; font-weight: 200; }`,
    );
    const report = await runDesignPolicyCheck({ source: file });
    const role = report.roles.find((r) => r.role === "button")!;
    assert.equal(role.instances, 5);
    assert.equal(role.signatures, 2, "a 9px input value is visible drift, not an unobservable font");
    assert.equal(report.textFreeSamples, 0);
  });

  it("keeps judging the font behind an icon-font glyph in ::before", async () => {
    // A `content: "\\f00c"` glyph is painted text that scales with font-size,
    // so an element with no child text still has an observable font.
    const file = page(
      "icon-font-pseudo",
      `<main><button>Save</button><button>Cancel</button><button>Publish</button>
       <button class="glyph"></button><button class="glyph"></button></main>`,
      `${APP_CSS}
       .glyph { padding: 8px 16px; border-radius: 6px; border: 1px solid #333;
                background: #fff; font-size: 28px; font-weight: 400; }
       .glyph::before { content: "\\2713"; }`,
    );
    const report = await runDesignPolicyCheck({ source: file });
    const role = report.roles.find((r) => r.role === "button")!;
    assert.equal(role.instances, 5);
    assert.equal(role.signatures, 2, "a 28px icon-font glyph is observable");
    assert.equal(report.textFreeSamples, 0);
  });

  it("still reports drift when an icon-only control's box does not match", async () => {
    const file = page(
      "icon-only-box-drift",
      `<main><button>Save</button><button>Cancel</button><button>Publish</button>
       <div class="vendor-ctrl">
         <button><svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg></button>
         <button><svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg></button>
       </div></main>`,
      `${APP_CSS}
       .vendor-ctrl button { padding: 2px; border-radius: 0; }
       .vendor-ctrl svg { width: 14px; height: 14px; display: block; }`,
    );
    const report = await runDesignPolicyCheck({ source: file, minReuse: 3 });
    const role = report.roles.find((r) => r.role === "button")!;
    assert.equal(role.signatures, 2);
    assert.equal(report.textFreeFolded, 0);
    assert.equal(report.verdict, "drift");
  });
});
