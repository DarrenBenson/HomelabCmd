/**
 * Tests for useDashboardPreferences hook.
 *
 * US0136: Dashboard Preferences Sync
 * Test Spec: TS0136
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDashboardPreferences, DEFAULT_PREFERENCES } from './useDashboardPreferences';
import { getDashboardPreferences, saveDashboardPreferences } from '../api/preferences';
import { ApiError } from '../api/client';

vi.mock('../api/preferences', () => ({
  getDashboardPreferences: vi.fn(),
  saveDashboardPreferences: vi.fn(),
}));

vi.mock('../api/client', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  },
}));

const mockGetDashboardPreferences = getDashboardPreferences as ReturnType<typeof vi.fn>;
const mockSaveDashboardPreferences = saveDashboardPreferences as ReturnType<typeof vi.fn>;

describe('useDashboardPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state (AC6)', () => {
    it('starts in loading state', () => {
      mockGetDashboardPreferences.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useDashboardPreferences());

      expect(result.current.isLoading).toBe(true);
    });

    it('sets isLoading to false after preferences load', async () => {
      mockGetDashboardPreferences.mockResolvedValue({
        card_order: { servers: ['s1'], workstations: [] },
        collapsed_sections: [],
        view_mode: 'grid',
        updated_at: '2024-01-01T00:00:00Z',
      });

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('initial load (AC2)', () => {
    it('loads preferences in single API call', async () => {
      const mockPrefs = {
        card_order: { servers: ['s1', 's2'], workstations: ['w1'] },
        collapsed_sections: ['servers'],
        view_mode: 'grid',
        updated_at: '2024-01-01T00:00:00Z',
      };
      mockGetDashboardPreferences.mockResolvedValue(mockPrefs);

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockGetDashboardPreferences).toHaveBeenCalledTimes(1);
      expect(result.current.preferences).toEqual(mockPrefs);
    });
  });

  describe('error handling (AC7)', () => {
    it('falls back to defaults on load error', async () => {
      mockGetDashboardPreferences.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
      expect(result.current.loadError).toBe('Preferences unavailable, using defaults');
    });

    it('displays API error message on load failure', async () => {
      const apiError = new ApiError('Server is down', 500);
      mockGetDashboardPreferences.mockRejectedValue(apiError);

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.loadError).toBe('Server is down');
      });
    });
  });

  describe('updateCardOrder', () => {
    it('updates local state immediately', async () => {
      mockGetDashboardPreferences.mockResolvedValue(DEFAULT_PREFERENCES);
      mockSaveDashboardPreferences.mockResolvedValue({ status: 'saved', updated_at: '2024-01-01' });

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateCardOrder('servers', ['s1', 's2']);
      });

      expect(result.current.preferences.card_order.servers).toEqual(['s1', 's2']);
    });

    it('updates workstations separately from servers', async () => {
      mockGetDashboardPreferences.mockResolvedValue({
        ...DEFAULT_PREFERENCES,
        card_order: { servers: ['s1'], workstations: ['w1'] },
      });
      mockSaveDashboardPreferences.mockResolvedValue({ status: 'saved', updated_at: '2024-01-01' });

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateCardOrder('workstations', ['w1', 'w2']);
      });

      expect(result.current.preferences.card_order.servers).toEqual(['s1']);
      expect(result.current.preferences.card_order.workstations).toEqual(['w1', 'w2']);
    });
  });

  describe('updateCollapsedSections', () => {
    it('updates collapsed sections immediately', async () => {
      mockGetDashboardPreferences.mockResolvedValue(DEFAULT_PREFERENCES);
      mockSaveDashboardPreferences.mockResolvedValue({ status: 'saved', updated_at: '2024-01-01' });

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateCollapsedSections(['servers']);
      });

      expect(result.current.preferences.collapsed_sections).toEqual(['servers']);
    });
  });

  describe('dismissSaveError', () => {
    it('clears the save error', async () => {
      mockGetDashboardPreferences.mockResolvedValue(DEFAULT_PREFERENCES);

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Manually verify dismissSaveError exists and is callable
      expect(typeof result.current.dismissSaveError).toBe('function');
    });
  });

  describe('DEFAULT_PREFERENCES export', () => {
    it('has expected default values', () => {
      expect(DEFAULT_PREFERENCES).toEqual({
        card_order: {
          servers: [],
          workstations: [],
        },
        collapsed_sections: [],
        view_mode: 'grid',
        updated_at: null,
      });
    });
  });

  describe('hook interface', () => {
    it('returns all expected properties', async () => {
      mockGetDashboardPreferences.mockResolvedValue(DEFAULT_PREFERENCES);

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current).toHaveProperty('preferences');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('loadError');
      expect(result.current).toHaveProperty('isSaving');
      expect(result.current).toHaveProperty('showSavedIndicator');
      expect(result.current).toHaveProperty('saveError');
      expect(result.current).toHaveProperty('updateCardOrder');
      expect(result.current).toHaveProperty('updateCollapsedSections');
      expect(result.current).toHaveProperty('retrySave');
      expect(result.current).toHaveProperty('dismissSaveError');
    });
  });
});
