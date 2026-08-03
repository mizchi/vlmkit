import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type DesignPolicyInput,
  type DesignSample,
  type DesignSpacingSample,
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

const spacing = (value: number, uses: number, property = "paddingTop"): DesignSpacingSample[] =>
  Array.from({ length: uses }, (_, i) => ({ selector: `.s${value}-${i}`, property, value }));

const input = (over: Partial<DesignPolicyInput> = {}): DesignPolicyInput => ({
  samples: [],
  spacing: [],
  skipped: 0,
  statefulSkipped: 0,
  ...over,
});

describe("judgeDesignPolicy — component drift", () => {
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

describe("judgeDesignPolicy — coverage reporting", () => {
  it("carries skip counts through so coverage gaps are never silent", () => {
    const report = judgeDesignPolicy(input({ skipped: 1490, statefulSkipped: 4 }));
    assert.equal(report.skipped, 1490);
    assert.equal(report.statefulSkipped, 4);
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
});
