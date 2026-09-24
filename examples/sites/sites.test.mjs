/**
 * Every published judgment log, held to what its page claims.
 *
 * A log page says "this is how the site was judged", and the claim is only as good as the log
 * behind it. So for each page the Pages site publishes with a log: the log is complete by its own
 * `check` and ends in `done`, its `judgment.sqlite` holds every gate output it names and exactly
 * the screens it keeps (a finished round's one walk per width, nothing let go left behind), and
 * the committed `JUDGMENT.md` is what the log renders to today. The gallery is held to the logs the
 * same way — its numbers are the logs' numbers.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";
import { judgmentPageUrl, siteSections } from "../../scripts/build-pages.mjs";
import { galleryEntries, renderGallery } from "./gallery.mjs";
import { checkLog, keptScreens, logPaths, readLog, readOutputs, renderSite, storedScreens } from "./judge.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");

/** The demo sites the briefs asked for. A brief without a published site is a gap, not a skip. */
const BRIEFED = readdirSync(join(HERE, "briefs"))
  .map((file) => file.replace(/\.md$/, ""))
  .filter((name) => name !== "landing-review")
  .sort();

const logged = siteSections.filter((section) => existsSync(logPaths(join(REPO, section.sourceDir)).db));

describe("the demo sites", () => {
  it("publishes one site per brief, under /sites/<name>/", () => {
    const published = siteSections
      .filter((section) => section.sourceDir.startsWith("examples/sites/"))
      .map((section) => ({ name: section.sourceDir.slice("examples/sites/".length), basePath: section.basePath }));
    assert.deepEqual(published.map((p) => p.name).sort(), BRIEFED);
    for (const { name, basePath } of published) assert.equal(basePath, `sites/${name}`);
  });

  it("gives every demo site and the landing page a judgment log", () => {
    const ids = logged.map((section) => section.id);
    assert.ok(ids.includes("intro"), "the landing page has a log");
    for (const name of BRIEFED) assert.ok(ids.includes(`sites-${name}`), `${name} has a log`);
  });

  for (const section of siteSections.filter((s) => s.sourceDir.startsWith("examples/sites/"))) {
    it(`${section.id} ships a README and the copy manifest it was checked against`, () => {
      for (const file of ["index.html", "README.md", "copy.txt"]) {
        assert.ok(existsSync(join(REPO, section.sourceDir, file)), `${section.sourceDir}/${file}`);
      }
    });
  }
});

describe("each judgment log", () => {
  for (const section of logged) {
    const siteDir = join(REPO, section.sourceDir);
    const events = readLog(siteDir);

    it(`${section.id}: is complete by its own check, and ends in done`, () => {
      assert.deepEqual(checkLog(events), []);
      // A recode is bookkeeping about the files, appended after the judging ended.
      const judged = events.filter((e) => e.kind !== "recode");
      assert.equal(judged.at(-1).kind, "done", "the last judgment in the log is its done");
    });

    it(`${section.id}: holds every gate output it names, and exactly the screens it keeps`, () => {
      const outputs = [...readOutputs(siteDir).keys()].sort();
      assert.deepEqual(outputs, events.filter((e) => e.kind === "gate").map((g) => g.output).sort(), "one output per gate run");
      // A screen the log let go that is still in the database is 100 KB nobody publishes; a kept one
      // missing is a picture the log page promises and cannot show.
      assert.deepEqual(storedScreens(siteDir), [...keptScreens(events)].sort(), "the screens in judgment.sqlite are the ones the log keeps");
    });

    it(`${section.id}: its committed JUDGMENT.md is what the log renders to`, () => {
      const { markdown } = renderSite(siteDir, { pageUrl: judgmentPageUrl(section.sourceDir) });
      assert.equal(readFileSync(join(siteDir, "JUDGMENT.md"), "utf8"), markdown, "JUDGMENT.md is stale — run judge.mjs <site> render");
    });
  }
});

describe("the gallery", () => {
  it("is what the logs render to today", () => {
    assert.equal(
      readFileSync(join(HERE, "index.html"), "utf8"),
      renderGallery(galleryEntries()),
      "examples/sites/index.html is stale — run node examples/sites/gallery.mjs",
    );
  });

  it("links every logged page to its site and its log", () => {
    const html = readFileSync(join(HERE, "index.html"), "utf8");
    for (const entry of galleryEntries().filter((e) => e.summary)) {
      assert.ok(html.includes(`href="${entry.site}"`), `${entry.id} site link`);
      assert.ok(html.includes(`href="${entry.log}"`), `${entry.id} log link`);
    }
  });
});
