import { api } from './client';
import type {
  ConfigResponse,
  ThresholdsUpdate,
  ThresholdsResponse,
  NotificationsUpdate,
  NotificationsResponse,
  TestWebhookResponse,
} from '../types/config';

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
