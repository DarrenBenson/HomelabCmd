/**
 * Tests for preferences API client functions.
 *
 * Part of US0132: Section-specific card order and US0136: Unified dashboard preferences.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  saveCardOrder,
  getCardOrder,
  saveSectionOrder,
  getSectionOrder,
  saveCollapsedSections,
  getCollapsedSections,
  getDashboardPreferences,
  saveDashboardPreferences,
} from '../../api/preferences';
import { ApiError } from '../../api/client';
import type {
  CardOrderSaveResponse,
  CardOrderLoadResponse,
  SectionCardOrder,
  SectionCardOrderResponse,
  CollapsedSectionsResponse,
  DashboardPreferences,
  DashboardPreferencesSaveRequest,
  DashboardPreferencesSaveResponse,
} from '../../types/preferences';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock response data
const mockSaveResponse: CardOrderSaveResponse = {
  status: 'saved',
  timestamp: '2026-01-29T10:00:00Z',
};

const mockCardOrderResponse: CardOrderLoadResponse = {
  order: ['server-1', 'server-2', 'workstation-1'],
};

const mockSectionOrderResponse: SectionCardOrderResponse = {
  servers: ['server-1', 'server-2'],
  workstations: ['workstation-1'],
};

const mockCollapsedResponse: CollapsedSectionsResponse = {
  collapsed: ['workstations'],
};

const mockDashboardPreferences: DashboardPreferences = {
  card_order: {
    servers: ['server-1', 'server-2'],
    workstations: ['workstation-1'],
  },
  collapsed_sections: ['workstations'],
  view_mode: 'card',
  updated_at: '2026-01-29T10:00:00Z',
};

const mockDashboardSaveResponse: DashboardPreferencesSaveResponse = {
  status: 'saved',
  updated_at: '2026-01-29T11:00:00Z',
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

describe('preferences API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('saveCardOrder', () => {
    it('returns success response after saving', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSaveResponse));

      const result = await saveCardOrder(['server-1', 'server-2']);

      expect(result).toEqual(mockSaveResponse);
      expect(result.status).toBe('saved');
    });

    it('sends PUT request with order array', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSaveResponse));

      await saveCardOrder(['server-1', 'server-2']);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/preferences/card-order',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ order: ['server-1', 'server-2'] }),
        })
      );
    });

    it('handles empty order array', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSaveResponse));

      await saveCardOrder([]);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ order: [] }),
        })
      );
    });

    it('throws ApiError on 500 server error', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(500, 'Internal server error'));

      await expect(saveCardOrder(['server-1'])).rejects.toThrow(ApiError);
    });
  });

  describe('getCardOrder', () => {
    it('returns card order response', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCardOrderResponse));

      const result = await getCardOrder();

      expect(result).toEqual(mockCardOrderResponse);
      expect(result.order).toHaveLength(3);
    });

    it('calls correct endpoint', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCardOrderResponse));

      await getCardOrder();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/preferences/card-order',
        expect.any(Object)
      );
    });

    it('returns empty order when no preferences saved', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ order: [] }));

      const result = await getCardOrder();

      expect(result.order).toHaveLength(0);
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(getCardOrder()).rejects.toThrow('Network error');
    });
  });

  describe('saveSectionOrder', () => {
    it('returns success response after saving', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSaveResponse));
      const order: SectionCardOrder = {
        servers: ['server-1', 'server-2'],
        workstations: ['workstation-1'],
      };

      const result = await saveSectionOrder(order);

      expect(result.status).toBe('saved');
    });

    it('sends PUT request with section order', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSaveResponse));
      const order: SectionCardOrder = {
        servers: ['server-1'],
        workstations: [],
      };

      await saveSectionOrder(order);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/preferences/section-order',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(order),
        })
      );
    });

    it('throws ApiError on validation error', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Invalid section order'));

      const order: SectionCardOrder = { servers: [], workstations: [] };
      await expect(saveSectionOrder(order)).rejects.toThrow(ApiError);
    });
  });

  describe('getSectionOrder', () => {
    it('returns section order response', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSectionOrderResponse));

      const result = await getSectionOrder();

      expect(result).toEqual(mockSectionOrderResponse);
      expect(result.servers).toHaveLength(2);
      expect(result.workstations).toHaveLength(1);
    });

    it('calls correct endpoint', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSectionOrderResponse));

      await getSectionOrder();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/preferences/section-order',
        expect.any(Object)
      );
    });
  });

  describe('saveCollapsedSections', () => {
    it('returns success response after saving', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSaveResponse));

      const result = await saveCollapsedSections(['workstations']);

      expect(result.status).toBe('saved');
    });

    it('sends PUT request with collapsed sections', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSaveResponse));

      await saveCollapsedSections(['servers', 'workstations']);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/preferences/collapsed-sections',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ collapsed: ['servers', 'workstations'] }),
        })
      );
    });
  });

  describe('getCollapsedSections', () => {
    it('returns collapsed sections response', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockCollapsedResponse));

      const result = await getCollapsedSections();

      expect(result.collapsed).toEqual(['workstations']);
    });

    it('returns empty array when no sections collapsed', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ collapsed: [] }));

      const result = await getCollapsedSections();

      expect(result.collapsed).toHaveLength(0);
    });
  });

  describe('getDashboardPreferences', () => {
    it('returns full dashboard preferences', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDashboardPreferences));

      const result = await getDashboardPreferences();

      expect(result).toEqual(mockDashboardPreferences);
      expect(result.view_mode).toBe('card');
      expect(result.card_order.servers).toHaveLength(2);
    });

    it('calls correct endpoint', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDashboardPreferences));

      await getDashboardPreferences();

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/preferences/dashboard',
        expect.any(Object)
      );
    });

    it('handles null updated_at for new users', async () => {
      const newUserPrefs: DashboardPreferences = {
        ...mockDashboardPreferences,
        updated_at: null,
      };
      mockFetch.mockResolvedValue(createMockResponse(newUserPrefs));

      const result = await getDashboardPreferences();

      expect(result.updated_at).toBeNull();
    });
  });

  describe('saveDashboardPreferences', () => {
    it('returns success response after saving', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDashboardSaveResponse));
      const request: DashboardPreferencesSaveRequest = {
        card_order: {
          servers: ['server-1'],
          workstations: ['workstation-1'],
        },
        collapsed_sections: [],
        view_mode: 'list',
      };

      const result = await saveDashboardPreferences(request);

      expect(result.status).toBe('saved');
      expect(result.updated_at).toBeDefined();
    });

    it('sends PUT request with full preferences', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockDashboardSaveResponse));
      const request: DashboardPreferencesSaveRequest = {
        card_order: {
          servers: ['server-1', 'server-2'],
          workstations: [],
        },
        collapsed_sections: ['workstations'],
        view_mode: 'card',
      };

      await saveDashboardPreferences(request);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/preferences/dashboard',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(request),
        })
      );
    });

    it('throws ApiError on validation error', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Invalid view mode'));
      const request: DashboardPreferencesSaveRequest = {
        card_order: { servers: [], workstations: [] },
        collapsed_sections: [],
        view_mode: 'invalid',
      };

      await expect(saveDashboardPreferences(request)).rejects.toThrow(ApiError);
    });
  });
});
