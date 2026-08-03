import { test, expect } from '@playwright/test';
import { gotoApp } from './support/goto-app';

test('display preferences smoke: EN defaults, JA toggle, and dark persist', async ({ page }) => {
  await gotoApp(page);

  const html = page.locator('html');
  await expect(html).toHaveAttribute('lang', 'en');
  await expect(html).toHaveAttribute('data-theme', 'light');

  const dogfoodNotice = page.getByTestId('dogfood-notice');
  await expect(dogfoodNotice).toBeVisible();
  await expect(dogfoodNotice).toContainText('This site is generated and debugged with vlmkit itself.');

  const githubLinkEn = page.getByRole('link', { name: 'View vlmkit on GitHub' });
  await expect(githubLinkEn).toBeVisible();
  await expect(githubLinkEn).toHaveAttribute('href', 'https://github.com/mizchi/vlmkit');

  await page.getByTestId('locale-toggle').click();

  await expect(html).toHaveAttribute('lang', 'ja');
  await expect(page.getByRole('heading', { name: '「見た」ではなく、 「測った」を。' })).toBeVisible();
  await expect(dogfoodNotice).toContainText('このサイトは vlmkit 自身で生成、デバッグされています。');
  await expect(page.getByRole('heading', { name: '一度入れたら、 あとは自然に頼むだけ。' })).toBeVisible();
  await expect(page.getByTestId('skill-catalog')).toContainText('メタエントリー');
  await expect(page.getByTestId('automatic-routing')).toContainText('利用者にスキル選択を求めず');
  await expect(page.getByTestId('skill-catalog')).toContainText('作成');
  await expect(page.getByTestId('skill-installers')).toContainText('skills CLI でインストール');

  const githubLinkJa = page.getByRole('link', { name: 'GitHub で vlmkit を見る' });
  await expect(githubLinkJa).toBeVisible();
  await expect(githubLinkJa).toHaveAttribute('href', 'https://github.com/mizchi/vlmkit');

  await page.getByTestId('locale-toggle').click();
  await expect(html).toHaveAttribute('lang', 'en');

  const themeToggle = page.getByTestId('theme-toggle');
  await themeToggle.click();

  await expect(themeToggle).toBeChecked();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  const lowerHeading = page.getByRole('heading', { name: 'Measure the page you have now.' });
  await expect(lowerHeading).toBeVisible();
  await expect(lowerHeading).toHaveCSS('color', 'rgb(16, 18, 15)');

  await page.reload();

  await expect(html).toHaveAttribute('lang', 'en');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: "Don't just look. Measure it." })).toBeVisible();
  await expect(dogfoodNotice).toContainText('This site is generated and debugged with vlmkit itself.');
  await expect(githubLinkEn).toBeVisible();
  await expect(githubLinkEn).toHaveAttribute('href', 'https://github.com/mizchi/vlmkit');

  await expect(page).toHaveScreenshot('vlmkit-intro-en-dark.png', { fullPage: true });
});
