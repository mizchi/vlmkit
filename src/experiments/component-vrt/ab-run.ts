/**
 * A/B: page-scoped vs component-scoped VRT signal, on the same regression.
 *
 * ## The question
 *
 * When an agent repairs ONE component, does scoping the VRT to that component
 * (`check story`) give it a cheaper and more precise signal than diffing the
 * whole page it lives on?
 *
 * ## What this measures, and what it does not
 *
 * Measured, exactly:
 *
 * - **Signal bytes** — the JSON an agent actually reads, byte-counted from the
 *   real CLI output of both arms.
 * - **Image pixels and vision tokens** — the screenshots an agent would open, at
 *   their real dimensions. Tokens use Anthropic's documented approximation
 *   (`w*h/750`), noted as an approximation everywhere it appears.
 * - **Localization** — does the signal name the component that actually changed?
 *   Ground truth is known because the mutation is seeded into exactly one
 *   component's rule block.
 * - **Cascade / precision** — how many components the signal implicates when only
 *   one changed. Every falsely-implicated component is a candidate wrong edit.
 *
 * **Not** measured, and deliberately not estimated: retake counts and output
 * tokens. Both need a real repair agent in the loop. This harness produces the
 * inputs that arm would consume, so it can be added without changing anything
 * here — but a number invented for it would be fiction, and the whole point of
 * the exercise is to get real ones.
 *
 * ## Fairness
 *
 * The two arms share `fixture/components.css` and `fixture/_markup.js`, so one
 * mutation reaches both identically. And the page arm is given its *best*
 * signal, not a convenient one: `vlmkit diff html`, whose computed-style diff
 * localizes by selector, rather than only the pixel path — which, measured here,
 * attributes a reflowed page to the common ancestor. Comparing against the weaker
 * page signal would have manufactured the result.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PNG } from "pngjs";
import { seededRandom } from "../css-challenge/css-challenge-core.ts";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(here, "fixture");
const CLI = resolve(here, "../../cli/vlmkit.ts");

/** Components in the fixture, in the order the page lays them out. */
export const COMPONENTS = [
  "Button", "Badge", "Avatar", "Card", "Alert", "Toolbar",
  // Large on purpose. With only small components, "a component shot is far
  // smaller than a page shot" is true by construction rather than by finding —
  // these two exist so the thesis can fail.
  "Hero", "DataTable",
] as const;
export type ComponentName = (typeof COMPONENTS)[number];

/**
 * `.c-button` ← `Button`. One rule prefix per component, so a mutation is
 * attributable. `DataTable` is spelled `.c-table` in the CSS, hence the map
 * rather than a blind lowercase.
 */
const CLASS_OVERRIDES: Partial<Record<ComponentName, string>> = { DataTable: ".c-table" };
export function componentClass(name: ComponentName): string {
  return CLASS_OVERRIDES[name] ?? `.c-${name.toLowerCase()}`;
}

/**
 * Which components contain which. `Toolbar` renders an Avatar, a Badge and a
 * Button, so a mutation to any of those genuinely changes the Toolbar too.
 *
 * This exists because the first run of this experiment got it wrong. The story
 * arm reported `Button, Toolbar` for a Button mutation and the harness scored
 * `Toolbar` as a false positive — making the arm look imprecise when it had in
 * fact caught a real downstream change the page arm's selector-level signal
 * missed. A composite is not noise; it is the blast radius.
 */
export const COMPOSES: Partial<Record<ComponentName, ComponentName[]>> = {
  Toolbar: ["Avatar", "Badge", "Button"],
};

/**
 * Everything a mutation to `component` is *expected* to change: itself, plus any
 * composite that renders it. Anything outside this set is a genuine false
 * positive; anything inside it that a signal misses is a genuine miss.
 */
export function expectedChanged(component: ComponentName): ComponentName[] {
  const composites = (Object.keys(COMPOSES) as ComponentName[])
    .filter((parent) => COMPOSES[parent]!.includes(component));
  return [component, ...composites];
}

/**
 * Declarations inside one rule block.
 *
 * Not `parseCssDeclarations` from css-challenge-core: that one only reads
 * single-line rule blocks (`.a { b: c; }`), which is the shape its own fixtures
 * use. On this fixture's multi-line CSS it found 5 declarations out of ~50 —
 * silently, since an empty candidate list looks like "nothing matched" rather
 * than "the parser cannot see this file". Reformatting the fixture to suit the
 * parser would have made the CSS unlike anything a project actually writes.
 */
export function declarationsIn(css: string, selector: string): { property: string; value: string }[] {
  // Match the rule block whose selector is exactly this one, at line start, so
  // `.c-card` does not also match `.c-card__title`.
  const block = new RegExp(`^\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "m")
    .exec(css);
  if (!block) return [];
  return block[1]!
    .split(";")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colon = line.indexOf(":");
      return { property: line.slice(0, colon).trim(), value: line.slice(colon + 1).trim() };
    })
    .filter((d) => d.property && d.value);
}

/**
 * Page compositions the same components are measured in.
 *
 * Varying the page rather than the component set keeps the fairness condition
 * (both arms render from one CSS and one markup module) while exercising the
 * thing that actually drives page-arm cost: how big the page is and how many
 * times a component appears in it.
 */
export const PAGES = ["flat", "hero", "list"] as const;
export type PageVariant = (typeof PAGES)[number];

/**
 * Regression classes.
 *
 * `colour` is here to be adversarial: a colour change does not reflow, so the
 * page arm's pixel diff stays tight around the component and the cascade that
 * favours the component arm never happens. A result that only holds for
 * reflowing mutations is a result about reflow, not about scoping.
 */
export const SEED_CLASSES = ["delete", "value", "colour"] as const;
export type SeedClass = (typeof SEED_CLASSES)[number];

export interface Seed {
  seed: number;
  page: PageVariant;
  seedClass: SeedClass;
  component: ComponentName;
  selector: string;
  property: string;
  /** Original value. */
  value: string;
  /** What it becomes. Empty string means the declaration is deleted. */
  replacement: string;
}

/**
 * Pick one property to delete, from one component's own rule block.
 *
 * Constrained to declarations inside `.c-<component>` so ground truth is
 * unambiguous — a mutation to `:root` or `body` would change every component and
 * make "did the signal localize it" meaningless.
 */
export interface SeedRequest {
  seed: number;
  page: PageVariant;
  seedClass: SeedClass;
  /** Component to mutate. Passed explicitly so a run can cover a chosen set. */
  component: ComponentName;
}

/** Properties whose change reflows layout, and those that only repaint. */
const LAYOUT_PROPS = ["padding", "width", "height", "border", "gap", "font", "display", "letter-spacing"];
const COLOUR_PROPS = ["background", "color", "border-color"];

/** Plan one mutation. Deterministic in `seed` for the property choice. */
export function planSeed(css: string, request: SeedRequest): Seed {
  const rand = seededRandom(request.seed);
  const prefix = componentClass(request.component);
  const declarations = declarationsIn(css, prefix);
  const wants = request.seedClass === "colour" ? COLOUR_PROPS : LAYOUT_PROPS;
  const candidates = declarations.filter(
    (d) => wants.some((prop) => d.property === prop || d.property.startsWith(`${prop}-`))
      // A colour hiding inside a shorthand (`border: 1px solid x`) is not a
      // colour-only mutation — changing it would also be a no-op or a reflow
      // depending on the shorthand, so the class would not mean what it says.
      && (request.seedClass !== "colour" || /#|rgb|var\(|linear-gradient/.test(d.value)),
  );
  if (candidates.length === 0) {
    throw new Error(
      `no ${request.seedClass} candidate in ${prefix}`
      + ` (has: ${declarations.map((d) => d.property).join(", ") || "nothing"})`,
    );
  }
  const picked = candidates[Math.floor(rand() * candidates.length)]!;
  return {
    seed: request.seed,
    page: request.page,
    seedClass: request.seedClass,
    component: request.component,
    selector: prefix,
    property: picked.property,
    value: picked.value,
    replacement: mutateValue(picked.property, picked.value, request.seedClass),
  };
}

/**
 * What the declaration becomes.
 *
 * `value` perturbs rather than deletes, because a wrong-but-present value is the
 * more common real regression — someone edits `padding: 10px` to `padding: 16px`.
 * Deletion is the easier case for any differ, so testing only deletion would
 * overstate both arms.
 */
export function mutateValue(property: string, value: string, seedClass: SeedClass): string {
  if (seedClass === "delete") return "";
  if (seedClass === "colour") {
    // A visible but modest shift: large enough to exceed any threshold, small
    // enough that it is a plausible mistake rather than a smoke test.
    if (/linear-gradient/.test(value)) return "linear-gradient(120deg, #f6ecff, #fbf7ff)";
    if (/var\(/.test(value)) return value.replace(/var\([^)]+\)/, "#8a5cf6");
    return value.replace(/#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)/, "#8a5cf6");
  }
  // `value`: scale the first length found. Falls back to a keyword swap when the
  // value carries no length at all.
  const length = /(-?\d*\.?\d+)(px|em|rem|%)/.exec(value);
  if (length) {
    const scaled = Math.max(1, Math.round(Number(length[1]) * 1.8 + 4));
    return value.replace(length[0], `${scaled}${length[2]}`);
  }
  if (value.trim() === "inline-flex") return "block";
  if (value.trim() === "inline-block") return "block";
  if (value.trim() === "flex") return "block";
  return `${value} `.trim(); // no safe perturbation; caller filters these out
}

/**
 * Locate the `{ ... }` span of one rule block, so an edit can be confined to it.
 */
function blockSpan(css: string, selector: string): { start: number; end: number } {
  const match = new RegExp(`^\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`, "m").exec(css);
  if (!match) throw new Error(`rule block ${selector} not found`);
  const start = match.index + match[0].length;
  const end = css.indexOf("}", start);
  if (end < 0) throw new Error(`rule block ${selector} is unterminated`);
  return { start, end };
}

/**
 * Apply the plan: delete the declaration, or replace its value — **inside the
 * planned selector's block only**.
 *
 * The block scoping is the whole point. An earlier version searched the entire
 * file with `indexOf("background: #fff;")`, and `body { background: #fff }`
 * appears before `.c-card { background: #fff }` — so a mutation planned for the
 * Card silently repainted the page background instead, turning every story in the
 * gallery purple. That produced 15 "false positives" for the component arm which
 * were not the arm's fault at all: the fixture really had changed everywhere.
 * Ground truth is only ground truth if the mutation lands where the plan says.
 */
export function applySeed(css: string, plan: Seed): string {
  const { start, end } = blockSpan(css, plan.selector);
  const line = `${plan.property}: ${plan.value};`;
  const within = css.slice(start, end).indexOf(line);
  if (within < 0) {
    throw new Error(`could not find "${line}" inside ${plan.selector} to mutate`);
  }
  const index = start + within;
  const replacement = plan.replacement === "" ? "" : `${plan.property}: ${plan.replacement};`;
  return `${css.slice(0, index)}${replacement}${css.slice(index + line.length)}`;
}

/**
 * A plan that would not change any pixel is not a trial — it would score as
 * "both arms found nothing" and quietly dilute every average.
 */
export function isEffective(plan: Seed): boolean {
  return plan.replacement !== plan.value;
}

function pngSize(path: string): { width: number; height: number } {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height };
}

/**
 * Anthropic's documented approximation for image tokens. An approximation, and
 * labelled as one wherever it is reported — the real tokenizer is not public and
 * images above 1568px on the long edge are downscaled first, which this accounts
 * for because it measures the actual emitted PNG.
 */
export function visionTokens(width: number, height: number): number {
  return Math.ceil((width * height) / 750);
}

function run(args: string[], cwd: string): { stdout: string; status: number | null } {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", CLI, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", VLMKIT_NO_LEDGER: "1" },
    maxBuffer: 64 * 1024 * 1024,
  });
  return { stdout: r.stdout ?? "", status: r.status };
}

export interface ArmResult {
  arm: "page" | "story";
  /** Bytes of the machine-readable signal an agent reads. */
  signalBytes: number;
  /** Screenshots an agent would open, and their cost. */
  images: { path: string; width: number; height: number; tokens: number }[];
  imageTokens: number;
  /** Did the signal name the component that actually changed? */
  localized: boolean;
  /** Components the signal implicates. Ideally exactly the mutated one. */
  implicated: string[];
  notes: string[];
}

export interface SeedResult {
  plan: Seed;
  page: ArmResult;
  story: ArmResult;
}

/**
 * Page arm: `diff html` on the clean/mutated pair — the strongest deterministic
 * page signal the repo offers, computed-style diff included.
 */
function pageArm(workdir: string, plan: Seed): ArmResult {
  const out = join(workdir, "page-signal");
  const pageFile = `page-${plan.page}.html`;
  run([
    "diff", "html",
    join(workdir, "clean", pageFile),
    join(workdir, "dirty", pageFile),
    "--output-dir", out,
  ], workdir);

  const reportPath = join(out, "diff-report.json");
  const notes: string[] = [];
  if (!existsSync(reportPath)) {
    return { arm: "page", signalBytes: 0, images: [], imageTokens: 0, localized: false, implicated: [], notes: ["diff html produced no report"] };
  }
  const raw = readFileSync(reportPath, "utf8");

  // Which component classes does the report name at all? The computed-style and
  // authored-style diffs are the parts that carry selectors, and they are the
  // reason this arm can localize despite the pixel cascade.
  const implicated = COMPONENTS.filter((name) => raw.includes(componentClass(name)));

  // The heatmaps are what an agent opens. Page-sized, one per viewport — and the
  // per-viewport fan-out is itself part of the page arm's cost.
  const images = readdirSync(out)
    .filter((f) => f.endsWith("_heatmap.png"))
    .map((f) => {
      const path = join(out, f);
      const { width, height } = pngSize(path);
      return { path, width, height, tokens: visionTokens(width, height) };
    });

  return {
    arm: "page",
    signalBytes: statSync(reportPath).size,
    images,
    imageTokens: images.reduce((n, i) => n + i.tokens, 0),
    localized: implicated.includes(plan.component),
    implicated,
    notes,
  };
}

/**
 * Story arm: baselines from the clean gallery, then compare the mutated one.
 * Same six components, one browser.
 */
function storyArm(workdir: string, plan: Seed): ArmResult {
  const ids = COMPONENTS.map((name) => `components/${name}/Default`);
  const baselineDir = join(workdir, "story-baselines");
  const galleryFor = (variant: "clean" | "dirty") =>
    pathToFileURL(join(workdir, variant, "gallery.html")).href;

  // Baselines from clean. `--advisory` because the first run reports
  // new-baseline, which is a finding by design.
  run(["check", "story", ...ids, "--gallery", galleryFor("clean"), "--out", baselineDir, "--advisory"], workdir);

  const compared = run([
    "check", "story", ...ids,
    "--gallery", galleryFor("dirty"),
    "--out", baselineDir,
    "--json", "--advisory",
  ], workdir);

  const notes: string[] = [];
  let parsed: {
    findings: { rule: string; evidence?: Record<string, unknown> }[];
    report: { results: { story: string; outcome: string; width?: number; height?: number; heatmapPath?: string }[] };
  };
  try {
    parsed = JSON.parse(compared.stdout) as typeof parsed;
  } catch {
    return { arm: "story", signalBytes: 0, images: [], imageTokens: 0, localized: false, implicated: [], notes: ["check story produced no JSON"] };
  }

  const changed = parsed.report.results.filter((r) => r.outcome === "changed");
  const implicated = changed
    .map((r) => COMPONENTS.find((name) => r.story.includes(`/${name}/`)))
    .filter((n): n is ComponentName => n !== undefined);

  // Only the changed stories' heatmaps are worth opening — an unchanged story
  // has nothing to look at. That selectivity is half of the saving.
  const images = changed
    .filter((r) => r.heatmapPath && existsSync(r.heatmapPath))
    .map((r) => {
      const { width, height } = pngSize(r.heatmapPath!);
      return { path: r.heatmapPath!, width, height, tokens: visionTokens(width, height) };
    });

  return {
    arm: "story",
    signalBytes: Buffer.byteLength(compared.stdout, "utf8"),
    images,
    imageTokens: images.reduce((n, i) => n + i.tokens, 0),
    localized: implicated.includes(plan.component),
    implicated,
    notes,
  };
}

export function runSeed(request: SeedRequest, root: string): SeedResult | null {
  const workdir = join(root, `${request.page}-${request.seedClass}-${request.component}-${request.seed}`);
  rmSync(workdir, { recursive: true, force: true });
  for (const variant of ["clean", "dirty"]) {
    mkdirSync(join(workdir, variant), { recursive: true });
    cpSync(FIXTURE, join(workdir, variant), { recursive: true });
    // Baselines from a previous run must not travel with the fixture copy.
    rmSync(join(workdir, variant, ".vlmkit"), { recursive: true, force: true });
  }

  const cssPath = join(workdir, "dirty", "components.css");
  const css = readFileSync(cssPath, "utf8");
  const plan = planSeed(css, request);
  if (!isEffective(plan)) {
    rmSync(workdir, { recursive: true, force: true });
    return null;
  }
  writeFileSync(cssPath, applySeed(css, plan));

  return { plan, page: pageArm(workdir, plan), story: storyArm(workdir, plan) };
}

const ratio = (a: number, b: number) => (b === 0 ? "—" : `${(a / b).toFixed(1)}x`);

const sumBy = (rows: readonly SeedResult[], pick: (r: SeedResult) => number) =>
  rows.reduce((n, r) => n + pick(r), 0);

function falsePositives(arm: ArmResult, plan: Seed): number {
  const expected = expectedChanged(plan.component) as string[];
  return arm.implicated.filter((c) => !expected.includes(c)).length;
}
function missed(arm: ArmResult, plan: Seed): number {
  return expectedChanged(plan.component).filter((c) => !arm.implicated.includes(c)).length;
}

/** One comparison row for an arbitrary slice of the results. */
function sliceRow(label: string, rows: readonly SeedResult[]): string {
  if (rows.length === 0) return `| ${label} | — | — | — | — | — |`;
  const pageBytes = sumBy(rows, (r) => r.page.signalBytes);
  const storyBytes = sumBy(rows, (r) => r.story.signalBytes);
  const pageImg = sumBy(rows, (r) => r.page.imageTokens);
  const storyImg = sumBy(rows, (r) => r.story.imageTokens);
  const expected = rows.reduce((n, r) => n + expectedChanged(r.plan.component).length, 0);
  return `| ${label} | ${rows.length} | ${ratio(pageBytes, storyBytes)} | **${ratio(pageImg, storyImg)}** |`
    + ` ${sumBy(rows, (r) => missed(r.page, r.plan))}/${expected}`
    + ` vs ${sumBy(rows, (r) => missed(r.story, r.plan))}/${expected} |`
    + ` ${sumBy(rows, (r) => falsePositives(r.page, r.plan))}`
    + ` vs ${sumBy(rows, (r) => falsePositives(r.story, r.plan))} |`;
}

export function formatReport(results: readonly SeedResult[]): string {
  const lines: string[] = [];

  lines.push("## By page composition");
  lines.push("");
  lines.push("| slice | trials | bytes ratio | image-token ratio | missed (page vs story) | false pos (page vs story) |");
  lines.push("|---|--:|--:|--:|--:|--:|");
  for (const page of PAGES) lines.push(sliceRow(`page: \`${page}\``, results.filter((r) => r.plan.page === page)));
  lines.push(sliceRow("**all**", results));

  lines.push("");
  lines.push("## By regression class");
  lines.push("");
  lines.push("| slice | trials | bytes ratio | image-token ratio | missed (page vs story) | false pos (page vs story) |");
  lines.push("|---|--:|--:|--:|--:|--:|");
  for (const cls of SEED_CLASSES) {
    lines.push(sliceRow(`class: \`${cls}\``, results.filter((r) => r.plan.seedClass === cls)));
  }

  lines.push("");
  lines.push("## By component size");
  lines.push("");
  lines.push(
    "The adversarial cut. `Hero` and `DataTable` are large, so a component-scoped shot"
    + " of them approaches a page-scoped shot. If the advantage survives here it is not"
    + " an artefact of picking small components.",
  );
  lines.push("");
  lines.push("| slice | trials | bytes ratio | image-token ratio | missed (page vs story) | false pos (page vs story) |");
  lines.push("|---|--:|--:|--:|--:|--:|");
  const LARGE: readonly string[] = ["Hero", "DataTable"];
  lines.push(sliceRow("small components", results.filter((r) => !LARGE.includes(r.plan.component))));
  lines.push(sliceRow("**large components**", results.filter((r) => LARGE.includes(r.plan.component))));

  lines.push("");
  lines.push("## Every trial");
  lines.push("");
  lines.push("| page | class | component | mutation | page bytes | story bytes | page img tok | story img tok |");
  lines.push("|---|---|---|---|--:|--:|--:|--:|");
  for (const r of results) {
    const mutation = r.plan.replacement === ""
      ? `\`${r.plan.property}\` deleted`
      : `\`${r.plan.property}\` → ${r.plan.replacement.slice(0, 22)}`;
    lines.push(
      `| ${r.plan.page} | ${r.plan.seedClass} | \`${r.plan.component}\` | ${mutation} |`
      + ` ${r.page.signalBytes.toLocaleString()} | ${r.story.signalBytes.toLocaleString()} |`
      + ` ${r.page.imageTokens.toLocaleString()} | ${r.story.imageTokens.toLocaleString()} |`,
    );
  }

  lines.push("");
  lines.push(
    "Image tokens use Anthropic's documented `w*h/750` approximation on the PNG"
    + " dimensions actually emitted. Output tokens and retake counts are absent on"
    + " purpose: both need a repair agent in the loop, and estimating them would be"
    + " fabrication.",
  );
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const pages = (arg("pages")?.split(",") ?? [...PAGES]) as PageVariant[];
  const classes = (arg("classes")?.split(",") ?? [...SEED_CLASSES]) as SeedClass[];
  const components = (arg("components")?.split(",") ?? [...COMPONENTS]) as ComponentName[];

  const root = join(process.cwd(), "test-results", "component-vrt-ab");
  mkdirSync(root, { recursive: true });

  const results: SeedResult[] = [];
  const skipped: string[] = [];
  let seed = 0;
  for (const page of pages) {
    for (const seedClass of classes) {
      for (const component of components) {
        seed++;
        const label = `${page}/${seedClass}/${component}`;
        let result: SeedResult | null = null;
        try {
          result = runSeed({ seed, page, seedClass, component }, root);
        } catch (e) {
          // A component with no colour declaration of its own has no `colour`
          // trial, and that is fine — but it must be REPORTED, because a silently
          // shrinking corpus is how a bench starts flattering itself.
          skipped.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
          process.stderr.write(`skip ${label}\n`);
          continue;
        }
        if (!result) {
          skipped.push(`${label}: mutation would not change any pixel`);
          process.stderr.write(`skip ${label} (no-op)\n`);
          continue;
        }
        process.stderr.write(`${label} — ${result.plan.property}\n`);
        results.push(result);
      }
    }
  }

  let report = formatReport(results);
  if (skipped.length > 0) {
    report += `\n\n## Skipped trials (${skipped.length})\n\n`
      + skipped.map((s) => `- ${s}`).join("\n")
      + "\n\nListed rather than dropped: a corpus that quietly shrinks is how a"
      + " benchmark starts agreeing with whoever wrote it.\n";
  }
  console.log(report);
  writeFileSync(join(root, "report.md"), `${report}\n`);
  writeFileSync(join(root, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  process.stderr.write(`\n${results.length} trials, ${skipped.length} skipped\n`);
}
