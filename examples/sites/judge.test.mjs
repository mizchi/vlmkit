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
  displayCommand,
  gateSummary,
  keptShots,
  logPaths,
  nextOffset,
  parseShotArgs,
  publishedFiles,
  publishedJudgment,
  readLog,
  readOutputs,
  readScreen,
  renderHtml,
  renderMarkdown,
  renderSite,
  stoppedShort,
  storedScreens,
  tileFile,
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
    // A fix later found to be a misdiagnosis is closed by saying so after it, not by a verify.
    const misread = [...baseLog(), { kind: "defect", id: "D1", round: "R1", from: "G1", by: "gate", text: "x" }];
    misread.push({ kind: "fix", id: "F1", round: "R1", defect: "D1", text: "y" });
    misread.push({ kind: "note", id: "N1", round: "R1", about: "D1", noteKind: "false-positive", text: "the gate was wrong" });
    assert.deepEqual(checkLog(misread), []);
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

  it("does not take a walk the tile cap cut short as the round's full page", () => {
    // The landing page's fourth round: a phone walk stopped at 16 screens of 14008px, above the
    // footer the round had changed, and the log would have called the page seen.
    const events = baseLog().map((e) => (e.id === "S2" ? { ...e, pageHeight: 4000, stoppedShort: true } : e));
    assert.deepEqual(checkLog(events), [
      "the last round (R1)'s full-page shot at phone width, S2, stopped at 3 screens before the page ended — " +
        "shot <page> --full --viewport mobile --max-tiles 7",
    ]);
    const walked = { ...events.find((e) => e.id === "S2"), id: "S3", stoppedShort: undefined };
    delete walked.stoppedShort;
    events.push(walked, { kind: "look", id: "L3", round: "R1", shot: "S3", tile: null, text: "x".repeat(MIN_LOOK_CHARS) });
    // Without the flag (a log from before it was recorded), the last screen says where the walk ended.
    assert.equal(stoppedShort(walked), true, "3 screens of 800px from 0 do not reach 4000px");
    walked.tiles = walked.tiles.map((t, i) => ({ ...t, scrollY: [0, 1600, 3200][i] }));
    assert.equal(stoppedShort(walked), false, "the last screen at 3200 ends at the page's 4000px");
    assert.deepEqual(checkLog(events), [], "a complete walk at the same width closes it");
    assert.equal(stoppedShort({ ...walked, mode: "element" }), false, "only a full-page walk can stop short");
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

describe("keptShots", () => {
  /** Two rounds, and a done that closes both: each has walks at every width, a dark one, a close-up. */
  function closedLog() {
    const walk = (id, round, width, extra = {}) => ({
      kind: "shot",
      id,
      round,
      page: "index.html",
      mode: "full",
      dark: false,
      viewport: { name: "x", width, height: 800 },
      pageHeight: 1600,
      tiles: [{ file: `shots/${id}-1.webp`, w: width, h: 800, scrollY: 0 }, { file: `shots/${id}-2.webp`, w: width, h: 800, scrollY: 800 }],
      steps: [],
      errors: [],
      ...extra,
    });
    return [
      { kind: "init", title: "t" },
      { kind: "round", id: "R1", actor: "builder", title: "first draft" },
      walk("S1", "R1", 1280),
      walk("S2", "R1", 375),
      walk("S3", "R1", 1280, { dark: true }),
      walk("S4", "R1", 1280, { mode: "element", element: ".card", tiles: [{ file: "shots/S4-1.webp", w: 300, h: 200 }] }),
      { kind: "round", id: "R2", actor: "builder", title: "fix pass" },
      walk("S5", "R2", 1280, { page: "index.html?theme=dark" }),
      walk("S6", "R2", 768),
      walk("S7", "R2", 375, { stoppedShort: true }),
      walk("S8", "R2", 375),
      walk("S9", "R2", 375, { stoppedShort: true }),
      { kind: "done", round: "R2", text: "done" },
    ];
  }

  it("keeps every shot until a done closes its round", () => {
    const open = closedLog().filter((e) => e.kind !== "done");
    assert.deepEqual([...keptShots(open)].sort(), ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"]);
  });

  it("keeps one full-page walk per width of each closed round: the page as a visitor lands on it, whole", () => {
    // R1: the light desktop walk over the later dark one, the phone walk; never the close-up.
    // R2: the dark-query walk when it is the only desktop one, the tablet walk, and the last phone
    // walk that reached the end over the two the tile cap cut short.
    assert.deepEqual([...keptShots(closedLog())].sort(), ["S1", "S2", "S5", "S6", "S8"]);
    assert.deepEqual(publishedFiles(closedLog()), [
      "judgment/index.html",
      ...["S1", "S2", "S5", "S6", "S8"].flatMap((id) => [`judgment/shots/${id}-1.webp`, `judgment/shots/${id}-2.webp`]),
    ]);
  });

  it("keeps whatever was shot after the last done, the start of the next round's work", () => {
    const events = [...closedLog(), { kind: "round", id: "R3", actor: "reviewer", title: "review" }];
    events.push({ ...closedLog().find((e) => e.id === "S4"), id: "S10", round: "R3" });
    assert.ok(keptShots(events).has("S10"));
    assert.ok(!keptShots(events).has("S4"));
  });

  it("says on the page and in the Markdown which shots kept no pictures, and links the rest", () => {
    const events = closedLog();
    const html = renderHtml(events);
    assert.match(html, /id="S4">(?:(?!<\/article>).)*1 screen\(s\), looked at when taken; not kept once the round was done/s);
    assert.doesNotMatch(html, /src="shots\/S4-1\.webp"/, "no picture for a screen the log let go");
    assert.match(html, /src="shots\/S1-1\.webp"/);
    assert.match(html, /screens in 9 shots, 10 kept/);
    const md = renderMarkdown(events, { pageUrl: "https://example.test/judgment/" });
    assert.match(md, /- \*\*S4\*\* .* \(screens not kept\)$/m);
    assert.match(md, /- \*\*S1\*\* .* \(\[screens\]\(https:\/\/example\.test\/judgment\/#S1\)\)$/m);
    assert.doesNotMatch(md, /<img/, "the Markdown carries no pictures");
  });
});

describe("tileFile / publishedFiles / displayCommand", () => {
  it("resolves a JPEG-era screen to its WebP once the log says it was recoded", () => {
    const events = baseLog();
    assert.equal(tileFile(events, "shots/S1-1.jpg"), "shots/S1-1.jpg");
    assert.deepEqual(publishedFiles(events).slice(0, 2), ["judgment/index.html", "judgment/shots/S1-1.jpg"]);
    events.push({ kind: "recode", from: "jpg", to: "webp", quality: 0.75, count: 5, bytesBefore: 10, bytesAfter: 5 });
    assert.equal(tileFile(events, "shots/S1-1.jpg"), "shots/S1-1.webp");
    assert.equal(tileFile(events, "shots/S9-1.webp"), "shots/S9-1.webp", "a screen taken as WebP stays as it is");
    assert.equal(publishedFiles(events).length, 1 + 2 + 3);
  });

  it("shows a recorded command without this checkout's absolute path", () => {
    assert.equal(
      displayCommand(`vlmkit check a11y contrast 'file://${REPO}/examples/sites/docs/index.html?theme=dark'`),
      "vlmkit check a11y contrast 'file://$PWD/examples/sites/docs/index.html?theme=dark'",
    );
  });

  it("renders a command the same on every machine, whoever recorded it", () => {
    // The logs were recorded at /home/user/vlmkit and CI renders them from /home/runner/work/…:
    // replacing only this checkout's root showed the recording machine's path there, and every
    // committed log page with a file:// command read as stale in CI.
    assert.equal(
      displayCommand("vlmkit check animation 'file:///Users/someone/src/vlmkit/examples/sites/magazine/index.html#note-2'"),
      "vlmkit check animation 'file://$PWD/examples/sites/magazine/index.html#note-2'",
    );
    assert.equal(
      displayCommand("vlmkit check copy index.html --manifest /home/elsewhere/vlmkit/examples/sites/docs/copy.txt"),
      "vlmkit check copy index.html --manifest examples/sites/docs/copy.txt",
    );
    // Outside the repository, and a URL's path, stay as they were typed.
    const scratch = "vlmkit check a11y contrast index.html --output-dir /tmp/scratch/a11y-contrast";
    assert.equal(displayCommand(scratch), scratch);
    const url = "vlmkit check integrity http://127.0.0.1:4190/sites/docs/";
    assert.equal(displayCommand(url), url);
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
    const saved = readOutputs(site).get(g1.output);
    assert.ok(!saved.includes("\x1b["), "the kept output has no colour codes");
    assert.match(saved, /args: check stub index\.html/);
    assert.ok(!existsSync(join(site, "judgment", "gates")), "an output lives in the database, not in a file of its own");
  });

  it("takes a full page as screens that step short of the pinned header and bar", () => {
    const run = judge("shot", "index.html", "--full", "--viewport", "desktop");
    assert.equal(run.status, 0, run.stderr);
    const shot = readLog(site).filter((e) => e.kind === "shot").at(-1);
    assert.equal(shot.pageHeight, 1900);
    // 800 tall, 100 pinned on top and 50 at the bottom: each step is 650 and the last is flush.
    assert.deepEqual(shot.tiles.map((t) => t.scrollY), [0, 650, 1100]);
    assert.deepEqual(shot.tiles[0].insets, { top: 100, bottom: 50 });
    for (const tile of shot.tiles) {
      // The log holds the screen; the file the builder Reads is its export, byte for byte.
      const file = join(site, "judgment", tile.file);
      assert.ok(existsSync(file), `${tile.file} is exported`);
      assert.ok(readScreen(site, tile.file).equals(readFileSync(file)), `${tile.file} is the screen the log holds`);
      assert.ok(run.stdout.includes(file), "the shot prints the path to Read");
    }
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

  it("lets go of the screens a finished round does not keep, and will not take a look at them after", () => {
    // R1 walked the page at desktop (S1) and phone (S3) width and took one close-up (S2).
    assert.deepEqual([...keptShots(readLog(site))].sort(), ["S1", "S3"]);
    const stored = storedScreens(site);
    assert.ok(!stored.includes("shots/S2-1.webp"), "the close-up went");
    assert.ok(!existsSync(join(site, "judgment", "shots", "S2-1.webp")), "and so did its export");
    for (const id of ["S1", "S3"]) {
      for (const tile of readLog(site).find((e) => e.id === id).tiles) assert.ok(stored.includes(tile.file), `${tile.file} kept`);
    }
    assert.ok(readLog(site).some((e) => e.kind === "look" && e.shot === "S2"), "what was seen in it stays");
    assert.match(judge("look", "S2", "x".repeat(100)).stderr, /S2's screens went when its round was done/);
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
  it("does not count a closed drawer, pinned but off the side of the screen, as an inset", () => {
    const page = join(root, "site", "drawer.html");
    writeFileSync(page, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>d</title><style>
      body{margin:0} header{position:sticky;top:0;height:60px;background:#123}
      nav{position:fixed;top:0;left:0;width:300px;height:100%;transform:translateX(-100%);background:#eee}
      section{height:1600px}</style></head><body><header></header><nav>menu</nav><section>a</section></body></html>`);
    const run = judge("shot", "drawer.html", "--full", "--viewport", "375x800");
    assert.equal(run.status, 0, run.stderr);
    const shot = readLog(site).filter((e) => e.kind === "shot").at(-1);
    assert.deepEqual(shot.tiles[0].insets, { top: 60, bottom: 0 }, "only the header is pinned on screen");
    assert.ok(shot.tiles[0].file.endsWith(".webp"), "screens are WebP");
    judge("look", shot.id, "The sticky header is the only pinned band; the closed drawer never appears on screen here.");
  });

  it("takes text after -- as text, and answers --help on any command", () => {
    const fix = judge("note", "--kind", "decision", "--", "--measure 42rem -> 36rem, the brief's 70 characters");
    assert.equal(fix.status, 0, fix.stderr);
    assert.equal(readLog(site).filter((e) => e.kind === "note").at(-1).text, "--measure 42rem -> 36rem, the brief's 70 characters");
    assert.match(judge("note", "--measure", "x").stderr, /goes after --/);
    const help = judge("defect", "--help");
    assert.equal(help.status, 0);
    assert.match(help.stdout, /defect --from L#\|G#/);
  });

  it("says in the shot's own line, and in the log, when the tile cap stopped a walk", () => {
    const run = judge("shot", "index.html", "--full", "--viewport", "desktop", "--max-tiles", "2");
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stdout, /^\[judge\] S\d+ .*2 screen\(s\) of 1900px, STOPPED SHORT of the end \(--max-tiles 2\)/m);
    const shot = readLog(site).filter((e) => e.kind === "shot").at(-1);
    assert.equal(shot.stoppedShort, true);
    assert.equal(stoppedShort(shot), true);
    const whole = judge("shot", "index.html", "--full", "--viewport", "desktop");
    assert.doesNotMatch(whole.stdout, /STOPPED SHORT/);
    assert.equal("stoppedShort" in readLog(site).filter((e) => e.kind === "shot").at(-1), false, "a complete walk records nothing extra");
  });

  it("keeps the whole log in one SQLite file that any SQLite reader can query", () => {
    const events = readLog(site);
    const { DatabaseSync } = process.getBuiltinModule("node:sqlite");
    const db = new DatabaseSync(logPaths(site).db, { readOnly: true });
    try {
      // The columns beside the JSON are what `sqlite3 judgment.sqlite "select … where kind = 'gate'"` reads.
      const rows = db.prepare("SELECT kind, id, round FROM events ORDER BY seq").all().map((r) => ({ ...r }));
      assert.deepEqual(
        rows,
        events.map((e) => ({ kind: e.kind, id: e.id ?? null, round: e.kind === "round" ? e.id : (e.round ?? null) })),
      );
      const outputs = db.prepare("SELECT count(*) AS n FROM outputs").get().n;
      assert.equal(outputs, events.filter((e) => e.kind === "gate").length, "one output per gate run");
    } finally {
      db.close();
    }
    // The published half is read out of the database: the page, and the screens the log keeps.
    const published = publishedJudgment(site);
    assert.deepEqual(published.map((p) => p.path), publishedFiles(events));
    const screen = published.find((p) => p.path.endsWith(".webp"));
    assert.ok(screen.bytes().equals(readScreen(site, screen.path.slice("judgment/".length))));
    assert.equal(published[0].bytes().toString("utf8"), renderSite(site).html);
    assert.doesNotMatch(judge("status").stderr, /ExperimentalWarning/, "node:sqlite's warning stays out of every command's output");
  });
});
