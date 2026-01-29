import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveCardOrder, getCardOrder } from './preferences';
import { api } from './client';

vi.mock('./client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

describe('preferences API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveCardOrder', () => {
    it('calls PUT with order array', async () => {
      const mockResponse = { status: 'saved', timestamp: '2026-01-28T10:00:00Z' };
      vi.mocked(api.put).mockResolvedValue(mockResponse);

      const order = ['server-1', 'server-2', 'server-3'];
      const result = await saveCardOrder(order);

      expect(api.put).toHaveBeenCalledWith('/api/v1/preferences/card-order', { order });
      expect(result).toEqual(mockResponse);
    });

    it('handles empty order array', async () => {
      const mockResponse = { status: 'saved', timestamp: '2026-01-28T10:00:00Z' };
      vi.mocked(api.put).mockResolvedValue(mockResponse);

      await saveCardOrder([]);

      expect(api.put).toHaveBeenCalledWith('/api/v1/preferences/card-order', { order: [] });
    });
  });

  describe('getCardOrder', () => {
    it('calls GET and returns order array', async () => {
      const mockResponse = { order: ['server-a', 'server-b'] };
      vi.mocked(api.get).mockResolvedValue(mockResponse);

      const result = await getCardOrder();

      expect(api.get).toHaveBeenCalledWith('/api/v1/preferences/card-order');
      expect(result).toEqual(mockResponse);
    });

    it('returns empty array when no order saved', async () => {
      const mockResponse = { order: [] };
      vi.mocked(api.get).mockResolvedValue(mockResponse);

      const result = await getCardOrder();

      expect(result.order).toEqual([]);
    });
  });
});
