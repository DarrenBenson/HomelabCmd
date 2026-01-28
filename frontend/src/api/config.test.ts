import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getConfig, updateThresholds, updateNotifications, testWebhook } from './config';
import { api } from './client';
import type {
  ConfigResponse,
  ThresholdsResponse,
  NotificationsResponse,
  TestWebhookResponse,
} from '../types/config';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Config API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConfig', () => {
    const mockConfigResponse: ConfigResponse = {
      thresholds: {
        cpu_warning: 70,
        cpu_critical: 90,
        memory_warning: 75,
        memory_critical: 95,
        disk_warning: 80,
        disk_critical: 95,
      },
      notifications: {
        email_enabled: true,
        email_address: 'admin@example.com',
        webhook_enabled: false,
        webhook_url: null,
      },
    };

    it('calls GET /api/v1/config endpoint', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfigResponse);

      await getConfig();

      expect(api.get).toHaveBeenCalledWith('/api/v1/config');
    });

    it('returns ConfigResponse shape', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockConfigResponse);

      const result = await getConfig();

      expect(result).toEqual(mockConfigResponse);
      expect(result.thresholds.cpu_warning).toBe(70);
      expect(result.notifications.email_enabled).toBe(true);
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('Network error');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getConfig()).rejects.toThrow('Network error');
    });
  });

  describe('updateThresholds', () => {
    const mockThresholdsResponse: ThresholdsResponse = {
      updated_fields: ['cpu_warning', 'cpu_critical'],
      thresholds: {
        cpu_warning: 80,
        cpu_critical: 95,
        memory_warning: 75,
        memory_critical: 95,
        disk_warning: 80,
        disk_critical: 95,
      },
    };

    it('calls PUT /api/v1/config/thresholds endpoint', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockThresholdsResponse);

      await updateThresholds({ cpu_warning: 80, cpu_critical: 95 });

      expect(api.put).toHaveBeenCalledWith('/api/v1/config/thresholds', {
        cpu_warning: 80,
        cpu_critical: 95,
      });
    });

    it('returns ThresholdsResponse shape', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockThresholdsResponse);

      const result = await updateThresholds({ cpu_warning: 80 });

      expect(result).toEqual(mockThresholdsResponse);
      expect(result.updated_fields).toContain('cpu_warning');
      expect(result.thresholds.cpu_warning).toBe(80);
    });

    it('propagates errors from api.put', async () => {
      const error = new Error('Validation error');
      (api.put as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(updateThresholds({ cpu_warning: -1 })).rejects.toThrow('Validation error');
    });
  });

  describe('updateNotifications', () => {
    const mockNotificationsResponse: NotificationsResponse = {
      updated_fields: ['email_enabled', 'email_address'],
      notifications: {
        email_enabled: true,
        email_address: 'newadmin@example.com',
        webhook_enabled: false,
        webhook_url: null,
      },
    };

    it('calls PUT /api/v1/config/notifications endpoint', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockNotificationsResponse);

      await updateNotifications({ email_enabled: true, email_address: 'newadmin@example.com' });

      expect(api.put).toHaveBeenCalledWith('/api/v1/config/notifications', {
        email_enabled: true,
        email_address: 'newadmin@example.com',
      });
    });

    it('returns NotificationsResponse shape', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockNotificationsResponse);

      const result = await updateNotifications({ email_enabled: true });

      expect(result).toEqual(mockNotificationsResponse);
      expect(result.updated_fields).toContain('email_enabled');
      expect(result.notifications.email_enabled).toBe(true);
    });

    it('propagates errors from api.put', async () => {
      const error = new Error('Invalid email');
      (api.put as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(updateNotifications({ email_address: 'invalid' })).rejects.toThrow(
        'Invalid email'
      );
    });
  });

  describe('testWebhook', () => {
    const mockTestWebhookResponse: TestWebhookResponse = {
      success: true,
      message: 'Webhook test successful',
      status_code: 200,
    };

    it('calls POST /api/v1/config/test-webhook endpoint', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockTestWebhookResponse);

      await testWebhook('https://example.com/webhook');

      expect(api.post).toHaveBeenCalledWith('/api/v1/config/test-webhook', {
        webhook_url: 'https://example.com/webhook',
      });
    });

    it('returns TestWebhookResponse shape on success', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockTestWebhookResponse);

      const result = await testWebhook('https://example.com/webhook');

      expect(result).toEqual(mockTestWebhookResponse);
      expect(result.success).toBe(true);
      expect(result.status_code).toBe(200);
    });

    it('returns TestWebhookResponse shape on webhook failure', async () => {
      const failureResponse: TestWebhookResponse = {
        success: false,
        message: 'Connection refused',
        status_code: null,
      };
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(failureResponse);

      const result = await testWebhook('https://invalid-url.com/webhook');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection refused');
    });

    it('propagates errors from api.post', async () => {
      const error = new Error('Network error');
      (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(testWebhook('https://example.com/webhook')).rejects.toThrow('Network error');
    });
  });
});
