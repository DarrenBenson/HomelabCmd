/**
 * Tests for Tailscale API client functions.
 *
 * Part of EP0008: Tailscale Integration (US0076, US0077, US0078).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getTailscaleStatus,
  saveTailscaleToken,
  removeTailscaleToken,
  testTailscaleConnection,
  getTailscaleDevices,
  importTailscaleDevice,
  checkTailscaleImport,
} from '../../api/tailscale';
import { ApiError } from '../../api/client';
import type {
  TailscaleStatusResponse,
  TailscaleTokenResponse,
  TailscaleTestResponse,
  TailscaleDeviceListResponse,
  TailscaleImportResponse,
  TailscaleImportCheckResponse,
  TailscaleImportRequest,
} from '../../types/tailscale';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock response data
const mockStatusConfigured: TailscaleStatusResponse = {
  configured: true,
  masked_token: 'tskey-ap...abc123',
};

const mockStatusNotConfigured: TailscaleStatusResponse = {
  configured: false,
  masked_token: null,
};

const mockTokenResponse: TailscaleTokenResponse = {
  success: true,
  message: 'Token saved successfully',
};

const mockTestResponseSuccess: TailscaleTestResponse = {
  success: true,
  tailnet: 'my-tailnet.ts.net',
  device_count: 5,
  message: 'Connection successful',
  error: null,
  code: null,
};

const mockTestResponseFailure: TailscaleTestResponse = {
  success: false,
  tailnet: null,
  device_count: null,
  message: null,
  error: 'Invalid API token',
  code: 'UNAUTHORIZED',
};

const mockDeviceListResponse: TailscaleDeviceListResponse = {
  devices: [
    {
      id: 'device-1',
      name: 'my-server',
      hostname: 'my-server.tailnet.ts.net',
      tailscale_ip: '100.64.0.1',
      os: 'linux',
      os_version: 'Ubuntu 22.04',
      last_seen: '2026-01-29T10:00:00Z',
      online: true,
      authorized: true,
      already_imported: false,
      ssh_status: 'untested',
      ssh_error: null,
      ssh_key_used: null,
    },
    {
      id: 'device-2',
      name: 'workstation',
      hostname: 'workstation.tailnet.ts.net',
      tailscale_ip: '100.64.0.2',
      os: 'windows',
      os_version: 'Windows 11',
      last_seen: '2026-01-29T09:00:00Z',
      online: false,
      authorized: true,
      already_imported: true,
      ssh_status: 'unavailable',
      ssh_error: null,
      ssh_key_used: null,
    },
  ],
  count: 2,
  cache_hit: false,
  cached_at: null,
};

const mockEmptyDeviceListResponse: TailscaleDeviceListResponse = {
  devices: [],
  count: 0,
  cache_hit: false,
  cached_at: null,
};

const mockImportResponse: TailscaleImportResponse = {
  success: true,
  machine: {
    id: 'machine-uuid-123',
    server_id: 'my-server',
    display_name: 'My Server',
    tailscale_hostname: 'my-server.tailnet.ts.net',
    tailscale_device_id: 'device-1',
    machine_type: 'server',
    status: 'online',
    created_at: '2026-01-29T10:00:00Z',
  },
  message: 'Device imported successfully',
};

const mockImportCheckNotImported: TailscaleImportCheckResponse = {
  imported: false,
  machine_id: null,
  display_name: null,
  imported_at: null,
};

const mockImportCheckImported: TailscaleImportCheckResponse = {
  imported: true,
  machine_id: 'machine-uuid-123',
  display_name: 'My Server',
  imported_at: '2026-01-29T10:00:00Z',
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

describe('tailscale API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getTailscaleStatus', () => {
    it('returns configured status with masked token', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockStatusConfigured));

      const result = await getTailscaleStatus();

      expect(result).toEqual(mockStatusConfigured);
      expect(result.configured).toBe(true);
      expect(result.masked_token).toBe('tskey-ap...abc123');
    });

    it('returns not configured status', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockStatusNotConfigured));

      const result = await getTailscaleStatus();

      expect(result.configured).toBe(false);
      expect(result.masked_token).toBeNull();
    });

    it('calls correct endpoint', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockStatusNotConfigured));

      await getTailscaleStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/settings/tailscale/status',
        expect.any(Object)
      );
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(getTailscaleStatus()).rejects.toThrow('Network error');
    });
  });

  describe('saveTailscaleToken', () => {
    it('returns success response after saving token', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockTokenResponse));

      const result = await saveTailscaleToken('tskey-api-abc123');

      expect(result).toEqual(mockTokenResponse);
      expect(result.success).toBe(true);
    });

    it('sends POST request with token in body', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockTokenResponse));

      await saveTailscaleToken('tskey-api-abc123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/settings/tailscale/token',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ token: 'tskey-api-abc123' }),
        })
      );
    });

    it('throws ApiError on 400 invalid token format', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Invalid token format'));

      await expect(saveTailscaleToken('invalid')).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 500 server error', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(500, 'Internal server error'));

      await expect(saveTailscaleToken('tskey-api-abc123')).rejects.toThrow(ApiError);
    });
  });

  describe('removeTailscaleToken', () => {
    it('returns success response after removing token', async () => {
      const removeResponse: TailscaleTokenResponse = {
        success: true,
        message: 'Token removed successfully',
      };
      mockFetch.mockResolvedValue(createMockResponse(removeResponse));

      const result = await removeTailscaleToken();

      expect(result.success).toBe(true);
      expect(result.message).toContain('removed');
    });

    it('sends DELETE request to token endpoint', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockTokenResponse));

      await removeTailscaleToken();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/settings/tailscale/token'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('throws error on 404 token not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Token not configured'));

      await expect(removeTailscaleToken()).rejects.toThrow();
    });
  });

  describe('testTailscaleConnection', () => {
    it('returns success response with tailnet info', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockTestResponseSuccess));

      const result = await testTailscaleConnection();

      expect(result.success).toBe(true);
      expect(result.tailnet).toBe('my-tailnet.ts.net');
      expect(result.device_count).toBe(5);
    });

    it('returns failure response with error details', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockTestResponseFailure));

      const result = await testTailscaleConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid API token');
      expect(result.code).toBe('UNAUTHORIZED');
    });

    it('sends POST request with empty body', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockTestResponseSuccess));

      await testTailscaleConnection();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/settings/tailscale/test',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
    });

    it('throws ApiError on 400 token not configured', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Tailscale token not configured'));

      await expect(testTailscaleConnection()).rejects.toThrow(ApiError);
    });
  });

  describe('getTailscaleDevices', () => {
    it('returns device list without filters', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDeviceListResponse));

      const result = await getTailscaleDevices();

      expect(result.devices).toHaveLength(2);
      expect(result.count).toBe(2);
    });

    it('calls devices endpoint without query params when no filters', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDeviceListResponse));

      await getTailscaleDevices();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tailscale/devices',
        expect.any(Object)
      );
    });

    it('applies online filter as query parameter', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDeviceListResponse));

      await getTailscaleDevices({ online: true });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tailscale/devices?online=true',
        expect.any(Object)
      );
    });

    it('applies os filter as query parameter', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDeviceListResponse));

      await getTailscaleDevices({ os: 'linux' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tailscale/devices?os=linux',
        expect.any(Object)
      );
    });

    it('applies refresh flag as query parameter', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDeviceListResponse));

      await getTailscaleDevices({ refresh: true });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tailscale/devices?refresh=true',
        expect.any(Object)
      );
    });

    it('combines multiple filters', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDeviceListResponse));

      await getTailscaleDevices({ online: true, os: 'linux', refresh: true });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/tailscale/devices?'),
        expect.any(Object)
      );
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('online=true');
      expect(calledUrl).toContain('os=linux');
      expect(calledUrl).toContain('refresh=true');
    });

    it('uses with-ssh endpoint when test_ssh is true', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDeviceListResponse));

      await getTailscaleDevices({ test_ssh: true });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/tailscale/devices/with-ssh'),
        expect.any(Object)
      );
    });

    it('returns empty device list', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockEmptyDeviceListResponse));

      const result = await getTailscaleDevices();

      expect(result.devices).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('returns cache hit information', async () => {
      const cachedResponse: TailscaleDeviceListResponse = {
        ...mockDeviceListResponse,
        cache_hit: true,
        cached_at: '2026-01-29T09:55:00Z',
      };
      mockFetch.mockResolvedValue(createMockResponse(cachedResponse));

      const result = await getTailscaleDevices();

      expect(result.cache_hit).toBe(true);
      expect(result.cached_at).toBeDefined();
    });

    it('throws ApiError on 400 token not configured', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Tailscale token not configured'));

      await expect(getTailscaleDevices()).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 503 Tailscale unreachable', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(503, 'Tailscale API unreachable'));

      await expect(getTailscaleDevices()).rejects.toThrow(ApiError);
    });
  });

  describe('importTailscaleDevice', () => {
    const validImportRequest: TailscaleImportRequest = {
      tailscale_device_id: 'device-1',
      tailscale_hostname: 'my-server.tailnet.ts.net',
      tailscale_ip: '100.64.0.1',
      os: 'linux',
      display_name: 'My Server',
      machine_type: 'server',
      tdp: 65,
      category_id: null,
    };

    it('returns success response with imported machine', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockImportResponse));

      const result = await importTailscaleDevice(validImportRequest);

      expect(result.success).toBe(true);
      expect(result.machine).toBeDefined();
      expect(result.machine.server_id).toBe('my-server');
    });

    it('sends POST request with import details', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockImportResponse));

      await importTailscaleDevice(validImportRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tailscale/import',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(validImportRequest),
        })
      );
    });

    it('handles workstation machine type', async () => {
      const workstationRequest: TailscaleImportRequest = {
        ...validImportRequest,
        machine_type: 'workstation',
        display_name: 'My Workstation',
      };
      mockFetch.mockResolvedValue(createMockResponse({
        ...mockImportResponse,
        machine: {
          ...mockImportResponse.machine,
          machine_type: 'workstation',
        },
      }));

      const result = await importTailscaleDevice(workstationRequest);

      expect(result.machine.machine_type).toBe('workstation');
    });

    it('throws ApiError on 409 device already imported', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(409, 'Device already imported'));

      await expect(importTailscaleDevice(validImportRequest)).rejects.toThrow(ApiError);

      try {
        await importTailscaleDevice(validImportRequest);
      } catch (error) {
        expect((error as ApiError).status).toBe(409);
      }
    });

    it('throws ApiError on 400 validation error', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Invalid machine type'));

      await expect(importTailscaleDevice(validImportRequest)).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 404 device not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Tailscale device not found'));

      await expect(importTailscaleDevice(validImportRequest)).rejects.toThrow(ApiError);
    });
  });

  describe('checkTailscaleImport', () => {
    it('returns not imported status', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockImportCheckNotImported));

      const result = await checkTailscaleImport('new-device.tailnet.ts.net');

      expect(result.imported).toBe(false);
      expect(result.machine_id).toBeNull();
    });

    it('returns imported status with machine details', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockImportCheckImported));

      const result = await checkTailscaleImport('my-server.tailnet.ts.net');

      expect(result.imported).toBe(true);
      expect(result.machine_id).toBe('machine-uuid-123');
      expect(result.display_name).toBe('My Server');
    });

    it('encodes hostname in URL', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockImportCheckNotImported));

      await checkTailscaleImport('server with spaces.tailnet.ts.net');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/tailscale/import/check?hostname=server%20with%20spaces.tailnet.ts.net',
        expect.any(Object)
      );
    });

    it('encodes special characters in hostname', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockImportCheckNotImported));

      await checkTailscaleImport('server&special=chars.tailnet.ts.net');

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain(encodeURIComponent('server&special=chars.tailnet.ts.net'));
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(checkTailscaleImport('my-server.tailnet.ts.net')).rejects.toThrow('Network error');
    });
  });
});
