import { test, expect } from '@playwright/test';

/**
 * Config Compliance Page E2E Tests
 *
 * Covers: EP0010 (Configuration Management)
 * Tests compliance summary, machine list, filters, check actions, and navigation.
 */

const mockComplianceSummary = {
  summary: {
    compliant: 3,
    non_compliant: 2,
    never_checked: 1,
  },
  machines: [
    {
      id: 'server-1',
      display_name: 'Web Server',
      hostname: 'web-server.local',
      pack: 'standard-server',
      status: 'compliant',
      mismatch_count: 0,
      checked_at: '2026-02-17T08:00:00Z',
    },
    {
      id: 'server-2',
      display_name: 'DB Server',
      hostname: 'db-server.local',
      pack: 'database-server',
      status: 'non_compliant',
      mismatch_count: 3,
      checked_at: '2026-02-17T07:00:00Z',
    },
    {
      id: 'server-3',
      display_name: 'App Server',
      hostname: 'app-server.local',
      pack: 'standard-server',
      status: 'compliant',
      mismatch_count: 0,
      checked_at: '2026-02-17T08:30:00Z',
    },
    {
      id: 'server-4',
      display_name: 'Cache Server',
      hostname: 'cache-server.local',
      pack: 'standard-server',
      status: 'compliant',
      mismatch_count: 0,
      checked_at: '2026-02-17T09:00:00Z',
    },
    {
      id: 'server-5',
      display_name: 'Monitor Server',
      hostname: 'monitor-server.local',
      pack: 'monitoring-server',
      status: 'non_compliant',
      mismatch_count: 1,
      checked_at: '2026-02-17T06:00:00Z',
    },
    {
      id: 'server-6',
      display_name: 'New Server',
      hostname: 'new-server.local',
      pack: 'standard-server',
      status: 'never_checked',
      mismatch_count: 0,
      checked_at: null,
    },
  ],
};

async function setupComplianceRoutes(
  page: import('@playwright/test').Page,
  options: {
    summary?: unknown;
    failApi?: boolean;
  } = {}
) {
  const summary = options.summary ?? mockComplianceSummary;

  await Promise.all([
    page.route('**/api/v1/config/compliance*', (route) => {
      if (options.failApi) {
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Internal server error' }) });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(summary),
        });
      }
    }),
    page.route('**/api/v1/servers/*/config/check', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'compliant', mismatches: [] }),
      });
    }),
  ]);
}

test.describe('Config Compliance Page', () => {
  test.describe('Summary', () => {
    test('displays compliant-count, non-compliant-count, never-checked-count', async ({ page }) => {
      await setupComplianceRoutes(page);
      await page.goto('/config');
      await page.waitForSelector('[data-testid="compliant-count"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="compliant-count"]')).toContainText('3');
      await expect(page.locator('[data-testid="non-compliant-count"]')).toContainText('2');
      await expect(page.locator('[data-testid="never-checked-count"]')).toContainText('1');
    });

    test('check-all-button visible and enabled', async ({ page }) => {
      await setupComplianceRoutes(page);
      await page.goto('/config');
      await page.waitForSelector('[data-testid="check-all-button"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="check-all-button"]')).toBeVisible();
      await expect(page.locator('[data-testid="check-all-button"]')).toBeEnabled();
    });
  });

  test.describe('Machine List', () => {
    test('machine-row visible for each server', async ({ page }) => {
      await setupComplianceRoutes(page);
      await page.goto('/config');
      await page.waitForSelector('[data-testid="machine-row-server-1"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="machine-row-server-1"]')).toBeVisible();
      await expect(page.locator('[data-testid="machine-row-server-2"]')).toBeVisible();
      await expect(page.locator('[data-testid="machine-row-server-6"]')).toBeVisible();
    });

    test('check-machine calls POST config check', async ({ page }) => {
      let checkCalled = false;
      await setupComplianceRoutes(page);
      await page.route('**/api/v1/servers/server-1/config/check', (route) => {
        checkCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'compliant', mismatches: [] }),
        });
      });
      await page.goto('/config');
      await page.waitForSelector('[data-testid="check-machine-server-1"]', { timeout: 10000 });
      await page.locator('[data-testid="check-machine-server-1"]').click();
      await page.waitForTimeout(500);
      expect(checkCalled).toBe(true);
    });

    test('view-machine navigates to config diff page', async ({ page }) => {
      await setupComplianceRoutes(page);
      await page.goto('/config');
      await page.waitForSelector('[data-testid="view-machine-server-2"]', { timeout: 10000 });
      await page.locator('[data-testid="view-machine-server-2"]').click();
      await expect(page).toHaveURL(/\/servers\/server-2\/config\/diff/);
    });

    test('non-compliant machine shows mismatch count', async ({ page }) => {
      await setupComplianceRoutes(page);
      await page.goto('/config');
      await page.waitForSelector('[data-testid="machine-row-server-2"]', { timeout: 10000 });
      const row = page.locator('[data-testid="machine-row-server-2"]');
      await expect(row).toContainText('3 mismatches');
    });
  });

  test.describe('Filters and Actions', () => {
    test('compliance-status-filter filters rows', async ({ page }) => {
      await setupComplianceRoutes(page);
      await page.goto('/config');
      await page.waitForSelector('[data-testid="compliance-status-filter-non_compliant"]', { timeout: 10000 });
      await page.locator('[data-testid="compliance-status-filter-non_compliant"]').click();
      await page.waitForTimeout(300);
      // Only non-compliant machines should be visible
      await expect(page.locator('[data-testid="machine-row-server-2"]')).toBeVisible();
      await expect(page.locator('[data-testid="machine-row-server-5"]')).toBeVisible();
      await expect(page.locator('[data-testid="machine-row-server-1"]')).not.toBeVisible();
    });

    test('check-all-button triggers batch check with progress', async ({ page }) => {
      await setupComplianceRoutes(page);
      await page.goto('/config');
      await page.waitForSelector('[data-testid="check-all-button"]', { timeout: 10000 });
      await page.locator('[data-testid="check-all-button"]').click();
      // Progress bar should appear during batch check
      await expect(page.locator('[data-testid="check-all-progress"]')).toBeVisible({ timeout: 5000 });
    });

    test('compliance-status-filter-all shows all machines', async ({ page }) => {
      await setupComplianceRoutes(page);
      await page.goto('/config');
      await page.waitForSelector('[data-testid="compliance-status-filter-non_compliant"]', { timeout: 10000 });
      // First filter to non-compliant
      await page.locator('[data-testid="compliance-status-filter-non_compliant"]').click();
      await page.waitForTimeout(300);
      // Then reset to all
      await page.locator('[data-testid="compliance-status-filter-all"]').click();
      await page.waitForTimeout(300);
      // All 6 machines should be visible
      const rows = page.locator('[data-testid^="machine-row-"]');
      await expect(rows).toHaveCount(6);
    });
  });
});
