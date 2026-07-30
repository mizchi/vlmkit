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

// ---------------------------------------------------------------------------
// build_page

const buildPageTool: McpTool = {
  name: "build_page",
  description:
    "Composition diff between a target screenshot and a current attempt (HTML rendered at the target's viewport, or another PNG): matched components, missing, extra, ordering violations, stacking-gap deltas. This is the raw composition signal verify_markup runs internally — use it mid-loop when you only need 'what components are missing/misplaced' without the full done-condition verdict and dynamic gates. Deterministic pixel + connected-component math.",
  inputSchema: {
    target: z.string().describe("Target screenshot PNG path."),
    current: z.string().describe("Current attempt: an HTML file (rendered at the target viewport) or a PNG."),
  },
  run: async (args) => {
    const { loadPng, renderHtmlToPng, composePageDiff } = await import("@mizchi/vlmkit-markup/component/page-compose.ts");
    const target = await loadPng(args.target as string);
    const currentPath = args.current as string;
    const current = /\.png$/i.test(currentPath)
      ? await loadPng(currentPath)
      : await renderHtmlToPng(currentPath, target.width, target.height);
    const composition = composePageDiff(target, current, {});
    const residuals = composition.missing.length + composition.extra.length + composition.orderViolations.length;
    const summary = `build_page: matched ${composition.matches.length}, missing ${composition.missing.length}, extra ${composition.extra.length}, ordering ${composition.orderViolations.length}, gaps ${composition.gapDeltas.length}`;
    return result(summary, composition, residuals > 0);
  },
};

// ---------------------------------------------------------------------------
// check_equivalence (keyless: measured delta + pair sheets for a second reader)

const checkEquivalenceTool: McpTool = {
  name: "check_equivalence",
  description:
    "Visual-equivalence judge for residual regions: crops each region from both the attempt render (or PNG) and the target into a stacked pair image, and measures the mean per-channel delta deterministically. Keyless mode (this tool) writes the pair images + measured deltas for a SECOND reader to judge — it does not itself decide same/different (that needs a VLM and must not be the author of the pixels). Use as the tie-breaker for residuals that pass/fail a gate but may be visually equivalent (a reflowed line, a sub-pixel metric drift). Region spec: \"x,y,WxH\" or a kickback-shaped \"(x,y) WxH\".",
  inputSchema: {
    source: z.string().describe("Attempt HTML or PNG."),
    target: z.string().describe("Target screenshot PNG."),
    regions: z.array(z.string()).min(1).describe("Region specs: \"x,y,WxH\" or \"(x,y) WxH\" (repeatable)."),
    outDir: z.string().optional().describe("Where pair images are written."),
  },
  run: async (args) => {
    const { runRegionJudge, parseRegionSpec } = await import("@mizchi/vlmkit-markup/inspect/region-judge.ts");
    const regions = (args.regions as string[]).map(parseRegionSpec);
    const report = await runRegionJudge({
      source: args.source as string,
      targetPath: args.target as string,
      regions,
      ...(args.outDir ? { outDir: args.outDir as string } : {}),
    });
    const summary = `check_equivalence: ${report.verdicts.length} region(s) measured (max delta ${Math.max(...report.verdicts.map((v) => v.measuredDelta)).toFixed(2)}); pair images written for a second reader`;
    // Keyless: advisory only — never hard-fails (a human/VLM makes the call).
    return result(summary, report, false);
  },
};

// ---------------------------------------------------------------------------
// check_integrity (reference-free defect gate)

const checkIntegrityTool: McpTool = {
  name: "check_integrity",
  description:
    "Reference-free integrity gate for creative/zero-shot markup — no target image or manifest needed. Detects defects that are unambiguous without a reference: JS errors (construction-phase = fatal), empty/degenerate renders, broken images/stylesheets/scripts/fonts, same-layer text collisions, clipped text, collapsed containers, horizontal page overflow, and declared-but-unapplied styling, swept across multiple viewport widths. Deterministic (DOM + pixel math, no VLM). Intentional patterns (hero overlays, ellipsis truncation, positioning anchors) are exempted by tool-side rules and reported in `exempted` — audit the rule, don't re-litigate the finding. The kickback is a paste-ready, selector-attributed fix list.",
  inputSchema: {
    source: z.string().describe("Path or URL of the page to check."),
    viewports: z.array(z.number()).optional().describe("Sweep widths (default 1280, 768, 375)."),
    maxFindings: z.number().optional().describe("Per-class report cap (default 12)."),
  },
  run: async (args) => {
    const { runIntegrityCheck } = await import("@mizchi/vlmkit-markup/inspect/integrity-check.ts");
    const heights: Record<number, number> = { 1280: 800, 768: 900, 375: 700 };
    const report = await runIntegrityCheck({
      source: args.source as string,
      ...(args.viewports
        ? { viewports: (args.viewports as number[]).map((w) => ({ width: w, height: heights[w] ?? 800 })) }
        : {}),
      ...(args.maxFindings !== undefined ? { maxFindings: args.maxFindings as number } : {}),
    });
    const fails = report.findings.filter((f) => f.severity === "fail").length;
    const warns = report.findings.length - fails;
    const summary = `check_integrity: ${report.verdict === "clean" ? "CLEAN" : "DEFECTS"} (${fails} fail, ${warns} warn, ${report.exempted.length} exempted)`;
    return result(summary, report, report.verdict !== "clean");
  },
};

// ---------------------------------------------------------------------------
// check_layout (structural requirements as a machine-checkable contract)

const checkLayoutTool: McpTool = {
  name: "check_layout",
  description:
    "Layout contract: verifies a brief's STRUCTURAL requirements deterministically per viewport — element widths (±tolerance), matches per visual row (4-across at 1280 / 2x2 at 768 / stacked at 375), full-width collapse, stacking order (A above B), visibility, and counts. Turns 'the sidebar is 260px on desktop and collapses above the main column on tablet' into a machine-checkable spec the generation loop can run every round. Pure DOM math, no VLM. Complements check_integrity (defects) — this checks conformance to stated structure.",
  inputSchema: {
    source: z.string().describe("Path or URL of the page."),
    contract: z.object({
      rules: z.array(z.object({
        selector: z.string(),
        at: z.number().describe("Viewport width this rule is checked at."),
        width: z.number().optional(),
        tolerance: z.number().optional(),
        minWidth: z.number().optional(),
        maxWidth: z.number().optional(),
        perRow: z.number().optional().describe("Modal number of matches per visual row."),
        fullWidth: z.boolean().optional(),
        above: z.string().optional().describe("Selector whose matches must all start below this rule's matches."),
        count: z.number().optional(),
        visible: z.boolean().optional(),
      })).min(1),
    }).describe("The layout contract."),
  },
  run: async (args) => {
    const { runLayoutVerify } = await import("@mizchi/vlmkit-markup/inspect/layout-contract.ts");
    const report = await runLayoutVerify({ source: args.source as string, contract: args.contract as never });
    const summary = `check_layout: ${report.done ? "SATISFIED" : "VIOLATED"} (${report.passed}/${report.total} rules)`;
    return result(summary, report, !report.done);
  },
};

const verifyFlowTool: McpTool = {
  name: "verify_flow",
  description:
    "Verified scripted browser flow: runs a given list of steps (each an action + deterministic post-condition assertions on the live DOM) and FAILS at the first unmet post-condition. Unlike LLM-per-step browser agents, 'it did something' is not success — 'the asserted state actually holds' is. No LLM (the flow is provided; a planner may emit it later, the verification is deterministic). Assertions: attr / visible / hidden / focused / text / count.",
  inputSchema: {
    source: z.string().describe("Page HTML path or URL."),
    flow: z.object({
      viewport: z.object({ width: z.number(), height: z.number() }).optional(),
      steps: z.array(z.object({
        label: z.string().optional(),
        do: z.record(z.unknown()).describe("Action: {action:'click'|'focus'|'hover', selector} | {action:'press', key, selector?} | {action:'fill'|'type', selector, value|text} | {action:'wait', ms}"),
        expect: z.array(z.record(z.unknown())).optional().describe("Post-conditions: {assert:'attr', selector, name, equals} | {assert:'visible'|'hidden'|'focused', selector} | {assert:'text', selector, contains} | {assert:'count', selector, equals}"),
      })),
    }).describe("The flow to run."),
  },
  run: async (args) => {
    const { runFlowVerify } = await import("@mizchi/vlmkit-markup/inspect/flow-verify.ts");
    const report = await runFlowVerify({ source: args.source as string, flow: args.flow as never });
    const summary = `verify_flow: ${report.done ? "DONE" : "FAILED"} (${report.passed}/${report.total} steps)`;
    return result(summary, report, !report.done);
  },
};

export const TOOLS: McpTool[] = [
  verifyFlowTool,
  verifyMarkupTool,
  checkIntegrityTool,
  checkLayoutTool,
  checkInteractionsTool,
  scanHandlersTool,
  checkCopyTool,
  buildPageTool,
  checkEquivalenceTool,
];
