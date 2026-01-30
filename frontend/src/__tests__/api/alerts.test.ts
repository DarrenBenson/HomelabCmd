/**
 * Tests for alerts API client functions.
 *
 * Tests for alert listing, filtering, acknowledgement and resolution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAlerts, getAlert, acknowledgeAlert, resolveAlert } from '../../api/alerts';
import { ApiError } from '../../api/client';
import type { Alert, AlertsResponse, AlertFilters } from '../../types/alert';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock response data
const mockAlert: Alert = {
  id: 1,
  server_id: 'server-1',
  hostname: 'test-server',
  alert_type: 'high_cpu',
  severity: 'critical',
  title: 'High CPU Usage',
  message: 'CPU usage above 90%',
  status: 'active',
  source: 'agent',
  created_at: '2026-01-29T10:00:00Z',
  updated_at: '2026-01-29T10:00:00Z',
  acknowledged_at: null,
  resolved_at: null,
};

const mockAlertsResponse: AlertsResponse = {
  alerts: [mockAlert],
  total: 1,
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

describe('alerts API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getAlerts', () => {
    it('returns alerts list without filters', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockAlertsResponse));

      const result = await getAlerts();

      expect(result).toEqual(mockAlertsResponse);
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/alerts', expect.any(Object));
    });

    it('applies status filter', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockAlertsResponse));
      const filters: AlertFilters = { status: 'active' };

      await getAlerts(filters);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/alerts?status=active',
        expect.any(Object)
      );
    });

    it('applies severity filter', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockAlertsResponse));
      const filters: AlertFilters = { severity: 'critical' };

      await getAlerts(filters);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/alerts?severity=critical',
        expect.any(Object)
      );
    });

    it('applies server_id filter', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockAlertsResponse));
      const filters: AlertFilters = { server_id: 'server-1' };

      await getAlerts(filters);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/alerts?server_id=server-1',
        expect.any(Object)
      );
    });

    it('applies limit and offset', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockAlertsResponse));
      const filters: AlertFilters = { limit: 10, offset: 20 };

      await getAlerts(filters);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('limit=10');
      expect(calledUrl).toContain('offset=20');
    });

    it('ignores status=all filter', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockAlertsResponse));
      const filters: AlertFilters = { status: 'all' };

      await getAlerts(filters);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/alerts', expect.any(Object));
    });

    it('ignores severity=all filter', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockAlertsResponse));
      const filters: AlertFilters = { severity: 'all' };

      await getAlerts(filters);

      expect(mockFetch).toHaveBeenCalledWith('/api/v1/alerts', expect.any(Object));
    });

    it('combines multiple filters', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockAlertsResponse));
      const filters: AlertFilters = {
        status: 'active',
        severity: 'critical',
        server_id: 'server-1',
      };

      await getAlerts(filters);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('status=active');
      expect(calledUrl).toContain('severity=critical');
      expect(calledUrl).toContain('server_id=server-1');
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(getAlerts()).rejects.toThrow('Network error');
    });
  });

  describe('getAlert', () => {
    it('returns single alert', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockAlert));

      const result = await getAlert(1);

      expect(result).toEqual(mockAlert);
      expect(mockFetch).toHaveBeenCalledWith('/api/v1/alerts/1', expect.any(Object));
    });

    it('throws ApiError on 404 not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Alert not found'));

      await expect(getAlert(999)).rejects.toThrow(ApiError);
    });
  });

  describe('acknowledgeAlert', () => {
    it('acknowledges alert successfully', async () => {
      const acknowledgeResponse = {
        id: 1,
        status: 'acknowledged',
        acknowledged_at: '2026-01-29T10:30:00Z',
      };
      mockFetch.mockResolvedValue(createMockResponse(acknowledgeResponse));

      const result = await acknowledgeAlert(1);

      expect(result.status).toBe('acknowledged');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/alerts/1/acknowledge',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
    });

    it('throws ApiError on 404 not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Alert not found'));

      await expect(acknowledgeAlert(999)).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 400 already acknowledged', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Alert already acknowledged'));

      await expect(acknowledgeAlert(1)).rejects.toThrow(ApiError);
    });
  });

  describe('resolveAlert', () => {
    it('resolves alert successfully', async () => {
      const resolveResponse = {
        id: 1,
        status: 'resolved',
        resolved_at: '2026-01-29T11:00:00Z',
      };
      mockFetch.mockResolvedValue(createMockResponse(resolveResponse));

      const result = await resolveAlert(1);

      expect(result.status).toBe('resolved');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/alerts/1/resolve',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({}),
        })
      );
    });

    it('throws ApiError on 404 not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Alert not found'));

      await expect(resolveAlert(999)).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 400 already resolved', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Alert already resolved'));

      await expect(resolveAlert(1)).rejects.toThrow(ApiError);
    });
  });
});
