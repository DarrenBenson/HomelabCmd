/**
 * Tests for config-check API client functions.
 *
 * Part of EP0010: Configuration Management - US0118 Configuration Diff View.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getConfigDiff, checkCompliance } from '../../api/config-check';
import { ApiError } from '../../api/client';
import type {
  ConfigDiffResponse,
  ConfigCheckResponse,
  ConfigCheckRequest,
} from '../../types/config-check';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock response data
const mockDiffResponseCompliant: ConfigDiffResponse = {
  server_id: 'test-server-1',
  pack_name: 'base',
  is_compliant: true,
  summary: {
    total_items: 10,
    compliant: 10,
    mismatched: 0,
  },
  mismatches: [],
  checked_at: '2026-01-29T10:00:00Z',
};

const mockDiffResponseNonCompliant: ConfigDiffResponse = {
  server_id: 'test-server-1',
  pack_name: 'base',
  is_compliant: false,
  summary: {
    total_items: 10,
    compliant: 7,
    mismatched: 3,
  },
  mismatches: [
    {
      type: 'missing_file',
      category: 'files',
      item: '~/.bashrc.d/aliases.sh',
      expected: { exists: true, mode: '0644' },
      actual: { exists: false },
      diff: null,
    },
    {
      type: 'wrong_version',
      category: 'packages',
      item: 'curl',
      expected: { installed: true, min_version: '8.5.0' },
      actual: { installed: true, version: '8.2.0' },
      diff: null,
    },
    {
      type: 'wrong_content',
      category: 'files',
      item: '~/.config/ghostty/config',
      expected: { exists: true, hash: 'sha256:abc123' },
      actual: { exists: true, hash: 'sha256:def456' },
      diff: '--- expected\n+++ actual\n@@ -1,3 +1,3 @@\n font-size = 14\n-theme = catppuccin-mocha\n+theme = default',
    },
  ],
  checked_at: '2026-01-29T10:00:00Z',
};

const mockCheckResponseCompliant: ConfigCheckResponse = {
  server_id: 'test-server-1',
  pack_name: 'base',
  is_compliant: true,
  mismatches: [],
  checked_at: '2026-01-29T10:00:00Z',
  check_duration_ms: 1234,
};

const mockCheckResponseNonCompliant: ConfigCheckResponse = {
  server_id: 'test-server-1',
  pack_name: 'base',
  is_compliant: false,
  mismatches: [
    {
      type: 'missing_package',
      category: 'packages',
      item: 'htop',
      expected: { installed: true },
      actual: { installed: false },
      diff: null,
    },
  ],
  checked_at: '2026-01-29T10:00:00Z',
  check_duration_ms: 2500,
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

describe('config-check API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getConfigDiff', () => {
    it('returns diff response for compliant server', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiffResponseCompliant));

      const result = await getConfigDiff('test-server-1', 'base');

      expect(result).toEqual(mockDiffResponseCompliant);
      expect(result.is_compliant).toBe(true);
      expect(result.mismatches).toHaveLength(0);
    });

    it('returns diff response with mismatches for non-compliant server', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiffResponseNonCompliant));

      const result = await getConfigDiff('test-server-1', 'base');

      expect(result.is_compliant).toBe(false);
      expect(result.mismatches).toHaveLength(3);
      expect(result.summary.mismatched).toBe(3);
    });

    it('constructs correct URL with encoded pack name', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiffResponseCompliant));

      await getConfigDiff('test-server-1', 'pack with spaces');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/test-server-1/config/diff?pack=pack%20with%20spaces',
        expect.any(Object)
      );
    });

    it('encodes special characters in pack name', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiffResponseCompliant));

      await getConfigDiff('test-server-1', 'pack&special=chars');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/test-server-1/config/diff?pack=pack%26special%3Dchars',
        expect.any(Object)
      );
    });

    it('throws ApiError on 404 no compliance check exists', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'No compliance check found'));

      await expect(getConfigDiff('test-server-1', 'base')).rejects.toThrow(ApiError);

      try {
        await getConfigDiff('test-server-1', 'base');
      } catch (error) {
        expect((error as ApiError).status).toBe(404);
      }
    });

    it('throws ApiError on 404 server not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Server not found'));

      await expect(getConfigDiff('nonexistent', 'base')).rejects.toThrow(ApiError);
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(getConfigDiff('test-server-1', 'base')).rejects.toThrow('Network error');
    });

    it('returns mismatches with diff content for content differences', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDiffResponseNonCompliant));

      const result = await getConfigDiff('test-server-1', 'base');

      const contentMismatch = result.mismatches.find((m) => m.type === 'wrong_content');
      expect(contentMismatch).toBeDefined();
      expect(contentMismatch?.diff).toContain('--- expected');
      expect(contentMismatch?.diff).toContain('+++ actual');
    });
  });

  describe('checkCompliance', () => {
    it('returns compliant check response', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCheckResponseCompliant));
      const request: ConfigCheckRequest = { pack_name: 'base' };

      const result = await checkCompliance('test-server-1', request);

      expect(result).toEqual(mockCheckResponseCompliant);
      expect(result.is_compliant).toBe(true);
      expect(result.check_duration_ms).toBe(1234);
    });

    it('returns non-compliant check response with mismatches', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCheckResponseNonCompliant));
      const request: ConfigCheckRequest = { pack_name: 'base' };

      const result = await checkCompliance('test-server-1', request);

      expect(result.is_compliant).toBe(false);
      expect(result.mismatches).toHaveLength(1);
      expect(result.mismatches[0].type).toBe('missing_package');
    });

    it('sends POST request with correct body', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCheckResponseCompliant));
      const request: ConfigCheckRequest = { pack_name: 'production' };

      await checkCompliance('test-server-1', request);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/test-server-1/config/check',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ pack_name: 'production' }),
        })
      );
    });

    it('throws ApiError on 404 server not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Server not found'));
      const request: ConfigCheckRequest = { pack_name: 'base' };

      await expect(checkCompliance('nonexistent', request)).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 400 pack not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Configuration pack not found'));
      const request: ConfigCheckRequest = { pack_name: 'invalid-pack' };

      await expect(checkCompliance('test-server-1', request)).rejects.toThrow(ApiError);
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));
      const request: ConfigCheckRequest = { pack_name: 'base' };

      await expect(checkCompliance('test-server-1', request)).rejects.toThrow('Connection refused');
    });

    it('returns check with timing information', async () => {
      const slowCheckResponse: ConfigCheckResponse = {
        ...mockCheckResponseCompliant,
        check_duration_ms: 5000,
      };
      mockFetch.mockResolvedValue(createMockResponse(slowCheckResponse));
      const request: ConfigCheckRequest = { pack_name: 'base' };

      const result = await checkCompliance('test-server-1', request);

      expect(result.check_duration_ms).toBe(5000);
      expect(result.checked_at).toBeDefined();
    });
  });
});
