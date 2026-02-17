/**
 * Tests for grace period countdown hooks.
 * US0185: Countdown timer behaviour tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useGracePeriodCountdown,
  useServicesGracePeriod,
} from './useGracePeriodCountdown';

describe('useGracePeriodCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null when initialSeconds is null', () => {
    const { result } = renderHook(() => useGracePeriodCountdown(null));
    expect(result.current).toBeNull();
  });

  it('returns null when initialSeconds is 0', () => {
    const { result } = renderHook(() => useGracePeriodCountdown(0));
    expect(result.current).toBeNull();
  });

  it('returns initial value immediately', () => {
    const { result } = renderHook(() => useGracePeriodCountdown(30));
    expect(result.current).toBe(30);
  });

  it('decrements every second', async () => {
    const { result } = renderHook(() => useGracePeriodCountdown(5));

    expect(result.current).toBe(5);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(4);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(3);
  });

  it('calls onExpire when reaching 0', async () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() => useGracePeriodCountdown(2, onExpire));

    expect(result.current).toBe(2);
    expect(onExpire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(1);
    expect(onExpire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBeNull();
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('returns null after countdown completes', async () => {
    const { result } = renderHook(() => useGracePeriodCountdown(2));

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current).toBeNull();
  });

  it('resets when initialSeconds changes', async () => {
    const { result, rerender } = renderHook(
      ({ seconds }) => useGracePeriodCountdown(seconds),
      { initialProps: { seconds: 5 } }
    );

    expect(result.current).toBe(5);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(3);

    // Change initialSeconds - should reset
    rerender({ seconds: 10 });
    expect(result.current).toBe(10);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(9);
  });
});

describe('useServicesGracePeriod', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns empty map for empty services array', () => {
    const refetch = vi.fn();
    const { result } = renderHook(() => useServicesGracePeriod([], refetch));
    expect(result.current.size).toBe(0);
  });

  it('returns initial values for each service', () => {
    const refetch = vi.fn();
    const services = [
      { service_name: 'svc1', grace_period_remaining: 30 },
      { service_name: 'svc2', grace_period_remaining: null },
      { service_name: 'svc3', grace_period_remaining: 60 },
    ];

    const { result } = renderHook(() =>
      useServicesGracePeriod(services, refetch)
    );

    expect(result.current.get('svc1')).toBe(30);
    expect(result.current.get('svc2')).toBeNull();
    expect(result.current.get('svc3')).toBe(60);
  });

  it('decrements all active countdowns every second', async () => {
    const refetch = vi.fn();
    const services = [
      { service_name: 'svc1', grace_period_remaining: 5 },
      { service_name: 'svc2', grace_period_remaining: 10 },
    ];

    const { result } = renderHook(() =>
      useServicesGracePeriod(services, refetch)
    );

    expect(result.current.get('svc1')).toBe(5);
    expect(result.current.get('svc2')).toBe(10);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.get('svc1')).toBe(4);
    expect(result.current.get('svc2')).toBe(9);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.get('svc1')).toBe(2);
    expect(result.current.get('svc2')).toBe(7);
  });

  it('calls refetch when a grace period expires', async () => {
    const refetch = vi.fn();
    const services = [
      { service_name: 'svc1', grace_period_remaining: 2 },
      { service_name: 'svc2', grace_period_remaining: 10 },
    ];

    renderHook(() => useServicesGracePeriod(services, refetch));

    expect(refetch).not.toHaveBeenCalled();

    // Advance to just before expiry
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(refetch).not.toHaveBeenCalled();

    // Advance to trigger expiry
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Refetch is called via setTimeout(refetch, 0)
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('returns null for services whose grace period has expired', async () => {
    const refetch = vi.fn();
    const services = [
      { service_name: 'svc1', grace_period_remaining: 2 },
      { service_name: 'svc2', grace_period_remaining: 10 },
    ];

    const { result } = renderHook(() =>
      useServicesGracePeriod(services, refetch)
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.get('svc1')).toBeNull();
    expect(result.current.get('svc2')).toBe(7);
  });

  it('resets countdowns when services array changes', async () => {
    const refetch = vi.fn();
    const initialServices = [
      { service_name: 'svc1', grace_period_remaining: 10 },
    ];

    const { result, rerender } = renderHook(
      ({ services }) => useServicesGracePeriod(services, refetch),
      { initialProps: { services: initialServices } }
    );

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.get('svc1')).toBe(5);

    // Update services with new grace period
    const newServices = [{ service_name: 'svc1', grace_period_remaining: 20 }];
    rerender({ services: newServices });

    expect(result.current.get('svc1')).toBe(20);
  });

  it('does not tick when no active grace periods', () => {
    const refetch = vi.fn();
    const services = [
      { service_name: 'svc1', grace_period_remaining: null },
      { service_name: 'svc2', grace_period_remaining: 0 },
    ];

    const { result } = renderHook(() =>
      useServicesGracePeriod(services, refetch)
    );

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Values should remain unchanged
    expect(result.current.get('svc1')).toBeNull();
    expect(result.current.get('svc2')).toBeNull();
    expect(refetch).not.toHaveBeenCalled();
  });
});
