/**
 * MCP tool definitions — thin JSON-in/out wrappers over vlmkit's
 * deterministic verification gates.
 *
 * Design (from docs/design/mcp-and-agent-expansion.md):
 *   - Reuse the SAME pure functions the CLI calls; no behavior fork.
 *   - Path inputs only (no base64 round-trips); Playwright is
 *     dynamic-imported inside the pure functions, so importing this
 *     module stays cheap.
 *   - Vision is never asked for coordinates/sizes/colors — these gates
 *     are pixel + DOM math. The tools inherit that guarantee.
 *   - Every result carries the structured report AND a plain-text
 *     one-line verdict, so an MCP client can gate on `ok`/`done`
 *     without parsing, and the kickback (with selector attribution /
 *     kind tags / near-miss / pixel-confirmed demotion flags) travels
 *     verbatim as the "what to do next" payload.
 */
import { z } from "zod";

export interface McpToolResult {
  /** Human/agent-readable one-liner + the report, as MCP text content. */
  content: Array<{ type: "text"; text: string }>;
  /** True when the gate failed (verdict NOT ok/done). Surfaced to isError. */
  failed: boolean;
  /** The raw structured report, for tests and structured-content clients. */
  structured: unknown;
}

function result(summary: string, structured: unknown, failed: boolean): McpToolResult {
  return {
    content: [{ type: "text", text: `${summary}\n\n${JSON.stringify(structured, null, 2)}` }],
    failed,
    structured,
  };
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: z.ZodRawShape;
  run: (args: Record<string, unknown>) => Promise<McpToolResult>;
}

// ---------------------------------------------------------------------------
// verify_markup

const verifyMarkupTool: McpTool = {
  name: "verify_markup",
  description:
    "One-shot done-condition verdict for a markup attempt: composition per target viewport (missing/extra/ordering/gap), dynamic gates (breakpoints/scroll/animation/motion), and a rest-pose pixel diff. Returns a machine verdict plus a paste-ready kickback listing every residual with deterministic selector attribution, kind tags, and near-miss/pixel-confirmed flags. Deterministic (pixels + Playwright, no VLM). Use to decide whether a generated/edited page is actually done, and to get the next fix list when it is not.",
  inputSchema: {
    attempt: z.string().describe("Path to the attempt HTML file."),
    targets: z.array(z.string()).min(1).describe("Target screenshot PNG path(s); each defines a render viewport."),
    reference: z.string().optional().describe("Optional reference HTML measured against the same targets to print the calibration floor."),
    fixContext: z.boolean().optional().describe("Attach selector attribution to kickback residuals (default true)."),
  },
  run: async (args) => {
    const { runMarkupVerify } = await import("@mizchi/vlmkit-markup/verify/markup-verify.ts");
    const report = await runMarkupVerify({
      attempt: args.attempt as string,
      targets: args.targets as string[],
      ...(args.reference ? { reference: args.reference as string } : {}),
      ...(args.fixContext !== undefined ? { fixContext: args.fixContext as boolean } : {}),
    });
    const passed = report.targets.filter((t) => t.pass).length;
    const summary = `verify_markup: ${report.done ? "DONE" : "NOT DONE"} (${passed}/${report.targets.length} targets passed, ${report.kickback.length} kickback item(s))`;
    return result(summary, report, !report.done);
  },
};

// ---------------------------------------------------------------------------
// check_interactions

const checkInteractionsTool: McpTool = {
  name: "check_interactions",
  description:
    "A11y-event state map: discovers interactive elements (roles + implicit semantics), probes their canonical keyboard events (Tab/Enter/Space/arrows/Escape) and records the resulting ARIA transitions, popup patterns (dialog focus-trap, menu focus/arrows/Escape-return), composite navigation (listbox activedescendant, grid roving), and live-region announcements. With `reference`, the reference's inventory becomes the behavioral contract matched by (role, accessible name) — this fails pages that match every screenshot but respond wrongly to keyboard events. Deterministic, no VLM.",
  inputSchema: {
    source: z.string().describe("Path or URL of the page to probe."),
    reference: z.string().optional().describe("Optional reference page whose interaction inventory is the behavioral contract."),
    handlers: z.boolean().optional().describe("Also enumerate the wired event-callback surface and cross-check it (pointer-only-control detection + event-vocabulary contract)."),
    maxElements: z.number().optional().describe("Probe cap (default 30; the report says when capped)."),
  },
  run: async (args) => {
    const { buildInteractionMap, deriveInteractionIssues, compareInteractionMaps } = await import(
      "@mizchi/vlmkit-markup/inspect/interaction-map.ts"
    );
    const opts = { source: args.source as string, ...(args.maxElements !== undefined ? { maxElements: args.maxElements as number } : {}) };
    const map = await buildInteractionMap(opts);
    const issues = deriveInteractionIssues(map);
    const out: Record<string, unknown> = { map, issues };
    let suspects = issues.filter((i) => i.severity === "suspect").length;
    if (args.reference) {
      const refMap = await buildInteractionMap({ source: args.reference as string, ...(args.maxElements !== undefined ? { maxElements: args.maxElements as number } : {}) });
      const comparison = compareInteractionMaps(refMap, map);
      out.comparison = comparison;
      suspects += comparison.missing.length + comparison.mismatches.filter((m) => m.severity === "suspect").length;
    }
    if (args.handlers) {
      const { buildHandlerSurface, deriveHandlerIssues, compareHandlerSurfaces } = await import(
        "@mizchi/vlmkit-markup/inspect/handler-map.ts"
      );
      const surface = await buildHandlerSurface({ source: args.source as string });
      const handlerIssues = deriveHandlerIssues(surface);
      out.handlerSurface = surface;
      out.handlerIssues = handlerIssues;
      suspects += handlerIssues.filter((i) => i.severity === "suspect").length;
      if (args.reference) {
        const refSurface = await buildHandlerSurface({ source: args.reference as string });
        out.surfaceMismatches = compareHandlerSurfaces(refSurface, surface);
      }
    }
    const summary = `check_interactions: ${suspects === 0 ? "ok" : `${suspects} suspect issue(s)`} (${map.elements.length} interactive element(s)${map.capped > 0 ? `, +${map.capped} beyond cap` : ""})`;
    return result(summary, out, suspects > 0);
  },
};

// ---------------------------------------------------------------------------
// scan_handlers

const scanHandlersTool: McpTool = {
  name: "scan_handlers",
  description:
    "Enumerates every event callback actually wired on the page (an addEventListener init-script patch + on* attribute/property sweep) into a per-element event surface, cross-checked against the a11y discovery. Headline detection the role-driven map cannot make: the pointer-only control — a visible element with a click/pointer handler but no role, no keyboard handler, and no delegation excuse, operable by mouse but not keyboard/AT. Deterministic, no VLM. (React-style root delegation shows as one listener on the root; per-element granularity is a vanilla/Web-Components property.)",
  inputSchema: {
    source: z.string().describe("Path or URL of the page to scan."),
  },
  run: async (args) => {
    const { buildHandlerSurface, deriveHandlerIssues } = await import("@mizchi/vlmkit-markup/inspect/handler-map.ts");
    const surface = await buildHandlerSurface({ source: args.source as string });
    const issues = deriveHandlerIssues(surface);
    const suspects = issues.filter((i) => i.severity === "suspect").length;
    const summary = `scan_handlers: ${suspects === 0 ? "ok" : `${suspects} suspect issue(s)`} (${surface.totalRegistrations} registration(s) across ${surface.elements.length} element(s))`;
    return result(summary, { surface, issues }, suspects > 0);
  },
};

// ---------------------------------------------------------------------------
// check_copy

const checkCopyTool: McpTool = {
  name: "check_copy",
  description:
    "Copy-fidelity gate: an always-on placeholder-text scan (lorem-ipsum/TODO/TBD), plus optional manifest verification (every manifest line must appear in the rendered text, whitespace-normalized, case-sensitive) and optional target-image verification (crops every rendered text block's bbox out of the target screenshot into contact sheets for a second reader; the sheets catch a wrong year / missing separator / proper-noun typo that composition pairs happily and no pixel gate sees). Deterministic except optional VLM transcription (not exposed here).",
  inputSchema: {
    source: z.string().describe("Path or URL of the page."),
    manifest: z.string().optional().describe("Path to a copy manifest (one required line per row)."),
    target: z.string().optional().describe("Target screenshot PNG to crop text-block bboxes from for review."),
    outDir: z.string().optional().describe("Where contact sheets + worksheet are written (target mode)."),
  },
  run: async (args) => {
    const { runCopyCheck } = await import("@mizchi/vlmkit-markup/inspect/copy-check.ts");
    const report = await runCopyCheck({
      source: args.source as string,
      ...(args.manifest ? { manifestPath: args.manifest as string } : {}),
      ...(args.target ? { targetPath: args.target as string } : {}),
      ...(args.outDir ? { outDir: args.outDir as string } : {}),
    });
    const suspects = report.issues.filter((i) => i.severity === "suspect").length;
    const summary = `check_copy: ${suspects === 0 ? "ok" : `${suspects} suspect issue(s)`} (missing ${report.missingLines.length}, placeholders ${report.placeholders.length}${report.imageReview ? `, ${report.imageReview.sheetFiles.length} review sheet(s)` : ""})`;
    return result(summary, report, suspects > 0);
  },
};

export const TOOLS: McpTool[] = [verifyMarkupTool, checkInteractionsTool, scanHandlersTool, checkCopyTool];
