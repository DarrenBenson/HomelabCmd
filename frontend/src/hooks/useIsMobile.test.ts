import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile, MOBILE_BREAKPOINT } from './useIsMobile';

describe('useIsMobile', () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restore original window width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  function setWindowWidth(width: number): void {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width,
    });
  }

  function triggerResize(): void {
    window.dispatchEvent(new Event('resize'));
  }

  describe('MOBILE_BREAKPOINT', () => {
    it('exports the correct breakpoint value', () => {
      expect(MOBILE_BREAKPOINT).toBe(768);
    });
  });

  describe('initial state', () => {
    it('returns true when viewport width is below 768px', () => {
      setWindowWidth(600);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(true);
    });

    it('returns false when viewport width is 768px', () => {
      setWindowWidth(768);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(false);
    });

    it('returns false when viewport width is above 768px', () => {
      setWindowWidth(1024);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(false);
    });
  });

  describe('resize handling', () => {
    it('updates to true when resizing to mobile width', async () => {
      setWindowWidth(1024);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(false);

      // Resize to mobile
      act(() => {
        setWindowWidth(600);
        triggerResize();
      });

      // Wait for debounce
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current).toBe(true);
    });

    it('updates to false when resizing to desktop width', async () => {
      setWindowWidth(600);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(true);

      // Resize to desktop
      act(() => {
        setWindowWidth(1024);
        triggerResize();
      });

      // Wait for debounce
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current).toBe(false);
    });

    it('debounces rapid resize events', async () => {
      setWindowWidth(1024);
      const { result } = renderHook(() => useIsMobile());

      // Rapid resize events
      act(() => {
        setWindowWidth(800);
        triggerResize();
      });
      act(() => {
        setWindowWidth(700);
        triggerResize();
      });
      act(() => {
        setWindowWidth(600);
        triggerResize();
      });

      // Before debounce completes, should still be false
      expect(result.current).toBe(false);

      // Wait for debounce
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // Final value should be based on last width (600px)
      expect(result.current).toBe(true);
    });
  });

  describe('cleanup', () => {
    it('removes resize listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderHook(() => useIsMobile());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('boundary conditions', () => {
    it('returns true at 767px (just below breakpoint)', () => {
      setWindowWidth(767);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(true);
    });

    it('returns false at exactly 768px (at breakpoint)', () => {
      setWindowWidth(768);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(false);
    });

    it('handles very narrow viewport (<480px)', () => {
      setWindowWidth(400);
      const { result } = renderHook(() => useIsMobile());
      expect(result.current).toBe(true);
    });
  });
});
