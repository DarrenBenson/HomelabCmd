/**
 * Tests for connectivity API client.
 *
 * Part of US0080: Connectivity Settings.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../../api/client';
import {
  getConnectivityStatus,
  updateConnectivityMode,
  getConnectivityStatusBar,
} from '../../api/connectivity';
import type {
  ConnectivityStatusResponse,
  ConnectivityUpdateResponse,
  ConnectivityStatusBarResponse,
} from '../../types/connectivity';

// Mock the api client
vi.mock('../../api/client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

const mockApi = api as { get: ReturnType<typeof vi.fn>; put: ReturnType<typeof vi.fn> };

describe('connectivity API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getConnectivityStatus', () => {
    it('calls the correct endpoint', async () => {
      const mockResponse: ConnectivityStatusResponse = {
        mode: 'tailscale',
        tailscale_configured: true,
        tailscale_connected: true,
        ssh_key_configured: true,
        ssh_username: 'admin',
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getConnectivityStatus();

      expect(mockApi.get).toHaveBeenCalledWith('/api/v1/settings/connectivity');
      expect(result).toEqual(mockResponse);
    });

    it('returns connectivity status with all fields', async () => {
      const mockResponse: ConnectivityStatusResponse = {
        mode: 'direct_ssh',
        tailscale_configured: false,
        tailscale_connected: false,
        ssh_key_configured: true,
        ssh_username: 'root',
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getConnectivityStatus();

      expect(result.mode).toBe('direct_ssh');
      expect(result.tailscale_configured).toBe(false);
      expect(result.ssh_key_configured).toBe(true);
    });

    it('propagates errors from the API', async () => {
      mockApi.get.mockRejectedValue(new Error('Network error'));

      await expect(getConnectivityStatus()).rejects.toThrow('Network error');
    });
  });

  describe('updateConnectivityMode', () => {
    it('calls the correct endpoint with request body', async () => {
      const mockResponse: ConnectivityUpdateResponse = {
        success: true,
        mode: 'tailscale',
      };
      mockApi.put.mockResolvedValue(mockResponse);

      const result = await updateConnectivityMode({ mode: 'tailscale' });

      expect(mockApi.put).toHaveBeenCalledWith(
        '/api/v1/settings/connectivity',
        { mode: 'tailscale' }
      );
      expect(result).toEqual(mockResponse);
    });

    it('includes ssh_username when provided', async () => {
      const mockResponse: ConnectivityUpdateResponse = {
        success: true,
        mode: 'direct_ssh',
      };
      mockApi.put.mockResolvedValue(mockResponse);

      await updateConnectivityMode({ mode: 'direct_ssh', ssh_username: 'deploy' });

      expect(mockApi.put).toHaveBeenCalledWith(
        '/api/v1/settings/connectivity',
        { mode: 'direct_ssh', ssh_username: 'deploy' }
      );
    });

    it('propagates errors from the API', async () => {
      mockApi.put.mockRejectedValue(new Error('Update failed'));

      await expect(
        updateConnectivityMode({ mode: 'tailscale' })
      ).rejects.toThrow('Update failed');
    });
  });

  describe('getConnectivityStatusBar', () => {
    it('calls the correct endpoint', async () => {
      const mockResponse: ConnectivityStatusBarResponse = {
        mode: 'tailscale',
        display_text: 'Tailscale Connected',
        health: 'healthy',
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getConnectivityStatusBar();

      expect(mockApi.get).toHaveBeenCalledWith('/api/v1/settings/connectivity/status');
      expect(result).toEqual(mockResponse);
    });

    it('returns status bar with warning health', async () => {
      const mockResponse: ConnectivityStatusBarResponse = {
        mode: 'direct_ssh',
        display_text: 'SSH Only',
        health: 'warning',
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getConnectivityStatusBar();

      expect(result.health).toBe('warning');
      expect(result.display_text).toBe('SSH Only');
    });

    it('returns status bar with error health', async () => {
      const mockResponse: ConnectivityStatusBarResponse = {
        mode: 'tailscale',
        display_text: 'Tailscale Disconnected',
        health: 'error',
      };
      mockApi.get.mockResolvedValue(mockResponse);

      const result = await getConnectivityStatusBar();

      expect(result.health).toBe('error');
    });

    it('propagates errors from the API', async () => {
      mockApi.get.mockRejectedValue(new Error('Server unavailable'));

      await expect(getConnectivityStatusBar()).rejects.toThrow('Server unavailable');
    });
  });
});
