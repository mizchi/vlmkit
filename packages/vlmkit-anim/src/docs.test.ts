/**
 * `docs/anim-ir.md` promises that every JSON block on it passes `check`. A
 * writing guide whose examples are broken is worse than none: the reader
 * copies the example, sees an error, and now distrusts the hints too.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "vitest";
import { checkAnimation } from "./check.ts";
import { compileScene } from "./compile/index.ts";
import { checkExpectation, EXPECT_FORMAT, validateExpectation, type Expectation } from "./expect.ts";
import { EXAMPLES } from "./schema-sheet.ts";
import { SCENE_FORMAT, type Scene, type Timeline } from "./types.ts";
import { formatDiagnostics, validateDocument } from "./validate.ts";

const DOC = resolve(import.meta.dirname!, "../../../docs/anim-ir.md");

describe("docs/anim-ir.md", () => {
  const md = readFileSync(DOC, "utf-8");
  const blocks = [...md.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]);

  it("has one example per kind plus the timeline", () => {
    assert.ok(blocks.length >= 15, `found ${blocks.length} json blocks`);
  });

  it("every json block validates, compiles, and passes the semantic checks with no errors", () => {
    for (const [i, src] of blocks.entries()) {
      const doc = JSON.parse(src) as Scene | Timeline | Expectation;
      if ((doc as Expectation).format === EXPECT_FORMAT) {
        // A fact sheet for `check --expect`: well-formed, and true of the modules example just above it.
        const shape = validateExpectation(doc);
        assert.deepEqual(shape, [], `block ${i + 1}: ${formatDiagnostics(shape)}`);
        const r = checkExpectation(doc as Expectation, EXAMPLES.modules, compileScene(EXAMPLES.modules));
        assert.deepEqual(r.diagnostics, [], `block ${i + 1}: ${formatDiagnostics(r.diagnostics)}`);
        continue;
      }
      const { layer, diagnostics } = validateDocument(doc);
      assert.deepEqual(diagnostics, [], `block ${i + 1}: ${formatDiagnostics(diagnostics)}`);
      if (layer === "scene") {
        const tl = compileScene(doc as Scene);
        const errs = checkAnimation(tl, doc as Scene).filter((d) => d.severity === "error");
        assert.deepEqual(errs, [], `block ${i + 1}: ${formatDiagnostics(errs)}`);
      } else {
        const errs = checkAnimation(doc as Timeline).filter((d) => d.severity === "error");
        assert.deepEqual(errs, [], `block ${i + 1}: ${formatDiagnostics(errs)}`);
      }
    }
  });

  it("mentions every kind by heading", () => {
    for (const kind of ["sort", "array", "state-machine", "heap", "tree", "list", "distributed", "matrix", "graph", "chart", "diagram", "vector"]) assert.match(md, new RegExp(`^## kind: ${kind}$`, "m"));
    assert.match(md, /^## kind: stack, kind: queue$/m);
    assert.ok(md.includes(SCENE_FORMAT));
  });
});
