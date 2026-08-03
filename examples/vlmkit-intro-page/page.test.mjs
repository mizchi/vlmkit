import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const exampleDir = dirname(fileURLToPath(import.meta.url));

async function read(name) {
  return readFile(join(exampleDir, name), "utf8");
}

test("the intro page has a stable semantic product story", async () => {
  const html = await read("index.html");

  assert.match(html, /<html lang="ja"[^>]*>/);
  assert.match(html, /<title>vlmkit/);
  assert.match(html, /data-i18n="hero\.line1">「見た」ではなく、<\/span>/);
  assert.match(html, /data-i18n="hero\.line2">「測った」を。<\/span>/);
  assert.match(html, /id="workflow"/);
  assert.match(html, /id="commands"/);
  assert.match(html, /id="start"/);
  assert.match(html, /data-testid="hero-status"/);
  assert.match(html, /data-testid="install-command"/);
  assert.match(html, /data-testid="gate-matrix"/);
  assert.match(html, /npm install -D @mizchi\/vlmkit/);
  assert.match(html, /https:\/\/github\.com\/mizchi\/vlmkit/);
});

test("the first visible message identifies the page as vlmkit dogfood", async () => {
  const html = await read("index.html");

  assert.match(
    html,
    /data-testid="dogfood-notice"[^>]*>[\s\S]*このサイトは vlmkit 自身で生成、デバッグされています。/,
  );
  assert.ok(
    html.indexOf('data-testid="dogfood-notice"') < html.indexOf('<header class="site-header">'),
  );
});

test("the header exposes language, theme, and GitHub controls", async () => {
  const html = await read("index.html");

  assert.match(html, /data-testid="locale-toggle"/);
  assert.match(html, /data-testid="theme-toggle"/);
  assert.match(html, /data-theme="light"/);
  assert.match(html, /href="https:\/\/github\.com\/mizchi\/vlmkit"/);
});

test("the page is self-contained and includes responsive and keyboard states", async () => {
  const [html, css] = await Promise.all([read("index.html"), read("styles.css")]);

  assert.doesNotMatch(html, /(?:src|href)="https:\/\/(?!github\.com\/mizchi\/vlmkit)/);
  assert.match(css, /@media \(max-width:/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
});

test("the local server exposes every browser module as JavaScript", async () => {
  const server = await read("server.mjs");

  for (const moduleName of ["app.js", "content.js", "preferences.js", "scenarios.js"]) {
    assert.match(server, new RegExp(`\\["/${moduleName.replace(".", "\\.")}"`));
  }
});

test("the command deck exposes deterministic scenarios", async () => {
  const { commandScenarios, findCommandScenario } = await import("./scenarios.js");

  assert.deepEqual(commandScenarios.map(({ id }) => id), ["inspect", "snapshot", "ship"]);
  assert.equal(findCommandScenario("inspect")?.command, "vlmkit check integrity http://localhost:3000");
  assert.equal(findCommandScenario("missing"), null);
  assert.ok(commandScenarios.every(({ output }) => output.length >= 2));
});

test("locale content and display preferences have strict contracts", async () => {
  const [{ messages, translate }, { nextLocale, nextTheme, resolveLocale, resolveTheme }] =
    await Promise.all([import("./content.js"), import("./preferences.js")]);

  assert.deepEqual(Object.keys(messages.ja).sort(), Object.keys(messages.en).sort());
  assert.equal(
    translate("ja", "dogfood.message"),
    "このサイトは vlmkit 自身で生成、デバッグされています。",
  );
  assert.equal(
    translate("en", "dogfood.message"),
    "This site is generated and debugged with vlmkit itself.",
  );
  assert.equal(nextLocale("ja"), "en");
  assert.equal(nextTheme("light"), "dark");
  assert.equal(resolveLocale("unknown"), "ja");
  assert.equal(resolveTheme("unknown"), "light");
});

test("the Pages build publishes only browser runtime assets", async (context) => {
  const { buildPages, pageAssets } = await import("./build-pages.mjs");
  const temporaryDir = await mkdtemp(join(tmpdir(), "vlmkit-pages-"));
  const outputDir = join(temporaryDir, ".pages");
  context.after(() => rm(temporaryDir, { recursive: true, force: true }));

  await buildPages({ sourceDir: exampleDir, outputDir });

  assert.deepEqual(pageAssets, [
    "app.js",
    "content.js",
    "index.html",
    "preferences.js",
    "scenarios.js",
    "styles.css",
  ]);
  assert.deepEqual((await readdir(outputDir)).sort(), [
    ".nojekyll",
    "app.js",
    "content.js",
    "index.html",
    "preferences.js",
    "scenarios.js",
    "styles.css",
  ]);

  for (const asset of pageAssets) {
    assert.equal(await readFile(join(outputDir, asset), "utf8"), await read(asset));
  }
  assert.equal(await readFile(join(outputDir, ".nojekyll"), "utf8"), "");
});

test("the GitHub Pages workflow validates and deploys the isolated site", async () => {
  const workflow = await readFile(
    join(exampleDir, "../../.github/workflows/deploy-pages.yml"),
    "utf8",
  );

  assert.match(workflow, /branches:\s*\[main\]/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /actions\/checkout@v6/);
  assert.match(workflow, /actions\/setup-node@v6/);
  assert.match(workflow, /node-version: 24/);
  assert.match(workflow, /node --test examples\/vlmkit-intro-page\/page\.test\.mjs/);
  assert.match(workflow, /node examples\/vlmkit-intro-page\/build-pages\.mjs/);
  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /path: examples\/vlmkit-intro-page\/\.pages/);
  assert.match(workflow, /needs: build/);
  assert.match(workflow, /if: github\.event_name != 'pull_request'/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});
