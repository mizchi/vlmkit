/**
 * `check copy` as a gate definition. Measurement code in
 * `../inspect/copy-check.ts` is untouched.
 *
 * The VLM client construction moved from `main` into `run`: `parse` stays
 * synchronous and side-effect-free, so `--vlm` without `--target` fails as a
 * usage error before any API key is resolved. The `--allow-invisible` reason
 * classes stay as they are — like integrity's `--allow`, that flag exempts a
 * *reason* and reports each accepted line, which rule settings do not replace.
 */

import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { readEnv } from "@mizchi/vlmkit-core/project-config.ts";
import {
  type CopyCheckOptions,
  type CopyCheckReport,
  INVISIBLE_REASONS,
  type InvisibleReason,
  formatCopyCheckReport,
  runCopyCheck,
} from "../inspect/copy-check.ts";
import { TRANSCRIBE_PROMPT } from "../inspect/copy-target.ts";
import { firstPositional, vlmFlag } from "./arg-helpers.ts";

/** Options plus the unresolved `--vlm` request; `run` turns it into a reader. */
export interface CopyGateOptions extends CopyCheckOptions {
  vlm?: string | true;
}

const COPY_VALUE_FLAGS = ["--manifest", "--target", "--out", "--allow-invisible"];

export const copyGate = defineGate<CopyCheckReport, CopyGateOptions>({
  id: "check.copy",
  command: ["check", "copy"],
  title: "Copy fidelity",
  summary:
    "Copy fidelity: placeholder scan + --manifest verification + --target image check (VLM or agent-vision sheets)",
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

Reason classes: ${INVISIBLE_REASONS.join(", ")}. When an invisibility is
deliberate, accept that class with --allow-invisible; each accepted line is
listed with its reason so the suppression stays auditable.`,
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
    { id: "copy-image-mismatch", title: "Rendered copy differs from the target image", severity: "suspect" },
    { id: "redirected", title: "Requested URL redirected elsewhere", severity: "suspect" },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to check", positional: 0, required: true },
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
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check copy <html-or-url>", COPY_VALUE_FLAGS);
    const manifestPath = readFlag(argv, "manifest");
    const targetPath = readFlag(argv, "target");
    const outDir = readFlag(argv, "out");
    const storageState = readFlag(argv, "storage-state");
    const vlm = vlmFlag(argv);
    if (vlm !== undefined && !targetPath) throw new UsageError("--vlm requires --target <png>");
    const rawAllow = readFlag(argv, "allow-invisible");
    let allowInvisible: InvisibleReason[] | undefined;
    if (rawAllow !== undefined) {
      const classes = rawAllow.split(",").map((s) => s.trim()).filter(Boolean);
      const bad = classes.filter((c) => !(INVISIBLE_REASONS as readonly string[]).includes(c));
      if (classes.length === 0 || bad.length > 0) {
        throw new UsageError(
          `--allow-invisible: unknown class(es) ${bad.map((b) => `"${b}"`).join(", ") || "(none given)"}.`
          + ` Valid: ${INVISIBLE_REASONS.join(", ")}`,
        );
      }
      allowInvisible = classes as InvisibleReason[];
    }
    return {
      source,
      exploreStates: !argv.includes("--no-states"),
      ...(manifestPath ? { manifestPath } : {}),
      ...(targetPath ? { targetPath } : {}),
      ...(outDir ? { outDir } : {}),
      ...(storageState ? { storageState } : {}),
      ...(allowInvisible ? { allowInvisible } : {}),
      ...(vlm !== undefined ? { vlm } : {}),
    };
  },
  run: async ({ vlm, ...options }) => {
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
