/**
 * `check color` as a gate definition. Measurement lives in
 * `../style/color-roles.ts`; this file only declares the surface.
 *
 * Two of the three rules are WCAG criteria carrying WCAG's own number (3:1),
 * which is why they are the only judgements here: the round that built this gate
 * measured three further candidates on 14 designed pages and rejected all three,
 * including the obvious one — scoring base/main/accent against 70:25:5, which
 * every one of those pages misses by 15 to 55 points. The palette is therefore
 * extracted and reported, never scored.
 *
 * `control-boundary-invisible` and `color-only-link` are `warn` rather than
 * `suspect` for the same reason every rule in `check design` and
 * `check composition` is: the gate reports what colour is being asked to carry,
 * and whether that is acceptable is a decision. Both are also genuine WCAG
 * failures, so a project that gates on accessibility should promote them —
 * `"rules": { "check.color": { "color-only-link": "suspect" } }`.
 */

import { readAll, readFlag, readInt } from "@mizchi/vlmkit-core/arg-reader.ts";
import { defineGate } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { PAGE_LOAD_INPUTS, parsePageLoad } from "@mizchi/vlmkit-core/page-load.ts";
import type { Finding } from "@mizchi/vlmkit-core/plugin/contract.ts";
import { firstPositional, firstPositionalOrUndefined } from "@mizchi/vlmkit-core/plugin/args.ts";
import { UsageError } from "@mizchi/vlmkit-core/cli-error.ts";
import { readFromSnapshotFlag, readStyleSnapshot } from "../style/style-snapshot.ts";
import {
  COLOR_ALLOW_HELP,
  parseColorAllowRules,
  type ColorRolesOptions,
  type ColorRolesReport,
  formatColorRolesReport,
  judgeCollectedColorRoles,
  runColorRolesCheck,
  runSceneColorRolesCheck,
} from "../style/color-roles.ts";

export const colorGate = defineGate<ColorRolesReport, ColorRolesOptions & { elementsPath?: string; fromPath?: string }>({
  id: "check.color",
  command: ["check", "color"],
  title: "Colour roles and colour-only meaning",
  summary: "What each colour is for, and where colour alone carries a meaning",
  category: "design-system",
  usage: `Extracts the page's palette by ROLE — surfaces, ink, marks, ranked by painted
area, with the base and the link colour named — and reports the two places
where colour is the only thing carrying a meaning:

  control-boundary-invisible  a text field whose own boundary is under 3:1
                              against the surface behind it, with no shadow or
                              outline either, so where to type is invisible
                              (WCAG 1.4.11)
  color-only-link             a link inside prose, marked off from that prose by
                              colour alone and under 3:1 against it
                              (WCAG 1.4.1, technique G183)

Disjoint from \`check a11y contrast\` by construction: that gate measures text
against its BACKGROUND and passes every link this one reports — caniuse's
\`#0046d1\` note links are 8.2:1 against the page and 2.8:1 against the sentence
they sit in. Run both.

The palette is reported and never scored. Three candidates were measured on 14
designed pages and rejected, the first two because they run backwards:
base/main/accent against 70:25:5 (those pages miss it by 15-55 points),
palette sprawl (3-35 colours, and the most careful pages are at the top), and
accent role collision (fires on 13 of 15 — a link in the body colour is the
norm). Study: docs/reports/2026-09-23-color-roles-v1.md`,
  rules: [
    {
      id: "control-boundary-invisible",
      title: "A text control's boundary is under 3:1 against what is behind it",
      severity: "warn",
      docs:
        "WCAG 1.4.11 Non-text Contrast, which names 3:1 — not a threshold chosen here. Only"
        + " controls whose EXTENT is the affordance: a checkbox, radio, range or colour swatch is"
        + " drawn by the platform and a submit button carries its own label. A box-shadow or an"
        + " outline draws an edge too, so a field with either is not reported. Promote to suspect"
        + " to gate on accessibility.",
    },
    {
      id: "color-only-link",
      title: "A link is marked off from the prose around it by colour alone, under 3:1",
      severity: "warn",
      docs:
        "WCAG 1.4.1 / G183, which names 3:1 between link ink and surrounding ink. Requires the"
        + " flow to hold its OWN prose: danluu.com's 210 undecorated links at 1.7:1 are not a"
        + " finding, because every row is a link and there is no sentence for one to hide inside."
        + " An underline, a weight step of 100 or more, a border or a fill all count as the"
        + " non-colour cue. Rows are grouped by colour pair, because one stylesheet rule produces"
        + " as many elements as it has links.",
    },
    {
      id: "link-no-cue",
      title: "A link renders in exactly the colour of the prose around it",
      severity: "warn",
      docs:
        "The degenerate case of the rule above, split out because it is a stronger claim: not"
        + " 'not enough contrast' but no signal at all. Reported without a ratio, since 1.00:1 is"
        + " not the useful number.",
    },
    {
      id: "unreadable-color",
      title: "A declared colour could not be read and was left out",
      severity: "info",
      docs:
        "The anti-silence rule, and it exists because of a measured failure: the shared colour"
        + " parser understood rgb() only, Chromium serialises oklch() as lab() verbatim, and"
        + " `check a11y contrast` inspected 10 of 1068 elements on the Tailwind docs page and"
        + " called it clean."
        + " Expected to fire rarely to never, and that is the point rather than a sign it is dead"
        + " code: the parser now hands anything non-legacy to the browser and reads the pixel"
        + " back, so it refuses only what the browser itself refuses. What it still catches is an"
        + " environment where the canvas path is unavailable — a blocked 2D context, or"
        + " getImageData refused under fingerprinting protection — in which case EVERY modern"
        + " colour on the page is unreadable and this row says so instead of the gate reporting a"
        + " clean page it never read.",
    },
    {
      id: "nothing-judged",
      title: "No control and no link in a text flow could be measured",
      severity: "info",
      docs:
        "Info by default — a document with no interactive text is not a defect. Raise to suspect"
        + " to enforce that this gate must actually measure something rather than reporting green"
        + " on a page it never read.",
    },
    { id: "redirected", title: "Requested URL redirected elsewhere", severity: "suspect" },
  ],
  inputs: [
    {
      name: "source", placeholder: "html-or-url", kind: "path-or-url",
      description: "Page to check (omit when using --elements)", positional: 0,
    },
    {
      name: "elements", placeholder: "scene.json", kind: "path",
      description: "A scene instead of a page — canvas/WebGPU, native, a game HUD (no browser). Needs `role: field|link` and resolved colours",
    },
    {
      name: "from", placeholder: "snapshot.json", kind: "path",
      description: "A `scan style` snapshot instead of a page: judged with no browser, same report as the live run",
    },
    {
      name: "viewport", kind: "number",
      description: "Viewport width; which controls and links are visible depends on it",
      defaultDescription: "1280",
    },
    {
      name: "allow", placeholder: "<selector>;<reason>", kind: "string", repeatable: true,
      description: COLOR_ALLOW_HELP,
    },
    {
      name: "storage-state", placeholder: "file", kind: "path",
      description: "Playwright storage state for pages behind a login",
    },
    { name: "report", placeholder: "path", kind: "path", description: "Markdown report path" },
    // Spread, not re-declared — see the note in `integrity.gate.ts`.
    ...PAGE_LOAD_INPUTS,
  ],
  parse: (argv) => {
    const from = readFromSnapshotFlag(argv, "check color", ["--viewport", "--allow", "--storage-state", "--report", "--elements"]);
    if (from) {
      const allow = readAll(argv, "allow");
      parseColorAllowRules(allow);
      const reportPath = readFlag(argv, "report");
      return { source: from, fromPath: from, ...(allow.length > 0 ? { allow } : {}), ...(reportPath ? { reportPath } : {}) };
    }
    const elements = readFlag(argv, "elements");
    if (elements) {
      // Mutually exclusive with a page, as in `check integrity`: the two inputs are judged by
      // the same rules, but a run that measured one of two named inputs would be ambiguous.
      if (firstPositionalOrUndefined(argv, ["--viewport", "--allow", "--storage-state", "--report", "--elements"])) {
        throw new UsageError("check color takes either a page source or --elements, not both.");
      }
      const viewport = readInt(argv, "viewport", { min: 1 });
      const allow = readAll(argv, "allow");
      parseColorAllowRules(allow);
      const reportPath = readFlag(argv, "report");
      return {
        source: elements,
        elementsPath: elements,
        ...(viewport !== undefined ? { viewport } : {}),
        ...(allow.length > 0 ? { allow } : {}),
        ...(reportPath ? { reportPath } : {}),
      };
    }
    const source = firstPositional(argv, "vlmkit check color <html-or-url> | --elements <scene.json>", [
      "--viewport", "--allow", "--storage-state", "--report",
    ]);
    const viewport = readInt(argv, "viewport", { min: 200 });
    const pageLoad = parsePageLoad(argv);
    const storageState = readFlag(argv, "storage-state");
    const reportPath = readFlag(argv, "report");
    const allow = readAll(argv, "allow");
    // Parsed before the browser starts, so a malformed exemption fails in
    // milliseconds rather than after a page load.
    parseColorAllowRules(allow);
    return {
      source,
      ...(viewport !== undefined ? { viewport } : {}),
      ...(allow.length > 0 ? { allow } : {}),
      ...(storageState ? { storageState } : {}),
      ...(reportPath ? { reportPath } : {}),
      ...(pageLoad.timeout !== undefined ? { timeout: pageLoad.timeout } : {}),
      ...(pageLoad.waitUntil ? { waitUntil: pageLoad.waitUntil } : {}),
      ...(pageLoad.har ? { har: pageLoad.har } : {}),
    };
  },
  run: async (options) => {
    if (options.fromPath) {
      const snapshot = await readStyleSnapshot(options.fromPath);
      return await judgeCollectedColorRoles(snapshot.color, snapshot.redirect, { ...options, source: snapshot.source });
    }
    return options.elementsPath
      ? runSceneColorRolesCheck({ ...options, elementsPath: options.elementsPath })
      : runColorRolesCheck(options);
  },
  findings: (report): Finding[] =>
    report.findings.map((finding) => ({
      rule: finding.kind,
      severity: finding.severity,
      message: finding.message,
      ...(finding.selector ? { selector: finding.selector } : {}),
      ...(finding.evidence ? { evidence: finding.evidence } : {}),
    })),
  format: formatColorRolesReport,
  headline: (report) =>
    `base ${report.base?.hex ?? "?"}, body ink ${report.bodyInk?.hex ?? "?"},`
    + ` link ink ${report.linkInk?.hex ?? "none"},`
    + ` ${report.palette.surfaces.length} surface(s) / ${report.palette.ink.length} ink(s),`
    + ` ${report.controls.length} control(s) and ${report.links.length} link(s) measured`,
  // runColorRolesCheck appends its own entry.
  ledger: () => null,
});
