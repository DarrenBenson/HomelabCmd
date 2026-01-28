import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, ApiError } from './client';

describe('API Client', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('api.get', () => {
    it('returns JSON response on success', async () => {
      const mockData = { servers: [], total: 0 };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await api.get('/api/v1/servers');

      expect(result).toEqual(mockData);
    });

    it('throws ApiError with status on failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: 'Internal Server Error' }),
      });

      await expect(api.get('/api/v1/servers')).rejects.toThrow(ApiError);

      try {
        await api.get('/api/v1/servers');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(500);
        // Error message is extracted from response.detail when available
        expect((error as ApiError).message).toBe('Internal Server Error');
      }
    });

    it('throws ApiError with 404 status for not found', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ detail: 'Not Found' }),
      });

      try {
        await api.get('/api/v1/servers/nonexistent');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(404);
      }
    });

    it('throws ApiError with 401 status for unauthorized', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ detail: 'Unauthorized' }),
      });

      try {
        await api.get('/api/v1/servers');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).status).toBe(401);
      }
    });

    it('includes X-API-Key header in request', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await api.get('/api/v1/servers');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': expect.any(String),
          }),
        })
      );
    });

    it('includes Content-Type header in request', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await api.get('/api/v1/servers');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('constructs URL with endpoint', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      await api.get('/api/v1/servers');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/servers'),
        expect.any(Object)
      );
    });
  });

  describe('api.put', () => {
    it('sends PUT request with JSON body', async () => {
      const mockData = { success: true };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await api.put('/api/v1/config', { key: 'value' });

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/config'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ key: 'value' }),
        })
      );
    });

    it('throws ApiError on failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Validation failed' }),
      });

      await expect(api.put('/api/v1/config', {})).rejects.toThrow(ApiError);
    });

    it('extracts error message from detail.message', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({ detail: { message: 'Detailed error message' } }),
      });

      try {
        await api.put('/api/v1/config', {});
      } catch (error) {
        expect((error as ApiError).message).toBe('Detailed error message');
      }
    });
  });

  describe('api.post', () => {
    it('sends POST request with JSON body', async () => {
      const mockData = { id: 123 };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockData),
      });

      const result = await api.post('/api/v1/scans', { hostname: 'test' });

      expect(result).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/scans'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ hostname: 'test' }),
        })
      );
    });

    it('throws ApiError on failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: 'Server error' }),
      });

      await expect(api.post('/api/v1/scans', {})).rejects.toThrow(ApiError);
    });

    it('extracts error message from detail string', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: 'Simple error string' }),
      });

      try {
        await api.post('/api/v1/scans', {});
      } catch (error) {
        expect((error as ApiError).message).toBe('Simple error string');
      }
    });
  });

  describe('api.delete', () => {
    it('sends DELETE request and returns void', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
      });

      const result = await api.delete('/api/v1/scans/123');

      expect(result).toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/scans/123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('throws ApiError on failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ detail: 'Not found' }),
      });

      await expect(api.delete('/api/v1/scans/999')).rejects.toThrow(ApiError);
    });

    it('extracts error message from detail.message', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 409,
        json: () => Promise.resolve({ detail: { message: 'Cannot delete active scan' } }),
      });

      try {
        await api.delete('/api/v1/scans/123');
      } catch (error) {
        expect((error as ApiError).message).toBe('Cannot delete active scan');
        expect((error as ApiError).status).toBe(409);
      }
    });

    it('extracts error message from detail string', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ detail: 'Forbidden operation' }),
      });

      try {
        await api.delete('/api/v1/servers/protected');
      } catch (error) {
        expect((error as ApiError).message).toBe('Forbidden operation');
      }
    });

    it('uses default message on JSON parse failure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      try {
        await api.delete('/api/v1/scans/123');
      } catch (error) {
        expect((error as ApiError).message).toBe('API error: 500');
      }
    });

    it('includes X-API-Key header', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
      });

      await api.delete('/api/v1/scans/123');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': expect.any(String),
          }),
        })
      );
    });
  });

  describe('error handling edge cases', () => {
    it('handles JSON parse failure in GET request', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('Bad Gateway response')),
      });

      try {
        await api.get('/api/v1/servers');
      } catch (error) {
        expect((error as ApiError).message).toBe('API error: 502');
        expect((error as ApiError).status).toBe(502);
      }
    });

    it('handles empty detail object', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: {} }),
      });

      try {
        await api.get('/api/v1/servers');
      } catch (error) {
        // Empty detail object should not match either condition, use default
        expect((error as ApiError).message).toBe('API error: 400');
      }
    });

    it('handles null detail', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ detail: null }),
      });

      try {
        await api.get('/api/v1/servers');
      } catch (error) {
        expect((error as ApiError).message).toBe('API error: 400');
      }
    });

    it('handles response without detail field', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Some other format' }),
      });

      try {
        await api.get('/api/v1/servers');
      } catch (error) {
        expect((error as ApiError).message).toBe('API error: 400');
      }
    });
  });

  describe('ApiError', () => {
    it('has name property set to ApiError', () => {
      const error = new ApiError(500, 'Test error');
      expect(error.name).toBe('ApiError');
    });

    it('has status property', () => {
      const error = new ApiError(404, 'Not found');
      expect(error.status).toBe(404);
    });

    it('has message property', () => {
      const error = new ApiError(500, 'Server error message');
      expect(error.message).toBe('Server error message');
    });

    it('extends Error class', () => {
      const error = new ApiError(500, 'Test');
      expect(error).toBeInstanceOf(Error);
    });
  });
});
