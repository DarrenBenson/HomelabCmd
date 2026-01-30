import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Settings } from './Settings';
import * as configApi from '../api/config';
import * as costsApi from '../api/costs';
import type { ConfigResponse } from '../types/config';
import type { CostConfig } from '../types/cost';

/**
 * Settings page tests covering TSP0005 test specification.
 *
 * Test Cases: TC041-TC057 (US0043, US0049)
 * Spec Reference: sdlc-studio/testing/specs/TSP0005-settings-configuration.md
 */

vi.mock('../api/config');
vi.mock('../api/costs');

const mockCostConfig: CostConfig = {
  electricity_rate: 0.24,
  currency_symbol: '£',
  updated_at: '2026-01-20T10:00:00Z',
};

const mockConfig: ConfigResponse = {
  thresholds: {
    cpu: { high_percent: 85, critical_percent: 95, sustained_seconds: 180 },
    memory: { high_percent: 85, critical_percent: 95, sustained_seconds: 180 },
    disk: { high_percent: 80, critical_percent: 95, sustained_seconds: 0 },
    server_offline_seconds: 180,
  },
  notifications: {
    slack_webhook_url: '',
    cooldowns: { critical_minutes: 30, high_minutes: 240 },
    notify_on_critical: true,
    notify_on_high: true,
    notify_on_remediation: true,
  },
};

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Loading state', () => {
    it('displays loading spinner initially', () => {
      vi.mocked(configApi.getConfig).mockImplementation(() => new Promise(() => {}));
      vi.mocked(costsApi.getCostConfig).mockImplementation(() => new Promise(() => {}));

      renderWithRouter();

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('displays error toast on fetch failure (with cached defaults)', async () => {
      vi.mocked(configApi.getConfig).mockRejectedValue(new Error('Network error'));
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);

      renderWithRouter();

      // Settings page uses defaults when fetch fails, showing error as toast
      await waitFor(() => {
        expect(screen.getByTestId('error-toast')).toBeInTheDocument();
      });
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    it('displays back button on page', async () => {
      vi.mocked(configApi.getConfig).mockRejectedValue(new Error('Network error'));
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
    });
  });

  describe('Settings page loads current config (TC042)', () => {
    beforeEach(() => {
      vi.mocked(configApi.getConfig).mockResolvedValue(mockConfig);
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);
    });

    it('calls GET /api/v1/config on mount', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(configApi.getConfig).toHaveBeenCalledTimes(1);
      });
    });

    it('displays Settings page header', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('populates threshold values from API response', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('thresholds-card')).toBeInTheDocument();
      });

      // CPU high slider should have value 85
      const cpuHighSlider = screen.getByTestId('cpu-high-slider') as HTMLInputElement;
      expect(cpuHighSlider.value).toBe('85');
    });

    it('populates notification settings from API response', async () => {
      const configWithWebhook = {
        ...mockConfig,
        notifications: {
          ...mockConfig.notifications,
          slack_webhook_url: 'https://hooks.slack.com/test',
        },
      };
      vi.mocked(configApi.getConfig).mockResolvedValue(configWithWebhook);

      renderWithRouter();

      await waitFor(() => {
        const input = screen.getByTestId('slack-webhook-input') as HTMLInputElement;
        expect(input.value).toBe('https://hooks.slack.com/test');
      });
    });
  });

  describe('Per-metric threshold sliders (TC043)', () => {
    beforeEach(() => {
      vi.mocked(configApi.getConfig).mockResolvedValue(mockConfig);
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);
    });

    it('displays CPU threshold slider', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cpu-high-slider')).toBeInTheDocument();
      });
    });

    it('displays memory threshold slider', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('memory-high-slider')).toBeInTheDocument();
      });
    });

    it('displays disk threshold slider', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('disk-high-slider')).toBeInTheDocument();
      });
    });

    it('updates displayed value when slider changes', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cpu-high-slider')).toBeInTheDocument();
      });

      const slider = screen.getByTestId('cpu-high-slider') as HTMLInputElement;
      fireEvent.change(slider, { target: { value: '90' } });

      expect(screen.getByText('90%')).toBeInTheDocument();
    });
  });

  describe('Duration selector (TC044)', () => {
    beforeEach(() => {
      vi.mocked(configApi.getConfig).mockResolvedValue(mockConfig);
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);
    });

    it('displays duration buttons for CPU', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cpu-duration-0')).toBeInTheDocument();
      });
      expect(screen.getByTestId('cpu-duration-60')).toBeInTheDocument();
      expect(screen.getByTestId('cpu-duration-180')).toBeInTheDocument();
      expect(screen.getByTestId('cpu-duration-300')).toBeInTheDocument();
    });

    it('changes sustained_seconds when duration selected', async () => {
      vi.mocked(configApi.updateThresholds).mockResolvedValue({
        updated: ['cpu.sustained_seconds'],
        thresholds: {
          ...mockConfig.thresholds,
          cpu: { ...mockConfig.thresholds.cpu, sustained_seconds: 300 },
        },
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cpu-duration-300')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cpu-duration-300'));
      fireEvent.click(screen.getByTestId('save-thresholds-button'));

      await waitFor(() => {
        expect(configApi.updateThresholds).toHaveBeenCalledWith(
          expect.objectContaining({
            cpu: expect.objectContaining({ sustained_seconds: 300 }),
          })
        );
      });
    });
  });

  describe('Thresholds saved via API (TC045)', () => {
    beforeEach(() => {
      vi.mocked(configApi.getConfig).mockResolvedValue(mockConfig);
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);
    });

    it('calls PUT /api/v1/config/thresholds on save', async () => {
      vi.mocked(configApi.updateThresholds).mockResolvedValue({
        updated: ['disk.high_percent'],
        thresholds: mockConfig.thresholds,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('save-thresholds-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-thresholds-button'));

      await waitFor(() => {
        expect(configApi.updateThresholds).toHaveBeenCalled();
      });
    });

    it('shows success message on save', async () => {
      vi.mocked(configApi.updateThresholds).mockResolvedValue({
        updated: ['disk.high_percent'],
        thresholds: mockConfig.thresholds,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('save-thresholds-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-thresholds-button'));

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument();
      });
    });
  });

  describe('Notification cooldowns (TC048)', () => {
    beforeEach(() => {
      vi.mocked(configApi.getConfig).mockResolvedValue(mockConfig);
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);
    });

    it('displays critical cooldown input', async () => {
      renderWithRouter();

      await waitFor(() => {
        const input = screen.getByTestId('critical-cooldown-input') as HTMLInputElement;
        expect(input.value).toBe('30');
      });
    });

    it('displays high cooldown input', async () => {
      renderWithRouter();

      await waitFor(() => {
        const input = screen.getByTestId('high-cooldown-input') as HTMLInputElement;
        expect(input.value).toBe('240');
      });
    });

    it('updates state when cooldown changed', async () => {
      vi.mocked(configApi.updateNotifications).mockResolvedValue({
        updated: ['cooldowns.critical_minutes'],
        notifications: {
          ...mockConfig.notifications,
          cooldowns: { critical_minutes: 60, high_minutes: 240 },
        },
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('critical-cooldown-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('critical-cooldown-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '60' } });

      expect(input.value).toBe('60');
    });
  });

  describe('Slack webhook URL (TC049)', () => {
    beforeEach(() => {
      vi.mocked(configApi.getConfig).mockResolvedValue(mockConfig);
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);
    });

    it('displays webhook URL input', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('slack-webhook-input')).toBeInTheDocument();
      });
    });

    it('accepts webhook URL input', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('slack-webhook-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('slack-webhook-input') as HTMLInputElement;
      fireEvent.change(input, {
        target: { value: 'https://hooks.slack.com/services/T00/B00/xxx' },
      });

      expect(input.value).toBe('https://hooks.slack.com/services/T00/B00/xxx');
    });
  });

  describe('Notification toggles (TC050)', () => {
    beforeEach(() => {
      vi.mocked(configApi.getConfig).mockResolvedValue(mockConfig);
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);
    });

    it('displays Critical toggle', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('notify-critical-checkbox')).toBeInTheDocument();
      });
    });

    it('displays High toggle', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('notify-high-checkbox')).toBeInTheDocument();
      });
    });

    it('displays Remediation toggle', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('notify-remediation-checkbox')).toBeInTheDocument();
      });
    });

    it('does not display Medium toggle', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('notifications-card')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('notify-medium-checkbox')).not.toBeInTheDocument();
    });

    it('does not display Low toggle', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('notifications-card')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('notify-low-checkbox')).not.toBeInTheDocument();
    });
  });

  describe('Notifications saved via API (TC051)', () => {
    beforeEach(() => {
      vi.mocked(configApi.getConfig).mockResolvedValue(mockConfig);
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);
    });

    it('calls PUT /api/v1/config/notifications on save', async () => {
      vi.mocked(configApi.updateNotifications).mockResolvedValue({
        updated: ['notify_on_high'],
        notifications: mockConfig.notifications,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('save-notifications-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-notifications-button'));

      await waitFor(() => {
        expect(configApi.updateNotifications).toHaveBeenCalled();
      });
    });
  });

  describe('Test webhook button visibility (TC053, TC054)', () => {
    beforeEach(() => {
      vi.mocked(configApi.getConfig).mockResolvedValue(mockConfig);
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);
    });

    it('hides Test button when webhook URL is empty (TC054)', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('slack-webhook-input')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('test-webhook-button')).not.toBeInTheDocument();
    });

    it('shows Test button when webhook URL is entered (TC053)', async () => {
      const configWithWebhook = {
        ...mockConfig,
        notifications: {
          ...mockConfig.notifications,
          slack_webhook_url: 'https://hooks.slack.com/test',
        },
      };
      vi.mocked(configApi.getConfig).mockResolvedValue(configWithWebhook);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('test-webhook-button')).toBeInTheDocument();
      });
    });

    it('shows Test button after entering URL', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('slack-webhook-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('slack-webhook-input');
      fireEvent.change(input, { target: { value: 'https://hooks.slack.com/test' } });

      expect(screen.getByTestId('test-webhook-button')).toBeInTheDocument();
    });
  });

  describe('Test webhook loading state (TC055)', () => {
    beforeEach(() => {
      const configWithWebhook = {
        ...mockConfig,
        notifications: {
          ...mockConfig.notifications,
          slack_webhook_url: 'https://hooks.slack.com/test',
        },
      };
      vi.mocked(configApi.getConfig).mockResolvedValue(configWithWebhook);
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);
    });

    it('shows loading state when testing webhook', async () => {
      vi.mocked(configApi.testWebhook).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('test-webhook-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-webhook-button'));

      await waitFor(() => {
        expect(screen.getByText('Testing...')).toBeInTheDocument();
      });
    });

    it('disables button during test', async () => {
      vi.mocked(configApi.testWebhook).mockImplementation(
        () => new Promise(() => {})
      );

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('test-webhook-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-webhook-button'));

      await waitFor(() => {
        expect(screen.getByTestId('test-webhook-button')).toBeDisabled();
      });
    });
  });

  describe('Test webhook success (TC056)', () => {
    beforeEach(() => {
      const configWithWebhook = {
        ...mockConfig,
        notifications: {
          ...mockConfig.notifications,
          slack_webhook_url: 'https://hooks.slack.com/test',
        },
      };
      vi.mocked(configApi.getConfig).mockResolvedValue(configWithWebhook);
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);
    });

    it('shows success message on successful test', async () => {
      vi.mocked(configApi.testWebhook).mockResolvedValue({
        success: true,
        message: 'Test message sent successfully',
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('test-webhook-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-webhook-button'));

      await waitFor(() => {
        expect(screen.getByTestId('test-result')).toBeInTheDocument();
      });

      const result = screen.getByTestId('test-result');
      expect(result).toHaveTextContent('Test message sent');
    });
  });

  describe('Test webhook failure (TC057)', () => {
    beforeEach(() => {
      const configWithWebhook = {
        ...mockConfig,
        notifications: {
          ...mockConfig.notifications,
          slack_webhook_url: 'https://hooks.slack.com/invalid',
        },
      };
      vi.mocked(configApi.getConfig).mockResolvedValue(configWithWebhook);
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);
    });

    it('shows error message on failed test', async () => {
      vi.mocked(configApi.testWebhook).mockResolvedValue({
        success: false,
        error: 'Invalid webhook URL',
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('test-webhook-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-webhook-button'));

      await waitFor(() => {
        expect(screen.getByTestId('test-result')).toBeInTheDocument();
      });

      const result = screen.getByTestId('test-result');
      expect(result).toHaveTextContent('Invalid webhook URL');
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      vi.mocked(configApi.getConfig).mockResolvedValue(mockConfig);
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);
    });

    it('navigates back to dashboard when back button clicked', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('back-button'));

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });

  /**
   * Cost Tracking Settings tests (US0034, BG0004)
   * Updated to test dialog-based UI for cost settings
   */
  describe('Cost Tracking Settings (US0034)', () => {
    beforeEach(() => {
      vi.mocked(configApi.getConfig).mockResolvedValue(mockConfig);
      vi.mocked(costsApi.getCostConfig).mockResolvedValue(mockCostConfig);
    });

    it('displays cost tracking section at bottom of page', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-tracking-card')).toBeInTheDocument();
      });
    });

    it('displays Cost Tracking header', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Cost Tracking')).toBeInTheDocument();
      });
    });

    it('displays current rate in summary', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByText('Current rate: £0.24/kWh')).toBeInTheDocument();
      });
    });

    it('displays Edit button', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });
    });

    it('opens dialog on Edit button click', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-dialog')).toBeInTheDocument();
      });
    });

    it('displays electricity rate input in dialog', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-rate-input')).toBeInTheDocument();
      });
    });

    it('displays currency symbol input in dialog', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-currency-input')).toBeInTheDocument();
      });
    });

    it('populates electricity rate from API in dialog', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        const input = screen.getByTestId('cost-rate-input') as HTMLInputElement;
        expect(input.value).toBe('0.24');
      });
    });

    it('populates currency symbol from API in dialog', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        const input = screen.getByTestId('cost-currency-input') as HTMLInputElement;
        expect(input.value).toBe('£');
      });
    });

    it('updates electricity rate on change in dialog', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-rate-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('cost-rate-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '0.35' } });

      expect(parseFloat(input.value)).toBe(0.35);
    });

    it('updates currency symbol on change in dialog', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-currency-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('cost-currency-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '$' } });

      expect(input.value).toBe('$');
    });

    it('displays rate preset buttons in dialog', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-preset-uk')).toBeInTheDocument();
        expect(screen.getByTestId('cost-preset-us')).toBeInTheDocument();
        expect(screen.getByTestId('cost-preset-eu')).toBeInTheDocument();
      });
    });

    it('sets UK preset on click in dialog', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-preset-uk')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-preset-uk'));

      const rateInput = screen.getByTestId('cost-rate-input') as HTMLInputElement;
      const currencyInput = screen.getByTestId('cost-currency-input') as HTMLInputElement;

      expect(rateInput.value).toBe('0.24');
      expect(currencyInput.value).toBe('£');
    });

    it('sets US preset on click in dialog', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-preset-us')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-preset-us'));

      const rateInput = screen.getByTestId('cost-rate-input') as HTMLInputElement;
      const currencyInput = screen.getByTestId('cost-currency-input') as HTMLInputElement;

      expect(rateInput.value).toBe('0.12');
      expect(currencyInput.value).toBe('$');
    });

    it('sets EU preset on click in dialog', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-preset-eu')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-preset-eu'));

      const rateInput = screen.getByTestId('cost-rate-input') as HTMLInputElement;
      const currencyInput = screen.getByTestId('cost-currency-input') as HTMLInputElement;

      expect(rateInput.value).toBe('0.3');
      expect(currencyInput.value).toBe('€');
    });

    it('displays save button in dialog', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-save')).toBeInTheDocument();
      });
    });

    it('calls updateCostConfig on save', async () => {
      vi.mocked(costsApi.updateCostConfig).mockResolvedValue({
        ...mockCostConfig,
        electricity_rate: 0.30,
      });

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-save')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-save'));

      await waitFor(() => {
        expect(costsApi.updateCostConfig).toHaveBeenCalled();
      });
    });

    it('shows success message on save and closes dialog', async () => {
      vi.mocked(costsApi.updateCostConfig).mockResolvedValue(mockCostConfig);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-save')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-save'));

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument();
      });
      expect(screen.getByText('Cost tracking settings saved successfully')).toBeInTheDocument();
      // Dialog should be closed
      expect(screen.queryByTestId('cost-settings-dialog')).not.toBeInTheDocument();
    });

    it('shows error message on save failure', async () => {
      vi.mocked(costsApi.updateCostConfig).mockRejectedValue(new Error('Save failed'));

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-save')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-save'));

      await waitFor(() => {
        expect(screen.getByTestId('error-toast')).toBeInTheDocument();
      });
    });

    it('closes dialog on Cancel button click', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-dialog')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('cost-settings-dialog')).not.toBeInTheDocument();
      });
    });

    it('closes dialog on backdrop click', async () => {
      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-dialog-backdrop')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-dialog-backdrop'));

      await waitFor(() => {
        expect(screen.queryByTestId('cost-settings-dialog')).not.toBeInTheDocument();
      });
    });
  });
});
