/**
 * Tests for config-apply API client functions.
 *
 * Part of EP0010: Configuration Management - US0119 Apply Configuration Pack.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getApplyPreview, applyConfigPack, getApplyStatus } from '../../api/config-apply';
import { ApiError } from '../../api/client';
import type {
  ApplyPreviewResponse,
  ApplyInitiatedResponse,
  ApplyStatusResponse,
} from '../../types/config-apply';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock response data
const mockPreviewResponse: ApplyPreviewResponse = {
  server_id: 'test-server-1',
  pack_name: 'base',
  dry_run: true,
  files: [
    {
      action: 'create_file',
      path: '~/.bashrc.d/aliases.sh',
      mode: '0644',
      description: 'Create shell aliases file',
    },
  ],
  packages: [
    {
      action: 'install_package',
      package: 'curl',
      version: '8.5.0',
      description: 'Install curl package',
    },
  ],
  settings: [
    {
      action: 'set_env_var',
      key: 'EDITOR',
      value: 'vim',
      description: 'Set default editor',
    },
  ],
  total_items: 3,
};

const mockInitiatedResponse: ApplyInitiatedResponse = {
  apply_id: 42,
  server_id: 'test-server-1',
  pack_name: 'base',
  status: 'running',
  started_at: '2026-01-29T10:00:00Z',
};

const mockStatusResponse: ApplyStatusResponse = {
  apply_id: 42,
  server_id: 'test-server-1',
  pack_name: 'base',
  status: 'completed',
  progress: 100,
  current_item: null,
  items_total: 3,
  items_completed: 3,
  items_failed: 0,
  items: [
    { item: '~/.bashrc.d/aliases.sh', action: 'create_file', success: true },
    { item: 'curl', action: 'install_package', success: true },
    { item: 'EDITOR', action: 'set_env_var', success: true },
  ],
  started_at: '2026-01-29T10:00:00Z',
  completed_at: '2026-01-29T10:01:00Z',
  error: null,
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

describe('config-apply API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getApplyPreview', () => {
    it('returns preview response with dry_run true', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockPreviewResponse));

      const result = await getApplyPreview('test-server-1', 'base');

      expect(result).toEqual(mockPreviewResponse);
      expect(result.dry_run).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/test-server-1/config/apply',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ pack_name: 'base', dry_run: true }),
        })
      );
    });

    it('returns grouped items for files, packages, and settings', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockPreviewResponse));

      const result = await getApplyPreview('test-server-1', 'base');

      expect(result.files).toHaveLength(1);
      expect(result.packages).toHaveLength(1);
      expect(result.settings).toHaveLength(1);
      expect(result.total_items).toBe(3);
    });

    it('throws ApiError on 404 server not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Server not found'));

      await expect(getApplyPreview('nonexistent', 'base')).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 400 pack not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Configuration pack not found'));

      await expect(getApplyPreview('test-server-1', 'invalid-pack')).rejects.toThrow(ApiError);
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(getApplyPreview('test-server-1', 'base')).rejects.toThrow('Network error');
    });
  });

  describe('applyConfigPack', () => {
    it('returns initiated response with apply_id', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockInitiatedResponse));

      const result = await applyConfigPack('test-server-1', 'base');

      expect(result).toEqual(mockInitiatedResponse);
      expect(result.apply_id).toBe(42);
      expect(result.status).toBe('running');
    });

    it('sends request with dry_run false', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockInitiatedResponse));

      await applyConfigPack('test-server-1', 'base');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/test-server-1/config/apply',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ pack_name: 'base', dry_run: false }),
        })
      );
    });

    it('throws ApiError on 404 server not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Server not found'));

      await expect(applyConfigPack('nonexistent', 'base')).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 500 server error', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(500, 'Internal server error'));

      await expect(applyConfigPack('test-server-1', 'base')).rejects.toThrow(ApiError);
    });
  });

  describe('getApplyStatus', () => {
    it('returns status response with progress', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockStatusResponse));

      const result = await getApplyStatus('test-server-1', 42);

      expect(result).toEqual(mockStatusResponse);
      expect(result.progress).toBe(100);
      expect(result.status).toBe('completed');
    });

    it('constructs correct URL with serverId and applyId', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockStatusResponse));

      await getApplyStatus('test-server-1', 42);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/test-server-1/config/apply/42',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('returns in-progress status with current item', async () => {
      const inProgressResponse: ApplyStatusResponse = {
        ...mockStatusResponse,
        status: 'running',
        progress: 33,
        current_item: 'curl',
        items_completed: 1,
        completed_at: null,
      };
      mockFetch.mockResolvedValue(createMockResponse(inProgressResponse));

      const result = await getApplyStatus('test-server-1', 42);

      expect(result.status).toBe('running');
      expect(result.current_item).toBe('curl');
      expect(result.progress).toBe(33);
    });

    it('returns failed status with error message', async () => {
      const failedResponse: ApplyStatusResponse = {
        ...mockStatusResponse,
        status: 'failed',
        items_failed: 1,
        error: 'Permission denied installing package',
      };
      mockFetch.mockResolvedValue(createMockResponse(failedResponse));

      const result = await getApplyStatus('test-server-1', 42);

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Permission denied installing package');
      expect(result.items_failed).toBe(1);
    });

    it('throws ApiError on 404 apply operation not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Apply operation not found'));

      await expect(getApplyStatus('test-server-1', 999)).rejects.toThrow(ApiError);
    });
  });
});
