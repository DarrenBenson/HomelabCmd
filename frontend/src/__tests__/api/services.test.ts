/**
 * Tests for services API client functions.
 *
 * Part of Expected Services API and US0069: Service Discovery.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getServerServices,
  restartService,
  discoverServices,
  createExpectedService,
  updateExpectedService,
  deleteExpectedService,
} from '../../api/services';
import { ApiError } from '../../api/client';
import type {
  ServicesResponse,
  RestartActionResponse,
  ServiceDiscoveryRequest,
  ServiceDiscoveryResponse,
  ExpectedService,
  ExpectedServiceCreate,
  ExpectedServiceUpdate,
} from '../../types/service';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock response data
const mockServicesResponse: ServicesResponse = {
  services: [
    {
      service_name: 'nginx.service',
      display_name: 'Nginx Web Server',
      is_critical: true,
      enabled: true,
      current_status: {
        status: 'running',
        status_reason: null,
        pid: 1234,
        memory_mb: 128,
        cpu_percent: 2.5,
        last_seen: '2026-01-29T10:00:00Z',
      },
    },
    {
      service_name: 'postgresql.service',
      display_name: 'PostgreSQL Database',
      is_critical: true,
      enabled: true,
      current_status: {
        status: 'running',
        status_reason: null,
        pid: 5678,
        memory_mb: 256,
        cpu_percent: 5.0,
        last_seen: '2026-01-29T10:00:00Z',
      },
    },
  ],
  total: 2,
};

const mockRestartResponse: RestartActionResponse = {
  action_id: 42,
  action_type: 'restart',
  server_id: 'test-server-1',
  service_name: 'nginx.service',
  command: 'systemctl restart nginx.service',
  status: 'queued',
  created_at: '2026-01-29T10:00:00Z',
};

const mockServiceDiscoveryResponse: ServiceDiscoveryResponse = {
  services: [
    { name: 'nginx', status: 'running', description: 'A high performance web server' },
    { name: 'postgresql', status: 'running', description: 'PostgreSQL RDBMS' },
    { name: 'redis', status: 'stopped', description: 'Redis in-memory data store' },
  ],
  total: 3,
  filtered: 15,
};

const mockCreatedService: ExpectedService = {
  service_name: 'custom.service',
  display_name: 'Custom Service',
  is_critical: false,
  enabled: true,
  current_status: null,
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

function createMockDeleteResponse(): Response {
  return {
    ok: true,
    status: 204,
    json: () => Promise.reject(new Error('No content')),
  } as Response;
}

describe('services API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getServerServices', () => {
    it('returns services response with service list', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockServicesResponse));

      const result = await getServerServices('test-server-1');

      expect(result).toEqual(mockServicesResponse);
      expect(result.services).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('constructs correct URL with server ID', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockServicesResponse));

      await getServerServices('my-server-123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/my-server-123/services',
        expect.any(Object)
      );
    });

    it('returns service with current status', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockServicesResponse));

      const result = await getServerServices('test-server-1');

      const nginx = result.services.find((s) => s.service_name === 'nginx.service');
      expect(nginx?.current_status?.status).toBe('running');
      expect(nginx?.current_status?.pid).toBe(1234);
    });

    it('handles service with null current status', async () => {
      const response: ServicesResponse = {
        services: [
          {
            service_name: 'new.service',
            display_name: 'New Service',
            is_critical: false,
            enabled: true,
            current_status: null,
          },
        ],
        total: 1,
      };
      mockFetch.mockResolvedValue(createMockResponse(response));

      const result = await getServerServices('test-server-1');

      expect(result.services[0].current_status).toBeNull();
    });

    it('throws ApiError on 404 server not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Server not found'));

      await expect(getServerServices('nonexistent')).rejects.toThrow(ApiError);
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(getServerServices('test-server-1')).rejects.toThrow('Network error');
    });
  });

  describe('restartService', () => {
    it('returns restart action response', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockRestartResponse));

      const result = await restartService('test-server-1', 'nginx.service');

      expect(result).toEqual(mockRestartResponse);
      expect(result.action_type).toBe('restart');
      expect(result.status).toBe('queued');
    });

    it('sends POST request with empty body', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockRestartResponse));

      await restartService('test-server-1', 'nginx.service');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/test-server-1/services/nginx.service/restart',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
    });

    it('constructs correct URL with server and service', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockRestartResponse));

      await restartService('server-1', 'postgresql.service');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/server-1/services/postgresql.service/restart',
        expect.any(Object)
      );
    });

    it('throws ApiError on 404 service not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Service not found'));

      await expect(restartService('test-server-1', 'nonexistent.service')).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 400 service not critical', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Cannot restart non-critical service'));

      await expect(restartService('test-server-1', 'nginx.service')).rejects.toThrow(ApiError);
    });
  });

  describe('discoverServices', () => {
    it('returns discovery response with services', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockServiceDiscoveryResponse));
      const request: ServiceDiscoveryRequest = {
        hostname: '192.168.1.100',
        port: 22,
        username: 'admin',
      };

      const result = await discoverServices(request);

      expect(result.services).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.filtered).toBe(15);
    });

    it('sends POST request with SSH details', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockServiceDiscoveryResponse));
      const request: ServiceDiscoveryRequest = {
        hostname: '192.168.1.100',
        port: 22,
        username: 'root',
        key_id: 'key-123',
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

    it('handles request with minimal fields', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockServiceDiscoveryResponse));
      const request: ServiceDiscoveryRequest = {
        hostname: '192.168.1.100',
      };

      await discoverServices(request);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/discovery/services',
        expect.objectContaining({
          body: JSON.stringify(request),
        })
      );
    });

    it('returns empty services list when no services found', async () => {
      const emptyResponse: ServiceDiscoveryResponse = {
        services: [],
        total: 0,
        filtered: 50,
      };
      mockFetch.mockResolvedValue(createMockResponse(emptyResponse));

      const result = await discoverServices({ hostname: '192.168.1.100' });

      expect(result.services).toHaveLength(0);
      expect(result.filtered).toBe(50);
    });

    it('throws ApiError on 400 SSH connection failed', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'SSH connection failed'));

      await expect(discoverServices({ hostname: 'invalid' })).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 503 SSH key not configured', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(503, 'SSH key not configured'));

      await expect(discoverServices({ hostname: '192.168.1.100' })).rejects.toThrow(ApiError);
    });
  });

  describe('createExpectedService', () => {
    it('returns created service', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCreatedService));
      const data: ExpectedServiceCreate = {
        service_name: 'custom.service',
        display_name: 'Custom Service',
        is_critical: false,
      };

      const result = await createExpectedService('test-server-1', data);

      expect(result).toEqual(mockCreatedService);
      expect(result.service_name).toBe('custom.service');
    });

    it('sends POST request with service data', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCreatedService));
      const data: ExpectedServiceCreate = {
        service_name: 'myapp.service',
        display_name: 'My Application',
        is_critical: true,
      };

      await createExpectedService('test-server-1', data);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/test-server-1/services',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(data),
        })
      );
    });

    it('throws ApiError on 409 service already exists', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(409, 'Service already exists'));
      const data: ExpectedServiceCreate = {
        service_name: 'existing.service',
        is_critical: false,
      };

      await expect(createExpectedService('test-server-1', data)).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 404 server not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Server not found'));
      const data: ExpectedServiceCreate = {
        service_name: 'new.service',
        is_critical: false,
      };

      await expect(createExpectedService('nonexistent', data)).rejects.toThrow(ApiError);
    });
  });

  describe('updateExpectedService', () => {
    it('returns updated service', async () => {
      const updatedService: ExpectedService = {
        ...mockCreatedService,
        is_critical: true,
        display_name: 'Updated Service',
      };
      mockFetch.mockResolvedValue(createMockResponse(updatedService));
      const data: ExpectedServiceUpdate = {
        display_name: 'Updated Service',
        is_critical: true,
      };

      const result = await updateExpectedService('test-server-1', 'custom.service', data);

      expect(result.display_name).toBe('Updated Service');
      expect(result.is_critical).toBe(true);
    });

    it('sends PUT request with encoded service name', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCreatedService));
      const data: ExpectedServiceUpdate = {
        enabled: false,
      };

      await updateExpectedService('test-server-1', 'my service.service', data);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/test-server-1/services/my%20service.service',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(data),
        })
      );
    });

    it('throws ApiError on 404 service not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Service not found'));
      const data: ExpectedServiceUpdate = { enabled: false };

      await expect(
        updateExpectedService('test-server-1', 'nonexistent.service', data)
      ).rejects.toThrow(ApiError);
    });
  });

  describe('deleteExpectedService', () => {
    it('completes successfully with no return value', async () => {
      mockFetch.mockResolvedValue(createMockDeleteResponse());

      await expect(
        deleteExpectedService('test-server-1', 'custom.service')
      ).resolves.toBeUndefined();
    });

    it('sends DELETE request with encoded service name', async () => {
      mockFetch.mockResolvedValue(createMockDeleteResponse());

      await deleteExpectedService('test-server-1', 'my app.service');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/test-server-1/services/my%20app.service',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('throws ApiError on 404 service not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Service not found'));

      await expect(
        deleteExpectedService('test-server-1', 'nonexistent.service')
      ).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 400 cannot delete critical service', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Cannot delete critical service'));

      await expect(
        deleteExpectedService('test-server-1', 'nginx.service')
      ).rejects.toThrow(ApiError);
    });
  });
});
