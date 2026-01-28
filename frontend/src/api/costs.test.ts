import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCostConfig, updateCostConfig, getCostSummary, getCostBreakdown } from './costs';
import { api } from './client';
import type { CostConfig, CostSummary, CostBreakdown } from '../types/cost';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('Costs API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCostConfig', () => {
    const mockCostConfig: CostConfig = {
      electricity_rate: 0.12,
      currency: 'GBP',
    };

    it('calls GET /api/v1/config/cost endpoint', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockCostConfig);

      await getCostConfig();

      expect(api.get).toHaveBeenCalledWith('/api/v1/config/cost');
    });

    it('returns CostConfig shape', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockCostConfig);

      const result = await getCostConfig();

      expect(result).toEqual(mockCostConfig);
      expect(result.electricity_rate).toBe(0.12);
      expect(result.currency).toBe('GBP');
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('Network error');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getCostConfig()).rejects.toThrow('Network error');
    });
  });

  describe('updateCostConfig', () => {
    const mockUpdatedConfig: CostConfig = {
      electricity_rate: 0.15,
      currency: 'USD',
    };

    it('calls PUT /api/v1/config/cost endpoint', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedConfig);

      await updateCostConfig({ electricity_rate: 0.15, currency: 'USD' });

      expect(api.put).toHaveBeenCalledWith('/api/v1/config/cost', {
        electricity_rate: 0.15,
        currency: 'USD',
      });
    });

    it('returns updated CostConfig shape', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedConfig);

      const result = await updateCostConfig({ electricity_rate: 0.15 });

      expect(result).toEqual(mockUpdatedConfig);
      expect(result.electricity_rate).toBe(0.15);
    });

    it('accepts partial updates', async () => {
      (api.put as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedConfig);

      await updateCostConfig({ currency: 'EUR' });

      expect(api.put).toHaveBeenCalledWith('/api/v1/config/cost', {
        currency: 'EUR',
      });
    });

    it('propagates errors from api.put', async () => {
      const error = new Error('Validation error');
      (api.put as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(updateCostConfig({ electricity_rate: -1 })).rejects.toThrow('Validation error');
    });
  });

  describe('getCostSummary', () => {
    const mockCostSummary: CostSummary = {
      daily_cost: 2.45,
      monthly_cost: 73.5,
      daily_kwh: 20.4,
      monthly_kwh: 612.5,
      currency: 'GBP',
      server_count: 5,
    };

    it('calls GET /api/v1/costs/summary endpoint', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockCostSummary);

      await getCostSummary();

      expect(api.get).toHaveBeenCalledWith('/api/v1/costs/summary');
    });

    it('returns CostSummary shape', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockCostSummary);

      const result = await getCostSummary();

      expect(result).toEqual(mockCostSummary);
      expect(result.daily_cost).toBe(2.45);
      expect(result.monthly_cost).toBe(73.5);
      expect(result.currency).toBe('GBP');
      expect(result.server_count).toBe(5);
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('Network error');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getCostSummary()).rejects.toThrow('Network error');
    });
  });

  describe('getCostBreakdown', () => {
    const mockCostBreakdown: CostBreakdown = {
      servers: [
        {
          server_id: 'server-1',
          hostname: 'server1.local',
          display_name: 'Server 1',
          tdp_watts: 65,
          daily_cost: 0.49,
          monthly_cost: 14.7,
          daily_kwh: 4.08,
          monthly_kwh: 122.5,
        },
        {
          server_id: 'server-2',
          hostname: 'server2.local',
          display_name: 'Server 2',
          tdp_watts: 95,
          daily_cost: 0.72,
          monthly_cost: 21.6,
          daily_kwh: 5.99,
          monthly_kwh: 179.7,
        },
      ],
      total_daily_cost: 1.21,
      total_monthly_cost: 36.3,
      currency: 'GBP',
    };

    it('calls GET /api/v1/costs/breakdown endpoint', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockCostBreakdown);

      await getCostBreakdown();

      expect(api.get).toHaveBeenCalledWith('/api/v1/costs/breakdown');
    });

    it('returns CostBreakdown shape', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(mockCostBreakdown);

      const result = await getCostBreakdown();

      expect(result).toEqual(mockCostBreakdown);
      expect(result.servers).toHaveLength(2);
      expect(result.total_daily_cost).toBe(1.21);
      expect(result.total_monthly_cost).toBe(36.3);
    });

    it('returns empty servers array when no servers', async () => {
      const emptyBreakdown: CostBreakdown = {
        servers: [],
        total_daily_cost: 0,
        total_monthly_cost: 0,
        currency: 'GBP',
      };
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue(emptyBreakdown);

      const result = await getCostBreakdown();

      expect(result.servers).toEqual([]);
      expect(result.total_daily_cost).toBe(0);
    });

    it('propagates errors from api.get', async () => {
      const error = new Error('Network error');
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValue(error);

      await expect(getCostBreakdown()).rejects.toThrow('Network error');
    });
  });
});
