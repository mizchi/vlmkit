import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const exampleDir = dirname(fileURLToPath(import.meta.url));
const apmBootstrapCommand = "curl -sSL https://aka.ms/apm-unix | sh";
const metaApmCommand = "apm install mizchi/vlmkit";
const metaSkillsCliCommand = "npx skills add mizchi/vlmkit";
const skillCatalogUrl = "https://github.com/mizchi/vlmkit/tree/main/.claude/skills";
const specializedSkills = [
  "agent-validation-loop",
  "auto-markup",
  "dynamic-markup",
  "markup-assist",
  "mock-markup",
  "spec-to-playwright",
  "vrt-css-fix-loop",
  "vrt-markup-synth",
  "vrt-migration-eval",
  "vrt-regression-watch",
  "vrt-visual-diff",
];

async function read(name) {
  return readFile(join(exampleDir, name), "utf8");
}

test("the intro page has a stable semantic product story", async () => {
  const html = await read("index.html");

  assert.match(html, /<html lang="en"[^>]*>/);
  assert.match(html, /<title>vlmkit — Don't just look\. Measure\.<\/title>/);
  assert.match(html, /data-i18n="hero\.line1">Don't just look\.<\/span>/);
  assert.match(html, /data-i18n="hero\.line2">Measure it\.<\/span>/);
  assert.match(html, /id="workflow"/);
  assert.match(html, /id="commands"/);
  assert.match(html, /id="skills"/);
  assert.match(html, /id="start"/);
  assert.match(html, /data-testid="hero-status"/);
  assert.match(html, /data-testid="install-command"/);
  assert.match(html, /data-testid="gate-matrix"/);
  assert.match(html, /npm install -D @mizchi\/vlmkit/);
  assert.match(html, /https:\/\/github\.com\/mizchi\/vlmkit/);
});

test("README and page distribute the automatic router through APM and skills CLI", async () => {
  const [html, readme, catalog, copyManifest] = await Promise.all([
    read("index.html"),
    readFile(join(exampleDir, "../../README.md"), "utf8"),
    readFile(join(exampleDir, "../../.claude/skills/README.md"), "utf8"),
    read("copy.txt"),
  ]);

  assert.match(html, /href="#skills"[^>]*data-i18n="nav\.skills"/);
  assert.match(html, /data-testid="skill-installers"/);
  assert.ok(html.includes(metaApmCommand));
  assert.ok(html.includes(metaSkillsCliCommand));
  assert.ok(readme.includes(metaApmCommand));
  assert.ok(readme.includes(metaSkillsCliCommand));
  assert.ok(copyManifest.includes(metaApmCommand));
  assert.ok(copyManifest.includes(metaSkillsCliCommand));
  assert.match(readme, /Both installers expose one visible `vlmkit` skill/);
  assert.match(catalog, /Both installers expose only the `vlmkit` entry/);
  assert.ok(copyManifest.includes("This site is generated and debugged with vlmkit itself."));
  assert.ok(copyManifest.includes("Don't just look."));
});

test("the meta entry and catalog classify every specialized skill", async () => {
  const [html, readme, rootSkill, catalog, copyManifest, skillDirectories] = await Promise.all([
    read("index.html"),
    readFile(join(exampleDir, "../../README.md"), "utf8"),
    readFile(join(exampleDir, "../../skills/vlmkit/SKILL.md"), "utf8"),
    readFile(join(exampleDir, "../../.claude/skills/README.md"), "utf8"),
    read("copy.txt"),
    readdir(join(exampleDir, "../../.claude/skills"), { withFileTypes: true }),
  ]);

  assert.deepEqual(
    skillDirectories.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort(),
    specializedSkills,
  );
  assert.match(rootSkill, /name: vlmkit/);
  assert.match(rootSkill, /## Skill routing/);
  assert.match(catalog, /## Start here/);
  assert.match(catalog, /## Skill classes/);
  assert.ok(readme.includes("./.claude/skills/README.md"));
  assert.match(html, /data-testid="skill-catalog"/);
  assert.ok(html.includes(`href="${skillCatalogUrl}"`));
  assert.ok(copyManifest.includes("Meta entry"));

  for (const skill of specializedSkills) {
    assert.ok(catalog.includes(`./${skill}/`), `${skill} is missing from the catalog`);
    assert.ok(html.includes(`>${skill}<`), `${skill} is missing from the intro page`);
  }
});

test("one install lets the agent route natural-language UI work automatically", async () => {
  const [html, readme, rootSkill, catalog, copyManifest] = await Promise.all([
    read("index.html"),
    readFile(join(exampleDir, "../../README.md"), "utf8"),
    readFile(join(exampleDir, "../../skills/vlmkit/SKILL.md"), "utf8"),
    readFile(join(exampleDir, "../../.claude/skills/README.md"), "utf8"),
    read("copy.txt"),
  ]);

  assert.match(
    rootSkill,
    /description:.*Use automatically whenever the user asks to create, edit, debug, validate, test, compare, migrate, or repair a frontend UI/,
  );
  assert.match(rootSkill, /## Automatic routing contract/);
  assert.match(rootSkill, /Do not ask the user to choose or name a specialized skill/);
  assert.match(rootSkill, /relative to the directory containing\s+this `SKILL\.md`/);
  assert.match(rootSkill, /Default to `markup-assist`/);
  assert.match(rootSkill, /## Automatic tool bootstrap/);
  assert.match(rootSkill, /detect the existing package manager\s+from its lockfile/);
  assert.match(rootSkill, /add\s+`@mizchi\/vlmkit` as a development dependency/);
  assert.match(rootSkill, /Install Chromium only when Playwright reports\s+that it is missing/);
  assert.match(rootSkill, /translate source-repo invocations to the published\s+`vlmkit` binary/);

  for (const skill of specializedSkills) {
    const bundledReference = `./workflows/${skill}/SKILL.md`;
    assert.ok(rootSkill.includes(bundledReference), `${skill} is not bundled in the router table`);
    assert.match(
      await readFile(join(exampleDir, "../../skills/vlmkit", bundledReference), "utf8"),
      new RegExp(`name: ${skill}`),
    );
  }

  for (const document of [html, readme, catalog, copyManifest]) {
    assert.ok(document.includes(apmBootstrapCommand));
    assert.ok(document.includes(metaApmCommand));
    assert.ok(document.includes(metaSkillsCliCommand));
    assert.doesNotMatch(document, /brew install .*apm/i);
  }
  assert.match(catalog, /Install once, then describe the outcome you want/);
  assert.match(readme, /You do not choose a\s+specialized skill/);
  assert.match(html, /data-testid="automatic-routing"/);
  assert.ok(copyManifest.includes("Install once."));
  assert.ok(copyManifest.includes("Ask naturally."));
});

test("the first visible message identifies the page as vlmkit dogfood", async () => {
  const html = await read("index.html");

  assert.match(
    html,
    /data-testid="dogfood-notice"[^>]*>[\s\S]*This site is generated and debugged with vlmkit itself\./,
  );
  assert.ok(
    html.indexOf('data-testid="dogfood-notice"') < html.indexOf('<header class="site-header">'),
  );
});

test("the header exposes language, theme, and GitHub controls", async () => {
  const html = await read("index.html");

  assert.match(html, /data-testid="locale-toggle"/);
  assert.match(html, /data-active-locale="en"/);
  assert.match(html, /aria-label="Switch to Japanese"/);
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
  const [
    { messages, translate },
    { defaultLocale, nextLocale, nextTheme, resolveLocale, resolveTheme },
  ] = await Promise.all([import("./content.js"), import("./preferences.js")]);

  assert.equal(defaultLocale, "en");
  assert.deepEqual(Object.keys(messages.ja).sort(), Object.keys(messages.en).sort());
  assert.equal(
    translate("ja", "dogfood.message"),
    "このサイトは vlmkit 自身で生成、デバッグされています。",
  );
  assert.equal(
    translate("en", "dogfood.message"),
    "This site is generated and debugged with vlmkit itself.",
  );
  assert.equal(translate("ja", "skills.apmLabel"), "APM でインストール");
  assert.equal(translate("en", "skills.apmLabel"), "Install with APM");
  assert.equal(translate("ja", "skills.metaLabel"), "メタエントリー");
  assert.equal(translate("en", "skills.metaLabel"), "Meta entry");
  assert.equal(translate("ja", "skills.line1"), "一度入れたら、");
  assert.equal(translate("ja", "skills.line2"), "あとは自然に頼むだけ。");
  assert.equal(translate("en", "skills.line1"), "Install once.");
  assert.equal(translate("en", "skills.line2"), "Ask naturally.");
  assert.equal(nextLocale("ja"), "en");
  assert.equal(nextTheme("light"), "dark");
  assert.equal(resolveLocale("unknown"), "en");
  assert.equal(
    translate("unknown", "dogfood.message"),
    "This site is generated and debugged with vlmkit itself.",
  );
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
