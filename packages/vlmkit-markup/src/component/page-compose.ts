/**
 * Page-level multi-component composition diff.
 *
 * `build component` converges ONE component against ONE target crop;
 * this closes the composition gap (scenario A5): given a full-page
 * target screenshot and the current HTML/PNG, extract component bboxes
 * on both sides, pair them **spatially** (not by area rank — rank
 * pairing lies when a component is missing), and report the signals an
 * agent needs to assemble a page out of converged parts:
 *
 *   - per-component position / size deltas + fill color pair
 *   - components missing from current (target-only) and extra ones
 *   - vertical ordering violations
 *   - stacking-gap deltas between consecutive components
 *   - `--crop` writes target/current crop pairs per component so each
 *     can be drilled into with `build component`
 *
 * Deterministic: pixels + Playwright only, no VLM.
 *
 * CLI: vlmkit build page <target.png> <current.html|current.png> [options]
 */
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { cropRegion } from "@mizchi/vlmkit-core/png-utils.ts";
import { type ComponentBbox } from "./component-bbox.ts";
import { handleCliError } from "@mizchi/vlmkit-core/cli-error.ts";
// `loadPng` / `renderHtmlToPng` moved to `page-render.ts`. Re-exported because the
// MCP tool, `region-judge` and the tests resolve them here — but NOT imported
// statically by anything in a gate's graph, which is the whole point of the move.
export { loadPng, renderHtmlToPng } from "./page-render.ts";
import { loadPng, renderHtmlToPng } from "./page-render.ts";
import { appendRunLedger } from "@mizchi/vlmkit-core/run-ledger.ts";
// The composition diff itself — pure arithmetic over bounding boxes — lives in
// `page-compose-diff.ts`. Re-exported because callers, the MCP tool and the tests
// already resolve it through this module.
import {
  composePageDiff,
  renderPageCompositionMarkdown,
  type ComposePageOptions,
  type PageComposition,
} from "./page-compose-diff.ts";
export {
  composePageDiff,
  dominantPageColor,
  matchPageComponents,
  renderPageCompositionMarkdown,
} from "./page-compose-diff.ts";
export type {
  ComposePageOptions,
  PageComponent,
  PageComposition,
  PageGapDelta,
  PageMatch,
  PageOrderViolation,
} from "./page-compose-diff.ts";

async function writeCrops(
  dir: string,
  composition: PageComposition,
  target: { data: Uint8Array; width: number; height: number },
  current: { data: Uint8Array; width: number; height: number },
): Promise<string[]> {
  await mkdir(dir, { recursive: true });
  const written: string[] = [];
  const save = async (name: string, img: { data: Uint8Array; width: number; height: number }, c: ComponentBbox) => {
    const crop = cropRegion(
      { width: img.width, height: img.height, data: img.data },
      c.left, c.top, c.width, c.height,
    );
    if (crop.width === 0 || crop.height === 0) return;
    const png = new PNG({ width: crop.width, height: crop.height });
    png.data = Buffer.from(crop.data.buffer, crop.data.byteOffset, crop.data.byteLength);
    const path = join(dir, name);
    await writeFile(path, PNG.sync.write(png));
    written.push(path);
  };
  for (const m of composition.matches) {
    await save(`component-${m.target.index}-target.png`, target, m.target);
    await save(`component-${m.target.index}-current.png`, current, m.current);
  }
  for (const c of composition.missing) {
    await save(`missing-${c.index}-target.png`, target, c);
  }
  for (const c of composition.extra) {
    await save(`extra-${c.index}-current.png`, current, c);
  }
  return written;
}

function printHelp(): void {
  console.log(`Usage: vlmkit build page <target.png> <current.html|current.png> [options]

Multi-component page composition diff. Extracts component bboxes from
the target screenshot and the current render, pairs them spatially, and
reports position/size/fill deltas, missing/extra components, section
ordering, and stacking-gap deltas.

Options:
  --min-area <N>    Min filled pixels per component (default 200)
  --top <N>         Max components per side (default 8)
  --crop <dir>      Write per-component target/current crop pairs
  --out <path.md>   Write the Markdown report to a file
  --json            Emit machine-readable JSON instead of Markdown
  -h, --help        Show this help`);
}

async function main(argv = process.argv.slice(2)) {
  const help = argv.includes("--help") || argv.includes("-h");
  const valueFlags = new Set(["--min-area", "--top", "--crop", "--out"]);
  const positional = argv.filter((arg, i) => !arg.startsWith("-") && !valueFlags.has(argv[i - 1] ?? ""));
  if (help || positional.length < 2) {
    printHelp();
    if (positional.length < 2 && !help) process.exit(1);
    return;
  }
  const flag = (name: string): string | undefined => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  const [targetPath, currentInput] = positional;
  if (!existsSync(targetPath!)) throw new Error(`Target not found: ${targetPath}`);
  if (!existsSync(currentInput!)) throw new Error(`Current not found: ${currentInput}`);

  const options: ComposePageOptions = {
    minArea: flag("--min-area") ? Number(flag("--min-area")) : undefined,
    topN: flag("--top") ? Number(flag("--top")) : undefined,
  };

  const target = await loadPng(targetPath!);
  const current = currentInput!.toLowerCase().endsWith(".png")
    ? await loadPng(currentInput!)
    : await renderHtmlToPng(currentInput!, target.width, target.height);

  const composition = composePageDiff(target, current, options);
  appendRunLedger({
    tool: "build-page",
    source: currentInput!,
    target: targetPath!,
    headline: {
      matched: composition.matches.length,
      missing: composition.missing.length,
      extra: composition.extra.length,
      orderViolations: composition.orderViolations.length,
    },
  });

  const cropDir = flag("--crop");
  let crops: string[] = [];
  if (cropDir) crops = await writeCrops(cropDir, composition, target, current);

  if (argv.includes("--json")) {
    console.log(JSON.stringify({ target: targetPath, current: currentInput, composition, crops }, null, 2));
    return;
  }
  let report = renderPageCompositionMarkdown(composition, targetPath!, currentInput!);
  if (crops.length > 0) {
    report += `\n## Crops (${crops.length})\n\n${crops.map((c) => `- ${c}`).join("\n")}\n`;
  }
  const outPath = flag("--out");
  if (outPath) {
    await writeFile(outPath, report);
    console.log(`Report written to: ${outPath}`);
  } else {
    console.log(report);
  }
}

const isCliEntry = process.env.__VLMKIT_DISPATCHER_LEAF__ === "page-compose"
  || (process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false);
if (isCliEntry) {
  main().catch(handleCliError);
}
