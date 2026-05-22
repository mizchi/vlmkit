import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DpEntry, DpEntryWithViewport } from "@mizchi/vlmkit-core/dom-position-styles.ts";
import { trimDomPositionEntriesByClassPair } from "./migration-compare.ts";

function dpEntry(overrides: Partial<DpEntry>): DpEntry {
  return {
    path: "main[0]",
    tag: "section",
    baselineClasses: "baseline-card",
    variantClasses: "variant-card",
    property: "margin-top",
    baseline: "0px",
    variant: "8px",
    ...overrides,
  };
}

describe("trimDomPositionEntriesByClassPair", () => {
  it("keeps representative class-pair/property groups before repeated rows", () => {
    const repeated = Array.from({ length: 12 }, (_, index) =>
      dpEntry({
        path: `main[0]>section[${index}]`,
        baselineClasses: "baseline-card",
        variantClasses: "variant-card",
        property: "margin-top",
      })
    );
    const entries = [
      ...repeated,
      dpEntry({
        path: "main[0]>aside[0]",
        baselineClasses: "baseline-sidebar",
        variantClasses: "variant-sidebar",
        property: "gap",
      }),
      dpEntry({
        path: "main[0]>footer[0]",
        baselineClasses: "baseline-footer",
        variantClasses: "variant-footer",
        property: "padding-left",
      }),
    ];

    const trimmed = trimDomPositionEntriesByClassPair(entries, 4);

    assert.equal(trimmed.length, 4);
    assert.deepEqual(
      trimmed.map((entry) => `${entry.baselineClasses}->${entry.variantClasses}:${entry.property}`),
      [
        "baseline-card->variant-card:margin-top",
        "baseline-sidebar->variant-sidebar:gap",
        "baseline-footer->variant-footer:padding-left",
        "baseline-card->variant-card:margin-top",
      ],
    );
  });

  it("works for per-viewport entries without dropping viewport data", () => {
    const entries: DpEntryWithViewport[] = [
      { ...dpEntry({ path: "main[0]>section[0]" }), viewport: "mobile" },
      { ...dpEntry({ path: "main[0]>section[1]" }), viewport: "desktop" },
      {
        ...dpEntry({
          path: "main[0]>nav[0]",
          baselineClasses: "baseline-nav",
          variantClasses: "variant-nav",
          property: "display",
        }),
        viewport: "desktop",
      },
    ];

    const trimmed = trimDomPositionEntriesByClassPair(entries, 2);

    assert.deepEqual(
      trimmed.map((entry) => [entry.path, entry.viewport]),
      [
        ["main[0]>section[0]", "mobile"],
        ["main[0]>nav[0]", "desktop"],
      ],
    );
  });
});
