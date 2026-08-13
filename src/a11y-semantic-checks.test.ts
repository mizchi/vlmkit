import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  analyzeA11ySemanticSamples,
  type A11ySemanticRawSample,
} from "./a11y-semantic-checks.ts";

function blank(): A11ySemanticRawSample {
  return { headings: [], formControls: [], images: [] };
}

describe("analyzeA11ySemanticSamples", () => {
  describe("heading-hierarchy", () => {
    it("flags multiple h1", () => {
      const out = analyzeA11ySemanticSamples({
        ...blank(),
        headings: [
          { level: 1, path: "h1", text: "First" },
          { level: 1, path: "h1.duplicate", text: "Second" },
        ],
      });
      const f = out.filter((x) => x.kind === "heading-hierarchy");
      assert.equal(f.length, 1);
      assert.match(f[0].message, /Multiple <h1>/);
      assert.equal(f[0].path, "h1.duplicate");
    });

    it("flags skipped levels (h1 → h3 jumps h2)", () => {
      const out = analyzeA11ySemanticSamples({
        ...blank(),
        headings: [
          { level: 1, path: "h1", text: "A" },
          { level: 3, path: "h3", text: "B" },
        ],
      });
      const f = out.filter((x) => x.kind === "heading-hierarchy");
      assert.equal(f.length, 1);
      assert.match(f[0].message, /h1 to h3, skipping h2/);
    });

    it("does not flag a clean h1 → h2 → h3 sequence", () => {
      const out = analyzeA11ySemanticSamples({
        ...blank(),
        headings: [
          { level: 1, path: "h1", text: "A" },
          { level: 2, path: "h2", text: "B" },
          { level: 3, path: "h3", text: "C" },
        ],
      });
      assert.equal(out.filter((x) => x.kind === "heading-hierarchy").length, 0);
    });

    it("allows decrease in level (h3 → h2)", () => {
      const out = analyzeA11ySemanticSamples({
        ...blank(),
        headings: [
          { level: 1, path: "h1", text: "A" },
          { level: 2, path: "h2.first", text: "B" },
          { level: 3, path: "h3", text: "C" },
          { level: 2, path: "h2.second", text: "D" },
        ],
      });
      assert.equal(out.filter((x) => x.kind === "heading-hierarchy").length, 0);
    });
  });

  describe("form-label", () => {
    it("flags an input with only a placeholder", () => {
      const out = analyzeA11ySemanticSamples({
        ...blank(),
        formControls: [{
          path: "form>input",
          tag: "input",
          type: "text",
          hasAssociatedLabel: false,
          hasAriaLabel: false,
          hasAriaLabelledby: false,
          ariaLabelledbyTargetText: "",
          placeholder: "Email",
        }],
      });
      const f = out.filter((x) => x.kind === "form-label");
      assert.equal(f.length, 1);
      assert.match(f[0].message, /no associated <label>/);
      assert.match(f[0].message, /placeholder "Email" is not an accessible name/);
    });

    it("accepts an aria-label", () => {
      const out = analyzeA11ySemanticSamples({
        ...blank(),
        formControls: [{
          path: "input", tag: "input", type: "text",
          hasAssociatedLabel: false, hasAriaLabel: true,
          hasAriaLabelledby: false, ariaLabelledbyTargetText: "",
          placeholder: "",
        }],
      });
      assert.equal(out.filter((x) => x.kind === "form-label").length, 0);
    });

    it("accepts aria-labelledby pointing at non-empty text", () => {
      const out = analyzeA11ySemanticSamples({
        ...blank(),
        formControls: [{
          path: "input", tag: "input", type: "text",
          hasAssociatedLabel: false, hasAriaLabel: false,
          hasAriaLabelledby: true, ariaLabelledbyTargetText: "Phone number",
          placeholder: "",
        }],
      });
      assert.equal(out.filter((x) => x.kind === "form-label").length, 0);
    });

    it("rejects aria-labelledby pointing at empty text", () => {
      const out = analyzeA11ySemanticSamples({
        ...blank(),
        formControls: [{
          path: "input", tag: "input", type: "text",
          hasAssociatedLabel: false, hasAriaLabel: false,
          hasAriaLabelledby: true, ariaLabelledbyTargetText: "",
          placeholder: "",
        }],
      });
      assert.equal(out.filter((x) => x.kind === "form-label").length, 1);
    });

    it("ignores submit / reset / button inputs (label not required)", () => {
      const out = analyzeA11ySemanticSamples({
        ...blank(),
        formControls: ["submit", "reset", "button"].map((t) => ({
          path: `input[type=${t}]`, tag: "input", type: t,
          hasAssociatedLabel: false, hasAriaLabel: false,
          hasAriaLabelledby: false, ariaLabelledbyTargetText: "",
          placeholder: "",
        })),
      });
      assert.equal(out.filter((x) => x.kind === "form-label").length, 0);
    });
  });

  describe("image-alt", () => {
    it("flags an img without alt", () => {
      const out = analyzeA11ySemanticSamples({
        ...blank(),
        images: [{
          path: "img", src: "/logo.png",
          hasAlt: false, hasEmptyAlt: false, ariaHidden: false, role: "",
        }],
      });
      const f = out.filter((x) => x.kind === "image-alt");
      assert.equal(f.length, 1);
      assert.match(f[0].message, /no alt attribute/);
    });

    it("accepts img with empty alt (decorative)", () => {
      const out = analyzeA11ySemanticSamples({
        ...blank(),
        images: [{
          path: "img", src: "/bg.png",
          hasAlt: true, hasEmptyAlt: true, ariaHidden: false, role: "",
        }],
      });
      assert.equal(out.filter((x) => x.kind === "image-alt").length, 0);
    });

    it("accepts img with aria-hidden", () => {
      const out = analyzeA11ySemanticSamples({
        ...blank(),
        images: [{
          path: "img", src: "/x.svg",
          hasAlt: false, hasEmptyAlt: false, ariaHidden: true, role: "",
        }],
      });
      assert.equal(out.filter((x) => x.kind === "image-alt").length, 0);
    });

    it('accepts img with role="presentation" or role="none"', () => {
      for (const role of ["presentation", "none"]) {
        const out = analyzeA11ySemanticSamples({
          ...blank(),
          images: [{
            path: "img", src: "/x.svg",
            hasAlt: false, hasEmptyAlt: false, ariaHidden: false, role,
          }],
        });
        assert.equal(out.filter((x) => x.kind === "image-alt").length, 0, `role=${role}`);
      }
    });
  });
});
