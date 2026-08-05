/**
 * `check asset` as a gate definition. Measurement code in
 * `../asset/asset-check.ts` is untouched.
 *
 * Browser-free: this gate is pure PNG math, so it is the cheapest one in the
 * suite and the only one that runs before the asset is in a page at all.
 */

import { readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type AssetCheckOptions,
  type AssetCheckReport,
  formatAssetCheckReport,
  runAssetCheck,
} from "../asset/asset-check.ts";
import { firstPositional } from "./arg-helpers.ts";

export const assetGate = defineGate<AssetCheckReport, AssetCheckOptions>({
  id: "check.asset",
  command: ["check", "asset"],
  title: "Generated-asset gate",
  summary:
    "Generated-asset gate (browser-free PNG math): slot aspect fit, transparent vs matted background, occupancy, figure-ground contrast vs backdrop, palette harmony vs page",
  usage: `Deterministic PNG gate for image assets headed into markup slots
(generated sprites/portraits/hero art): slot aspect fit, transparent
vs matted background (border-ring measurement), occupancy + content
bbox, figure-ground contrast against the target backdrop, and palette
harmony vs a page screenshot. Browser-free pixel math — run it BEFORE
swapping the asset in; after the swap, check integrity / check layout
gate the page itself.`,
  rules: [
    { id: "aspect-mismatch", title: "Asset aspect ratio does not fit the slot", severity: "suspect" },
    { id: "opaque-background", title: "Cut-out expected but the border ring is opaque", severity: "suspect" },
    { id: "near-empty", title: "Almost no content in the frame", severity: "suspect" },
    { id: "upscale", title: "Asset is smaller than the slot and will be upscaled", severity: "warn" },
    { id: "full-bleed", title: "Content reaches the frame edges", severity: "warn" },
    {
      id: "low-figure-ground-contrast",
      title: "Silhouette will not separate from the backdrop",
      severity: "warn",
      docs: "Only measured with --against-bg.",
    },
    {
      id: "palette-clash",
      title: "Asset palette does not harmonize with the page",
      severity: "warn",
      docs: "Only measured with --page-palette.",
    },
  ],
  inputs: [
    { name: "source", placeholder: "asset.png", kind: "path", description: "Asset PNG", positional: 0, required: true },
    { name: "slot", placeholder: "WxH", kind: "string", description: "Target slot size (aspect + upscale checks)" },
    { name: "expect-transparent", kind: "boolean", description: "The asset must be a cut-out (transparent border ring)" },
    { name: "against-bg", placeholder: "#rrggbb", kind: "string", description: "Backdrop the asset will sit on (silhouette contrast check)" },
    { name: "page-palette", placeholder: "png", kind: "path", description: "Page screenshot to check palette harmony against" },
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check asset <asset.png>", ["--slot", "--against-bg", "--page-palette"]);
    const rawSlot = readFlag(argv, "slot");
    let slot: { w: number; h: number } | undefined;
    if (rawSlot !== undefined) {
      const match = /^(\d+)x(\d+)$/.exec(rawSlot);
      if (!match) throw new UsageError(`--slot expects WxH, e.g. 220x300 (got ${JSON.stringify(rawSlot)})`);
      slot = { w: Number(match[1]), h: Number(match[2]) };
    }
    const againstBg = readFlag(argv, "against-bg");
    const pagePalettePath = readFlag(argv, "page-palette");
    return {
      source,
      ...(slot ? { slot } : {}),
      ...(argv.includes("--expect-transparent") ? { expectTransparent: true } : {}),
      ...(againstBg ? { againstBg } : {}),
      ...(pagePalettePath ? { pagePalettePath } : {}),
    };
  },
  run: (options) => runAssetCheck(options),
  findings: (report): Finding[] =>
    report.issues.map((issue) => ({
      rule: issue.kind,
      severity: issue.severity,
      message: issue.message,
    })),
  format: formatAssetCheckReport,
  // runAssetCheck appends its own entry.
  ledger: () => null,
});
