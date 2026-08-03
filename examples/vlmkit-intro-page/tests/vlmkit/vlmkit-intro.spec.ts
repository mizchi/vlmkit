import { test, expect } from '@playwright/test';
import { gotoApp } from './support/goto-app';

test('VLMKit intro smoke: hero clarity, scenario switch, and install guidance', async ({ page }) => {
  await gotoApp(page);

  await expect(page.getByTestId('dogfood-notice')).toContainText(
    'This site is generated and debugged with vlmkit itself.',
  );
  const heroHeading = page.getByRole('heading', { name: "Don't just look. Measure it." });
  const heroStatus = page.getByTestId('hero-status');
  const gateMatrix = page.getByTestId('gate-matrix');

  await expect(heroHeading).toBeVisible();
  await expect(heroStatus).toBeVisible();
  await expect(heroStatus).toContainText('KEY-FREE BY DEFAULT');
  await expect(
    page.getByText('KEY-FREE BY DEFAULT — most gates need no API key'),
  ).toBeVisible();
  await expect(gateMatrix).toBeVisible();

  const installCommand = page.getByTestId('install-command');
  await expect(installCommand).toBeVisible();
  await expect(installCommand).toContainText('npm install -D @mizchi/vlmkit');
  await expect(page.getByRole('button', { name: 'Copy install command' })).toBeVisible();

  const skillInstallers = page.getByTestId('skill-installers');
  const skillCatalog = page.getByTestId('skill-catalog');
  const automaticRouting = page.getByTestId('automatic-routing');
  const specializedSkills = [
    'agent-validation-loop',
    'auto-markup',
    'dynamic-markup',
    'markup-assist',
    'mock-markup',
    'spec-to-playwright',
    'vrt-css-fix-loop',
    'vrt-markup-synth',
    'vrt-migration-eval',
    'vrt-regression-watch',
    'vrt-visual-diff',
  ];

  await expect(skillCatalog).toBeVisible();
  await expect(automaticRouting).toBeVisible();
  await expect(automaticRouting).toContainText('never asks you to pick a skill');
  await expect(automaticRouting).toContainText('prepares the CLI and Chromium only when needed');
  await expect(automaticRouting).toContainText('“Implement this mock.”mock-markup');
  await expect(automaticRouting).toContainText(
    '“Check responsiveness and interactions.”dynamic-markup',
  );
  await expect(automaticRouting).toContainText(
    '“Turn this spec into stable tests.”spec-to-playwright',
  );
  await expect(skillCatalog).toContainText('Meta entry');
  await expect(skillCatalog).toContainText('vlmkit');
  for (const skill of specializedSkills) {
    await expect(skillCatalog).toContainText(skill);
  }
  await expect(skillInstallers).toBeVisible();
  await expect(skillInstallers).toContainText('apm install mizchi/vlmkit');
  await expect(skillInstallers).toContainText('npx skills add mizchi/vlmkit');

  const scenarioTablist = page.getByLabel('Verification scenarios');
  const tabBreakage = scenarioTablist.getByText('01 Measure breakage');
  const tabTrackChanges = scenarioTablist.getByText('02 Track change');

  await expect(scenarioTablist).toBeVisible();
  await expect(tabBreakage).toBeVisible();
  await expect(tabTrackChanges).toBeVisible();
  await expect(tabBreakage).toHaveAttribute('aria-selected', 'true');

  await tabTrackChanges.click();

  await expect(tabTrackChanges).toHaveAttribute('aria-selected', 'true');
  await expect(gateMatrix).toContainText('vlmkit snapshot');
  await expect(gateMatrix).toContainText('verdict: UNCHANGED');

  await expect(page).toHaveScreenshot('vlmkit-intro-page.png', {
    fullPage: true,
    animations: 'disabled',
  });
});
