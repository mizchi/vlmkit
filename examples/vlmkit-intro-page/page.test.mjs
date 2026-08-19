import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { onTestFinished, test } from "vitest";

const exampleDir = dirname(fileURLToPath(import.meta.url));
const apmBootstrapCommand = "curl -sSL https://aka.ms/apm-unix | sh";
const metaApmCommand = "apm install mizchi/vlmkit";
const metaSkillsCliCommand = "npx skills add mizchi/vlmkit";
const skillCatalogUrl = "https://github.com/mizchi/vlmkit/tree/main/.claude/skills";
const specializedSkills = [
  "agent-validation-loop",
  "auto-markup",
  "component-vrt",
  "dynamic-markup",
  "markup-assist",
  "markup-decompose",
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
  assert.match(html, /<title>vlmkit — VLM-assisted UI verification<\/title>/);
  assert.match(html, /data-i18n="hero\.line1">VLM-assisted UI\.<\/span>/);
  assert.match(html, /data-i18n="hero\.line2">Verified in the browser\.<\/span>/);
  assert.match(html, /id="workflow"/);
  assert.match(html, /id="proof"/);
  assert.match(html, /id="demo"/);
  assert.match(html, /id="commands"/);
  assert.match(html, /id="skills"/);
  assert.match(html, /id="start"/);
  assert.match(html, /data-testid="hero-status"/);
  assert.match(html, /data-testid="install-command"/);
  assert.match(html, /data-testid="gate-matrix"/);
  assert.match(html, /npm install -D @mizchi\/vlmkit/);
  assert.match(html, /https:\/\/github\.com\/mizchi\/vlmkit/);
});

test("the first product path installs the automatic VLM workflow", async () => {
  const html = await read("index.html");
  const heroInstallers = html.indexOf('data-testid="hero-skill-installers"');
  const workflow = html.indexOf('id="workflow"');

  assert.ok(heroInstallers > 0, "hero skill installers are missing");
  assert.ok(heroInstallers < workflow, "skill installation must appear before feature detail");
  assert.match(html, /data-i18n="hero\.vlmLead"/);
  assert.match(html, /data-i18n="hero\.installLead"/);
  assert.ok(html.slice(heroInstallers, workflow).includes(metaApmCommand));
  assert.ok(html.slice(heroInstallers, workflow).includes(metaSkillsCliCommand));
});

test("the page proves the VLM loop with real screenshots and measured outcomes", async () => {
  const html = await read("index.html");

  assert.match(html, /data-testid="proof-gallery"/);
  assert.match(html, /src="\.\/proof-target\.png"/);
  assert.match(html, /src="\.\/proof-implementation\.png"/);
  assert.match(html, /src="\.\/proof-diff\.png"/);
  assert.match(html, /data-i18n="proof\.targetLabel"/);
  assert.match(html, /data-i18n="proof\.implementationLabel"/);
  assert.match(html, /data-i18n="proof\.diffLabel"/);
  assert.match(html, /1\.40%/);
  assert.match(html, /6\/6/);
  assert.match(html, /13px/);
  assert.match(html, /29px/);
  assert.match(html, /0\.0%/);
  assert.match(html, /7 viewports/);
  assert.match(html, /docs\/reports\/2026-07-27-auto-markup-skill-haiku-proof\.md/);
  assert.match(html, /docs\/reports\/2026-04-01-tailwind-migration-blind-test\.md/);
});

/**
 * The playable-demo section: the one route on this page to a thing you can operate rather than
 * look at, and the only place the release the page advertises is explained.
 *
 * The counts are asserted against the sources that produce them, not typed twice. `52/52` and the
 * ply count are solitaire's own claims, `57` is what `vitest run examples/solitaire/` reports, and
 * the three gate commands are the ones `deploy-pages.yml` actually runs against `/solitaire/` —
 * a marketing number nobody can rederive is the failure mode here, and the gate list is the part
 * most likely to drift, because it lives in a workflow file this section never mentions.
 */
test("the playable-demo section routes to the game and states what proves it", async () => {
  const [html, workflow] = await Promise.all([
    read("index.html"),
    readFile(join(exampleDir, "../../.github/workflows/deploy-pages.yml"), "utf8"),
  ]);
  const section = html.slice(html.indexOf('id="demo"'), html.indexOf('id="workflow"'));

  assert.match(section, /data-testid="demo-solitaire"/);
  assert.match(section, /src="\.\/demo-solitaire\.png"/);
  // The reserved box has to match the FILE, not just be internally consistent — re-shooting the
  // still at another size (`capture-demo-still.mjs --height ...`) would otherwise leave the
  // section reflowing as the image decodes, which no other check here would notice. PNG IHDR
  // carries the dimensions at a fixed offset, so this needs no image library.
  const still = await readFile(join(exampleDir, "demo-solitaire.png"));
  assert.equal(still.subarray(1, 4).toString("ascii"), "PNG");
  const [stillWidth, stillHeight] = [still.readUInt32BE(16), still.readUInt32BE(20)];
  assert.match(section, new RegExp(`width="${stillWidth}"\\s+height="${stillHeight}"`));
  assert.deepEqual([stillWidth, stillHeight], [1024, 660]);
  assert.match(section, /href="\.\/solitaire\/"/, "the demo section must link to the demo");
  assert.match(section, /52\/52/);
  assert.match(section, /<strong>144<\/strong>/);
  assert.match(section, /<strong>57<\/strong>/);
  assert.match(section, /NEW IN 0\.11/);
  assert.match(section, /href="https:\/\/github\.com\/mizchi\/vlmkit\/blob\/main\/CHANGELOG\.md"/);

  // Scoped to the solitaire step, so a gate the workflow runs against the INTRO page cannot
  // satisfy a claim made about the demo. The step wraps its commands across continuation lines
  // (`--level AAA` sits on the line after the verb), so join those back up first.
  const solitaireStep = workflow.slice(
    workflow.indexOf("Run vlmkit gates on the solitaire demo"),
    workflow.indexOf("Build the Pages artifact"),
  );
  assert.ok(solitaireStep.length > 0, "the deploy workflow no longer has a solitaire gate step");
  const runLines = solitaireStep.replace(/\\\n\s*/g, " ").split("\n");
  for (const gate of [
    "vlmkit check integrity",
    "vlmkit check a11y focus",
    "vlmkit check a11y touch --level AAA",
  ]) {
    assert.ok(section.includes(`<code>${gate}</code>`), `${gate} is missing from the demo section`);
    const tokens = gate.split(" ").slice(1);
    assert.ok(
      runLines.some((line) => tokens.every((token) => line.includes(token))),
      `${gate} is advertised but the deploy workflow does not run it against the demo`,
    );
  }

  /*
   * The two claims in this section that go stale on their own, pinned to the code that decides them.
   *
   * The family count was written as 6 and the seventh (`dblclick`) landed a release later, which is
   * the shape of every number on a marketing page: true when typed, silently wrong afterwards. Read
   * out of the source as TEXT rather than imported — this file has to stay dependency-free, because
   * `skill-package.yml` runs it with no pnpm install and no Playwright.
   */
  const handlerMap = await readFile(
    join(exampleDir, "../../packages/vlmkit-markup/src/inspect/handler-map.ts"),
    "utf8",
  );
  const families = handlerMap.match(/export const PROBE_FAMILIES = \[(.*?)\]/)[1].split(",").length;
  assert.match(
    section,
    new RegExp(`<strong>${families}</strong><span data-i18n="demo\\.metricFamilies"`),
    `the page advertises a different number of probe families than the ${families} that exist`,
  );
  // The rules this demo produced. A renamed rule has to fail here rather than leave the page
  // naming something the toolkit no longer ships.
  for (const rule of ["drag-selects-text", "dblclick-selects-text", "drag-ghost-illegible"]) {
    assert.ok(section.includes(`<code>${rule}</code>`), `${rule} is missing from the demo section`);
    assert.ok(handlerMap.includes(`id: "${rule}"`), `${rule} is not a rule this project declares`);
  }
});

/**
 * Section numbers are copy, written in the markup, so inserting a section renumbers every one
 * below it by hand. Asserting the sequence turns a missed renumber into a failed test instead of
 * two "04"s on a public page — which is what nearly shipped when the demo section landed.
 */
test("the section numbers run in order with no gaps or repeats", async () => {
  const html = await read("index.html");
  const numbers = [...html.matchAll(/class="section-number[^"]*">(\d+) \/ /g)].map((m) => m[1]);

  assert.deepEqual(numbers, ["01", "02", "03", "04", "05", "06", "07"]);
});

test("the hero display type keeps readable size and tracking", async () => {
  const css = await read("styles.css");

  assert.match(
    css,
    /\.hero h1 \{[\s\S]*?font-size: clamp\(44px, 5\.2vw, 68px\);[\s\S]*?letter-spacing: -0\.035em;/,
  );
  assert.match(
    css,
    /@media \(max-width: 640px\)[\s\S]*?\.hero h1 \{\s*font-size: clamp\(38px, 11\.5vw, 52px\);/,
  );
});

test("the visual system stays quiet and documentation-like", async () => {
  const css = await read("styles.css");

  assert.match(css, /--accent: #9cc9c2;/);
  assert.match(css, /--section-space: clamp\(72px, 9vw, 118px\);/);
  assert.match(css, /\.hero-real-run::before \{[\s\S]*?background: transparent;/);
  assert.doesNotMatch(css, /--acid: #d8ff45;/);
  assert.doesNotMatch(css, /box-shadow: 18px 18px 0/);
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
  assert.ok(copyManifest.includes("VLM-assisted UI."));
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
  /*
   * The router's instructions, matched WRAP-INSENSITIVELY.
   *
   * These are prose assertions — "the router still tells the agent to detect the package manager
   * from the lockfile" — and the literal spaces in them made every one of them an assertion about
   * line breaks too. Editing the sentence before it, which re-wrapped "from its lockfile" across a
   * newline, failed the test without changing a word of what it checks. One `\s+` had already been
   * hand-placed at each wrap point that existed when they were written, which is the same bug
   * being patched one instance at a time.
   */
  const says = (phrase) => assert.match(
    rootSkill,
    new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")),
    `the router no longer says: ${phrase}`,
  );
  says("relative to the directory containing this `SKILL.md`");
  says("Default to `markup-assist`");
  assert.match(rootSkill, /## Automatic tool bootstrap/);
  says("detect the existing package manager from its lockfile");
  says("`@mizchi/vlmkit` as a development dependency");
  says("Install Chromium only when Playwright reports that it is missing");
  says("translate source-repo invocations to the published `vlmkit` binary");

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

/**
 * This used to read `server.mjs` as text and match for `["/app.js"` — which stopped meaning
 * anything once the routes were derived from the site manifest instead of listed. Booting the
 * server and asking it answers the same question with evidence: a module served as
 * `application/octet-stream` is refused by the browser, and the source text never showed that.
 *
 * The unknown-path case is here on purpose. The server 302s to `/`, so a mistyped or unlisted
 * route comes back 200 with the intro page in it — which is why `/solitaire/` is asserted by its
 * CONTENT and not by its status code.
 */
/**
 * The route to the demo — the static half. Its live half is in `site-links.test.mjs`.
 *
 * Split because this file must stay BROWSER-FREE: `skill-package.yml` runs it on any change under
 * `.claude/skills/**` (the page lists all 13 specialised skills, so a skills change can break it),
 * and that job has no Playwright. Adding a `chromium.launch()` here quietly made the file
 * unrunnable in one of the two workflows that run it.
 */
test("the demo link is marked as leaving the page, and survives the mobile collapse", async () => {
  const [html, css] = await Promise.all([read("index.html"), read("styles.css")]);

  // The arrow lives INSIDE the link, beside the translated span, not as a sibling of it —
  // `data-i18n` is applied with `textContent`, which would destroy a sibling on locale switch.
  assert.match(
    html,
    /<a class="nav-demo" href="\.\/solitaire\/"\s*><span data-i18n="nav\.demo">[^<]+<\/span> <span aria-hidden="true">→<\/span><\/a>/,
  );
  // The mobile collapse hides the scroll-spy anchors only, not the cross-page link.
  assert.match(css, /\.site-nav a:not\(\.nav-demo\)\s*\{\s*display: none;/);
  assert.doesNotMatch(css, /\.site-nav\s*\{\s*display: none;/);
});

/**
 * The version the page advertises has to be the version the repo ships. It read `v0.9.0` while
 * `package.json` said 0.11.0 — a public page quietly two releases stale, because the eyebrow is
 * three words in the middle of a hero and nobody rereads it.
 *
 * Root `package.json` is the reference rather than `VLMKIT_VERSION`: this page is a
 * dependency-free static example and importing a `.ts` constant into it would need a loader.
 * Both are already pinned to each other by `src/cli/version.test.ts`.
 */
test("the intro page advertises the shipped version", async () => {
  const [html, manifest] = await Promise.all([
    read("index.html"),
    readFile(join(exampleDir, "../../package.json"), "utf8"),
  ]);
  const { version } = JSON.parse(manifest);

  assert.match(html, new RegExp(`<span>v${version.replace(/\./g, "\\.")}</span>`));
});

test("the local server serves both pages with usable content types", async () => {
  const { spawn } = await import("node:child_process");
  const port = 4291;
  const child = spawn(process.execPath, [join(exampleDir, "server.mjs")], {
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  onTestFinished(() => child.kill());

  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await fetch(`${base}/`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  const expected = [
    ["/", "text/html"],
    ["/styles.css", "text/css"],
    ["/app.js", "text/javascript"],
    ["/content.js", "text/javascript"],
    ["/preferences.js", "text/javascript"],
    ["/scenarios.js", "text/javascript"],
    ["/proof-target.png", "image/png"],
    ["/proof-implementation.png", "image/png"],
    ["/proof-diff.png", "image/png"],
    ["/demo-solitaire.png", "image/png"],
    ["/solitaire/", "text/html"],
    ["/solitaire/game.js", "text/javascript"],
    ["/solitaire/rules.js", "text/javascript"],
    ["/solitaire/solitaire.css", "text/css"],
  ];
  for (const [path, type] of expected) {
    const response = await fetch(`${base}${path}`);
    assert.equal(response.status, 200, path);
    assert.match(response.headers.get("content-type") ?? "", new RegExp(type), path);
  }

  const solitaire = await (await fetch(`${base}/solitaire/`)).text();
  assert.match(solitaire, /<title>Klondike Solitaire/, "/solitaire/ must not fall through to /");
  assert.match(solitaire, /href="\.\.\/"/, "the demo must link back to the site root");
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

// What the Pages build publishes, and at which URL, is asserted by `tests/pages-site.test.mjs`.
// It moved there when solitaire joined the site: the layout stopped being this page's business
// the moment this page stopped being the whole site.

test("the GitHub Pages workflow validates and deploys the composed site", async () => {
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
  /**
   * `vitest run`, NOT `node --test`. This test asserted `node --test` for as long as
   * `page.test.mjs` was a `node:test` file; the suite moved to vitest on 2026-08-13 and this
   * file's own `import { test } from "vitest"` made the workflow's command fail on import
   * ("Vitest failed to find the current suite"). The workflow last ran on 2026-08-07, so the
   * breakage was invisible — and this assertion was pinning it in place.
   *
   * Matching the runner and not just the path is the point: a step that cannot run is worse
   * than a missing step, because the workflow claims the contract is verified.
   */
  // The directory, so `site-links.test.mjs` is covered too — the live-browser half of this
  // page's contract, split out of this file to keep it runnable in `skill-package.yml`.
  assert.match(workflow, /pnpm exec vitest run examples\/vlmkit-intro-page\/(?!page)/);
  // Anchored to a `run:` line, not to the string anywhere in the file — the workflow's own
  // comment explains why `node --test` is wrong here, and a bare /node --test/ matched that.
  assert.doesNotMatch(workflow, /^\s*(?:run:|- run:).*node --test/m);
  assert.match(workflow, /node scripts\/build-pages\.mjs/);
  // Solitaire ships on the same site, so its own tests and gates run in the same job.
  assert.match(workflow, /pnpm exec vitest run examples\/solitaire\//);
  assert.match(workflow, /examples\/solitaire\/\*\*/);
  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /path: \.pages/);
  assert.match(workflow, /needs: build/);
  assert.match(workflow, /if: github\.event_name != 'pull_request'/);
  assert.match(workflow, /actions\/deploy-pages@v4/);
});

test("the dogfood gate covers every locale and theme before Pages deploys", async () => {
  const [configSource, tasks, workflow] = await Promise.all([
    read("vlmkit.gates.json"),
    read("justfile"),
    readFile(join(exampleDir, "../../.github/workflows/deploy-pages.yml"), "utf8"),
  ]);
  const config = JSON.parse(configSource);

  assert.deepEqual(config.defaults?.gates, ["check integrity"]);
  assert.deepEqual(
    config.pages.map(({ id, source }) => ({ id, source })),
    [
      { id: "en-light", source: "http://127.0.0.1:4190/?lang=en&theme=light" },
      { id: "en-dark", source: "http://127.0.0.1:4190/?lang=en&theme=dark" },
      { id: "ja-light", source: "http://127.0.0.1:4190/?lang=ja&theme=light" },
      { id: "ja-dark", source: "http://127.0.0.1:4190/?lang=ja&theme=dark" },
    ],
  );
  for (const page of config.pages) {
    assert.deepEqual(page.extraGates, [
      `check a11y contrast --output-dir test-results/a11y-contrast/${page.id}`,
    ]);
  }
  assert.match(tasks, /gates run --config vlmkit\.gates\.json/);
  assert.match(workflow, /name: Install MoonBit/);
  assert.match(workflow, /cli\.moonbitlang\.com\/install\/unix\.sh/);
  assert.match(workflow, /\.moon\/bin.*GITHUB_PATH/);
  assert.match(workflow, /Run vlmkit dogfood state matrix/);
  assert.match(
    workflow,
    /gates run[\s\\]+--config examples\/vlmkit-intro-page\/vlmkit\.gates\.json/,
  );
  assert.ok(
    workflow.indexOf("Install MoonBit")
      < workflow.indexOf("Run vlmkit dogfood state matrix"),
    "MoonBit must be available before the contrast gate runs",
  );
  assert.ok(
    workflow.indexOf("Run vlmkit dogfood state matrix")
      < workflow.indexOf("Build the Pages artifact"),
    "the state matrix must block artifact creation",
  );
  // Same for solitaire: its gates are only worth running if a red one stops the deploy.
  assert.ok(
    workflow.indexOf("Run vlmkit gates on the solitaire demo")
      < workflow.indexOf("Build the Pages artifact"),
    "the solitaire gates must block artifact creation",
  );
});
