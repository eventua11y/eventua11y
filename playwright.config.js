import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Look for test files in the "tests" directory, relative to this configuration file.
  testDir: 'tests',

  // Run all tests in parallel.
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,

  // Increase retries for better reliability
  retries: process.env.CI ? 3 : 1,

  // Opt out of parallel tests on CI.
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: 'html',

  use: {
    // Base URL to use in actions like `await page.goto('/')`.
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:8888',

    // Collect trace when retrying the failed test.
    trace: 'on-first-retry',

    // More reasonable timeouts for CI
    actionTimeout: process.env.CI ? 45000 : 30000,
    navigationTimeout: process.env.CI ? 45000 : 30000,

    // Add explicit test timeout
    testTimeout: process.env.CI ? 90000 : 60000,

    // Enable screenshot on failure
    screenshot: 'only-on-failure',

    // Enable video recording for failed tests
    video: 'retain-on-failure',

    // Add viewport size
    viewport: { width: 1280, height: 720 },

    // Add automatic waiting
    waitForNavigation: 'networkidle',

    // CI-specific browser launch options
    launchOptions: process.env.CI
      ? {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        }
      : undefined,

    // Use persistent context in CI to reduce browser startup overhead
    contextOptions: process.env.CI
      ? {
          acceptDownloads: false,
          strictSelectors: true,
        }
      : undefined,
  },
  // Configure projects for major browsers.
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Additional chromium-specific settings for CI
        launchOptions: process.env.CI
          ? {
              executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-gpu',
              ],
              headless: true,
            }
          : undefined,
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  // Run the local dev server before starting the tests,
  // but only if process.env.PLAYWRIGHT_TEST_BASE_URL isn't set.
  webServer: !process.env.PLAYWRIGHT_TEST_BASE_URL
    ? {
        command: 'netlify dev',
        port: 8888,
        reuseExistingServer: !process.env.CI,
        timeout: 60000, // Reduced server startup timeout
      }
    : undefined,
});
