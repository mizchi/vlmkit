import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseDesignTokens,
  parseLengthToPx,
  snapColor,
  snapSpacing,
} from "./design-md-tokens.ts";

const PAWS_FRONT_MATTER = `---
name: Paws & Paths
colors:
  surface: "#f9f9ff"
  primary: "#855300"
  surface-container-high: "#e2e8f8"
rounded:
  sm: 0.25rem
  md: 0.75rem
spacing:
  xs: 4px
  sm: 12px
  md: 24px
  lg: 40px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
---
## Prose body
Should be ignored.
`;

describe("parseDesignTokens", () => {
  it("extracts colors as a name→hex map", () => {
    const t = parseDesignTokens(PAWS_FRONT_MATTER);
    assert.equal(t.colors.get("primary"), "#855300");
    assert.equal(t.colors.get("surface-container-high"), "#e2e8f8");
  });

  it("extracts spacing tokens with px and raw value, sorted ascending", () => {
    const t = parseDesignTokens(PAWS_FRONT_MATTER);
    assert.deepEqual(
      t.spacing.map((s) => [s.name, s.px, s.raw]),
      [
        ["xs", 4, "4px"],
        ["sm", 12, "12px"],
        ["md", 24, "24px"],
        ["lg", 40, "40px"],
      ],
    );
  });

  it("extracts rounded tokens with rem→px conversion", () => {
    const t = parseDesignTokens(PAWS_FRONT_MATTER);
    assert.equal(t.rounded.get("sm")?.px, 4);
    assert.equal(t.rounded.get("md")?.px, 12);
  });

  it("ignores {token.reference} placeholders", () => {
    const t = parseDesignTokens(PAWS_FRONT_MATTER);
    // button-primary.backgroundColor would resolve to a real color via
    // reference, but ingest skips it — only direct values become colors.
    assert.equal(t.colors.size, 3);
  });
});

describe("parseLengthToPx", () => {
  it("handles px and rem with implicit and explicit suffix", () => {
    assert.equal(parseLengthToPx("16px"), 16);
    assert.equal(parseLengthToPx("1rem"), 16);
    assert.equal(parseLengthToPx("0.25rem"), 4);
    assert.equal(parseLengthToPx("24"), 24);
    assert.equal(parseLengthToPx("not-a-length"), null);
  });
});

describe("snapSpacing", () => {
  const t = parseDesignTokens(PAWS_FRONT_MATTER);

  it("snaps an exact value to the matching token", () => {
    const r = snapSpacing(t, 24);
    assert.equal(r?.token.name, "md");
    assert.equal(r?.delta, 0);
  });

  it("snaps a near-exact value within tolerance", () => {
    const r = snapSpacing(t, 26, 4);
    assert.equal(r?.token.name, "md");
    assert.equal(r?.delta, 2);
  });

  it("returns null when no token is within tolerance", () => {
    // 100px is 60px away from `lg` (40px) — out of default 4px tolerance.
    const r = snapSpacing(t, 100);
    assert.equal(r, null);
  });
});

describe("snapColor", () => {
  const t = parseDesignTokens(PAWS_FRONT_MATTER);

  it("snaps an exact hex to the matching color token", () => {
    const r = snapColor(t, "#e2e8f8");
    assert.equal(r?.name, "surface-container-high");
    assert.equal(r?.hex, "#e2e8f8");
    assert.ok((r?.deltaE ?? 999) < 0.1);
  });

  it("snaps a perceptually-near hex to the closest token", () => {
    // #e4ecfc is one of the deltas an agent saw — it should resolve to
    // surface-container-high (#e2e8f8), within ΔE ~2.
    const r = snapColor(t, "#e4ecfc");
    assert.equal(r?.name, "surface-container-high");
    assert.ok((r?.deltaE ?? 999) < 5);
  });

  it("returns null for far-off colors", () => {
    const r = snapColor(t, "#000000", 10);
    assert.equal(r, null);
  });
});
