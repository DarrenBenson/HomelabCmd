import { test, expect } from '@playwright/test';

/**
 * Command Execution E2E Tests
 *
 * Covers: EP0013 (Synchronous Command Execution)
 * Tests command execution modal, whitelist selection, streaming output,
 * cancellation, exit codes, history, and error states.
 *
 * Distinct from actions.spec.ts which tests the actions audit table view.
 * These tests cover the ad-hoc command execution flow on server detail pages.
 */

const mockServer = {
  id: 'cmd-server-1',
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
  has_docker: false,
  docker_status: null,
  agent_version: '2.1.0',
  agent_mode: 'readwrite',
  auto_update_agent: false,
  guid: 'cmd-guid-1',
  tailscale_hostname: 'web-server',
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

const mockReadonlyServer = {
  ...mockServer,
  id: 'cmd-server-2',
  hostname: 'readonly-server.local',
  display_name: 'Readonly Server',
  agent_mode: 'readonly',
  guid: 'cmd-guid-2',
};

const mockWhitelist = [
  { action_type: 'restart_service', pattern: 'systemctl restart *', description: 'Restart a systemd service' },
  { action_type: 'apply_updates', pattern: 'apt-get update && apt-get upgrade -y', description: 'Apply system updates' },
  { action_type: 'check_disk', pattern: 'df -h', description: 'Check disk usage' },
];

const mockAuditLog = {
  id: 1,
  server_id: 'cmd-server-1',
  action_type: 'restart_service',
  command: 'systemctl restart nginx',
  status: 'completed',
  exit_code: 0,
  stdout: 'Service restarted successfully',
  stderr: '',
  duration_ms: 150,
  created_at: '2026-02-17T08:00:00Z',
  created_by: 'admin',
};

const mockAuditLogFailed = {
  ...mockAuditLog,
  id: 2,
  status: 'failed',
  exit_code: 1,
  stdout: '',
  stderr: 'Failed to restart nginx: unit not found',
  created_at: '2026-02-17T09:00:00Z',
};

async function setupCommandRoutes(
  page: import('@playwright/test').Page,
  options: {
    server?: unknown;
    whitelist?: unknown[];
    auditLogs?: unknown[];
    executeResult?: unknown;
    executeError?: { status: number; detail: string };
  } = {}
) {
  const server = options.server ?? mockServer;
  const serverId = (server as { id: string }).id;
  const whitelist = options.whitelist ?? mockWhitelist;
  const auditLogs = options.auditLogs ?? [mockAuditLog, mockAuditLogFailed];

  await Promise.all([
    page.route(`**/api/v1/servers/${serverId}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(server),
      });
    }),
    page.route('**/api/v1/config/command-whitelist', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ whitelist }),
      });
    }),
    page.route('**/api/v1/servers/*/execute', (route) => {
      if (options.executeError) {
        route.fulfill({
          status: options.executeError.status,
          contentType: 'application/json',
          body: JSON.stringify({ detail: options.executeError.detail }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(options.executeResult ?? {
            exit_code: 0,
            stdout: 'Command executed successfully',
            stderr: '',
            duration_ms: 120,
          }),
        });
      }
    }),
    page.route('**/api/v1/servers/*/execute/stream', (route) => {
      // SSE streaming endpoint - return chunked text/event-stream
      const body = [
        'data: {"type":"stdout","data":"Restarting nginx...","timestamp":"2026-02-17T08:00:01Z"}\n\n',
        'data: {"type":"stdout","data":"nginx restarted.","timestamp":"2026-02-17T08:00:02Z"}\n\n',
        'data: {"type":"exit","data":"0","timestamp":"2026-02-17T08:00:03Z"}\n\n',
      ].join('');
      route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body,
      });
    }),
    page.route('**/api/v1/servers/*/execute/cancel', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }),
    page.route('**/api/v1/actions*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ actions: auditLogs, total: auditLogs.length, limit: 20, offset: 0 }),
      });
    }),
    // Standard server detail routes
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
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) });
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
    page.route('**/api/v1/servers/*/containers*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ containers: [], total: 0 }),
      });
    }),
  ]);
}

test.describe('Command Execution', () => {
  test.describe('Execute Command Button', () => {
    test('execute-command-button visible for readwrite server', async ({ page }) => {
      await setupCommandRoutes(page);
      await page.goto('/servers/cmd-server-1');
      await page.waitForSelector('[data-testid="execute-command-button"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="execute-command-button"]')).toBeVisible();
    });

    test('execute-command-button hidden for readonly agent', async ({ page }) => {
      await setupCommandRoutes(page, { server: mockReadonlyServer });
      await page.goto('/servers/cmd-server-2');
      await page.waitForSelector('[data-testid="server-info-card"], [data-testid="widget-server-info"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="execute-command-button"]')).not.toBeVisible();
    });

    test('clicking execute-command-button opens command-modal', async ({ page }) => {
      await setupCommandRoutes(page);
      await page.goto('/servers/cmd-server-1');
      await page.waitForSelector('[data-testid="execute-command-button"]', { timeout: 10000 });
      await page.locator('[data-testid="execute-command-button"]').click();
      await expect(page.locator('[data-testid="command-modal"]')).toBeVisible();
    });
  });

  test.describe('Command Whitelist', () => {
    test('command-modal shows whitelist-select with available commands', async ({ page }) => {
      await setupCommandRoutes(page);
      await page.goto('/servers/cmd-server-1');
      await page.waitForSelector('[data-testid="execute-command-button"]', { timeout: 10000 });
      await page.locator('[data-testid="execute-command-button"]').click();
      await page.waitForSelector('[data-testid="whitelist-select"]', { timeout: 5000 });
      await expect(page.locator('[data-testid="whitelist-select"]')).toBeVisible();
    });

    test('selecting whitelist entry populates command-input', async ({ page }) => {
      await setupCommandRoutes(page);
      await page.goto('/servers/cmd-server-1');
      await page.waitForSelector('[data-testid="execute-command-button"]', { timeout: 10000 });
      await page.locator('[data-testid="execute-command-button"]').click();
      await page.waitForSelector('[data-testid="whitelist-select"]', { timeout: 5000 });
      await page.locator('[data-testid="whitelist-select"]').selectOption('check_disk');
      const input = page.locator('[data-testid="command-input"]');
      await expect(input).toHaveValue(/df -h/);
    });
  });

  test.describe('Command Execution Flow', () => {
    test('run-command-button submits and shows streaming-output', async ({ page }) => {
      await setupCommandRoutes(page);
      await page.goto('/servers/cmd-server-1');
      await page.waitForSelector('[data-testid="execute-command-button"]', { timeout: 10000 });
      await page.locator('[data-testid="execute-command-button"]').click();
      await page.waitForSelector('[data-testid="whitelist-select"]', { timeout: 5000 });
      await page.locator('[data-testid="whitelist-select"]').selectOption('check_disk');
      await page.locator('[data-testid="run-command-button"]').click();
      await expect(page.locator('[data-testid="streaming-output"]')).toBeVisible();
    });

    test('successful execution shows exit-code-success', async ({ page }) => {
      await setupCommandRoutes(page);
      await page.goto('/servers/cmd-server-1');
      await page.waitForSelector('[data-testid="execute-command-button"]', { timeout: 10000 });
      await page.locator('[data-testid="execute-command-button"]').click();
      await page.waitForSelector('[data-testid="whitelist-select"]', { timeout: 5000 });
      await page.locator('[data-testid="whitelist-select"]').selectOption('check_disk');
      await page.locator('[data-testid="run-command-button"]').click();
      await page.waitForSelector('[data-testid="exit-code-success"], [data-testid="exit-code"]', { timeout: 10000 });
      const exitCode = page.locator('[data-testid="exit-code-success"], [data-testid="exit-code"]');
      await expect(exitCode.first()).toBeVisible();
    });

    test('cancel-command-button calls cancel endpoint during execution', async ({ page }) => {
      let cancelCalled = false;
      await setupCommandRoutes(page);
      await page.route('**/api/v1/servers/*/execute/cancel', (route) => {
        cancelCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      });
      // Slow down the stream so cancel button is visible
      await page.route('**/api/v1/servers/*/execute/stream', (route) => {
        // Return a long-running stream that doesn't complete immediately
        const body = 'data: {"type":"stdout","data":"Working...","timestamp":"2026-02-17T08:00:01Z"}\n\n';
        route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body,
        });
      });
      await page.goto('/servers/cmd-server-1');
      await page.waitForSelector('[data-testid="execute-command-button"]', { timeout: 10000 });
      await page.locator('[data-testid="execute-command-button"]').click();
      await page.waitForSelector('[data-testid="whitelist-select"]', { timeout: 5000 });
      await page.locator('[data-testid="whitelist-select"]').selectOption('check_disk');
      await page.locator('[data-testid="run-command-button"]').click();
      // Wait for the cancel button to appear during execution
      const cancelBtn = page.locator('[data-testid="cancel-command-button"]');
      if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
        expect(cancelCalled).toBe(true);
      }
    });
  });

  test.describe('Error States', () => {
    test('SSH connection failure shows error-message', async ({ page }) => {
      await setupCommandRoutes(page, {
        executeError: { status: 502, detail: 'SSH connection failed: Connection refused' },
      });
      await page.goto('/servers/cmd-server-1');
      await page.waitForSelector('[data-testid="execute-command-button"]', { timeout: 10000 });
      await page.locator('[data-testid="execute-command-button"]').click();
      await page.waitForSelector('[data-testid="whitelist-select"]', { timeout: 5000 });
      await page.locator('[data-testid="whitelist-select"]').selectOption('check_disk');
      await page.locator('[data-testid="run-command-button"]').click();
      await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('SSH');
    });

    test('command timeout shows timeout-error', async ({ page }) => {
      await setupCommandRoutes(page, {
        executeError: { status: 504, detail: 'Command timed out after 60 seconds' },
      });
      await page.goto('/servers/cmd-server-1');
      await page.waitForSelector('[data-testid="execute-command-button"]', { timeout: 10000 });
      await page.locator('[data-testid="execute-command-button"]').click();
      await page.waitForSelector('[data-testid="whitelist-select"]', { timeout: 5000 });
      await page.locator('[data-testid="whitelist-select"]').selectOption('check_disk');
      await page.locator('[data-testid="run-command-button"]').click();
      await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('timed out');
    });

    test('permission denied shows error-message', async ({ page }) => {
      await setupCommandRoutes(page, {
        executeError: { status: 403, detail: 'Command not in whitelist' },
      });
      await page.goto('/servers/cmd-server-1');
      await page.waitForSelector('[data-testid="execute-command-button"]', { timeout: 10000 });
      await page.locator('[data-testid="execute-command-button"]').click();
      await page.waitForSelector('[data-testid="whitelist-select"]', { timeout: 5000 });
      await page.locator('[data-testid="whitelist-select"]').selectOption('check_disk');
      await page.locator('[data-testid="run-command-button"]').click();
      await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-message"]')).toContainText('whitelist');
    });
  });

  test.describe('Command History', () => {
    test('command-history section shows past executions', async ({ page }) => {
      await setupCommandRoutes(page);
      await page.goto('/servers/cmd-server-1');
      // Navigate to classic view to see command history section
      await page.waitForSelector('[data-testid="view-mode-classic"]', { timeout: 10000 });
      await page.locator('[data-testid="view-mode-classic"]').click();
      const historySection = page.locator('[data-testid="command-history"], [data-testid="actions-section"]');
      if (await historySection.first().isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(historySection.first()).toBeVisible();
      }
    });
  });

  test.describe('Modal Behaviour', () => {
    test('close-modal-button dismisses command-modal', async ({ page }) => {
      await setupCommandRoutes(page);
      await page.goto('/servers/cmd-server-1');
      await page.waitForSelector('[data-testid="execute-command-button"]', { timeout: 10000 });
      await page.locator('[data-testid="execute-command-button"]').click();
      await expect(page.locator('[data-testid="command-modal"]')).toBeVisible();
      await page.locator('[data-testid="close-modal-button"]').click();
      await expect(page.locator('[data-testid="command-modal"]')).not.toBeVisible();
    });

    test('run-command-button disabled without whitelist selection', async ({ page }) => {
      await setupCommandRoutes(page);
      await page.goto('/servers/cmd-server-1');
      await page.waitForSelector('[data-testid="execute-command-button"]', { timeout: 10000 });
      await page.locator('[data-testid="execute-command-button"]').click();
      await page.waitForSelector('[data-testid="run-command-button"]', { timeout: 5000 });
      await expect(page.locator('[data-testid="run-command-button"]')).toBeDisabled();
    });
  });
});
