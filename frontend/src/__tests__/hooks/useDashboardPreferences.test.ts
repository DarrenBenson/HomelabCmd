/**
 * Tests for useDashboardPreferences hook.
 *
 * Part of US0136: Unified Dashboard Preferences.
 * Includes edge cases for improved branch coverage.
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDashboardPreferences, DEFAULT_PREFERENCES } from '../../hooks/useDashboardPreferences';
import { getDashboardPreferences } from '../../api/preferences';
import { ApiError } from '../../api/client';
import type { DashboardPreferences } from '../../types/preferences';

// Mock the API functions
vi.mock('../../api/preferences', () => ({
  getDashboardPreferences: vi.fn(),
  saveDashboardPreferences: vi.fn().mockResolvedValue({ status: 'saved', updated_at: '2026-01-29T11:00:00Z' }),
}));

vi.mock('../../api/client', () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const mockGetDashboardPreferences = getDashboardPreferences as Mock;

const mockPreferences: DashboardPreferences = {
  card_order: {
    servers: ['server-1', 'server-2'],
    workstations: ['ws-1'],
  },
  collapsed_sections: ['workstations'],
  view_mode: 'grid',
  updated_at: '2026-01-29T10:00:00Z',
};

describe('useDashboardPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initial load', () => {
    it('loads preferences successfully', async () => {
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.preferences).toEqual(mockPreferences);
      expect(result.current.loadError).toBeNull();
    });

    it('uses defaults on load error', async () => {
      mockGetDashboardPreferences.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
      expect(result.current.loadError).toBeTruthy();
    });

    it('uses defaults on API error with message', async () => {
      mockGetDashboardPreferences.mockRejectedValue(new ApiError(500, 'Server error'));

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.loadError).toBe('Server error');
    });

    it('calls getDashboardPreferences on mount', async () => {
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(mockGetDashboardPreferences).toHaveBeenCalled();
      });
    });
  });

  describe('DEFAULT_PREFERENCES', () => {
    it('has correct default structure', () => {
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

  describe('Return values', () => {
    it('returns all expected properties', async () => {
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

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

    it('updateCardOrder is a function', async () => {
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.updateCardOrder).toBe('function');
    });

    it('updateCollapsedSections is a function', async () => {
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.updateCollapsedSections).toBe('function');
    });

    it('retrySave is a function', async () => {
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.retrySave).toBe('function');
    });

    it('dismissSaveError is a function', async () => {
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.dismissSaveError).toBe('function');
    });
  });

  describe('Update card order', () => {
    it('updates server card order optimistically', async () => {
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateCardOrder('servers', ['server-2', 'server-1']);
      });

      expect(result.current.preferences.card_order.servers).toEqual(['server-2', 'server-1']);
    });

    it('updates workstation card order optimistically', async () => {
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateCardOrder('workstations', ['ws-2', 'ws-1']);
      });

      expect(result.current.preferences.card_order.workstations).toEqual(['ws-2', 'ws-1']);
    });
  });

  describe('Update collapsed sections', () => {
    it('updates collapsed sections optimistically', async () => {
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateCollapsedSections(['servers', 'workstations']);
      });

      expect(result.current.preferences.collapsed_sections).toEqual(['servers', 'workstations']);
    });
  });

  describe('dismissSaveError', () => {
    it('dismissSaveError clears save error when called', async () => {
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // The function exists and can be called
      expect(typeof result.current.dismissSaveError).toBe('function');

      act(() => {
        result.current.dismissSaveError();
      });

      expect(result.current.saveError).toBeNull();
    });
  });

  describe('retrySave', () => {
    it('retrySave does nothing if no pending data', async () => {
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Call retrySave without any prior updates - no crash
      act(() => {
        result.current.retrySave();
      });

      // Should not trigger save (because there's no pending data)
      // The mock has a default return value, but retrySave should not call it
      expect(result.current.isSaving).toBe(false);
    });

    it('retrySave triggers save when pending data exists', async () => {
      const { saveDashboardPreferences } = await import('../../api/preferences');
      const mockSave = saveDashboardPreferences as Mock;
      mockSave.mockResolvedValue({ status: 'saved', updated_at: '2026-01-29T11:00:00Z' });
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      vi.useFakeTimers();
      const { result } = renderHook(() => useDashboardPreferences());

      // Wait for initial load
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Make an update to create pending data
      act(() => {
        result.current.updateCardOrder('servers', ['server-3', 'server-4']);
      });

      // Call retrySave - should trigger new debounced save with pending data
      act(() => {
        result.current.retrySave();
      });

      // Advance time to trigger debounced save
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });

      // Verify save was called with pending data
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          card_order: expect.objectContaining({
            servers: ['server-3', 'server-4'],
          }),
        })
      );

      vi.useRealTimers();
    });
  });

  describe('Load timeout (AC6)', () => {
    it('sets error message on load timeout', async () => {
      // Make the API call hang to trigger the timeout
      vi.useFakeTimers();
      mockGetDashboardPreferences.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useDashboardPreferences());

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Advance time by 2 seconds (timeout)
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.loadError).toBe('Preferences unavailable, using defaults');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);

      vi.useRealTimers();
    });
  });

  describe('Save error handling', () => {
    it('sets save error on save failure', async () => {
      const { saveDashboardPreferences } = await import('../../api/preferences');
      const mockSave = saveDashboardPreferences as Mock;
      mockSave.mockRejectedValue(new Error('Network failure'));
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      vi.useFakeTimers();
      const { result } = renderHook(() => useDashboardPreferences());

      // Wait for initial load to complete
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Make an update
      act(() => {
        result.current.updateCardOrder('servers', ['server-5']);
      });

      // Advance time to trigger debounced save
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.saveError).toBe('Failed to save preferences');

      vi.useRealTimers();
    });

    it('sets save error with ApiError message', async () => {
      const { saveDashboardPreferences } = await import('../../api/preferences');
      const mockSave = saveDashboardPreferences as Mock;
      mockSave.mockRejectedValue(new ApiError(500, 'Server unavailable'));
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      vi.useFakeTimers();
      const { result } = renderHook(() => useDashboardPreferences());

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.updateCardOrder('servers', ['server-6']);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.saveError).toBe('Server unavailable');

      vi.useRealTimers();
    });
  });

  describe('Saved indicator', () => {
    it('shows saved indicator after successful save', async () => {
      const { saveDashboardPreferences } = await import('../../api/preferences');
      const mockSave = saveDashboardPreferences as Mock;
      mockSave.mockResolvedValue({ status: 'saved', updated_at: '2026-01-29T11:00:00Z' });
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      vi.useFakeTimers();
      const { result } = renderHook(() => useDashboardPreferences());

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      act(() => {
        result.current.updateCardOrder('servers', ['server-7']);
      });

      // Advance time to trigger debounced save
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });

      expect(result.current.showSavedIndicator).toBe(true);

      // Advance time for indicator to hide
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(result.current.showSavedIndicator).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('Debounce behavior', () => {
    it('cancels previous timeout when new update arrives', async () => {
      const { saveDashboardPreferences } = await import('../../api/preferences');
      const mockSave = saveDashboardPreferences as Mock;
      mockSave.mockResolvedValue({ status: 'saved', updated_at: '2026-01-29T11:00:00Z' });
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      vi.useFakeTimers();
      const { result } = renderHook(() => useDashboardPreferences());

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Make first update
      act(() => {
        result.current.updateCardOrder('servers', ['first-update']);
      });

      // Advance time but not enough for save
      act(() => {
        vi.advanceTimersByTime(300);
      });

      // Make second update (should cancel first)
      act(() => {
        result.current.updateCardOrder('servers', ['second-update']);
      });

      // Advance time to trigger save
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });

      // Save should only happen once with the final value
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          card_order: expect.objectContaining({
            servers: ['second-update'],
          }),
        })
      );

      vi.useRealTimers();
    });

    it('debounces multiple rapid updates', async () => {
      const { saveDashboardPreferences } = await import('../../api/preferences');
      const mockSave = saveDashboardPreferences as Mock;
      mockSave.mockResolvedValue({ status: 'saved', updated_at: '2026-01-29T11:00:00Z' });
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      vi.useFakeTimers();
      const { result } = renderHook(() => useDashboardPreferences());

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Make multiple rapid updates
      act(() => {
        result.current.updateCollapsedSections(['a']);
        result.current.updateCollapsedSections(['a', 'b']);
        result.current.updateCollapsedSections(['a', 'b', 'c']);
      });

      // Advance time to trigger save
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });

      // Save should only happen once with the final value
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledWith(
        expect.objectContaining({
          collapsed_sections: ['a', 'b', 'c'],
        })
      );

      vi.useRealTimers();
    });
  });

  describe('Cleanup', () => {
    it('cleans up timeouts on unmount', async () => {
      mockGetDashboardPreferences.mockResolvedValue(mockPreferences);

      vi.useFakeTimers();
      const { result, unmount } = renderHook(() => useDashboardPreferences());

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      // Make an update to create pending save timeout
      act(() => {
        result.current.updateCardOrder('servers', ['cleanup-test']);
      });

      // Unmount before timeout fires
      unmount();

      // Advance time - should not throw
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      vi.useRealTimers();
    });
  });

  describe('Non-Error load failure', () => {
    it('handles non-Error load failures', async () => {
      mockGetDashboardPreferences.mockRejectedValue('String error');

      const { result } = renderHook(() => useDashboardPreferences());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should use default message for non-Error
      expect(result.current.loadError).toBe('Preferences unavailable, using defaults');
    });
  });
});
