export function buildOfflineStructuredPlan() {
  return {
    title: "Release Queue VRT Smoke",
    applicationOverview: "Release Queue coordinates service releases, blocked approvals, and release detail review.",
    scenarios: [{
      title: "Blocked filter and Invoice Export detail panel",
      steps: [
        "Open the Release Queue screen.",
        "Verify the summary counts and candidate release table are visible.",
        "Capture the initial VRT screenshot.",
        "Apply the Blocked filter.",
        "Open the Invoice Export detail panel.",
        "Verify the selected service and detail summary.",
        "Capture the detail-state VRT screenshot.",
      ],
      expectedResults: [
        "The Release Queue heading is visible.",
        "The blocked count remains 2.",
        "The Invoice Export row remains visible after the Blocked filter is applied.",
        "The detail panel shows Invoice Export and the compliance approval summary.",
      ],
      vrt: {
        startState: "initial Release Queue view",
        goalState: "Blocked filter with Invoice Export detail selected",
      },
    }],
    generationNotes: [
      "Use gotoApp(page) from the configured helper import.",
      "Use only observed role and test id locators.",
      "Assert semantic state before each screenshot.",
      "Capture deterministic screenshots for the initial and detail states.",
    ],
    locatorInventory: buildOfflineLocatorInventory(),
  };
}

export function buildOfflineLocatorInventory() {
  return {
    roles: [
      'heading "Release Queue"',
      'heading "Candidate releases"',
      'heading "Release detail"',
      'button "All"',
      'button "Blocked"',
      'button "Ready"',
      'button "Open Payments API details"',
      'button "Open Invoice Export details"',
    ],
    labels: ["Search releases"],
    testIds: [
      "ready-count",
      "blocked-count",
      "release-row-payments-api",
      "release-row-invoice-export",
      "selected-service",
      "detail-status",
      "detail-summary",
    ],
    texts: [
      "Payments API",
      "Invoice Export",
      "Blocked",
      "Waiting on fraud review approval before checkout authorization rollout.",
      "Ledger archive release is waiting for compliance approval.",
    ],
  };
}

export function renderOfflinePlanMarkdown() {
  return `# Release Queue VRT Smoke

## Application Overview

Release Queue coordinates service releases, blocked approvals, and release detail review.

## Test Scenarios

### Blocked filter and Invoice Export detail panel

Steps:
1. Open the Release Queue screen.
2. Verify the summary counts and candidate release table are visible.
3. Capture the initial VRT screenshot.
4. Apply the Blocked filter.
5. Open the Invoice Export detail panel.
6. Verify the selected service and detail summary.
7. Capture the detail-state VRT screenshot.

Expected results:
1. The Release Queue heading is visible.
2. The blocked count remains 2.
3. The Invoice Export row remains visible after the Blocked filter is applied.
4. The detail panel shows Invoice Export and the compliance approval summary.

VRT:
- Start state: initial Release Queue view
- Goal state: Blocked filter with Invoice Export detail selected

## Generation Notes

- Use gotoApp(page) from the configured helper import.
- Use only observed role and test id locators.
- Assert semantic state before each screenshot.
- Capture deterministic screenshots for the initial and detail states.

## Locator Inventory

Roles:
${buildOfflineLocatorInventory().roles.map((role) => `- ${role}`).join("\n")}

Labels:
${buildOfflineLocatorInventory().labels.map((label) => `- ${label}`).join("\n")}

Test ids:
${buildOfflineLocatorInventory().testIds.map((testId) => `- ${testId}`).join("\n")}

Texts:
${buildOfflineLocatorInventory().texts.map((text) => `- ${text}`).join("\n")}
`;
}

export function buildOfflineGeneratedTest(helperImportPath) {
  return `import { expect, test } from "@playwright/test";
import { gotoApp } from "${helperImportPath}";

test("Release Queue offline VRT smoke", async ({ page }) => {
  await gotoApp(page);
  await expect(page.getByRole("heading", { name: "Release Queue" })).toBeVisible();
  await expect(page.getByTestId("blocked-count")).toHaveText("2");
  await expect(page.getByTestId("release-row-invoice-export")).toBeVisible();
  await expect(page).toHaveScreenshot("release-queue-initial.png");

  await page.getByRole("button", { name: "Blocked" }).click();
  await expect(page.getByRole("button", { name: "Blocked" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("release-row-invoice-export")).toBeVisible();

  await page.getByRole("button", { name: "Open Invoice Export details" }).click();
  await expect(page.getByTestId("selected-service")).toHaveText("Invoice Export");
  await expect(page.getByTestId("detail-summary")).toHaveText("Ledger archive release is waiting for compliance approval.");
  await expect(page).toHaveScreenshot("release-queue-invoice-export.png");
});
`;
}
