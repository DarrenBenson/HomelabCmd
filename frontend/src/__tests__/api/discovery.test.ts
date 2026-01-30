/**
 * Tests for discovery API client functions.
 *
 * Part of US0041: Network Discovery and US0069: Service Discovery.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  discoverServices,
  startDiscovery,
  getDiscovery,
  getDiscoverySettings,
  updateDiscoverySettings,
} from '../../api/discovery';
import { ApiError } from '../../api/client';
import type {
  ServiceDiscoveryRequest,
  ServiceDiscoveryResponse,
  DiscoveryRequest,
  DiscoveryResponse,
  DiscoverySettings,
  DiscoverySettingsUpdate,
} from '../../types/discovery';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock response data
const mockServiceDiscoveryResponse: ServiceDiscoveryResponse = {
  services: [
    { name: 'nginx', status: 'running', description: 'A high performance web server' },
    { name: 'postgresql', status: 'running', description: 'PostgreSQL RDBMS' },
  ],
  total: 2,
  filtered: 10,
};

const mockDiscoveryResponsePending: DiscoveryResponse = {
  discovery_id: 1,
  status: 'pending',
  subnet: '192.168.1.0/24',
  started_at: '2026-01-29T10:00:00Z',
  completed_at: null,
  progress: null,
  devices_found: 0,
  devices: null,
  error: null,
};

const mockDiscoveryResponseRunning: DiscoveryResponse = {
  discovery_id: 1,
  status: 'running',
  subnet: '192.168.1.0/24',
  started_at: '2026-01-29T10:00:00Z',
  completed_at: null,
  progress: {
    scanned: 128,
    total: 254,
    percent: 50,
  },
  devices_found: 5,
  devices: null,
  error: null,
};

const mockDiscoveryResponseCompleted: DiscoveryResponse = {
  discovery_id: 1,
  status: 'completed',
  subnet: '192.168.1.0/24',
  started_at: '2026-01-29T10:00:00Z',
  completed_at: '2026-01-29T10:01:30Z',
  progress: null,
  devices_found: 8,
  devices: [
    {
      ip: '192.168.1.1',
      hostname: 'router.local',
      response_time_ms: 5,
      is_monitored: false,
      ssh_auth_status: 'untested',
      ssh_auth_error: null,
      ssh_key_used: null,
    },
    {
      ip: '192.168.1.100',
      hostname: 'server1.local',
      response_time_ms: 2,
      is_monitored: true,
      ssh_auth_status: 'success',
      ssh_auth_error: null,
      ssh_key_used: 'default',
    },
  ],
  error: null,
};

const mockDiscoveryResponseFailed: DiscoveryResponse = {
  discovery_id: 1,
  status: 'failed',
  subnet: '192.168.1.0/24',
  started_at: '2026-01-29T10:00:00Z',
  completed_at: '2026-01-29T10:00:05Z',
  progress: null,
  devices_found: 0,
  devices: null,
  error: 'Network scan failed: permission denied',
};

const mockDiscoverySettings: DiscoverySettings = {
  default_subnet: '192.168.1.0/24',
  timeout_ms: 1000,
};

function createMockResponse<T>(data: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  } as Response;
}

function createMockErrorResponse(status: number, detail: string): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ detail }),
  } as Response;
}

describe('discovery API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('discoverServices', () => {
    it('returns service discovery response', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockServiceDiscoveryResponse));
      const request: ServiceDiscoveryRequest = {
        hostname: '192.168.1.100',
        port: 22,
        username: 'admin',
      };

      const result = await discoverServices(request);

      expect(result).toEqual(mockServiceDiscoveryResponse);
      expect(result.services).toHaveLength(2);
    });

    it('sends POST request without include_system by default', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockServiceDiscoveryResponse));
      const request: ServiceDiscoveryRequest = {
        hostname: '192.168.1.100',
      };

      await discoverServices(request);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/discovery/services',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(request),
        })
      );
    });

    it('adds include_system query parameter when true', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockServiceDiscoveryResponse));
      const request: ServiceDiscoveryRequest = {
        hostname: '192.168.1.100',
      };

      await discoverServices(request, true);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/discovery/services?include_system=true',
        expect.any(Object)
      );
    });

    it('includes key_id in request when provided', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockServiceDiscoveryResponse));
      const request: ServiceDiscoveryRequest = {
        hostname: '192.168.1.100',
        key_id: 'key-123',
      };

      await discoverServices(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(request),
        })
      );
    });

    it('throws ApiError on 400 SSH connection failed', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'SSH connection failed'));

      await expect(discoverServices({ hostname: 'invalid' })).rejects.toThrow(ApiError);
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(discoverServices({ hostname: '192.168.1.100' })).rejects.toThrow('Network error');
    });
  });

  describe('startDiscovery', () => {
    it('returns discovery response with pending status', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiscoveryResponsePending));

      const result = await startDiscovery();

      expect(result).toEqual(mockDiscoveryResponsePending);
      expect(result.status).toBe('pending');
      expect(result.discovery_id).toBe(1);
    });

    it('sends POST request with empty body when no request provided', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiscoveryResponsePending));

      await startDiscovery();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/discovery',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
    });

    it('sends POST request with subnet override', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiscoveryResponsePending));
      const request: DiscoveryRequest = {
        subnet: '10.0.0.0/24',
      };

      await startDiscovery(request);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/discovery',
        expect.objectContaining({
          body: JSON.stringify(request),
        })
      );
    });

    it('sends POST request with key_id', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiscoveryResponsePending));
      const request: DiscoveryRequest = {
        subnet: '192.168.1.0/24',
        key_id: 'key-abc',
      };

      await startDiscovery(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(request),
        })
      );
    });

    it('returns existing discovery if one is running', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiscoveryResponseRunning));

      const result = await startDiscovery();

      expect(result.status).toBe('running');
    });

    it('throws ApiError on 400 invalid subnet', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Invalid subnet format'));

      await expect(startDiscovery({ subnet: 'invalid' })).rejects.toThrow(ApiError);
    });
  });

  describe('getDiscovery', () => {
    it('returns running discovery with progress', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiscoveryResponseRunning));

      const result = await getDiscovery(1);

      expect(result.status).toBe('running');
      expect(result.progress).toBeDefined();
      expect(result.progress?.percent).toBe(50);
    });

    it('returns completed discovery with devices', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiscoveryResponseCompleted));

      const result = await getDiscovery(1);

      expect(result.status).toBe('completed');
      expect(result.devices).toHaveLength(2);
      expect(result.devices_found).toBe(8);
    });

    it('returns failed discovery with error message', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiscoveryResponseFailed));

      const result = await getDiscovery(1);

      expect(result.status).toBe('failed');
      expect(result.error).toContain('permission denied');
    });

    it('constructs correct URL with discovery ID', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiscoveryResponseCompleted));

      await getDiscovery(42);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/discovery/42',
        expect.any(Object)
      );
    });

    it('throws ApiError on 404 discovery not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Discovery not found'));

      await expect(getDiscovery(999)).rejects.toThrow(ApiError);
    });
  });

  describe('getDiscoverySettings', () => {
    it('returns discovery settings', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiscoverySettings));

      const result = await getDiscoverySettings();

      expect(result).toEqual(mockDiscoverySettings);
      expect(result.default_subnet).toBe('192.168.1.0/24');
      expect(result.timeout_ms).toBe(1000);
    });

    it('calls correct endpoint', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiscoverySettings));

      await getDiscoverySettings();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/settings/discovery',
        expect.any(Object)
      );
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(getDiscoverySettings()).rejects.toThrow('Network error');
    });
  });

  describe('updateDiscoverySettings', () => {
    it('returns updated settings', async () => {
      const updatedSettings: DiscoverySettings = {
        default_subnet: '10.0.0.0/24',
        timeout_ms: 2000,
      };
      mockFetch.mockResolvedValue(createMockResponse(updatedSettings));
      const update: DiscoverySettingsUpdate = {
        default_subnet: '10.0.0.0/24',
        timeout_ms: 2000,
      };

      const result = await updateDiscoverySettings(update);

      expect(result.default_subnet).toBe('10.0.0.0/24');
      expect(result.timeout_ms).toBe(2000);
    });

    it('sends PUT request with update data', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiscoverySettings));
      const update: DiscoverySettingsUpdate = {
        timeout_ms: 500,
      };

      await updateDiscoverySettings(update);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/settings/discovery',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(update),
        })
      );
    });

    it('allows partial updates', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiscoverySettings));
      const update: DiscoverySettingsUpdate = {
        default_subnet: '172.16.0.0/16',
      };

      await updateDiscoverySettings(update);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ default_subnet: '172.16.0.0/16' }),
        })
      );
    });

    it('throws ApiError on 400 invalid subnet format', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Invalid subnet format'));
      const update: DiscoverySettingsUpdate = {
        default_subnet: 'invalid',
      };

      await expect(updateDiscoverySettings(update)).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 400 timeout out of range', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Timeout must be between 100 and 5000'));
      const update: DiscoverySettingsUpdate = {
        timeout_ms: 10000,
      };

      await expect(updateDiscoverySettings(update)).rejects.toThrow(ApiError);
    });
  });
});
