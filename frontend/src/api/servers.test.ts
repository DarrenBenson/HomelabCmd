import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getServers,
  getServer,
  pauseServer,
  unpauseServer,
  getMetricsHistory,
  getServerPackages,
  updateServer,
} from './servers';
import { api } from './client';
import type {
  ServersResponse,
  ServerDetail,
  MetricsHistoryResponse,
  PackagesResponse,
} from '../types/server';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('Servers API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getServers', () => {
    it('calls /api/v1/servers endpoint', async () => {
      const mockResponse: ServersResponse = { servers: [], total: 0 };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      await getServers();

      expect(api.get).toHaveBeenCalledWith('/api/v1/servers');
    });

    it('returns ServersResponse shape', async () => {
      const mockResponse: ServersResponse = {
        servers: [
          {
            id: 'test-server',
            hostname: 'test.local',
            display_name: 'Test Server',
            status: 'online',
            latest_metrics: {
              cpu_percent: 50,
              memory_percent: 60,
              disk_percent: 70,
              uptime_seconds: 86400,
            },
          },
        ],
        total: 1,
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await getServers();

      expect(result).toEqual(mockResponse);
      expect(result.servers).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('returns empty servers array when no servers', async () => {
      const mockResponse: ServersResponse = { servers: [], total: 0 };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await getServers();

      expect(result.servers).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('Network error');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getServers()).rejects.toThrow('Network error');
    });

    it('returns servers with null latest_metrics', async () => {
      const mockResponse: ServersResponse = {
        servers: [
          {
            id: 'offline-server',
            hostname: 'offline.local',
            display_name: null,
            status: 'offline',
            latest_metrics: null,
          },
        ],
        total: 1,
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await getServers();

      expect(result.servers[0].latest_metrics).toBeNull();
      expect(result.servers[0].display_name).toBeNull();
    });

    it('returns multiple servers correctly', async () => {
      const mockResponse: ServersResponse = {
        servers: [
          {
            id: 'server-1',
            hostname: 'server1.local',
            display_name: 'Server 1',
            status: 'online',
            latest_metrics: {
              cpu_percent: 25,
              memory_percent: 50,
              disk_percent: 75,
              uptime_seconds: 3600,
            },
          },
          {
            id: 'server-2',
            hostname: 'server2.local',
            display_name: 'Server 2',
            status: 'offline',
            latest_metrics: null,
          },
          {
            id: 'server-3',
            hostname: 'server3.local',
            display_name: 'Server 3',
            status: 'unknown',
            latest_metrics: {
              cpu_percent: null,
              memory_percent: null,
              disk_percent: null,
              uptime_seconds: null,
            },
          },
        ],
        total: 3,
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const result = await getServers();

      expect(result.servers).toHaveLength(3);
      expect(result.servers[0].status).toBe('online');
      expect(result.servers[1].status).toBe('offline');
      expect(result.servers[2].status).toBe('unknown');
    });
  });

  describe('getServer', () => {
    const mockServerDetail: ServerDetail = {
      id: 'test-server',
      hostname: 'test-server.local',
      display_name: 'Test Server',
      ip_address: '192.168.1.100',
      status: 'online',
      is_paused: false,
      paused_at: null,
      last_seen: '2026-01-18T12:00:00Z',
      os_distribution: 'Ubuntu',
      os_version: '22.04',
      kernel_version: '5.15.0-generic',
      architecture: 'x86_64',
      tdp_watts: 65,
      updates_available: null,
      security_updates: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-18T12:00:00Z',
      latest_metrics: {
        cpu_percent: 45.5,
        memory_percent: 67.2,
        disk_percent: 35.0,
        uptime_seconds: 1234567,
        memory_total_mb: null,
        memory_used_mb: null,
        disk_total_gb: null,
        disk_used_gb: null,
        network_rx_bytes: null,
        network_tx_bytes: null,
        load_1m: null,
        load_5m: null,
        load_15m: null,
      },
    };

    it('calls /api/v1/servers/{serverId} endpoint', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockServerDetail);

      await getServer('test-server');

      expect(api.get).toHaveBeenCalledWith('/api/v1/servers/test-server');
    });

    it('returns ServerDetail shape', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockServerDetail);

      const result = await getServer('test-server');

      expect(result).toEqual(mockServerDetail);
      expect(result.id).toBe('test-server');
      expect(result.hostname).toBe('test-server.local');
      expect(result.os_distribution).toBe('Ubuntu');
    });

    it('returns server with metrics', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockServerDetail);

      const result = await getServer('test-server');

      expect(result.latest_metrics).not.toBeNull();
      expect(result.latest_metrics?.cpu_percent).toBe(45.5);
      expect(result.latest_metrics?.memory_percent).toBe(67.2);
      expect(result.latest_metrics?.disk_percent).toBe(35.0);
      expect(result.latest_metrics?.uptime_seconds).toBe(1234567);
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('404 Not Found');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getServer('nonexistent')).rejects.toThrow('404 Not Found');
    });

    it('handles server with null metrics', async () => {
      const serverNoMetrics: ServerDetail = {
        ...mockServerDetail,
        latest_metrics: null,
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(serverNoMetrics);

      const result = await getServer('test-server');

      expect(result.latest_metrics).toBeNull();
    });
  });

  /**
   * Pause/Unpause API tests (US0029)
   * Spec Reference: sdlc-studio/stories/US0029-server-maintenance-mode.md
   */
  describe('pauseServer', () => {
    const mockPausedServer: ServerDetail = {
      id: 'test-server',
      hostname: 'test-server.local',
      display_name: 'Test Server',
      ip_address: '192.168.1.100',
      status: 'online',
      is_paused: true,
      paused_at: '2026-01-19T10:00:00Z',
      last_seen: '2026-01-18T12:00:00Z',
      os_distribution: 'Ubuntu',
      os_version: '22.04',
      kernel_version: '5.15.0-generic',
      architecture: 'x86_64',
      tdp_watts: 65,
      updates_available: null,
      security_updates: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-19T10:00:00Z',
      latest_metrics: null,
    };

    it('calls PUT /api/v1/servers/{serverId}/pause endpoint', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockPausedServer);

      await pauseServer('test-server');

      expect(api.put).toHaveBeenCalledWith('/api/v1/servers/test-server/pause', {});
    });

    it('returns ServerDetail with is_paused=true', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockPausedServer);

      const result = await pauseServer('test-server');

      expect(result.is_paused).toBe(true);
      expect(result.paused_at).toBe('2026-01-19T10:00:00Z');
    });

    it('propagates errors from api.put', async () => {
      const error = new Error('404 Not Found');
      (api.put as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(pauseServer('nonexistent')).rejects.toThrow('404 Not Found');
    });
  });

  describe('unpauseServer', () => {
    const mockUnpausedServer: ServerDetail = {
      id: 'test-server',
      hostname: 'test-server.local',
      display_name: 'Test Server',
      ip_address: '192.168.1.100',
      status: 'online',
      is_paused: false,
      paused_at: null,
      last_seen: '2026-01-18T12:00:00Z',
      os_distribution: 'Ubuntu',
      os_version: '22.04',
      kernel_version: '5.15.0-generic',
      architecture: 'x86_64',
      tdp_watts: 65,
      updates_available: null,
      security_updates: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-19T10:30:00Z',
      latest_metrics: null,
    };

    it('calls PUT /api/v1/servers/{serverId}/unpause endpoint', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockUnpausedServer);

      await unpauseServer('test-server');

      expect(api.put).toHaveBeenCalledWith('/api/v1/servers/test-server/unpause', {});
    });

    it('returns ServerDetail with is_paused=false', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockUnpausedServer);

      const result = await unpauseServer('test-server');

      expect(result.is_paused).toBe(false);
      expect(result.paused_at).toBeNull();
    });

    it('propagates errors from api.put', async () => {
      const error = new Error('404 Not Found');
      (api.put as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(unpauseServer('nonexistent')).rejects.toThrow('404 Not Found');
    });
  });

  describe('getMetricsHistory', () => {
    const mockMetricsHistory: MetricsHistoryResponse = {
      server_id: 'test-server',
      range: '24h',
      resolution: '5m',
      metrics: [
        {
          timestamp: '2026-01-18T10:00:00Z',
          cpu_percent: 45.5,
          memory_percent: 67.2,
          disk_percent: 35.0,
        },
        {
          timestamp: '2026-01-18T10:05:00Z',
          cpu_percent: 50.0,
          memory_percent: 68.1,
          disk_percent: 35.0,
        },
      ],
    };

    it('calls /api/v1/servers/{serverId}/metrics with default range', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockMetricsHistory);

      await getMetricsHistory('test-server');

      expect(api.get).toHaveBeenCalledWith('/api/v1/servers/test-server/metrics?range=24h');
    });

    it('calls /api/v1/servers/{serverId}/metrics with custom range', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockMetricsHistory);

      await getMetricsHistory('test-server', '7d');

      expect(api.get).toHaveBeenCalledWith('/api/v1/servers/test-server/metrics?range=7d');
    });

    it('returns MetricsHistoryResponse shape', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockMetricsHistory);

      const result = await getMetricsHistory('test-server');

      expect(result).toEqual(mockMetricsHistory);
      expect(result.server_id).toBe('test-server');
      expect(result.range).toBe('24h');
      expect(result.metrics).toHaveLength(2);
    });

    it('returns empty metrics array when no data', async () => {
      const emptyResponse: MetricsHistoryResponse = {
        server_id: 'test-server',
        range: '24h',
        resolution: '5m',
        metrics: [],
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(emptyResponse);

      const result = await getMetricsHistory('test-server');

      expect(result.metrics).toEqual([]);
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('404 Not Found');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getMetricsHistory('nonexistent')).rejects.toThrow('404 Not Found');
    });
  });

  describe('getServerPackages', () => {
    const mockPackagesResponse: PackagesResponse = {
      packages: [
        {
          name: 'nginx',
          version: '1.24.0',
          new_version: '1.25.0',
          is_security: false,
        },
        {
          name: 'openssl',
          version: '3.0.2',
          new_version: '3.0.5',
          is_security: true,
        },
      ],
      total: 2,
      security_count: 1,
    };

    it('calls GET /api/v1/servers/{serverId}/packages endpoint', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockPackagesResponse);

      await getServerPackages('test-server');

      expect(api.get).toHaveBeenCalledWith('/api/v1/servers/test-server/packages');
    });

    it('returns PackagesResponse shape', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockPackagesResponse);

      const result = await getServerPackages('test-server');

      expect(result).toEqual(mockPackagesResponse);
      expect(result.packages).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.security_count).toBe(1);
    });

    it('returns empty packages array when no updates', async () => {
      const emptyResponse: PackagesResponse = {
        packages: [],
        total: 0,
        security_count: 0,
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(emptyResponse);

      const result = await getServerPackages('test-server');

      expect(result.packages).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('404 Not Found');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getServerPackages('nonexistent')).rejects.toThrow('404 Not Found');
    });
  });

  describe('updateServer', () => {
    const mockUpdatedServer: ServerDetail = {
      id: 'test-server',
      hostname: 'test-server.local',
      display_name: 'Test Server',
      ip_address: '192.168.1.100',
      status: 'online',
      is_paused: false,
      paused_at: null,
      last_seen: '2026-01-18T12:00:00Z',
      os_distribution: 'Ubuntu',
      os_version: '22.04',
      kernel_version: '5.15.0-generic',
      architecture: 'x86_64',
      tdp_watts: 95,
      updates_available: null,
      security_updates: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-18T12:30:00Z',
      latest_metrics: null,
    };

    it('calls PUT /api/v1/servers/{serverId} endpoint', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedServer);

      await updateServer('test-server', { tdp_watts: 95 });

      expect(api.put).toHaveBeenCalledWith('/api/v1/servers/test-server', { tdp_watts: 95 });
    });

    it('returns updated ServerDetail shape', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedServer);

      const result = await updateServer('test-server', { tdp_watts: 95 });

      expect(result).toEqual(mockUpdatedServer);
      expect(result.tdp_watts).toBe(95);
    });

    it('accepts display_name update', async () => {
      const serverWithDisplayName = { ...mockUpdatedServer, display_name: 'New Name' };
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(serverWithDisplayName);

      await updateServer('test-server', { display_name: 'New Name' });

      expect(api.put).toHaveBeenCalledWith('/api/v1/servers/test-server', {
        display_name: 'New Name',
      });
    });

    it('propagates errors from api.put', async () => {
      const error = new Error('Validation error');
      (api.put as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(updateServer('test-server', { tdp_watts: -1 })).rejects.toThrow(
        'Validation error'
      );
    });
  });
});
