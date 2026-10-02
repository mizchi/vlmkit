import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, it } from "vite-plus/test";
import type { Browser } from "playwright";
import { launchBrowser } from "@mizchi/vlmkit-core/browser-launch.ts";
import { buildCases, caseSeed, type BuiltCase } from "./cases.ts";
import { oracleReply } from "./score.ts";
import { agentZoom, exportPacket, importAnswers } from "./agent-packet.ts";
import { DEFAULT_IMAGE_BUDGET } from "@mizchi/vlmkit-ai/zoom.ts";
import { PNG } from "pngjs";
import { comparisons, report, selfCheck, type SavedAnswer } from "./zoom-accuracy.ts";

const FIXTURES = ["page.html", "dashboard.html"].map((f) => resolve("fixtures/css-challenge", f));

describe("zoom accuracy cases, built from real renders", () => {
  let browser: Browser;
  let dir: string;
  let cases: BuiltCase[];

  beforeAll(async () => {
    browser = await launchBrowser();
    dir = await mkdtemp(join(tmpdir(), "zoom-accuracy-"));
    ({ cases } = await buildCases(browser, {
      fixtures: FIXTURES, kinds: ["text", "color", "offset", "none"], seed: 1, deviceScaleFactor: 2, viewportWidth: 1440, outDir: dir,
    }));
  }, 120_000);
  afterAll(async () => {
    await browser?.close();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("plants one change per kind per fixture, each a small patch of the page", () => {
    assert.equal(cases.length, 8);
    for (const c of cases) {
      if (c.expected.kind === "none") { assert.equal(c.diffBox, null, c.id); continue; }
      const d = c.diffBox!;
      const share = ((d.x2 - d.x1) * (d.y2 - d.y1)) / (c.page.width * c.page.height);
      assert.ok(share > 0 && share < 0.01, `${c.id}: the change covers ${(share * 100).toFixed(3)}% of the page`);
    }
  });

  it("the pixels that changed are where the planted element was", () => {
    for (const c of cases) {
      if (!c.targetBox || !c.diffBox) continue;
      const t = c.targetBox, d = c.diffBox, slack = 8;
      const overlaps = d.x1 < t.x2 + slack && d.x2 > t.x1 - slack && d.y1 < t.y2 + slack && d.y2 > t.y1 - slack;
      assert.ok(overlaps, `${c.id}: diff ${JSON.stringify(d)} is not at target ${JSON.stringify(t)}`);
    }
  });

  it("text cases change exactly one digit, inside the token the scorer reads", () => {
    for (const c of cases) {
      if (c.expected.kind !== "text") continue;
      const { oldText, newText, oldToken, newToken } = c.expected;
      assert.equal(oldText.length, newText.length);
      assert.equal([...oldText].filter((ch, i) => ch !== newText[i]).length, 1, c.id);
      assert.notEqual(oldToken, newToken);
      assert.ok(newText.includes(newToken) && oldText.includes(oldToken));
    }
  });

  it("the self-check holds: the oracle scores every case, an always-unchanged reader only the none cases", () => {
    assert.deepEqual(selfCheck(cases), { oracle: 8, blind: 2, none: 2 });
  });

  it("scores saved answers per arm and pairs the two arms on the same cases", () => {
    const answer = (arm: "single" | "zoom", c: BuiltCase, text: string): SavedAnswer => ({
      model: "m", arm, caseId: c.id, answer: text, promptTokens: 0, completionTokens: 0, costUsd: 0, latencyMs: 0, zooms: arm === "zoom" ? 1 : 0, turns: 1,
    });
    const blind = JSON.stringify({ changed: false });
    const answers = [
      ...cases.map((c) => answer("single", c, blind)),
      ...cases.map((c) => answer("zoom", c, oracleReply(c))),
    ];
    const reports = report(cases, answers);
    assert.deepEqual(reports.map((r) => [r.arm, r.summary.correct]), [["single", 2], ["zoom", 8]]);
    const [comp] = comparisons(reports);
    assert.deepEqual([comp!.fixed, comp!.broke, comp!.bothRight], [6, 0, 2]);
    assert.ok(comp!.p < 0.05);
  });

  it("agent packet: nothing in it names a case, and its images are what a provider would be sent", async () => {
    const packet = join(dir, "packet-zoom");
    await exportPacket(cases, dir, packet, "zoom", { budget: DEFAULT_IMAGE_BUDGET, coordinates: "normalized", maxZooms: 2, seed: 1 }, "zoom-helper");
    const files: string[] = [];
    const walk = async (d: string) => {
      for (const e of await readdir(d, { withFileTypes: true })) e.isDirectory() ? await walk(join(d, e.name)) : files.push(join(d, e.name));
    };
    await walk(packet);
    const leaks = [...cases.map((c) => c.id), "dashboard", "fixtures", "css-challenge", "cases.json", "agent-map"];
    for (const f of files) {
      const rel = f.slice(packet.length);
      const text = f.endsWith(".png") ? "" : (await readFile(f, "utf8")).replace(dir, "<bench>");
      for (const word of leaks) {
        assert.ok(!rel.includes(word), `${rel} names "${word}"`);
        assert.ok(!text.includes(word), `${rel} contains "${word}"`);
      }
    }
    const first = files.find((f) => f.endsWith("image1.png"))!;
    const view = PNG.sync.read(await readFile(first));
    assert.ok(Math.max(view.width, view.height) <= DEFAULT_IMAGE_BUDGET.maxEdge && view.width * view.height <= DEFAULT_IMAGE_BUDGET.maxPixels);

    const task = "task-1";
    const z1 = await agentZoom(packet, task, 1, [0, 0, 500, 500]);
    assert.match(z1.text, /magnified/);
    const crop = PNG.sync.read(await readFile(z1.png!));
    assert.ok(crop.width > view.width / 2, "the crop is magnified, not a slice of the view");
    await agentZoom(packet, task, 0, [100, 100, 200, 200]);
    assert.match((await agentZoom(packet, task, 1, [0, 0, 10, 10])).text, /budget used up/);
    assert.match((await agentZoom(packet, "task-99", 0, [0, 0, 10, 10])).text, /no task/);

    // An agent that answers like the oracle scores like the oracle, through the import.
    const map = JSON.parse(await readFile(join(dir, "agent-map-zoom.json"), "utf8")) as { tasks: Record<string, string> };
    const byId = new Map(cases.map((c) => [c.id, c]));
    const answers = Object.fromEntries(Object.entries(map.tasks).map(([t, id]) => [t, oracleReply(byId.get(id)!)]));
    delete answers["task-2"];
    await writeFile(join(packet, "answers.json"), JSON.stringify(answers));
    const r = await importAnswers(dir, join(packet, "answers.json"), "zoom", "agent");
    assert.deepEqual([r.imported, r.missing], [7, ["task-2"]]);
    const saved: SavedAnswer[] = [];
    for (const f of await readdir(join(dir, "answers", "agent", "zoom"))) saved.push(JSON.parse(await readFile(join(dir, "answers", "agent", "zoom", f), "utf8")));
    const [rep] = report(cases, saved);
    assert.equal(rep!.summary.correct, 7, "the missing task scores as wrong, not as absent");
    assert.equal(saved.find((a) => a.caseId === map.tasks[task])!.zooms, 2, "zooms are counted from the helper's log");
  });

  it("variants: colours are seeded hues, not a palette; shifts are 1-6px in any direction", async () => {
    const vdir = await mkdtemp(join(tmpdir(), "zoom-accuracy-v-"));
    try {
      const { cases: vs } = await buildCases(browser, {
        fixtures: FIXTURES, kinds: ["color", "offset", "none"], seed: 3, deviceScaleFactor: 2, viewportWidth: 1440, outDir: vdir, variants: 3,
      });
      assert.equal(vs.filter((c) => c.expected.kind === "none").length, 2, "one none per fixture, whatever the variants");
      const colors = vs.flatMap((c) => (c.expected.kind === "color" ? [c.expected.newColor] : []));
      assert.ok(colors.length >= 5 && new Set(colors).size === colors.length, `distinct planted colours: ${colors.join(" ")}`);
      for (const c of vs) {
        if (c.expected.kind !== "offset") continue;
        const { dx, dy } = c.expected;
        assert.ok((dx === 0) !== (dy === 0) && Math.abs(dx + dy) >= 1 && Math.abs(dx + dy) <= 6, `${c.id}: ${dx},${dy}`);
      }
    } finally {
      await rm(vdir, { recursive: true, force: true });
    }
  }, 120_000);

  it("never plants under an overlay: the only readable small text is the one chosen", async () => {
    const odir = await mkdtemp(join(tmpdir(), "zoom-accuracy-o-"));
    try {
      const page = join(odir, "overlay.html");
      const rows = Array.from({ length: 12 }, (_, i) => `<p style="font-size:12px">Row ${i + 10} updated ${i + 2} days ago</p>`).join("");
      await writeFile(page, `<!doctype html><body style="margin:0;font-family:sans-serif">
        <main style="filter:blur(3px)">${rows}</main>
        <div style="position:fixed;inset:0;background:rgba(0,0,0,.3);backdrop-filter:blur(4px)"></div>
        <dialog open style="position:fixed;top:40%;z-index:2"><p style="font-size:12px">Plan 42 of 90</p></dialog></body>`);
      const { cases: os } = await buildCases(browser, { fixtures: [page], kinds: ["text"], seed: 5, deviceScaleFactor: 2, viewportWidth: 800, outDir: odir, variants: 3 });
      assert.ok(os.length > 0);
      for (const c of os) assert.ok(c.expected.kind === "text" && /^Plan \d\d of \d\d$/.test(c.expected.oldText), `${c.id} planted in "${c.expected.kind === "text" ? c.expected.oldText : ""}"`);
    } finally {
      await rm(odir, { recursive: true, force: true });
    }
  }, 60_000);

  it("the seed per case depends only on the seed and the case id", () => {
    assert.equal(caseSeed(1, "page-text"), caseSeed(1, "page-text"));
    assert.notEqual(caseSeed(1, "page-text"), caseSeed(2, "page-text"));
    assert.notEqual(caseSeed(1, "page-text"), caseSeed(1, "page-color"));
  });
});
