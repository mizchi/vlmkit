import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const appHtml = await readFile(join(root, "app.html"), "utf8");
const port = Number(process.env.PORT ?? "4173");

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
  if (url.pathname !== "/" && url.pathname !== "/release-queue") {
    res.writeHead(302, { location: "/release-queue" });
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(appHtml);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`markup-vrt-eval server listening on http://127.0.0.1:${port}/release-queue`);
});
