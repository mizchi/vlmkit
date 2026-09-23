/**
 * The judgment log's own contract. What it promises a reader is narrow and checkable: a gate run
 * is kept verbatim with its exit code, a look is tied to a screenshot that exists, a defect names
 * what found it, and `check` refuses a log that has not looked at what it took or closed what it
 * found. Everything here runs the CLI the way an agent does, against a stub vlmkit where a real
 * gate would only add minutes, and against real Chromium where the screenshot IS the subject.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, it } from "vitest";
import {
  MIN_LOOK_CHARS,
  checkLog,
  clean,
  gateSummary,
  nextOffset,
  parseShotArgs,
  readLog,
  renderHtml,
  renderSite,
} from "./judge.mjs";

const JUDGE = join(dirname(fileURLToPath(import.meta.url)), "judge.mjs");
const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("nextOffset", () => {
  it("steps a full screen when nothing is pinned, and ends flush with the page", () => {
    assert.equal(nextOffset(0, 2400, 800), 800);
    assert.equal(nextOffset(800, 2400, 800), 1600);
    assert.equal(nextOffset(1600, 2400, 800), null);
    assert.equal(nextOffset(800, 2000, 800), 1200, "the last screen sits flush rather than past the end");
  });

  it("steps short by a pinned header and footer, so nothing scrolls under them unseen", () => {
    assert.equal(nextOffset(0, 5000, 800, { top: 120, bottom: 60 }), 620);
  });

  it("never steps less than half a screen, whatever is pinned", () => {
    assert.equal(nextOffset(0, 5000, 800, { top: 320, bottom: 320 }), 400);
  });

  it("returns null for a page that fits in one screen", () => {
    assert.equal(nextOffset(0, 600, 800), null);
  });
});

describe("parseShotArgs", () => {
  it("keeps the steps in the order they were given", () => {
    const options = parseShotArgs(["index.html", "--click", "#menu", "--press", "Tab", "--fill", "#q", "cups", "--wait", "200"]);
    assert.deepEqual(
      options.steps.map((s) => [s.do, s.arg, s.value]),
      [
        ["click", "#menu", undefined],
        ["press", "Tab", undefined],
        ["fill", "#q", "cups"],
        ["wait", "200", undefined],
      ],
    );
  });

  it("takes a viewport list, a preset or WxH", () => {
    const options = parseShotArgs(["index.html", "--viewport", "desktop,mobile,1024x700", "--full"]);
    assert.deepEqual(options.viewports.map((v) => [v.width, v.height]), [[1280, 800], [375, 812], [1024, 700]]);
    assert.equal(options.full, true);
  });

  it("defaults to one desktop viewport", () => {
    assert.deepEqual(parseShotArgs(["index.html"]).viewports.map((v) => v.name), ["desktop"]);
  });

  it("refuses what cannot be one shot", () => {
    assert.throws(() => parseShotArgs(["index.html", "--full", "--element", "header"]), /different shots/);
    assert.throws(() => parseShotArgs(["a.html", "b.html"]), /one page per shot/);
    assert.throws(() => parseShotArgs(["index.html", "--zoom", "2"]), /unknown shot flag/);
    assert.throws(() => parseShotArgs([]), /shot needs a page/);
  });
});

describe("clean", () => {
  it("strips colour, keeps what a \\r progress line finally showed, and drops this machine's path", () => {
    const raw = `\x1b[1mvlmkit\x1b[0m\nloading 10%\rloading 100%\nreport: ${REPO}/test-results/x/report.md\n`;
    assert.equal(clean(raw), "vlmkit\nloading 100%\nreport: test-results/x/report.md\n");
  });
});

describe("gateSummary", () => {
  it("prefers the gate's own verdict line, and falls back to the ledger headline without its local path", () => {
    assert.equal(gateSummary({ verdict: "verdict: CLEAN (0 fail)", headline: [] }), "verdict: CLEAN (0 fail)");
    assert.equal(
      gateSummary({ verdict: null, headline: [{ tool: "check-a11y-touch", level: "AAA", failures: 1, report: "/x/report.md" }] }),
      "level AAA · failures 1",
    );
  });
});

/** A minimal log, then variations on it, so each `check` rule is seen failing on its own. */
function baseLog() {
  const round = (id, extra = {}) => ({ kind: "round", id, t: "", actor: "builder", title: id, ...extra });
  const shot = (id, roundId, width, tiles) => ({
    kind: "shot",
    id,
    round: roundId,
    mode: "full",
    viewport: { name: "x", width, height: 800 },
    tiles: Array.from({ length: tiles }, (_, i) => ({ file: `shots/${id}-${i + 1}.jpg`, w: width, h: 800 })),
    steps: [],
    errors: [],
  });
  return [
    { kind: "init", title: "t" },
    round("R1"),
    { kind: "gate", id: "G1", round: "R1", cmd: "vlmkit check integrity index.html", exit: 0, headline: [] },
    shot("S1", "R1", 1280, 2),
    shot("S2", "R1", 375, 3),
    { kind: "look", id: "L1", round: "R1", shot: "S1", tile: null, text: "x".repeat(MIN_LOOK_CHARS) },
    { kind: "look", id: "L2", round: "R1", shot: "S2", tile: null, text: "x".repeat(MIN_LOOK_CHARS) },
  ];
}

describe("checkLog", () => {
  it("passes a log that looked at everything it took and ran a gate in its last round", () => {
    assert.deepEqual(checkLog(baseLog()), []);
  });

  it("names a shot nobody looked at, and the tiles a partial look missed", () => {
    const events = baseLog().filter((e) => e.id !== "L2");
    events.push({ kind: "look", id: "L3", round: "R1", shot: "S2", tile: 2, text: "x".repeat(MIN_LOOK_CHARS) });
    assert.deepEqual(checkLog(events), ["S2: tile(s) 1, 3 never looked at — look S2:1 …"]);
    const none = baseLog().filter((e) => e.id !== "L1");
    assert.match(checkLog(none)[0], /^S1 was never looked at/);
  });

  it("keeps a defect open until it is fixed and verified, or closed by a note that says why", () => {
    const events = [...baseLog(), { kind: "defect", id: "D1", round: "R1", from: "L1", by: "eye", text: "x" }];
    assert.match(checkLog(events)[0], /^D1 is open/);
    events.push({ kind: "fix", id: "F1", round: "R1", defect: "D1", text: "y" });
    assert.match(checkLog(events)[0], /^D1 was fixed \(F1\) and nothing checked it since/);
    events.push({ kind: "verify", id: "V1", round: "R1", defect: "D1", by: "G1" });
    // V1 is after F1 in the log, which is what counts — not the id of the evidence.
    assert.deepEqual(checkLog(events), []);

    const accepted = [...baseLog(), { kind: "defect", id: "D1", round: "R1", from: "G1", by: "gate", text: "x" }];
    accepted.push({ kind: "note", id: "N1", round: "R1", about: "D1", noteKind: "accepted", text: "on purpose" });
    assert.deepEqual(checkLog(accepted), []);
    const decision = [...baseLog(), { kind: "defect", id: "D1", round: "R1", from: "G1", by: "gate", text: "x" }];
    decision.push({ kind: "note", id: "N1", round: "R1", about: "D1", noteKind: "decision", text: "thinking" });
    assert.match(checkLog(decision)[0], /^D1 is open/, "a decision note is not a reason for leaving it");
  });

  it("wants the LAST round to have run a gate and looked at the whole page at both widths", () => {
    const events = [...baseLog(), { kind: "round", id: "R2", t: "", actor: "reviewer", title: "review" }];
    assert.deepEqual(checkLog(events), [
      "the last round (R2) ran no gate",
      "the last round (R2) has no full-page shot at desktop width — shot <page> --full --viewport desktop",
      "the last round (R2) has no full-page shot at phone width — shot <page> --full --viewport mobile",
    ]);
  });

  it("holds the last run of each command to exit 0 unless a note accepts it", () => {
    const events = baseLog();
    events.push({ kind: "gate", id: "G2", round: "R1", cmd: "vlmkit check color index.html", exit: 1, headline: [] });
    assert.match(checkLog(events)[0], /^G2 is the last run of `vlmkit check color index.html` and it exited 1/);
    events.push({ kind: "gate", id: "G3", round: "R1", cmd: "vlmkit check color index.html", exit: 0, headline: [] });
    assert.deepEqual(checkLog(events), [], "a later green run of the same command closes it");
    events.push({ kind: "gate", id: "G4", round: "R1", cmd: "vlmkit check a11y touch index.html", exit: 1, headline: [] });
    events.push({ kind: "note", id: "N1", round: "R1", about: "G4", noteKind: "false-positive", text: "why" });
    assert.deepEqual(checkLog(events), []);
  });
});

describe("renderHtml", () => {
  it("escapes what a gate printed and what a look said", () => {
    const events = [
      ...baseLog().map((e) => (e.id === "L1" ? { ...e, text: `<script>alert(1)</script> ${"x".repeat(80)}` } : e)),
    ];
    events[2] = { ...events[2], output: "gates/G1.txt", ms: 1000 };
    const html = renderHtml(events, { readOutput: () => "<img src=x onerror=alert(1)>" });
    assert.ok(!html.includes("<script>alert"), "look text is escaped");
    assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"), "gate output is escaped");
  });
});

describe("the CLI, end to end", () => {
  let root;
  let site;
  let stub;
  const judge = (...args) => {
    const input = typeof args.at(-1) === "object" ? args.pop().input : undefined;
    return spawnSync(process.execPath, [JUDGE, site, ...args], {
      encoding: "utf8",
      input,
      env: { ...process.env, JUDGE_VLMKIT: stub },
    });
  };

  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "judge-test-"));
    site = join(root, "site");
    mkdirSync(site);
    // A page with a sticky header and a pinned bottom bar, so the screen walk has insets to honour.
    writeFileSync(
      join(site, "index.html"),
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>t</title><style>
        body{margin:0;font:16px/1.5 sans-serif} header{position:sticky;top:0;min-height:100px;background:#123;color:#fff}
        nav{position:fixed;bottom:0;left:0;right:0;height:50px;background:#eee}
        section{height:900px;box-sizing:border-box;border-bottom:1px solid #999}
        ul{display:none;height:200px;margin:0} #menu[aria-expanded=true]+ul{display:block}
      </style></head><body><header><button id="menu" aria-expanded="false"
        onclick="this.setAttribute('aria-expanded','true')">Menu</button><ul><li>one</li></ul></header>
        <section>a</section><section>b</section><nav>bar</nav></body></html>`,
    );
    stub = join(root, "vlmkit-stub.mjs");
    writeFileSync(
      stub,
      `import { appendFileSync } from "node:fs";
       const args = process.argv.slice(2);
       const at = args.indexOf("--ledger");
       if (at >= 0) appendFileSync(args[at + 1], JSON.stringify({ tool: "check-stub", headline: { findings: 2 } }) + "\\n");
       process.stdout.write("\\x1b[1mvlmkit stub\\x1b[0m\\nverdict: \\x1b[33mDRIFT\\x1b[0m (2 finding(s))\\nargs: " + args.filter((a) => a !== "--ledger" && !a.endsWith(".jsonl")).join(" ") + "\\n");
       process.exit(args.includes("--fail") ? 1 : 0);`,
    );
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it("refuses to run before init, and before a round", () => {
    assert.match(judge("gate", "check", "x").stderr, /run init first/);
    assert.equal(judge("init", "--title", "Test site", "--pattern", "fixture").status, 0);
    assert.match(judge("gate", "check", "x").stderr, /start a round first/);
    assert.equal(judge("round", "first", "draft").status, 0);
  });

  it("keeps a gate run verbatim, with its exit code, and passes the exit code on", () => {
    const pass = judge("gate", "check", "stub", "index.html");
    assert.equal(pass.status, 0);
    assert.match(pass.stdout, /verdict: DRIFT \(2 finding\(s\)\)/, "the agent reads the output, without colour codes");
    const failing = judge("gate", "check", "stub", "index.html", "--fail");
    assert.equal(failing.status, 1, "a failing gate fails the judge call too");
    const [g1, g2] = readLog(site).filter((e) => e.kind === "gate");
    assert.equal(g1.cmd, "vlmkit check stub index.html");
    assert.equal(g1.exit, 0);
    assert.equal(g2.exit, 1);
    assert.equal(g1.verdict, "verdict: DRIFT (2 finding(s))");
    assert.deepEqual(g1.headline, [{ tool: "check-stub", findings: 2 }], "the headline comes from the run's own ledger line");
    const saved = readFileSync(join(site, "judgment", g1.output), "utf8");
    assert.ok(!saved.includes("\x1b["), "the kept output has no colour codes");
    assert.match(saved, /args: check stub index\.html/);
  });

  it("takes a full page as screens that step short of the pinned header and bar", () => {
    const run = judge("shot", "index.html", "--full", "--viewport", "desktop");
    assert.equal(run.status, 0, run.stderr);
    const shot = readLog(site).filter((e) => e.kind === "shot").at(-1);
    assert.equal(shot.pageHeight, 1900);
    // 800 tall, 100 pinned on top and 50 at the bottom: each step is 650 and the last is flush.
    assert.deepEqual(shot.tiles.map((t) => t.scrollY), [0, 650, 1100]);
    assert.deepEqual(shot.tiles[0].insets, { top: 100, bottom: 50 });
    for (const tile of shot.tiles) assert.ok(existsSync(join(site, "judgment", tile.file)), `${tile.file} exists`);
    assert.match(run.stdout, /Read every file above/);
  });

  it("runs the steps before the shutter, and shoots one element", () => {
    const run = judge("shot", "index.html", "--click", "#menu", "--element", "header", "--label", "menu open");
    assert.equal(run.status, 0, run.stderr);
    const shot = readLog(site).filter((e) => e.kind === "shot").at(-1);
    assert.equal(shot.mode, "element");
    assert.equal(shot.label, "menu open");
    assert.deepEqual(shot.steps, [{ do: "click", arg: "#menu" }]);
    assert.equal(shot.tiles[0].w, 1280);
    assert.ok(shot.tiles[0].h > 100, "the header grew when the menu opened");
    assert.match(judge("shot", "index.html", "--click", "#nope").stderr, /--click #nope/);
  });

  it("wants a look to say what was in the picture, and a defect to say what found it", () => {
    assert.match(judge("look", "S1", "fine").stderr, /at least \d+/);
    assert.match(judge("look", "S9", "x".repeat(100)).stderr, /no shot S9/);
    assert.match(judge("look", "S1:7", "x".repeat(100)).stderr, /has 3 tile\(s\)/);
    const text = "Three screens: the navy header stays on top, the grey bar at the bottom, the two sections run past both.";
    assert.equal(judge("look", "S1", "-", { input: text }).status, 0, "a look can come from a heredoc");
    assert.equal(judge("look", "S2", "The header with the menu open: one list item under the button, both in the header's navy band.").status, 0);
    assert.match(judge("defect", "--from", "S1", "x").stderr, /needs --from <L#\|G#>/);
    const defect = judge("defect", "--from", "L1", "--where", "nav", "The bottom bar has no top border and blends into the sections.");
    assert.equal(defect.status, 0);
    const recorded = readLog(site).find((e) => e.kind === "defect");
    assert.equal(recorded.by, "eye");
    assert.equal(recorded.from, "L1");
  });

  it("will not take evidence for a fix that was recorded before the fix", () => {
    assert.equal(judge("fix", "D1", "Gave the bar a 1px top border.").status, 0);
    assert.match(judge("verify", "D1", "--by", "L1").stderr, /recorded before F1/);
  });

  it("refuses done until the log is complete, then records it and renders", () => {
    const early = judge("done", "finished");
    assert.equal(early.status, 1);
    assert.match(early.stdout, /D1 was fixed \(F1\) and nothing checked it since/);
    assert.match(early.stdout, /G2 is the last run/);
    assert.match(early.stdout, /no full-page shot at phone width/);

    judge("gate", "check", "stub", "index.html", "--fail");
    judge("note", "--about", "G3", "--kind", "accepted", "The stub fails on purpose.");
    judge("shot", "index.html", "--full", "--viewport", "mobile");
    judge("look", "S3", "Phone width: the header and the bottom bar take a smaller share of the screen, sections are full width.");
    judge("look", "S1:2", "Second desktop screen after the fix: the bottom bar now has a visible hairline above it.");
    assert.equal(judge("verify", "D1", "--by", "L4").status, 0);
    const done = judge("done", "Fixture log for the tests.");
    assert.equal(done.status, 0, done.stdout + done.stderr);
    assert.ok(existsSync(join(site, "judgment", "index.html")));
    assert.ok(existsSync(join(site, "JUDGMENT.md")));
  });

  it("renders the same bytes from the same log", () => {
    const first = renderSite(site);
    const second = renderSite(site);
    assert.equal(first.html, second.html);
    assert.equal(first.markdown, second.markdown);
    assert.equal(readFileSync(join(site, "judgment", "index.html"), "utf8"), first.html);
    assert.match(first.markdown, /\| D1 \| eye \(L1 on S1\) \|/);
    assert.match(first.html, /defects found by eye/);
  });
});
