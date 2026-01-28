import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServerServices, restartService } from './services';
import { api } from './client';
import type { ServicesResponse, RestartActionResponse } from '../types/service';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Services API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServerServices', () => {
    const mockServicesResponse: ServicesResponse = {
      services: [
        {
          name: 'nginx',
          status: 'running',
          is_expected: true,
        },
        {
          name: 'postgresql',
          status: 'stopped',
          is_expected: true,
        },
        {
          name: 'redis',
          status: 'running',
          is_expected: false,
        },
      ],
    };

    it('calls GET /api/v1/servers/{serverId}/services endpoint', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockServicesResponse);

      await getServerServices('server-1');

      expect(api.get).toHaveBeenCalledWith('/api/v1/servers/server-1/services');
    });

    it('returns ServicesResponse shape', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockServicesResponse);

      const result = await getServerServices('server-1');

      expect(result).toEqual(mockServicesResponse);
      expect(result.services).toHaveLength(3);
    });

    it('returns services with different statuses', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockServicesResponse);

      const result = await getServerServices('server-1');

      expect(result.services[0].status).toBe('running');
      expect(result.services[1].status).toBe('stopped');
    });

    it('returns empty services array when no services', async () => {
      const emptyResponse: ServicesResponse = { services: [] };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(emptyResponse);

      const result = await getServerServices('server-1');

      expect(result.services).toEqual([]);
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('404 Not Found');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getServerServices('nonexistent')).rejects.toThrow('404 Not Found');
    });
  });

  describe('restartService', () => {
    const mockRestartResponse: RestartActionResponse = {
      action_id: 'action-123',
      status: 'queued',
      message: 'Service restart queued',
    };

    it('calls POST /api/v1/servers/{serverId}/services/{serviceName}/restart endpoint', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockRestartResponse);

      await restartService('server-1', 'nginx');

      expect(api.post).toHaveBeenCalledWith(
        '/api/v1/servers/server-1/services/nginx/restart',
        {}
      );
    });

    it('returns RestartActionResponse shape', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockRestartResponse);

      const result = await restartService('server-1', 'nginx');

      expect(result).toEqual(mockRestartResponse);
      expect(result.action_id).toBe('action-123');
      expect(result.status).toBe('queued');
    });

    it('handles pending status response', async () => {
      const pendingResponse: RestartActionResponse = {
        action_id: 'action-456',
        status: 'pending',
        message: 'Service restart in progress',
      };
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(pendingResponse);

      const result = await restartService('server-1', 'postgresql');

      expect(result.status).toBe('pending');
    });

    it('handles completed status response', async () => {
      const completedResponse: RestartActionResponse = {
        action_id: 'action-789',
        status: 'completed',
        message: 'Service restarted successfully',
      };
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(completedResponse);

      const result = await restartService('server-1', 'redis');

      expect(result.status).toBe('completed');
    });

    it('propagates errors from api.post', async () => {
      const error = new Error('Service not found');
      (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(restartService('server-1', 'unknown')).rejects.toThrow('Service not found');
    });

    it('encodes service name in URL', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockRestartResponse);

      await restartService('server-1', 'my-service');

      expect(api.post).toHaveBeenCalledWith(
        '/api/v1/servers/server-1/services/my-service/restart',
        {}
      );
    });
  });
});
