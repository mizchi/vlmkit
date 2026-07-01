import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const exampleDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(exampleDir, "../..");
const cliPath = resolve(repoRoot, "src/cli/vlmkit.ts");
const requestPath = resolve(exampleDir, ".vlmkit/markup-loop/request.md");

const appHtml = await readFile(resolve(exampleDir, "app.html"), "utf8");

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "127.0.0.1"}`);
  if (url.pathname !== "/" && url.pathname !== "/dashboard") {
    res.writeHead(302, { location: "/dashboard" });
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(appHtml);
});

try {
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 4183;
  const baseUrl = `http://127.0.0.1:${port}/dashboard`;

  await rm(resolve(exampleDir, ".vlmkit"), { recursive: true, force: true });
  await rm(resolve(exampleDir, "tests/vlmkit"), { recursive: true, force: true });

  await runVlmkit([
    "markup-loop",
    "init",
    "--topic", "operations-dashboard",
    "--title", "Operations Dashboard Smoke",
    "--base-url", baseUrl,
    "--provider", "openrouter",
    "--playwright-config", "playwright.config.ts",
    "--force",
  ]);

  await mkdir(dirname(requestPath), { recursive: true });
  await writeFile(requestPath, `# Operations Dashboard Smoke

Verify that an operator can review the dashboard, see the incident summary,
filter services, and keep the approve-deployment action visible.

Stable anchors:
- heading "Operations Dashboard"
- label "Filter services"
- button "Approve deployment"
- test id "service-health"
- text "2 incidents need review"
`, "utf8");

  await runVlmkit(["markup-loop", "observe", "--wait-for", "[data-testid='service-health']"]);
  await runVlmkit(["markup-loop", "doctor"]);
  await runVlmkit(["markup-loop", "run", "--dry-run"]);

  console.log("Markup loop project example passed");
} finally {
  await new Promise((resolveClose) => server.close(() => resolveClose()));
}

function runVlmkit(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, ["--experimental-strip-types", cliPath, ...args], {
      cwd: exampleDir,
      env: { ...process.env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      process.stderr.write(text);
    });
    child.on("error", rejectRun);
    child.on("close", (code) => {
      if (code === 0) {
        resolveRun({ stdout, stderr });
      } else {
        rejectRun(new Error(`vlmkit ${args.join(" ")} exited ${code}\n${stderr || stdout}`));
      }
    });
  });
}
