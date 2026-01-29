import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook for debounced save operations (US0131: Card Order Persistence).
 * Delays the save function call until the delay has elapsed since the last call.
 * Only saves the final value when rapid changes occur.
 *
 * @param saveFn - Async function to call with the value to save
 * @param delay - Debounce delay in milliseconds (default 500ms per AC1)
 * @returns Debounced save function
 */
export function useDebouncedSave<T>(
  saveFn: (value: T) => Promise<void>,
  delay: number = 500
): (value: T) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef<T | null>(null);

  const debouncedSave = useCallback(
    (value: T) => {
      latestValueRef.current = value;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(async () => {
        if (latestValueRef.current !== null) {
          await saveFn(latestValueRef.current);
        }
      }, delay);
    },
    [saveFn, delay]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedSave;
}
