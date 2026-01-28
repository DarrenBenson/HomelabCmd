import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  startDiscovery,
  getDiscovery,
  getDiscoverySettings,
  updateDiscoverySettings,
} from './discovery';
import { api } from './client';
import type { DiscoveryResponse, DiscoverySettings } from '../types/discovery';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

describe('Discovery API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startDiscovery', () => {
    const mockDiscoveryResponse: DiscoveryResponse = {
      discovery_id: 42,
      status: 'running',
      subnet: '192.168.1.0/24',
      started_at: '2026-01-18T10:00:00Z',
      completed_at: null,
      progress: 0,
      devices_found: 0,
      devices: [],
    };

    it('calls POST /api/v1/discovery endpoint with empty object when no request', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockDiscoveryResponse);

      await startDiscovery();

      expect(api.post).toHaveBeenCalledWith('/api/v1/discovery', {});
    });

    it('calls POST /api/v1/discovery endpoint with subnet override', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockDiscoveryResponse);

      await startDiscovery({ subnet: '10.0.0.0/24' });

      expect(api.post).toHaveBeenCalledWith('/api/v1/discovery', { subnet: '10.0.0.0/24' });
    });

    it('returns DiscoveryResponse shape', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(mockDiscoveryResponse);

      const result = await startDiscovery();

      expect(result).toEqual(mockDiscoveryResponse);
      expect(result.discovery_id).toBe(42);
      expect(result.status).toBe('running');
    });

    it('returns existing discovery when already running', async () => {
      const existingDiscovery: DiscoveryResponse = {
        ...mockDiscoveryResponse,
        progress: 50,
        devices_found: 3,
      };
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValue(existingDiscovery);

      const result = await startDiscovery();

      expect(result.progress).toBe(50);
      expect(result.devices_found).toBe(3);
    });

    it('propagates errors from api.post', async () => {
      const error = new Error('Network error');
      (api.post as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(startDiscovery()).rejects.toThrow('Network error');
    });
  });

  describe('getDiscovery', () => {
    const mockDiscoveryResponse: DiscoveryResponse = {
      discovery_id: 42,
      status: 'completed',
      subnet: '192.168.1.0/24',
      started_at: '2026-01-18T10:00:00Z',
      completed_at: '2026-01-18T10:05:00Z',
      progress: 100,
      devices_found: 5,
      devices: [
        {
          ip_address: '192.168.1.10',
          hostname: 'server1.local',
          mac_address: '00:11:22:33:44:55',
          is_registered: true,
          server_id: 'server-1',
        },
        {
          ip_address: '192.168.1.11',
          hostname: null,
          mac_address: '00:11:22:33:44:66',
          is_registered: false,
          server_id: null,
        },
      ],
    };

    it('calls GET /api/v1/discovery/{discoveryId} endpoint', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockDiscoveryResponse);

      await getDiscovery(42);

      expect(api.get).toHaveBeenCalledWith('/api/v1/discovery/42');
    });

    it('returns DiscoveryResponse shape', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockDiscoveryResponse);

      const result = await getDiscovery(42);

      expect(result).toEqual(mockDiscoveryResponse);
      expect(result.discovery_id).toBe(42);
      expect(result.status).toBe('completed');
      expect(result.devices).toHaveLength(2);
    });

    it('returns discovery in progress', async () => {
      const inProgressResponse: DiscoveryResponse = {
        ...mockDiscoveryResponse,
        status: 'running',
        progress: 60,
        completed_at: null,
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(inProgressResponse);

      const result = await getDiscovery(42);

      expect(result.status).toBe('running');
      expect(result.progress).toBe(60);
      expect(result.completed_at).toBeNull();
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('404 Not Found');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getDiscovery(999)).rejects.toThrow('404 Not Found');
    });
  });

  describe('getDiscoverySettings', () => {
    const mockDiscoverySettings: DiscoverySettings = {
      default_subnet: '192.168.1.0/24',
      scan_interval_hours: 24,
      auto_register: false,
    };

    it('calls GET /api/v1/settings/discovery endpoint', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockDiscoverySettings);

      await getDiscoverySettings();

      expect(api.get).toHaveBeenCalledWith('/api/v1/settings/discovery');
    });

    it('returns DiscoverySettings shape', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockDiscoverySettings);

      const result = await getDiscoverySettings();

      expect(result).toEqual(mockDiscoverySettings);
      expect(result.default_subnet).toBe('192.168.1.0/24');
      expect(result.scan_interval_hours).toBe(24);
      expect(result.auto_register).toBe(false);
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('Network error');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getDiscoverySettings()).rejects.toThrow('Network error');
    });
  });

  describe('updateDiscoverySettings', () => {
    const mockUpdatedSettings: DiscoverySettings = {
      default_subnet: '10.0.0.0/24',
      scan_interval_hours: 12,
      auto_register: true,
    };

    it('calls PUT /api/v1/settings/discovery endpoint', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedSettings);

      await updateDiscoverySettings({ default_subnet: '10.0.0.0/24' });

      expect(api.put).toHaveBeenCalledWith('/api/v1/settings/discovery', {
        default_subnet: '10.0.0.0/24',
      });
    });

    it('returns updated DiscoverySettings shape', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedSettings);

      const result = await updateDiscoverySettings({ default_subnet: '10.0.0.0/24' });

      expect(result).toEqual(mockUpdatedSettings);
      expect(result.default_subnet).toBe('10.0.0.0/24');
    });

    it('accepts multiple settings updates', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedSettings);

      await updateDiscoverySettings({
        default_subnet: '10.0.0.0/24',
        scan_interval_hours: 12,
        auto_register: true,
      });

      expect(api.put).toHaveBeenCalledWith('/api/v1/settings/discovery', {
        default_subnet: '10.0.0.0/24',
        scan_interval_hours: 12,
        auto_register: true,
      });
    });

    it('propagates errors from api.put', async () => {
      const error = new Error('Validation error');
      (api.put as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(updateDiscoverySettings({ default_subnet: 'invalid' })).rejects.toThrow(
        'Validation error'
      );
    });
  });
});
