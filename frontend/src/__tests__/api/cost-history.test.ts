/**
 * Tests for cost history API client (US0183).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCostHistory, getMonthlySummary, getServerCostHistory } from '../../api/cost-history';
import * as client from '../../api/client';

// Mock the client module
vi.mock('../../api/client', () => ({
  fetchApi: vi.fn(),
}));

describe('Cost History API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCostHistory', () => {
    it('fetches cost history with required parameters', async () => {
      const mockResponse = {
        items: [],
        aggregation: 'daily',
        start_date: '2026-01-01',
        end_date: '2026-01-07',
        currency_symbol: '£',
      };

      vi.mocked(client.fetchApi).mockResolvedValue(mockResponse);

      const result = await getCostHistory({
        startDate: '2026-01-01',
        endDate: '2026-01-07',
      });

      expect(client.fetchApi).toHaveBeenCalledWith(
        '/costs/history?start_date=2026-01-01&end_date=2026-01-07'
      );
      expect(result).toEqual(mockResponse);
    });

    it('includes server_id when provided', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue({ items: [] });

      await getCostHistory({
        startDate: '2026-01-01',
        endDate: '2026-01-07',
        serverId: 'server-123',
      });

      expect(client.fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('server_id=server-123')
      );
    });

    it('includes aggregation when provided', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue({ items: [] });

      await getCostHistory({
        startDate: '2026-01-01',
        endDate: '2026-01-07',
        aggregation: 'weekly',
      });

      expect(client.fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('aggregation=weekly')
      );
    });

    it('includes all optional parameters when provided', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue({ items: [] });

      await getCostHistory({
        startDate: '2026-01-01',
        endDate: '2026-01-07',
        serverId: 'server-123',
        aggregation: 'monthly',
      });

      const call = vi.mocked(client.fetchApi).mock.calls[0][0] as string;
      expect(call).toContain('start_date=2026-01-01');
      expect(call).toContain('end_date=2026-01-07');
      expect(call).toContain('server_id=server-123');
      expect(call).toContain('aggregation=monthly');
    });
  });

  describe('getMonthlySummary', () => {
    it('fetches monthly summary without year parameter', async () => {
      const mockResponse = {
        months: [],
        year: 2026,
        year_to_date_cost: 0,
        currency_symbol: '£',
      };

      vi.mocked(client.fetchApi).mockResolvedValue(mockResponse);

      const result = await getMonthlySummary();

      expect(client.fetchApi).toHaveBeenCalledWith('/costs/summary/monthly');
      expect(result).toEqual(mockResponse);
    });

    it('fetches monthly summary with year parameter', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue({ months: [], year: 2025 });

      await getMonthlySummary(2025);

      expect(client.fetchApi).toHaveBeenCalledWith('/costs/summary/monthly?year=2025');
    });
  });

  describe('getServerCostHistory', () => {
    it('fetches server cost history with default period', async () => {
      const mockResponse = {
        server_id: 'server-123',
        hostname: 'test-server',
        period: '30d',
        items: [],
        currency_symbol: '£',
      };

      vi.mocked(client.fetchApi).mockResolvedValue(mockResponse);

      const result = await getServerCostHistory('server-123');

      expect(client.fetchApi).toHaveBeenCalledWith(
        '/servers/server-123/costs/history?period=30d'
      );
      expect(result).toEqual(mockResponse);
    });

    it('fetches server cost history with custom period', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue({ items: [] });

      await getServerCostHistory('server-123', '7d');

      expect(client.fetchApi).toHaveBeenCalledWith(
        '/servers/server-123/costs/history?period=7d'
      );
    });

    it('fetches server cost history with 90d period', async () => {
      vi.mocked(client.fetchApi).mockResolvedValue({ items: [] });

      await getServerCostHistory('server-123', '90d');

      expect(client.fetchApi).toHaveBeenCalledWith(
        '/servers/server-123/costs/history?period=90d'
      );
    });
  });
});
