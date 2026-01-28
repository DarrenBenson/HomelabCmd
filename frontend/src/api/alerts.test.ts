import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAlerts, acknowledgeAlert } from './alerts';

describe('alerts API', () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getAlerts', () => {
    it('fetches alerts without status filter', async () => {
      const mockResponse = {
        alerts: [{ id: 1, title: 'Test alert' }],
        total: 1,
        limit: 50,
        offset: 0,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await getAlerts();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/alerts',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('fetches alerts with status filter', async () => {
      const mockResponse = {
        alerts: [],
        total: 0,
        limit: 50,
        offset: 0,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await getAlerts({ status: 'open' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/alerts?status=open',
        expect.any(Object)
      );
    });

    it('throws error on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(getAlerts()).rejects.toThrow('API error: 500');
    });
  });

  describe('acknowledgeAlert', () => {
    it('sends POST request to acknowledge endpoint', async () => {
      const mockResponse = {
        id: 1,
        status: 'acknowledged',
        acknowledged_at: '2026-01-19T10:00:00Z',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await acknowledgeAlert(1);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/alerts/1/acknowledge',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('throws error on failed acknowledge', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(acknowledgeAlert(999)).rejects.toThrow('API error: 404');
    });
  });
});
