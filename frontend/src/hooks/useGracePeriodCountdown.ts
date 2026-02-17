/**
 * Hook for real-time grace period countdown.
 * US0185: Provides a countdown timer that decrements every second.
 */

import { useEffect, useMemo, useReducer, useRef } from 'react';

/**
 * Hook that provides a decrementing countdown from the initial value.
 *
 * @param initialSeconds Initial seconds remaining (from API)
 * @param onExpire Optional callback when countdown reaches 0
 * @returns Current seconds remaining (updates every second)
 */
export function useGracePeriodCountdown(
  initialSeconds: number | null,
  onExpire?: () => void
): number | null {
  // State: number of seconds elapsed since initialSeconds was set
  const [state, dispatch] = useReducer(
    (
      prev: { key: number | null; elapsed: number },
      action: { type: 'tick' } | { type: 'reset'; key: number | null }
    ) => {
      if (action.type === 'reset') {
        return { key: action.key, elapsed: 0 };
      }
      // tick
      return { ...prev, elapsed: prev.elapsed + 1 };
    },
    { key: initialSeconds, elapsed: 0 }
  );

  // Reset elapsed when initialSeconds changes
  useEffect(() => {
    if (state.key !== initialSeconds) {
      dispatch({ type: 'reset', key: initialSeconds });
    }
  }, [initialSeconds, state.key]);

  // Tick every second while countdown is active
  useEffect(() => {
    if (initialSeconds === null || initialSeconds <= 0) {
      return;
    }

    if (state.elapsed >= initialSeconds) {
      return;
    }

    const timer = setInterval(() => {
      dispatch({ type: 'tick' });
    }, 1000);

    return () => clearInterval(timer);
  }, [initialSeconds, state.elapsed]);

  // Handle expiry callback
  useEffect(() => {
    if (
      initialSeconds !== null &&
      initialSeconds > 0 &&
      state.elapsed >= initialSeconds
    ) {
      onExpire?.();
    }
  }, [initialSeconds, state.elapsed, onExpire]);

  // Compute remaining
  if (initialSeconds === null || initialSeconds <= 0) {
    return null;
  }

  const remaining = initialSeconds - state.elapsed;
  return remaining > 0 ? remaining : null;
}

/**
 * Create a stable key for services array based on grace period values.
 */
function createServicesKey(
  services: Array<{ service_name: string; grace_period_remaining: number | null }>
): string {
  return services
    .map((s) => `${s.service_name}:${s.grace_period_remaining}`)
    .sort()
    .join('|');
}

interface GracePeriodState {
  key: string;
  elapsed: number;
}

type GracePeriodAction = { type: 'tick' } | { type: 'reset'; key: string };

function gracePeriodReducer(
  state: GracePeriodState,
  action: GracePeriodAction
): GracePeriodState {
  if (action.type === 'reset') {
    return { key: action.key, elapsed: 0 };
  }
  // tick
  return { ...state, elapsed: state.elapsed + 1 };
}

/**
 * Hook that tracks grace period for multiple services and triggers refetch on expiry.
 *
 * @param services Array of services with grace_period_remaining
 * @param refetch Function to call when any grace period expires
 * @returns Map of service_name to current remaining seconds
 */
export function useServicesGracePeriod(
  services: Array<{ service_name: string; grace_period_remaining: number | null }>,
  refetch: () => void
): Map<string, number | null> {
  // Create a stable key to detect when services actually change
  const servicesKey = useMemo(() => createServicesKey(services), [services]);

  // State: elapsed seconds since last services update
  const [state, dispatch] = useReducer(gracePeriodReducer, {
    key: servicesKey,
    elapsed: 0,
  });

  // Reset elapsed when services change
  useEffect(() => {
    if (state.key !== servicesKey) {
      dispatch({ type: 'reset', key: servicesKey });
    }
  }, [servicesKey, state.key]);

  // Check if any service has an active grace period
  const maxGracePeriod = useMemo(() => {
    let max = 0;
    for (const service of services) {
      if (service.grace_period_remaining !== null && service.grace_period_remaining > max) {
        max = service.grace_period_remaining;
      }
    }
    return max;
  }, [services]);

  // Track previous elapsed value for detecting transitions
  const prevElapsedRef = useRef(state.elapsed);

  // Reset ref when key changes
  useEffect(() => {
    prevElapsedRef.current = 0;
  }, [state.key]);

  // Tick every second while there are active countdowns
  useEffect(() => {
    if (maxGracePeriod <= 0 || state.elapsed >= maxGracePeriod) {
      return;
    }

    const timer = setInterval(() => {
      dispatch({ type: 'tick' });
    }, 1000);

    return () => clearInterval(timer);
  }, [maxGracePeriod, state.elapsed]);

  // Check for expired grace periods and trigger refetch
  useEffect(() => {
    const prevElapsed = prevElapsedRef.current;
    prevElapsedRef.current = state.elapsed;

    // Check if any grace period just expired
    for (const service of services) {
      const initial = service.grace_period_remaining;
      if (initial !== null && initial > 0) {
        const wasRemaining = initial - prevElapsed;
        const remaining = initial - state.elapsed;
        if (remaining <= 0 && wasRemaining > 0) {
          // A grace period just expired - trigger refetch
          refetch();
          break;
        }
      }
    }
  }, [state.elapsed, services, refetch, prevElapsedRef]);

  // Compute current countdowns from services minus elapsed
  const countdowns = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const service of services) {
      const initial = service.grace_period_remaining;
      if (initial === null || initial <= 0) {
        map.set(service.service_name, null);
      } else {
        const remaining = initial - state.elapsed;
        map.set(service.service_name, remaining > 0 ? remaining : null);
      }
    }
    return map;
  }, [services, state.elapsed]);

  return countdowns;
}
