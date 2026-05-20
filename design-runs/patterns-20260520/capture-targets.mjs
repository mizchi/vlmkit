import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const runDir = dirname(fileURLToPath(import.meta.url));

const cases = [
  { name: "landing", width: 1440, height: 960 },
  { name: "app-shell", width: 1440, height: 900 },
  { name: "game", width: 1280, height: 720 },
  { name: "expressive-menu", width: 1440, height: 900 },
];

const browser = await chromium.launch();
try {
  for (const item of cases) {
    const page = await browser.newPage({
      viewport: { width: item.width, height: item.height },
      deviceScaleFactor: 1,
    });
    const targetHtml = resolve(runDir, item.name, "target.html");
    await page.goto(pathToFileURL(targetHtml).href, { waitUntil: "networkidle" });
    await mkdir(join(runDir, item.name, "reports"), { recursive: true });
    const out = join(runDir, item.name, "target.png");
    await page.screenshot({ path: out, fullPage: false });
    await page.close();
    console.log(`${item.name}: ${out}`);
  }
} finally {
  await browser.close();
}
