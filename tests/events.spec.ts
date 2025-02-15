// @ts-check
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Events page', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');

    // Clear any open drawers
    const filterDrawer = page.locator('#filter-drawer');
    await filterDrawer.waitFor({ state: 'attached', timeout: 5000 });
    const isVisible = await filterDrawer.isVisible();
    if (isVisible) {
      await page.keyboard.press('Escape');
      await expect(filterDrawer).not.toBeVisible();
    }

    // Wait for main content
    await Promise.all([
      page.waitForSelector('#upcoming-events', { state: 'visible' }),
      page.waitForSelector('#global-header', { state: 'visible' }),
      page.waitForSelector('#global-footer', { state: 'visible' }),
    ]);
  });

  test('has title', async ({ page }) => {
    await expect(page).toHaveTitle(/Eventua11y/, { timeout: 10000 });
  });

  test('header is visible', async ({ page }) => {
    const header = page.locator('#global-header');
    await expect(header).toBeVisible();
    await expect(header).toBeInViewport();
  });

  test('Today heading is visible', async ({ page }) => {
    const heading = page.getByRole('heading', { name: 'Today' });
    await expect(heading).toBeVisible();
    await expect(heading).toBeInViewport();
  });

  test('footer is visible', async ({ page }) => {
    const footer = page.locator('#global-footer');
    await expect(footer).toBeVisible();
  });

  test('has no accessibility violations', async ({ page }) => {
    // Wait for dynamic content to load
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('#upcoming-events .event', { state: 'visible' });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('#filter-drawer') // Exclude drawer to avoid false positives
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('has at least one upcoming event', async ({ page }) => {
    const upcomingEvents = page.locator('.event');
    await upcomingEvents.first().waitFor({ state: 'visible' });
    const countOfEvents = await upcomingEvents.count();
    await expect(countOfEvents).toBeGreaterThan(0);
  });
});
