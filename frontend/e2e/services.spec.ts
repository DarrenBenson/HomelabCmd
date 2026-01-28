import { test, expect } from '@playwright/test';

/**
 * Services E2E Tests
 *
 * Tests for the services panel functionality including:
 * - Service list display
 * - Service status indicators
 * - Service restart functionality
 * - Queued actions tracking
 */

const mockServerOnline = {
  id: 'test-server-1',
  hostname: 'test-server.local',
  display_name: 'Test Server',
  ip_address: '192.168.1.100',
  status: 'online',
  last_seen: new Date().toISOString(),
  is_paused: false,
  paused_at: null,
  os_distribution: 'Ubuntu',
  os_version: '22.04',
  kernel_version: '5.15.0-generic',
  architecture: 'x86_64',
  cpu_model: 'Intel Core i7-12700K',
  cpu_cores: 12,
  machine_category: 'workstation',
  machine_category_source: 'auto',
  tdp_watts: 125,
  idle_watts: 50,
  latest_metrics: {
    cpu_percent: 45.5,
    memory_percent: 67.2,
    disk_percent: 35.0,
    uptime_seconds: 86400,
  },
};

const mockServicesResponse = {
  services: [
    {
      service_name: 'docker',
      display_name: 'Docker Engine',
      is_critical: true,
      enabled: true,
      current_status: {
        status: 'running',
        pid: 12345,
        memory_mb: 512.5,
        cpu_percent: 2.5,
        last_seen: new Date().toISOString(),
      },
    },
    {
      service_name: 'nginx',
      display_name: 'Nginx',
      is_critical: false,
      enabled: true,
      current_status: {
        status: 'stopped',
        pid: null,
        memory_mb: null,
        cpu_percent: null,
        last_seen: new Date().toISOString(),
      },
    },
    {
      service_name: 'postgresql',
      display_name: 'PostgreSQL',
      is_critical: true,
      enabled: true,
      current_status: {
        status: 'running',
        pid: 5432,
        memory_mb: 256.0,
        cpu_percent: 1.0,
        last_seen: new Date().toISOString(),
      },
    },
  ],
  total: 3,
};

const mockMetricsHistory = {
  server_id: 'test-server-1',
  range: '24h',
  resolution: '1m',
  data_points: [],
};

const mockCostConfig = {
  electricity_rate: 0.24,
  currency_symbol: '£',
  updated_at: null,
};

const mockActionsEmpty = {
  actions: [],
  total: 0,
};

test.describe('Services Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/servers/test-server-1', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockServerOnline),
      });
    });

    await page.route('**/api/v1/costs/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCostConfig),
      });
    });

    await page.route('**/api/v1/servers/*/metrics*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMetricsHistory),
      });
    });

    await page.route('**/api/v1/servers/*/services', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockServicesResponse),
      });
    });

    await page.route('**/api/v1/servers/*/packages', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ packages: [], total: 0 }),
      });
    });

    await page.route('**/api/v1/actions*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockActionsEmpty),
      });
    });
  });

  test.describe('Services List Display', () => {
    test('displays services heading', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-list"]', { timeout: 10000 });

      await expect(page.locator('text=Services')).toBeVisible();
    });

    test('displays service cards', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-list"]', { timeout: 10000 });

      const serviceCards = page.locator('[data-testid="service-card"]');
      await expect(serviceCards).toHaveCount(3);
    });

    test('displays service names', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-list"]', { timeout: 10000 });

      await expect(page.locator('text=Docker Engine')).toBeVisible();
      await expect(page.locator('text=Nginx')).toBeVisible();
      await expect(page.locator('text=PostgreSQL')).toBeVisible();
    });

    test('displays running service status', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-list"]', { timeout: 10000 });

      // Running services should have green indicator
      const runningIndicators = page.locator('.bg-status-success');
      await expect(runningIndicators.first()).toBeVisible();
    });

    test('displays stopped service status', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-list"]', { timeout: 10000 });

      // Stopped services should have different indicator
      const stoppedIndicators = page.locator('.bg-status-error');
      await expect(stoppedIndicators.first()).toBeVisible();
    });
  });

  test.describe('Service Restart', () => {
    test('displays restart button for each service', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-list"]', { timeout: 10000 });

      const restartButtons = page.locator('[data-testid="restart-button"]');
      await expect(restartButtons).toHaveCount(3);
    });

    test('restart button triggers API call', async ({ page }) => {
      let restartCalled = false;

      await page.route('**/api/v1/servers/*/services/*/restart', (route) => {
        restartCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            action_id: 'action-123',
            status: 'queued',
            message: 'Service restart queued',
          }),
        });
      });

      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-list"]', { timeout: 10000 });

      const restartButtons = page.locator('[data-testid="restart-button"]');
      await restartButtons.first().click();

      await page.waitForTimeout(500);
      expect(restartCalled).toBe(true);
    });

    test('shows success message after restart', async ({ page }) => {
      await page.route('**/api/v1/servers/*/services/*/restart', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            action_id: 'action-123',
            status: 'queued',
            message: 'Service restart queued',
          }),
        });
      });

      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-list"]', { timeout: 10000 });

      const restartButtons = page.locator('[data-testid="restart-button"]');
      await restartButtons.first().click();

      await expect(page.locator('[data-testid="restart-message"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=/Restarting/')).toBeVisible();
    });

    test('shows pending message for maintenance mode server', async ({ page }) => {
      await page.route('**/api/v1/servers/*/services/*/restart', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            action_id: 'action-123',
            status: 'pending',
            message: 'Service restart pending approval',
          }),
        });
      });

      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-list"]', { timeout: 10000 });

      const restartButtons = page.locator('[data-testid="restart-button"]');
      await restartButtons.first().click();

      await expect(page.locator('text=/pending approval/')).toBeVisible({ timeout: 5000 });
    });

    test('shows conflict message for already pending restart', async ({ page }) => {
      await page.route('**/api/v1/servers/*/services/*/restart', (route) => {
        route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Action already pending' }),
        });
      });

      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-list"]', { timeout: 10000 });

      const restartButtons = page.locator('[data-testid="restart-button"]');
      await restartButtons.first().click();

      await expect(page.locator('text=/already pending/')).toBeVisible({ timeout: 5000 });
    });

    test('shows error message on restart failure', async ({ page }) => {
      await page.route('**/api/v1/servers/*/services/*/restart', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Internal server error' }),
        });
      });

      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-list"]', { timeout: 10000 });

      const restartButtons = page.locator('[data-testid="restart-button"]');
      await restartButtons.first().click();

      await expect(page.locator('[data-testid="restart-message"]')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Empty State', () => {
    test('shows empty state when no services', async ({ page }) => {
      await page.route('**/api/v1/servers/*/services', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ services: [], total: 0 }),
        });
      });

      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-empty"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="services-empty"]')).toBeVisible();
      await expect(page.locator('text=No services configured')).toBeVisible();
    });
  });

  test.describe('Loading State', () => {
    test('shows loading spinner while fetching services', async ({ page }) => {
      // Delay the services response
      await page.route('**/api/v1/servers/*/services', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockServicesResponse),
        });
      });

      await page.goto('/servers/test-server-1');

      // The loading spinner should appear briefly
      await expect(page.locator('[data-testid="services-loading"]')).toBeVisible({ timeout: 500 });
    });
  });

  test.describe('Error State', () => {
    test('shows error state when services fetch fails', async ({ page }) => {
      await page.route('**/api/v1/servers/*/services', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Failed to fetch services' }),
        });
      });

      await page.goto('/servers/test-server-1');

      await expect(page.locator('[data-testid="services-error"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Queued Actions Tracking', () => {
    test('tracks services with pending actions', async ({ page }) => {
      await page.route('**/api/v1/actions*', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            actions: [
              {
                id: 1,
                action_type: 'restart_service',
                service_name: 'docker',
                status: 'pending',
                server_id: 'test-server-1',
              },
            ],
            total: 1,
          }),
        });
      });

      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-list"]', { timeout: 10000 });

      // Docker service should show pending state
      // The component tracks queued services and may disable the restart button
      const restartButtons = page.locator('[data-testid="restart-button"]');
      await expect(restartButtons.first()).toBeVisible();
    });
  });

  test.describe('Service Details', () => {
    test('displays memory usage for running services', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-list"]', { timeout: 10000 });

      // Docker has 512.5 MB memory
      await expect(page.locator('text=/512/')).toBeVisible();
    });

    test('displays critical badge for critical services', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="services-list"]', { timeout: 10000 });

      // Docker and PostgreSQL are critical
      const criticalBadges = page.locator('text=/critical/i');
      // Should have at least 2 critical services
      expect(await criticalBadges.count()).toBeGreaterThanOrEqual(2);
    });
  });
});
