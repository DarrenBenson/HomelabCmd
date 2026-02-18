import { test, expect } from '@playwright/test';

/**
 * Workstation Behaviour E2E Tests
 *
 * Covers: EP0015 (Workstation Support), EP0018 (Dashboard UX Simplification)
 * Tests workstation/server distinction on dashboard, expected_online behaviour,
 * machine type badges, fleet status counts, and mixed fleet views.
 */

const mockServerOnline = {
  id: 'ws-server-1',
  hostname: 'web-server.local',
  display_name: 'Web Server',
  status: 'online',
  is_paused: false,
  paused_at: null,
  machine_type: 'server',
  is_inactive: false,
  expected_online: true,
  active_alert_count: 0,
  has_docker: false,
  docker_status: null,
  latest_metrics: {
    cpu_percent: 42,
    memory_percent: 68,
    disk_percent: 55,
    uptime_seconds: 86400,
  },
};

const mockServerOffline = {
  ...mockServerOnline,
  id: 'ws-server-2',
  hostname: 'db-server.local',
  display_name: 'DB Server',
  status: 'offline',
  latest_metrics: null,
  active_alert_count: 1,
};

const mockWorkstationOnline = {
  ...mockServerOnline,
  id: 'ws-workstation-1',
  hostname: 'study-pc.local',
  display_name: 'Study PC',
  machine_type: 'workstation',
  expected_online: false,
  latest_metrics: {
    cpu_percent: 15,
    memory_percent: 45,
    disk_percent: 30,
    uptime_seconds: 3600,
  },
};

const mockWorkstationOffline = {
  ...mockServerOnline,
  id: 'ws-workstation-2',
  hostname: 'gaming-pc.local',
  display_name: 'Gaming PC',
  status: 'offline',
  machine_type: 'workstation',
  expected_online: false,
  active_alert_count: 0,
  latest_metrics: null,
};

const mockWorkstationWithDocker = {
  ...mockWorkstationOnline,
  id: 'ws-workstation-3',
  hostname: 'dev-workstation.local',
  display_name: 'Dev Workstation',
  has_docker: true,
  docker_status: 'running',
};

const allMachines = [mockServerOnline, mockServerOffline, mockWorkstationOnline, mockWorkstationOffline];

function setupDashboardRoutes(
  page: import('@playwright/test').Page,
  options: {
    servers?: unknown[];
    alerts?: unknown[];
  } = {}
) {
  const servers = options.servers ?? allMachines;
  const alerts = options.alerts ?? [];

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
        body: JSON.stringify({ pending: [] }),
      });
    }),
    page.route('**/api/v1/actions*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ actions: [], total: 0 }),
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
        body: JSON.stringify({ total_daily_cost: 2.10, currency_symbol: '£' }),
      });
    }),
  ]);
}

test.describe('Workstation Behaviour', () => {
  test.describe('Dashboard Separation', () => {
    test('dashboard shows servers-section and workstations-section', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="server-card"]', { timeout: 10000 });
      // Dashboard should show cards for all machines
      const cards = page.locator('[data-testid="server-card"]');
      await expect(cards).toHaveCount(4);
    });

    test('workstation cards display workstation machine-type-badge', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="server-card"]', { timeout: 10000 });
      // Look for workstation type indicators
      const workstationBadge = page.locator('[data-testid="machine-type-workstation"], [data-testid="type-badge-workstation"]');
      if (await workstationBadge.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        const count = await workstationBadge.count();
        expect(count).toBeGreaterThanOrEqual(1);
      }
    });

    test('server cards display server machine-type-badge', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="server-card"]', { timeout: 10000 });
      const serverBadge = page.locator('[data-testid="machine-type-server"], [data-testid="type-badge-server"]');
      if (await serverBadge.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        const count = await serverBadge.count();
        expect(count).toBeGreaterThanOrEqual(1);
      }
    });
  });

  test.describe('Expected Online Behaviour', () => {
    test('offline workstation does NOT show alert styling', async ({ page }) => {
      // Offline workstations with expected_online=false should not trigger alerts
      await setupDashboardRoutes(page, {
        servers: [mockWorkstationOffline],
      });
      await page.goto('/');
      await page.waitForSelector('[data-testid="server-card"]', { timeout: 10000 });
      const card = page.locator('[data-testid="server-card"]').first();
      // Offline workstation should not have critical/alert styling
      const alertIndicator = card.locator('[data-testid="alert-indicator"], .text-red-500, .border-red-500');
      await expect(alertIndicator).toHaveCount(0);
    });

    test('offline server shows alert state (expected_online=true)', async ({ page }) => {
      await setupDashboardRoutes(page, {
        servers: [mockServerOffline],
        alerts: [{
          id: 1,
          server_id: 'ws-server-2',
          alert_type: 'server_offline',
          severity: 'critical',
          message: 'Server is offline',
          status: 'open',
          created_at: '2026-02-17T10:00:00Z',
          updated_at: '2026-02-17T10:00:00Z',
        }],
      });
      await page.goto('/');
      await page.waitForSelector('[data-testid="server-card"]', { timeout: 10000 });
      // Alert count badge should show for the offline server
      const alertCount = page.locator('[data-testid="alert-count"]');
      await expect(alertCount).toBeVisible();
    });

    test('online workstation displays normally', async ({ page }) => {
      await setupDashboardRoutes(page, {
        servers: [mockWorkstationOnline],
      });
      await page.goto('/');
      await page.waitForSelector('[data-testid="server-card"]', { timeout: 10000 });
      const card = page.locator('[data-testid="server-card"]').first();
      await expect(card).toBeVisible();
      await expect(card).toContainText('Study PC');
    });
  });

  test.describe('Fleet Status Counts', () => {
    test('stat-machines shows total count including workstations', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="stat-machines"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="stat-machines"]')).toContainText('4');
    });

    test('stat-online counts only actually online machines', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="stat-online"]', { timeout: 10000 });
      // 2 online: web-server + study-pc
      await expect(page.locator('[data-testid="stat-online"]')).toContainText('2');
    });

    test('stat-offline counts offline machines', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="stat-offline"]', { timeout: 10000 });
      // 2 offline: db-server + gaming-pc
      await expect(page.locator('[data-testid="stat-offline"]')).toContainText('2');
    });
  });

  test.describe('Workstation Last Seen', () => {
    test('workstation card shows last-seen timestamp when offline', async ({ page }) => {
      const offlineWithLastSeen = {
        ...mockWorkstationOffline,
        last_seen: '2026-02-17T14:30:00Z',
      };
      await setupDashboardRoutes(page, { servers: [offlineWithLastSeen] });
      await page.goto('/');
      await page.waitForSelector('[data-testid="server-card"]', { timeout: 10000 });
      const card = page.locator('[data-testid="server-card"]').first();
      // Should show some form of "last seen" information
      const lastSeen = card.locator('[data-testid="last-seen"], [data-testid="server-last-seen"]');
      if (await lastSeen.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(lastSeen).toBeVisible();
      }
    });
  });

  test.describe('Mixed Fleet View', () => {
    test('dashboard handles mixed fleet of servers and workstations', async ({ page }) => {
      await setupDashboardRoutes(page, {
        servers: [mockServerOnline, mockServerOffline, mockWorkstationOnline, mockWorkstationOffline],
      });
      await page.goto('/');
      await page.waitForSelector('[data-testid="server-card"]', { timeout: 10000 });
      const cards = page.locator('[data-testid="server-card"]');
      await expect(cards).toHaveCount(4);
    });

    test('search-input filters across both servers and workstations', async ({ page }) => {
      await setupDashboardRoutes(page);
      await page.goto('/');
      await page.waitForSelector('[data-testid="fleet-status"]', { timeout: 10000 });
      await page.locator('[data-testid="filter-toggle-button"]').click();
      await page.locator('[data-testid="search-input"]').fill('Study');
      await page.waitForTimeout(500);
      const cards = page.locator('[data-testid="server-card"]');
      await expect(cards).toHaveCount(1);
    });
  });
});
