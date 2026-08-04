import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? "4190");
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/content.js", ["content.js", "text/javascript; charset=utf-8"]],
  ["/preferences.js", ["preferences.js", "text/javascript; charset=utf-8"]],
  ["/proof-target.png", ["proof-target.png", "image/png"]],
  ["/proof-implementation.png", ["proof-implementation.png", "image/png"]],
  ["/proof-diff.png", ["proof-diff.png", "image/png"]],
  ["/scenarios.js", ["scenarios.js", "text/javascript; charset=utf-8"]],
]);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
  const asset = assets.get(url.pathname);
  if (!asset) {
    res.writeHead(302, { location: "/" });
    res.end();
    return;
  }

  const [path, contentType] = asset;
  try {
    const body = await readFile(join(root, path));
    res.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.message : "Failed to load the example");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`vlmkit intro page: http://127.0.0.1:${port}`);
});
