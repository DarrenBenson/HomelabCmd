import { api } from './client';
import type {
  ConfigResponse,
  ThresholdsUpdate,
  ThresholdsResponse,
  NotificationsUpdate,
  NotificationsResponse,
  TestWebhookResponse,
} from '../types/config';
import type { ActionTimeoutConfig } from '../types/action';

export async function getConfig(): Promise<ConfigResponse> {
  return api.get<ConfigResponse>('/api/v1/config');
}

export async function updateThresholds(
  update: ThresholdsUpdate
): Promise<ThresholdsResponse> {
  return api.put<ThresholdsResponse>('/api/v1/config/thresholds', update);
}

export async function updateNotifications(
  update: NotificationsUpdate
): Promise<NotificationsResponse> {
  return api.put<NotificationsResponse>('/api/v1/config/notifications', update);
}

export async function testWebhook(
  webhookUrl: string
): Promise<TestWebhookResponse> {
  return api.post<TestWebhookResponse>('/api/v1/config/test-webhook', {
    webhook_url: webhookUrl,
  });
}

// US0186: Action timeout configuration
export async function getActionTimeouts(): Promise<ActionTimeoutConfig> {
  return api.get<ActionTimeoutConfig>('/api/v1/config/action-timeouts');
}

export async function updateActionTimeouts(
  update: Partial<Omit<ActionTimeoutConfig, 'updated_at'>>
): Promise<ActionTimeoutConfig> {
  return api.put<ActionTimeoutConfig>('/api/v1/config/action-timeouts', update);
}
