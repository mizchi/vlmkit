/**
 * The local server for the Pages site, so `just serve` shows what `just pages` would deploy.
 *
 * The routes are DERIVED from `scripts/build-pages.mjs` rather than listed here. They used to be
 * a hand-written map of this directory's nine files, which was fine while the intro page was the
 * whole site — but the moment the page grew a link to `/solitaire/`, an unlisted path hit the
 * catch-all below and 302'd back to `/`. A link that silently returns you to the page you were
 * already on is worse than a 404, because nothing reports it. Reading the manifest means the
 * server serves exactly the set that deploys, and adding a section cannot forget this file.
 */
import { existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { siteSections } from "../../scripts/build-pages.mjs";
import { logPaths, publishedJudgment } from "../sites/judge.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const port = Number(process.env.PORT ?? "4190");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  // `text/javascript`, not `application/javascript`: `app.js` is loaded as `type="module"` and a
  // module served with a non-JavaScript MIME type is rejected outright by the browser.
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  // Judgment-log screens (`examples/sites/judge.mjs` writes WebP).
  [".webp", "image/webp"],
]);

/** @type {Map<string, { read: () => Promise<Buffer>, contentType: string }>} */
const assets = new Map();
for (const section of siteSections) {
  const prefix = section.basePath ? `/${section.basePath}` : "";
  for (const asset of section.assets) {
    const file = join(repoRoot, section.sourceDir, asset);
    const contentType = contentTypes.get(extname(asset));
    if (!contentType) throw new Error(`No content type for ${asset} (section ${section.id})`);
    const route = { read: () => readFile(file), contentType };
    assets.set(`${prefix}/${asset}`, route);
    // Every directory index, with and without the trailing slash — a link written as
    // `./solitaire/` and one written as `./solitaire` must both arrive.
    if (asset === "index.html") {
      assets.set(`${prefix}/`, route);
      if (prefix) assets.set(prefix, route);
    }
  }
}

/** A section's published judgment files, read again only when its database has been written since. */
const judgmentCache = new Map();
function judgmentFiles(section) {
  const siteDir = join(repoRoot, section.sourceDir);
  const { db } = logPaths(siteDir);
  const stamp = existsSync(db) ? statSync(db).mtimeMs : null;
  const cached = judgmentCache.get(section.id);
  if (cached?.stamp === stamp) return cached.files;
  const files = new Map(publishedJudgment(siteDir).map((asset) => [asset.path, asset]));
  judgmentCache.set(section.id, { stamp, files });
  return files;
}

/**
 * A judgment log's page or screen, looked up in the section's `judgment.sqlite` when it is asked
 * for rather than listed at startup, so it is what the Pages build would publish from the log as it
 * is now. Listed at startup, a screen `shot` took after the server started 404'd until a restart,
 * and `check integrity` on the gallery reported it as a broken image.
 */
function judgmentAsset(pathname) {
  for (const section of siteSections) {
    const prefix = section.basePath ? `/${section.basePath}/` : "/";
    if (!pathname.startsWith(`${prefix}judgment`)) continue;
    const rest = pathname.slice(prefix.length);
    // `/sites/docs/judgment/` and `/sites/docs/judgment` are its page, like any directory index.
    const path = rest === "judgment" || rest === "judgment/" ? "judgment/index.html" : rest;
    const found = judgmentFiles(section).get(path);
    if (found) return { read: async () => found.bytes(), contentType: contentTypes.get(extname(path)) };
  }
  return null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
  let asset;
  try {
    asset = assets.get(url.pathname) ?? judgmentAsset(url.pathname);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.message : "Failed to read a judgment log");
    return;
  }
  if (!asset) {
    res.writeHead(302, { location: "/" });
    res.end();
    return;
  }

  try {
    const body = await asset.read();
    res.writeHead(200, { "content-type": asset.contentType, "cache-control": "no-store" });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.message : "Failed to load the example");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`vlmkit Pages site: http://127.0.0.1:${port}`);
  for (const section of siteSections) {
    console.log(`  http://127.0.0.1:${port}/${section.basePath}${section.basePath ? "/" : ""}`);
  }
});
