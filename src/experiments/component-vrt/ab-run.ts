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
export const COMPONENTS = ["Button", "Badge", "Avatar", "Card", "Alert", "Toolbar"] as const;
export type ComponentName = (typeof COMPONENTS)[number];

/** `.c-button` ← `Button`. The fixture keeps one rule prefix per component. */
export function componentClass(name: ComponentName): string {
  return `.c-${name.toLowerCase()}`;
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

export interface Seed {
  seed: number;
  component: ComponentName;
  /** The declaration removed, for the report. */
  selector: string;
  property: string;
  value: string;
}

/**
 * Pick one property to delete, from one component's own rule block.
 *
 * Constrained to declarations inside `.c-<component>` so ground truth is
 * unambiguous — a mutation to `:root` or `body` would change every component and
 * make "did the signal localize it" meaningless.
 */
export function planSeed(css: string, seed: number): Seed {
  const rand = seededRandom(seed);
  // Component chosen by seed index, not by the RNG. `seededRandom`'s first draw
  // is strongly correlated with small seeds — seeds 1-6 all selected `Avatar` —
  // and for an experiment this small even coverage is what is wanted anyway:
  // seeds 1..6 hit all six components, so no component's result is missing and
  // none is double-weighted. The RNG still picks WHICH property to remove.
  const component = COMPONENTS[(seed - 1) % COMPONENTS.length]!;
  const prefix = componentClass(component);
  // Layout-affecting only: a pure colour change does not reflow, so the cascade
  // this experiment is about would not appear at all. Both arms see the same
  // class of regression either way.
  const LAYOUT = ["padding", "width", "height", "border", "gap", "font", "display", "letter-spacing"];
  const candidates = declarationsIn(css, prefix).filter(
    (d) => LAYOUT.some((p) => d.property === p || d.property.startsWith(`${p}-`)),
  );
  if (candidates.length === 0) {
    throw new Error(`no layout-affecting declaration found for ${prefix} — fixture changed?`);
  }
  const picked = candidates[Math.floor(rand() * candidates.length)]!;
  return { seed, component, selector: prefix, property: picked.property, value: picked.value };
}

/** Remove exactly the planned declaration, leaving the rest of the file byte-identical. */
export function applySeed(css: string, plan: Seed): string {
  const line = `${plan.property}: ${plan.value};`;
  const index = css.indexOf(line);
  if (index < 0) throw new Error(`could not find "${line}" to remove`);
  return `${css.slice(0, index)}${css.slice(index + line.length)}`;
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
  run([
    "diff", "html",
    join(workdir, "clean", "page.html"),
    join(workdir, "dirty", "page.html"),
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

export function runSeed(seed: number, root: string): SeedResult {
  const workdir = join(root, `seed-${seed}`);
  rmSync(workdir, { recursive: true, force: true });
  for (const variant of ["clean", "dirty"]) {
    mkdirSync(join(workdir, variant), { recursive: true });
    cpSync(FIXTURE, join(workdir, variant), { recursive: true });
  }

  const cssPath = join(workdir, "dirty", "components.css");
  const css = readFileSync(cssPath, "utf8");
  const plan = planSeed(css, seed);
  writeFileSync(cssPath, applySeed(css, plan));

  return { plan, page: pageArm(workdir, plan), story: storyArm(workdir, plan) };
}

const ratio = (a: number, b: number) => (b === 0 ? "—" : `${(a / b).toFixed(1)}x`);

export function formatReport(results: readonly SeedResult[]): string {
  const lines: string[] = [];
  lines.push("## Per seed");
  lines.push("");
  lines.push("| seed | mutated component | removed | page bytes | story bytes | page img tokens | story img tokens |");
  lines.push("|---|---|---|--:|--:|--:|--:|");
  for (const r of results) {
    lines.push(
      `| ${r.plan.seed} | \`${r.plan.component}\` | \`${r.plan.property}\` |`
      + ` ${r.page.signalBytes.toLocaleString()} | ${r.story.signalBytes.toLocaleString()} |`
      + ` ${r.page.imageTokens.toLocaleString()} | ${r.story.imageTokens.toLocaleString()} |`,
    );
  }

  const sum = (pick: (r: SeedResult) => number) => results.reduce((n, r) => n + pick(r), 0);
  const pageBytes = sum((r) => r.page.signalBytes);
  const storyBytes = sum((r) => r.story.signalBytes);
  const pageImg = sum((r) => r.page.imageTokens);
  const storyImg = sum((r) => r.story.imageTokens);

  lines.push("");
  lines.push("## Totals");
  lines.push("");
  lines.push("| metric | page-scoped | component-scoped | ratio |");
  lines.push("|---|--:|--:|--:|");
  lines.push(`| signal bytes | ${pageBytes.toLocaleString()} | ${storyBytes.toLocaleString()} | **${ratio(pageBytes, storyBytes)}** |`);
  lines.push(`| image tokens (approx) | ${pageImg.toLocaleString()} | ${storyImg.toLocaleString()} | **${ratio(pageImg, storyImg)}** |`);
  lines.push(
    `| localized the right component | ${results.filter((r) => r.page.localized).length}/${results.length}`
    + ` | ${results.filter((r) => r.story.localized).length}/${results.length} | |`,
  );
  // Scored against the expected blast radius, not against the mutated component
  // alone — see COMPOSES for why the naive version was wrong.
  const falsePos = (arm: ArmResult, plan: Seed) => {
    const expected = expectedChanged(plan.component) as string[];
    return arm.implicated.filter((c) => !expected.includes(c)).length;
  };
  const missed = (arm: ArmResult, plan: Seed) =>
    expectedChanged(plan.component).filter((c) => !arm.implicated.includes(c)).length;
  lines.push(
    `| false positives (outside blast radius) | ${sum((r) => falsePos(r.page, r.plan))}`
    + ` | ${sum((r) => falsePos(r.story, r.plan))} | |`,
  );
  lines.push(
    `| missed changes (inside blast radius) | ${sum((r) => missed(r.page, r.plan))}`
    + ` | ${sum((r) => missed(r.story, r.plan))} | |`,
  );

  lines.push("");
  lines.push("## Localization detail");
  lines.push("");
  lines.push("| seed | expected (blast radius) | page implicates | story implicates |");
  lines.push("|---|---|---|---|");
  for (const r of results) {
    lines.push(
      `| ${r.plan.seed} | ${expectedChanged(r.plan.component).map((c) => `\`${c}\``).join(", ")} |`
      + ` ${r.page.implicated.map((c) => `\`${c}\``).join(", ") || "—"} |`
      + ` ${r.story.implicated.map((c) => `\`${c}\``).join(", ") || "—"} |`,
    );
  }
  lines.push("");
  lines.push(
    "Image tokens use Anthropic's documented `w*h/750` approximation, applied to the"
    + " PNG dimensions actually emitted. Output tokens and retake counts are absent"
    + " on purpose: both require a repair agent in the loop, and estimating them"
    + " would be fabrication.",
  );
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const seedArg = process.argv.indexOf("--seeds");
  const seeds = seedArg >= 0
    ? process.argv[seedArg + 1]!.split(",").map((s) => Number(s.trim()))
    : [1, 2, 3];
  const root = join(process.cwd(), "test-results", "component-vrt-ab");
  mkdirSync(root, { recursive: true });

  const results: SeedResult[] = [];
  for (const seed of seeds) {
    process.stderr.write(`seed ${seed}… `);
    const result = runSeed(seed, root);
    process.stderr.write(`${result.plan.component}/${result.plan.property}\n`);
    results.push(result);
  }
  const report = formatReport(results);
  console.log(report);
  const outPath = join(root, "report.md");
  writeFileSync(outPath, `${report}\n`);
  writeFileSync(join(root, "results.json"), `${JSON.stringify(results, null, 2)}\n`);
  process.stderr.write(`\nwritten: ${outPath}\n`);
}
