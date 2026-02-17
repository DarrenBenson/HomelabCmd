import { test, expect } from '@playwright/test';

/**
 * Settings v2 E2E Tests
 *
 * Covers: EP0008 (Tailscale), EP0015 (Credentials), EP0017 (Connectivity)
 * Tests ConnectivitySettings, TailscaleSettings, and SSHKeyManager.
 */

const mockConfig = {
  thresholds: {
    cpu: { high_percent: 80, critical_percent: 95, sustained_seconds: 120 },
    memory: { high_percent: 85, critical_percent: 95, sustained_seconds: 120 },
    disk: { high_percent: 85, critical_percent: 95, sustained_seconds: 0 },
    server_offline_seconds: 90,
  },
  notifications: {
    slack_webhook_url: '',
    cooldowns: { critical_minutes: 15, high_minutes: 60 },
    notify_on_critical: true,
    notify_on_high: true,
    notify_on_remediation: true,
    notify_on_action_failure: true,
    notify_on_action_success: false,
    notify_on_auto_resolve: true,
  },
};

const mockCostConfig = {
  electricity_rate: 0.24,
  currency_symbol: '£',
  updated_at: null,
};

const mockActionTimeouts = {
  default_timeout: 300,
  service_restart_timeout: 60,
  package_update_timeout: 600,
  updated_at: null,
};

const mockConnectivity = {
  mode: 'tailscale',
  mode_auto_detected: false,
  tailscale: {
    configured: true,
    connected: true,
    tailnet: 'my-tailnet',
    device_count: 5,
  },
  ssh: {
    username: 'admin',
    key_configured: true,
    key_uploaded_at: '2026-01-01T00:00:00Z',
  },
};

const mockTailscaleStatus = {
  configured: true,
  tailnet_name: 'my-tailnet',
  device_count: 5,
};

const mockTailscaleStatusUnconfigured = {
  configured: false,
  tailnet_name: null,
  device_count: 0,
};

const mockSSHStatus = {
  keys: [
    {
      id: 'key-1',
      name: 'homelab_key',
      fingerprint: 'SHA256:abc123def456',
      type: 'ed25519',
      username: 'admin',
      is_default: true,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
};

async function setupSettingsRoutes(
  page: import('@playwright/test').Page,
  options: {
    tailscaleConfigured?: boolean;
    sshKeys?: unknown[];
  } = {}
) {
  const tailscaleStatus = options.tailscaleConfigured === false
    ? mockTailscaleStatusUnconfigured
    : mockTailscaleStatus;
  const sshKeys = options.sshKeys ?? mockSSHStatus.keys;

  await Promise.all([
    page.route('**/api/v1/config', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockConfig),
      });
    }),
    page.route('**/api/v1/config/cost', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCostConfig),
      });
    }),
    page.route('**/api/v1/config/action-timeouts', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockActionTimeouts),
      });
    }),
    page.route('**/api/v1/settings/connectivity', (route) => {
      if (route.request().method() === 'PUT') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, mode: 'direct_ssh', message: 'Mode updated' }),
        });
      } else {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockConnectivity),
        });
      }
    }),
    page.route('**/api/v1/settings/tailscale/status', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(tailscaleStatus),
      });
    }),
    page.route('**/api/v1/settings/tailscale/token', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
    }),
    page.route('**/api/v1/settings/tailscale/test', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, tailnet: 'my-tailnet', device_count: 5 }),
      });
    }),
    page.route('**/api/v1/settings/ssh/status', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ configured: sshKeys.length > 0, keys: sshKeys }),
      });
    }),
    page.route('**/api/v1/settings/ssh/keys', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ keys: sshKeys }),
      });
    }),
    page.route('**/api/v1/settings/ssh/key', (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
    }),
  ]);
}

test.describe('Settings v2', () => {
  test.describe('Connectivity Mode', () => {
    test.beforeEach(async ({ page }) => {
      await setupSettingsRoutes(page);
    });

    test('displays tailscale and direct-ssh mode options', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="tailscale-mode-option"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="tailscale-mode-option"]')).toBeVisible();
      await expect(page.locator('[data-testid="direct-ssh-mode-option"]')).toBeVisible();
    });

    test('save-mode-button calls PUT /settings/connectivity', async ({ page }) => {
      let saveCalled = false;
      await page.route('**/api/v1/settings/connectivity', (route) => {
        if (route.request().method() === 'PUT') {
          saveCalled = true;
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, mode: 'direct_ssh', message: 'Mode updated' }) });
        } else {
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockConnectivity) });
        }
      });
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="direct-ssh-mode-option"]', { timeout: 10000 });
      await page.locator('[data-testid="direct-ssh-mode-option"]').click();
      await page.waitForSelector('[data-testid="save-mode-button"]', { timeout: 5000 });
      await page.locator('[data-testid="save-mode-button"]').click();
      await page.waitForTimeout(500);
      expect(saveCalled).toBe(true);
    });
  });

  test.describe('Tailscale Settings', () => {
    test.beforeEach(async ({ page }) => {
      await setupSettingsRoutes(page, { tailscaleConfigured: false });
    });

    test('shows token input when not configured', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="tailscale-settings-card"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="token-input"]')).toBeVisible();
    });

    test('save token calls POST /settings/tailscale/token', async ({ page }) => {
      let tokenSaved = false;
      await page.route('**/api/v1/settings/tailscale/token', (route) => {
        if (route.request().method() === 'POST') {
          tokenSaved = true;
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
        } else {
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
        }
      });
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="token-input"]', { timeout: 10000 });
      await page.locator('[data-testid="token-input"]').fill('tskey-api-test-token');
      await page.locator('[data-testid="save-token-button"]').click();
      await page.waitForTimeout(500);
      expect(tokenSaved).toBe(true);
    });

    test('test connection calls POST /settings/tailscale/test', async ({ page }) => {
      // Use configured state for test connection
      await setupSettingsRoutes(page, { tailscaleConfigured: true });
      let testCalled = false;
      await page.route('**/api/v1/settings/tailscale/test', (route) => {
        testCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, tailnet: 'my-tailnet', device_count: 5 }),
        });
      });
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="test-connection-button"]', { timeout: 10000 });
      await page.locator('[data-testid="test-connection-button"]').click();
      await page.waitForTimeout(500);
      expect(testCalled).toBe(true);
    });

    test('shows success result on passing test', async ({ page }) => {
      await setupSettingsRoutes(page, { tailscaleConfigured: true });
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="test-connection-button"]', { timeout: 10000 });
      await page.locator('[data-testid="test-connection-button"]').click();
      await page.waitForSelector('[data-testid="test-result"]', { timeout: 5000 });
      await expect(page.locator('[data-testid="test-result"]')).toBeVisible();
      await expect(page.locator('[data-testid="test-result"]')).toContainText('my-tailnet');
    });

    test('shows error result on failing test', async ({ page }) => {
      await setupSettingsRoutes(page, { tailscaleConfigured: true });
      await page.route('**/api/v1/settings/tailscale/test', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Invalid token' }),
        });
      });
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="test-connection-button"]', { timeout: 10000 });
      await page.locator('[data-testid="test-connection-button"]').click();
      await page.waitForSelector('[data-testid="test-result"]', { timeout: 5000 });
      await expect(page.locator('[data-testid="test-result"]')).toContainText('Invalid token');
    });

    test('remove token calls DELETE /settings/tailscale/token', async ({ page }) => {
      await setupSettingsRoutes(page, { tailscaleConfigured: true });
      let deleteCalled = false;
      await page.route('**/api/v1/settings/tailscale/token', (route) => {
        if (route.request().method() === 'DELETE') {
          deleteCalled = true;
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
        } else {
          route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
        }
      });
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="remove-token-button"]', { timeout: 10000 });
      await page.locator('[data-testid="remove-token-button"]').click();
      await page.waitForSelector('[data-testid="confirm-remove-token-button"]', { timeout: 5000 });
      await page.locator('[data-testid="confirm-remove-token-button"]').click();
      await page.waitForTimeout(500);
      expect(deleteCalled).toBe(true);
    });
  });

  test.describe('SSH Key Manager', () => {
    test.beforeEach(async ({ page }) => {
      await setupSettingsRoutes(page);
    });

    test('displays SSH key status', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="ssh-keys-card"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="ssh-keys-card"]')).toBeVisible();
      await expect(page.locator('[data-testid="key-row-key-1"]')).toBeVisible();
    });

    test('add-key-button opens modal', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="add-key-button"]', { timeout: 10000 });
      await page.locator('[data-testid="add-key-button"]').click();
      await expect(page.locator('[data-testid="key-name-input"]')).toBeVisible();
    });

    test('delete key button triggers confirmation', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="delete-key-key-1"]', { timeout: 10000 });
      await page.locator('[data-testid="delete-key-key-1"]').click();
      await expect(page.locator('[data-testid="confirm-delete-button"]')).toBeVisible();
    });
  });
});
