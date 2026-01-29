import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebouncedSave } from './useDebouncedSave';

describe('useDebouncedSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not call saveFn before delay elapses', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDebouncedSave(saveFn, 500));

    act(() => {
      result.current(['a', 'b']);
    });

    // Before 500ms
    vi.advanceTimersByTime(499);
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('calls saveFn after delay elapses', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDebouncedSave(saveFn, 500));

    act(() => {
      result.current(['a', 'b']);
    });

    // After 500ms
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith(['a', 'b']);
  });

  it('only calls saveFn once for rapid calls (debounce)', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDebouncedSave(saveFn, 500));

    // Make 5 rapid calls
    act(() => {
      result.current(['1']);
      vi.advanceTimersByTime(100);
      result.current(['1', '2']);
      vi.advanceTimersByTime(100);
      result.current(['1', '2', '3']);
      vi.advanceTimersByTime(100);
      result.current(['1', '2', '3', '4']);
      vi.advanceTimersByTime(100);
      result.current(['final']);
    });

    // saveFn not called yet
    expect(saveFn).not.toHaveBeenCalled();

    // After 500ms from last call
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Only called once with final value
    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith(['final']);
  });

  it('uses default 500ms delay', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useDebouncedSave(saveFn));

    act(() => {
      result.current(['test']);
    });

    vi.advanceTimersByTime(499);
    expect(saveFn).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  it('clears timeout on unmount', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() => useDebouncedSave(saveFn, 500));

    act(() => {
      result.current(['test']);
    });

    // Unmount before timeout
    unmount();

    // Advance time past delay
    vi.advanceTimersByTime(600);

    // saveFn should not be called
    expect(saveFn).not.toHaveBeenCalled();
  });
});
