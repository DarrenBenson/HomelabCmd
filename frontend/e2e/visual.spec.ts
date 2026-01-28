import { test, expect } from '@playwright/test';

/**
 * Visual E2E Tests (AC6: Brand Guide Compliance)
 *
 * These tests verify the dashboard follows the brand colour palette
 * and typography guidelines defined in the design system.
 *
 * Brand Colours:
 * - Phosphor Green (online LED): #4ADE80 = rgb(74, 222, 128)
 * - Red Alert (offline LED): #F87171 = rgb(248, 113, 113)
 * - Carbon Background: #0D0D0D = rgb(13, 13, 13)
 * - Steel Border: #27272A = rgb(39, 39, 42)
 */

test.describe('Brand Colours (AC6)', () => {
  test('online LED uses Phosphor Green #4ADE80', async ({ page }) => {
    // Mock API to return an online server
    await page.route('**/api/v1/servers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          servers: [
            {
              id: 'online-server',
              hostname: 'online-server.local',
              display_name: 'Online Server',
              status: 'online',
              latest_metrics: {
                cpu_percent: 50,
                memory_percent: 60,
                disk_percent: 70,
                uptime_seconds: 86400,
              },
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('[role="status"]', { timeout: 10000 });

    const led = page.locator('[role="status"]').first();

    // Get the computed background color
    const bgColor = await led.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Phosphor Green #4ADE80 = rgb(74, 222, 128)
    expect(bgColor).toBe('rgb(74, 222, 128)');
  });

  test('offline LED uses Red Alert #F87171', async ({ page }) => {
    // Mock API to return an offline server
    await page.route('**/api/v1/servers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          servers: [
            {
              id: 'offline-server',
              hostname: 'offline-server.local',
              display_name: 'Offline Server',
              status: 'offline',
              latest_metrics: null,
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('[role="status"]', { timeout: 10000 });

    const led = page.locator('[role="status"]').first();

    const bgColor = await led.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // Red Alert #F87171 = rgb(248, 113, 113)
    expect(bgColor).toBe('rgb(248, 113, 113)');
  });

  test('unknown status LED uses muted colour', async ({ page }) => {
    await page.route('**/api/v1/servers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          servers: [
            {
              id: 'unknown-server',
              hostname: 'unknown-server.local',
              display_name: 'Unknown Server',
              status: 'unknown',
              latest_metrics: null,
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('[role="status"]', { timeout: 10000 });

    const led = page.locator('[role="status"]').first();
    const classes = await led.getAttribute('class');

    // Unknown status should use muted styling
    expect(classes).toContain('bg-text-muted');
  });
});

test.describe('Typography (AC6)', () => {
  test('header uses correct font family', async ({ page }) => {
    await page.route('**/api/v1/servers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          servers: [
            {
              id: 'test',
              hostname: 'test',
              display_name: 'Test',
              status: 'online',
              latest_metrics: null,
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 10000 });

    const h1 = page.locator('h1');
    const fontFamily = await h1.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily;
    });

    // Should use sans-serif font (Inter, system fonts)
    expect(fontFamily.toLowerCase()).toMatch(
      /(inter|ui-sans-serif|system-ui|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica neue|arial|sans-serif)/
    );
  });

  test('server count uses monospace font', async ({ page }) => {
    await page.route('**/api/v1/servers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          servers: [
            {
              id: 'test',
              hostname: 'test',
              display_name: 'Test',
              status: 'online',
              latest_metrics: null,
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('[data-testid="server-card"]', { timeout: 10000 });

    // Find the server count element (contains "1 server")
    const serverCount = page.locator('text=/\\d+ servers?/');
    const fontFamily = await serverCount.evaluate((el) => {
      return window.getComputedStyle(el).fontFamily;
    });

    // Should use monospace font
    expect(fontFamily.toLowerCase()).toMatch(
      /(fira code|jetbrains mono|ui-monospace|sfmono-regular|menlo|monaco|consolas|liberation mono|courier new|monospace)/
    );
  });

  test('header text uses success colour (green)', async ({ page }) => {
    await page.route('**/api/v1/servers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          servers: [
            {
              id: 'test',
              hostname: 'test',
              display_name: 'Test',
              status: 'online',
              latest_metrics: null,
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('h1', { timeout: 10000 });

    const h1 = page.locator('h1');
    const textColor = await h1.evaluate((el) => {
      return window.getComputedStyle(el).color;
    });

    // Should be Phosphor Green #4ADE80 = rgb(74, 222, 128)
    expect(textColor).toBe('rgb(74, 222, 128)');
  });
});

test.describe('Background and Borders (AC6)', () => {
  test('page uses dark background', async ({ page }) => {
    await page.route('**/api/v1/servers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          servers: [
            {
              id: 'test',
              hostname: 'test',
              display_name: 'Test',
              status: 'online',
              latest_metrics: null,
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('[data-testid="server-card"]', { timeout: 10000 });

    // Find the main container with dark background
    const mainContainer = page.locator('.bg-bg-primary').first();
    const exists = await mainContainer.count();

    expect(exists).toBeGreaterThan(0);
  });

  test('server cards have border styling', async ({ page }) => {
    await page.route('**/api/v1/servers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          servers: [
            {
              id: 'test',
              hostname: 'test',
              display_name: 'Test',
              status: 'online',
              latest_metrics: null,
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('[data-testid="server-card"]', { timeout: 10000 });

    const card = page.locator('[data-testid="server-card"]').first();
    const borderWidth = await card.evaluate((el) => {
      return window.getComputedStyle(el).borderWidth;
    });

    // Cards should have a border
    expect(borderWidth).not.toBe('0px');
  });

  test('header has bottom border', async ({ page }) => {
    await page.route('**/api/v1/servers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          servers: [
            {
              id: 'test',
              hostname: 'test',
              display_name: 'Test',
              status: 'online',
              latest_metrics: null,
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('header', { timeout: 10000 });

    const header = page.locator('header');
    const classes = await header.getAttribute('class');

    // Header should have border-b class
    expect(classes).toContain('border-b');
  });
});

test.describe('LED Animation (AC2)', () => {
  test('online LED has pulsing animation class', async ({ page }) => {
    await page.route('**/api/v1/servers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          servers: [
            {
              id: 'online-server',
              hostname: 'online-server.local',
              display_name: 'Online Server',
              status: 'online',
              latest_metrics: {
                cpu_percent: 50,
                memory_percent: 60,
                disk_percent: 70,
                uptime_seconds: 86400,
              },
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('[role="status"]', { timeout: 10000 });

    const led = page.locator('[role="status"]').first();
    const classes = await led.getAttribute('class');

    // Online LED should have pulsing animation
    expect(classes).toContain('animate-pulse-green');
  });

  test('online LED has animation applied via CSS', async ({ page }) => {
    await page.route('**/api/v1/servers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          servers: [
            {
              id: 'online-server',
              hostname: 'online-server.local',
              display_name: 'Online Server',
              status: 'online',
              latest_metrics: null,
            },
          ],
          total: 1,
        }),
      });
    });

    await page.goto('/');
    await page.waitForSelector('[role="status"]', { timeout: 10000 });

    const led = page.locator('[role="status"]').first();

    // Check that animation is applied
    const animationName = await led.evaluate((el) => {
      return window.getComputedStyle(el).animationName;
    });

    // Should have an animation (not "none")
    expect(animationName).not.toBe('none');
  });
});
