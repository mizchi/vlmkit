/**
 * `check grounding` as a gate definition. Measurement code in
 * `../inspect/grounding-scan.ts`.
 *
 * Category `behavior`: the question is whether the page responds correctly to
 * input, with "input" meaning the one form no other gate covers — a coordinate
 * derived from a screenshot rather than a selector derived from the DOM.
 *
 * The overlap with its neighbours is worth stating, because all three look like
 * "are the controls usable" and none of them answers this gate's question:
 *
 *   - `check a11y touch` is WCAG 2.5.8: 24 CSS px so a FINGER can hit a control,
 *     with the criteria's own exceptions. This gate is screenshot px after the
 *     model's downscale, which is a different number on the same element and
 *     fails for a different reason (coordinate quantization, not motor control).
 *   - `check interactions` drives the KEYBOARD and reads ARIA transitions back.
 *     A control it passes can still be unclickable at its own centre.
 *   - `scan handlers` finds pointer-only controls from wired listeners, and has
 *     a hit test — for DROP targets only, because that is where a covered target
 *     silently swallowed a gesture. The same failure applies to every click an
 *     agent aims by eye, which is what this generalizes.
 */

import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { readFlag } from "@mizchi/vlmkit-core/arg-reader.ts";
import { RESOLUTION_PRESETS, type ResolutionPreset } from "@mizchi/vlmkit-core/image-resize.ts";
import {
  type GroundingAction,
  type GroundingScanOptions,
  type GroundingScanReport,
  formatGroundingReport,
  runGroundingScan,
} from "../inspect/grounding-scan.ts";
import { firstPositional, optionalInt, viewportFlag } from "@mizchi/vlmkit-core/plugin/args.ts";

/**
 * `--resolution medium` | `--resolution 1024x768`.
 *
 * Both forms, because the two callers want different things: a preset name ties
 * the measurement to what `image-resize.ts` actually sends this toolkit's own
 * VLM, and an explicit `WxH` ties it to whatever cap the harness in front of the
 * agent applies. An unknown preset is a UsageError rather than a silent fallback
 * — falling back would report a clean page at a resolution nobody asked for.
 */
export function parseResolution(
  argv: readonly string[],
): ResolutionPreset | { maxWidth: number; maxHeight: number } | undefined {
  const raw = readFlag(argv, "resolution");
  if (!raw) return undefined;
  if (raw in RESOLUTION_PRESETS) return raw as ResolutionPreset;
  const m = raw.match(/^(\d+)\s*[x×]\s*(\d+)$/i);
  if (!m) {
    throw new UsageError(
      `--resolution ${raw}: expected WxH (e.g. 1024x768) or one of ${Object.keys(RESOLUTION_PRESETS).join(", ")}.`,
    );
  }
  return { maxWidth: Number(m[1]), maxHeight: Number(m[2]) };
}

/**
 * `--at 473,96 --at 447,96` — the points to hit-test, in screenshot px.
 *
 * Repeatable rather than comma-joined: a caller checking two candidate answers
 * for one target wants to see them side by side, and `x,y` already uses the
 * comma.
 */
export function parseAtPoints(argv: readonly string[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--at") continue;
    const raw = argv[i + 1];
    const m = raw?.match(/^(-?\d+)\s*,\s*(-?\d+)$/);
    if (!m) throw new UsageError(`--at ${raw ?? ""}: expected a screenshot-px point as x,y (e.g. --at 473,96).`);
    out.push({ x: Number(m[1]), y: Number(m[2]) });
  }
  return out;
}

/**
 * `--after "click 85,123" --after "wheel 85,150 89"` — the actions to replay
 * before measuring, in order, in screenshot px.
 *
 * Spelled the way a computer-use harness logs them, verb then point, so a
 * caller's own action history pastes in as-is. Repeatable for the same reason
 * `--at` is. A malformed action is a UsageError, never a click at (0,0): a
 * replay that silently did something else would map a screen nobody reached.
 */
export function parseAfterActions(argv: readonly string[]): GroundingAction[] {
  const out: GroundingAction[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== "--after") continue;
    const raw = argv[i + 1] ?? "";
    const m = raw.trim().match(/^(click|move|wheel)[\s:]+(-?\d+)\s*,\s*(-?\d+)(?:[\s:]+(-?\d+))?$/i);
    const kind = m?.[1]?.toLowerCase();
    if (!m || (kind === "wheel") !== (m[4] !== undefined)) {
      throw new UsageError(
        `--after ${JSON.stringify(raw)}: expected "click x,y", "move x,y" or "wheel x,y dy"`
        + " — screenshot px, like the map's (e.g. --after \"wheel 85,150 89\").",
      );
    }
    const at = { x: Number(m[2]), y: Number(m[3]) };
    out.push(kind === "wheel" ? { kind: "wheel", at, dy: Number(m[4]) } : kind === "move" ? { kind: "move", at } : { kind: "click", at });
  }
  return out;
}

export const groundingGate = defineGate<GroundingScanReport, GroundingScanOptions>({
  id: "check.grounding",
  command: ["check", "grounding"],
  title: "Screenshot-space action map",
  summary: "Screenshot-space action map + whether a pixel-driven agent can act on it",
  category: "behavior",
  usage: `Measures the page the way a computer-use agent sees it: every target's
click point in SCREENSHOT pixels (after the downscale a model reads the
image at), which element actually receives a click at that point, and
whether the label on screen names one target or six.

--json emits the action map — id, role, visible label, click point,
box, and the risks attached to that coordinate — which is directly
usable for grounding a click without a VLM.

--mark <png> draws the same map onto the screenshot as numbered boxes
(set-of-mark), red where the coordinate carries a risk.

--at x,y (repeatable) hit-tests a coordinate you already have and says
which element a click there would reach -- for checking an answer, or
a line of this report, before acting on it.

--after "click x,y" (repeatable, in order; also "move x,y" and
"wheel x,y dy") replays actions before measuring, so the map, --at and
--mark describe the screen those actions leave -- a detail panel a click
opened, the rows a scroll revealed. Screenshot px throughout, dy included.
The report then says what the LAST action changed: what the click landed
on, controls that came or went or changed state or look, and text that
appeared or went -- "did it work", which one screen's map cannot answer.

Complements rather than repeats: WCAG touch size is \`check a11y touch\`,
keyboard behavior is \`check interactions\`, and whether an action had a
visible effect is \`vlmkit inspect explore\`.`,
  rules: [
    { id: "redirected", title: "Requested URL redirected elsewhere", severity: "suspect" },
    {
      id: "occluded-target",
      title: "A click at the target's own click point goes somewhere else",
      severity: "suspect",
      docs: `The agent's whole turn fails silently here: it sees the control, emits the
coordinate, and another element takes the click. Measured with elementFromPoint on a 3x3
grid inside the visible box, so the message can say how much of the box still routes
correctly. A <label> that forwards to its own control is not a finding. A cover with
\`pointer-events: none\` is not one either — it does not take the click — but it does hide
the target from the screenshot, which is \`check integrity\`'s painted-over-text rule.`,
    },
    {
      id: "ambiguous-target",
      title: "Several targets in the frame carry the same visible label",
      severity: "warn",
      docs: `"Click Edit" has no answer when six rows paint \`Edit\`. A warn, not a suspect,
because per-row duplicates are ordinary markup — the fix is an accessible name carrying
the row ("Edit ACME Corp"), and the message names the surrounding text that would supply
it. When nothing around them differs either, the message says so; that case is the one
worth acting on.`,
    },
    {
      id: "unlabeled-target",
      title: "Target paints neither text nor any mark",
      severity: "warn",
      docs: `An icon-only button is fine — the agent can see the icon. This is the box that
paints nothing at all: no text, no image, no background, no border, no generated content.
It is invisible in the screenshot, so no coordinate can be derived for it however good
its accessible name is.`,
    },
    {
      id: "imprecise-target",
      title: "Target is below the precision floor in screenshot pixels",
      severity: "warn",
      docs: `Measured AFTER the downscale (--resolution), which is why it is not the same
check as \`check a11y touch\`: a 24 CSS px control that passes WCAG 2.5.8 is 12 screenshot
px at scale 0.5 and 7 at a 640px cap. Tune with --precision-floor rather than switching
the rule off.`,
    },
    {
      id: "crowded-target",
      title: "A small coordinate error lands on a different control",
      severity: "warn",
      docs: `Distance from this target's click point to the nearest OTHER target's box, in
screenshot px. Adjacent buttons in a toolbar do not trip it — their click points are half
a button apart. A 6px icon beside another one does. Containers that enclose the target are
excluded: a click on the wrapper is not a click on a neighbour.`,
    },
    {
      id: "label-mismatch",
      title: "Visible text and accessible name name different things",
      severity: "warn",
      docs: `The agent reads the screenshot and a verifier reads the a11y tree; when neither
string contains the other, an instruction phrased from one cannot be resolved against the
other. Containment is allowed, so "Save" under an accessible name of "Save draft" is not a
finding.`,
    },
  ],
  inputs: [
    { name: "source", placeholder: "html-or-url", kind: "path-or-url", description: "Page to scan", positional: 0, required: true },
    { name: "viewport", placeholder: "WxH", kind: "string", description: "Viewport", defaultDescription: "1280x720" },
    {
      name: "resolution",
      placeholder: "preset|WxH",
      kind: "string",
      description: "Resolution the screenshot is downscaled to before a model reads it",
      choices: [...Object.keys(RESOLUTION_PRESETS)],
      defaultDescription: "resolved from the viewport, as image-resize.ts does",
    },
    { name: "precision-floor", placeholder: "px", kind: "number", description: "Min side in screenshot px below which a target is unresolvable", defaultDescription: "10" },
    { name: "aim-margin", placeholder: "px", kind: "number", description: "Click-point-to-neighbour distance in screenshot px below which a miss hits the neighbour", defaultDescription: "6" },
    { name: "mark", placeholder: "png", kind: "path", description: "Write a numbered set-of-mark screenshot here" },
    { name: "at", placeholder: "x,y", kind: "string", description: "Hit-test this screenshot-px point and report what a click there reaches", repeatable: true },
    {
      name: "after",
      placeholder: "action",
      kind: "string",
      description: "Replay \"click x,y\" / \"move x,y\" / \"wheel x,y dy\" (screenshot px) before measuring",
      repeatable: true,
    },
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const source = firstPositional(argv, "vlmkit check grounding <html-or-url>", [
      "--resolution",
      "--precision-floor",
      "--aim-margin",
      "--mark",
      "--at",
      "--after",
    ]);
    const precisionFloor = optionalInt(argv, "precision-floor", { min: 1 });
    const aimMargin = optionalInt(argv, "aim-margin", { min: 0 });
    const viewport = viewportFlag(argv);
    const resolution = parseResolution(argv);
    const markPath = readFlag(argv, "mark");
    const at = parseAtPoints(argv);
    const after = parseAfterActions(argv);
    return {
      source,
      ...(resolution !== undefined ? { resolution } : {}),
      ...(precisionFloor !== undefined ? { precisionFloor } : {}),
      ...(aimMargin !== undefined ? { aimMargin } : {}),
      ...(viewport ? { viewport } : {}),
      ...(markPath ? { markPath } : {}),
      ...(at.length > 0 ? { at } : {}),
      ...(after.length > 0 ? { after } : {}),
      ...parsePageLoad(argv),
    };
  },
  run: (options) => runGroundingScan(options),
  findings: (report): Finding[] =>
    report.issues.map((issue) => ({
      rule: issue.kind,
      severity: issue.severity,
      message: issue.message,
      ...(issue.selector ? { selector: issue.selector } : {}),
    })),
  format: formatGroundingReport,
  headline: (report) => {
    const actionable = report.targets.filter((t) => t.inFrame && !t.disabled);
    return `${actionable.length} target(s) in frame at ${report.frame.width}x${report.frame.height}`
      + ` (scale ${report.frame.scale.toFixed(2)})`;
  },
  ledger: (report, options) => ({
    tool: "check-grounding",
    source: options.source,
    headline: {
      targets: report.targets.filter((t) => t.inFrame && !t.disabled).length,
      scale: Number(report.frame.scale.toFixed(2)),
      issues: report.issues.length,
    },
  }),
});
