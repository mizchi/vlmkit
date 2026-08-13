import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { A11yNode, UiSpec } from "@mizchi/vlmkit-core/types.ts";

// Inline the functions to test (avoid fs dependency in unit tests)
// We test the core logic via introspectToSpec + verifySpec

import { introspect, introspectToSpec, verifySpec } from "./introspect.ts";
import type { IntrospectResult, PageIntrospection } from "@mizchi/vlmkit-core/types.ts";

function makePage(testId: string, overrides: Partial<PageIntrospection> = {}): PageIntrospection {
  return {
    testId,
    description: `Page ${testId}`,
    landmarks: [{ role: "banner", name: "" }, { role: "main", name: "" }, { role: "navigation", name: "nav" }],
    interactiveElements: [
      { role: "button", name: "Submit", hasLabel: true },
      { role: "link", name: "Home", hasLabel: true },
    ],
    stats: { totalNodes: 20, landmarkCount: 3, interactiveCount: 2, unlabeledCount: 0, headingLevels: [1, 2] },
    suggestedInvariants: [
      { description: 'banner landmark "" is present', check: "landmark-exists", cost: "low" },
      { description: 'main landmark "" is present', check: "landmark-exists", cost: "low" },
      { description: 'navigation landmark "nav" is present', check: "landmark-exists", cost: "low" },
      { description: "All 2 interactive elements have labels", check: "label-present", cost: "low" },
      { description: "Page is not blank/whiteout", check: "no-whiteout", cost: "low" },
    ],
    ...overrides,
  };
}

describe("introspectToSpec", () => {
  it("should generate spec from introspect result", () => {
    const result: IntrospectResult = {
      generatedAt: "2026-01-01",
      pages: [makePage("home"), makePage("about")],
    };

    const spec = introspectToSpec(result);
    assert.equal(spec.pages.length, 2);
    assert.ok(spec.pages[0].invariants.length > 0);
    assert.ok(spec.global!.length > 0);
    assert.equal(spec.pages[0].testId, "home");
  });

  it("should suggest heading hierarchy invariants from a11y snapshots", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-introspect-"));
    try {
      await writeFile(join(dir, "home.a11y.json"), JSON.stringify({
        role: "document",
        name: "",
        children: [
          { role: "heading", name: "Title", level: 1 },
          { role: "heading", name: "Section", level: 2 },
        ],
      }));

      const result = await introspect(dir);
      assert.ok(
        result.pages[0]!.suggestedInvariants.some(
          (inv) => inv.check === "heading-hierarchy",
        ),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("should suggest ARIA relationship invariants when references are present", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-introspect-"));
    try {
      await writeFile(join(dir, "tabs.a11y.json"), JSON.stringify({
        role: "document",
        name: "",
        children: [
          { role: "button", name: "Overview", id: "tab-overview", ariaControls: "panel-overview" },
          { role: "region", name: "Overview panel", id: "panel-overview" },
        ],
      }));

      const result = await introspect(dir);
      assert.ok(
        result.pages[0]!.suggestedInvariants.some(
          (inv) => inv.check === "aria-relationships",
        ),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("should suggest color contrast invariants from contrast sidecars", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-introspect-"));
    try {
      await writeFile(join(dir, "home.a11y.json"), JSON.stringify({
        role: "document",
        name: "",
        children: [{ role: "main", name: "" }],
      }));
      await writeFile(join(dir, "home.contrast.json"), JSON.stringify({
        totalText: 2,
        failures: [],
      }));

      const result = await introspect(dir);
      assert.ok(
        result.pages[0]!.suggestedInvariants.some(
          (inv) => inv.check === "color-contrast",
        ),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("should suggest responsive layout invariants from responsive sidecars", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vlmkit-introspect-"));
    try {
      await writeFile(join(dir, "home.a11y.json"), JSON.stringify({
        role: "document",
        name: "",
        children: [{ role: "main", name: "" }],
      }));
      await writeFile(join(dir, "home.responsive.json"), JSON.stringify({
        snapshots: [
          { viewport: { width: 375, height: 812 }, clientWidth: 375, scrollWidth: 375 },
          { viewport: { width: 1440, height: 900 }, clientWidth: 1440, scrollWidth: 1440 },
        ],
      }));

      const result = await introspect(dir);
      assert.ok(
        result.pages[0]!.suggestedInvariants.some(
          (inv) => inv.check === "responsive-layout",
        ),
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("verifySpec", () => {
  const tree: A11yNode = {
    role: "document",
    name: "",
    children: [
      {
        role: "banner",
        name: "",
        children: [
          { role: "navigation", name: "nav", children: [{ role: "link", name: "Home" }] },
        ],
      },
      {
        role: "main",
        name: "",
        children: [
          { role: "heading", name: "Title", level: 1 },
          { role: "button", name: "Submit" },
        ],
      },
    ],
  };

  it("should pass all invariants for well-formed page", () => {
    const spec: UiSpec = {
      description: "test",
      pages: [{
        testId: "home",
        invariants: [
          { description: "banner landmark is present", check: "landmark-exists", cost: "low" },
          { description: "All elements labeled", check: "label-present", cost: "low" },
        ],
      }],
      global: [{ description: "No whiteout", check: "no-whiteout", cost: "low" }],
    };

    const data = new Map([["home", { a11yTree: tree, screenshotExists: true }]]);
    const result = verifySpec(spec, data);
    assert.equal(result.results.length, 1);
    assert.ok(result.results[0].checked.every((c) => c.passed));
  });

  it("should detect missing landmark", () => {
    const spec: UiSpec = {
      description: "test",
      pages: [{
        testId: "home",
        invariants: [
          { description: "search landmark is present", check: "landmark-exists", cost: "low" },
        ],
      }],
    };

    const data = new Map([["home", { a11yTree: tree, screenshotExists: true }]]);
    const result = verifySpec(spec, data);
    assert.ok(result.results[0].checked.some((c) => !c.passed));
  });

  it("should detect skipped heading levels", () => {
    const spec: UiSpec = {
      description: "test",
      pages: [{
        testId: "home",
        invariants: [
          { description: "Heading hierarchy does not skip levels", check: "heading-hierarchy", cost: "low" },
        ],
      }],
    };
    const badTree: A11yNode = {
      role: "document",
      name: "",
      children: [
        { role: "main", name: "", children: [
          { role: "heading", name: "Title", level: 1 },
          { role: "heading", name: "Details", level: 3 },
        ] },
      ],
    };

    const data = new Map([["home", { a11yTree: badTree, screenshotExists: true }]]);
    const result = verifySpec(spec, data);
    const headingCheck = result.results[0].checked.find(
      (check) => check.invariant.check === "heading-hierarchy",
    );
    assert.equal(headingCheck?.passed, false);
    assert.match(headingCheck?.reasoning ?? "", /h3 after h1/);
  });

  it("should detect missing ARIA relationship targets", () => {
    const spec: UiSpec = {
      description: "test",
      pages: [{
        testId: "tabs",
        invariants: [
          { description: "ARIA relationship references resolve", check: "aria-relationships", cost: "low" },
        ],
      }],
    };
    const badTree: A11yNode = {
      role: "document",
      name: "",
      children: [
        { role: "button", name: "Overview", id: "tab-overview", ariaControls: "missing-panel" },
      ],
    };

    const data = new Map([["tabs", { a11yTree: badTree, screenshotExists: true }]]);
    const result = verifySpec(spec, data);
    const ariaCheck = result.results[0].checked.find(
      (check) => check.invariant.check === "aria-relationships",
    );
    assert.equal(ariaCheck?.passed, false);
    assert.match(ariaCheck?.reasoning ?? "", /missing-panel/);
  });

  it("should detect color contrast failures", () => {
    const spec: UiSpec = {
      description: "test",
      pages: [{
        testId: "home",
        invariants: [
          { description: "Text color contrast passes WCAG AA", check: "color-contrast", cost: "low" },
        ],
      }],
    };

    const data = new Map([["home", {
      a11yTree: tree,
      screenshotExists: true,
      contrastFindings: [
        { path: "main>p", text: "Muted copy", ratio: 2.1, requiredAA: 4.5 },
      ],
    }]]);
    const result = verifySpec(spec, data);
    const contrastCheck = result.results[0].checked.find(
      (check) => check.invariant.check === "color-contrast",
    );
    assert.equal(contrastCheck?.passed, false);
    assert.match(contrastCheck?.reasoning ?? "", /2\.1:1/);
  });

  it("should pass color contrast samples that meet WCAG AA", () => {
    const spec: UiSpec = {
      description: "test",
      pages: [{
        testId: "home",
        invariants: [
          { description: "Text color contrast passes WCAG AA", check: "color-contrast", cost: "low" },
        ],
      }],
    };

    const data = new Map([["home", {
      a11yTree: tree,
      screenshotExists: true,
      contrastSamples: [
        {
          path: "main>p",
          text: "Body copy",
          fontSize: 16,
          fontWeight: 400,
          foreground: { r: 0, g: 0, b: 0 },
          background: { r: 255, g: 255, b: 255 },
        },
      ],
    }]]);
    const result = verifySpec(spec, data);
    const contrastCheck = result.results[0].checked.find(
      (check) => check.invariant.check === "color-contrast",
    );
    assert.equal(contrastCheck?.passed, true);
  });

  it("should detect responsive horizontal overflow", () => {
    const spec: UiSpec = {
      description: "test",
      pages: [{
        testId: "home",
        invariants: [
          { description: "Responsive layout stays within viewport bounds", check: "responsive-layout", cost: "low" },
        ],
      }],
    };

    const data = new Map([["home", {
      a11yTree: tree,
      screenshotExists: true,
      responsiveSnapshots: [
        { viewport: { width: 375, height: 812 }, clientWidth: 375, scrollWidth: 421 },
      ],
    }]]);
    const result = verifySpec(spec, data);
    const responsiveCheck = result.results[0].checked.find(
      (check) => check.invariant.check === "responsive-layout",
    );
    assert.equal(responsiveCheck?.passed, false);
    assert.match(responsiveCheck?.reasoning ?? "", /horizontal overflow/);
  });

  it("should detect responsive max-width violations", () => {
    const spec: UiSpec = {
      description: "test",
      pages: [{
        testId: "home",
        invariants: [
          { description: "Responsive layout stays within viewport bounds", check: "responsive-layout", cost: "low" },
        ],
      }],
    };

    const data = new Map([["home", {
      a11yTree: tree,
      screenshotExists: true,
      responsiveSnapshots: [
        {
          viewport: { width: 1440, height: 900 },
          clientWidth: 1440,
          scrollWidth: 1440,
          regions: [
            { role: "main", name: "Article", width: 1280, maxWidth: 960 },
          ],
        },
      ],
    }]]);
    const result = verifySpec(spec, data);
    const responsiveCheck = result.results[0].checked.find(
      (check) => check.invariant.check === "responsive-layout",
    );
    assert.equal(responsiveCheck?.passed, false);
    assert.match(responsiveCheck?.reasoning ?? "", /maxWidth 960/);
  });

  it("should skip high-cost assertions", () => {
    const spec: UiSpec = {
      description: "test",
      pages: [{
        testId: "home",
        invariants: [
          { description: "The header looks professional", check: "nl-assertion", cost: "high", assert: "Header has clean design" },
        ],
      }],
    };

    const data = new Map([["home", { a11yTree: tree, screenshotExists: true }]]);
    const result = verifySpec(spec, data);
    assert.equal(result.results[0].checked.length, 0);
    assert.equal(result.results[0].skipped.length, 1);
    assert.ok(result.results[0].skipped[0].reason.includes("High-cost"));
  });

  it("should skip unaffected pages via dep graph", () => {
    const spec: UiSpec = {
      description: "test",
      pages: [{
        testId: "home",
        invariants: [
          { description: "Nav exists", check: "landmark-exists", cost: "low", dependsOn: ["src/Header.tsx"] },
        ],
      }],
    };

    const data = new Map([["home", { a11yTree: tree, screenshotExists: true }]]);
    // Changed files don't affect Header.tsx
    const result = verifySpec(spec, data, ["src/Footer.tsx"], new Map());
    assert.equal(result.results[0].checked.length, 0);
    assert.equal(result.results[0].skipped.length, 1);
    assert.ok(result.results[0].skipped[0].reason.includes("dep graph"));
  });

  it("should check invariant when dep graph says affected", () => {
    const spec: UiSpec = {
      description: "test",
      pages: [{
        testId: "home",
        invariants: [
          { description: "navigation landmark is present", check: "landmark-exists", cost: "low", dependsOn: ["src/Header.tsx"] },
        ],
      }],
    };

    const data = new Map([["home", { a11yTree: tree, screenshotExists: true }]]);
    // Changed files include Header.tsx
    const result = verifySpec(spec, data, ["src/Header.tsx"], new Map());
    assert.equal(result.results[0].checked.length, 1);
    assert.ok(result.results[0].checked[0].passed);
  });
});
