/**
 * Tests for SSH API client functions.
 *
 * Part of US0093: Unified SSH Key Management.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testSSHConnection } from '../../api/ssh';
import { ApiError } from '../../api/client';
import type { SSHTestResponse } from '../../types/ssh';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock response data
const mockSuccessResponse: SSHTestResponse = {
  success: true,
  hostname: 'test-server.tailnet.ts.net',
  latency_ms: 45,
  host_key_fingerprint: 'SHA256:abc123def456ghi789jkl012mno345pqr678stu901vwx',
  error: null,
  attempts: 1,
};

const mockConnectionRefusedResponse: SSHTestResponse = {
  success: false,
  hostname: 'test-server.tailnet.ts.net',
  latency_ms: null,
  host_key_fingerprint: null,
  error: 'Connection refused',
  attempts: 3,
};

const mockAuthFailureResponse: SSHTestResponse = {
  success: false,
  hostname: 'test-server.tailnet.ts.net',
  latency_ms: null,
  host_key_fingerprint: 'SHA256:abc123def456ghi789jkl012mno345pqr678stu901vwx',
  error: 'Authentication failed: Permission denied (publickey)',
  attempts: 1,
};

const mockTimeoutResponse: SSHTestResponse = {
  success: false,
  hostname: 'test-server.tailnet.ts.net',
  latency_ms: null,
  host_key_fingerprint: null,
  error: 'Connection timed out after 30 seconds',
  attempts: 3,
};

const mockHostKeyMismatchResponse: SSHTestResponse = {
  success: false,
  hostname: 'test-server.tailnet.ts.net',
  latency_ms: null,
  host_key_fingerprint: 'SHA256:different123key456hash789abc012def345ghi678',
  error: 'Host key verification failed: key mismatch',
  attempts: 1,
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

describe('ssh API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('testSSHConnection', () => {
    it('returns success response with connection details', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSuccessResponse));

      const result = await testSSHConnection('test-server-1');

      expect(result).toEqual(mockSuccessResponse);
      expect(result.success).toBe(true);
      expect(result.latency_ms).toBe(45);
      expect(result.host_key_fingerprint).toBeDefined();
    });

    it('sends POST request with empty body', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSuccessResponse));

      await testSSHConnection('test-server-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/test-server-1/test-ssh',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
    });

    it('constructs correct URL with server ID', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSuccessResponse));

      await testSSHConnection('my-server-123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/servers/my-server-123/test-ssh',
        expect.any(Object)
      );
    });

    it('returns connection refused error with retry count', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockConnectionRefusedResponse));

      const result = await testSSHConnection('test-server-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
      expect(result.attempts).toBe(3);
      expect(result.latency_ms).toBeNull();
    });

    it('returns authentication failure with host key', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockAuthFailureResponse));

      const result = await testSSHConnection('test-server-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
      expect(result.host_key_fingerprint).toBeDefined();
      expect(result.attempts).toBe(1);
    });

    it('returns timeout error with multiple attempts', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockTimeoutResponse));

      const result = await testSSHConnection('test-server-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timed out');
      expect(result.attempts).toBe(3);
    });

    it('returns host key mismatch error', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockHostKeyMismatchResponse));

      const result = await testSSHConnection('test-server-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Host key verification failed');
      expect(result.host_key_fingerprint).toBeDefined();
    });

    it('throws ApiError on 404 server not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Server not found'));

      await expect(testSSHConnection('nonexistent')).rejects.toThrow(ApiError);

      try {
        await testSSHConnection('nonexistent');
      } catch (error) {
        expect((error as ApiError).status).toBe(404);
      }
    });

    it('throws ApiError on 400 SSH not configured', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'SSH key not configured'));

      await expect(testSSHConnection('test-server-1')).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 503 Tailscale not connected', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(503, 'Tailscale not connected'));

      await expect(testSSHConnection('test-server-1')).rejects.toThrow(ApiError);

      try {
        await testSSHConnection('test-server-1');
      } catch (error) {
        expect((error as ApiError).status).toBe(503);
      }
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(testSSHConnection('test-server-1')).rejects.toThrow('Network error');
    });

    it('includes API key header in request', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSuccessResponse));

      await testSSHConnection('test-server-1');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': expect.any(String),
          }),
        })
      );
    });
  });
});
