/**
 * `check story` — VRT scoped to one mounted component.
 *
 * A gate rather than a `diff *` command, on the line the design doc draws:
 * `diff *` compares two things a caller nominates and hands back artifacts,
 * while a gate checks something against a *declared expectation* and returns a
 * verdict. An approved baseline is a declared expectation, and the fix loop this
 * exists for — run, read the diff, edit, run again — wants exactly what the gate
 * runner already owns: a pass/fail, `--json`, `--advisory`, tunable rules, a
 * ledger entry, and `vlmkit.gates.json` batching so a project can list the
 * stories it cares about once.
 *
 * The rule table is where the interesting judgment sits. `mount-failed` is a
 * separate rule from `story-drift` because the two mean opposite things: drift is
 * the finding you asked for, while a rejected `window.mount` means nothing was
 * measured at all. Collapsing them would let a typo'd story id read as a passing
 * component.
 */

import { readFlag, readInt, readNumber, readPositionals } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import {
  type StoryVrtOptions,
  type StoryVrtReport,
  formatStoryVrtReport,
  runStoryVrt,
} from "../component/story-vrt.ts";

const VALUE_FLAGS = ["--gallery", "--props", "--viewport", "--threshold", "--out", "--root", "--settle"];

/** Default threshold. Component-scoped shots are small, so a stray pixel is a larger ratio. */
const DEFAULT_THRESHOLD = 0.005;

export const storyGate = defineGate<StoryVrtReport, StoryVrtOptions>({
  id: "check.story",
  command: ["check", "story"],
  title: "Component story VRT",
  summary: "Mount one component story and diff only that component against its approved baseline",
  category: "design-system",
  usage: `Mounts a story in your Playwright component-testing gallery and
screenshots ONLY the mounted component, then compares it to an approved
baseline in .vlmkit/stories/.

Why: a full-page diff is the wrong instrument for fixing one component. It is
large, it cascades (nudge a header and every row below reports as changed), and
the part you are working on is buried in the part you are not. A story-scoped
diff is small enough to read at a glance and to hand to a model.

This drives the gallery's page-side contract directly —

  window.mount({ story, props })    // renders into #root, rejects on failure
  window.unmount()

— via page.evaluate, the same way Playwright's own \`mount\` fixture does. So it
needs no spec files, no config dialect, and no particular Playwright version
(the fixture itself is 1.62+; this is not). It does require those two functions:
a page that merely renders one component per URL is not enough. Storybook exposes
no window.mount and needs a shim.

First run writes the baseline and reports new-baseline rather than passing — a
gate that accepts whatever it first sees cannot fail on the run that matters.
Approve an intended change with --update-baseline.

Baselines are keyed on the story id AS WRITTEN. The gallery owns id resolution
and the contract gives no way to ask it what an id resolved to, so
"components/Button/Primary" and the equally valid suffix "Button/Primary" get
separate baselines. Pick one spelling per story and keep it — putting the list
in vlmkit.gates.json is the durable way to do that.`,
  rules: [
    {
      id: "story-drift",
      title: "Story renders differently from its approved baseline",
      severity: "suspect",
      docs: "Raise --threshold if your renderer is not pixel-stable; --update-baseline to accept the new render.",
    },
    {
      id: "mount-failed",
      title: "window.mount rejected, or rendered nothing",
      severity: "suspect",
      docs:
        "Nothing was measured — an unknown story id, a render throw, or a gallery that does not"
        + " implement the contract. Never downgrade this to reach a green run: it would let a"
        + " typo'd story id read as a passing component.",
    },
    {
      id: "new-baseline",
      title: "No baseline existed, so one was written",
      severity: "warn",
      docs:
        "Warn rather than info: in CI a missing baseline means the run compared nothing, which is"
        + " worth surfacing. Set to off once you are confident baselines are committed.",
    },
  ],
  inputs: [
    {
      name: "story",
      placeholder: "story-id...",
      kind: "string",
      description: "Story id(s) as your gallery resolves them, e.g. components/Button/Primary",
      positional: 0,
      required: true,
    },
    { name: "gallery", placeholder: "url", kind: "string", description: "Gallery URL (your Playwright baseURL)", required: true },
    { name: "props", placeholder: "json", kind: "string", description: "Serializable props applied to every story listed" },
    { name: "viewport", placeholder: "WxH", kind: "string", description: "Viewport the story mounts in", defaultDescription: "800x600" },
    { name: "threshold", placeholder: "ratio", kind: "number", description: "Diff ratio counted as unchanged", defaultDescription: String(DEFAULT_THRESHOLD) },
    { name: "update-baseline", kind: "boolean", description: "Write the current render as the baseline instead of comparing" },
    { name: "root", placeholder: "selector", kind: "string", description: "Element the gallery renders into", defaultDescription: "#root" },
    { name: "settle", placeholder: "ms", kind: "number", description: "Wait after mount resolves, for entry transitions", defaultDescription: "0" },
    { name: "out", placeholder: "dir", kind: "path", description: "Baseline / artifact directory", defaultDescription: ".vlmkit/stories" },
  ],
  parse: (argv) => {
    const stories = readPositionals(argv, VALUE_FLAGS);
    if (stories.length === 0) {
      throw new UsageError(
        "missing required argument. Usage: vlmkit check story <story-id...> --gallery <url>",
      );
    }
    const gallery = readFlag(argv, "gallery");
    if (!gallery) {
      throw new UsageError(
        "--gallery <url> is required — the gallery page your Playwright config sets as baseURL",
      );
    }
    const rawProps = readFlag(argv, "props");
    let props: Record<string, unknown> | undefined;
    if (rawProps !== undefined) {
      try {
        const parsed = JSON.parse(rawProps) as unknown;
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("not a JSON object");
        }
        props = parsed as Record<string, unknown>;
      } catch (e) {
        throw new UsageError(
          `--props must be a JSON object (${e instanceof Error ? e.message : String(e)}).`
          + ` The gallery contract requires plain serializable data.`,
        );
      }
    }
    const rawViewport = readFlag(argv, "viewport");
    let viewport = { width: 800, height: 600 };
    if (rawViewport !== undefined) {
      const match = /^(\d+)x(\d+)$/.exec(rawViewport.trim());
      if (!match) throw new UsageError(`--viewport expects <width>x<height>, got ${JSON.stringify(rawViewport)}`);
      viewport = { width: Number(match[1]), height: Number(match[2]) };
    }
    const outputDir = readFlag(argv, "out");
    return {
      gallery,
      stories,
      ...(props ? { props } : {}),
      viewport,
      threshold: readNumber(argv, "threshold", { min: 0, max: 1 }) ?? DEFAULT_THRESHOLD,
      updateBaseline: argv.includes("--update-baseline"),
      ...(outputDir ? { outputDir } : {}),
      root: readFlag(argv, "root") ?? "#root",
      settleMs: readInt(argv, "settle", { min: 0 }) ?? 0,
    };
  },
  run: (options) => runStoryVrt(options),
  findings: (report): Finding[] => {
    const findings: Finding[] = [];
    for (const result of report.results) {
      if (result.outcome === "mount-failed") {
        findings.push({
          rule: "mount-failed",
          severity: "suspect",
          message: `${result.story}: ${result.error}`,
          evidence: { story: result.story },
        });
        continue;
      }
      if (result.outcome === "new-baseline") {
        findings.push({
          rule: "new-baseline",
          severity: "warn",
          message: `${result.story}: no baseline existed, wrote ${result.baselinePath}`,
          evidence: { story: result.story, width: result.width, height: result.height },
        });
        continue;
      }
      if (result.outcome !== "changed") continue;
      findings.push({
        rule: "story-drift",
        severity: "suspect",
        message:
          `${result.story}: ${(result.diffRatio! * 100).toFixed(2)}% of the component changed`
          + ` (${result.diffPixels}/${result.totalPixels}px, threshold ${(report.threshold * 100).toFixed(2)}%)`,
        // Region geometry is what turns a ratio into an edit. Kept structural so
        // an agent reading --json does not parse the prose to locate the change.
        evidence: {
          story: result.story,
          diffRatio: result.diffRatio,
          width: result.width,
          height: result.height,
          heatmap: result.heatmapPath,
          baseline: result.baselinePath,
          current: result.screenshotPath,
          regions: (result.regions ?? []).slice(0, 8).map((r) => ({
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            ...(r.regionType ? { type: r.regionType } : {}),
            ...(r.shift ? { shift: r.shift } : {}),
          })),
        },
      });
    }
    return findings;
  },
  format: formatStoryVrtReport,
  headline: (report) => {
    const changed = report.results.filter((r) => r.outcome === "changed").length;
    const sizes = report.results.filter((r) => r.width !== undefined);
    const dims = sizes.length === 1
      ? `${sizes[0]!.width}x${sizes[0]!.height}`
      : `${report.storyPixels.toLocaleString()}px total`;
    return `${report.results.length} story/stories at ${dims}, ${changed} changed`;
  },
  ledger: (report, options) => ({
    tool: "check-story",
    source: options.gallery,
    target: options.stories.join(","),
    headline: {
      stories: report.results.length,
      changed: report.results.filter((r) => r.outcome === "changed").length,
      mountFailed: report.results.filter((r) => r.outcome === "mount-failed").length,
      storyPixels: report.storyPixels,
      pagePixels: report.pagePixels,
    },
  }),
});
