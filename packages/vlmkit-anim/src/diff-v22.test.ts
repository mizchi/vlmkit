/**
 * v22: the diff figure. Two module maps → the change as facts (added / removed / moved / relabelled), the
 * after map drawn with the change marked, and a sheet the change is checked against.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "vitest";
import { checkAnimation } from "./check.ts";
import { compileScene } from "./compile/index.ts";
import { depEnds } from "./compile/modules.ts";
import { checkDiffExpectation, DIFF_FORMAT, diffFacts, diffScene, formatDiffFacts } from "./diff.ts";
import { layoutReport } from "./layout.ts";
import { sceneFacts } from "./expect.ts";
import { renderFrameSvg } from "./render-svg.ts";
import { sampleFrame, timelineDuration } from "./timeline.ts";
import type { ModulesScene } from "./types.ts";
import { formatDiagnostics, validateScene } from "./validate.ts";

const read = (name: string): ModulesScene => JSON.parse(readFileSync(join(import.meta.dirname, "..", "fixtures", "diff", `${name}.json`), "utf8")) as ModulesScene;
const before = read("web-service-before");
const after = read("web-service-after");

describe("diffFacts", () => {
  const f = diffFacts(before, after);

  it("names what was added, removed, moved and relabelled, and counts what stayed", () => {
    assert.deepEqual(f.added, { modules: ["search"], deps: ["api->search", "search->db"], groups: ["identity"] });
    assert.deepEqual(f.removed, { modules: ["cache"], deps: ["api->cache"], groups: [] });
    assert.deepEqual(f.moved, [{ module: "auth", from: "core", to: "identity" }]);
    assert.deepEqual(f.relabelled, [{ id: "logging", from: "logging", to: "logs" }]);
    assert.deepEqual(f.unchanged, { modules: 5, deps: 5, groups: 3 });
    assert.equal(formatDiffFacts(f), '+1 module (search) · +2 deps (api->search, search->db) · +1 group (identity) · −1 module (cache) · −1 dep (api->cache) · 1 moved (auth: core → identity) · 1 relabelled (logging: "logging" → "logs")');
  });

  it("a scene against itself is no change", () => {
    const same = diffFacts(before, before);
    assert.equal(formatDiffFacts(same), "no change");
    assert.deepEqual(same.moved, []);
  });
});

describe("diffScene: the after map with the change marked", () => {
  const f = diffFacts(before, after);
  const s = diffScene(before, after, f);
  const tl = compileScene(s);

  it("is a valid, clean modules scene; added and moved modules are accent, the removed one is muted and drawn where it was", () => {
    assert.deepEqual(validateScene(s).filter((d) => d.severity === "error"), [], formatDiagnostics(validateScene(s)));
    assert.deepEqual(checkAnimation(tl, s).filter((d) => d.severity === "error"), []);
    assert.equal(layoutReport(tl).totals.framesWithIssues, 0);
    const def = (id: string) => s.modules.find((m) => typeof m !== "string" && m.id === id) as { tone?: string; label?: string; dashed?: boolean } | undefined;
    assert.equal(def("search")?.tone, "accent");
    assert.equal(def("auth")?.tone, "accent", "moved: accent");
    assert.equal(def("cache")?.tone, "muted");
    assert.equal(def("cache")?.dashed, true, "a removed module's box is dashed, like a removed dependency (oa, v22)");
    assert.equal(tl.nodes.find((n) => n.id === "cache")?.dashed, true);
    assert.match(renderFrameSvg(tl, timelineDuration(tl)), /<rect[^>]*stroke-dasharray/, "the dashed outline reaches the SVG");
    assert.equal(def("logging")?.tone, "accent", "relabelled: accent");
    assert.equal(def("logging")?.label, "logs", "the after label");
    assert.ok(s.groups!.find((g) => g.id === "infra")!.modules.includes("cache"), "the removed module sits in the container it left");
  });

  it("added dependencies are accent, the removed one dashed and muted; the facts of the figure carry them all", () => {
    const dep = (from: string, to: string) => (s.deps ?? []).find((d) => !Array.isArray(d) && depEnds(d)[0] === from && depEnds(d)[1] === to) as { tone?: string; style?: string } | undefined;
    assert.equal(dep("api", "search")?.tone, "accent");
    assert.equal(dep("api", "cache")?.style, "dashed");
    assert.equal(dep("api", "cache")?.tone, "muted");
    const facts = sceneFacts(s, tl)!;
    assert.ok(facts.deps.includes("api->cache"), "drawn, so a fact of the figure");
    assert.ok(facts.highlighted.includes("search") && facts.highlighted.includes("api->search") && facts.highlighted.includes("identity"), `lit: ${facts.highlighted.join(", ")}`);
    assert.ok(!facts.highlighted.includes("cache"));
  });

  it("the legend states the change, and the still is the final frame", () => {
    const legend = tl.nodes.filter((n) => /^text-/.test(n.id) && n.shape === "text").map((n) => n.text ?? "");
    assert.ok(legend.some((t) => /^\+1 module · \+2 deps · \+1 group$/.test(t)), legend.join(" | "));
    assert.ok(legend.some((t) => /^−1 module · −1 dep$/.test(t)));
    assert.ok(legend.some((t) => /accent: added or moved/.test(t)));
    const frame = sampleFrame(tl, timelineDuration(tl));
    assert.ok((frame.get("cache")?.opacity ?? 0) > 0);
  });
});

describe("checkDiffExpectation", () => {
  const f = diffFacts(before, after);

  it("a sheet that matches is silent; every field is optional", () => {
    assert.deepEqual(checkDiffExpectation(f, { format: DIFF_FORMAT, added: { modules: ["search"] }, moved: [{ module: "auth", from: "core", to: "identity" }] }), []);
    assert.deepEqual(checkDiffExpectation(f, {}), []);
  });

  it("a change the sheet does not name, and a claim the scenes do not show, are each one line", () => {
    const d = checkDiffExpectation(f, { added: { modules: ["search", "queue"], deps: ["api->search"] }, removed: { modules: [] } });
    assert.ok(d.some((x) => /module "queue" was added; the two scenes do not show that/.test(x.message)), formatDiagnostics(d));
    assert.ok(d.some((x) => /dependency "search->db" was added between the scenes but the sheet does not say so/.test(x.message)));
    assert.ok(d.some((x) => /module "cache" was removed between the scenes but the sheet does not say so/.test(x.message)));
    assert.equal(d.length, 3);
  });
});
