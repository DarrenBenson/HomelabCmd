/**
 * Tests for widget-layout API client functions.
 *
 * Part of US0173: Widget Layout Persistence.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getWidgetLayout,
  saveWidgetLayout,
  deleteWidgetLayout,
} from '../../api/widget-layout';
import { ApiError } from '../../api/client';
import type {
  WidgetLayoutResponse,
  WidgetLayoutRequest,
  WidgetLayoutSaveResponse,
} from '../../types/widget-layout';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock layout data
const mockLayouts = {
  lg: [
    { i: 'cpu', x: 0, y: 0, w: 4, h: 2 },
    { i: 'memory', x: 4, y: 0, w: 4, h: 2 },
    { i: 'disk', x: 8, y: 0, w: 4, h: 2 },
  ],
  md: [
    { i: 'cpu', x: 0, y: 0, w: 6, h: 2 },
    { i: 'memory', x: 6, y: 0, w: 6, h: 2 },
    { i: 'disk', x: 0, y: 2, w: 12, h: 2 },
  ],
  sm: [
    { i: 'cpu', x: 0, y: 0, w: 12, h: 2 },
    { i: 'memory', x: 0, y: 2, w: 12, h: 2 },
    { i: 'disk', x: 0, y: 4, w: 12, h: 2 },
  ],
  xs: [
    { i: 'cpu', x: 0, y: 0, w: 12, h: 2 },
    { i: 'memory', x: 0, y: 2, w: 12, h: 2 },
    { i: 'disk', x: 0, y: 4, w: 12, h: 2 },
  ],
};

const mockLayoutResponse: WidgetLayoutResponse = {
  layouts: mockLayouts,
  updated_at: '2026-01-29T10:00:00Z',
};

const mockEmptyLayoutResponse: WidgetLayoutResponse = {
  layouts: null,
  updated_at: null,
};

const mockSaveResponse: WidgetLayoutSaveResponse = {
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

function createMockDeleteResponse(): Response {
  return {
    ok: true,
    status: 204,
    json: () => Promise.reject(new Error('No content')),
  } as Response;
}

describe('widget-layout API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getWidgetLayout', () => {
    it('returns layout response with saved layouts', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockLayoutResponse));

      const result = await getWidgetLayout('machine-1');

      expect(result).toEqual(mockLayoutResponse);
      expect(result.layouts).toBeDefined();
      expect(result.layouts?.lg).toHaveLength(3);
    });

    it('returns null layouts when no custom layout saved', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockEmptyLayoutResponse));

      const result = await getWidgetLayout('machine-1');

      expect(result.layouts).toBeNull();
      expect(result.updated_at).toBeNull();
    });

    it('constructs correct URL with machine ID', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockLayoutResponse));

      await getWidgetLayout('test-machine-123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/machines/test-machine-123/layout',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('throws ApiError on 404 machine not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Machine not found'));

      await expect(getWidgetLayout('nonexistent')).rejects.toThrow(ApiError);
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(getWidgetLayout('machine-1')).rejects.toThrow('Network error');
    });

    it('returns layout with all breakpoints', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockLayoutResponse));

      const result = await getWidgetLayout('machine-1');

      expect(result.layouts).toHaveProperty('lg');
      expect(result.layouts).toHaveProperty('md');
      expect(result.layouts).toHaveProperty('sm');
      expect(result.layouts).toHaveProperty('xs');
    });
  });

  describe('saveWidgetLayout', () => {
    it('returns success response after saving', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSaveResponse));
      const request: WidgetLayoutRequest = { layouts: mockLayouts };

      const result = await saveWidgetLayout('machine-1', request);

      expect(result).toEqual(mockSaveResponse);
      expect(result.status).toBe('saved');
      expect(result.updated_at).toBeDefined();
    });

    it('sends PUT request with layout data', async () => {
      mockFetch.mockResolvedValue(createMockResponse(mockSaveResponse));
      const request: WidgetLayoutRequest = { layouts: mockLayouts };

      await saveWidgetLayout('machine-1', request);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/machines/machine-1/layout',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(request),
        })
      );
    });

    it('throws ApiError on 404 machine not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Machine not found'));
      const request: WidgetLayoutRequest = { layouts: mockLayouts };

      await expect(saveWidgetLayout('nonexistent', request)).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 400 validation error', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(400, 'Invalid layout format'));
      const request: WidgetLayoutRequest = { layouts: mockLayouts };

      await expect(saveWidgetLayout('machine-1', request)).rejects.toThrow(ApiError);

      try {
        await saveWidgetLayout('machine-1', request);
      } catch (error) {
        expect((error as ApiError).status).toBe(400);
      }
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));
      const request: WidgetLayoutRequest = { layouts: mockLayouts };

      await expect(saveWidgetLayout('machine-1', request)).rejects.toThrow('Connection refused');
    });

    it('handles large layout data', async () => {
      const largeLayouts = {
        lg: Array.from({ length: 20 }, (_, i) => ({
          i: `widget-${i}`,
          x: (i % 4) * 3,
          y: Math.floor(i / 4) * 2,
          w: 3,
          h: 2,
        })),
        md: [],
        sm: [],
        xs: [],
      };
      mockFetch.mockResolvedValue(createMockResponse(mockSaveResponse));
      const request: WidgetLayoutRequest = { layouts: largeLayouts };

      const result = await saveWidgetLayout('machine-1', request);

      expect(result.status).toBe('saved');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(request),
        })
      );
    });
  });

  describe('deleteWidgetLayout', () => {
    it('completes successfully with no return value', async () => {
      mockFetch.mockResolvedValue(createMockDeleteResponse());

      await expect(deleteWidgetLayout('machine-1')).resolves.toBeUndefined();
    });

    it('sends DELETE request to correct URL', async () => {
      mockFetch.mockResolvedValue(createMockDeleteResponse());

      await deleteWidgetLayout('machine-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/v1/machines/machine-1/layout',
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('throws ApiError on 404 machine not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Machine not found'));

      await expect(deleteWidgetLayout('nonexistent')).rejects.toThrow(ApiError);
    });

    it('throws ApiError on 404 layout not found', async () => {
      mockFetch.mockResolvedValue(createMockErrorResponse(404, 'Layout not found'));

      await expect(deleteWidgetLayout('machine-1')).rejects.toThrow(ApiError);
    });

    it('throws on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network timeout'));

      await expect(deleteWidgetLayout('machine-1')).rejects.toThrow('Network timeout');
    });
  });
});
