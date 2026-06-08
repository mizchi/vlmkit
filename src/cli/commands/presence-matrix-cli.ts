#!/usr/bin/env node
/**
 * `vlmkit diff matrix` — build a region × viewport presence matrix from N
 * baseline/current PNG pairs and annotate viewport-exclusive regions with the
 * media-query breakpoints that explain them.
 *
 * Both A/B v1 and v2 agents localized regressions by manually comparing which
 * viewports showed a diff ("375-only ⇒ mobile base rule deleted"; "1280-only ⇒
 * min-width:1200px block"). This command mechanizes that inference
 * (A/B v2 draft 08).
 */
import { readFile } from "node:fs/promises";
import { compareScreenshots } from "@mizchi/vlmkit-core/heatmap.ts";
import type { VrtSnapshot } from "@mizchi/vlmkit-core/types.ts";
import {
  buildPresenceMatrix,
  formatPresenceMatrix,
  type PresenceMatrixBreakpoint,
  type PresenceMatrixViewportInput,
} from "@mizchi/vlmkit-markup/presence-matrix.ts";

interface ViewportArg {
  label: string;
  width: number;
  baseline: string;
  current: string;
}

interface Args {
  viewports: ViewportArg[];
  cssPath?: string;
  htmlPath?: string;
  threshold: number;
  json: boolean;
}

function usage(): string {
  return [
    "Usage:",
    "  vlmkit diff matrix --viewport <label>:<width>:<baseline.png>:<current.png> [...] [--css styles.css] [--html page.html] [--json]",
    "",
    "Builds a region × viewport presence matrix from N PNG pairs (one per",
    "viewport) and flags regions that appear in only some viewports, hinting",
    "the @media breakpoints that separate the present widths from the absent",
    "ones. Provide --css or --html to supply the breakpoints (otherwise the",
    "matrix is emitted without media hints).",
    "",
    "Example:",
    "  vlmkit diff matrix \\",
    "    --viewport 1280:1280:base-1280.png:cur-1280.png \\",
    "    --viewport 768:768:base-768.png:cur-768.png \\",
    "    --viewport 375:375:base-375.png:cur-375.png \\",
    "    --html page.html",
  ].join("\n");
}

function parseViewportArg(value: string): ViewportArg {
  // label:width:baseline:current — label may not contain ':'; paths may, so
  // split into exactly 4 parts from the left for label+width and from the
  // right for the two paths is ambiguous; require label/width to be ':'-free
  // and take the rest as the two trailing path fields.
  const parts = value.split(":");
  if (parts.length < 4) {
    throw new Error(`Invalid --viewport value (need label:width:baseline:current): ${value}`);
  }
  const [label, widthRaw, ...rest] = parts;
  const width = Number(widthRaw);
  if (!Number.isFinite(width) || width <= 0) {
    throw new Error(`Invalid viewport width in --viewport: ${value}`);
  }
  // The remaining fields are the two paths; rejoin in case a Windows-style
  // path slipped a ':' through (rare, but be forgiving): take first half as
  // baseline, second as current only when exactly two remain.
  if (rest.length !== 2) {
    throw new Error(`Invalid --viewport value (need exactly one baseline and one current path): ${value}`);
  }
  return { label: label!, width, baseline: rest[0]!, current: rest[1]! };
}

function parseArgs(argv: string[]): Args | null {
  if (argv.includes("--help") || argv.includes("-h")) return null;
  const viewports: ViewportArg[] = [];
  let cssPath: string | undefined;
  let htmlPath: string | undefined;
  let threshold = 0.1;
  let json = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    switch (arg) {
      case "--viewport":
        viewports.push(parseViewportArg(argv[++i] ?? ""));
        break;
      case "--css":
        cssPath = argv[++i];
        break;
      case "--html":
        htmlPath = argv[++i];
        break;
      case "--threshold": {
        const v = Number(argv[++i]);
        if (Number.isFinite(v) && v >= 0 && v <= 1) threshold = v;
        break;
      }
      case "--json":
        json = true;
        break;
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (viewports.length === 0) {
    throw new Error("At least one --viewport is required");
  }
  return {
    viewports,
    ...(cssPath ? { cssPath } : {}),
    ...(htmlPath ? { htmlPath } : {}),
    threshold,
    json,
  };
}

async function resolveBreakpoints(args: Args): Promise<PresenceMatrixBreakpoint[]> {
  const { extractBreakpoints, extractBreakpointsFromHtml } = await import(
    "@mizchi/vlmkit-capture/viewport-discovery.ts"
  );
  const collected: PresenceMatrixBreakpoint[] = [];
  if (args.cssPath) {
    const css = await readFile(args.cssPath, "utf-8");
    collected.push(...extractBreakpoints(css));
  }
  if (args.htmlPath) {
    const html = await readFile(args.htmlPath, "utf-8");
    collected.push(...extractBreakpointsFromHtml(html));
  }
  // Dedupe by type:value.
  const seen = new Set<string>();
  return collected.filter((bp) => {
    const key = `${bp.type}:${bp.value}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runPresenceMatrixCli(argv = process.argv.slice(2)): Promise<void> {
  let args: Args | null;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(String(error instanceof Error ? error.message : error));
    console.error("\n" + usage());
    process.exit(1);
  }
  if (!args) {
    console.log(usage());
    return;
  }

  const inputs: PresenceMatrixViewportInput[] = [];
  for (const vp of args.viewports) {
    const snapshot: VrtSnapshot = {
      testId: vp.label,
      testTitle: vp.label,
      projectName: "vlmkit",
      screenshotPath: vp.current,
      baselinePath: vp.baseline,
      status: "changed",
    };
    const diff = await compareScreenshots(snapshot, { skipHeatmap: true, threshold: args.threshold });
    inputs.push({ label: vp.label, width: vp.width, regions: diff?.regions ?? [] });
  }

  const breakpoints = await resolveBreakpoints(args);
  const matrix = buildPresenceMatrix(inputs, breakpoints);

  if (args.json) {
    console.log(JSON.stringify(matrix, null, 2));
    return;
  }
  process.stdout.write(formatPresenceMatrix(matrix));
}

if (
  process.env.__VRT_DISPATCHER_LEAF__ === "presence-matrix" ||
  process.argv[1]?.endsWith("presence-matrix-cli.ts")
) {
  runPresenceMatrixCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
