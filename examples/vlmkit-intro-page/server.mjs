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
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { siteSections } from "../../scripts/build-pages.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const port = Number(process.env.PORT ?? "4190");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  // `text/javascript`, not `application/javascript`: `app.js` is loaded as `type="module"` and a
  // module served with a non-JavaScript MIME type is rejected outright by the browser.
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
]);

/** @type {Map<string, { file: string, contentType: string }>} */
const assets = new Map();
for (const section of siteSections) {
  const prefix = section.basePath ? `/${section.basePath}` : "";
  for (const asset of section.assets) {
    const file = join(repoRoot, section.sourceDir, asset);
    const contentType = contentTypes.get(extname(asset));
    if (!contentType) throw new Error(`No content type for ${asset} (section ${section.id})`);
    assets.set(`${prefix}/${asset}`, { file, contentType });
    // Each section's directory index, with and without the trailing slash — a link written as
    // `./solitaire/` and one written as `./solitaire` must both arrive.
    if (asset === "index.html") {
      assets.set(`${prefix}/`, { file, contentType });
      if (prefix) assets.set(prefix, { file, contentType });
    }
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
  const asset = assets.get(url.pathname);
  if (!asset) {
    res.writeHead(302, { location: "/" });
    res.end();
    return;
  }

  try {
    const body = await readFile(asset.file);
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
