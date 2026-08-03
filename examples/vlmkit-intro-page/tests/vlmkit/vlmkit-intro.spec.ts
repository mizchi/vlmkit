import { test, expect } from '@playwright/test';
import { gotoApp } from './support/goto-app';

test('VLMKit intro smoke: hero clarity, scenario switch, and install guidance', async ({ page }) => {
  await gotoApp(page);

  await expect(page.getByTestId('dogfood-notice')).toContainText(
    'このサイトは vlmkit 自身で生成、デバッグされています。',
  );
  const heroHeading = page.getByRole('heading', { name: '「見た」ではなく、 「測った」を。' });
  const heroStatus = page.getByTestId('hero-status');
  const gateMatrix = page.getByTestId('gate-matrix');

  await expect(heroHeading).toBeVisible();
  await expect(heroStatus).toBeVisible();
  await expect(heroStatus).toContainText('KEY-FREE BY DEFAULT');
  await expect(
    page.getByText('KEY-FREE BY DEFAULT — ほとんどのゲートは API キー不要'),
  ).toBeVisible();
  await expect(gateMatrix).toBeVisible();

  const installCommand = page.getByTestId('install-command');
  await expect(installCommand).toBeVisible();
  await expect(installCommand).toContainText('npm install -D @mizchi/vlmkit');
  await expect(page.getByRole('button', { name: 'インストールコマンドをコピー' })).toBeVisible();

  const scenarioTablist = page.getByLabel('検証シナリオ');
  const tabBreakage = scenarioTablist.getByText('01 壊れ方を測る');
  const tabTrackChanges = scenarioTablist.getByText('02 変化を追う');

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
