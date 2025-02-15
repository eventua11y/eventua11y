import { test, expect } from '@playwright/test';

test.describe('Filters functionality', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(baseURL);
    
    // Wait for all critical components and network activity
    await Promise.all([
      page.waitForLoadState('networkidle'),
      page.waitForLoadState('domcontentloaded'),
      page.waitForSelector('#upcoming-events', { state: 'visible' }),
      page.waitForSelector('#filters', { state: 'visible' }),
      page.waitForSelector('#open-filter-drawer:not([disabled])', {
        state: 'visible',
        timeout: 5000
      }),
    ]);
  });

  const openFilterDrawer = async (page) => {
    const filterButton = page.getByRole('button', { name: 'Filter' });
    await filterButton.waitFor({ state: 'visible', timeout: 5000 });
    await filterButton.click();
    
    const drawer = page.locator('#filter-drawer');
    await drawer.waitFor({ state: 'visible', timeout: 5000 });
    
    // Wait for drawer animation and ensure content is actually visible
    await page.waitForSelector('#filter-drawer[open]', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300); // Standard animation duration
    return drawer;
  };

  test('filter button is visible and interactive', async ({ page }) => {
    const filterButton = page.getByRole('button', { name: 'Filter' });
    await expect(filterButton).toBeVisible();
    await expect(filterButton).toBeEnabled();
  });

  test('filter drawer opens when filter button is clicked', async ({
    page,
  }) => {
    const drawer = await openFilterDrawer(page);
    await expect(drawer).toHaveAttribute('open', '');
    await expect(drawer).toBeVisible();
  });

  test('filter drawer closes when close button is clicked', async ({
    page,
  }) => {
    const drawer = await openFilterDrawer(page);

    const closeButton = page.getByRole('button', {
      name: /Show \d+ of \d+ events/,
    });
    await closeButton.waitFor({ state: 'visible', timeout: 5000 });
    await closeButton.click();

    // Wait for drawer animation
    await page.waitForTimeout(300);
    await expect(drawer).not.toBeVisible();
    await expect(drawer).not toHaveAttribute('open');
  });

  test('filter drawer closes when esc key is pressed', async ({ page }) => {
    const drawer = await openFilterDrawer(page);

    await page.keyboard.press('Escape');
    // Wait for drawer animation
    await page.waitForTimeout(300);
    await expect(drawer).not.toBeVisible();
    await expect(drawer).not toHaveAttribute('open');
  });

  test('reset button appears when filters are applied', async ({ page }) => {
    await openFilterDrawer(page);

    const resetButton = page.getByTestId('drawer-reset');
    await expect(resetButton).not toBeVisible();

    // Use radio button text content to find and click it
    await page.getByText('Online', { exact: true }).first().click();
    await page.waitForTimeout(100); // Wait for state update

    await resetButton.scrollIntoViewIfNeeded();
    await expect(resetButton).toBeVisible();
  });

  test('reset button clears filters', async ({ page }) => {
    await openFilterDrawer(page);

    // Click the "Not accepting talks" radio using text content
    await page
      .getByText('Not accepting talks', { exact: true })
      .first()
      .click();
    await page.waitForTimeout(100); // Wait for state update

    const resetButton = page.getByTestId('drawer-reset');
    await resetButton.scrollIntoViewIfNeeded();
    await resetButton.waitFor({ state: 'visible' });
    await resetButton.click();

    // Wait for button to disappear (confirms reset completed)
    await expect(resetButton).not toBeVisible();

    // Wait for and verify that all radio groups show "No preference" as selected
    const noPreferenceRadios = page.locator('sl-radio[value="any"]');
    for (const radio of await noPreferenceRadios.all()) {
      await expect(radio).toHaveAttribute('aria-checked', 'true');
    }
  });
});
