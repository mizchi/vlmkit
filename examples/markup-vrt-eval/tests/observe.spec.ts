import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { gotoApp } from "../support/goto-app";

test("observe release queue UI", async ({ page }) => {
  await gotoApp(page);

  await expect(page.getByRole("heading", { name: "Release Queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Candidate releases" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Blocked" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Payments API details" })).toBeVisible();
  await expect(page.getByTestId("blocked-count")).toHaveText("2");
  await expect(page.getByTestId("selected-service")).toHaveText("Payments API");
  const stableVisualContext = await captureVisualContext(page);
  const stableSemantic = await captureSemanticSnapshot(page);
  await page.goto("/release-queue?variant=regression");
  await expect(page.getByRole("heading", { name: "Release Queue" })).toBeVisible();
  const regressionVisualContext = await captureVisualContext(page);
  const regressionSemantic = await captureSemanticSnapshot(page);
  const viewportContexts = await captureViewportContexts(page);
  await page.setViewportSize({ width: 1280, height: 760 });
  await gotoApp(page);

  await page.getByRole("button", { name: "Blocked" }).click();
  await expect(page.getByRole("button", { name: "Blocked" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("release-row-invoice-export")).toBeVisible();

  await page.getByRole("button", { name: "Open Invoice Export details" }).click();
  await expect(page.getByTestId("selected-service")).toHaveText("Invoice Export");
  await expect(page.getByTestId("detail-summary")).toHaveText("Ledger archive release is waiting for compliance approval.");

  const observations = [{
    url: "http://127.0.0.1:4173/release-queue",
    title: "Release Queue",
    roles: [
      "heading \"Release Queue\"",
      "heading \"Candidate releases\"",
      "heading \"Release detail\"",
      "button \"All\"",
      "button \"Blocked\"",
      "button \"Ready\"",
      "button \"Open Payments API details\"",
      "button \"Open Invoice Export details\""
    ],
    labels: ["Search releases"],
    testIds: [
      "ready-count",
      "blocked-count",
      "release-row-payments-api",
      "release-row-invoice-export",
      "selected-service",
      "detail-status",
      "detail-summary"
    ],
    texts: [
      "Payments API",
      "Invoice Export",
      "Blocked",
      "Waiting on fraud review approval before checkout authorization rollout.",
      "Ledger archive release is waiting for compliance approval."
    ]
  }];

  await mkdir(".vrt/markup-vrt-eval/specs", { recursive: true });
  await writeFile(
    ".vrt/markup-vrt-eval/specs/release-queue.observations.json",
    JSON.stringify(observations, null, 2) + "\n",
  );
  await writeFile(
    ".vrt/markup-vrt-eval/specs/release-queue.visual-context.json",
    JSON.stringify({
      viewport: stableVisualContext.viewport,
      elements: stableVisualContext.elements,
      semantic: stableSemantic,
      viewports: [
        { label: "desktop", ...stableVisualContext, semantic: stableSemantic },
        ...viewportContexts,
      ],
      variants: {
        stable: { ...stableVisualContext, semantic: stableSemantic },
        regression: { ...regressionVisualContext, semantic: regressionSemantic },
      },
    }, null, 2) + "\n",
  );
});

async function captureVisualContext(page) {
  return page.evaluate(() => {
    const styleProperties = [
      "display",
      "position",
      "top",
      "left",
      "width",
      "height",
      "min-width",
      "min-height",
      "max-width",
      "max-height",
      "margin-top",
      "margin-right",
      "margin-bottom",
      "margin-left",
      "padding-top",
      "padding-right",
      "padding-bottom",
      "padding-left",
      "gap",
      "row-gap",
      "column-gap",
      "grid-template-columns",
      "grid-template-rows",
      "align-content",
      "align-items",
      "justify-content",
      "background-color",
      "color",
      "border-top-color",
      "border-right-color",
      "border-bottom-color",
      "border-left-color",
      "border-color",
      "box-shadow",
      "font-size",
      "line-height",
    ];
    const elements = Array.from(document.querySelectorAll([
      "main",
      "section",
      "article",
      "aside",
      "table",
      "tr",
      "td",
      "th",
      "button",
      "[data-testid]",
      ".metric",
      ".pill",
      ".queue",
      ".detail-panel",
      ".risk-bar",
    ].join(",")));
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      elements: elements.map((element, index) => {
        const rect = element.getBoundingClientRect();
        const computed = window.getComputedStyle(element);
        return {
          key: elementKey(element, index),
          path: elementPath(element, index),
          selector: selectorHint(element),
          tag: element.tagName.toLowerCase(),
          id: element.id || undefined,
          classes: typeof element.className === "string" ? element.className : "",
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          styles: Object.fromEntries(styleProperties.map((property) => [property, computed.getPropertyValue(property)])),
        };
      }).filter((entry) => entry.width > 0 && entry.height > 0),
    };

    function elementKey(element, index) {
      const rect = element.getBoundingClientRect();
      return [
        element.tagName.toLowerCase(),
        elementPath(element, index),
        Math.round(rect.left),
        Math.round(rect.top),
      ].join("|");
    }

    function elementPath(element, index) {
      const testId = element.getAttribute("data-testid");
      if (testId) return `[data-testid="${testId}"]`;
      if (element.id) return `#${element.id}`;
      const className = typeof element.className === "string"
        ? element.className.split(/\s+/).filter(Boolean)[0]
        : "";
      if (className) return `.${className}:nth(${index})`;
      return `${element.tagName.toLowerCase()}:nth(${index})`;
    }

    function selectorHint(element) {
      const testId = element.getAttribute("data-testid");
      if (testId) return `[data-testid="${testId}"]`;
      if (element.id) return `#${element.id}`;
      const className = typeof element.className === "string"
        ? element.className.split(/\s+/).filter(Boolean)[0]
        : "";
      return className ? `.${className}` : element.tagName.toLowerCase();
    }
  });
}

async function captureSemanticSnapshot(page) {
  return page.evaluate(() => ({
    headings: Array.from(document.querySelectorAll("h1,h2,h3"))
      .map((element) => element.textContent?.trim() ?? "")
      .filter(Boolean),
    buttons: Array.from(document.querySelectorAll("button"))
      .map((element) => ({
        text: element.textContent?.trim() ?? "",
        ariaLabel: element.getAttribute("aria-label") ?? "",
        pressed: element.getAttribute("aria-pressed") ?? "",
      })),
    testIds: Object.fromEntries(Array.from(document.querySelectorAll("[data-testid]"))
      .map((element) => [
        element.getAttribute("data-testid") ?? "",
        element.textContent?.replace(/\s+/g, " ").trim() ?? "",
      ])
      .filter(([key]) => key)),
  }));
}

async function captureViewportContexts(page) {
  const contexts = [];
  for (const viewport of [
    { label: "mobile", width: 390, height: 760 },
    { label: "wide", width: 1440, height: 860 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/release-queue");
    await expect(page.getByRole("heading", { name: "Release Queue" })).toBeVisible();
    contexts.push({
      label: viewport.label,
      ...(await captureVisualContext(page)),
      semantic: await captureSemanticSnapshot(page),
    });
  }
  return contexts;
}
