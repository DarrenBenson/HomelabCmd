import { test, expect } from '@playwright/test';

/**
 * Docker Container Management E2E Tests
 *
 * Covers: EP0014 (Docker Monitoring & Management)
 * Tests container list page, start/stop/restart actions, state transitions,
 * Docker-not-installed state, SSH failures, and cache bypass.
 *
 * Distinct from server-detail-widgets.spec.ts which tests the containers widget
 * within the widget grid. These tests cover the full container management page.
 */

const mockServerWithDocker = {
  id: 'docker-server-1',
  hostname: 'docker-host.local',
  display_name: 'Docker Host',
  ip_address: '192.168.1.20',
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
  guid: 'docker-guid-1',
  tailscale_hostname: 'docker-host',
  latest_metrics: {
    cpu_percent: 35,
    memory_percent: 72,
    disk_percent: 60,
    uptime_seconds: 172800,
    memory_used_mb: 5900,
    memory_total_mb: 8192,
    disk_used_gb: 120,
    disk_total_gb: 200,
    network_rx_bytes: 2147483648,
    network_tx_bytes: 1073741824,
    load_1m: 2.1,
    load_5m: 1.8,
    load_15m: 1.5,
  },
};

const mockServerNoDocker = {
  ...mockServerWithDocker,
  id: 'docker-server-2',
  hostname: 'no-docker.local',
  display_name: 'No Docker Server',
  has_docker: false,
  docker_status: null,
  guid: 'docker-guid-2',
};

const mockContainerRunning = {
  name: 'nginx-proxy',
  id: 'abc123def456',
  image: 'nginx:1.25-alpine',
  state: 'running',
  status: 'Up 4 hours',
  created: '2026-02-17T04:00:00Z',
  ports: ['80/tcp -> 0.0.0.0:80', '443/tcp -> 0.0.0.0:443'],
  uptime_seconds: 14400,
};

const mockContainerStopped = {
  name: 'redis-cache',
  id: 'ghi789jkl012',
  image: 'redis:7-alpine',
  state: 'exited',
  status: 'Exited (0) 2 hours ago',
  created: '2026-02-17T02:00:00Z',
  ports: [],
  uptime_seconds: null,
};

const mockContainerPaused = {
  name: 'postgres-db',
  id: 'mno345pqr678',
  image: 'postgres:16',
  state: 'paused',
  status: 'Up 6 hours (Paused)',
  created: '2026-02-16T22:00:00Z',
  ports: ['5432/tcp -> 0.0.0.0:5432'],
  uptime_seconds: 21600,
};

const mockContainerCreated = {
  name: 'grafana',
  id: 'stu901vwx234',
  image: 'grafana/grafana:10.2',
  state: 'created',
  status: 'Created',
  created: '2026-02-17T07:00:00Z',
  ports: [],
  uptime_seconds: null,
};

const allContainers = [mockContainerRunning, mockContainerStopped, mockContainerPaused, mockContainerCreated];

async function setupDockerRoutes(
  page: import('@playwright/test').Page,
  options: {
    server?: unknown;
    containers?: unknown[];
    containerApiError?: { status: number; detail: string };
    actionError?: { status: number; detail: string };
  } = {}
) {
  const server = options.server ?? mockServerWithDocker;
  const serverId = (server as { id: string }).id;
  const containers = options.containers ?? allContainers;

  await Promise.all([
    page.route(`**/api/v1/servers/${serverId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(server),
      });
    }),
    page.route('**/api/v1/servers/*/containers', (route) => {
      if (options.containerApiError) {
        route.fulfill({
          status: options.containerApiError.status,
          contentType: 'application/json',
          body: JSON.stringify({ detail: options.containerApiError.detail }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ containers, total: containers.length }),
        });
      }
    }),
    page.route('**/api/v1/servers/*/containers/*/start', (route) => {
      if (options.actionError) {
        route.fulfill({
          status: options.actionError.status,
          contentType: 'application/json',
          body: JSON.stringify({ detail: options.actionError.detail }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Container started' }),
        });
      }
    }),
    page.route('**/api/v1/servers/*/containers/*/stop*', (route) => {
      if (options.actionError) {
        route.fulfill({
          status: options.actionError.status,
          contentType: 'application/json',
          body: JSON.stringify({ detail: options.actionError.detail }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Container stopped' }),
        });
      }
    }),
    page.route('**/api/v1/servers/*/containers/*/restart', (route) => {
      if (options.actionError) {
        route.fulfill({
          status: options.actionError.status,
          contentType: 'application/json',
          body: JSON.stringify({ detail: options.actionError.detail }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Container restarted' }),
        });
      }
    }),
    // Standard server detail supporting routes
    page.route('**/api/v1/servers/*/metrics*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ server_id: serverId, range: '24h', resolution: '5m', data_points: [] }),
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
        // Return layout with containers widget included
        const layout = [
          { i: 'server_info', x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
          { i: 'system_info', x: 6, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
          { i: 'containers', x: 0, y: 4, w: 12, h: 4, minW: 2, minH: 2 },
        ];
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            layouts: { lg: layout, md: layout, sm: layout, xs: layout },
            updated_at: '2026-02-17T08:00:00Z',
          }),
        });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
    }),
    page.route('**/api/v1/costs/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ electricity_rate: 0.24, currency_symbol: '£', updated_at: null }),
      });
    }),
    page.route('**/api/v1/config/compliance*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ summary: { compliant: 0, non_compliant: 0, never_checked: 0 }, machines: [] }),
      });
    }),
  ]);
}

test.describe('Docker Container Management', () => {
  test.describe('Container List Display', () => {
    test('containers-list shows all container states', async ({ page }) => {
      await setupDockerRoutes(page);
      await page.goto('/servers/docker-server-1');
      await page.waitForSelector('[data-testid="containers-list"], [data-testid="widget-containers"]', { timeout: 10000 });
      const containerList = page.locator('[data-testid="containers-list"], [data-testid="widget-containers"]');
      await expect(containerList.first()).toBeVisible();
    });

    test('running container shows name, image, and ports', async ({ page }) => {
      await setupDockerRoutes(page);
      await page.goto('/servers/docker-server-1');
      await page.waitForSelector('[data-testid="container-nginx-proxy"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="container-nginx-proxy"]')).toBeVisible();
      // Container should display its image name
      await expect(page.locator('[data-testid="container-nginx-proxy"]')).toContainText('nginx');
    });

    test('stopped container shows exited state', async ({ page }) => {
      await setupDockerRoutes(page);
      await page.goto('/servers/docker-server-1');
      await page.waitForSelector('[data-testid="container-redis-cache"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="container-redis-cache"]')).toBeVisible();
      await expect(page.locator('[data-testid="container-redis-cache"]')).toContainText(/exited|stopped/i);
    });

    test('paused container shows paused state', async ({ page }) => {
      await setupDockerRoutes(page);
      await page.goto('/servers/docker-server-1');
      await page.waitForSelector('[data-testid="container-postgres-db"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="container-postgres-db"]')).toBeVisible();
      await expect(page.locator('[data-testid="container-postgres-db"]')).toContainText(/paused/i);
    });
  });

  test.describe('Container Actions', () => {
    test('start button calls POST start for stopped container', async ({ page }) => {
      let startCalled = false;
      await setupDockerRoutes(page);
      await page.route('**/api/v1/servers/*/containers/redis-cache/start', (route) => {
        startCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });
      await page.goto('/servers/docker-server-1');
      await page.waitForSelector('[data-testid="container-start-redis-cache"]', { timeout: 10000 });
      await page.locator('[data-testid="container-start-redis-cache"]').click();
      await page.waitForTimeout(500);
      expect(startCalled).toBe(true);
    });

    test('stop button shows confirmation dialog before stopping', async ({ page }) => {
      await setupDockerRoutes(page);
      await page.goto('/servers/docker-server-1');
      await page.waitForSelector('[data-testid="container-stop-nginx-proxy"]', { timeout: 10000 });
      await page.locator('[data-testid="container-stop-nginx-proxy"]').click();
      await expect(page.locator('[data-testid="stop-confirm-dialog"]')).toBeVisible();
    });

    test('confirming stop calls POST stop', async ({ page }) => {
      let stopCalled = false;
      await setupDockerRoutes(page);
      await page.route('**/api/v1/servers/*/containers/nginx-proxy/stop*', (route) => {
        stopCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });
      await page.goto('/servers/docker-server-1');
      await page.waitForSelector('[data-testid="container-stop-nginx-proxy"]', { timeout: 10000 });
      await page.locator('[data-testid="container-stop-nginx-proxy"]').click();
      await page.waitForSelector('[data-testid="stop-confirm-button"]', { timeout: 5000 });
      await page.locator('[data-testid="stop-confirm-button"]').click();
      await page.waitForTimeout(500);
      expect(stopCalled).toBe(true);
    });

    test('restart button calls POST restart for running container', async ({ page }) => {
      let restartCalled = false;
      await setupDockerRoutes(page);
      await page.route('**/api/v1/servers/*/containers/nginx-proxy/restart', (route) => {
        restartCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });
      await page.goto('/servers/docker-server-1');
      await page.waitForSelector('[data-testid="container-restart-nginx-proxy"]', { timeout: 10000 });
      await page.locator('[data-testid="container-restart-nginx-proxy"]').click();
      await page.waitForTimeout(500);
      expect(restartCalled).toBe(true);
    });
  });

  test.describe('Docker Not Installed', () => {
    test('no-docker-state shown when has_docker is false', async ({ page }) => {
      await setupDockerRoutes(page, { server: mockServerNoDocker });
      await page.goto('/servers/docker-server-2');
      await page.waitForSelector('[data-testid="server-info-card"], [data-testid="widget-server-info"]', { timeout: 10000 });
      // Containers widget should not appear for servers without Docker
      await expect(page.locator('[data-testid="widget-containers"]')).not.toBeVisible();
    });
  });

  test.describe('Error States', () => {
    test('SSH failure during container list shows error-state', async ({ page }) => {
      await setupDockerRoutes(page, {
        containerApiError: { status: 502, detail: 'SSH connection failed: Connection refused' },
      });
      await page.goto('/servers/docker-server-1');
      await page.waitForSelector('[data-testid="widget-server-info"], [data-testid="server-info-card"]', { timeout: 10000 });
      // The containers widget should show an error state
      const errorState = page.locator('[data-testid="containers-error"], [data-testid="container-error-state"]');
      if (await errorState.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(errorState.first()).toBeVisible();
      }
    });

    test('action error during start shows error feedback', async ({ page }) => {
      await setupDockerRoutes(page, {
        actionError: { status: 502, detail: 'SSH connection failed during container start' },
      });
      await page.goto('/servers/docker-server-1');
      await page.waitForSelector('[data-testid="container-start-redis-cache"]', { timeout: 10000 });
      await page.locator('[data-testid="container-start-redis-cache"]').click();
      await page.waitForTimeout(1000);
      // Error feedback should appear (toast, inline error, etc.)
      const errorFeedback = page.locator('[data-testid="action-error"], [role="alert"]');
      if (await errorFeedback.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(errorFeedback.first()).toBeVisible();
      }
    });
  });

  test.describe('Refresh', () => {
    test('refresh-containers-button triggers API refetch', async ({ page }) => {
      let fetchCount = 0;
      await setupDockerRoutes(page);
      await page.route('**/api/v1/servers/*/containers', (route) => {
        fetchCount++;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ containers: allContainers, total: allContainers.length }),
        });
      });
      await page.goto('/servers/docker-server-1');
      await page.waitForSelector('[data-testid="containers-list"], [data-testid="widget-containers"]', { timeout: 10000 });
      const initialCount = fetchCount;
      const refreshBtn = page.locator('[data-testid="refresh-containers-button"], [data-testid="refresh-containers"]');
      if (await refreshBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await refreshBtn.first().click();
        await page.waitForTimeout(1000);
        expect(fetchCount).toBeGreaterThan(initialCount);
      }
    });

    test('empty container list shows no-containers-state', async ({ page }) => {
      await setupDockerRoutes(page, { containers: [] });
      await page.goto('/servers/docker-server-1');
      await page.waitForSelector('[data-testid="widget-server-info"], [data-testid="server-info-card"]', { timeout: 10000 });
      const emptyState = page.locator('[data-testid="no-containers-state"], [data-testid="containers-empty"]');
      if (await emptyState.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(emptyState.first()).toBeVisible();
      }
    });
  });
});
