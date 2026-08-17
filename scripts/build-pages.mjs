/**
 * Composes the GitHub Pages artifact for <https://mizchi.github.io/vlmkit/>.
 *
 * The site is not one page. The intro page is published at the root and each further example is
 * published under its own path, so the deployed site is the set of pages this repo dogfoods
 * itself against. Adding one is a section in `siteSections` below.
 *
 * Two properties of this script are deliberate rather than incidental:
 *
 * **Assets are an allowlist, never a directory walk.** Every example directory holds test files,
 * a README, a justfile, Playwright config and baseline PNGs, none of which belong on a public
 * site. A denylist publishes whatever is added next by default; an allowlist publishes nothing
 * by default, and a missing file fails the build loudly (`copyFile` throws) rather than
 * deploying a page with a 404 stylesheet.
 *
 * **The section list lives here, not in the examples.** It is a publishing decision — what the
 * site is, and at which URL — and the examples themselves are runnable without it. One test
 * (`tests/pages-site.test.mjs`) owns the whole layout, so there is one place where "solitaire is
 * at /solitaire/" is written down.
 */
import { copyFile, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "..");

/**
 * @typedef {object} SiteSection
 * @property {string} id        stable name, used in build output and in the tests
 * @property {string} sourceDir repo-relative directory holding the section's files
 * @property {string} basePath  published path under the site root; "" is the site root itself
 * @property {readonly string[]} assets files to publish, relative to `sourceDir`
 */

/** @type {readonly SiteSection[]} */
export const siteSections = Object.freeze([
  Object.freeze({
    id: "intro",
    sourceDir: "examples/vlmkit-intro-page",
    basePath: "",
    assets: Object.freeze([
      "app.js",
      "content.js",
      "index.html",
      "preferences.js",
      "proof-diff.png",
      "proof-implementation.png",
      "proof-target.png",
      "scenarios.js",
      "styles.css",
    ]),
  }),
  Object.freeze({
    id: "solitaire",
    sourceDir: "examples/solitaire",
    // Klondike, the DnD + animation dogfood target. Four files and no build step, which is why
    // it can be published as-is: `index.html` links `solitaire.css` and loads the two scripts
    // with relative paths, so it works identically from `file://` and from a Pages subpath.
    basePath: "solitaire",
    assets: Object.freeze(["game.js", "index.html", "rules.js", "solitaire.css"]),
  }),
]);

/**
 * Builds the whole site into `outputDir`.
 *
 * `outputDir` must be named `.pages`, which is both what the workflow uploads and what
 * `.gitignore` excludes — a typo that pointed this at a source directory would otherwise delete
 * it, since the build starts by removing its output.
 */
export async function buildSite({
  sourceRoot = repoRoot,
  outputDir = join(repoRoot, ".pages"),
  sections = siteSections,
} = {}) {
  const resolvedSourceRoot = resolve(sourceRoot);
  const resolvedOutputDir = resolve(outputDir);

  if (basename(resolvedOutputDir) !== ".pages") {
    throw new Error('Pages output must be an isolated directory named ".pages".');
  }
  for (const section of sections) {
    if (resolvedOutputDir === resolve(resolvedSourceRoot, section.sourceDir)) {
      throw new Error(`Pages output must not be a section source directory (${section.id}).`);
    }
  }

  // Two sections publishing to one path would have the later one silently overwrite the earlier
  // — the failure would surface as a missing page rather than as a build error.
  const basePaths = sections.map((section) => section.basePath);
  const duplicate = basePaths.find((path, index) => basePaths.indexOf(path) !== index);
  if (duplicate !== undefined) {
    throw new Error(`Two site sections publish to the same path: "${duplicate}".`);
  }

  await rm(resolvedOutputDir, { recursive: true, force: true });
  await mkdir(resolvedOutputDir, { recursive: true });

  /** @type {{ id: string, basePath: string, files: string[] }[]} */
  const built = [];
  for (const section of sections) {
    const sectionSource = resolve(resolvedSourceRoot, section.sourceDir);
    const sectionOutput = section.basePath
      ? join(resolvedOutputDir, section.basePath)
      : resolvedOutputDir;
    await mkdir(sectionOutput, { recursive: true });
    await Promise.all(
      section.assets.map((asset) =>
        copyFile(join(sectionSource, asset), join(sectionOutput, asset)),
      ),
    );
    built.push({
      id: section.id,
      basePath: section.basePath,
      files: section.assets.map((asset) => (section.basePath ? `${section.basePath}/${asset}` : asset)),
    });
  }

  // Jekyll would otherwise process the artifact and drop anything it considers a partial.
  await writeFile(join(resolvedOutputDir, ".nojekyll"), "", "utf8");

  return { sections: built, outputDir: resolvedOutputDir };
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  const result = await buildSite();
  for (const section of result.sections) {
    console.log(`  /${section.basePath}${section.basePath ? "/" : ""} — ${section.id} (${section.files.length} files)`);
  }
  console.log(`GitHub Pages artifact: ${result.outputDir}`);
  // Listed so a build that quietly published the wrong tree is visible in the log.
  console.log(`root entries: ${(await readdir(result.outputDir)).sort().join(" ")}`);
}
