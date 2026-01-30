/**
 * Tests for Settings page component.
 *
 * Tests thresholds, notifications, Slack integration, cost tracking,
 * and other configuration settings.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Settings } from '../../pages/Settings';
import { getConfig, updateThresholds, updateNotifications, testWebhook } from '../../api/config';
import { getCostConfig, updateCostConfig } from '../../api/costs';
import type { ConfigResponse, ThresholdsConfig, NotificationsConfig } from '../../types/config';
import type { CostConfig } from '../../types/cost';

// Mock the APIs
vi.mock('../../api/config', () => ({
  getConfig: vi.fn(),
  updateThresholds: vi.fn(),
  updateNotifications: vi.fn(),
  testWebhook: vi.fn(),
}));

vi.mock('../../api/costs', () => ({
  getCostConfig: vi.fn(),
  updateCostConfig: vi.fn(),
}));

// Mock child components that make their own API calls
vi.mock('../../components/ConnectivitySettings', () => ({
  ConnectivitySettings: () => <div data-testid="connectivity-settings">ConnectivitySettings</div>,
}));

vi.mock('../../components/TailscaleSettings', () => ({
  TailscaleSettings: () => <div data-testid="tailscale-settings">TailscaleSettings</div>,
}));

vi.mock('../../components/SSHKeyManager', () => ({
  SSHKeyManager: () => <div data-testid="ssh-key-manager">SSHKeyManager</div>,
}));

vi.mock('../../components/CostSettingsDialog', () => ({
  CostSettingsDialog: ({ onSave, onCancel, isLoading }: {
    onSave: (data: { electricity_rate: number }) => void;
    onCancel: () => void;
    isLoading: boolean;
  }) => (
    <div data-testid="cost-settings-dialog">
      <button onClick={() => onSave({ electricity_rate: 0.30 })} disabled={isLoading}>
        Save
      </button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

const mockGetConfig = getConfig as Mock;
const mockUpdateThresholds = updateThresholds as Mock;
const mockUpdateNotifications = updateNotifications as Mock;
const mockTestWebhook = testWebhook as Mock;
const mockGetCostConfig = getCostConfig as Mock;
const mockUpdateCostConfig = updateCostConfig as Mock;

const mockThresholds: ThresholdsConfig = {
  cpu: { high_percent: 80, critical_percent: 95, sustained_seconds: 180 },
  memory: { high_percent: 75, critical_percent: 90, sustained_seconds: 180 },
  disk: { high_percent: 80, critical_percent: 95, sustained_seconds: 60 },
  server_offline_seconds: 90,
};

const mockNotifications: NotificationsConfig = {
  slack_webhook_url: '',
  cooldowns: {
    critical_minutes: 5,
    high_minutes: 60,
  },
  notify_on_critical: true,
  notify_on_high: true,
  notify_on_remediation: true,
  notify_on_action_failure: true,
  notify_on_action_success: false,
};

const mockConfigResponse: ConfigResponse = {
  thresholds: mockThresholds,
  notifications: mockNotifications,
};

const mockCostConfig: CostConfig = {
  electricity_rate: 0.24,
  currency_symbol: '£',
  currency_code: 'GBP',
  track_costs: true,
  updated_at: null,
};

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<Settings />} />
        <Route path="/" element={<div data-testid="dashboard">Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    mockGetConfig.mockResolvedValue(mockConfigResponse);
    mockGetCostConfig.mockResolvedValue(mockCostConfig);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Loading state', () => {
    it('shows loading spinner while fetching config', () => {
      mockGetConfig.mockImplementation(() => new Promise(() => {}));

      renderSettings();

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('shows error toast when config fetch fails but uses defaults', async () => {
      mockGetConfig.mockRejectedValue(new Error('Failed to load configuration'));

      renderSettings();

      // Component uses default thresholds and shows error toast
      await waitFor(() => {
        expect(screen.getByTestId('error-toast')).toBeInTheDocument();
      });
      expect(screen.getByText(/Failed to load configuration/i)).toBeInTheDocument();
    });

    it('still renders thresholds card with defaults when fetch fails', async () => {
      mockGetConfig.mockRejectedValue(new Error('Network error'));

      renderSettings();

      // Component falls back to defaults
      await waitFor(() => {
        expect(screen.getByTestId('thresholds-card')).toBeInTheDocument();
      });
    });

    it('shows back button even with error', async () => {
      mockGetConfig.mockRejectedValue(new Error('Network error'));

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
    });
  });

  describe('Thresholds card', () => {
    it('renders thresholds card', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('thresholds-card')).toBeInTheDocument();
      });
    });

    it('shows CPU threshold sliders', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('cpu-high-slider')).toBeInTheDocument();
        expect(screen.getByTestId('cpu-critical-slider')).toBeInTheDocument();
      });
    });

    it('shows Memory threshold sliders', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('memory-high-slider')).toBeInTheDocument();
        expect(screen.getByTestId('memory-critical-slider')).toBeInTheDocument();
      });
    });

    it('shows Disk threshold sliders', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('disk-high-slider')).toBeInTheDocument();
        expect(screen.getByTestId('disk-critical-slider')).toBeInTheDocument();
      });
    });

    it('shows server offline timeout input', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('offline-timeout-input')).toBeInTheDocument();
      });
    });

    it('shows save thresholds button', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('save-thresholds-button')).toBeInTheDocument();
      });
    });

    it('saves thresholds on button click', async () => {
      mockUpdateThresholds.mockResolvedValue({ thresholds: mockThresholds });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('save-thresholds-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-thresholds-button'));

      await waitFor(() => {
        expect(mockUpdateThresholds).toHaveBeenCalled();
      });
    });

    it('shows success message after saving thresholds', async () => {
      mockUpdateThresholds.mockResolvedValue({ thresholds: mockThresholds });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('save-thresholds-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-thresholds-button'));

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument();
        expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
      });
    });

    it('shows error toast when save fails', async () => {
      mockUpdateThresholds.mockRejectedValue(new Error('Save failed'));

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('save-thresholds-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-thresholds-button'));

      await waitFor(() => {
        expect(screen.getByTestId('error-toast')).toBeInTheDocument();
      });
    });

    it('updates CPU high threshold on slider change', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('cpu-high-slider')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('cpu-high-slider'), { target: { value: '85' } });

      // Slider should reflect new value
      expect(screen.getByTestId('cpu-high-slider')).toHaveValue('85');
    });

    it('updates server offline timeout on input change', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('offline-timeout-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('offline-timeout-input'), { target: { value: '120' } });

      expect(screen.getByTestId('offline-timeout-input')).toHaveValue(120);
    });
  });

  describe('Duration selector', () => {
    it('shows duration buttons for CPU', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('cpu-duration-60')).toBeInTheDocument();
        expect(screen.getByTestId('cpu-duration-180')).toBeInTheDocument();
        expect(screen.getByTestId('cpu-duration-300')).toBeInTheDocument();
      });
    });

    it('changes CPU duration on button click', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('cpu-duration-300')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cpu-duration-300'));

      // The 5 min (300s) button should now be selected
      expect(screen.getByTestId('cpu-duration-300')).toHaveClass('bg-status-info');
    });
  });

  describe('Cooldowns card', () => {
    it('renders cooldowns card', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('cooldowns-card')).toBeInTheDocument();
      });
    });

    it('shows critical cooldown input', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('critical-cooldown-input')).toBeInTheDocument();
      });
    });

    it('shows high cooldown input', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('high-cooldown-input')).toBeInTheDocument();
      });
    });

    it('shows notify on remediation checkbox', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('notify-remediation-checkbox')).toBeInTheDocument();
      });
    });

    it('updates critical cooldown on input change', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('critical-cooldown-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('critical-cooldown-input'), { target: { value: '10' } });

      expect(screen.getByTestId('critical-cooldown-input')).toHaveValue(10);
    });

    it('toggles notify on remediation', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('notify-remediation-checkbox')).toBeInTheDocument();
      });

      const checkbox = screen.getByTestId('notify-remediation-checkbox') as HTMLInputElement;
      const initialState = checkbox.checked;

      fireEvent.click(checkbox);

      expect(checkbox.checked).toBe(!initialState);
    });
  });

  describe('Notifications card', () => {
    it('renders notifications card', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('notifications-card')).toBeInTheDocument();
      });
    });

    it('shows Slack webhook URL input', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('slack-webhook-input')).toBeInTheDocument();
      });
    });

    it('shows notify critical checkbox', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('notify-critical-checkbox')).toBeInTheDocument();
      });
    });

    it('shows notify high checkbox', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('notify-high-checkbox')).toBeInTheDocument();
      });
    });

    it('shows action notification checkboxes', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('notify-action-failure-checkbox')).toBeInTheDocument();
        expect(screen.getByTestId('notify-action-success-checkbox')).toBeInTheDocument();
      });
    });

    it('shows save notifications button', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('save-notifications-button')).toBeInTheDocument();
      });
    });

    it('saves notifications on button click', async () => {
      mockUpdateNotifications.mockResolvedValue({ notifications: mockNotifications });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('save-notifications-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-notifications-button'));

      await waitFor(() => {
        expect(mockUpdateNotifications).toHaveBeenCalled();
      });
    });

    it('shows success message after saving notifications', async () => {
      mockUpdateNotifications.mockResolvedValue({ notifications: mockNotifications });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('save-notifications-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-notifications-button'));

      await waitFor(() => {
        expect(screen.getByTestId('success-message')).toBeInTheDocument();
      });
    });
  });

  describe('Slack webhook testing', () => {
    it('shows test button when webhook URL is entered', async () => {
      mockGetConfig.mockResolvedValue({
        ...mockConfigResponse,
        notifications: {
          ...mockNotifications,
          slack_webhook_url: 'https://hooks.slack.com/services/abc',
        },
      });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('test-webhook-button')).toBeInTheDocument();
      });
    });

    it('hides test button when webhook URL is empty', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('slack-webhook-input')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('test-webhook-button')).not.toBeInTheDocument();
    });

    it('tests webhook on button click', async () => {
      mockGetConfig.mockResolvedValue({
        ...mockConfigResponse,
        notifications: {
          ...mockNotifications,
          slack_webhook_url: 'https://hooks.slack.com/services/abc',
        },
      });
      mockTestWebhook.mockResolvedValue({ success: true, message: 'Test sent!' });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('test-webhook-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-webhook-button'));

      await waitFor(() => {
        expect(mockTestWebhook).toHaveBeenCalledWith('https://hooks.slack.com/services/abc');
      });
    });

    it('shows test success result', async () => {
      mockGetConfig.mockResolvedValue({
        ...mockConfigResponse,
        notifications: {
          ...mockNotifications,
          slack_webhook_url: 'https://hooks.slack.com/services/abc',
        },
      });
      mockTestWebhook.mockResolvedValue({ success: true, message: 'Test message sent!' });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('test-webhook-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-webhook-button'));

      await waitFor(() => {
        expect(screen.getByTestId('test-result')).toBeInTheDocument();
        expect(screen.getByText(/Test message sent!/i)).toBeInTheDocument();
      });
    });

    it('shows test failure result', async () => {
      mockGetConfig.mockResolvedValue({
        ...mockConfigResponse,
        notifications: {
          ...mockNotifications,
          slack_webhook_url: 'https://hooks.slack.com/services/abc',
        },
      });
      mockTestWebhook.mockResolvedValue({ success: false, error: 'Invalid webhook URL' });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('test-webhook-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-webhook-button'));

      await waitFor(() => {
        expect(screen.getByTestId('test-result')).toBeInTheDocument();
        expect(screen.getByText(/Invalid webhook URL/i)).toBeInTheDocument();
      });
    });

    it('handles test API error', async () => {
      mockGetConfig.mockResolvedValue({
        ...mockConfigResponse,
        notifications: {
          ...mockNotifications,
          slack_webhook_url: 'https://hooks.slack.com/services/abc',
        },
      });
      mockTestWebhook.mockRejectedValue(new Error('Network error'));

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('test-webhook-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('test-webhook-button'));

      await waitFor(() => {
        expect(screen.getByTestId('test-result')).toBeInTheDocument();
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });

    it('clears test result when URL changes', async () => {
      mockGetConfig.mockResolvedValue({
        ...mockConfigResponse,
        notifications: {
          ...mockNotifications,
          slack_webhook_url: 'https://hooks.slack.com/services/abc',
        },
      });
      mockTestWebhook.mockResolvedValue({ success: true, message: 'Sent!' });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('test-webhook-button')).toBeInTheDocument();
      });

      // Test webhook
      fireEvent.click(screen.getByTestId('test-webhook-button'));
      await waitFor(() => {
        expect(screen.getByTestId('test-result')).toBeInTheDocument();
      });

      // Change URL
      fireEvent.change(screen.getByTestId('slack-webhook-input'), {
        target: { value: 'https://hooks.slack.com/services/xyz' },
      });

      // Test result should be cleared
      expect(screen.queryByTestId('test-result')).not.toBeInTheDocument();
    });
  });

  describe('Cost tracking card', () => {
    it('renders cost tracking card', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('cost-tracking-card')).toBeInTheDocument();
      });
    });

    it('shows current electricity rate', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByText(/£0.24\/kWh/i)).toBeInTheDocument();
      });
    });

    it('shows edit button', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });
    });

    it('opens cost settings dialog on edit click', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-dialog')).toBeInTheDocument();
      });
    });

    it('saves cost config from dialog', async () => {
      mockUpdateCostConfig.mockResolvedValue({
        ...mockCostConfig,
        electricity_rate: 0.30,
      });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-edit-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('cost-settings-edit-button'));

      await waitFor(() => {
        expect(screen.getByTestId('cost-settings-dialog')).toBeInTheDocument();
      });

      // Click save in dialog
      fireEvent.click(screen.getByText('Save'));

      await waitFor(() => {
        expect(mockUpdateCostConfig).toHaveBeenCalledWith({ electricity_rate: 0.30 });
      });
    });
  });

  describe('Child components', () => {
    it('renders connectivity settings', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('connectivity-settings')).toBeInTheDocument();
      });
    });

    it('renders tailscale settings', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('tailscale-settings')).toBeInTheDocument();
      });
    });

    it('renders SSH key manager', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('ssh-key-manager')).toBeInTheDocument();
      });
    });
  });

  describe('Back navigation', () => {
    it('has back button', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
    });

    it('navigates to dashboard on back click', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('back-button'));

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Form state management', () => {
    it('toggles notify on critical checkbox', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('notify-critical-checkbox')).toBeInTheDocument();
      });

      const checkbox = screen.getByTestId('notify-critical-checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it('toggles notify on high checkbox', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('notify-high-checkbox')).toBeInTheDocument();
      });

      const checkbox = screen.getByTestId('notify-high-checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it('toggles notify on action failure checkbox', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('notify-action-failure-checkbox')).toBeInTheDocument();
      });

      const checkbox = screen.getByTestId('notify-action-failure-checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it('toggles notify on action success checkbox', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('notify-action-success-checkbox')).toBeInTheDocument();
      });

      const checkbox = screen.getByTestId('notify-action-success-checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('Concurrent fetch handling', () => {
    it('fetches both config and cost config on mount', async () => {
      renderSettings();

      await waitFor(() => {
        expect(mockGetConfig).toHaveBeenCalled();
        expect(mockGetCostConfig).toHaveBeenCalled();
      });
    });

    it('handles cost config fetch failure gracefully', async () => {
      mockGetCostConfig.mockRejectedValue(new Error('Failed'));

      renderSettings();

      // Should still render with default cost config
      await waitFor(() => {
        expect(screen.getByTestId('thresholds-card')).toBeInTheDocument();
      });
    });
  });

  describe('Saving state', () => {
    it('disables sliders while saving', async () => {
      mockUpdateThresholds.mockImplementation(() => new Promise(() => {}));

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('save-thresholds-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-thresholds-button'));

      // Sliders should be disabled
      expect(screen.getByTestId('cpu-high-slider')).toBeDisabled();
    });

    it('shows Saving... text on button while saving', async () => {
      mockUpdateThresholds.mockImplementation(() => new Promise(() => {}));

      renderSettings();

      await waitFor(() => {
        expect(screen.getByTestId('save-thresholds-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('save-thresholds-button'));

      expect(screen.getByTestId('save-thresholds-button')).toHaveTextContent('Saving...');
    });
  });
});
