import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ruleViewFrom } from "@mizchi/vlmkit-core/plugin/rule-tier.ts";
import {
  type GroundingScanInput,
  type GroundingTargetSample,
  analyzeGroundingSamples,
  drawActionMarks,
  findDisambiguator,
  formatGroundingReport,
  resolveAgentFrame,
  runGroundingScan,
} from "./grounding-scan.ts";

function target(overrides: Partial<GroundingTargetSample> = {}): GroundingTargetSample {
  return {
    selector: "button.primary",
    tag: "button",
    role: "button",
    name: "Sign up",
    visibleText: "Sign up",
    hasGlyph: true,
    bbox: { x: 100, y: 200, width: 120, height: 40 },
    clickPoint: { x: 160, y: 220 },
    hitFraction: 1,
    centreHit: true,
    disabled: false,
    inFrame: true,
    clipped: false,
    ancestorTexts: [],
    ...overrides,
  };
}

function input(overrides: Partial<GroundingScanInput> = {}): GroundingScanInput {
  return {
    source: "fixture.html",
    page: { viewportWidth: 1280, viewportHeight: 720, capped: 0 },
    targets: [],
    ...overrides,
  };
}

/** `full` keeps scale at 1, so a case about anything else is not also a case about the downscale. */
const UNSCALED = { resolution: "full" as const };

test("a clean target becomes one action-map row with no risks", () => {
  const report = analyzeGroundingSamples(input({ targets: [target()] }), UNSCALED);
  assert.equal(report.issues.length, 0);
  assert.deepEqual(report.targets.map((t) => t.id), ["t1"]);
  const row = report.targets[0]!;
  assert.deepEqual(row.point, { x: 160, y: 220 });
  assert.deepEqual(row.cssPoint, { x: 160, y: 220 });
  assert.equal(row.label, "Sign up");
  assert.deepEqual(row.risks, []);
});

test("the click point is denominated in screenshot px, not CSS px", () => {
  const report = analyzeGroundingSamples(
    input({ targets: [target()] }),
    { resolution: { maxWidth: 640, maxHeight: 480 } },
  );
  // 640/1280 = 0.5 horizontally, 480/720 = 0.667 vertically — the smaller wins,
  // because the whole frame has to fit.
  assert.equal(report.frame.scale, 0.5);
  assert.deepEqual(report.targets[0]!.point, { x: 80, y: 110 });
  assert.deepEqual(report.targets[0]!.cssPoint, { x: 160, y: 220 });
});

test("a preset larger than the viewport does not scale coordinates up", () => {
  const frame = resolveAgentFrame({ width: 375, height: 667 }, "high");
  assert.equal(frame.scale, 1);
  assert.equal(frame.width, 375);
});

test("no resolution flag reproduces the choice image-resize makes for the viewport", () => {
  // `resolveResolutionForViewport(1280)` picks `medium` (640x480) — the
  // smallest preset at least half the viewport width — so the default is the
  // downscale this toolkit's own VLM path applies, not a cap invented here.
  // The frame is 640x360, not 640x480: the horizontal ratio is the smaller of
  // the two and the aspect is preserved, exactly as `resizePngBuffer` does it.
  const frame = resolveAgentFrame({ width: 1280, height: 720 });
  assert.equal(frame.scale, 0.5);
  assert.deepEqual([frame.width, frame.height], [640, 360]);
  assert.match(frame.resolution, /^medium/);
});

test("a click point that routes elsewhere is a suspect naming the interceptor", () => {
  const report = analyzeGroundingSamples(
    input({
      targets: [target({ centreHit: false, interceptedBy: "div.cookie-banner", hitFraction: 0 })],
    }),
    UNSCALED,
  );
  const issue = report.issues.find((i) => i.kind === "occluded-target");
  assert.ok(issue, "expected occluded-target");
  assert.equal(issue!.severity, "suspect");
  assert.match(issue!.message, /div\.cookie-banner/);
  assert.match(issue!.message, /no point inside the box routes here/);
  assert.deepEqual(report.targets[0]!.risks, ["occluded-target"]);
});

test("a reachable point moves the map's coordinate and the message names both", () => {
  // v1's whole finding: the map handed out the covered centre, the smaller model
  // emitted it, and the click activated the interceptor. The row now aims at the
  // point that reaches the target, and still reports the page as defective.
  const report = analyzeGroundingSamples(
    input({
      targets: [target({
        centreHit: false,
        interceptedBy: "div.promo",
        hitFraction: 0,
        reachable: { x: 205, y: 220, room: 8, sampled: 400, clear: 44 },
      })],
    }),
    UNSCALED,
  );
  const row = report.targets[0]!;
  assert.deepEqual(row.point, { x: 205, y: 220 }, "the map aims where the click lands");
  assert.deepEqual(row.aimedOffCentre, { reason: "occluded", centre: { x: 160, y: 220 }, room: 8 });
  const issue = report.issues.find((i) => i.kind === "occluded-target")!;
  assert.equal(issue.severity, "suspect", "a covered centre is still a defect");
  assert.match(issue.message, /covered at its own centre \(160,220\)/);
  assert.match(issue.message, /aims at \(205,220\) instead, which does reach it, with 8px of room/);
});

test("a target with no reachable point says so, and says what has to move", () => {
  const report = analyzeGroundingSamples(
    input({ targets: [target({ centreHit: false, interceptedBy: "div.veil", hitFraction: 0 })] }),
    UNSCALED,
  );
  const issue = report.issues.find((i) => i.kind === "occluded-target")!;
  assert.match(issue.message, /no point inside the box routes here, so nothing can click it until div\.veil moves/);
  assert.equal(report.targets[0]!.aimedOffCentre, undefined);
});

test("the reachable point is scaled with everything else", () => {
  const report = analyzeGroundingSamples(
    input({
      targets: [target({
        centreHit: false,
        interceptedBy: "div.promo",
        reachable: { x: 205, y: 220, room: 8, sampled: 400, clear: 44 },
      })],
    }),
    { resolution: { maxWidth: 640, maxHeight: 480 } },
  );
  assert.deepEqual(report.targets[0]!.point, { x: 103, y: 110 });
  assert.deepEqual(report.targets[0]!.cssPoint, { x: 205, y: 220 });
  assert.equal(report.targets[0]!.aimedOffCentre!.room, 4);
});

test("a clipped target declares its recentred point and its aim budget", () => {
  // v1's follow-up run: "the click point is silently recentred into the visible
  // sliver, but only the occlusion case gets an explicit `aimedOffCentre` field
  // — clipping gets no equivalent margin number, just prose."
  const report = analyzeGroundingSamples(
    input({
      targets: [target({
        bbox: { x: 100, y: 700, width: 120, height: 40 },
        clickPoint: { x: 160, y: 710 },
        clipped: true,
      })],
    }),
    UNSCALED,
  );
  const moved = report.targets[0]!.aimedOffCentre!;
  assert.equal(moved.reason, "clipped");
  assert.deepEqual(moved.centre, { x: 160, y: 720 }, "the element's own centre, which is off the frame");
  assert.equal(moved.room, 10, "how far the point can be wrong before it leaves the visible part");
});

test("an ordinary target is not labelled clipped by a rounding disagreement", () => {
  // The first version compared the two centres, which are rounded from different
  // quantities, and reported three nav links and a table button as `clipped`
  // with 7px of room. The condition is a cut box, not a ±1 difference.
  const report = analyzeGroundingSamples(
    input({
      targets: [target({
        bbox: { x: 107, y: 7, width: 31, height: 14 },
        clickPoint: { x: 122, y: 14 },
      })],
    }),
    UNSCALED,
  );
  assert.equal(report.targets[0]!.aimedOffCentre, undefined);
});

test("a cut target's message says the gate never scrolls", () => {
  // 5 of its 40 px are inside the frame, so it is under the precision floor and
  // the fold is why — which is exactly when the advice to scroll applies.
  const report = analyzeGroundingSamples(
    input({
      targets: [target({
        bbox: { x: 100, y: 715, width: 120, height: 40 },
        clickPoint: { x: 160, y: 717 },
        clipped: true,
      })],
    }),
    UNSCALED,
  );
  // "doesn't clarify whether scrolling occurred during measurement or if the
  // screenshot is pre-scrolled" — it did not, and now it says so.
  assert.match(
    report.issues.find((i) => i.kind === "imprecise-target")!.message,
    /measures the initial frame and never scrolls, so scroll it into view and re-run/,
  );
});

test("a target hidden by a scroll container is out of the frame, not occluded", () => {
  // v3's finding, unanimous across three agents: the gate called seven list rows
  // `occluded-target` "by html" and advised moving html. They were scrolled out
  // of a 218px scrollport. The hit test's answer is meaningless there, so the
  // row is not a finding at all — it is inventory with a scroll attached.
  const report = analyzeGroundingSamples(
    input({
      targets: [target({
        selector: "#list > button:nth-of-type(9)",
        inFrame: false,
        centreHit: false,
        interceptedBy: "html",
        clippedBy: { selector: "#list", scrollable: true, dy: 332, dx: 0 },
      })],
    }),
    UNSCALED,
  );
  assert.deepEqual(report.issues, [], "nothing here is a defect of the page");
  assert.deepEqual(report.targets[0]!.clippedBy, { selector: "#list", scrollable: true, dy: 332, dx: 0 });
});

test("the scroll a caller needs is in screenshot px, like every other number", () => {
  const report = analyzeGroundingSamples(
    input({
      targets: [target({
        inFrame: false,
        clippedBy: { selector: "#list", scrollable: true, dy: 332, dx: -12 },
      })],
    }),
    { resolution: { maxWidth: 640, maxHeight: 480 } },
  );
  assert.deepEqual(report.targets[0]!.clippedBy, { selector: "#list", scrollable: true, dy: 166, dx: -6 });
});

test("the prose names the container, the count and the nearest scroll", () => {
  // The control arm, with no tool at all, wrote the spec for this block: "A
  // DOM-aware tool would have told me directly '12 tickets, scrolled to 4/12'
  // instead of me inferring clipping from pixels."
  const hidden = (n: number, dy: number) => target({
    selector: `#list > button:nth-of-type(${n})`,
    visibleText: `Row ${n}`,
    inFrame: false,
    clippedBy: { selector: "#list", scrollable: true, dy, dx: 0 },
  });
  const text = formatGroundingReport(
    analyzeGroundingSamples(input({ targets: [hidden(5, 44), hidden(6, 74), hidden(7, 105)] }), UNSCALED),
  );
  assert.match(text, /Out of the frame \(3\) — scroll first, then re-run/);
  assert.match(text, /#list: hides 3 target\(s\) — scroll it \(nearest needs 44px\)/);
  assert.match(text, /t1 button "Row 5" \(dy 44px\)/);
});

test("a container that cannot scroll says the content is unreachable", () => {
  const text = formatGroundingReport(
    analyzeGroundingSamples(
      input({
        targets: [target({
          inFrame: false,
          clippedBy: { selector: "#locked", scrollable: false, dy: 35, dx: 0 },
        })],
      }),
      UNSCALED,
    ),
  );
  assert.match(text, /#locked: hides 1 target\(s\) — it does not scroll/);
});

test("findings quote the frame, not the preset's cap", () => {
  // v1's agent: "every message says 'at medium (640x480)' though the actual
  // frame is 640x360 … that parenthetical never matches the real frame size, in
  // every single finding line."
  const report = analyzeGroundingSamples(
    input({ targets: [target({ bbox: { x: 10, y: 10, width: 6, height: 6 }, clickPoint: { x: 13, y: 13 } })] }),
    { resolution: "medium" },
  );
  const issue = report.issues.find((i) => i.kind === "imprecise-target")!;
  assert.match(issue.message, /in the 640x360 frame/);
  assert.doesNotMatch(issue.message, /640x480/);
  assert.match(report.frame.resolution, /^medium, cap 640x480$/);
});

test("a label that forwards the click to its own control is not occlusion", () => {
  // The checkbox-inside-its-own-label pattern: elementFromPoint returns the
  // label, the click still reaches the checkbox, and reporting it would have
  // flagged every form on every page.
  const report = analyzeGroundingSamples(
    input({
      targets: [target({
        selector: "input#terms",
        role: "checkbox",
        centreHit: false,
        interceptedBy: "label.terms",
        forwardedByLabel: true,
      })],
    }),
    UNSCALED,
  );
  assert.deepEqual(report.issues.filter((i) => i.kind === "occluded-target"), []);
});

test("duplicate labels in one frame are reported once, with the text that separates them", () => {
  const rows = [
    target({
      selector: "tr:nth-of-type(1) button",
      visibleText: "Edit",
      name: "Edit",
      ancestorTexts: ["ACME Corp Edit", "Customers"],
    }),
    target({
      selector: "tr:nth-of-type(2) button",
      visibleText: "Edit",
      name: "Edit",
      bbox: { x: 100, y: 300, width: 120, height: 40 },
      clickPoint: { x: 160, y: 320 },
      ancestorTexts: ["Globex Edit", "Customers"],
    }),
  ];
  const report = analyzeGroundingSamples(input({ targets: rows }), UNSCALED);
  const ambiguous = report.issues.filter((i) => i.kind === "ambiguous-target");
  assert.equal(ambiguous.length, 1, "one finding per clashing group, not one per member");
  assert.match(ambiguous[0]!.message, /2 buttons in the frame all read "Edit"/);
  assert.match(ambiguous[0]!.message, /ACME Corp Edit \/ Globex Edit/);
  // Both members carry the risk, so a caller reading only the action map is warned.
  assert.ok(report.targets.every((t) => t.risks.includes("ambiguous-target")));
});

test("duplicates with nothing around them to tell them apart say so", () => {
  const rows = [
    target({ selector: "a:nth-of-type(1)", role: "link", visibleText: "More", name: "More", ancestorTexts: ["More More"] }),
    target({
      selector: "a:nth-of-type(2)",
      role: "link",
      visibleText: "More",
      name: "More",
      bbox: { x: 400, y: 200, width: 60, height: 20 },
      clickPoint: { x: 430, y: 210 },
      ancestorTexts: ["More More"],
    }),
  ];
  const report = analyzeGroundingSamples(input({ targets: rows }), UNSCALED);
  assert.match(report.issues[0]!.message, /nothing visible distinguishes them/);
});

test("different roles with the same label are not ambiguous", () => {
  const report = analyzeGroundingSamples(
    input({
      targets: [
        target({ role: "link", selector: "a.home", visibleText: "Home", name: "Home" }),
        target({
          role: "button",
          selector: "button.home",
          visibleText: "Home",
          name: "Home",
          bbox: { x: 600, y: 200, width: 120, height: 40 },
          clickPoint: { x: 660, y: 220 },
        }),
      ],
    }),
    UNSCALED,
  );
  assert.deepEqual(report.issues.filter((i) => i.kind === "ambiguous-target"), []);
});

test("a box that paints nothing is unlabeled; an icon-only button is not", () => {
  const blank = analyzeGroundingSamples(
    input({ targets: [target({ visibleText: "", name: "Close dialog", hasGlyph: false })] }),
    UNSCALED,
  );
  const issue = blank.issues.find((i) => i.kind === "unlabeled-target");
  assert.ok(issue);
  assert.match(issue!.message, /accessible name is "Close dialog", which is not on screen/);

  const icon = analyzeGroundingSamples(
    input({ targets: [target({ visibleText: "", name: "Close dialog", hasGlyph: true })] }),
    UNSCALED,
  );
  assert.deepEqual(icon.issues.filter((i) => i.kind === "unlabeled-target"), []);
});

test("the precision floor is measured after the downscale, not in CSS px", () => {
  // 24x24 CSS px passes WCAG 2.5.8 and `check a11y touch`. At a 640px cap it is
  // 12 screenshot px, and at a 375px cap it is 7 — the same element, resolvable
  // or not depending on what the model is actually shown.
  const small = () => target({ bbox: { x: 10, y: 10, width: 24, height: 24 }, clickPoint: { x: 22, y: 22 } });
  const wide = analyzeGroundingSamples(input({ targets: [small()] }), UNSCALED);
  assert.deepEqual(wide.issues.filter((i) => i.kind === "imprecise-target"), []);

  const narrow = analyzeGroundingSamples(input({ targets: [small()] }), {
    resolution: { maxWidth: 375, maxHeight: 320 },
  });
  const issue = narrow.issues.find((i) => i.kind === "imprecise-target");
  assert.ok(issue, "24px at a 375px cap is 7 screenshot px");
  assert.match(issue!.message, /7x7 screenshot px/);
});

test("adjacent full-size buttons are not crowded; two tiny icons are", () => {
  // Click points half a button apart: an ordinary toolbar must not report.
  const toolbar = analyzeGroundingSamples(
    input({
      targets: [
        target({ selector: "button.a", bbox: { x: 0, y: 0, width: 120, height: 40 }, clickPoint: { x: 60, y: 20 } }),
        target({ selector: "button.b", bbox: { x: 120, y: 0, width: 120, height: 40 }, clickPoint: { x: 180, y: 20 }, visibleText: "Cancel", name: "Cancel" }),
      ],
    }),
    UNSCALED,
  );
  assert.deepEqual(toolbar.issues.filter((i) => i.kind === "crowded-target"), []);

  // 10px icons touching: the centre is 5px from the neighbour's box, under the
  // 6px default. They clear the precision floor (minSide 10) on purpose — the
  // two rules answer different questions about the same pair of elements.
  const icons = analyzeGroundingSamples(
    input({
      targets: [
        target({ selector: "button.edit", visibleText: "", name: "Edit", bbox: { x: 0, y: 0, width: 10, height: 10 }, clickPoint: { x: 5, y: 5 } }),
        target({ selector: "button.delete", visibleText: "", name: "Delete", bbox: { x: 10, y: 0, width: 10, height: 10 }, clickPoint: { x: 15, y: 5 } }),
      ],
    }),
    UNSCALED,
  );
  const crowded = icons.issues.filter((i) => i.kind === "crowded-target");
  assert.equal(crowded.length, 2);
  assert.match(crowded[0]!.message, /button\.delete \(button "Delete"\)/);
  assert.deepEqual(icons.issues.filter((i) => i.kind === "imprecise-target"), []);
});

test("a container enclosing the target is not a neighbour a miss lands on", () => {
  const report = analyzeGroundingSamples(
    input({
      targets: [
        target({ selector: "div.card", role: "generic", bbox: { x: 0, y: 0, width: 400, height: 200 }, clickPoint: { x: 200, y: 100 }, visibleText: "Card", name: "Card" }),
        target({ selector: "button.cta", bbox: { x: 190, y: 90, width: 20, height: 20 }, clickPoint: { x: 200, y: 100 } }),
      ],
    }),
    UNSCALED,
  );
  assert.deepEqual(report.issues.filter((i) => i.kind === "crowded-target"), []);
});

test("visible text and accessible name must name the same thing, containment allowed", () => {
  const mismatch = analyzeGroundingSamples(
    input({ targets: [target({ visibleText: "Send", name: "Submit application" })] }),
    UNSCALED,
  );
  assert.ok(mismatch.issues.some((i) => i.kind === "label-mismatch"));

  const contained = analyzeGroundingSamples(
    input({ targets: [target({ visibleText: "Save", name: "Save draft" })] }),
    UNSCALED,
  );
  assert.deepEqual(contained.issues.filter((i) => i.kind === "label-mismatch"), []);
});

test("disabled and below-the-fold targets stay in the map and out of the findings", () => {
  const report = analyzeGroundingSamples(
    input({
      targets: [
        target({ selector: "button.off", disabled: true, centreHit: false, interceptedBy: "div.veil" }),
        target({ selector: "button.below", inFrame: false, bbox: { x: 100, y: 1400, width: 8, height: 8 }, clickPoint: { x: 104, y: 1404 } }),
      ],
    }),
    UNSCALED,
  );
  assert.equal(report.targets.length, 2, "both stay in the action map");
  assert.deepEqual(report.issues, []);
});

test("a target clipped by the viewport is measured on the part that is visible", () => {
  // The click point is already the centre of the visible part (the collector
  // clamps it); `minSide` has to agree, or a half-visible banner reads as
  // resolvable at its full height.
  const report = analyzeGroundingSamples(
    input({
      targets: [target({
        bbox: { x: 100, y: -36, width: 120, height: 40 },
        clickPoint: { x: 160, y: 2 },
        clipped: true,
      })],
    }),
    UNSCALED,
  );
  assert.equal(report.targets[0]!.minSide, 4);
  assert.deepEqual(report.targets[0]!.visibleBox, { x: 100, y: 0, width: 120, height: 4 });
  const issue = report.issues.find((i) => i.kind === "imprecise-target");
  assert.ok(issue);
  // The number quoted is the one that tripped the rule. Printing the element's
  // own size here read as a contradiction — "is 34x18 screenshot px, under the
  // 10px floor" — on the first realistic page the gate was pointed at.
  assert.match(issue!.message, /shows 120x4 screenshot px/);
  assert.match(issue!.message, /the frame cuts it \(the element is 120x40\)/);
});

test("a target the frame contains quotes its own size and does not blame the frame", () => {
  const report = analyzeGroundingSamples(
    input({ targets: [target({ bbox: { x: 10, y: 10, width: 6, height: 6 }, clickPoint: { x: 13, y: 13 } })] }),
    UNSCALED,
  );
  const issue = report.issues.find((i) => i.kind === "imprecise-target")!;
  assert.match(issue.message, /shows 6x6 screenshot px/);
  assert.match(issue.message, /the whole element/);
  assert.doesNotMatch(issue.message, /frame cuts it/);
  assert.deepEqual(report.targets[0]!.visibleBox, report.targets[0]!.box);
});

test("findDisambiguator picks the nearest level that separates every member", () => {
  const rows = [
    target({ ancestorTexts: ["Row", "ACME Corp"] }),
    target({ ancestorTexts: ["Row", "Globex"] }),
  ];
  assert.deepEqual(findDisambiguator(rows), ["ACME Corp", "Globex"]);
  assert.equal(findDisambiguator([target({ ancestorTexts: ["Row"] }), target({ ancestorTexts: ["Row"] })]), undefined);
});

test("the prose reports the frame, the map and the truncation", () => {
  const report = analyzeGroundingSamples(
    input({
      page: { viewportWidth: 1280, viewportHeight: 720, capped: 4 },
      targets: [target()],
    }),
    { resolution: { maxWidth: 640, maxHeight: 480 } },
  );
  const text = formatGroundingReport(report);
  assert.match(text, /frame: 640x360 screenshot px/);
  assert.match(text, /scale 0\.50/);
  assert.match(text, /4 dropped by the cap/);
  assert.match(text, /t1 button "Sign up" @ \(80,110\)/);
});

test("a lone target in the frame has no aim margin rather than a null one", () => {
  const report = analyzeGroundingSamples(input({ targets: [target()] }), UNSCALED);
  assert.equal(report.targets[0]!.aimMargin, undefined);
  assert.equal(report.targets[0]!.nearest, undefined);
  // `Infinity` would come back out of --json as `null`, which reads like a
  // measurement that failed rather than one with nothing to measure against.
  assert.equal(JSON.parse(JSON.stringify(report.targets[0]!)).aimMargin, undefined);
});

test("the action map's risk tags honour rule settings, like the issue list does", () => {
  const report = analyzeGroundingSamples(
    input({
      targets: [target({
        bbox: { x: 10, y: 10, width: 6, height: 6 },
        clickPoint: { x: 13, y: 13 },
        visibleText: "Send",
        name: "Submit application",
      })],
    }),
    UNSCALED,
  );
  // The real view, not a hand-rolled one: `tierIssues` reads `setting`, the map
  // tags read `effective`, and a stub that answers only one of them tests the
  // formatter against a RuleView the runner never produces.
  const text = formatGroundingReport(report, ruleViewFrom({ "imprecise-target": "off" }));
  const mapRow = text.split("\n").find((line) => line.includes("button.primary"))!;
  assert.doesNotMatch(mapRow, /imprecise-target/, "a tag for a rule turned off is the noise the RuleView exists to remove");
  assert.match(mapRow, /\[label-mismatch\]/, "the surviving risk is still tagged");
  // …and the disclosure line still names it, so a turned-off rule is visible as
  // a decision rather than as an absence.
  assert.match(text, /rule turned off \(imprecise-target x1\)/);
});

test("marks are drawn at the click point's own resolution, red when the row carries a risk", () => {
  const report = analyzeGroundingSamples(
    input({
      targets: [
        target({ selector: "button.ok", bbox: { x: 10, y: 10, width: 40, height: 20 }, clickPoint: { x: 30, y: 20 } }),
        target({
          selector: "button.bad",
          visibleText: "Cancel",
          name: "Cancel",
          bbox: { x: 100, y: 10, width: 40, height: 20 },
          clickPoint: { x: 120, y: 20 },
          centreHit: false,
          interceptedBy: "div.veil",
        }),
      ],
    }),
    UNSCALED,
  );
  const canvas = { width: 200, height: 60, data: new Uint8Array(200 * 60 * 4) };
  drawActionMarks(canvas, report.targets);
  const pixel = (x: number, y: number) => {
    const i = (y * canvas.width + x) * 4;
    return [canvas.data[i], canvas.data[i + 1], canvas.data[i + 2]];
  };
  assert.deepEqual(pixel(30, 10), [0, 132, 255], "clean target outlined in the accent");
  assert.deepEqual(pixel(120, 10), [220, 38, 38], "risky target outlined in red");
  assert.deepEqual(pixel(0, 0), [0, 0, 0], "nothing drawn outside a box");
});

test("a target smaller than its own mark gets the mark above it, not over it", () => {
  // The 4x4 dismiss button on the fixture is the common case, and drawing the
  // chip inside it hid the element the mark exists to point at.
  const report = analyzeGroundingSamples(
    input({ targets: [target({ bbox: { x: 40, y: 30, width: 4, height: 4 }, clickPoint: { x: 42, y: 32 } })] }),
    UNSCALED,
  );
  const canvas = { width: 200, height: 60, data: new Uint8Array(200 * 60 * 4) };
  drawActionMarks(canvas, report.targets);
  const opaque = (x: number, y: number) => canvas.data[(y * canvas.width + x) * 4 + 3] === 255;
  assert.ok(opaque(41, 25), "chip sits above the box");
  assert.ok(opaque(40, 30), "the box outline is still drawn");
});

test("a mark on a target at the frame edge is pushed back in rather than clipped away", () => {
  const report = analyzeGroundingSamples(
    input({ targets: [target({ bbox: { x: 190, y: 50, width: 40, height: 20 }, clickPoint: { x: 210, y: 60 } })] }),
    UNSCALED,
  );
  const canvas = { width: 200, height: 60, data: new Uint8Array(200 * 60 * 4) };
  drawActionMarks(canvas, report.targets);
  const drawn = canvas.data.some((v, i) => i % 4 !== 3 && v !== 0);
  assert.ok(drawn, "the chip for an edge target is still visible");
});

/**
 * The pure cases above never execute `COLLECT_GROUNDING_SCRIPT`, and the whole
 * gate rests on it: role derivation, the accessible name, whether a box paints
 * anything, and above all the hit test. These two run it against a page.
 *
 * `agent-hostile.html` is written so each rule has exactly one cause, and the
 * assertions name the element rather than counting findings — a rule that moves
 * to the wrong element is the failure mode a count cannot see.
 */
const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const hostile = join(REPO_ROOT, "fixtures/grounding/agent-hostile.html");
const groundable = join(REPO_ROOT, "fixtures/grounding/groundable.html");

test("E2E: every rule fires on the hostile fixture, on the element that causes it", { timeout: 180_000 }, async () => {
  const report = await runGroundingScan({ source: hostile });
  const by = (kind: string) => report.issues.filter((i) => i.kind === kind);

  // The promo strip is over the CTA and takes its clicks. `#promo` has no role
  // and no handler, so nothing else on the page reports it.
  assert.deepEqual(by("occluded-target").map((i) => i.selector), ["#checkout"]);
  assert.match(by("occluded-target")[0]!.message, /goes to #promo/);

  // One finding for the group of three, with the row text that separates them.
  assert.equal(by("ambiguous-target").length, 1);
  assert.match(by("ambiguous-target")[0]!.message, /3 buttons in the frame all read "Edit"/);
  assert.match(by("ambiguous-target")[0]!.message, /ACME Corp.*Globex.*Initech/);

  // `a.ghost` is sized and focusable and paints nothing; the 8px dismiss button
  // has a border and a background, so it is small rather than invisible.
  assert.deepEqual(by("unlabeled-target").map((i) => i.selector), ["a.ghost"]);

  assert.deepEqual(
    by("imprecise-target").map((i) => i.selector).sort(),
    ["button.del", "button.dismiss", "button.edit"],
  );
  assert.ok(by("crowded-target").some((i) => /button\.edit.*button\.del/s.test(i.message)));
  assert.deepEqual(by("label-mismatch").map((i) => i.selector), ["#send"]);

  // And the action map is populated for every one of them, not just the findings.
  const map = report.targets.filter((t) => t.inFrame && !t.disabled);
  assert.equal(map.length, 9, map.map((t) => t.selector).join(", "));
  assert.ok(map.every((t) => Number.isFinite(t.point.x) && Number.isFinite(t.point.y)));
});

test("E2E: the groundable fixture reports nothing, and still yields a full map", { timeout: 180_000 }, async () => {
  const report = await runGroundingScan({ source: groundable });
  assert.deepEqual(report.issues, []);
  const map = report.targets.filter((t) => t.inFrame && !t.disabled);
  assert.equal(map.length, 6, map.map((t) => t.selector).join(", "));
  // The same six buttons that clear the floor here are 36 CSS px tall, which is
  // the point of the pair: passing is a property of the markup, not of the gate
  // being lenient.
  assert.ok(map.every((t) => t.minSide >= 10), map.map((t) => `${t.selector}=${t.minSide}`).join(", "));
});

test("E2E: a partly covered button gets a point that reaches it, found by sweeping", { timeout: 180_000 }, async () => {
  // The 3x3 hit test samples 25/50/75% and the veil covers all three, so the
  // sweep is the only thing between "unreachable" and the 48px that are clear.
  const report = await runGroundingScan({ source: join(REPO_ROOT, "fixtures/grounding/partly-covered.html") });
  const row = report.targets.find((t) => t.selector === "#cta")!;
  assert.ok(row.aimedOffCentre, "expected the map to aim off the covered centre");
  assert.ok(row.point.x > row.aimedOffCentre!.centre.x, "the clear part of this button is to the right");

  const probed = await runGroundingScan({
    source: join(REPO_ROOT, "fixtures/grounding/partly-covered.html"),
    at: [row.point, row.aimedOffCentre!.centre],
  });
  assert.equal(probed.probes![0]!.hit, "#cta", "the point the map hands out reaches the button");
  assert.equal(probed.probes![1]!.hit, "#veil", "the centre it moved away from does not");
});

test("E2E: --at answers in screenshot px and names the row it landed on", { timeout: 180_000 }, async () => {
  const report = await runGroundingScan({
    source: hostile,
    at: [{ x: 92, y: 58 }, { x: 10_000, y: 5 }],
  });
  assert.equal(report.probes!.length, 2);
  assert.equal(report.probes![0]!.hit, "#promo", "the covered CTA's centre goes to the ribbon");
  assert.deepEqual(report.probes![0]!.cssPoint, { x: 184, y: 116 });
  assert.equal(report.probes![1]!.offFrame, true);
  // Asked-for only: a run without --at must not imply a clean probe.
  const plain = await runGroundingScan({ source: hostile });
  assert.equal(plain.probes, undefined);
});

test("E2E: a probe says what a click would set off, not just that it is off the map", { timeout: 180_000 }, async () => {
  const base = await runGroundingScan({ source: join(REPO_ROOT, "fixtures/grounding/partly-covered.html") });
  const save = base.targets.find((t) => t.selector === "#save")!;
  const cta = base.targets.find((t) => t.selector === "#cta")!;
  const report = await runGroundingScan({
    source: join(REPO_ROOT, "fixtures/grounding/partly-covered.html"),
    at: [
      // On the button's own icon: `elementFromPoint` answers with the child, and
      // the probe still has to say the click reaches the button.
      { x: save.box.x + 5, y: save.point.y },
      // On the veil over the CTA: not a target, and nothing above it is one.
      cta.aimedOffCentre!.centre,
      // Empty background.
      { x: 2, y: 2 },
    ],
  });
  assert.equal(report.probes![0]!.targetId, save.id, "a hit on the icon is a hit on the button");
  assert.equal(report.probes![1]!.hit, "#veil");
  assert.equal(report.probes![1]!.targetId, undefined);
  // "'not a target' means 'not in the actionable list,' not 'safe to slip onto'"
  // — so the absence of `wouldReach` is the claim, and it is a measured one.
  assert.equal(report.probes![1]!.wouldReach, undefined, "nothing up to body declares itself interactive");
  assert.equal(report.probes![2]!.targetId, undefined);
});

test("E2E: a row scrolled out of its list is reported with the scroll that reveals it", { timeout: 180_000 }, async () => {
  // Two 90px lists of 40px rows: one scrolls, one does not. The fourth row of
  // each is painted nowhere, and only one of them can be brought into view.
  const report = await runGroundingScan({ source: join(REPO_ROOT, "fixtures/grounding/scrolled-list.html") });
  const row4 = report.targets.find((t) => t.selector === "#row-4")!;
  assert.equal(row4.inFrame, false, "it is inside the viewport and painted nowhere");
  assert.equal(row4.clippedBy?.selector, "#scroller");
  assert.equal(row4.clippedBy?.scrollable, true);
  assert.ok(row4.clippedBy!.dy > 0, "the list has to scroll down to reach it");

  const locked = report.targets.find((t) => t.selector === "#locked-4")!;
  assert.equal(locked.clippedBy?.scrollable, false, "overflow:hidden cannot be scrolled to");

  // The rule that used to fire on all of these fires on none of them.
  assert.deepEqual(report.issues.filter((i) => i.kind === "occluded-target"), []);

  // A row only half inside its list is still actionable, and its click point is
  // in the half that is painted rather than at the box's centre.
  const row3 = report.targets.find((t) => t.selector === "#row-3")!;
  assert.equal(row3.inFrame, true);
  assert.ok(row3.point.y < row3.box.y + row3.box.height / 2, "aimed into the visible part");
});

test("E2E: --mark writes the overlay at the frame's own resolution", { timeout: 180_000 }, async () => {
  const out = join(mkdtempSync(join(tmpdir(), "vlmkit-grounding-")), "marked.png");
  const report = await runGroundingScan({ source: hostile, markPath: out });
  const { PNG } = await import("pngjs");
  const png = PNG.sync.read(await readFile(out));
  assert.equal(png.width, report.frame.width);
  assert.equal(png.height, report.frame.height);
});
