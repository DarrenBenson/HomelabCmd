import { test, expect } from '@playwright/test';

/**
 * Actions Page E2E Tests
 *
 * Covers: EP0013 (Synchronous Command Execution)
 * Tests actions table, filters, detail panel, streaming output, and cancel flow.
 */

const mockServers = [
  { id: 'server-1', hostname: 'web-server.local', display_name: 'Web Server', status: 'online' },
  { id: 'server-2', hostname: 'db-server.local', display_name: 'DB Server', status: 'online' },
];

const mockActionCompleted = {
  id: 1,
  server_id: 'server-1',
  action_type: 'restart_service',
  status: 'completed',
  service_name: 'nginx',
  command: 'systemctl restart nginx',
  alert_id: null,
  created_at: '2026-02-17T08:00:00Z',
  created_by: 'admin',
  approved_at: '2026-02-17T08:00:05Z',
  approved_by: 'admin',
  rejected_at: null,
  rejected_by: null,
  rejection_reason: null,
  executed_at: '2026-02-17T08:00:06Z',
  completed_at: '2026-02-17T08:00:08Z',
  exit_code: 0,
  stdout: 'Service restarted successfully',
  stderr: null,
  timeout_seconds: 60,
  timed_out_at: null,
};

const mockActionFailed = {
  ...mockActionCompleted,
  id: 2,
  server_id: 'server-2',
  status: 'failed',
  exit_code: 1,
  stdout: '',
  stderr: 'Failed to restart nginx: unit not found',
  completed_at: '2026-02-17T09:00:08Z',
  created_at: '2026-02-17T09:00:00Z',
};

const mockActionPending = {
  ...mockActionCompleted,
  id: 3,
  status: 'pending',
  approved_at: null,
  approved_by: null,
  executed_at: null,
  completed_at: null,
  exit_code: null,
  stdout: null,
  stderr: null,
  created_at: '2026-02-17T10:00:00Z',
};

const mockActionExecuting = {
  ...mockActionCompleted,
  id: 4,
  status: 'executing',
  executed_at: '2026-02-17T10:30:00Z',
  completed_at: null,
  exit_code: null,
  stdout: null,
  stderr: null,
  created_at: '2026-02-17T10:29:55Z',
};

const allActions = [mockActionCompleted, mockActionFailed, mockActionPending, mockActionExecuting];

async function setupActionRoutes(
  page: import('@playwright/test').Page,
  options: {
    actions?: unknown[];
    failApi?: boolean;
  } = {}
) {
  const actions = options.actions ?? allActions;

  await Promise.all([
    page.route('**/api/v1/actions*', (route) => {
      if (route.request().url().includes('/cancel')) {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        if (options.failApi) {
          route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ detail: 'Internal server error' }) });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ actions, total: actions.length, limit: 20, offset: 0 }),
          });
        }
      }
    }),
    page.route('**/api/v1/servers', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ servers: mockServers, total: mockServers.length }),
      });
    }),
  ]);
}

test.describe('Actions Page', () => {
  test.describe('Table and Filters', () => {
    test('displays actions-table with action rows', async ({ page }) => {
      await setupActionRoutes(page);
      await page.goto('/actions');
      await page.waitForSelector('[data-testid="actions-table"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="actions-table"]')).toBeVisible();
      await expect(page.locator('[data-testid="action-row-1"]')).toBeVisible();
      await expect(page.locator('[data-testid="action-row-2"]')).toBeVisible();
    });

    test('status-filter filters rows by status', async ({ page }) => {
      let lastUrl = '';
      await page.route('**/api/v1/actions*', (route) => {
        lastUrl = route.request().url();
        if (route.request().url().includes('/cancel')) {
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ actions: [mockActionCompleted], total: 1, limit: 20, offset: 0 }),
          });
        }
      });
      await page.route('**/api/v1/servers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ servers: mockServers, total: mockServers.length }),
        });
      });
      await page.goto('/actions');
      await page.waitForSelector('[data-testid="status-filter"]', { timeout: 10000 });
      await page.locator('[data-testid="status-filter"]').selectOption('completed');
      await page.waitForTimeout(500);
      expect(lastUrl).toContain('status=completed');
    });

    test('server-filter filters by server', async ({ page }) => {
      let lastUrl = '';
      await page.route('**/api/v1/actions*', (route) => {
        lastUrl = route.request().url();
        if (route.request().url().includes('/cancel')) {
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ actions: [mockActionCompleted], total: 1, limit: 20, offset: 0 }),
          });
        }
      });
      await page.route('**/api/v1/servers', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ servers: mockServers, total: mockServers.length }),
        });
      });
      await page.goto('/actions');
      await page.waitForSelector('[data-testid="server-filter"]', { timeout: 10000 });
      await page.locator('[data-testid="server-filter"]').selectOption('server-1');
      await page.waitForTimeout(500);
      expect(lastUrl).toContain('server_id=server-1');
    });

    test('clear-filters resets view', async ({ page }) => {
      await setupActionRoutes(page);
      await page.goto('/actions?status=completed');
      await page.waitForSelector('[data-testid="clear-filters"]', { timeout: 10000 });
      await page.locator('[data-testid="clear-filters"]').click();
      await expect(page).toHaveURL(/\/actions$/);
    });

    test('empty-state shown when no actions match', async ({ page }) => {
      await setupActionRoutes(page, { actions: [] });
      await page.goto('/actions');
      await page.waitForSelector('[data-testid="empty-state"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
    });

    test('error-state shown when API fails', async ({ page }) => {
      await setupActionRoutes(page, { failApi: true });
      await page.goto('/actions');
      await page.waitForSelector('[data-testid="error-state"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="error-state"]')).toBeVisible();
    });
  });

  test.describe('Action Detail Panel', () => {
    test('clicking action-row opens detail panel', async ({ page }) => {
      await setupActionRoutes(page);
      await page.goto('/actions');
      await page.waitForSelector('[data-testid="action-row-1"]', { timeout: 10000 });
      await page.locator('[data-testid="action-row-1"]').click();
      await expect(page.locator('[data-testid="action-detail-panel"]')).toBeVisible();
    });

    test('completed action shows stdout output', async ({ page }) => {
      await setupActionRoutes(page);
      await page.goto('/actions');
      await page.waitForSelector('[data-testid="action-row-1"]', { timeout: 10000 });
      await page.locator('[data-testid="action-row-1"]').click();
      await expect(page.locator('[data-testid="action-stdout"]')).toBeVisible();
      await expect(page.locator('[data-testid="action-stdout"]')).toContainText('Service restarted successfully');
    });

    test('completed action shows exit code', async ({ page }) => {
      await setupActionRoutes(page);
      await page.goto('/actions');
      await page.waitForSelector('[data-testid="action-row-1"]', { timeout: 10000 });
      await page.locator('[data-testid="action-row-1"]').click();
      await expect(page.locator('[data-testid="exit-code"]')).toBeVisible();
      await expect(page.locator('[data-testid="exit-code"]')).toContainText('0');
    });

    test('failed action shows stderr output', async ({ page }) => {
      await setupActionRoutes(page);
      await page.goto('/actions');
      await page.waitForSelector('[data-testid="action-row-2"]', { timeout: 10000 });
      await page.locator('[data-testid="action-row-2"]').click();
      await expect(page.locator('[data-testid="action-stderr"]')).toBeVisible();
      await expect(page.locator('[data-testid="action-stderr"]')).toContainText('unit not found');
    });

    test('cancel button calls POST cancel for pending action', async ({ page }) => {
      let cancelCalled = false;
      await setupActionRoutes(page, { actions: [mockActionPending] });
      await page.route('**/api/v1/actions/3/cancel', (route) => {
        cancelCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });
      await page.goto('/actions');
      await page.waitForSelector('[data-testid="action-row-3"]', { timeout: 10000 });
      await page.locator('[data-testid="action-row-3"]').click();
      await page.waitForSelector('[data-testid="cancel-action-button"]', { timeout: 5000 });
      await page.locator('[data-testid="cancel-action-button"]').click();
      await page.waitForTimeout(500);
      expect(cancelCalled).toBe(true);
    });

    test('close-panel-button dismisses detail panel', async ({ page }) => {
      await setupActionRoutes(page);
      await page.goto('/actions');
      await page.waitForSelector('[data-testid="action-row-1"]', { timeout: 10000 });
      await page.locator('[data-testid="action-row-1"]').click();
      await expect(page.locator('[data-testid="action-detail-panel"]')).toBeVisible();
      await page.locator('[data-testid="close-panel-button"]').click();
      await expect(page.locator('[data-testid="action-detail-panel"]')).not.toBeVisible();
    });
  });
});
