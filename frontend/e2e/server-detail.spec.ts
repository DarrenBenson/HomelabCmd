import { test, expect } from '@playwright/test';

/**
 * Server Detail E2E Tests
 *
 * Tests for the server detail page functionality including:
 * - Server information display
 * - Metrics and gauges
 * - Maintenance mode toggle
 * - Historical charts
 * - Services panel
 * - Power configuration
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
    uptime_seconds: 86400 * 5 + 3600 * 2,
    memory_used_mb: 8192,
    memory_total_mb: 16384,
    disk_used_gb: 250,
    disk_total_gb: 500,
    network_rx_bytes: 1024 * 1024 * 100,
    network_tx_bytes: 1024 * 1024 * 50,
    load_1m: 1.5,
    load_5m: 1.2,
    load_15m: 0.9,
  },
};

const mockServerOffline = {
  ...mockServerOnline,
  id: 'offline-server',
  hostname: 'offline-server.local',
  display_name: 'Offline Server',
  status: 'offline',
  last_seen: new Date(Date.now() - 3600000).toISOString(),
  latest_metrics: null,
};

const mockMetricsHistory = {
  server_id: 'test-server-1',
  range: '24h',
  resolution: '1m',
  data_points: Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(Date.now() - (24 - i) * 3600000).toISOString(),
    cpu_percent: 40 + Math.random() * 20,
    memory_percent: 60 + Math.random() * 15,
    disk_percent: 35,
  })),
};

const mockCostConfig = {
  electricity_rate: 0.24,
  currency_symbol: '£',
  updated_at: null,
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
  ],
  total: 2,
};

test.describe('Server Detail Page', () => {
  test.describe('Navigation', () => {
    test('navigates to server detail from dashboard', async ({ page }) => {
      // Mock servers list
      await page.route('**/api/v1/servers', (route) => {
        if (route.request().url().includes('/test-server-1')) {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockServerOnline),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              servers: [mockServerOnline],
              total: 1,
            }),
          });
        }
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
          body: JSON.stringify({ actions: [], total: 0 }),
        });
      });

      await page.goto('/');
      await page.waitForSelector('[data-testid="server-card"]', { timeout: 10000 });

      // Click on the server card
      await page.click('[data-testid="server-card"]');

      // Should navigate to server detail
      await expect(page).toHaveURL(/\/servers\/test-server-1/);
    });

    test('back button returns to dashboard', async ({ page }) => {
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
          body: JSON.stringify({ actions: [], total: 0 }),
        });
      });

      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="back-button"]', { timeout: 10000 });

      await page.click('[data-testid="back-button"]');

      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Server Information Display', () => {
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
          body: JSON.stringify({ actions: [], total: 0 }),
        });
      });
    });

    test('displays server name in header', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="server-info-card"]', { timeout: 10000 });

      const header = page.locator('h1');
      await expect(header).toContainText('Test Server');
    });

    test('displays hostname', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="hostname"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="hostname"]')).toContainText('test-server.local');
    });

    test('displays IP address', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="ip-address"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="ip-address"]')).toContainText('192.168.1.100');
    });

    test('displays OS information', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="os-info"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="os-info"]')).toContainText('Ubuntu');
      await expect(page.locator('[data-testid="os-info"]')).toContainText('22.04');
    });

    test('displays kernel version', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="kernel-version"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="kernel-version"]')).toContainText('5.15.0-generic');
    });

    test('displays CPU model', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="cpu-model"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="cpu-model"]')).toContainText('Intel Core i7-12700K');
    });

    test('displays uptime', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="uptime"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="uptime"]')).toContainText(/5d 2h/);
    });
  });

  test.describe('Resource Utilisation Gauges', () => {
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
          body: JSON.stringify({ actions: [], total: 0 }),
        });
      });
    });

    test('displays resource utilisation card', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="resource-utilisation-card"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="resource-utilisation-card"]')).toBeVisible();
    });

    test('displays CPU percentage', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="resource-utilisation-card"]', { timeout: 10000 });

      // CPU should show around 46% (45.5 rounded)
      await expect(page.locator('text=/46%/')).toBeVisible();
    });

    test('displays memory percentage', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="resource-utilisation-card"]', { timeout: 10000 });

      // Memory should show around 67%
      await expect(page.locator('text=/67%/')).toBeVisible();
    });

    test('displays disk percentage', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="resource-utilisation-card"]', { timeout: 10000 });

      // Disk should show 35%
      await expect(page.locator('text=/35%/')).toBeVisible();
    });
  });

  test.describe('Network I/O', () => {
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
          body: JSON.stringify({ actions: [], total: 0 }),
        });
      });
    });

    test('displays network I/O card', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="network-io-card"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="network-io-card"]')).toBeVisible();
    });

    test('displays network RX bytes', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="network-rx"]', { timeout: 10000 });

      // 100 MB should be displayed
      await expect(page.locator('[data-testid="network-rx"]')).toContainText('100');
    });
  });

  test.describe('Load Average', () => {
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
          body: JSON.stringify({ actions: [], total: 0 }),
        });
      });
    });

    test('displays load average card', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="load-average-card"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="load-average-card"]')).toBeVisible();
    });

    test('displays 1 minute load average', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="load-1m"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="load-1m"]')).toContainText('1.50');
    });

    test('displays 5 minute load average', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="load-5m"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="load-5m"]')).toContainText('1.20');
    });

    test('displays 15 minute load average', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="load-15m"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="load-15m"]')).toContainText('0.90');
    });
  });

  test.describe('Offline Server', () => {
    test('displays offline warning', async ({ page }) => {
      await page.route('**/api/v1/servers/offline-server', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockServerOffline),
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
          body: JSON.stringify({ ...mockMetricsHistory, data_points: [] }),
        });
      });

      await page.route('**/api/v1/servers/*/services', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ services: [], total: 0 }),
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
          body: JSON.stringify({ actions: [], total: 0 }),
        });
      });

      await page.goto('/servers/offline-server');
      await page.waitForSelector('[data-testid="offline-warning"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="offline-warning"]')).toBeVisible();
      await expect(page.locator('[data-testid="offline-warning"]')).toContainText('Server is offline');
    });
  });

  test.describe('Server Not Found', () => {
    test('displays not found message for invalid server', async ({ page }) => {
      await page.route('**/api/v1/servers/invalid-server', (route) => {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Server not found' }),
        });
      });

      await page.route('**/api/v1/costs/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCostConfig),
        });
      });

      await page.goto('/servers/invalid-server');
      await page.waitForSelector('[data-testid="not-found-message"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="not-found-message"]')).toContainText('Server not found');
    });

    test('back button works on not found page', async ({ page }) => {
      await page.route('**/api/v1/servers/invalid-server', (route) => {
        route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Server not found' }),
        });
      });

      await page.route('**/api/v1/costs/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCostConfig),
        });
      });

      await page.goto('/servers/invalid-server');
      await page.waitForSelector('[data-testid="back-button"]', { timeout: 10000 });

      await page.click('[data-testid="back-button"]');

      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Maintenance Mode', () => {
    test.beforeEach(async ({ page }) => {
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
          body: JSON.stringify({ actions: [], total: 0 }),
        });
      });
    });

    test('displays maintenance mode toggle', async ({ page }) => {
      await page.route('**/api/v1/servers/test-server-1', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockServerOnline),
        });
      });

      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="maintenance-toggle"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="maintenance-toggle"]')).toBeVisible();
      await expect(page.locator('[data-testid="maintenance-status"]')).toContainText('Disabled');
    });

    test('can enable maintenance mode', async ({ page }) => {
      let isPaused = false;

      await page.route('**/api/v1/servers/test-server-1', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...mockServerOnline,
            is_paused: isPaused,
          }),
        });
      });

      await page.route('**/api/v1/servers/test-server-1/pause', (route) => {
        isPaused = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...mockServerOnline,
            is_paused: true,
            paused_at: new Date().toISOString(),
          }),
        });
      });

      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="maintenance-toggle"]', { timeout: 10000 });

      await page.click('[data-testid="maintenance-toggle"]');

      await expect(page.locator('[data-testid="maintenance-status"]')).toContainText('Enabled');
    });
  });

  test.describe('Historical Metrics', () => {
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
          body: JSON.stringify({ actions: [], total: 0 }),
        });
      });
    });

    test('displays historical metrics card', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="historical-metrics-card"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="historical-metrics-card"]')).toBeVisible();
    });

    test('displays time range selector', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="historical-metrics-card"]', { timeout: 10000 });

      // Look for time range buttons
      await expect(page.locator('text=/24h/')).toBeVisible();
    });

    test('displays chart legend', async ({ page }) => {
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="historical-metrics-card"]', { timeout: 10000 });

      // Should show legend items
      await expect(page.locator('text=CPU')).toBeVisible();
      await expect(page.locator('text=Memory')).toBeVisible();
      await expect(page.locator('text=Disk')).toBeVisible();
    });
  });

  test.describe('Refresh Functionality', () => {
    test('refresh button is visible', async ({ page }) => {
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
          body: JSON.stringify({ actions: [], total: 0 }),
        });
      });

      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="refresh-button"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="refresh-button"]')).toBeVisible();
    });
  });
});
