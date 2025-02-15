import { test, expect } from '@playwright/test';

test.describe('Theme Switching', () => {
  test.beforeEach(async ({ context, page }) => {
    // Reset storage state
    await context.addInitScript(() => {
      window.localStorage.clear();
    });
    await context.clearCookies();

    // Reset system preference and load page
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');

    // Wait for critical components to be ready
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.waitForLoadState('domcontentloaded'),
      page.waitForSelector('#upcoming-events', { state: 'visible' }),
      page.waitForSelector('#theme-selector-button', { state: 'visible' }),
    ]);

    // Ensure clean state with more reasonable drawer handling
    const filterDrawer = page.locator('#filter-drawer');
    try {
      await filterDrawer.waitFor({ state: 'attached', timeout: 5000 });
      if (await filterDrawer.isVisible()) {
        await page.keyboard.press('Escape');
        await filterDrawer.waitFor({ state: 'hidden', timeout: 2000 });
      }
    } catch (e) {
      // If drawer timeout occurs, it's likely already hidden
      console.log('Filter drawer not found or already hidden');
    }
  });

  const switchTheme = async (page, themeId) => {
    await page.click('#theme-selector-button');
    await page.waitForSelector('#theme-selector sl-menu', { state: 'visible' });
    await page.click(`#${themeId}`);
  };

  test('should start with system theme', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(
      page.locator('#theme-selector-button sl-icon[label="Light mode"]')
    ).toBeVisible();
  });

  test('should switch to light theme and persist', async ({
    context,
    page,
  }) => {
    await switchTheme(page, 'light-mode');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(
      page.locator('#theme-selector-button sl-icon[label="Light mode"]')
    ).toBeVisible();

    // Test persistence in new page
    const newPage = await context.newPage();
    await newPage.goto('/');
    await newPage.waitForLoadState('networkidle');

    await expect(newPage.locator('html')).toHaveAttribute(
      'data-theme',
      'light'
    );
    await newPage.close();
  });

  test('should switch to dark theme and persist', async ({
    context,
    page,
    browser,
  }) => {
    await switchTheme(page, 'dark-mode');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(
      page.locator('#theme-selector-button sl-icon[label="Dark mode"]')
    ).toBeVisible();

    // Test persistence with storage state
    const storageState = await context.storageState();
    const newContext = await browser.newContext({ storageState });
    const newPage = await newContext.newPage();

    await newPage.goto('/');
    await newPage.waitForLoadState('networkidle');

    await expect(newPage.locator('html')).toHaveAttribute('data-theme', 'dark');
    await newContext.close();
  });

  test('should respect system preference when set to system theme', async ({
    page,
  }) => {
    // Test dark preference
    await switchTheme(page, 'system-default');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // Test light preference
    await page.emulateMedia({ colorScheme: 'light' });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('should handle theme selector interactions correctly', async ({
    page,
  }) => {
    const menu = page.locator('#theme-selector sl-menu');

    // Test menu opening
    await page.click('#theme-selector-button');
    await expect(menu).toBeVisible();

    // Test click outside
    await page.click('body', { position: { x: 0, y: 0 } });
    await expect(menu).not.toBeVisible();

    // Test keyboard interaction
    await page.click('#theme-selector-button');
    await expect(menu).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(menu).not.toBeVisible();
  });
});
