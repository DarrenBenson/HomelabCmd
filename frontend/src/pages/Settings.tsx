import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { getConfig, updateThresholds, updateNotifications, testWebhook } from '../api/config';
import { getCostConfig, updateCostConfig } from '../api/costs';
import { CostSettingsDialog } from '../components/CostSettingsDialog';
import { ConnectivitySettings } from '../components/ConnectivitySettings';
import { SSHKeyManager } from '../components/SSHKeyManager';
import { TailscaleSettings } from '../components/TailscaleSettings';
// TailscaleSSHSettings removed per US0093 - unified SSH key management
// All SSH keys now managed by SSHKeyManager component
import type {
  ThresholdsConfig,
  NotificationsConfig,
  ThresholdsUpdate,
  NotificationsUpdate,
  MetricThreshold,
} from '../types/config';
import type { CostConfig, CostConfigUpdate } from '../types/cost';
import { DURATION_OPTIONS, DEFAULT_THRESHOLDS, DEFAULT_NOTIFICATIONS } from '../types/config';

/**
 * Duration selector component for sustained threshold settings.
 */
function DurationSelector({
  value,
  onChange,
  disabled,
  testId,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {DURATION_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          disabled={disabled}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            value === option.value
              ? 'bg-status-info text-white'
              : 'bg-bg-tertiary text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
          } disabled:cursor-not-allowed disabled:opacity-50`}
          data-testid={`${testId}-${option.value}`}
        >
          {option.label}
          {'recommended' in option && option.recommended && (
            <span className="ml-1 text-xs opacity-75">*</span>
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * Metric card component for displaying and editing a single metric's thresholds.
 */
function MetricCard({
  label,
  icon,
  metric,
  showDuration,
  durationNote,
  onChange,
  saving,
  testIdPrefix,
}: {
  label: string;
  icon: React.ReactNode;
  metric: MetricThreshold;
  showDuration: boolean;
  durationNote?: string;
  onChange: (updates: Partial<MetricThreshold>) => void;
  saving: boolean;
  testIdPrefix: string;
}) {
  return (
    <div className="rounded-lg border border-border-default bg-bg-tertiary p-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-secondary text-text-secondary">
          {icon}
        </div>
        <span className="font-medium text-text-primary">{label}</span>
      </div>

      {/* High threshold slider */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm text-text-secondary">High</label>
          <span className="font-mono text-sm text-status-warning">
            {metric.high_percent}%
          </span>
        </div>
        <input
          type="range"
          min="50"
          max="99"
          value={metric.high_percent}
          onChange={(e) => onChange({ high_percent: Number(e.target.value) })}
          disabled={saving}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-bg-secondary accent-status-warning"
          data-testid={`${testIdPrefix}-high-slider`}
        />
      </div>

      {/* Critical threshold slider */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm text-text-secondary">Critical</label>
          <span className="font-mono text-sm text-status-error">
            {metric.critical_percent}%
          </span>
        </div>
        <input
          type="range"
          min={metric.high_percent + 1}
          max="100"
          value={metric.critical_percent}
          onChange={(e) => onChange({ critical_percent: Number(e.target.value) })}
          disabled={saving}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-bg-secondary accent-status-error"
          data-testid={`${testIdPrefix}-critical-slider`}
        />
      </div>

      {/* Duration selector (for CPU/Memory) */}
      {showDuration && (
        <div>
          <label className="mb-2 block text-sm text-text-secondary">Duration</label>
          <DurationSelector
            value={metric.sustained_heartbeats}
            onChange={(value) => onChange({ sustained_heartbeats: value })}
            disabled={saving}
            testId={`${testIdPrefix}-duration`}
          />
          {durationNote && (
            <p className="mt-2 text-xs text-text-tertiary">{durationNote}</p>
          )}
        </div>
      )}

      {/* Duration note for Disk (no selector) */}
      {!showDuration && durationNote && (
        <p className="text-xs text-text-tertiary">{durationNote}</p>
      )}
    </div>
  );
}

export function Settings() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // Form state
  const [thresholds, setThresholds] = useState<ThresholdsConfig>(DEFAULT_THRESHOLDS);
  const [notifications, setNotifications] = useState<NotificationsConfig>(DEFAULT_NOTIFICATIONS);

  // Cost config state
  const [costConfig, setCostConfig] = useState<CostConfig>({
    electricity_rate: 0.24,
    currency_symbol: '£',
    updated_at: null,
  });

  // Webhook test state
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Cost settings dialog state
  const [costDialogOpen, setCostDialogOpen] = useState(false);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const [config, costConfigData] = await Promise.all([
          getConfig(),
          getCostConfig(),
        ]);
        setThresholds(config.thresholds);
        setNotifications(config.notifications);
        setCostConfig(costConfigData);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  const handleBack = () => {
    navigate('/');
  };

  const updateMetric = (
    metricKey: 'cpu' | 'memory' | 'disk',
    updates: Partial<MetricThreshold>
  ) => {
    setThresholds((prev) => ({
      ...prev,
      [metricKey]: { ...prev[metricKey], ...updates },
    }));
  };

  const handleSaveThresholds = async () => {
    setSaving(true);
    setSaveSuccess(null);
    setError(null);

    try {
      const update: ThresholdsUpdate = {
        cpu: thresholds.cpu,
        memory: thresholds.memory,
        disk: thresholds.disk,
        server_offline_seconds: thresholds.server_offline_seconds,
      };
      const response = await updateThresholds(update);
      setThresholds(response.thresholds);
      setSaveSuccess('Alert thresholds saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save thresholds');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    setSaveSuccess(null);
    setError(null);

    try {
      const update: NotificationsUpdate = {
        slack_webhook_url: notifications.slack_webhook_url,
        cooldowns: notifications.cooldowns,
        notify_on_critical: notifications.notify_on_critical,
        notify_on_high: notifications.notify_on_high,
        notify_on_remediation: notifications.notify_on_remediation,
        notify_on_action_failure: notifications.notify_on_action_failure,
        notify_on_action_success: notifications.notify_on_action_success,
      };
      const response = await updateNotifications(update);
      setNotifications(response.notifications);
      setSaveSuccess('Notification settings saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCostConfig = async (update: CostConfigUpdate) => {
    setSaving(true);
    setSaveSuccess(null);
    setError(null);

    try {
      const response = await updateCostConfig(update);
      setCostConfig(response);
      setSaveSuccess('Cost tracking settings saved successfully');
      setCostDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cost settings');
      // Don't close dialog on error - user can retry or cancel
    } finally {
      setSaving(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!notifications.slack_webhook_url.trim()) return;

    setTesting(true);
    setTestResult(null);

    try {
      const response = await testWebhook(notifications.slack_webhook_url);
      setTestResult({
        success: response.success,
        message: response.success
          ? response.message || 'Test message sent!'
          : response.error || 'Test failed',
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-center py-20">
            <div
              className="h-8 w-8 animate-spin rounded-full border-2 border-text-muted border-t-status-info"
              data-testid="loading-spinner"
            />
          </div>
        </div>
      </div>
    );
  }

  // Error state (no cached data)
  if (error && !thresholds) {
    return (
      <div className="min-h-screen bg-bg-primary p-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col items-center justify-center py-20">
            <p className="mb-4 text-status-error" data-testid="error-message">
              {error}
            </p>
            <div className="flex gap-4">
              <button
                onClick={handleBack}
                className="rounded-md bg-bg-secondary px-4 py-2 text-text-primary hover:bg-bg-tertiary"
                data-testid="back-button"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => window.location.reload()}
                className="rounded-md bg-status-info px-4 py-2 text-white hover:bg-status-info/80"
                data-testid="retry-button"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // CPU icon
  const CpuIcon = (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2zm4 4h6v6H9V9z" />
    </svg>
  );

  // Memory icon
  const MemoryIcon = (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  );

  // Disk icon
  const DiskIcon = (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7C5 4 4 5 4 7zm0 5h16M8 12v4m4-4v4m4-4v4" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-bg-primary p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
              data-testid="back-button"
              aria-label="Back to dashboard"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>
            <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
          </div>
        </header>

        {/* Success/Error messages */}
        {saveSuccess && (
          <div
            className="mb-6 rounded-md border border-status-success/30 bg-status-success/10 p-4 text-status-success"
            data-testid="success-message"
          >
            {saveSuccess}
          </div>
        )}

        {error && thresholds && (
          <div
            className="mb-6 rounded-md border border-status-error/30 bg-status-error/10 p-4 text-status-error"
            data-testid="error-toast"
          >
            {error}
          </div>
        )}

        {/* Resource Alerts Section */}
        <section
          className="mb-6 rounded-lg border border-border-default bg-bg-secondary p-6"
          data-testid="thresholds-card"
        >
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            Resource Alerts
          </h2>
          <p className="mb-6 text-sm text-text-secondary">
            Configure when alerts are triggered based on resource utilisation.
          </p>

          {/* Metric cards grid */}
          <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label="CPU"
              icon={CpuIcon}
              metric={thresholds.cpu}
              showDuration={true}
              durationNote="* Recommended - brief spikes are normal"
              onChange={(updates) => updateMetric('cpu', updates)}
              saving={saving}
              testIdPrefix="cpu"
            />

            <MetricCard
              label="Memory"
              icon={MemoryIcon}
              metric={thresholds.memory}
              showDuration={true}
              durationNote="* Recommended - cache spikes are normal"
              onChange={(updates) => updateMetric('memory', updates)}
              saving={saving}
              testIdPrefix="memory"
            />

            <MetricCard
              label="Disk"
              icon={DiskIcon}
              metric={thresholds.disk}
              showDuration={false}
              durationNote="Alerts immediately - disk issues don't self-resolve"
              onChange={(updates) => updateMetric('disk', updates)}
              saving={saving}
              testIdPrefix="disk"
            />
          </div>

          {/* Server Offline Timeout */}
          <div className="mb-6 rounded-lg border border-border-default bg-bg-tertiary p-4">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-bg-secondary text-text-secondary">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 5.636a9 9 0 11-12.728 0M12 9v4m0 4h.01" />
                </svg>
              </div>
              <span className="font-medium text-text-primary">Server Offline</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-text-secondary">Alert after:</label>
              <input
                type="number"
                min="30"
                max="600"
                value={thresholds.server_offline_seconds}
                onChange={(e) =>
                  setThresholds((prev) => ({
                    ...prev,
                    server_offline_seconds: Number(e.target.value),
                  }))
                }
                disabled={saving}
                className="w-20 rounded-md border border-border-default bg-bg-secondary px-2 py-1 font-mono text-sm text-text-primary focus:border-status-info focus:outline-none"
                data-testid="offline-timeout-input"
              />
              <span className="text-sm text-text-secondary">seconds</span>
            </div>
            <p className="mt-2 text-xs text-text-tertiary">
              Approximately {Math.round(thresholds.server_offline_seconds / 60)} missed heartbeats
            </p>
          </div>

          <button
            onClick={handleSaveThresholds}
            disabled={saving}
            className="rounded-md bg-status-info px-4 py-2 font-medium text-white hover:bg-status-info/80 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="save-thresholds-button"
          >
            {saving ? 'Saving...' : 'Save Alert Settings'}
          </button>
        </section>

        {/* Notification Frequency Section */}
        <section
          className="mb-6 rounded-lg border border-border-default bg-bg-secondary p-6"
          data-testid="cooldowns-card"
        >
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            Notification Frequency
          </h2>
          <p className="mb-6 text-sm text-text-secondary">
            How often to remind you about ongoing issues.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <label className="w-24 text-sm text-text-primary">Critical:</label>
              <span className="text-sm text-text-secondary">every</span>
              <input
                type="number"
                min="5"
                max="1440"
                value={notifications.cooldowns.critical_minutes}
                onChange={(e) =>
                  setNotifications((prev) => ({
                    ...prev,
                    cooldowns: {
                      ...prev.cooldowns,
                      critical_minutes: Number(e.target.value),
                    },
                  }))
                }
                disabled={saving}
                className="w-20 rounded-md border border-border-default bg-bg-tertiary px-2 py-1 font-mono text-sm text-text-primary focus:border-status-info focus:outline-none"
                data-testid="critical-cooldown-input"
              />
              <span className="text-sm text-text-secondary">minutes</span>
            </div>

            <div className="flex items-center gap-3">
              <label className="w-24 text-sm text-text-primary">High:</label>
              <span className="text-sm text-text-secondary">every</span>
              <input
                type="number"
                min="15"
                max="1440"
                value={notifications.cooldowns.high_minutes}
                onChange={(e) =>
                  setNotifications((prev) => ({
                    ...prev,
                    cooldowns: {
                      ...prev.cooldowns,
                      high_minutes: Number(e.target.value),
                    },
                  }))
                }
                disabled={saving}
                className="w-20 rounded-md border border-border-default bg-bg-tertiary px-2 py-1 font-mono text-sm text-text-primary focus:border-status-info focus:outline-none"
                data-testid="high-cooldown-input"
              />
              <span className="text-sm text-text-secondary">minutes</span>
              <span className="text-xs text-text-tertiary">
                ({Math.round(notifications.cooldowns.high_minutes / 60)} hours)
              </span>
            </div>

            <label className="flex items-center gap-3 border-t border-border-default pt-4">
              <input
                type="checkbox"
                checked={notifications.notify_on_remediation}
                onChange={(e) =>
                  setNotifications((prev) => ({
                    ...prev,
                    notify_on_remediation: e.target.checked,
                  }))
                }
                disabled={saving}
                className="h-4 w-4 rounded border-border-default bg-bg-tertiary text-status-success focus:ring-status-success"
                data-testid="notify-remediation-checkbox"
              />
              <span className="text-text-primary">Notify when issues resolve</span>
            </label>
          </div>
        </section>

        {/* Slack Integration Section */}
        <section
          className="rounded-lg border border-border-default bg-bg-secondary p-6"
          data-testid="notifications-card"
        >
          <h2 className="mb-2 text-lg font-semibold text-text-primary">
            Slack Integration
          </h2>
          <p className="mb-6 text-sm text-text-secondary">
            Receive notifications in Slack when alerts are triggered.
          </p>

          <div className="space-y-6">
            {/* Slack Webhook URL with Test button */}
            <div>
              <label className="mb-2 block text-sm font-medium text-text-primary">
                Webhook URL
              </label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={notifications.slack_webhook_url}
                  onChange={(e) => {
                    setNotifications((prev) => ({
                      ...prev,
                      slack_webhook_url: e.target.value,
                    }));
                    // Clear test result when URL changes
                    setTestResult(null);
                  }}
                  placeholder="https://hooks.slack.com/services/..."
                  disabled={saving}
                  className="flex-1 rounded-md border border-border-default bg-bg-tertiary px-3 py-2 font-mono text-sm text-text-primary placeholder-text-tertiary focus:border-status-info focus:outline-none focus:ring-1 focus:ring-status-info"
                  data-testid="slack-webhook-input"
                />
                {notifications.slack_webhook_url.trim() && (
                  <button
                    type="button"
                    onClick={handleTestWebhook}
                    disabled={testing || saving}
                    className="rounded-md bg-bg-tertiary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid="test-webhook-button"
                  >
                    {testing ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-text-muted border-t-status-info" />
                        Testing...
                      </span>
                    ) : (
                      'Test'
                    )}
                  </button>
                )}
              </div>
              <p className="mt-1 text-sm text-text-tertiary">
                Leave empty to disable Slack notifications.
              </p>

              {/* Test result feedback */}
              {testResult && (
                <div
                  className={`mt-2 rounded-md border p-2 text-sm ${
                    testResult.success
                      ? 'border-status-success/30 bg-status-success/10 text-status-success'
                      : 'border-status-error/30 bg-status-error/10 text-status-error'
                  }`}
                  data-testid="test-result"
                >
                  {testResult.message}
                </div>
              )}
            </div>

            {/* Notification Toggles (Critical/High only - no Medium/Low) */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-text-primary">
                Send notifications for:
              </p>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notifications.notify_on_critical}
                    onChange={(e) =>
                      setNotifications((prev) => ({
                        ...prev,
                        notify_on_critical: e.target.checked,
                      }))
                    }
                    disabled={saving}
                    className="h-4 w-4 rounded border-border-default bg-bg-tertiary text-status-error focus:ring-status-error"
                    data-testid="notify-critical-checkbox"
                  />
                  <span className="text-text-primary">Critical alerts</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notifications.notify_on_high}
                    onChange={(e) =>
                      setNotifications((prev) => ({
                        ...prev,
                        notify_on_high: e.target.checked,
                      }))
                    }
                    disabled={saving}
                    className="h-4 w-4 rounded border-border-default bg-bg-tertiary text-status-warning focus:ring-status-warning"
                    data-testid="notify-high-checkbox"
                  />
                  <span className="text-text-primary">High alerts</span>
                </label>
              </div>
            </div>

            {/* Action Notification Toggles (US0032) */}
            <div className="space-y-3 border-t border-border-default pt-4">
              <p className="text-sm font-medium text-text-primary">
                Action notifications:
              </p>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notifications.notify_on_action_failure}
                    onChange={(e) =>
                      setNotifications((prev) => ({
                        ...prev,
                        notify_on_action_failure: e.target.checked,
                      }))
                    }
                    disabled={saving}
                    className="h-4 w-4 rounded border-border-default bg-bg-tertiary text-status-error focus:ring-status-error"
                    data-testid="notify-action-failure-checkbox"
                  />
                  <span className="text-text-primary">Failed actions</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={notifications.notify_on_action_success}
                    onChange={(e) =>
                      setNotifications((prev) => ({
                        ...prev,
                        notify_on_action_success: e.target.checked,
                      }))
                    }
                    disabled={saving}
                    className="h-4 w-4 rounded border-border-default bg-bg-tertiary text-status-success focus:ring-status-success"
                    data-testid="notify-action-success-checkbox"
                  />
                  <span className="text-text-primary">Successful actions</span>
                </label>
              </div>

              <p className="text-xs text-text-tertiary">
                Get notified when remediation actions complete or fail.
              </p>
            </div>

            <button
              onClick={handleSaveNotifications}
              disabled={saving}
              className="rounded-md bg-status-info px-4 py-2 font-medium text-white hover:bg-status-info/80 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="save-notifications-button"
            >
              {saving ? 'Saving...' : 'Save Notification Settings'}
            </button>
          </div>
        </section>

        {/* Cost Tracking Section */}
        <section
          className="mt-6 rounded-lg border border-border-default bg-bg-secondary p-6"
          data-testid="cost-tracking-card"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-status-warning/20 text-status-warning">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  Cost Tracking
                </h2>
                <p className="text-sm text-text-secondary">
                  Current rate: {costConfig.currency_symbol}{costConfig.electricity_rate.toFixed(2)}/kWh
                </p>
              </div>
            </div>
            <button
              onClick={() => setCostDialogOpen(true)}
              className="rounded-md bg-bg-tertiary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-secondary"
              data-testid="cost-settings-edit-button"
            >
              Edit
            </button>
          </div>
        </section>

        {/* Connectivity Mode Section - US0080: Connectivity Mode Management */}
        <div className="mt-6">
          <ConnectivitySettings />
        </div>

        {/* Tailscale API Section - EP0008: Tailscale Integration */}
        <div className="mt-6">
          <TailscaleSettings />
        </div>

        {/* SSH Key Manager Section - US0071, US0093: Unified SSH Key Management
            Replaces separate TailscaleSSHSettings component. All SSH keys
            (for scanning, Tailscale agent install, etc.) are managed here. */}
        <div className="mt-6">
          <SSHKeyManager />
        </div>
      </div>

      {/* Cost Settings Dialog */}
      {costDialogOpen && (
        <CostSettingsDialog
          config={costConfig}
          onSave={handleSaveCostConfig}
          onCancel={() => setCostDialogOpen(false)}
          isLoading={saving}
        />
      )}
    </div>
  );
}
