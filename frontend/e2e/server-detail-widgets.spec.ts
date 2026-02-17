import { test, expect } from '@playwright/test';

/**
 * Server Detail - Widget View E2E Tests
 *
 * Covers: EP0012 (Widget Detail View), EP0014 (Docker Containers)
 * Tests view mode toggle, widget grid, edit layout, and containers widget.
 */

const mockServerOnline = {
  id: 'test-server-1',
  hostname: 'web-server.local',
  display_name: 'Web Server',
  ip_address: '192.168.1.10',
  status: 'online',
  last_seen: new Date().toISOString(),
  is_paused: false,
  paused_at: null,
  is_inactive: false,
  os_distribution: 'Ubuntu',
  os_version: '22.04',
  kernel_version: '5.15.0',
  architecture: 'x86_64',
  cpu_model: 'Intel Core i7-12700',
  cpu_cores: 12,
  machine_type: 'server',
  machine_category: 'desktop',
  machine_category_source: 'auto',
  tdp_watts: 65,
  idle_watts: 25,
  has_docker: true,
  docker_status: 'running',
  agent_version: '2.1.0',
  agent_mode: 'readwrite',
  auto_update_agent: false,
  guid: 'test-guid-1',
  tailscale_hostname: null,
  latest_metrics: {
    cpu_percent: 42,
    memory_percent: 68,
    disk_percent: 55,
    uptime_seconds: 86400,
    memory_used_mb: 5500,
    memory_total_mb: 8192,
    disk_used_gb: 110,
    disk_total_gb: 200,
    network_rx_bytes: 1073741824,
    network_tx_bytes: 536870912,
    load_1m: 1.5,
    load_5m: 1.2,
    load_15m: 0.9,
  },
};

const mockServerNoDocker = {
  ...mockServerOnline,
  has_docker: false,
  docker_status: null,
};

const mockContainers = [
  {
    name: 'nginx',
    id: 'abc123',
    image: 'nginx:latest',
    state: 'running',
    status: 'Up 2 hours',
    created: '2026-02-17T08:00:00Z',
    ports: ['80/tcp', '443/tcp'],
    uptime_seconds: 7200,
  },
  {
    name: 'redis',
    id: 'def456',
    image: 'redis:7-alpine',
    state: 'exited',
    status: 'Exited (0) 3 hours ago',
    created: '2026-02-17T05:00:00Z',
    ports: [],
    uptime_seconds: null,
  },
];

const mockCostConfig = { electricity_rate: 0.24, currency_symbol: '£', updated_at: null };

// Layout item helper - adds containers to server default layout
const containerLayoutItem = { i: 'containers', x: 8, y: 10, w: 4, h: 4, minW: 2, minH: 2 };
const defaultLayoutWithContainers = [
  { i: 'server_info', x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
  { i: 'system_info', x: 6, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
  { i: 'cpu_chart', x: 0, y: 4, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'memory_gauge', x: 4, y: 4, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'load_average', x: 8, y: 4, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'disk_usage', x: 0, y: 7, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'network', x: 4, y: 7, w: 4, h: 3, minW: 2, minH: 2 },
  { i: 'services', x: 0, y: 10, w: 8, h: 4, minW: 2, minH: 2 },
  containerLayoutItem,
];

async function setupServerRoutes(
  page: import('@playwright/test').Page,
  server: unknown = mockServerOnline,
  containers: unknown[] = mockContainers,
  options: { includeContainersInLayout?: boolean } = {}
) {
  const includeContainers = options.includeContainersInLayout ?? false;
  await Promise.all([
    page.route('**/api/v1/servers/test-server-1', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(server),
      });
    }),
    page.route('**/api/v1/costs/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCostConfig),
      });
    }),
    page.route('**/api/v1/servers/*/metrics*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ server_id: 'test-server-1', range: '24h', resolution: '5m', data_points: [] }),
      });
    }),
    page.route('**/api/v1/servers/*/services', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ services: [], total: 0 }),
      });
    }),
    page.route('**/api/v1/servers/*/packages', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ packages: [], total: 0 }),
      });
    }),
    page.route('**/api/v1/actions*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ actions: [], total: 0 }),
      });
    }),
    page.route('**/api/v1/alerts*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ alerts: [], total: 0 }),
      });
    }),
    page.route('**/api/v1/agents/version', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ version: '2.1.0' }),
      });
    }),
    page.route('**/api/v1/machines/*/layout', (route) => {
      if (route.request().method() === 'GET') {
        if (includeContainers) {
          const layout = defaultLayoutWithContainers;
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              layouts: { lg: layout, md: layout, sm: layout, xs: layout.map(item => ({ ...item, w: 1, x: 0 })) },
              updated_at: '2026-02-17T08:00:00Z',
            }),
          });
        } else {
          route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
        }
      } else if (route.request().method() === 'PUT') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'saved', updated_at: '2026-02-17T12:00:00Z' }) });
      } else if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        route.fulfill({ status: 200 });
      }
    }),
    page.route('**/api/v1/servers/*/containers*', (route) => {
      if (route.request().url().includes('/start') || route.request().url().includes('/stop') || route.request().url().includes('/restart')) {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ containers, total: containers.length }),
        });
      }
    }),
    page.route('**/api/v1/config/compliance*', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ summary: { compliant: 0, non_compliant: 0, never_checked: 0 }, machines: [] }) });
    }),
  ]);
}

test.describe('Server Detail - Widget View', () => {
  test.describe('View Mode Toggle', () => {
    test('view-mode-widget and view-mode-classic visible', async ({ page }) => {
      await setupServerRoutes(page);
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="view-mode-widget"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="view-mode-widget"]')).toBeVisible();
      await expect(page.locator('[data-testid="view-mode-classic"]')).toBeVisible();
    });

    test('widget view shows widget-server-info', async ({ page }) => {
      await setupServerRoutes(page);
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="widget-server-info"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="widget-server-info"]')).toBeVisible();
    });

    test('classic view hides widget grid and shows classic cards', async ({ page }) => {
      await setupServerRoutes(page);
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="view-mode-classic"]', { timeout: 10000 });
      await page.locator('[data-testid="view-mode-classic"]').click();
      await expect(page.locator('[data-testid="server-info-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="widget-server-info"]')).not.toBeVisible();
    });
  });

  test.describe('Widget Grid', () => {
    test('displays core widgets', async ({ page }) => {
      await setupServerRoutes(page);
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="widget-server-info"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="widget-server-info"]')).toBeVisible();
      await expect(page.locator('[data-testid="widget-system-info"]')).toBeVisible();
      await expect(page.locator('[data-testid="widget-cpu-chart"]')).toBeVisible();
    });

    test('widget-containers visible when has_docker=true and in layout', async ({ page }) => {
      await setupServerRoutes(page, mockServerOnline, mockContainers, { includeContainersInLayout: true });
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="widget-containers"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="widget-containers"]')).toBeVisible();
    });

    test('widget-containers hidden when has_docker=false', async ({ page }) => {
      await setupServerRoutes(page, mockServerNoDocker, mockContainers, { includeContainersInLayout: true });
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="widget-server-info"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="widget-containers"]')).not.toBeVisible();
    });
  });

  test.describe('Edit Layout', () => {
    test('edit-layout-button shows edit-mode-banner', async ({ page }) => {
      await setupServerRoutes(page);
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="edit-layout-button"]', { timeout: 10000 });
      await page.locator('[data-testid="edit-layout-button"]').click();
      await expect(page.locator('[data-testid="edit-mode-banner"]')).toBeVisible();
    });

    test('save-layout-button calls PUT /widget-layout', async ({ page }) => {
      let saveCalled = false;
      await setupServerRoutes(page);
      await page.route('**/api/v1/machines/*/layout', (route) => {
        if (route.request().method() === 'PUT') {
          saveCalled = true;
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
        } else {
          route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
        }
      });
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="edit-layout-button"]', { timeout: 10000 });
      await page.locator('[data-testid="edit-layout-button"]').click();
      await page.waitForSelector('[data-testid="save-layout-button"]', { timeout: 5000 });
      await page.locator('[data-testid="save-layout-button"]').click();
      await page.waitForTimeout(500);
      expect(saveCalled).toBe(true);
    });

    test('cancel-edit-button dismisses banner without saving', async ({ page }) => {
      let saveCalled = false;
      await setupServerRoutes(page);
      await page.route('**/api/v1/machines/*/layout', (route) => {
        if (route.request().method() === 'PUT') {
          saveCalled = true;
        }
        route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
      });
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="edit-layout-button"]', { timeout: 10000 });
      await page.locator('[data-testid="edit-layout-button"]').click();
      await page.waitForSelector('[data-testid="cancel-edit-button"]', { timeout: 5000 });
      await page.locator('[data-testid="cancel-edit-button"]').click();
      await expect(page.locator('[data-testid="edit-mode-banner"]')).not.toBeVisible();
      expect(saveCalled).toBe(false);
    });

    test('reset-layout-button triggers unsaved-indicator', async ({ page }) => {
      await setupServerRoutes(page);
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="edit-layout-button"]', { timeout: 10000 });
      await page.locator('[data-testid="edit-layout-button"]').click();
      await page.waitForSelector('[data-testid="reset-layout-button"]', { timeout: 5000 });
      await page.locator('[data-testid="reset-layout-button"]').click();
      await expect(page.locator('[data-testid="unsaved-indicator"]')).toBeVisible();
    });
  });

  test.describe('Containers Widget', () => {
    test('containers-list shows running and stopped containers', async ({ page }) => {
      await setupServerRoutes(page, mockServerOnline, mockContainers, { includeContainersInLayout: true });
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="containers-list"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="container-nginx"]')).toBeVisible();
      await expect(page.locator('[data-testid="container-redis"]')).toBeVisible();
    });

    test('container-start-redis calls POST start', async ({ page }) => {
      let startCalled = false;
      await setupServerRoutes(page, mockServerOnline, mockContainers, { includeContainersInLayout: true });
      await page.route('**/api/v1/servers/*/containers/redis/start', (route) => {
        startCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="container-start-redis"]', { timeout: 10000 });
      await page.locator('[data-testid="container-start-redis"]').click();
      await page.waitForTimeout(500);
      expect(startCalled).toBe(true);
    });

    test('container-stop-nginx shows stop-confirm-dialog', async ({ page }) => {
      await setupServerRoutes(page, mockServerOnline, mockContainers, { includeContainersInLayout: true });
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="container-stop-nginx"]', { timeout: 10000 });
      await page.locator('[data-testid="container-stop-nginx"]').click();
      await expect(page.locator('[data-testid="stop-confirm-dialog"]')).toBeVisible();
    });

    test('stop-confirm-button calls POST stop', async ({ page }) => {
      let stopCalled = false;
      await setupServerRoutes(page, mockServerOnline, mockContainers, { includeContainersInLayout: true });
      await page.route('**/api/v1/servers/*/containers/nginx/stop*', (route) => {
        stopCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });
      await page.goto('/servers/test-server-1');
      await page.waitForSelector('[data-testid="container-stop-nginx"]', { timeout: 10000 });
      await page.locator('[data-testid="container-stop-nginx"]').click();
      await page.waitForSelector('[data-testid="stop-confirm-button"]', { timeout: 5000 });
      await page.locator('[data-testid="stop-confirm-button"]').click();
      await page.waitForTimeout(500);
      expect(stopCalled).toBe(true);
    });
  });
});
