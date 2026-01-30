/**
 * Tests for servers API client functions.
 *
 * Tests for server CRUD, metrics, packages, and credentials.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getServers,
  getServer,
  getMetricsHistory,
  pauseServer,
  unpauseServer,
  getServerPackages,
  updateServer,
  updateMachineType,
  getServerCredentials,
  storeServerCredential,
  deleteServerCredential,
} from '../../api/servers';
import { ApiError } from '../../api/client';
import type { ServersResponse, ServerDetail, MetricsHistoryResponse, PackagesResponse, ServerCredentialsResponse } from '../../types/server';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock response data
const mockServerDetail: ServerDetail = {
  id: 'server-1',
  guid: 'guid-123',
  hostname: 'test-server',
  display_name: 'Test Server',
  ip_address: '192.168.1.100',
  status: 'online',
  is_paused: false,
  paused_at: null,
  agent_version: '1.0.0',
  agent_mode: 'readonly',
  is_inactive: false,
  inactive_since: null,
  last_seen: '2026-01-29T10:00:00Z',
  os_distribution: 'Ubuntu',
  os_version: '22.04',
  kernel_version: '5.15.0',
  architecture: 'x86_64',
  cpu_model: 'Intel Core i7',
  cpu_cores: 8,
  machine_category: 'mini_pc',
  machine_category_source: 'auto',
  idle_watts: 10,
  tdp_watts: 65,
  updates_available: 5,
  security_updates: 2,
  tailscale_hostname: 'test-server.tailnet.ts.net',
  machine_type: 'server',
  ssh_username: 'admin',
  sudo_mode: 'passwordless',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-29T10:00:00Z',
  latest_metrics: {
    cpu_percent: 25,
    memory_percent: 50,
    memory_total_mb: 8192,
    memory_used_mb: 4096,
    disk_percent: 30,
    disk_total_gb: 500,
    disk_used_gb: 150,
    network_rx_bytes: 1000000,
    network_tx_bytes: 500000,
    load_1m: 0.5,
    load_5m: 0.4,
    load_15m: 0.3,
    uptime_seconds: 86400,
  },
  filesystems: null,
  network_interfaces: null,
};

const mockServersResponse: ServersResponse = {
  servers: [
    {
      id: 'server-1',
      hostname: 'test-server',
      display_name: 'Test Server',
      status: 'online',
      is_paused: false,
      agent_version: '1.0.0',
      agent_mode: 'readonly',
      is_inactive: false,
      inactive_since: null,
      updates_available: 0,
      security_updates: 0,
      latest_metrics: null,
      machine_type: 'server',
      last_seen: '2026-01-29T10:00:00Z',
      active_alert_count: 0,
      active_alert_summaries: [],
      tailscale_hostname: null,
      filesystems: null,
      network_interfaces: null,
    },
  ],
  total: 1,
};

const mockMetricsHistory: MetricsHistoryResponse = {
  server_id: 'server-1',
  range: '24h',
  resolution: '5m',
  data_points: [
    { timestamp: '2026-01-29T00:00:00Z', cpu_percent: 20, memory_percent: 45, disk_percent: 30 },
    { timestamp: '2026-01-29T00:05:00Z', cpu_percent: 25, memory_percent: 50, disk_percent: 30 },
  ],
  total_points: 2,
};

const mockPackagesResponse: PackagesResponse = {
  server_id: 'server-1',
  last_checked: '2026-01-29T10:00:00Z',
  total_count: 5,
  security_count: 2,
  packages: [
    {
      name: 'openssl',
      current_version: '3.0.0',
      new_version: '3.0.1',
      repository: 'main',
      is_security: true,
      detected_at: '2026-01-29T09:00:00Z',
      updated_at: '2026-01-29T09:00:00Z',
    },
  ],
};

const mockCredentialsResponse: ServerCredentialsResponse = {
  server_id: 'server-1',
  ssh_username: 'admin',
  sudo_mode: 'passwordless',
  credentials: [
    { credential_type: 'ssh_key', configured: true, scope: 'global' },
    { credential_type: 'sudo_password', configured: false, scope: 'none' },
  ],
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

describe('servers API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getServers', () => {
    it('returns servers list', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockServersResponse));

      const result = await getServers();

      expect(result).toEqual(mockServersResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/servers', expect.any(Object));
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(getServers()).rejects.toThrow('Network error');
    });
  });

  describe('getServer', () => {
    it('returns server detail', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockServerDetail));

      const result = await getServer('server-1');

      expect(result).toEqual(mockServerDetail);
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/servers/server-1', expect.any(Object));
    });

    it('throws ApiError on 404 not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Server not found'));

      await expect(getServer('nonexistent')).rejects.toThrow(ApiError);
    });
  });

  describe('getMetricsHistory', () => {
    it('returns metrics history with default range', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockMetricsHistory));

      const result = await getMetricsHistory('server-1');

      expect(result).toEqual(mockMetricsHistory);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/server-1/metrics?range=24h',
        expect.any(Object)
      );
    });

    it('applies custom range', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockMetricsHistory));

      await getMetricsHistory('server-1', '7d');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/server-1/metrics?range=7d',
        expect.any(Object)
      );
    });

    it('supports 30d range', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ ...mockMetricsHistory, range: '30d' }));

      await getMetricsHistory('server-1', '30d');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/server-1/metrics?range=30d',
        expect.any(Object)
      );
    });
  });

  describe('pauseServer', () => {
    it('pauses server successfully', async () => {
      const pausedServer: ServerDetail = {
        ...mockServerDetail,
        is_paused: true,
        paused_at: '2026-01-29T10:30:00Z',
      };
      mockFetch.mockResolvedValue(createMockResponse(pausedServer));

      const result = await pauseServer('server-1');

      expect(result.is_paused).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/server-1/pause',
        expect.objectContaining({ method: 'PUT' })
      );
    });

    it('throws ApiError on 404', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Server not found'));

      await expect(pauseServer('nonexistent')).rejects.toThrow(ApiError);
    });
  });

  describe('unpauseServer', () => {
    it('unpauses server successfully', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockServerDetail));

      const result = await unpauseServer('server-1');

      expect(result.is_paused).toBe(false);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/server-1/unpause',
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  describe('getServerPackages', () => {
    it('returns packages list', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockPackagesResponse));

      const result = await getServerPackages('server-1');

      expect(result).toEqual(mockPackagesResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/server-1/packages',
        expect.any(Object)
      );
    });
  });

  describe('updateServer', () => {
    it('updates power config', async () => {
      const updatedServer: ServerDetail = {
        ...mockServerDetail,
        tdp_watts: 95,
      };
      mockFetch.mockResolvedValue(createMockResponse(updatedServer));

      const result = await updateServer('server-1', { tdp_watts: 95 });

      expect(result.tdp_watts).toBe(95);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/server-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ tdp_watts: 95 }),
        })
      );
    });

    it('updates ssh_username', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ ...mockServerDetail, ssh_username: 'root' }));

      const result = await updateServer('server-1', { ssh_username: 'root' });

      expect(result.ssh_username).toBe('root');
    });

    it('updates sudo_mode', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ ...mockServerDetail, sudo_mode: 'password' }));

      const result = await updateServer('server-1', { sudo_mode: 'password' });

      expect(result.sudo_mode).toBe('password');
    });
  });

  describe('updateMachineType', () => {
    it('changes machine type to workstation', async () => {
      const updatedServer: ServerDetail = {
        ...mockServerDetail,
        machine_type: 'workstation',
      };
      mockFetch.mockResolvedValue(createMockResponse(updatedServer));

      const result = await updateMachineType('server-1', 'workstation');

      expect(result.machine_type).toBe('workstation');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/server-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ machine_type: 'workstation' }),
        })
      );
    });

    it('changes machine type to server', async () => {
      const updatedServer: ServerDetail = {
        ...mockServerDetail,
        machine_type: 'server',
      };
      mockFetch.mockResolvedValue(createMockResponse(updatedServer));

      const result = await updateMachineType('workstation-1', 'server');

      expect(result.machine_type).toBe('server');
    });
  });

  describe('getServerCredentials', () => {
    it('returns credentials status', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCredentialsResponse));

      const result = await getServerCredentials('server-1');

      expect(result).toEqual(mockCredentialsResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/server-1/credentials',
        expect.any(Object)
      );
    });
  });

  describe('storeServerCredential', () => {
    it('stores credential successfully', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}));

      await storeServerCredential('server-1', 'sudo_password', 'secret123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/server-1/credentials',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ credential_type: 'sudo_password', value: 'secret123' }),
        })
      );
    });
  });

  describe('deleteServerCredential', () => {
    it('deletes credential successfully', async () => {
      mockFetch.mockResolvedValue(createMockDeleteResponse());

      await deleteServerCredential('server-1', 'sudo_password');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/server-1/credentials/sudo_password',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('throws ApiError on 404', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Credential not found'));

      await expect(deleteServerCredential('server-1', 'nonexistent')).rejects.toThrow(ApiError);
    });
  });
});
