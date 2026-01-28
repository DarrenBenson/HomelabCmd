import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * Run against Docker Compose environment:
 *   docker compose up -d
 *   npm run test:e2e
 *
 * Or with UI mode:
 *   npm run test:e2e:ui
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    // Base URL for tests - Docker Compose frontend
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:8081',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Additional browsers (install with: npx playwright install)
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
    // Mobile viewports
    // {
    //   name: 'mobile-chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  // Run Docker Compose before tests if not already running
  // webServer: {
  //   command: 'docker compose up -d && sleep 5',
  //   url: 'http://localhost:8081',
  //   reuseExistingServer: true,
  // },
});
