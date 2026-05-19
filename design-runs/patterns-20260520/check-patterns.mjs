import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const runDir = dirname(fileURLToPath(import.meta.url));

function checksum(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i += 32) {
    sum = (sum + data[i] * 3 + data[i + 1] * 5 + data[i + 2] * 7 + data[i + 3]) >>> 0;
  }
  return sum;
}

async function checkLanding(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await page.goto(pathToFileURL(resolve(runDir, "landing", "current.html")).href, { waitUntil: "networkidle" });
  const result = await page.evaluate(() => {
    const cta = document.querySelector("[data-primary-cta]")?.getBoundingClientRect();
    const next = document.querySelector("[data-next-section]")?.getBoundingClientRect();
    const media = document.querySelector("[data-media-slot]")?.getBoundingClientRect();
    return {
      ctaInFirstViewport: !!cta && cta.top >= 0 && cta.bottom <= innerHeight,
      nextSectionHintVisible: !!next && next.top < innerHeight,
      mediaSlotVisible: !!media && media.width > 320 && media.height > 280,
      h1: document.querySelector("h1")?.textContent?.trim() ?? "",
    };
  });
  await page.close();
  return result;
}

async function checkAppShell(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(pathToFileURL(resolve(runDir, "app-shell", "current.html")).href, { waitUntil: "networkidle" });
  const result = await page.evaluate(() => {
    const body = getComputedStyle(document.body);
    const scrollports = [...document.querySelectorAll("[data-scrollport]")].map((el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        name: el.getAttribute("data-scrollport"),
        overflowY: style.overflowY,
        hasScrollableContent: el.scrollHeight > el.clientHeight,
        isIndependentScrollport: /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      };
    });
    return {
      bodyOverflowY: body.overflowY,
      shellHeight: Math.round(document.querySelector(".shell")?.getBoundingClientRect().height ?? 0),
      activeNavCount: document.querySelectorAll("[aria-current='page'], .is-active, .is-selected").length,
      scrollports,
    };
  });
  await page.close();
  return result;
}

async function checkGame(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(pathToFileURL(resolve(runDir, "game", "current.html")).href, { waitUntil: "networkidle" });
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => {
    const ctx = document.querySelector("canvas").getContext("2d");
    return [...ctx.getImageData(0, 0, 1280, 720).data];
  });
  const xBefore = await page.evaluate(() => window.__gameState?.playerX ?? 0);
  await page.waitForTimeout(180);
  const after = await page.evaluate(() => {
    const ctx = document.querySelector("canvas").getContext("2d");
    return [...ctx.getImageData(0, 0, 1280, 720).data];
  });
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(80);
  const xAfter = await page.evaluate(() => window.__gameState?.playerX ?? 0);
  await page.close();
  const first = checksum(before);
  const second = checksum(after);
  return {
    canvasNonblank: first !== 0,
    frameDelta: first !== second,
    inputChangedState: xAfter > xBefore,
    playerXBefore: xBefore,
    playerXAfter: xAfter,
  };
}

const browser = await chromium.launch();
try {
  const result = {
    generatedAt: new Date().toISOString(),
    landing: await checkLanding(browser),
    appShell: await checkAppShell(browser),
    game: await checkGame(browser),
  };
  const outDir = join(runDir, "reports");
  await mkdir(outDir, { recursive: true });
  const out = join(outDir, "pattern-checks.json");
  await writeFile(out, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}

