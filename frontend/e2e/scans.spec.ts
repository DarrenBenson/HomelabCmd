import { test, expect } from '@playwright/test';

/**
 * Scans Page E2E Tests
 *
 * Tests for the scans page functionality including:
 * - Manual scan initiation (quick and full)
 * - Network discovery
 * - Recent scans display
 * - Navigation
 */

const mockScanResponse = {
  scan_id: 123,
  hostname: 'test-server.local',
  status: 'running',
  scan_type: 'quick',
  started_at: new Date().toISOString(),
  completed_at: null,
  results: null,
};

const mockDiscoveryResponse = {
  id: 1,
  subnet: '192.168.1.0/24',
  status: 'completed',
  started_at: new Date(Date.now() - 60000).toISOString(),
  completed_at: new Date().toISOString(),
  devices_found: 5,
  devices: [
    { ip: '192.168.1.1', mac: 'AA:BB:CC:DD:EE:01', hostname: 'router.local', vendor: 'Cisco' },
    { ip: '192.168.1.100', mac: 'AA:BB:CC:DD:EE:02', hostname: 'server1.local', vendor: 'Dell' },
    { ip: '192.168.1.101', mac: 'AA:BB:CC:DD:EE:03', hostname: 'server2.local', vendor: 'HP' },
    { ip: '192.168.1.102', mac: 'AA:BB:CC:DD:EE:04', hostname: null, vendor: 'Unknown' },
    { ip: '192.168.1.103', mac: 'AA:BB:CC:DD:EE:05', hostname: 'nas.local', vendor: 'Synology' },
  ],
};

const mockRecentScans = {
  scans: [
    {
      scan_id: 100,
      hostname: 'server1.local',
      status: 'completed',
      scan_type: 'full',
      started_at: new Date(Date.now() - 3600000).toISOString(),
      completed_at: new Date(Date.now() - 3500000).toISOString(),
    },
    {
      scan_id: 99,
      hostname: 'server2.local',
      status: 'failed',
      scan_type: 'quick',
      started_at: new Date(Date.now() - 7200000).toISOString(),
      completed_at: new Date(Date.now() - 7100000).toISOString(),
    },
  ],
  total: 2,
};

const mockDiscoverySettings = {
  default_subnet: '192.168.1.0/24',
  timeout_ms: 500,
};

test.describe('Scans Page', () => {
  test.describe('Page Structure', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/scans', (route) => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockRecentScans),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockScanResponse),
          });
        }
      });

      await page.route('**/api/v1/discovery/settings', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDiscoverySettings),
        });
      });

      await page.route('**/api/v1/discovery', (route) => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ discoveries: [], total: 0 }),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockDiscoveryResponse),
          });
        }
      });
    });

    test('displays page header', async ({ page }) => {
      await page.goto('/scans');

      await expect(page.locator('h1')).toContainText('Scans');
      await expect(page.locator('text=Ad-hoc device scanning')).toBeVisible();
    });

    test('displays back button', async ({ page }) => {
      await page.goto('/scans');

      const backButton = page.locator('[aria-label="Back to dashboard"]');
      await expect(backButton).toBeVisible();
    });

    test('displays settings link', async ({ page }) => {
      await page.goto('/scans');

      const settingsLink = page.locator('[aria-label="Settings"]');
      await expect(settingsLink).toBeVisible();
    });

    test('displays manual scan section', async ({ page }) => {
      await page.goto('/scans');

      await expect(page.locator('text=Manual Scan')).toBeVisible();
      await expect(page.locator('[data-testid="hostname-input"]')).toBeVisible();
    });

    test('displays network discovery section', async ({ page }) => {
      await page.goto('/scans');

      // Network discovery component should be present
      await expect(page.locator('text=/Network Discovery|Discover/')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/scans', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockRecentScans),
        });
      });

      await page.route('**/api/v1/discovery/settings', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDiscoverySettings),
        });
      });

      await page.route('**/api/v1/discovery', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ discoveries: [], total: 0 }),
        });
      });
    });

    test('back button navigates to dashboard', async ({ page }) => {
      await page.goto('/scans');

      await page.click('[aria-label="Back to dashboard"]');

      await expect(page).toHaveURL('/');
    });

    test('settings link navigates to settings', async ({ page }) => {
      // Mock settings page APIs
      await page.route('**/api/v1/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            thresholds: { cpu: {}, memory: {}, disk: {}, server_offline_seconds: 90 },
            notifications: {},
          }),
        });
      });

      await page.route('**/api/v1/costs/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ electricity_rate: 0.24, currency_symbol: '£' }),
        });
      });

      await page.goto('/scans');

      await page.click('[aria-label="Settings"]');

      await expect(page).toHaveURL('/settings');
    });
  });

  test.describe('Manual Scan Input', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/scans', (route) => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockRecentScans),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockScanResponse),
          });
        }
      });

      await page.route('**/api/v1/discovery/settings', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDiscoverySettings),
        });
      });

      await page.route('**/api/v1/discovery', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ discoveries: [], total: 0 }),
        });
      });
    });

    test('hostname input accepts text', async ({ page }) => {
      await page.goto('/scans');

      const input = page.locator('[data-testid="hostname-input"]');
      await input.fill('192.168.1.100');

      await expect(input).toHaveValue('192.168.1.100');
    });

    test('quick scan button is disabled when empty', async ({ page }) => {
      await page.goto('/scans');

      const button = page.locator('[data-testid="quick-scan-button"]');
      await expect(button).toBeDisabled();
    });

    test('quick scan button is enabled with hostname', async ({ page }) => {
      await page.goto('/scans');

      await page.fill('[data-testid="hostname-input"]', 'test-server');

      const button = page.locator('[data-testid="quick-scan-button"]');
      await expect(button).not.toBeDisabled();
    });

    test('full scan button is disabled when empty', async ({ page }) => {
      await page.goto('/scans');

      const button = page.locator('[data-testid="full-scan-button"]');
      await expect(button).toBeDisabled();
    });

    test('full scan button is enabled with hostname', async ({ page }) => {
      await page.goto('/scans');

      await page.fill('[data-testid="hostname-input"]', 'test-server');

      const button = page.locator('[data-testid="full-scan-button"]');
      await expect(button).not.toBeDisabled();
    });
  });

  test.describe('Quick Scan', () => {
    test('initiates quick scan and navigates to results', async ({ page }) => {
      await page.route('**/api/v1/scans', (route) => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockRecentScans),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockScanResponse),
          });
        }
      });

      await page.route('**/api/v1/discovery/settings', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDiscoverySettings),
        });
      });

      await page.route('**/api/v1/discovery', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ discoveries: [], total: 0 }),
        });
      });

      await page.goto('/scans');

      await page.fill('[data-testid="hostname-input"]', 'test-server.local');
      await page.click('[data-testid="quick-scan-button"]');

      await expect(page).toHaveURL(/\/scans\/123/);
    });

    test('submits quick scan on Enter key', async ({ page }) => {
      await page.route('**/api/v1/scans', (route) => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockRecentScans),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockScanResponse),
          });
        }
      });

      await page.route('**/api/v1/discovery/settings', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDiscoverySettings),
        });
      });

      await page.route('**/api/v1/discovery', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ discoveries: [], total: 0 }),
        });
      });

      await page.goto('/scans');

      const input = page.locator('[data-testid="hostname-input"]');
      await input.fill('test-server.local');
      await input.press('Enter');

      await expect(page).toHaveURL(/\/scans\/123/);
    });
  });

  test.describe('Full Scan', () => {
    test('initiates full scan and navigates to results', async ({ page }) => {
      await page.route('**/api/v1/scans', (route) => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockRecentScans),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ ...mockScanResponse, scan_type: 'full' }),
          });
        }
      });

      await page.route('**/api/v1/discovery/settings', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDiscoverySettings),
        });
      });

      await page.route('**/api/v1/discovery', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ discoveries: [], total: 0 }),
        });
      });

      await page.goto('/scans');

      await page.fill('[data-testid="hostname-input"]', 'test-server.local');
      await page.click('[data-testid="full-scan-button"]');

      await expect(page).toHaveURL(/\/scans\/123/);
    });
  });

  test.describe('Error Handling', () => {
    test('displays error on scan failure', async ({ page }) => {
      await page.route('**/api/v1/scans', (route) => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockRecentScans),
          });
        } else {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Connection refused' }),
          });
        }
      });

      await page.route('**/api/v1/discovery/settings', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDiscoverySettings),
        });
      });

      await page.route('**/api/v1/discovery', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ discoveries: [], total: 0 }),
        });
      });

      await page.goto('/scans');

      await page.fill('[data-testid="hostname-input"]', 'unreachable-server');
      await page.click('[data-testid="quick-scan-button"]');

      await expect(page.locator('[data-testid="scan-error"]')).toBeVisible({ timeout: 5000 });
    });

    test('clears error when hostname changes', async ({ page }) => {
      await page.route('**/api/v1/scans', (route) => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockRecentScans),
          });
        } else {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Connection refused' }),
          });
        }
      });

      await page.route('**/api/v1/discovery/settings', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDiscoverySettings),
        });
      });

      await page.route('**/api/v1/discovery', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ discoveries: [], total: 0 }),
        });
      });

      await page.goto('/scans');

      // Trigger an error
      await page.fill('[data-testid="hostname-input"]', 'bad-server');
      await page.click('[data-testid="quick-scan-button"]');
      await expect(page.locator('[data-testid="scan-error"]')).toBeVisible({ timeout: 5000 });

      // Change hostname should clear error
      await page.fill('[data-testid="hostname-input"]', 'new-server');
      await expect(page.locator('[data-testid="scan-error"]')).not.toBeVisible();
    });
  });

  test.describe('Disabled State During Scan', () => {
    test('disables input and buttons while scanning', async ({ page }) => {
      // Create a delayed response
      await page.route('**/api/v1/scans', (route) => {
        if (route.request().method() === 'GET') {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockRecentScans),
          });
        } else {
          // Delay the response
          setTimeout(() => {
            route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(mockScanResponse),
            });
          }, 2000);
        }
      });

      await page.route('**/api/v1/discovery/settings', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDiscoverySettings),
        });
      });

      await page.route('**/api/v1/discovery', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ discoveries: [], total: 0 }),
        });
      });

      await page.goto('/scans');

      await page.fill('[data-testid="hostname-input"]', 'test-server');
      await page.click('[data-testid="quick-scan-button"]');

      // Check that input is disabled during scan
      await expect(page.locator('[data-testid="hostname-input"]')).toBeDisabled();
      await expect(page.locator('[data-testid="quick-scan-button"]')).toBeDisabled();
      await expect(page.locator('[data-testid="full-scan-button"]')).toBeDisabled();
    });
  });
});
