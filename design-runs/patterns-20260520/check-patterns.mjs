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

async function checkExpressiveMenu(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(pathToFileURL(resolve(runDir, "expressive-menu", "current.html")).href, { waitUntil: "networkidle" });
  const result = await page.evaluate(() => {
    const selected = document.querySelector("[data-selected=\"true\"], [aria-current=\"page\"], .is-selected");
    const layers = [...document.querySelectorAll("[data-composition-layer]")];
    const shapes = [...document.querySelectorAll("[data-shape]")];
    const menuItems = [...document.querySelectorAll("nav button, nav a, [role=\"menuitem\"], [data-menu-item]")];

    function isVisible(el) {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 1 && rect.height > 1 && style.visibility !== "hidden" && style.display !== "none";
    }

    function parseRgb(value) {
      const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      if (!match) return undefined;
      return [Number(match[1]), Number(match[2]), Number(match[3])];
    }

    function channel(value) {
      const normalized = value / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    }

    function luma(rgb) {
      return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
    }

    function contrastRatio(a, b) {
      const high = Math.max(luma(a), luma(b));
      const low = Math.min(luma(a), luma(b));
      return (high + 0.05) / (low + 0.05);
    }

    const selectedStyle = selected ? getComputedStyle(selected) : undefined;
    const selectedColor = selectedStyle ? parseRgb(selectedStyle.color) : undefined;
    const selectedBg = selectedStyle ? parseRgb(selectedStyle.backgroundColor) : undefined;
    const selectedContrast = selectedColor && selectedBg ? contrastRatio(selectedColor, selectedBg) : 0;
    const diagonalEvidence = [...layers, ...shapes].some((el) => {
      const style = getComputedStyle(el);
      return style.transform !== "none" || style.clipPath !== "none";
    });

    return {
      semanticShell: !!document.querySelector("header") && !!document.querySelector("nav") && !!document.querySelector("main"),
      selectedVisible: isVisible(selected),
      selectedContrast: Number(selectedContrast.toFixed(2)),
      highContrast: selectedContrast >= 4.5,
      focusableItemCount: menuItems.filter(isVisible).length,
      semanticMenuText: menuItems.every((el) => (el.textContent ?? "").trim().length >= 2),
      compositionLayerCount: layers.length,
      compositionShapeCount: shapes.length,
      diagonalEvidence,
      imageTextCount: document.querySelectorAll("img").length,
    };
  });
  await page.close();
  return result;
}

const browser = await chromium.launch();
try {
  const result = {
    generatedAt: new Date().toISOString(),
    landing: await checkLanding(browser),
    appShell: await checkAppShell(browser),
    game: await checkGame(browser),
    expressiveMenu: await checkExpressiveMenu(browser),
  };
  const outDir = join(runDir, "reports");
  await mkdir(outDir, { recursive: true });
  const out = join(outDir, "pattern-checks.json");
  await writeFile(out, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
