/**
 * MCP tool definitions — JSON-in/out over vlmkit's deterministic gates.
 *
 * Design (from docs/design/mcp-and-agent-expansion.md):
 *   - Reuse the SAME code the CLI calls; no behavior fork.
 *   - Path inputs only (no base64 round-trips); Playwright is dynamic-imported
 *     inside the gate's `run`, so importing this module stays cheap.
 *   - Vision is never asked for coordinates/sizes/colors — these gates are
 *     pixel + DOM math. The tools inherit that guarantee.
 *   - Every result carries the structured report AND a plain-text one-line
 *     verdict, so an MCP client can gate on `failed` without parsing.
 *
 * Most tools are now one `gateTool(gate, { description })` call: the name,
 * input schema, invocation and failure decision are derived from the gate
 * definition, so this file cannot drift from the CLI's view of a gate. What
 * stays hand-written is the `description` — it is a prompt for a model
 * choosing between tools, not a restatement of `gate.summary`. See
 * `gate-tool.ts`.
 *
 * Two tools are not `gateTool` calls, for stated reasons:
 *   - `build_page` is not a gate. It returns a composition diff (an artifact),
 *     has no findings and no verdict.
 *   - `verify_flow` and `check_layout` take their flow / contract INLINE as an
 *     object. The gates take `--flow <path>` / `--contract <path>`, which is
 *     right for a CLI and wrong for an MCP client that would have to write a
 *     temp file to call it. Both still take their verdict line from the gate's
 *     `headline`, so the two surfaces cannot describe one report differently.
 */
import { z } from "zod";
import type { McpTool, McpToolResult } from "./tool-result.ts";
import { toolResult as result } from "./tool-result.ts";
import { gateTool } from "./gate-tool.ts";
import {
  copyGate,
  equivalenceGate,
  handlersGate,
  integrityGate,
  interactionsGate,
  layoutGate,
  verifyFlowGate,
  verifyMarkupGate,
} from "@mizchi/vlmkit-markup/gates/index.ts";

export type { McpTool, McpToolResult };

const verifyMarkupTool = gateTool(verifyMarkupGate, {
  // Published names, kept stable: the gate's repeatable `--target` has always
  // been `targets` here, and `--no-fix-context` has always been `fixContext`.
  aliases: { target: "targets" },
  invert: { "no-fix-context": "fixContext" },
  description:
    "One-shot done-condition verdict for a markup attempt: composition per target viewport (missing/extra/ordering/gap), dynamic gates (breakpoints/scroll/animation/motion), and a rest-pose pixel diff. Returns a machine verdict plus a paste-ready kickback listing every residual with deterministic selector attribution, kind tags, and near-miss/pixel-confirmed flags. Deterministic (pixels + Playwright, no VLM). Use to decide whether a generated/edited page is actually done, and to get the next fix list when it is not.",
});

const checkIntegrityTool = gateTool(integrityGate, {
  description:
    "Reference-free integrity gate for creative/zero-shot markup — no target image or manifest needed. Detects defects that are unambiguous without a reference: JS errors (construction-phase = fatal), empty/degenerate renders, broken images/stylesheets/scripts/fonts, same-layer text collisions, clipped text, collapsed containers, horizontal page overflow, and declared-but-unapplied styling, swept across multiple viewport widths. Deterministic (DOM + pixel math, no VLM). Intentional patterns (hero overlays, ellipsis truncation, positioning anchors) are exempted by tool-side rules and reported in `exempted` — audit the rule, don't re-litigate the finding. A pattern the tool does not recognise as intentional can be accepted per finding via `allow` (syntax `<kind>[@<selector>][@<viewport>];<reason>`); a reason is mandatory, an unknown kind is an error, accepted findings are still listed in `exempted` with that reason, and a rule matching nothing comes back in `unusedAllowRules`. Kinds meaning the page is broken (js-error, degenerate-render, unstyled-page, redirected) cannot be accepted — fix the page. The kickback is a paste-ready, selector-attributed fix list.",
  // The sweep widths, the HAR replay and the storage state are CLI-shaped
  // operational flags; an MCP client points at a page and reads findings.
  omit: ["har", "storage-state"],
});

/**
 * `check_layout` takes its contract INLINE, like `verify_flow` takes its flow.
 * The gate takes `--contract <path>`, which is right for a CLI and wrong for a
 * client that would have to write a temp file to call it — so the schema and
 * invocation stay hand-written here. Everything else still comes from the gate.
 */
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
    // Verdict line from the gate's own `headline`, so this tool and
    // `vlmkit check layout` cannot describe the same report differently.
    const summary = `check_layout: ${layoutGate.headline!(report)}`;
    return result(summary, report, !report.done);
  },
};

const checkInteractionsTool = gateTool(interactionsGate, {
  description:
    "A11y-event state map: discovers interactive elements (roles + implicit semantics), probes their canonical keyboard events (Tab/Enter/Space/arrows/Escape) and records the resulting ARIA transitions, popup patterns (dialog focus-trap, menu focus/arrows/Escape-return), composite navigation (listbox activedescendant, grid roving), and live-region announcements. With `reference`, the reference's inventory becomes the behavioral contract matched by (role, accessible name) — this fails pages that match every screenshot but respond wrongly to keyboard events. Deterministic, no VLM.",
});

const scanHandlersTool = gateTool(handlersGate, {
  description:
    "Enumerates every event callback actually wired on the page (an addEventListener init-script patch + on* attribute/property sweep) into a per-element event surface, cross-checked against the a11y discovery. Headline detection the role-driven map cannot make: the pointer-only control — a visible element with a click/pointer handler but no role, no keyboard handler, and no delegation excuse, operable by mouse but not keyboard/AT. Deterministic, no VLM. (React-style root delegation shows as one listener on the root; per-element granularity is a vanilla/Web-Components property.)",
});

const checkCopyTool = gateTool(copyGate, {
  description:
    "Copy-fidelity gate: an always-on placeholder-text scan (lorem-ipsum/TODO/TBD), plus optional manifest verification (every manifest line must appear in the VISIBLY rendered text, whitespace-normalized, case-sensitive; markdown headings in the manifest are section comments, not required lines) and optional target-image verification (crops every rendered text block's bbox out of the target screenshot into contact sheets for a second reader; the sheets catch a wrong year / missing separator / proper-noun typo that composition pairs happily and no pixel gate sees). Manifest matching sweeps disclosure states (closed <details>, unselected tabs, aria-expanded=false controls) so collapsed copy passes with provenance — do not ship disclosures open just to satisfy this gate. Copy that is not actually user-visible is reported as copy-invisible with a reason class, not as satisfied — do not hide manifest lines to pass. Detection is geometric (2026-07-31 silencing battery): font-size:0 / opacity:0 / transparent color, off-screen positioning (left/top -9999px, fixed off-viewport), text-indent, transform translate/scale(0), clip:rect / clip-path:inset, zero-size overflow boxes, color-on-same-color camouflage, and sr-only text (manifest lines are the user-VISIBLE copy spec; keep assistive-tech-only strings out of the manifest). Deliberate invisibility can be accepted per class via allowInvisible (reasons: zero-size, hidden, transparent, visually-hidden, unreachable, camouflage, unknown); accepted lines are listed with their reason so the suppression stays auditable. Deterministic except optional VLM transcription (not exposed here).",
  // `--vlm` needs an API key and this surface is the keyless one; `--out`
  // and `--no-states` are operator knobs, not things a model should pick.
  omit: ["vlm", "no-states", "storage-state"],
  aliases: { out: "outDir" },
});

const checkEquivalenceTool = gateTool(equivalenceGate, {
  description:
    "Visual-equivalence judge for residual regions: crops each region from both the attempt render (or PNG) and the target into a stacked pair image, and measures the mean per-channel delta deterministically. Keyless mode (this tool) writes the pair images + measured deltas for a SECOND reader to judge — it does not itself decide same/different (that needs a VLM and must not be the author of the pixels). Use as the tie-breaker for residuals that pass/fail a gate but may be visually equivalent (a reflowed line, a sub-pixel metric drift). Region spec: \"x,y,WxH\" or a kickback-shaped \"(x,y) WxH\".",
  // Keyless by construction: without `--vlm` the gate writes pair images and
  // measured deltas for a second reader instead of deciding same/different
  // itself — which it must not, being the author of the pixels.
  omit: ["vlm"],
  // Published names since it shipped; the gate's flags are `--region`/`--out`.
  aliases: { region: "regions", out: "outDir" },
});

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
    // The verdict line comes from the gate's own `headline`, so this tool and
    // `vlmkit verify flow` cannot describe the same report differently.
    const summary = `verify_flow: ${verifyFlowGate.headline!(report)}`;
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
