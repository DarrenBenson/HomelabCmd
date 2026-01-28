import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getScan, getScans, deleteScan, getSSHConfig, updateSSHConfig } from './scans';
import { api } from './client';
import type {
  ScanStatusResponse,
  ScanListResponse,
  SSHConfig,
  SSHConfigResponse,
} from '../types/scan';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Scans API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getScan', () => {
    const mockScanResponse: ScanStatusResponse = {
      scan_id: 123,
      hostname: 'test-server.local',
      status: 'completed',
      scan_type: 'quick',
      started_at: '2026-01-18T10:00:00Z',
      completed_at: '2026-01-18T10:05:00Z',
      results: {
        packages: [],
        services: [],
        alerts: [],
      },
    };

    it('calls /api/v1/scans/{scanId} endpoint', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockScanResponse);

      await getScan(123);

      expect(api.get).toHaveBeenCalledWith('/api/v1/scans/123');
    });

    it('returns ScanStatusResponse shape', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockScanResponse);

      const result = await getScan(123);

      expect(result).toEqual(mockScanResponse);
      expect(result.scan_id).toBe(123);
      expect(result.status).toBe('completed');
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('404 Not Found');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getScan(999)).rejects.toThrow('404 Not Found');
    });
  });

  describe('getScans', () => {
    const mockScansResponse: ScanListResponse = {
      scans: [
        {
          scan_id: 1,
          hostname: 'server1.local',
          status: 'completed',
          scan_type: 'quick',
          started_at: '2026-01-18T10:00:00Z',
          completed_at: '2026-01-18T10:05:00Z',
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
    };

    it('calls /api/v1/scans without params when no filters', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockScansResponse);

      await getScans();

      expect(api.get).toHaveBeenCalledWith('/api/v1/scans');
    });

    it('returns ScanListResponse shape', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockScansResponse);

      const result = await getScans();

      expect(result).toEqual(mockScansResponse);
      expect(result.scans).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('appends hostname filter to URL', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockScansResponse);

      await getScans({ hostname: 'test-server' });

      expect(api.get).toHaveBeenCalledWith('/api/v1/scans?hostname=test-server');
    });

    it('appends status filter to URL', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockScansResponse);

      await getScans({ status: 'completed' });

      expect(api.get).toHaveBeenCalledWith('/api/v1/scans?scan_status=completed');
    });

    it('appends scan_type filter to URL', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockScansResponse);

      await getScans({ scan_type: 'full' });

      expect(api.get).toHaveBeenCalledWith('/api/v1/scans?scan_type=full');
    });

    it('appends limit and offset to URL', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockScansResponse);

      await getScans({ limit: 20, offset: 10 });

      expect(api.get).toHaveBeenCalledWith('/api/v1/scans?limit=20&offset=10');
    });

    it('combines multiple filters', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockScansResponse);

      await getScans({
        hostname: 'test',
        status: 'running',
        scan_type: 'quick',
        limit: 5,
        offset: 0,
      });

      expect(api.get).toHaveBeenCalledWith(
        '/api/v1/scans?hostname=test&scan_status=running&scan_type=quick&limit=5&offset=0'
      );
    });

    it('returns empty scans array when no scans', async () => {
      const emptyResponse: ScanListResponse = {
        scans: [],
        total: 0,
        limit: 10,
        offset: 0,
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(emptyResponse);

      const result = await getScans();

      expect(result.scans).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('Network error');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getScans()).rejects.toThrow('Network error');
    });
  });

  describe('deleteScan', () => {
    it('calls DELETE /api/v1/scans/{scanId} endpoint', async () => {
      (api.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await deleteScan(123);

      expect(api.delete).toHaveBeenCalledWith('/api/v1/scans/123');
    });

    it('returns void on success', async () => {
      (api.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      const result = await deleteScan(123);

      expect(result).toBeUndefined();
    });

    it('propagates errors from api.delete', async () => {
      const error = new Error('404 Not Found');
      (api.delete as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(deleteScan(999)).rejects.toThrow('404 Not Found');
    });
  });

  describe('getSSHConfig', () => {
    const mockSSHConfig: SSHConfig = {
      ssh_key_path: '/home/user/.ssh/id_rsa',
      ssh_user: 'admin',
      ssh_port: 22,
    };

    it('calls GET /api/v1/settings/ssh endpoint', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockSSHConfig);

      await getSSHConfig();

      expect(api.get).toHaveBeenCalledWith('/api/v1/settings/ssh');
    });

    it('returns SSHConfig shape', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockSSHConfig);

      const result = await getSSHConfig();

      expect(result).toEqual(mockSSHConfig);
      expect(result.ssh_key_path).toBe('/home/user/.ssh/id_rsa');
      expect(result.ssh_user).toBe('admin');
      expect(result.ssh_port).toBe(22);
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('Network error');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getSSHConfig()).rejects.toThrow('Network error');
    });
  });

  describe('updateSSHConfig', () => {
    const mockSSHConfigResponse: SSHConfigResponse = {
      updated_fields: ['ssh_user', 'ssh_port'],
      config: {
        ssh_key_path: '/home/user/.ssh/id_rsa',
        ssh_user: 'newadmin',
        ssh_port: 2222,
      },
    };

    it('calls PUT /api/v1/settings/ssh endpoint', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockSSHConfigResponse);

      await updateSSHConfig({ ssh_user: 'newadmin', ssh_port: 2222 });

      expect(api.put).toHaveBeenCalledWith('/api/v1/settings/ssh', {
        ssh_user: 'newadmin',
        ssh_port: 2222,
      });
    });

    it('returns SSHConfigResponse shape', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockSSHConfigResponse);

      const result = await updateSSHConfig({ ssh_user: 'newadmin' });

      expect(result).toEqual(mockSSHConfigResponse);
      expect(result.updated_fields).toContain('ssh_user');
      expect(result.config.ssh_user).toBe('newadmin');
    });

    it('propagates errors from api.put', async () => {
      const error = new Error('Validation error');
      (api.put as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(updateSSHConfig({ ssh_port: -1 })).rejects.toThrow('Validation error');
    });
  });
});
