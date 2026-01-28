import { test, expect } from '@playwright/test';

/**
 * Settings Page E2E Tests
 *
 * Tests for the settings page functionality including:
 * - Alert thresholds configuration
 * - Cost tracking settings
 * - Notification settings
 * - Slack webhook integration
 */

const mockConfig = {
  thresholds: {
    cpu: { high_percent: 80, critical_percent: 95, sustained_heartbeats: 3 },
    memory: { high_percent: 85, critical_percent: 95, sustained_heartbeats: 3 },
    disk: { high_percent: 80, critical_percent: 90, sustained_heartbeats: 1 },
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
  },
};

const mockCostConfig = {
  electricity_rate: 0.24,
  currency_symbol: '£',
  updated_at: null,
};

test.describe('Settings Page', () => {
  test.describe('Page Structure', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockConfig),
        });
      });

      await page.route('**/api/v1/costs/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCostConfig),
        });
      });
    });

    test('displays page header', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="thresholds-card"]', { timeout: 10000 });

      await expect(page.locator('h1')).toContainText('Settings');
    });

    test('displays back button', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="back-button"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="back-button"]')).toBeVisible();
    });

    test('displays thresholds section', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="thresholds-card"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="thresholds-card"]')).toBeVisible();
      await expect(page.locator('text=Resource Alerts')).toBeVisible();
    });

    test('displays cost tracking section', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="cost-tracking-card"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="cost-tracking-card"]')).toBeVisible();
      await expect(page.locator('text=Cost Tracking')).toBeVisible();
    });

    test('displays notification frequency section', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="cooldowns-card"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="cooldowns-card"]')).toBeVisible();
      await expect(page.locator('text=Notification Frequency')).toBeVisible();
    });

    test('displays slack integration section', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="notifications-card"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="notifications-card"]')).toBeVisible();
      await expect(page.locator('text=Slack Integration')).toBeVisible();
    });
  });

  test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockConfig),
        });
      });

      await page.route('**/api/v1/costs/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCostConfig),
        });
      });
    });

    test('back button navigates to dashboard', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="back-button"]', { timeout: 10000 });

      await page.click('[data-testid="back-button"]');

      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Alert Thresholds', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockConfig),
        });
      });

      await page.route('**/api/v1/costs/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCostConfig),
        });
      });
    });

    test('displays CPU threshold sliders', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="cpu-high-slider"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="cpu-high-slider"]')).toBeVisible();
      await expect(page.locator('[data-testid="cpu-critical-slider"]')).toBeVisible();
    });

    test('displays memory threshold sliders', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="memory-high-slider"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="memory-high-slider"]')).toBeVisible();
      await expect(page.locator('[data-testid="memory-critical-slider"]')).toBeVisible();
    });

    test('displays disk threshold sliders', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="disk-high-slider"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="disk-high-slider"]')).toBeVisible();
      await expect(page.locator('[data-testid="disk-critical-slider"]')).toBeVisible();
    });

    test('displays server offline timeout input', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="offline-timeout-input"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="offline-timeout-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="offline-timeout-input"]')).toHaveValue('90');
    });

    test('save thresholds button calls API', async ({ page }) => {
      let saveCalled = false;

      await page.route('**/api/v1/config/thresholds', (route) => {
        saveCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ thresholds: mockConfig.thresholds }),
        });
      });

      await page.goto('/settings');
      await page.waitForSelector('[data-testid="save-thresholds-button"]', { timeout: 10000 });

      await page.click('[data-testid="save-thresholds-button"]');

      await page.waitForTimeout(500);
      expect(saveCalled).toBe(true);
    });

    test('shows success message after saving thresholds', async ({ page }) => {
      await page.route('**/api/v1/config/thresholds', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ thresholds: mockConfig.thresholds }),
        });
      });

      await page.goto('/settings');
      await page.waitForSelector('[data-testid="save-thresholds-button"]', { timeout: 10000 });

      await page.click('[data-testid="save-thresholds-button"]');

      await expect(page.locator('[data-testid="success-message"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=saved successfully')).toBeVisible();
    });
  });

  test.describe('Cost Tracking', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockConfig),
        });
      });

      await page.route('**/api/v1/costs/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCostConfig),
        });
      });
    });

    test('displays currency symbol input', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="currency-symbol-input"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="currency-symbol-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="currency-symbol-input"]')).toHaveValue('£');
    });

    test('displays electricity rate input', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="electricity-rate-input"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="electricity-rate-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="electricity-rate-input"]')).toHaveValue('0.24');
    });

    test('displays rate presets', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="rate-preset-uk"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="rate-preset-uk"]')).toBeVisible();
      await expect(page.locator('[data-testid="rate-preset-us"]')).toBeVisible();
      await expect(page.locator('[data-testid="rate-preset-eu"]')).toBeVisible();
    });

    test('clicking UK preset sets UK rate', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="rate-preset-uk"]', { timeout: 10000 });

      await page.click('[data-testid="rate-preset-uk"]');

      await expect(page.locator('[data-testid="currency-symbol-input"]')).toHaveValue('£');
      await expect(page.locator('[data-testid="electricity-rate-input"]')).toHaveValue('0.24');
    });

    test('clicking US preset sets US rate', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="rate-preset-us"]', { timeout: 10000 });

      await page.click('[data-testid="rate-preset-us"]');

      await expect(page.locator('[data-testid="currency-symbol-input"]')).toHaveValue('$');
      await expect(page.locator('[data-testid="electricity-rate-input"]')).toHaveValue('0.12');
    });

    test('clicking EU preset sets EU rate', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="rate-preset-eu"]', { timeout: 10000 });

      await page.click('[data-testid="rate-preset-eu"]');

      await expect(page.locator('[data-testid="currency-symbol-input"]')).toHaveValue('€');
      await expect(page.locator('[data-testid="electricity-rate-input"]')).toHaveValue('0.3');
    });

    test('save cost button calls API', async ({ page }) => {
      let saveCalled = false;

      await page.route('**/api/v1/costs/config', (route) => {
        if (route.request().method() === 'PUT') {
          saveCalled = true;
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockCostConfig),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockCostConfig),
          });
        }
      });

      await page.goto('/settings');
      await page.waitForSelector('[data-testid="save-cost-button"]', { timeout: 10000 });

      await page.click('[data-testid="save-cost-button"]');

      await page.waitForTimeout(500);
      expect(saveCalled).toBe(true);
    });
  });

  test.describe('Notification Frequency', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockConfig),
        });
      });

      await page.route('**/api/v1/costs/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCostConfig),
        });
      });
    });

    test('displays critical cooldown input', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="critical-cooldown-input"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="critical-cooldown-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="critical-cooldown-input"]')).toHaveValue('15');
    });

    test('displays high cooldown input', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="high-cooldown-input"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="high-cooldown-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="high-cooldown-input"]')).toHaveValue('60');
    });

    test('displays notify on remediation checkbox', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="notify-remediation-checkbox"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="notify-remediation-checkbox"]')).toBeVisible();
      await expect(page.locator('[data-testid="notify-remediation-checkbox"]')).toBeChecked();
    });
  });

  test.describe('Slack Integration', () => {
    test.beforeEach(async ({ page }) => {
      await page.route('**/api/v1/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockConfig),
        });
      });

      await page.route('**/api/v1/costs/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCostConfig),
        });
      });
    });

    test('displays webhook URL input', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="slack-webhook-input"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="slack-webhook-input"]')).toBeVisible();
    });

    test('test button appears when webhook URL is entered', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="slack-webhook-input"]', { timeout: 10000 });

      await page.fill('[data-testid="slack-webhook-input"]', 'https://hooks.slack.com/services/test');

      await expect(page.locator('[data-testid="test-webhook-button"]')).toBeVisible();
    });

    test('test button is not visible when webhook URL is empty', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="slack-webhook-input"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="test-webhook-button"]')).not.toBeVisible();
    });

    test('test webhook button calls API', async ({ page }) => {
      let testCalled = false;

      await page.route('**/api/v1/config/notifications/test-webhook', (route) => {
        testCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Test message sent!' }),
        });
      });

      await page.goto('/settings');
      await page.waitForSelector('[data-testid="slack-webhook-input"]', { timeout: 10000 });

      await page.fill('[data-testid="slack-webhook-input"]', 'https://hooks.slack.com/services/test');
      await page.click('[data-testid="test-webhook-button"]');

      await page.waitForTimeout(500);
      expect(testCalled).toBe(true);
    });

    test('shows success message after successful webhook test', async ({ page }) => {
      await page.route('**/api/v1/config/notifications/test-webhook', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Test message sent!' }),
        });
      });

      await page.goto('/settings');
      await page.waitForSelector('[data-testid="slack-webhook-input"]', { timeout: 10000 });

      await page.fill('[data-testid="slack-webhook-input"]', 'https://hooks.slack.com/services/test');
      await page.click('[data-testid="test-webhook-button"]');

      await expect(page.locator('[data-testid="test-result"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Test message sent')).toBeVisible();
    });

    test('shows error message after failed webhook test', async ({ page }) => {
      await page.route('**/api/v1/config/notifications/test-webhook', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Invalid webhook URL' }),
        });
      });

      await page.goto('/settings');
      await page.waitForSelector('[data-testid="slack-webhook-input"]', { timeout: 10000 });

      await page.fill('[data-testid="slack-webhook-input"]', 'https://invalid-url');
      await page.click('[data-testid="test-webhook-button"]');

      await expect(page.locator('[data-testid="test-result"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Invalid webhook URL')).toBeVisible();
    });

    test('displays notification checkboxes', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="notify-critical-checkbox"]', { timeout: 10000 });

      await expect(page.locator('[data-testid="notify-critical-checkbox"]')).toBeVisible();
      await expect(page.locator('[data-testid="notify-high-checkbox"]')).toBeVisible();
      await expect(page.locator('[data-testid="notify-action-failure-checkbox"]')).toBeVisible();
      await expect(page.locator('[data-testid="notify-action-success-checkbox"]')).toBeVisible();
    });

    test('save notifications button calls API', async ({ page }) => {
      let saveCalled = false;

      await page.route('**/api/v1/config/notifications', (route) => {
        saveCalled = true;
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ notifications: mockConfig.notifications }),
        });
      });

      await page.goto('/settings');
      await page.waitForSelector('[data-testid="save-notifications-button"]', { timeout: 10000 });

      await page.click('[data-testid="save-notifications-button"]');

      await page.waitForTimeout(500);
      expect(saveCalled).toBe(true);
    });
  });

  test.describe('Loading State', () => {
    test('shows loading spinner', async ({ page }) => {
      // Delay the API responses
      await page.route('**/api/v1/config', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockConfig),
        });
      });

      await page.route('**/api/v1/costs/config', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockCostConfig),
        });
      });

      await page.goto('/settings');

      await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible({ timeout: 500 });
    });
  });

  test.describe('Error Handling', () => {
    test('shows error toast on save failure', async ({ page }) => {
      await page.route('**/api/v1/config', (route) => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockConfig),
        });
      });

      await page.route('**/api/v1/costs/config', (route) => {
        if (route.request().method() === 'PUT') {
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Failed to save' }),
          });
        } else {
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockCostConfig),
          });
        }
      });

      await page.goto('/settings');
      await page.waitForSelector('[data-testid="save-cost-button"]', { timeout: 10000 });

      await page.click('[data-testid="save-cost-button"]');

      await expect(page.locator('[data-testid="error-toast"]')).toBeVisible({ timeout: 5000 });
    });
  });
});
