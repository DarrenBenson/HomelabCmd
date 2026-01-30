/**
 * Configuration types for the alerting system.
 *
 * These types match the backend Pydantic schemas in:
 * src/homelab_cmd/api/schemas/config.py
 */

/**
 * Per-metric threshold configuration.
 *
 * Each metric (CPU, Memory, Disk) has:
 * - high_percent: threshold for HIGH severity alerts
 * - critical_percent: threshold for CRITICAL severity alerts
 * - sustained_seconds: time in seconds condition must persist before alerting
 *   (0 = immediate, 180 = 3 minutes)
 * - sustained_heartbeats: DEPRECATED - use sustained_seconds instead
 */
export interface MetricThreshold {
  high_percent: number;
  critical_percent: number;
  sustained_seconds: number;
  /** @deprecated Use sustained_seconds instead */
  sustained_heartbeats?: number;
}

/**
 * Partial update for a metric threshold (all fields optional).
 */
export interface MetricThresholdUpdate {
  high_percent?: number;
  critical_percent?: number;
  sustained_seconds?: number;
  /** @deprecated Use sustained_seconds instead */
  sustained_heartbeats?: number;
}

/**
 * Notification cooldown settings per severity.
 *
 * Controls how often reminders are sent for ongoing issues.
 */
export interface CooldownConfig {
  critical_minutes: number;
  high_minutes: number;
}

/**
 * Partial update for cooldown config (all fields optional).
 */
export interface CooldownConfigUpdate {
  critical_minutes?: number;
  high_minutes?: number;
}

/**
 * Full thresholds configuration.
 *
 * Contains per-metric threshold settings and server offline timeout.
 */
export interface ThresholdsConfig {
  cpu: MetricThreshold;
  memory: MetricThreshold;
  disk: MetricThreshold;
  server_offline_seconds: number;
}

/**
 * Partial update for thresholds (all fields optional).
 */
export interface ThresholdsUpdate {
  cpu?: MetricThresholdUpdate;
  memory?: MetricThresholdUpdate;
  disk?: MetricThresholdUpdate;
  server_offline_seconds?: number;
}

/**
 * Notification configuration.
 *
 * Contains Slack webhook settings and notification preferences.
 * Note: Medium/Low severities are intentionally excluded (no triggers defined).
 *
 * Action notifications (US0032):
 * - notify_on_action_failure: Send notification when action fails (default: true)
 * - notify_on_action_success: Send notification when action succeeds (default: false)
 *
 * Auto-resolve notifications (US0182):
 * - notify_on_auto_resolve: Send notification when alerts auto-resolve (default: true)
 */
export interface NotificationsConfig {
  slack_webhook_url: string;
  cooldowns: CooldownConfig;
  notify_on_critical: boolean;
  notify_on_high: boolean;
  notify_on_remediation: boolean;
  notify_on_action_failure: boolean;
  notify_on_action_success: boolean;
  notify_on_auto_resolve: boolean;
}

/**
 * Partial update for notifications (all fields optional).
 */
export interface NotificationsUpdate {
  slack_webhook_url?: string;
  cooldowns?: CooldownConfigUpdate;
  notify_on_critical?: boolean;
  notify_on_high?: boolean;
  notify_on_remediation?: boolean;
  notify_on_action_failure?: boolean;
  notify_on_action_success?: boolean;
  notify_on_auto_resolve?: boolean;
}

/**
 * Full configuration response from GET /api/v1/config.
 */
export interface ConfigResponse {
  thresholds: ThresholdsConfig;
  notifications: NotificationsConfig;
}

/**
 * Response from PUT /api/v1/config/thresholds.
 */
export interface ThresholdsResponse {
  updated: string[];
  thresholds: ThresholdsConfig;
}

/**
 * Response from PUT /api/v1/settings/notifications.
 */
export interface NotificationsResponse {
  updated: string[];
  notifications: NotificationsConfig;
}

/**
 * Response from POST /api/v1/config/test-webhook.
 */
export interface TestWebhookResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Duration options for sustained threshold settings.
 *
 * Maps user-friendly labels to seconds.
 */
export const DURATION_OPTIONS = [
  { label: 'Immediately', value: 0 },
  { label: '1 min', value: 60 },
  { label: '3 min', value: 180, recommended: true },
  { label: '5 min', value: 300 },
] as const;

/**
 * Default thresholds matching backend defaults.
 */
export const DEFAULT_THRESHOLDS: ThresholdsConfig = {
  cpu: { high_percent: 85, critical_percent: 95, sustained_seconds: 180 },
  memory: { high_percent: 85, critical_percent: 95, sustained_seconds: 180 },
  disk: { high_percent: 80, critical_percent: 95, sustained_seconds: 0 },
  server_offline_seconds: 180,
};

/**
 * Default notification settings matching backend defaults.
 */
export const DEFAULT_NOTIFICATIONS: NotificationsConfig = {
  slack_webhook_url: '',
  cooldowns: { critical_minutes: 30, high_minutes: 240 },
  notify_on_critical: true,
  notify_on_high: true,
  notify_on_remediation: true,
  notify_on_action_failure: true,
  notify_on_action_success: false,
  notify_on_auto_resolve: true,
};
