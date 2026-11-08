/**
 * `vlmkit check auto` (issue #216): what the probe reads, what it chooses from that, and that the
 * choice covers what the demo sites' judgment logs ran.
 */
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { describe, it } from "vite-plus/test";
import { chooseGates, mergeSheet, scanCssText, main, type PageFeatures } from "./auto-cli.ts";

const ROOT = join(import.meta.dirname, "../../..");
const none: PageFeatures = {
  text: 0,
  controls: 0,
  widthQueries: [],
  darkScheme: false,
  reducedMotionQuery: false,
  animationRules: 0,
  transitionRules: 0,
  runningAnimations: 0,
  scrollers: 0,
  stickyOrFixed: 0,
  snap: 0,
  canvases: 0,
  videos: 0,
  unreadableSheets: 0,
};
const base = (plan: ReturnType<typeof chooseGates>) => plan.gates.map((g) => g.gate.replace(/ --(from|out) .*$/, ""));

describe("chooseGates: what the page has, the gates that apply", () => {
  it("runs integrity on any page, and nothing it has no reason for", () => {
    assert.deepEqual(base(chooseGates(none)), ["check integrity"]);
  });

  it("adds each gate for the feature that calls for it, with the reason", () => {
    const plan = chooseGates({
      ...none,
      text: 400,
      controls: 3,
      widthQueries: [600, 900],
      darkScheme: true,
      animationRules: 2,
      transitionRules: 1,
      scrollers: 1,
      canvases: 1,
    });
    assert.deepEqual(base(plan), [
      "check integrity",
      "check a11y contrast",
      "scan style",
      "check design",
      "check composition",
      "check color",
      "check interactions",
      "check a11y focus",
      "check a11y touch",
      "check breakpoints",
      "check scroll",
      "check animation",
      "check motion",
      "check integrity --color-scheme dark",
      "check a11y contrast --color-scheme dark",
    ]);
    assert.match(plan.gates.find((g) => g.gate === "check breakpoints")!.why, /600, 900px/);
    assert.ok(plan.gates.filter((g) => g.fromSnapshot).every((g) => g.gate.includes("--from")));
    assert.ok(
      plan.notes.some((n) => /inspect motion --track/.test(n)),
      plan.notes.join("\n"),
    );
  });

  it("leaves check animation out when only hover transitions move (it measures what plays from load)", () => {
    const g = base(chooseGates({ ...none, text: 10, transitionRules: 3 }));
    assert.ok(g.includes("check motion"));
    assert.ok(!g.includes("check animation"));
  });
});

describe("scanCssText: a stylesheet the page could not read, read as text", () => {
  it("finds width queries, a dark theme, reduced motion and motion rules", () => {
    const sheet = scanCssText(`
      /* @media (max-width: 1px) is a comment */
      .a { transition: opacity 200ms; }
      .b { animation: rise 1s ease-out; } .c { animation: none; }
      @media (max-width: 720px) { .a { color: red } }
      @media (min-width: 60em) and (prefers-color-scheme: dark) { .b { color: white } }
      @media (prefers-reduced-motion: reduce) { * { animation: none } }`);
    assert.deepEqual(sheet.widthQueries, [720, 960]);
    assert.equal(sheet.darkScheme, true);
    assert.equal(sheet.reducedMotionQuery, true);
    assert.equal(sheet.animationRules, 1);
    assert.equal(sheet.transitionRules, 1);
    const merged = mergeSheet({ ...none, widthQueries: [720], unreadableSheets: 1 }, sheet);
    assert.deepEqual(merged.widthQueries, [720, 960]);
    assert.equal(merged.unreadableSheets, 0);
  });
});

/** The gates check auto can choose, as the judgment logs name them. */
const CHOOSABLE = [
  "check integrity",
  "check a11y contrast",
  "check design",
  "check composition",
  "check color",
  "check interactions",
  "check a11y focus",
  "check a11y touch",
  "check breakpoints",
  "check scroll",
  "check animation",
  "check motion",
];
/**
 * Where a log ran a gate check auto leaves out, and why that is right: magazine's motion is hover
 * and :target transitions only, and each of its seven check animation runs evaluated 0 animations.
 */
const KNOWN: Record<string, string[]> = { magazine: ["check animation"] };

async function plan(page: string): Promise<{ gates: { gate: string }[] }> {
  const lines: string[] = [];
  const log = console.log;
  console.log = (m: string) => lines.push(String(m));
  try {
    assert.equal(await main([page, "--plan", "--json"]), 0);
  } finally {
    console.log = log;
  }
  return JSON.parse(lines.join("\n"));
}

describe("check auto on the demo sites: it chooses what their judgment logs ran", () => {
  for (const site of ["checkout", "dashboard", "docs", "kanban", "magazine", "shop"]) {
    it(site, { timeout: 60_000 }, async () => {
      const db = new DatabaseSync(join(ROOT, "examples/sites", site, "judgment.sqlite"), { readOnly: true });
      const ran = new Set<string>();
      for (const row of db.prepare("select json from events where kind = 'gate'").all() as { json: string }[]) {
        const cmd = (JSON.parse(row.json) as { cmd: string }).cmd.replace(/^vlmkit /, "");
        for (const g of CHOOSABLE) if (cmd === g || cmd.startsWith(`${g} `)) ran.add(g);
      }
      const chosen = new Set(
        (await plan(join(ROOT, "examples/sites", site, "index.html"))).gates.map((g) => g.gate.replace(/ --.*$/, "")),
      );
      const missed = [...ran].filter((g) => !chosen.has(g) && !(KNOWN[site] ?? []).includes(g));
      assert.deepEqual(missed, [], `${site}: the log ran ${missed.join(", ")} and check auto did not choose it`);
    });
  }
});

describe("check auto, run", () => {
  it(
    "runs the chosen gates in parallel, the style gates from one snapshot, faster than one by one",
    { timeout: 240_000 },
    async () => {
      const lines: string[] = [];
      const log = console.log;
      console.log = (m: string) => lines.push(String(m));
      let code: number;
      try {
        code = await main([join(ROOT, "fixtures/color-scheme/follows-os.html"), "--json"]);
      } finally {
        console.log = log;
      }
      const r = JSON.parse(lines.join("\n")) as {
        jobs: { gate: string; exitCode: number }[];
        wallMs: number;
        serialMs: number;
        gates: { gate: string }[];
      };
      // The page breaks only in its dark theme: the dark runs fail, everything else passes.
      const failed = r.jobs.filter((j) => j.exitCode !== 0).map((j) => j.gate);
      assert.deepEqual(failed.sort(), [
        "check a11y contrast --color-scheme dark",
        "check integrity --color-scheme dark",
      ]);
      assert.equal(code!, 1);
      assert.ok(r.jobs.some((j) => j.gate.startsWith("check design --from")));
      assert.ok(r.wallMs < r.serialMs, `wall ${r.wallMs} against ${r.serialMs} one by one`);
    },
  );
});
