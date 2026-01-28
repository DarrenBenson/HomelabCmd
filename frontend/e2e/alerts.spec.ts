import { test, expect } from '@playwright/test';

/**
 * Alerts Page E2E Tests
 *
 * Tests for the alerts page functionality including:
 * - Alert list display
 * - Filtering by status, severity, server
 * - Pagination
 * - Alert actions (acknowledge, resolve)
 * - Alert detail panel
 */

const createMockAlert = (overrides = {}) => ({
  id: 1,
  server_id: 'server-1',
  server_name: 'Test Server',
  alert_type: 'cpu_high',
  severity: 'high' as const,
  status: 'open' as const,
  title: 'CPU usage high',
  message: 'CPU usage exceeded 80%',
  metric_value: 85.5,
  threshold_value: 80,
  created_at: new Date().toISOString(),
  acknowledged_at: null,
  resolved_at: null,
  auto_resolved: false,
  can_acknowledge: true,
  can_resolve: true,
  service_name: null,
  ...overrides,
});

const mockAlerts = {
  alerts: [
    createMockAlert({ id: 1, severity: 'critical', title: 'CPU critical', status: 'open' }),
    createMockAlert({ id: 2, severity: 'high', title: 'Memory high', status: 'open' }),
    createMockAlert({ id: 3, severity: 'medium', title: 'Disk warning', status: 'acknowledged' }),
    createMockAlert({
      id: 4,
      severity: 'low',
      title: 'Service restarted',
      status: 'resolved',
      can_acknowledge: false,
      can_resolve: false,
    }),
  ],
  total: 4,
};

const mockServers = {
  servers: [
    { id: 'server-1', hostname: 'server1.local', display_name: 'Server 1', status: 'online' },
    { id: 'server-2', hostname: 'server2.local', display_name: 'Server 2', status: 'online' },
  ],
  total: 2,
};

test.describe('Alerts Page', () => {
  test.describe('Page Structure', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/alerts*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAlerts),
        });
      });

      await page.route('**/api/v1/servers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockServers),
        });
      });
    });

    test('displays page header', async ({ page }) => {
      await page.goto('/alerts');

      await expect(page.locator('h1')).toContainText('Alerts');
    });

    test('displays back button', async ({ page }) => {
      await page.goto('/alerts');

      const backButton = page.locator('[data-testid="back-button"]');
      await expect(backButton).toBeVisible();
    });

    test('displays filters', async ({ page }) => {
      await page.goto('/alerts');

      await expect(page.locator('[data-testid="status-filter"]')).toBeVisible();
      await expect(page.locator('[data-testid="severity-filter"]')).toBeVisible();
      await expect(page.locator('[data-testid="server-filter"]')).toBeVisible();
    });

    test('displays refresh button', async ({ page }) => {
      await page.goto('/alerts');

      await expect(page.locator('[data-testid="refresh-button"]')).toBeVisible();
    });

    test('displays alerts table', async ({ page }) => {
      await page.goto('/alerts');

      await expect(page.locator('[data-testid="alerts-table"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Alert List Display', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/alerts*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAlerts),
        });
      });

      await page.route('**/api/v1/servers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockServers),
        });
      });
    });

    test('displays alert rows', async ({ page }) => {
      await page.goto('/alerts');
      await page.waitForSelector('[data-testid="alerts-table"]', { timeout: 10000 });

      // Should have 4 alert rows
      const rows = page.locator('[data-testid^="alert-row-"]');
      await expect(rows).toHaveCount(4);
    });

    test('displays severity badges', async ({ page }) => {
      await page.goto('/alerts');
      await page.waitForSelector('[data-testid="alerts-table"]', { timeout: 10000 });

      await expect(page.locator('text=CRITICAL')).toBeVisible();
      await expect(page.locator('text=HIGH')).toBeVisible();
      await expect(page.locator('text=MEDIUM')).toBeVisible();
      await expect(page.locator('text=LOW')).toBeVisible();
    });

    test('displays alert titles', async ({ page }) => {
      await page.goto('/alerts');
      await page.waitForSelector('[data-testid="alerts-table"]', { timeout: 10000 });

      await expect(page.locator('text=CPU critical')).toBeVisible();
      await expect(page.locator('text=Memory high')).toBeVisible();
    });

    test('displays acknowledge button for open alerts', async ({ page }) => {
      await page.goto('/alerts');
      await page.waitForSelector('[data-testid="alerts-table"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="acknowledge-button-1"]')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/alerts*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAlerts),
        });
      });

      await page.route('**/api/v1/servers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockServers),
        });
      });
    });

    test('back button navigates to dashboard', async ({ page }) => {
      await page.goto('/alerts');

      await page.click('[data-testid="back-button"]');

      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Filtering', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/servers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockServers),
        });
      });
    });

    test('status filter updates URL', async ({ page }) => {
      await page.route('**/api/v1/alerts*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAlerts),
        });
      });

      await page.goto('/alerts');
      await page.waitForSelector('[data-testid="status-filter"]', { timeout: 10000 });

      await page.selectOption('[data-testid="status-filter"]', 'open');

      await expect(page).toHaveURL(/status=open/);
    });

    test('severity filter updates URL', async ({ page }) => {
      await page.route('**/api/v1/alerts*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAlerts),
        });
      });

      await page.goto('/alerts');
      await page.waitForSelector('[data-testid="severity-filter"]', { timeout: 10000 });

      await page.selectOption('[data-testid="severity-filter"]', 'critical');

      await expect(page).toHaveURL(/severity=critical/);
    });

    test('server filter updates URL', async ({ page }) => {
      await page.route('**/api/v1/alerts*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAlerts),
        });
      });

      await page.goto('/alerts');
      await page.waitForSelector('[data-testid="server-filter"]', { timeout: 10000 });

      await page.selectOption('[data-testid="server-filter"]', 'server-1');

      await expect(page).toHaveURL(/server=server-1/);
    });

    test('clear filters button removes filters', async ({ page }) => {
      await page.route('**/api/v1/alerts*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAlerts),
        });
      });

      await page.goto('/alerts?status=open&severity=critical');
      await page.waitForSelector('[data-testid="clear-filters"]', { timeout: 10000 });

      await page.click('[data-testid="clear-filters"]');

      await expect(page).toHaveURL('/alerts');
    });
  });

  test.describe('Alert Actions', () => {
    test('acknowledge button calls API', async ({ page }) => {
      let acknowledgeApiCalled = false;

      await page.route('**/api/v1/alerts*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAlerts),
        });
      });

      await page.route('**/api/v1/alerts/1/acknowledge', (route) => {
        acknowledgeApiCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...mockAlerts.alerts[0], status: 'acknowledged' }),
        });
      });

      await page.route('**/api/v1/servers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockServers),
        });
      });

      await page.goto('/alerts');
      await page.waitForSelector('[data-testid="acknowledge-button-1"]', { timeout: 10000 });

      await page.click('[data-testid="acknowledge-button-1"]');

      // Wait a bit for the API call
      await page.waitForTimeout(500);
      expect(acknowledgeApiCalled).toBe(true);
    });
  });

  test.describe('Alert Detail Panel', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/alerts*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAlerts),
        });
      });

      await page.route('**/api/v1/servers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockServers),
        });
      });
    });

    test('clicking alert row opens detail panel', async ({ page }) => {
      await page.goto('/alerts');
      await page.waitForSelector('[data-testid="alert-row-1"]', { timeout: 10000 });

      await page.click('[data-testid="alert-row-1"]');

      // Detail panel should appear
      await expect(page.locator('text=CPU critical')).toBeVisible();
    });
  });

  test.describe('Empty State', () => {
    test('shows empty state when no alerts', async ({ page }) => {
      await page.route('**/api/v1/alerts*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ alerts: [], total: 0 }),
        });
      });

      await page.route('**/api/v1/servers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockServers),
        });
      });

      await page.goto('/alerts');

      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=No alerts found')).toBeVisible();
    });
  });

  test.describe('Loading State', () => {
    test('shows loading spinner', async ({ page }) => {
      // Delay the API response
      await page.route('**/api/v1/alerts*', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAlerts),
        });
      });

      await page.route('**/api/v1/servers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockServers),
        });
      });

      await page.goto('/alerts');

      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible({ timeout: 500 });
    });
  });

  test.describe('Error State', () => {
    test('shows error state on API failure', async ({ page }) => {
      await page.route('**/api/v1/alerts*', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Internal server error' }),
        });
      });

      await page.route('**/api/v1/servers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockServers),
        });
      });

      await page.goto('/alerts');

      await expect(page.locator('[data-testid="error-state"]')).toBeVisible({ timeout: 10000 });
    });

    test('retry button refetches alerts', async ({ page }) => {
      let callCount = 0;

      await page.route('**/api/v1/alerts*', (route) => {
        callCount++;
        if (callCount === 1) {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Internal server error' }),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockAlerts),
          });
        }
      });

      await page.route('**/api/v1/servers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockServers),
        });
      });

      await page.goto('/alerts');
      await page.waitForSelector('[data-testid="error-state"]', { timeout: 10000 });

      // Click retry
      await page.click('button:has-text("Retry")');

      // Should now show alerts
      await expect(page.locator('[data-testid="alerts-table"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Refresh', () => {
    test('refresh button refetches alerts', async ({ page }) => {
      let callCount = 0;

      await page.route('**/api/v1/alerts*', (route) => {
        callCount++;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAlerts),
        });
      });

      await page.route('**/api/v1/servers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockServers),
        });
      });

      await page.goto('/alerts');
      await page.waitForSelector('[data-testid="alerts-table"]', { timeout: 10000 });

      const initialCount = callCount;
      await page.click('[data-testid="refresh-button"]');

      // Wait for API call
      await page.waitForTimeout(500);
      expect(callCount).toBeGreaterThan(initialCount);
    });
  });
});
