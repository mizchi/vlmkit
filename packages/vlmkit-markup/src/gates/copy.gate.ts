/**
 * `check copy` as a gate definition. Measurement code in
 * `../inspect/copy-check.ts` is untouched.
 *
 * The VLM client construction moved from `main` into `run`: `parse` stays
 * synchronous and side-effect-free, so `--vlm` without `--target` fails as a
 * usage error before any API key is resolved. The `--allow-invisible` reason
 * classes stay as they are — like integrity's `--allow`, that flag exempts a
 * *reason* and reports each accepted line, which rule settings do not replace.
 *
 * `--elements` selects element-rect mode (`../inspect/copy-image.ts`, vlmkit#118): text and
 * bboxes come from the renderer instead of the DOM, so canvas/WebGPU and native UIs can be
 * checked at all. It is mutually exclusive with a page source, for the reason image-mode
 * `check integrity` gives: the two paths evaluate different rule sets, so a run that quietly
 * picked one would make its verdict ambiguous.
 */

import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { readEnv } from "@mizchi/vlmkit-core/project-config.ts";
import {
  type CopyCheckOptions,
  type CopyCheckReport,
  INVISIBLE_REASONS,
  type InvisibleReason,
  formatCopyCheckReport,
  runCopyCheck,
} from "../inspect/copy-check.ts";
import {
  COPY_IMAGE_SKIPPED_RULES,
  type CopyImageOptions,
  runImageCopyCheck,
} from "../inspect/copy-image.ts";
import { TRANSCRIBE_PROMPT } from "../inspect/copy-target.ts";
import {
  firstPositional,
  firstPositionalOrUndefined,
  vlmFlag,
  withoutOptionalValue,
} from "@mizchi/vlmkit-core/plugin/args.ts";

/** Options plus the unresolved `--vlm` request; `run` turns it into a reader. */
export interface CopyGateOptions extends CopyCheckOptions {
  vlm?: string | true;
  /** Set by `--elements`: check the renderer's text instead of a page's DOM. */
  imageMode?: CopyImageOptions;
}

const COPY_VALUE_FLAGS = ["--manifest", "--target", "--out", "--allow-invisible"];

/**
 * Flags that promise a check element-rect mode does not perform.
 *
 * Rejected rather than ignored: `--target`'s whole output is crops of a reference screenshot
 * reviewed by a VLM or an agent, and `--storage-state` only means anything to a browser
 * navigation. Accepting either would let a caller believe a check ran that did not — the
 * failure mode this feature's coverage reporting exists to prevent, so silently swallowing
 * the flags would undo it at the front door.
 */
const NOT_IN_ELEMENTS_MODE: { flag: string; because: string }[] = [
  {
    flag: "--target",
    because: "it crops a reference screenshot per rendered text block and reviews the crops"
      + " (VLM or contact sheets); element-rect mode has no such comparison wired",
  },
  { flag: "--vlm", because: "it only drives --target's transcription" },
  { flag: "--storage-state", because: "nothing is navigated, so there is no session to restore" },
  { flag: "--out", because: "no sheets or worksheet are written" },
  // Same reasoning as --storage-state, and the same reason they are rejected
  // rather than ignored: element-rect mode reads a JSON file, so there is no
  // navigation to time out, no load milestone to wait for and no network to
  // replay. Accepting them would let a caller believe `--timeout 120000` bought
  // them something on a run that never opened a browser.
  { flag: "--timeout", because: "no page is navigated, so there is no navigation to time out" },
  { flag: "--wait-until", because: "no page is navigated, so there is no load milestone to wait for" },
  { flag: "--har", because: "no requests are made, so there is nothing to replay from a recording" },
];

/**
 * `--allow-invisible a,b` → validated reason classes, or `undefined` when absent.
 *
 * Shared by both modes: element-rect mode can produce `zero-size` and `unpainted` matches,
 * and a project that has decided one of those is deliberate needs the same suppression the
 * DOM path offers. Validating here keeps a typo a millisecond-fast usage error.
 */
function allowInvisibleFrom(argv: readonly string[]): InvisibleReason[] | undefined {
  const raw = readFlag(argv, "allow-invisible");
  if (raw === undefined) return undefined;
  const classes = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const bad = classes.filter((c) => !(INVISIBLE_REASONS as readonly string[]).includes(c));
  if (classes.length === 0 || bad.length > 0) {
    throw new UsageError(
      `--allow-invisible: unknown class(es) ${bad.map((b) => `"${b}"`).join(", ") || "(none given)"}.`
      + ` Valid: ${INVISIBLE_REASONS.join(", ")}`,
    );
  }
  return classes as InvisibleReason[];
}

export const copyGate = defineGate<CopyCheckReport, CopyGateOptions>({
  id: "check.copy",
  command: ["check", "copy"],
  title: "Copy fidelity",
  summary:
    "Copy fidelity: placeholder scan + --manifest verification + --target image check (VLM or agent-vision sheets); --elements checks renderer text instead of a DOM (canvas/WebGPU)",
  category: "correctness",
  usage: `Copy fidelity gate: placeholder-text scan (always on), optional manifest
verification, and optional target-image verification (crops every
rendered text block's bbox out of the target screenshot; a VLM
transcribes them with --vlm, or contact sheets are written for the
agent's own vision without an API key).

Manifest matching sweeps disclosure states by default: closed <details>
are opened and unselected [role=tab] / [aria-expanded=false] controls
are clicked, so copy inside collapsed panels passes (with provenance)
instead of reading as missing — no need to ship disclosures open just
to satisfy the gate.

Manifest lines must appear in the VISIBLY rendered text: copy a user
cannot actually see (font-size:0, opacity:0, transparent color,
off-screen positioning, text-indent, transforms, clip/clip-path,
zero-size overflow boxes, same-color camouflage, sr-only) is reported
as copy-invisible with a reason class, not as satisfied. The manifest
is the user-visible copy spec — keep assistive-tech-only strings out
of it. Markdown headings in the manifest ("# Section") are organizing
comments, not required lines.

Reason classes:
  ${INVISIBLE_REASONS.join(", ")}
When an invisibility is deliberate, accept that class with --allow-invisible;
each accepted line is listed with its reason so the suppression stays
auditable. (unpainted is --elements mode only, see below.)

--elements <json> checks the RENDERER's text instead of a DOM, for canvas /
WebGPU / native UIs where the DOM holds one <canvas> and every text rule
finds nothing. Each row carries {path, tag, top, left, width, height, text}
plus optional {textMeasured, clip} — the same schema as
"check integrity --elements". No browser is started. Mutually exclusive with
a page source. With --image <frame.png> each text bbox is also checked for
ink, so a string the renderer reports but never painted (missing font,
alpha 0, skipped draw call) reads as copy-invisible (reason: unpainted)
instead of passing.

${COPY_IMAGE_SKIPPED_RULES.length} rule(s) cannot run in element-rect mode and
copy-invisible covers 2 of its 7 reason classes there; every gap is printed
under "Coverage" next to the verdict, because a clean result is worth what it
rules out.`,
  rules: [
    {
      id: "placeholder-text",
      title: "Lorem ipsum / TODO / placeholder copy still in the page",
      severity: "suspect",
    },
    { id: "copy-missing", title: "Manifest line absent from the rendered text", severity: "suspect" },
    {
      id: "copy-invisible",
      title: "Manifest line present in the DOM but not visible",
      severity: "suspect",
      docs: "Accept a specific reason class with --allow-invisible rather than disabling the rule.",
    },
    {
      id: "copy-truncated",
      title: "Drawn text runs past its clip rect, so it renders cut off",
      severity: "suspect",
      docs: "--elements mode only: needs a text extent the renderer measured (`textMeasured`) and a"
        + " `clip` rect. In the DOM, check integrity's text-clipped covers this.",
    },
    { id: "copy-image-mismatch", title: "Rendered copy differs from the target image", severity: "suspect" },
    { id: "redirected", title: "Requested URL redirected elsewhere", severity: "suspect" },
  ],
  inputs: [
    {
      name: "source",
      placeholder: "html-or-url",
      kind: "path-or-url",
      description: "Page to check (omit when using --elements)",
      positional: 0,
      // No `required: true`, deliberately: --elements supplies the text instead. Keep it off
      // or the MCP schema demands a page that the gate then rejects as mutually exclusive,
      // which is how image-mode integrity ended up CLI-only (commit e9a1bec).
    },
    {
      name: "elements",
      placeholder: "elements.json",
      kind: "path",
      description: "Text + rects from the renderer instead of a DOM — canvas/WebGPU, native, Flutter",
    },
    {
      name: "image",
      placeholder: "frame.png",
      kind: "path",
      description: "Frame PNG for --elements mode; enables the ink check (text reported but never painted)",
    },
    { name: "manifest", placeholder: "file", kind: "path", description: "Copy manifest (plain text / markdown; one required line per row)" },
    {
      name: "allow-invisible",
      kind: "string-list",
      description: `Reason classes to accept as satisfied (${INVISIBLE_REASONS.join(", ")})`,
    },
    { name: "target", placeholder: "png", kind: "path", description: "Target screenshot to verify copy against (bbox-cropped per text block)" },
    { name: "out", placeholder: "dir", kind: "path", description: "Sheet/worksheet output dir", defaultDescription: ".vlmkit-copy-review next to the source" },
    { name: "vlm", placeholder: "model", kind: "string", description: "Transcribe crops with a VLM (optional model id); requires an API key" },
    { name: "no-states", kind: "boolean", description: "Skip the disclosure-state sweep (default-state text only)" },
    { name: "storage-state", placeholder: "file", kind: "path", description: "Playwright storage state for pages behind a login" },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    // `--vlm` is optionally-valued, so its model id cannot be excluded via
    // COPY_VALUE_FLAGS — see `withoutOptionalValue`.
    const positionalArgv = withoutOptionalValue(argv, "vlm");
    const elements = readFlag(argv, "elements");
    const image = readFlag(argv, "image");
    if (elements) {
      if (firstPositionalOrUndefined(positionalArgv, COPY_VALUE_FLAGS)) {
        throw new UsageError(
          "check copy takes either a page source or --elements, not both. The two modes "
          + "evaluate different rule sets, so a combined run's verdict would be ambiguous.",
        );
      }
      for (const { flag, because } of NOT_IN_ELEMENTS_MODE) {
        if (argv.includes(flag)) {
          throw new UsageError(
            `${flag} does not apply with --elements: ${because}.`
            + " Drop it rather than have the run imply a check it did not perform.",
          );
        }
      }
      const elementsManifest = readFlag(argv, "manifest");
      const elementsAllow = allowInvisibleFrom(argv);
      return {
        source: image ?? elements,
        imageMode: {
          elementsPath: elements,
          ...(image ? { imagePath: image } : {}),
          ...(elementsManifest ? { manifestPath: elementsManifest } : {}),
          ...(elementsAllow ? { allowInvisible: elementsAllow } : {}),
        },
      };
    }
    if (image) {
      throw new UsageError("--image needs --elements: a PNG alone carries no text to check.");
    }
    const source = firstPositional(
      positionalArgv,
      "vlmkit check copy <html-or-url> | --elements <elements.json> [--image <frame.png>]",
      COPY_VALUE_FLAGS,
    );
    const manifestPath = readFlag(argv, "manifest");
    const targetPath = readFlag(argv, "target");
    const outDir = readFlag(argv, "out");
    const storageState = readFlag(argv, "storage-state");
    const vlm = vlmFlag(argv);
    if (vlm !== undefined && !targetPath) throw new UsageError("--vlm requires --target <png>");
    const allowInvisible = allowInvisibleFrom(argv);
    return {
      source,
      exploreStates: !argv.includes("--no-states"),
      ...(manifestPath ? { manifestPath } : {}),
      ...(targetPath ? { targetPath } : {}),
      ...(outDir ? { outDir } : {}),
      ...(storageState ? { storageState } : {}),
      ...(allowInvisible ? { allowInvisible } : {}),
      ...(vlm !== undefined ? { vlm } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: async ({ vlm, imageMode, ...options }) => {
    // Element-rect mode never starts a browser, which is the point for a caller whose UI is
    // a canvas: there is nothing for Playwright to read.
    if (imageMode) return runImageCopyCheck(imageMode);
    if (vlm === undefined) return runCopyCheck(options);
    const { createVlmClient, resolveModel } = await import("@mizchi/vlmkit-ai/vlm-client.ts");
    const modelId = vlm === true ? (readEnv("VLM_MODEL") ?? "bytedance/ui-tars-1.5-7b") : vlm;
    const client = await createVlmClient(await resolveModel(modelId));
    return runCopyCheck({
      ...options,
      readTargetText: async (cropPng: Buffer) =>
        (await client!.analyzeImage(cropPng.toString("base64"), TRANSCRIBE_PROMPT, { maxTokens: 256 })).content,
    });
  },
  findings: (report): Finding[] =>
    report.issues.map((issue) => ({
      rule: issue.kind,
      severity: issue.severity,
      message: issue.message,
    })),
  format: formatCopyCheckReport,
  // runCopyCheck appends its own entry, with a richer headline than the
  // runner could reconstruct from the report alone.
  ledger: () => null,
});
