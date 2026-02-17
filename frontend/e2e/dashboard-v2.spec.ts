import { test, expect } from '@playwright/test';

/**
 * Dashboard v2 E2E Tests
 *
 * Covers: EP0011 (Advanced Dashboard), EP0018 (Dashboard UX Simplification)
 * Tests FleetStatus component, search/filter panel, and navigation links.
 */

const mockServerOnline = {
  id: 'server-1',
  hostname: 'web-server.local',
  display_name: 'Web Server',
  status: 'online',
  is_paused: false,
  paused_at: null,
  machine_type: 'server',
  is_inactive: false,
  active_alert_count: 0,
  latest_metrics: {
    cpu_percent: 42,
    memory_percent: 68,
    disk_percent: 55,
    uptime_seconds: 86400,
  },
};

const mockServerOffline = {
  ...mockServerOnline,
  id: 'server-2',
  hostname: 'db-server.local',
  display_name: 'DB Server',
  status: 'offline',
  latest_metrics: null,
};

const mockServerWarning = {
  ...mockServerOnline,
  id: 'server-3',
  hostname: 'app-server.local',
  display_name: 'App Server',
  active_alert_count: 2,
};

const mockAlert = {
  id: 1,
  server_id: 'server-3',
  alert_type: 'cpu_high',
  severity: 'critical',
  message: 'CPU usage above 90%',
  status: 'open',
  created_at: '2026-02-17T10:00:00Z',
  updated_at: '2026-02-17T10:00:00Z',
  acknowledged_at: null,
  resolved_at: null,
  auto_resolved: false,
  service_name: null,
};

function setupDashboardRoutes(
  page: import('@playwright/test').Page,
  options: {
    servers?: unknown[];
    alerts?: unknown[];
    actions?: unknown[];
    pendingBreaches?: unknown[];
  } = {}
) {
  const servers = options.servers ?? [mockServerOnline, mockServerOffline, mockServerWarning];
  const alerts = options.alerts ?? [];
  const actions = options.actions ?? [];
  const pendingBreaches = options.pendingBreaches ?? [];

  return Promise.all([
    page.route('**/api/v1/servers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ servers, total: servers.length }),
      });
    }),
    page.route('**/api/v1/alerts?*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ alerts, total: alerts.length }),
      });
    }),
    page.route('**/api/v1/alerts/pending-breaches', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ pending: pendingBreaches }),
      });
    }),
    page.route('**/api/v1/actions*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ actions, total: actions.length }),
      });
    }),
    page.route('**/api/v1/preferences/dashboard', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          card_order: { servers: [], workstations: [] },
          collapsed_sections: [],
        }),
      });
    }),
    page.route('**/api/v1/settings/connectivity/status', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ mode: 'tailscale', configured: true }),
      });
    }),
    page.route('**/api/v1/costs/summary', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_daily_cost: 1.50, currency_symbol: '£' }),
      });
    }),
  ]);
}

test.describe('Dashboard v2', () => {
  test.describe('FleetStatus', () => {
    test('shows fleet-status component on load', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="fleet-status"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="fleet-status"]')).toBeVisible();
    });

    test('shows stat-machines count matching server total', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="stat-machines"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="stat-machines"]')).toContainText('3');
    });

    test('shows stat-online and stat-offline counts', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="stat-online"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="stat-online"]')).toContainText('2');
      await expect(page.locator('[data-testid="stat-offline"]')).toContainText('1');
    });

    test('shows alert-count badge when alerts exist', async ({ page }) => {
      await setupDashboardRoutes(page, { alerts: [mockAlert] });
      await page.goto('/');
      await page.waitForSelector('[data-testid="fleet-status"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="alert-count"]')).toBeVisible();
    });

    test('hides alert-count when no alerts', async ({ page }) => {
      await setupDashboardRoutes(page, { alerts: [] });
      await page.goto('/');
      await page.waitForSelector('[data-testid="fleet-status"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="alert-count"]')).not.toBeVisible();
    });

    test('refresh-button triggers API refetch', async ({ page }) => {
      let apiCallCount = 0;
      await setupDashboardRoutes(page);
      await page.route('**/api/v1/servers', (route) => {
        apiCallCount++;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ servers: [mockServerOnline, mockServerOffline, mockServerWarning], total: 3 }),
        });
      });
      await page.goto('/');
      await page.waitForSelector('[data-testid="refresh-button"]', { timeout: 10000 });
      const initialCount = apiCallCount;
      await page.locator('[data-testid="refresh-button"]').click();
      await page.waitForTimeout(1000);
      expect(apiCallCount).toBeGreaterThan(initialCount);
    });
  });

  test.describe('Search and Filters', () => {
    test('filter-toggle-button reveals filter-panel', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="fleet-status"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="filter-panel"]')).not.toBeVisible();
      await page.locator('[data-testid="filter-toggle-button"]').click();
      await expect(page.locator('[data-testid="filter-panel"]')).toBeVisible();
    });

    test('search-input filters displayed server cards by name', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="fleet-status"]', { timeout: 10000 });
      await page.locator('[data-testid="filter-toggle-button"]').click();
      await page.locator('[data-testid="search-input"]').fill('Web');
      await page.waitForTimeout(500);
      // Only 'Web Server' should match
      const cards = page.locator('[data-testid="server-card"]');
      await expect(cards).toHaveCount(1);
    });

    test('status-filter-offline shows only offline servers', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="fleet-status"]', { timeout: 10000 });
      await page.locator('[data-testid="filter-toggle-button"]').click();
      await page.locator('[data-testid="status-filter-offline"]').click();
      await page.waitForTimeout(500);
      const cards = page.locator('[data-testid="server-card"]');
      await expect(cards).toHaveCount(1);
    });

    test('clear-filters-button resets to show all', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="fleet-status"]', { timeout: 10000 });
      await page.locator('[data-testid="filter-toggle-button"]').click();
      await page.locator('[data-testid="status-filter-offline"]').click();
      await page.waitForTimeout(300);
      await page.locator('[data-testid="clear-filters-button"]').click();
      await page.waitForTimeout(500);
      const cards = page.locator('[data-testid="server-card"]');
      await expect(cards).toHaveCount(3);
    });
  });

  test.describe('Navigation', () => {
    test('discovery-link navigates to /discovery', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="discovery-link"]', { timeout: 10000 });
      await page.locator('[data-testid="discovery-link"]').click();
      await expect(page).toHaveURL(/\/discovery/);
    });

    test('settings-button navigates to /settings', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="settings-button"]', { timeout: 10000 });
      await page.locator('[data-testid="settings-button"]').click();
      await expect(page).toHaveURL(/\/settings/);
    });
  });
});
